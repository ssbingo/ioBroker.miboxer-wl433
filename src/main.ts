/*
 * Created with @iobroker/create-adapter v3.1.5
 *
 * Local control of MiBoxer PW01/PW02 LoRa pool lights via the WL-433 gateway.
 * The gateway is a single Tuya device and is controlled via the Tuya LAN protocol (TCP 6668), no cloud involved.
 * Lights, zones and scenes are controlled with the vendor specific frames of datapoint 101 (src/lib/wl433.ts), the
 * gateway reports its status the same way. Background: doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md.
 *
 * Logging: see src/lib/logging.ts for the level concept. Every message carries a component tag:
 * [cfg] configuration, [conn] connection, [rx] gateway -> states, [cmd] states -> commands, [queue] command queue,
 * [poll] status refresh, [disc] LAN discovery, [dp101] raw frames, [timer] timers, [unload] shutdown,
 * [tuyapi] library trace.
 */

import * as utils from "@iobroker/adapter-core";
import TuyaDevice from "tuyapi";
import { CommandType } from "tuyapi/lib/message-parser";
import {
    degreesToHueByte,
    hueByteToDegrees,
    hueSaturationToRgbHex,
    kelvinToTemperatureStep,
    rgbHexToHueSaturation,
    temperatureStepToKelvin,
} from "./lib/color";
import { type DiscoveredDevice, DISCOVERY_PORTS, TuyaDiscovery } from "./lib/discovery";
import { decodeDp101, type Dp101Frame, encodeDp101Hex } from "./lib/dp101";
import { bridgeTuyapiDebug, formatDuration, redact, shorten } from "./lib/logging";
import { LANGUAGES, objectName } from "./lib/object-names";
import {
    ASTRO_TRIGGERS,
    describeAction,
    describeSchedule,
    formatLocal,
    type GeoPosition,
    MAX_TIMERS,
    type NextRun,
    nextRun,
    parseTimer,
    type Timer,
    type TimerConfig,
    toList,
} from "./lib/timers";
import {
    BASE_OBJECTS,
    COUNTDOWN_MAX,
    DP,
    DP101_HISTORY_LENGTH,
    LIGHT_MODES,
    lightChannel,
    STATUS_ONLY_DPS,
    ZONE_MODES,
    zoneChannelId,
    zoneChannelObjects,
    type ZoneMode,
    ZONES_FOLDER,
    zoneSelectorState,
} from "./lib/objects";
import {
    buildCommand,
    buildDmxCommand,
    buildStatusQuery,
    COMMAND,
    describeCommand,
    describeStatus,
    FRAME_TYPE,
    DMX_ADDRESS_MAX,
    DMX_ADDRESS_MIN,
    KEY,
    parseDmxAnswer,
    parseStatus,
    SCENE_COUNT,
    type Wl433Mode,
    type Wl433Status,
    ZONE_ALL,
    ZONE_COUNT,
} from "./lib/wl433";

type DpValue = string | number | boolean;
type DpMap = Record<string, DpValue>;

/** Values of the lights as the WL-433 knows them (hue byte, colour temperature step) */
interface LightValues {
    on?: boolean;
    mode?: Wl433Mode;
    /** scene 1..9, 0 = no scene */
    scene?: number;
    /** hue byte 0..255 */
    hue?: number;
    /** saturation 0..100 % */
    saturation?: number;
    /** colour temperature step 0..38 */
    temperature?: number;
    /** brightness 1..100 % */
    brightness?: number;
}

/** A command of the WL-433 protocol in datapoint 101 */
interface Wl433Command {
    frame: Dp101Frame;
    /** zone 0 = all zones, 1..8 */
    zone: number;
    /** e.g. "brightness 40 (zone 2)" */
    description: string;
    /** a queued command is replaced by a newer one with the same key, undefined = never replaced */
    key: string | undefined;
    /** values the command sets, they must appear in the next status of the gateway (empty = not visible there) */
    update: LightValues;
    /** the adapter's own status query: not recorded in the history, not confirmed */
    internal: boolean;
    /** DMX start address of a DMX command, confirmed by the DMX answer of the gateway instead of the status */
    dmx?: number;
}

/** A queued write to the gateway */
interface Command {
    /** Correlation number, appears in every log line of this command */
    seq: number;
    /** State that caused the command, e.g. "light.color" */
    source: string;
    dps: DpMap;
    queuedAt: number;
    /** Called after the gateway accepted the command, with the time the command was sent */
    onSuccess?: (sentAt: number) => Promise<void>;
    /** Datapoint 101 command: sent without waiting for an answer, confirmed by the next status of the gateway */
    wl433?: Wl433Command;
}

/** A sent command that waits for the status of the gateway */
interface PendingConfirmation {
    seq: number;
    source: string;
    command: Wl433Command;
    sentAt: number;
}

/** Where the commands of a control state go */
interface Target {
    /** "light" or "zones.zone<n>" */
    channel: string;
    /** 0 = all zones, 1..8 */
    zone: number;
    /** true for zones.zone<n>: its states show the last values sent, the gateway does not report zones */
    isZoneChannel: boolean;
}

/** One frame of a state command */
interface Step {
    command: number;
    value: number;
    /** values the frame sets */
    update: LightValues;
    /** why the step is needed, for the log */
    reason?: string;
}

/** Entry of dp101.history */
interface HistoryEntry {
    ts: string;
    dir: "rx" | "tx";
    base64: string;
    hex: string;
    checksumValid: boolean;
}

const PROTOCOL_VERSIONS = ["3.1", "3.3", "3.4", "3.5"];
const DEFAULT_PROTOCOL_VERSION = "3.3";
const DEFAULT_ZONE_MODE: ZoneMode = "selector";
const LOCAL_KEY_LENGTH = 16;
const TUYA_PORT = 6668;
/** How long the LAN is searched for presence broadcasts */
const DISCOVERY_DURATION_MS = 12_000;
/** Upper limit for establishing a connection including the session key negotiation of protocol 3.4/3.5 */
const CONNECT_TIMEOUT_MS = 15_000;
/** Connections that drop faster than this are counted as failed attempts */
const SHORT_CONNECTION_MS = 10_000;
/** Consecutive failures before the troubleshooting hint is logged */
const FAILURES_BEFORE_HINT = 3;
/** Collects rapid state changes (e.g. from a slider) into one Tuya command, also the gap between DP 101 frames */
const COMMAND_DEBOUNCE_MS = 150;
const MAX_QUEUED_COMMANDS = 50;
const DEFAULT_RECONNECT_S = 30;
const MIN_RECONNECT_S = 5;
const MIN_POLL_S = 10;
/** The gateway reports its status about 2.5 s after the last change, after this time the status is requested */
const STATUS_REPORT_TIMEOUT_MS = 6_000;
/** The gateway answers a status query within about 0.4 s */
const STATUS_QUERY_TIMEOUT_MS = 3_000;
/** Unanswered status queries in a row before the user is warned */
const UNANSWERED_QUERIES_BEFORE_WARNING = 3;
/** The gateway answers a DMX command within about 0.5 s */
const DMX_ANSWER_TIMEOUT_MS = 5_000;
/** Longest single wait of a timer, longer waits are split (setTimeout accepts at most about 24.8 days) */
const MAX_TIMER_WAIT_MS = 24 * 60 * 60 * 1000;

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function errorStack(error: unknown): string {
    return error instanceof Error && error.stack ? error.stack : String(error);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function toNumber(value: ioBroker.StateValue): number {
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) {
        throw new Error("a number is expected");
    }
    return num;
}

function toBoolean(value: ioBroker.StateValue): boolean {
    if (typeof value === "string") {
        return ["true", "1", "on"].includes(value.trim().toLowerCase());
    }
    return Boolean(value);
}

function describeDevices(devices: DiscoveredDevice[]): string {
    return devices.map(device => `${device.id} @ ${device.ip} (${device.version})`).join(", ");
}

/** Tuya command byte -> name, for readable log lines */
const COMMAND_NAMES = new Map<number, string>();
for (const [name, byte] of Object.entries(CommandType)) {
    if (!COMMAND_NAMES.has(byte)) {
        COMMAND_NAMES.set(byte, name);
    }
}

function commandName(commandByte: number | undefined): string {
    if (commandByte === undefined) {
        return "unknown command";
    }
    return `${COMMAND_NAMES.get(commandByte) ?? "unknown"} (${commandByte})`;
}

function seqList(items: { seq: number }[]): string {
    return [...new Set(items.map(item => `#${item.seq}`))].join(",");
}

/**
 * Name of a timer as entered in the instance settings, "" if none.
 *
 * @param config - timer of native.timers
 */
function configName(config: TimerConfig | undefined): string {
    return typeof config?.name === "string" ? config.name : "";
}

/**
 * Key under which a queued command is replaced by a newer one: the last value of a slider wins. The speed keys are
 * never replaced, every press counts.
 *
 * @param command - command byte
 * @param value - value byte
 * @param zone - zone 0..8
 */
function replaceKey(command: number, value: number, zone: number): string | undefined {
    if (command !== COMMAND.KEY) {
        return `${zone}:${command}`;
    }
    if (value === KEY.ON || value === KEY.OFF) {
        return `${zone}:power`;
    }
    return value === KEY.WHITE ? `${zone}:white` : undefined;
}

/**
 * Checks whether a status of the gateway shows all values a command set.
 *
 * @param status - decoded status
 * @param update - values set by the command
 */
function statusMatches(status: Wl433Status, update: LightValues): boolean {
    return statusDifferences(status, update).length === 0;
}

/**
 * Lists the values of a command that the status does not show, for the log, e.g. ["brightness 40 (status 30)"].
 *
 * @param status - decoded status
 * @param update - values set by the command
 */
function statusDifferences(status: Wl433Status, update: LightValues): string[] {
    const differences: string[] = [];
    for (const key of Object.keys(update) as (keyof LightValues)[]) {
        const expected = update[key];
        const reported = status[key];
        if (expected !== undefined && expected !== reported) {
            differences.push(`${key} ${String(expected)} (status ${String(reported)})`);
        }
    }
    return differences;
}

class MiboxerWl433 extends utils.Adapter {
    private device: TuyaDevice | undefined;
    private gatewayConnected = false;
    private connectedAt = 0;
    private unloading = false;
    private ip = "";
    private protocolVersion = DEFAULT_PROTOCOL_VERSION;
    private zoneMode: ZoneMode = DEFAULT_ZONE_MODE;
    /** zone of the light.* commands in the zone mode "selector", 0 = all zones */
    private selectedZone = ZONE_ALL;
    private reconnectDelayMs = DEFAULT_RECONNECT_S * 1000;
    private pollDelayMs = 0;
    private connectAttempt = 0;
    private connectStartedAt = 0;
    private failedAttempts = 0;
    private problemReported = false;
    private discoveryWarned = false;
    private lastFoundIp = "";
    private undecodableReported = false;
    private unknownStatusReported = false;
    private reconnectTimer: ioBroker.Timeout | undefined;
    private pollTimer: ioBroker.Timeout | undefined;
    private flushTimer: ioBroker.Timeout | undefined;
    private stableTimer: ioBroker.Timeout | undefined;
    private confirmTimer: ioBroker.Timeout | undefined;
    private queryTimer: ioBroker.Timeout | undefined;
    private sending = false;
    private commandSeq = 0;
    private commandQueue: Command[] = [];
    private dp101History: HistoryEntry[] = [];
    private lastDp101RxAt = 0;
    /** last status reported by the gateway (datapoint 101) */
    private status: Wl433Status | undefined;
    private lastStatusAt = 0;
    /** mode and scene before the lights were switched off (the status does not contain them while off) */
    private lastMode: Wl433Mode | undefined;
    private lastScene = 0;
    /** sent commands waiting for the status that shows their effect */
    private pendingConfirmations: PendingConfirmation[] = [];
    /** the status was requested because the report of the gateway did not arrive */
    private confirmationQueryAsked = false;
    private confirmationProblemReported = false;
    private statusQuerySentAt = 0;
    private unansweredQueries = 0;
    private queryProblemReported = false;
    /** last values sent to the zone channels (zone mode "channels"), index 1..8 */
    private readonly zoneValues: LightValues[] = Array.from({ length: ZONE_COUNT + 1 }, () => ({}));
    private restoreTuyapiDebug: (() => void) | undefined;
    /** Values that must never appear in the log */
    private secrets: string[] = [];
    /** Value types of the dynamically created raw.dp<n> states */
    private readonly rawTypes = new Map<string, ioBroker.CommonType>();
    /** Mapped datapoints that arrived with an unexpected type (reported once) */
    private readonly unexpectedDps = new Set<string>();
    /** Finish callbacks of running LAN discoveries, called on unload */
    private readonly activeDiscoveries = new Set<() => void>();
    /** valid timers of the instance settings */
    private timers: Timer[] = [];
    /** why timers of the instance settings are ignored, by position */
    private readonly timerErrors = new Map<number, string>();
    private readonly timerTimeouts = new Map<number, ioBroker.Timeout>();
    /** switch-off after the duration of a timer, by position */
    private readonly timerOffTimeouts = new Map<number, ioBroker.Timeout>();
    private readonly timerRuns = new Map<number, NextRun | null>();
    private timersActive = true;
    private position: GeoPosition | undefined;
    private timerProblemReported = false;
    /** last known DMX start address (the status only contains its low byte) */
    private dmxAddress: number | undefined;
    private pendingDmx: { seq: number; address: number; sentAt: number } | undefined;
    private dmxTimer: ioBroker.Timeout | undefined;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "miboxer-wl433",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        await this.setState("info.connection", false, true);

        this.zoneMode = this.readZoneMode();
        await this.createObjects();
        await this.restoreHistory();
        await this.restoreZoneState();

        if (!this.readConfig()) {
            return;
        }

        if (this.log.level === "silly") {
            this.restoreTuyapiDebug = bridgeTuyapiDebug(line => this.log.silly(`[tuyapi] ${line}`), this.secrets);
            this.log.debug("[cfg] Log level silly: tuyapi protocol trace is written with the tag [tuyapi]");
        }

        if (this.ip) {
            await this.setState("info.ip", this.ip, true);
        }

        this.subscribeStates("light.*");
        this.subscribeStates("dp101.raw");
        this.subscribeStates("dp101.hex");
        this.subscribeStates("raw.*");
        this.subscribeStates("timers.active");
        this.subscribeStates("settings.dmxAddress");
        if (this.zoneMode === "channels") {
            this.subscribeStates(`${ZONES_FOLDER}.*`);
        }
        this.log.debug(
            `[cfg] Subscribed to light.*, dp101.raw, dp101.hex, raw.*, timers.active, settings.dmxAddress${this.zoneMode === "channels" ? `, ${ZONES_FOLDER}.*` : ""}`,
        );

        await this.setupTimers();
        await this.connectGateway();
    }

    private readZoneMode(): ZoneMode {
        const configured = String(this.config.zoneMode ?? "");
        if ((ZONE_MODES as readonly string[]).includes(configured)) {
            return configured as ZoneMode;
        }
        if (!configured) {
            // instances created with version 0.0.1 do not have this setting until it is saved in the admin
            this.log.debug(`[cfg] Zone mode not set yet, using "${DEFAULT_ZONE_MODE}"`);
            return DEFAULT_ZONE_MODE;
        }
        this.log.warn(
            `[cfg] Unknown zone mode "${configured}", using "${DEFAULT_ZONE_MODE}" (allowed: ${ZONE_MODES.join(", ")})`,
        );
        return DEFAULT_ZONE_MODE;
    }

    /** Creates the objects of the configured zone mode and removes those of the other one. */
    private async createObjects(): Promise<void> {
        await this.removeObsoleteModeValue();
        const definitions = [lightChannel(this.zoneMode), ...BASE_OBJECTS];
        if (this.zoneMode === "selector") {
            definitions.push(zoneSelectorState());
        } else {
            definitions.push(...zoneChannelObjects());
        }
        for (const definition of definitions) {
            await this.extendObject(definition.id, definition.obj);
        }
        this.log.debug(
            `[cfg] ${definitions.length} objects created/updated for the zone mode "${this.zoneMode}" (names in ${LANGUAGES.length} languages)`,
        );

        const obsolete = this.zoneMode === "selector" ? ZONES_FOLDER : "light.zone";
        if (await this.getObjectAsync(obsolete)) {
            await this.delObjectAsync(obsolete, { recursive: true });
            this.log.info(`[cfg] Zone mode "${this.zoneMode}": removed ${obsolete}, it belongs to the other zone mode`);
        }
    }

    /**
     * Version 0.0.1 offered the mode "music", the WL-433 has no such mode. extendObject cannot remove a value from
     * common.states, so the object is created again.
     */
    private async removeObsoleteModeValue(): Promise<void> {
        const obj = await this.getObjectAsync("light.mode");
        const states = obj?.common?.states;
        if (states && typeof states === "object" && !Array.isArray(states) && "music" in states) {
            await this.delObjectAsync("light.mode");
            this.log.info(
                '[cfg] light.mode is created again without the mode "music" (not supported by the WL-433); custom settings of this state (e.g. history) have to be set again',
            );
        }
    }

    /** Restores the selected zone and the last values of the zone channels. */
    private async restoreZoneState(): Promise<void> {
        if (this.zoneMode === "selector") {
            const state = await this.getStateAsync("light.zone");
            const zone = Number(state?.val);
            this.selectedZone = Number.isInteger(zone) && zone >= ZONE_ALL && zone <= ZONE_COUNT ? zone : ZONE_ALL;
            this.log.debug(
                `[cfg] light.* commands go to ${this.selectedZone === ZONE_ALL ? "all zones" : `zone ${this.selectedZone}`}`,
            );
            return;
        }
        for (let zone = 1; zone <= ZONE_COUNT; zone++) {
            const values: LightValues = {};
            const read = async (name: string): Promise<ioBroker.StateValue | undefined> =>
                (await this.getStateAsync(`${zoneChannelId(zone)}.${name}`))?.val ?? undefined;
            const on = await read("on");
            if (typeof on === "boolean") {
                values.on = on;
            }
            const mode = await read("mode");
            if (typeof mode === "string" && (LIGHT_MODES as readonly string[]).includes(mode)) {
                values.mode = mode as Wl433Mode;
            }
            const scene = await read("scene");
            if (typeof scene === "number") {
                values.scene = scene;
            }
            const hue = await read("hue");
            if (typeof hue === "number") {
                values.hue = degreesToHueByte(hue);
            }
            const saturation = await read("saturation");
            if (typeof saturation === "number") {
                values.saturation = saturation;
            }
            const kelvin = await read("colorTemperature");
            if (typeof kelvin === "number") {
                values.temperature = kelvinToTemperatureStep(kelvin);
            }
            const brightness = await read("brightness");
            if (typeof brightness === "number") {
                values.brightness = brightness;
            }
            this.zoneValues[zone] = values;
        }
        const restored = this.zoneValues
            .map((values, zone) => (zone && Object.keys(values).length ? `zone ${zone} ${JSON.stringify(values)}` : ""))
            .filter(Boolean);
        this.log.debug(
            `[cfg] Last confirmed values of the zone channels: ${restored.length ? restored.join(", ") : "none yet"} ` +
                "(hue as byte 0-255, colour temperature as step 0-38)",
        );
    }

    /**
     * Validates the configuration and logs a summary (without secrets).
     *
     * @returns false if the adapter cannot work with this configuration
     */
    private readConfig(): boolean {
        const deviceId = String(this.config.deviceId ?? "").trim();
        const localKey = String(this.config.localKey ?? "");
        this.secrets = localKey ? [localKey] : [];

        const version = String(this.config.protocolVersion ?? "");
        if (PROTOCOL_VERSIONS.includes(version)) {
            this.protocolVersion = version;
        } else {
            this.log.warn(
                `[cfg] Unknown Tuya protocol version "${version}", using ${DEFAULT_PROTOCOL_VERSION} (allowed: ${PROTOCOL_VERSIONS.join(", ")})`,
            );
            this.protocolVersion = DEFAULT_PROTOCOL_VERSION;
        }

        const reconnect = Number(this.config.reconnectInterval);
        if (Number.isFinite(reconnect) && reconnect >= MIN_RECONNECT_S) {
            this.reconnectDelayMs = reconnect * 1000;
        } else {
            this.log.warn(
                `[cfg] Reconnect delay "${this.config.reconnectInterval}" is invalid or below ${MIN_RECONNECT_S} s, using ${DEFAULT_RECONNECT_S} s`,
            );
            this.reconnectDelayMs = DEFAULT_RECONNECT_S * 1000;
        }

        const poll = Number(this.config.pollInterval);
        if (!Number.isFinite(poll) || poll <= 0) {
            this.pollDelayMs = 0;
        } else if (poll < MIN_POLL_S) {
            this.log.warn(`[cfg] Status refresh interval ${poll} s is below ${MIN_POLL_S} s, using ${MIN_POLL_S} s`);
            this.pollDelayMs = MIN_POLL_S * 1000;
        } else {
            this.pollDelayMs = poll * 1000;
        }

        this.ip = String(this.config.ip ?? "").trim();

        if (!deviceId) {
            this.log.error(
                "[cfg] Adapter is not configured: please enter the device ID and the local key of the WL-433 gateway in the instance settings",
            );
            return false;
        }
        if (localKey.length !== LOCAL_KEY_LENGTH) {
            this.log.error(
                `[cfg] The local key must have exactly ${LOCAL_KEY_LENGTH} characters (configured: ${localKey.length}), please correct it in the instance settings`,
            );
            return false;
        }

        const zones =
            this.zoneMode === "selector"
                ? "zone selector light.zone"
                : `one channel per zone (${zoneChannelId(1)} … ${zoneChannelId(ZONE_COUNT)})`;
        this.log.info(
            `[cfg] Gateway ${deviceId}, IP ${this.ip || "automatic (UDP discovery)"}, Tuya protocol ${this.protocolVersion}, ` +
                `reconnect delay ${formatDuration(this.reconnectDelayMs)}, status refresh ${this.pollDelayMs ? formatDuration(this.pollDelayMs) : "off"}, ` +
                `zones: ${zones}, local key ${localKey.length} characters (hidden)`,
        );
        this.log.debug(`[cfg] Log level ${this.log.level}, node ${process.version}`);
        return true;
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback - Callback function
     */
    private onUnload(callback: () => void): void {
        try {
            this.unloading = true;
            this.log.debug(
                `[unload] Stopping: ${this.activeDiscoveries.size} discovery run(s), ${this.commandQueue.length} pending command(s), ` +
                    `${this.pendingConfirmations.length} unconfirmed command(s), connection ${this.gatewayConnected ? "open" : "closed"}`,
            );
            this.clearReconnectTimer();
            this.clearPollTimer();
            this.clearStableTimer();
            this.clearConfirmTimer();
            this.clearQueryTimer();
            this.clearAllTimers();
            if (this.dmxTimer) {
                this.clearTimeout(this.dmxTimer);
                this.dmxTimer = undefined;
            }
            if (this.flushTimer) {
                this.clearTimeout(this.flushTimer);
                this.flushTimer = undefined;
            }
            for (const finish of [...this.activeDiscoveries]) {
                finish();
            }
            if (this.commandQueue.length) {
                this.log.debug(`[unload] Discarding pending commands ${seqList(this.commandQueue)}`);
            }
            this.commandQueue = [];
            this.pendingConfirmations = [];
            this.destroyTuyaDevice("adapter stops");
            this.gatewayConnected = false;
            this.restoreTuyapiDebug?.();
            this.restoreTuyapiDebug = undefined;
            void this.setState("info.connection", false, true);
            this.log.debug("[unload] All timers, sockets and listeners released");
            callback();
        } catch (error) {
            this.log.error(`[unload] Error during unloading: ${errorText(error)}`);
            this.log.debug(`[unload] ${errorStack(error)}`);
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param id - State ID
     * @param state - State object
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state || state.ack || this.unloading) {
            return;
        }
        const localId = id.substring(this.namespace.length + 1);
        const seq = ++this.commandSeq;
        this.log.debug(
            `[cmd] #${seq} ${localId} = ${JSON.stringify(state.val)} (from ${state.from || "unknown"}${state.user ? `, ${state.user}` : ""})`,
        );
        this.handleCommand(seq, localId, state.val).catch((error: unknown) => {
            this.log.warn(`[cmd] #${seq} ${localId} = ${JSON.stringify(state.val)} not executed: ${errorText(error)}`);
            this.log.debug(`[cmd] #${seq} ${errorStack(error)}`);
        });
    }

    /**
     * Handles the "discover" request of the "Search gateway" button in the instance settings.
     *
     * @param obj - message from the admin UI
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj?.callback) {
            return;
        }
        if (obj.command !== "discover") {
            this.log.debug(`[disc] Ignoring unknown message "${obj.command}" from ${obj.from}`);
            return;
        }
        const message = obj.message as { deviceId?: unknown } | undefined;
        const wantedId = typeof message?.deviceId === "string" ? message.deviceId.trim() : "";
        this.log.debug(`[disc] Search requested by ${obj.from} for ${wantedId ? `device ${wantedId}` : "all devices"}`);
        let response: Record<string, unknown>;
        try {
            response = await this.handleDiscoverRequest(wantedId);
        } catch (error) {
            this.log.warn(`[disc] Search failed: ${errorText(error)}`);
            this.log.debug(`[disc] ${errorStack(error)}`);
            response = { error: errorText(error) };
        }
        this.log.debug(`[disc] Answer to ${obj.from}: ${JSON.stringify(response)}`);
        this.sendTo(obj.from, obj.command, response, obj.callback);
    }

    // ------------------------------------------------------------------ connection

    private async connectGateway(): Promise<void> {
        if (this.unloading) {
            return;
        }
        this.clearReconnectTimer();

        if (!this.ip) {
            await this.resolveIpByDiscovery();
            if (!this.ip) {
                this.scheduleReconnect("gateway IP unknown");
                return;
            }
        }
        if (this.unloading) {
            return;
        }

        if (!this.device) {
            this.device = this.createTuyaDevice();
        }
        this.connectAttempt++;
        this.connectStartedAt = Date.now();
        this.log.debug(
            `[conn] Attempt #${this.connectAttempt}: connecting to ${this.ip}:${TUYA_PORT} (Tuya protocol ${this.protocolVersion}, ` +
                `${this.failedAttempts} failure(s) before)`,
        );
        try {
            await this.connectWithTimeout(this.device);
        } catch (error) {
            this.onConnectionProblem(
                `attempt #${this.connectAttempt} after ${formatDuration(Date.now() - this.connectStartedAt)}: ${errorText(error)}`,
            );
        }
    }

    private createTuyaDevice(): TuyaDevice {
        this.log.debug(`[conn] Creating tuyapi instance for ${this.ip} (protocol ${this.protocolVersion})`);
        const device = new TuyaDevice({
            id: String(this.config.deviceId).trim(),
            key: String(this.config.localKey),
            ip: this.ip,
            version: this.protocolVersion,
            issueGetOnConnect: true,
        });
        device.on("connected", () => void this.onConnected());
        device.on("disconnected", () => void this.onDisconnected());
        device.on("error", (error: unknown) => this.onDeviceError(error));
        device.on("heartbeat", () => this.log.silly("[conn] Heartbeat answered by gateway"));
        device.on(
            "data",
            (data: unknown, commandByte: number, sequenceN: number) =>
                void this.onData("data", data, commandByte, sequenceN),
        );
        device.on(
            "dp-refresh",
            (data: unknown, commandByte: number, sequenceN: number) =>
                void this.onData("dp-refresh", data, commandByte, sequenceN),
        );
        return device;
    }

    /**
     * Discards the tuyapi instance. tuyapi reconnects implicitly for pending requests, so connect() of the
     * discarded instance is disabled to make sure it can never occupy the local connection again.
     *
     * @param reason - why the instance is discarded (for the log)
     */
    private destroyTuyaDevice(reason: string): void {
        const device = this.device;
        if (!device) {
            return;
        }
        this.log.debug(`[conn] Discarding tuyapi instance (${reason})`);
        this.device = undefined;
        device.removeAllListeners();
        device.on("error", () => {
            // errors of a discarded connection are irrelevant
        });
        (device as unknown as { connect: () => Promise<boolean> }).connect = () =>
            Promise.reject(new Error("connection closed by adapter"));
        device.disconnect();
        // disconnect() only handles established connections, also drop a socket that is still connecting
        (device as unknown as { client?: { destroy: () => void } }).client?.destroy();
    }

    private connectWithTimeout(device: TuyaDevice): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = this.setTimeout(() => {
                // a hanging session key negotiation (wrong key or protocol version) never resolves, start over
                this.destroyTuyaDevice(`no answer within ${formatDuration(CONNECT_TIMEOUT_MS)}`);
                reject(new Error(`no answer within ${formatDuration(CONNECT_TIMEOUT_MS)}`));
            }, CONNECT_TIMEOUT_MS);
            device.connect().then(
                () => {
                    this.clearTimeout(timer);
                    resolve();
                },
                (error: unknown) => {
                    this.clearTimeout(timer);
                    reject(error instanceof Error ? error : new Error(String(error)));
                },
            );
        });
    }

    private async onConnected(): Promise<void> {
        if (this.unloading) {
            return;
        }
        this.gatewayConnected = true;
        this.connectedAt = Date.now();
        this.clearReconnectTimer();
        const text = `[conn] Connected to WL-433 gateway at ${this.ip} (Tuya protocol ${this.protocolVersion})`;
        if (this.failedAttempts) {
            // while connections keep failing, only report once the connection proved to be stable
            this.log.debug(`${text} – waiting ${formatDuration(SHORT_CONNECTION_MS)} to see if it stays up`);
        } else {
            this.log.info(text);
        }
        this.log.debug(
            `[conn] Attempt #${this.connectAttempt} succeeded after ${formatDuration(this.connectedAt - this.connectStartedAt)}`,
        );
        this.clearStableTimer();
        this.stableTimer = this.setTimeout(() => this.onConnectionStable(), SHORT_CONNECTION_MS);
        await this.setState("info.connection", true, true);
        this.requestStatus("connected");
        this.schedulePoll();
    }

    private onConnectionStable(): void {
        this.stableTimer = undefined;
        if (this.failedAttempts) {
            this.log.info(
                `[conn] Connection to WL-433 gateway at ${this.ip} is stable again (after ${this.failedAttempts} failed attempt(s))`,
            );
        } else {
            this.log.debug(`[conn] Connection stable for ${formatDuration(SHORT_CONNECTION_MS)}`);
        }
        this.failedAttempts = 0;
        this.problemReported = false;
    }

    private clearStableTimer(): void {
        if (this.stableTimer) {
            this.clearTimeout(this.stableTimer);
            this.stableTimer = undefined;
        }
    }

    private async onDisconnected(): Promise<void> {
        const wasConnected = this.gatewayConnected;
        const duration = Date.now() - this.connectedAt;
        this.gatewayConnected = false;
        this.clearPollTimer();
        this.clearStableTimer();
        this.clearQueryTimer();
        if (this.unloading) {
            return;
        }
        this.log.debug(
            `[conn] tuyapi reports disconnect (was connected: ${wasConnected}${wasConnected ? `, for ${formatDuration(duration)}` : ""})`,
        );
        await this.setState("info.connection", false, true);

        if (this.commandQueue.length) {
            this.log.warn(
                `[queue] Connection lost, ${this.commandQueue.length} pending command(s) ${seqList(this.commandQueue)} discarded`,
            );
            this.commandQueue = [];
        }
        if (this.pendingConfirmations.length) {
            this.log.debug(
                `[cmd] Connection lost, confirmation of ${seqList(this.pendingConfirmations)} abandoned (status is requested again after reconnecting)`,
            );
            this.pendingConfirmations = [];
            this.clearConfirmTimer();
        }
        if (!wasConnected) {
            return;
        }
        if (duration < SHORT_CONNECTION_MS) {
            this.onConnectionProblem(
                `gateway closed the connection right after it was established (after ${formatDuration(duration)})`,
            );
            return;
        }
        this.log.info(
            `[conn] Connection to gateway ${this.ip} lost after ${formatDuration(duration)}, reconnecting in ${formatDuration(this.reconnectDelayMs)}`,
        );
        this.scheduleReconnect("connection lost");
    }

    private onConnectionProblem(reason: string): void {
        if (this.unloading) {
            return;
        }
        this.failedAttempts++;
        const retry = `retrying in ${formatDuration(this.reconnectDelayMs)}`;
        if (this.failedAttempts >= FAILURES_BEFORE_HINT && !this.problemReported) {
            this.problemReported = true;
            this.log.warn(
                `[conn] Cannot keep a connection to the WL-433 gateway at ${this.ip} (${reason}). ` +
                    "Please check the IP address, the local key and the protocol version. Tuya devices accept only ONE local connection: " +
                    "close the MiBoxer / Smart Life app on phones in the same network and stop other local integrations " +
                    `(ioBroker.tuya, Home Assistant, tinytuya) for this gateway. ${retry}`,
            );
        } else if (this.failedAttempts === 1) {
            this.log.info(`[conn] Connection to gateway ${this.ip} failed (${reason}), ${retry}`);
        } else {
            this.log.debug(
                `[conn] Connection to gateway ${this.ip} failed again (${reason}), failure ${this.failedAttempts}, ${retry}`,
            );
        }

        // an IP found by discovery may be outdated (DHCP), search again from time to time
        if (!String(this.config.ip ?? "").trim() && this.failedAttempts % FAILURES_BEFORE_HINT === 0) {
            this.log.debug(
                `[conn] ${this.failedAttempts} failures with the discovered IP ${this.ip}, searching the gateway again`,
            );
            this.ip = "";
            this.destroyTuyaDevice("IP will be searched again");
        }
        this.scheduleReconnect("connection problem");
    }

    private onDeviceError(error: unknown): void {
        if (!this.unloading) {
            // connection and command failures are reported where they are handled, this is additional detail
            this.log.debug(`[conn] tuyapi error event: ${redact(errorText(error), this.secrets)}`);
        }
    }

    private scheduleReconnect(reason: string): void {
        if (this.unloading) {
            return;
        }
        this.clearReconnectTimer();
        this.log.debug(`[conn] Next connection attempt in ${formatDuration(this.reconnectDelayMs)} (${reason})`);
        this.reconnectTimer = this.setTimeout(() => {
            this.reconnectTimer = undefined;
            void this.connectGateway();
        }, this.reconnectDelayMs);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            this.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    private schedulePoll(): void {
        this.clearPollTimer();
        if (!this.pollDelayMs || this.unloading) {
            return;
        }
        this.pollTimer = this.setTimeout(() => {
            this.pollTimer = undefined;
            void this.pollStatus();
        }, this.pollDelayMs);
    }

    private clearPollTimer(): void {
        if (this.pollTimer) {
            this.clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
    }

    /** Requests the DP 101 status and the standard datapoints (countdown, unknown datapoints). */
    private async pollStatus(): Promise<void> {
        const device = this.device;
        if (!device || !this.gatewayConnected) {
            this.log.debug("[poll] Skipped: gateway not connected");
        } else if (this.sending) {
            this.log.debug("[poll] Skipped: a command is being sent");
        } else {
            this.requestStatus("status refresh");
            const started = Date.now();
            try {
                this.log.debug("[poll] Requesting all datapoints");
                await device.get({ schema: true });
                this.log.debug(`[poll] Datapoints answered after ${formatDuration(Date.now() - started)}`);
            } catch (error) {
                this.log.debug(
                    `[poll] Datapoint request failed after ${formatDuration(Date.now() - started)}: ${errorText(error)}`,
                );
            }
        }
        if (this.gatewayConnected) {
            this.schedulePoll();
        }
    }

    /**
     * Queues the DP 101 status query, the gateway answers with a status frame.
     *
     * @param reason - why the status is needed (for the log)
     */
    private requestStatus(reason: string): void {
        if (!this.device || !this.gatewayConnected) {
            this.log.debug(`[poll] Status query (${reason}) skipped: gateway not connected`);
            return;
        }
        if (this.commandQueue.some(command => command.wl433?.internal)) {
            this.log.debug(`[poll] Status query (${reason}) is already queued`);
            return;
        }
        const seq = ++this.commandSeq;
        this.log.debug(`[poll] #${seq} Requesting the DP 101 status (${reason})`);
        const frame = buildStatusQuery();
        this.enqueueWl433(seq, `status query (${reason})`, [
            { frame, zone: ZONE_ALL, description: "status query", key: "query", update: {}, internal: true },
        ]);
    }

    private onStatusQuerySent(seq: number): void {
        this.statusQuerySentAt = Date.now();
        this.clearQueryTimer();
        this.queryTimer = this.setTimeout(() => {
            this.queryTimer = undefined;
            if (this.lastStatusAt >= this.statusQuerySentAt) {
                return;
            }
            this.unansweredQueries++;
            const text = `[poll] #${seq} Status query not answered within ${formatDuration(STATUS_QUERY_TIMEOUT_MS)} (${this.unansweredQueries} in a row)`;
            if (this.unansweredQueries >= UNANSWERED_QUERIES_BEFORE_WARNING && !this.queryProblemReported) {
                this.queryProblemReported = true;
                this.log.warn(
                    `${text}. The light states are not updated. Is the gateway a WL-433? ` +
                        "Please report the model at https://github.com/ssbingo/ioBroker.miboxer-wl433/issues",
                );
            } else {
                this.log.debug(text);
            }
        }, STATUS_QUERY_TIMEOUT_MS);
    }

    private clearQueryTimer(): void {
        if (this.queryTimer) {
            this.clearTimeout(this.queryTimer);
            this.queryTimer = undefined;
        }
    }

    // ------------------------------------------------------------------ discovery

    private async resolveIpByDiscovery(): Promise<void> {
        const deviceId = String(this.config.deviceId).trim();
        const searching = `[disc] No IP address configured, searching gateway ${deviceId} in the local network`;
        if (this.failedAttempts || this.discoveryWarned) {
            this.log.debug(searching);
        } else {
            this.log.info(searching);
        }
        const devices = await this.discover(DISCOVERY_DURATION_MS, deviceId);
        if (this.unloading) {
            return;
        }
        const match = devices.find(device => device.id === deviceId);
        if (!match) {
            const others = devices.length ? ` Other Tuya devices found: ${describeDevices(devices)}.` : "";
            const text = `[disc] Gateway ${deviceId} did not announce itself in the local network.${others} Retrying in ${formatDuration(this.reconnectDelayMs)}, alternatively enter the IP address in the instance settings.`;
            if (this.discoveryWarned) {
                this.log.debug(text);
            } else {
                this.discoveryWarned = true;
                this.log.warn(text);
            }
            return;
        }

        this.discoveryWarned = false;
        this.destroyTuyaDevice("gateway address determined by discovery");
        this.ip = match.ip;
        if (PROTOCOL_VERSIONS.includes(match.version) && match.version !== this.protocolVersion) {
            this.log.info(
                `[disc] Gateway announces Tuya protocol ${match.version}, using it instead of the configured ${this.protocolVersion}`,
            );
            this.protocolVersion = match.version;
        }
        if (this.ip !== this.lastFoundIp) {
            this.log.info(`[disc] Found gateway ${deviceId} at ${this.ip}`);
            this.lastFoundIp = this.ip;
        } else {
            this.log.debug(`[disc] Gateway ${deviceId} still at ${this.ip}`);
        }
        await this.setState("info.ip", this.ip, true);
    }

    /**
     * Listens for Tuya presence broadcasts.
     *
     * @param durationMs - maximum listening time
     * @param stopOnId - stop as soon as this device ID was seen
     */
    private discover(durationMs: number, stopOnId?: string): Promise<DiscoveredDevice[]> {
        return new Promise(resolve => {
            const found = new Map<string, DiscoveredDevice>();
            const started = Date.now();
            let broadcasts = 0;
            const run: { finished: boolean; timer?: ioBroker.Timeout; discovery?: TuyaDiscovery } = {
                finished: false,
            };

            const finish = (): void => {
                if (run.finished) {
                    return;
                }
                run.finished = true;
                this.clearTimeout(run.timer);
                run.discovery?.stop();
                this.activeDiscoveries.delete(finish);
                this.log.debug(
                    `[disc] Finished after ${formatDuration(Date.now() - started)}: ${broadcasts} broadcast(s), ` +
                        `${found.size} device(s)${found.size ? ` – ${describeDevices([...found.values()])}` : ""}`,
                );
                resolve([...found.values()]);
            };

            run.discovery = new TuyaDiscovery(
                device => {
                    broadcasts++;
                    if (!found.has(device.id)) {
                        this.log.debug(
                            `[disc] Broadcast from ${device.id} at ${device.ip} (protocol ${device.version}` +
                                `${device.productKey ? `, product key ${device.productKey}` : ""})`,
                        );
                    }
                    found.set(device.id, device);
                    if (stopOnId && device.id === stopOnId) {
                        finish();
                    }
                },
                (port, error) => this.log.warn(`[disc] Cannot listen on UDP port ${port}: ${error.message}`),
            );
            this.activeDiscoveries.add(finish);
            this.log.debug(
                `[disc] Listening on UDP ${DISCOVERY_PORTS.join("/")} for up to ${formatDuration(durationMs)}` +
                    `${stopOnId ? ` (stops when ${stopOnId} is seen)` : ""}`,
            );
            run.discovery.start();
            run.timer = this.setTimeout(finish, durationMs);
        });
    }

    private async handleDiscoverRequest(wantedId: string): Promise<Record<string, unknown>> {
        // a connected Tuya device usually stops broadcasting, so answer from the running connection
        if (wantedId && wantedId === String(this.config.deviceId ?? "").trim() && this.gatewayConnected && this.ip) {
            this.log.debug(`[disc] ${wantedId} is the connected gateway, answering without search`);
            return {
                result: "found",
                args: [this.ip, this.protocolVersion],
                native: { ip: this.ip, protocolVersion: this.protocolVersion },
            };
        }

        const devices = await this.discover(DISCOVERY_DURATION_MS, wantedId || undefined);
        if (!devices.length) {
            return { error: "noneFound" };
        }
        if (!wantedId) {
            // "native" is empty on purpose: it suppresses a second, untranslated alert in the admin UI
            return { result: "list", args: [describeDevices(devices)], native: {} };
        }
        const match = devices.find(device => device.id === wantedId);
        if (!match) {
            return { error: "notFoundOthers", args: [wantedId, describeDevices(devices)] };
        }
        const version = PROTOCOL_VERSIONS.includes(match.version) ? match.version : this.protocolVersion;
        return { result: "found", args: [match.ip, version], native: { ip: match.ip, protocolVersion: version } };
    }

    // ------------------------------------------------------------------ gateway -> states

    private async onData(event: string, data: unknown, commandByte?: number, sequenceN?: number): Promise<void> {
        if (this.unloading) {
            return;
        }
        const origin = `${event}, ${commandName(commandByte)}, sequence ${sequenceN ?? "?"}`;
        const dps = (data as { dps?: unknown } | null | undefined)?.dps;
        if (!dps || typeof dps !== "object") {
            if (
                (data === "" || data === false) &&
                (commandByte === CommandType.CONTROL || commandByte === CommandType.CONTROL_NEW)
            ) {
                this.log.debug(`[rx] Gateway acknowledged the command (${origin})`);
            } else if (typeof data === "string" && data && !this.undecodableReported) {
                this.undecodableReported = true;
                this.log.warn(
                    `[rx] Gateway sent data that could not be decoded (${JSON.stringify(data.substring(0, 60))}, ${data.length} characters, ${origin}). ` +
                        "Please check the local key and the protocol version (the WL-433 normally uses 3.3).",
                );
            } else {
                this.log.debug(
                    `[rx] Ignoring gateway data without datapoints (${origin}): ${shorten(JSON.stringify(data) ?? String(data))}`,
                );
            }
            return;
        }
        this.undecodableReported = false;
        this.log.debug(`[rx] ${origin}: ${shorten(JSON.stringify(dps), 500)}`);
        try {
            await this.applyDps(dps as Record<string, unknown>);
        } catch (error) {
            this.log.warn(`[rx] Cannot process data from gateway (${origin}): ${errorText(error)}`);
            this.log.debug(`[rx] ${errorStack(error)}`);
        }
    }

    /**
     * Logs a mapped datapoint that arrived with an unexpected value type. Reported once per datapoint as warning,
     * because it means the gateway differs from the documented Tuya standard and the mapping has to be fixed.
     *
     * @param dp - datapoint
     * @param value - received value
     * @param expected - expected type or format
     */
    private unexpectedValue(dp: string, value: unknown, expected: string): void {
        const text = `[rx] DP ${dp} = ${JSON.stringify(value)} is not ${expected}, ignored`;
        if (this.unexpectedDps.has(dp)) {
            this.log.debug(text);
        } else {
            this.unexpectedDps.add(dp);
            this.log.warn(
                `${text}. Please report this value at https://github.com/ssbingo/ioBroker.miboxer-wl433/issues`,
            );
        }
    }

    private async setMapped(
        dp: string,
        value: unknown,
        stateId: string,
        stateValue: ioBroker.StateValue,
    ): Promise<void> {
        this.log.debug(`[rx] DP ${dp} = ${JSON.stringify(value)} -> ${stateId} = ${JSON.stringify(stateValue)}`);
        await this.setStateChangedAsync(stateId, stateValue, true);
    }

    private async applyDps(dps: Record<string, unknown>): Promise<void> {
        for (const [dp, value] of Object.entries(dps)) {
            switch (dp) {
                case DP.SWITCH:
                    // arrives about 2 s before the DP 101 status, both always agree
                    if (typeof value === "boolean") {
                        await this.setMapped(dp, value, "light.on", value);
                    } else {
                        this.unexpectedValue(dp, value, "a boolean");
                    }
                    break;
                case DP.COUNTDOWN:
                    if (typeof value === "number") {
                        await this.setMapped(dp, value, "light.countdown", value);
                    } else {
                        this.unexpectedValue(dp, value, "a number");
                    }
                    break;
                case DP.RAW_FRAME:
                    await this.onDp101Received(value);
                    break;
                default:
                    if (STATUS_ONLY_DPS.has(dp)) {
                        this.log.debug(
                            `[rx] DP ${dp} = ${JSON.stringify(value)} not mapped: derived by the gateway, light.* follows the DP 101 status`,
                        );
                    } else {
                        await this.updateRawDatapoint(dp, value);
                    }
            }
        }
    }

    private async onDp101Received(value: unknown): Promise<void> {
        if (typeof value !== "string") {
            this.unexpectedValue(DP.RAW_FRAME, value, "a Base64 string");
            return;
        }
        this.lastDp101RxAt = Date.now();
        let frame: Dp101Frame;
        try {
            frame = decodeDp101(value);
        } catch {
            this.log.debug(`[dp101] Received value ${JSON.stringify(value)} is not Base64, stored unchanged`);
            await this.setStateChangedAsync("dp101.raw", value, true);
            return;
        }
        const status = parseStatus(frame);
        // the answers to the regular status query would flood the history, only changes are recorded
        const unchanged = status?.type === "answer" && status.signature === this.status?.signature;
        this.log.debug(
            `[dp101] Received ${frame.hex} (${frame.bytes.length} bytes, checksum ${frame.checksumValid ? "valid" : "INVALID"}, Base64 ${frame.base64})` +
                `${unchanged ? ", status unchanged, not added to the history" : ""}`,
        );
        await this.setDp101States(frame);
        if (!unchanged) {
            await this.addToHistory(frame, "rx", this.lastDp101RxAt);
        }
        if (status) {
            await this.onStatus(status);
            return;
        }
        const dmx = parseDmxAnswer(frame);
        if (dmx !== null) {
            await this.onDmxAnswer(dmx);
            return;
        }
        const type = frame.bytes[0];
        if (frame.checksumValid && (type === FRAME_TYPE.REPORT || type === FRAME_TYPE.ANSWER)) {
            const text = `[dp101] Status frame ${frame.hex} has an unknown mode 0x${frame.bytes[4].toString(16)}, not evaluated`;
            if (this.unknownStatusReported) {
                this.log.debug(text);
            } else {
                this.unknownStatusReported = true;
                this.log.warn(
                    `${text}. Please report this frame at https://github.com/ssbingo/ioBroker.miboxer-wl433/issues`,
                );
            }
        } else {
            this.log.debug(
                `[dp101] Frame type 0x${(type ?? 0).toString(16)} is not a status frame${frame.checksumValid ? "" : " (checksum invalid)"}, not evaluated`,
            );
        }
    }

    /**
     * Applies a status of the gateway: light.* shows it, pending commands are confirmed.
     *
     * @param status - decoded status frame
     */
    private async onStatus(status: Wl433Status): Promise<void> {
        this.lastStatusAt = Date.now();
        if (this.unansweredQueries) {
            this.log.debug(`[poll] Gateway answers again after ${this.unansweredQueries} unanswered status queries`);
            this.unansweredQueries = 0;
            this.queryProblemReported = false;
        }
        if (status.mode) {
            this.lastMode = status.mode;
            this.lastScene = status.scene;
        }
        this.status = status;
        const changed = await this.writeLightValues("light", {
            on: status.on,
            mode: status.mode,
            scene: status.scene,
            hue: status.hue,
            saturation: status.saturation,
            temperature: status.temperature,
            brightness: status.brightness,
        });
        this.log.debug(
            `[rx] DP 101 status (${status.type}): ${describeStatus(status)} -> ${changed.length ? `light: ${changed.join(", ")}` : "light.* unchanged"}`,
        );
        await this.checkConfirmations(status);
        await this.onDmxLowByte(status.dmxLowByte);
    }

    /**
     * Writes light values to the states of a channel (acknowledged). The mode is only written if it is known, the
     * colour only if hue and saturation are known.
     *
     * @param channel - "light" or "zones.zone<n>"
     * @param values - values to write
     * @returns the changed states as "name value" for the log
     */
    private async writeLightValues(channel: string, values: LightValues): Promise<string[]> {
        const updates: [string, ioBroker.StateValue][] = [];
        if (values.on !== undefined) {
            updates.push(["on", values.on]);
        }
        if (values.mode !== undefined) {
            updates.push(["mode", values.mode]);
            updates.push(["scene", values.mode === "scene" ? (values.scene ?? 0) : 0]);
        }
        if (values.hue !== undefined) {
            updates.push(["hue", hueByteToDegrees(values.hue)]);
        }
        if (values.saturation !== undefined) {
            updates.push(["saturation", values.saturation]);
        }
        if (values.hue !== undefined && values.saturation !== undefined) {
            updates.push(["color", hueSaturationToRgbHex(hueByteToDegrees(values.hue), values.saturation)]);
        }
        if (values.temperature !== undefined) {
            updates.push(["colorTemperature", temperatureStepToKelvin(values.temperature)]);
        }
        if (values.brightness !== undefined) {
            updates.push(["brightness", values.brightness]);
        }
        const changed: string[] = [];
        for (const [name, value] of updates) {
            const result = (await this.setStateChangedAsync(`${channel}.${name}`, value, true)) as unknown as
                { notChanged?: boolean } | undefined;
            if (!result?.notChanged) {
                changed.push(`${name} ${JSON.stringify(value)}`);
            }
        }
        return changed;
    }

    /**
     * Confirms the sent commands whose values appear in the status.
     *
     * @param status - decoded status frame
     */
    private async checkConfirmations(status: Wl433Status): Promise<void> {
        if (!this.pendingConfirmations.length) {
            return;
        }
        const now = Date.now();
        const confirmed = this.pendingConfirmations.filter(pending => statusMatches(status, pending.command.update));
        if (!confirmed.length) {
            const waiting = this.pendingConfirmations
                .map(pending => `#${pending.seq} ${statusDifferences(status, pending.command.update).join(", ")}`)
                .join("; ");
            this.log.debug(`[cmd] Status does not show the values of ${waiting} yet, waiting further`);
            return;
        }
        this.pendingConfirmations = this.pendingConfirmations.filter(pending => !confirmed.includes(pending));
        for (const pending of confirmed) {
            this.log.debug(
                `[cmd] #${pending.seq} ${pending.command.description} confirmed by the gateway status after ${formatDuration(now - pending.sentAt)}`,
            );
            await this.applyZoneUpdate(pending.command.zone, pending.command.update);
        }
        if (this.confirmationProblemReported) {
            this.log.info("[cmd] The gateway confirms commands again");
            this.confirmationProblemReported = false;
        }
        if (!this.pendingConfirmations.length) {
            this.clearConfirmTimer();
            this.confirmationQueryAsked = false;
        }
    }

    /**
     * Shows confirmed values in the zone channels (zone mode "channels"). A command for all zones updates every zone.
     *
     * @param zone - zone of the command, 0 = all zones
     * @param update - confirmed values
     */
    private async applyZoneUpdate(zone: number, update: LightValues): Promise<void> {
        if (this.zoneMode !== "channels" || !Object.keys(update).length) {
            return;
        }
        const zones = zone === ZONE_ALL ? Array.from({ length: ZONE_COUNT }, (_, index) => index + 1) : [zone];
        for (const target of zones) {
            const merged: LightValues = { ...this.zoneValues[target], ...update };
            this.zoneValues[target] = merged;
            const values: LightValues = { ...update };
            if (update.hue !== undefined || update.saturation !== undefined) {
                values.hue = merged.hue;
                values.saturation = merged.saturation;
            }
            if (update.mode !== undefined) {
                values.scene = merged.scene;
            }
            const changed = await this.writeLightValues(zoneChannelId(target), values);
            if (changed.length) {
                this.log.debug(`[cmd] ${zoneChannelId(target)}: ${changed.join(", ")}`);
            }
        }
    }

    private async setDp101States(frame: Dp101Frame): Promise<void> {
        await this.setStateChangedAsync("dp101.raw", frame.base64, true);
        await this.setStateChangedAsync("dp101.hex", frame.hex, true);
        await this.setStateChangedAsync("dp101.checksumValid", frame.checksumValid, true);
    }

    /**
     * Records a raw frame the gateway accepted. Its answer frame usually arrives before the command is confirmed:
     * the answer must not be overwritten in the states and must not appear before the sent frame in the history.
     *
     * @param seq - command number
     * @param frame - sent frame
     * @param sentAt - time the command was sent
     */
    private async confirmSentFrame(seq: number, frame: Dp101Frame, sentAt: number): Promise<void> {
        if (this.lastDp101RxAt < sentAt) {
            this.log.debug(`[dp101] #${seq} no answer frame yet, showing the sent frame in dp101.raw/hex`);
            await this.setDp101States(frame);
        } else {
            this.log.debug(
                `[dp101] #${seq} answer frame arrived ${formatDuration(this.lastDp101RxAt - sentAt)} after sending, keeping it in dp101.raw/hex`,
            );
        }
        await this.addToHistory(frame, "tx", sentAt);
    }

    private async addToHistory(frame: Dp101Frame, dir: HistoryEntry["dir"], time: number): Promise<void> {
        const entry: HistoryEntry = {
            ts: new Date(time).toISOString(),
            dir,
            base64: frame.base64,
            hex: frame.hex,
            checksumValid: frame.checksumValid,
        };
        // keep the history chronological, a sent frame is confirmed after the answers it caused
        const index = this.dp101History.findIndex(existing => {
            const existingTime = Date.parse(existing.ts);
            return existingTime > time || (existingTime === time && existing.dir === "rx");
        });
        if (index === -1) {
            this.dp101History.push(entry);
        } else {
            this.dp101History.splice(index, 0, entry);
        }
        if (this.dp101History.length > DP101_HISTORY_LENGTH) {
            this.dp101History.splice(0, this.dp101History.length - DP101_HISTORY_LENGTH);
        }
        await this.setState("dp101.history", JSON.stringify(this.dp101History), true);
    }

    private async restoreHistory(): Promise<void> {
        const state = await this.getStateAsync("dp101.history");
        if (typeof state?.val !== "string") {
            this.log.debug("[dp101] No stored history");
            return;
        }
        try {
            const parsed: unknown = JSON.parse(state.val);
            if (Array.isArray(parsed)) {
                this.dp101History = (
                    parsed.filter(entry => entry && typeof entry === "object") as HistoryEntry[]
                ).slice(-DP101_HISTORY_LENGTH);
            }
            this.log.debug(`[dp101] Restored ${this.dp101History.length} history entries`);
        } catch (error) {
            this.log.debug(
                `[dp101] Stored history is not valid JSON (${errorText(error)}), starting with an empty history`,
            );
        }
    }

    private async updateRawDatapoint(dp: string, value: unknown): Promise<void> {
        if (!/^\d+$/.test(dp)) {
            this.log.debug(`[rx] Ignoring datapoint with non-numeric key ${JSON.stringify(dp)}`);
            return;
        }
        const val: DpValue =
            typeof value === "boolean" || typeof value === "number" || typeof value === "string"
                ? value
                : JSON.stringify(value);
        const id = `raw.dp${dp}`;
        if (!this.rawTypes.has(dp)) {
            const type = typeof val as "boolean" | "number" | "string";
            await this.extendObject(id, {
                type: "state",
                common: {
                    name: objectName("rawDatapoint", dp),
                    type,
                    role: type === "boolean" ? "switch" : type === "number" ? "level" : "text",
                    read: true,
                    write: true,
                },
                native: { dp: Number(dp) },
            });
            this.rawTypes.set(dp, type);
            this.log.debug(`[rx] Datapoint ${dp} (${type}) is not mapped, stored in ${id}`);
        }
        this.log.debug(`[rx] DP ${dp} = ${JSON.stringify(value)} -> ${id}`);
        await this.setStateChangedAsync(id, val, true);
    }

    // ------------------------------------------------------------------ states -> gateway

    private async handleCommand(seq: number, id: string, val: ioBroker.StateValue): Promise<void> {
        switch (id) {
            case "light.countdown":
                this.enqueue(seq, id, { [DP.COUNTDOWN]: Math.round(clamp(toNumber(val), 0, COUNTDOWN_MAX)) });
                return;
            case "light.zone":
                await this.selectZone(seq, val);
                return;
            case "timers.active":
                await this.setTimersActive(seq, toBoolean(val));
                return;
            case "settings.dmxAddress":
                this.setDmxAddress(seq, id, val);
                return;
            case "dp101.raw": {
                const frame = decodeDp101(String(val));
                this.log.debug(
                    `[dp101] #${seq} sending Base64 as given: ${frame.hex} (checksum ${frame.checksumValid ? "valid" : "INVALID"})`,
                );
                this.enqueueFrame(seq, id, frame);
                return;
            }
            case "dp101.hex": {
                const { frame, corrected } = encodeDp101Hex(String(val));
                if (corrected) {
                    this.log.info(`[dp101] #${seq} checksum corrected, sending ${frame.hex}`);
                } else {
                    this.log.debug(`[dp101] #${seq} sending ${frame.hex} as Base64 ${frame.base64}`);
                }
                this.enqueueFrame(seq, id, frame);
                return;
            }
        }
        if (id.startsWith("raw.dp")) {
            await this.handleRawCommand(seq, id, val);
            return;
        }
        const resolved = this.resolveTarget(id);
        if (!resolved) {
            this.log.debug(`[cmd] #${seq} ${id} is not writable by the adapter, ignored`);
            return;
        }
        const { target, field } = resolved;
        this.sendField(seq, id, target, field, val);
    }

    /**
     * Translates one field (e.g. "brightness") into frames and queues them.
     *
     * @param seq - command number
     * @param source - what caused the command (state ID or timer), for the log
     * @param target - where the command goes
     * @param field - state name, e.g. "brightness"
     * @param val - new value
     */
    private sendField(seq: number, source: string, target: Target, field: string, val: ioBroker.StateValue): void {
        const steps = this.buildSteps(seq, target, field, val);
        if (!steps.length) {
            return;
        }
        this.log.debug(
            `[cmd] #${seq} ${source} ${field} -> ${target.zone === ZONE_ALL ? "all zones" : `zone ${target.zone}`}: ${steps
                .map(
                    step =>
                        `${describeCommand(step.command, step.value, target.zone).replace(/ \((all zones|zone \d)\)$/, "")}` +
                        `${step.reason ? ` (${step.reason})` : ""}`,
                )
                .join(", then ")}`,
        );
        this.enqueueWl433(
            seq,
            source,
            steps.map(step => ({
                frame: buildCommand(step.command, step.value, target.zone),
                zone: target.zone,
                description: describeCommand(step.command, step.value, target.zone),
                key: replaceKey(step.command, step.value, target.zone),
                update: step.update,
                internal: false,
            })),
        );
    }

    /**
     * Finds the target of a control state.
     *
     * @param id - state ID relative to the namespace
     */
    private resolveTarget(id: string): { target: Target; field: string } | undefined {
        const light = /^light\.(\w+)$/.exec(id);
        if (light) {
            return {
                target: {
                    channel: "light",
                    zone: this.zoneMode === "selector" ? this.selectedZone : ZONE_ALL,
                    isZoneChannel: false,
                },
                field: light[1],
            };
        }
        const zone = /^zones\.zone([1-8])\.(\w+)$/.exec(id);
        if (zone && this.zoneMode === "channels") {
            const number = Number(zone[1]);
            return {
                target: { channel: zoneChannelId(number), zone: number, isZoneChannel: true },
                field: zone[2],
            };
        }
        return undefined;
    }

    /**
     * Values the decisions of a command are based on: the gateway status for light.*, the last values sent for a
     * zone channel, each overlaid with the values of commands that are queued or not confirmed yet.
     *
     * @param target - target of the command
     */
    private currentValues(target: Target): LightValues {
        let base: LightValues = {};
        if (target.isZoneChannel) {
            base = { ...this.zoneValues[target.zone] };
        } else if (this.status) {
            const status = this.status;
            base = {
                on: status.on,
                mode: status.mode ?? this.lastMode,
                scene: status.mode ? status.scene : this.lastScene,
                hue: status.hue,
                saturation: status.saturation,
                temperature: status.temperature,
                brightness: status.brightness,
            };
        }
        const relevant = (command: Wl433Command): boolean =>
            !command.internal && (!target.isZoneChannel || command.zone === target.zone || command.zone === ZONE_ALL);
        for (const pending of this.pendingConfirmations) {
            if (relevant(pending.command)) {
                Object.assign(base, pending.command.update);
            }
        }
        for (const queued of this.commandQueue) {
            if (queued.wl433 && relevant(queued.wl433)) {
                Object.assign(base, queued.wl433.update);
            }
        }
        return base;
    }

    /**
     * Translates a state change into the frames of the WL-433 protocol. Like the MiBoxer app, the adapter switches
     * the lights on and changes the mode first where the command needs it.
     *
     * @param seq - command number
     * @param target - where the command goes
     * @param field - state name, e.g. "brightness"
     * @param val - new value
     */
    private buildSteps(seq: number, target: Target, field: string, val: ioBroker.StateValue): Step[] {
        const current = this.currentValues(target);
        const steps: Step[] = [];
        const switchOn = (): void => {
            if (current.on !== true) {
                steps.push({
                    command: COMMAND.KEY,
                    value: KEY.ON,
                    update: { on: true },
                    reason: current.on === false ? "lights are off" : "on/off state unknown",
                });
            }
        };
        const colourMode = (): void => {
            if (current.mode !== "colour") {
                const hue = current.hue ?? 0;
                steps.push({
                    command: COMMAND.HUE,
                    value: hue,
                    update: { mode: "colour", hue },
                    reason: `switches to colour mode, mode is ${current.mode ?? "unknown"}`,
                });
            }
        };

        switch (field) {
            case "on": {
                const on = toBoolean(val);
                steps.push({ command: COMMAND.KEY, value: on ? KEY.ON : KEY.OFF, update: { on } });
                break;
            }
            case "brightness": {
                const percent = toNumber(val);
                if (percent <= 0) {
                    steps.push({
                        command: COMMAND.KEY,
                        value: KEY.OFF,
                        update: { on: false },
                        reason: "0 % switches off",
                    });
                    break;
                }
                const brightness = clamp(Math.round(percent), 1, 100);
                switchOn();
                steps.push({ command: COMMAND.BRIGHTNESS, value: brightness, update: { brightness } });
                break;
            }
            case "colorTemperature": {
                const kelvin = toNumber(val);
                const temperature = kelvinToTemperatureStep(kelvin);
                switchOn();
                if (current.mode !== "white") {
                    steps.push({
                        command: COMMAND.KEY,
                        value: KEY.WHITE,
                        update: { mode: "white" },
                        reason: `mode is ${current.mode ?? "unknown"}`,
                    });
                }
                steps.push({
                    command: COMMAND.TEMPERATURE,
                    value: temperature,
                    update: { temperature },
                    reason: `${kelvin} K -> ${temperatureStepToKelvin(temperature)} K`,
                });
                break;
            }
            case "hue": {
                const degrees = toNumber(val);
                const hue = degreesToHueByte(degrees);
                switchOn();
                steps.push({
                    command: COMMAND.HUE,
                    value: hue,
                    update: { mode: "colour", hue },
                    reason: `${degrees}°`,
                });
                break;
            }
            case "saturation": {
                const saturation = clamp(Math.round(toNumber(val)), 0, 100);
                switchOn();
                colourMode();
                steps.push({ command: COMMAND.SATURATION, value: saturation, update: { saturation } });
                break;
            }
            case "color": {
                const colour = rgbHexToHueSaturation(String(val));
                if (!colour) {
                    throw new Error('a colour like "#ff8800" is expected');
                }
                const hue = degreesToHueByte(colour.hue);
                switchOn();
                steps.push({
                    command: COMMAND.HUE,
                    value: hue,
                    update: { mode: "colour", hue },
                    reason: `${colour.hue}°`,
                });
                steps.push({
                    command: COMMAND.SATURATION,
                    value: colour.saturation,
                    update: { saturation: colour.saturation },
                });
                break;
            }
            case "mode": {
                const mode = String(val);
                switchOn();
                if (mode === "white") {
                    steps.push({ command: COMMAND.KEY, value: KEY.WHITE, update: { mode: "white" } });
                } else if (mode === "colour") {
                    const hue = current.hue ?? 0;
                    steps.push({
                        command: COMMAND.HUE,
                        value: hue,
                        update: { mode: "colour", hue },
                        reason: "the colour mode is selected with the last hue",
                    });
                } else if (mode === "scene") {
                    const scene = current.scene && current.scene > 0 ? current.scene : 1;
                    steps.push({
                        command: COMMAND.SCENE,
                        value: scene,
                        update: { mode: "scene", scene },
                        reason: "last scene",
                    });
                } else {
                    throw new Error(`unknown mode, allowed: ${LIGHT_MODES.join(", ")}`);
                }
                break;
            }
            case "scene": {
                const scene = toNumber(val);
                if (!Number.isInteger(scene) || scene < 1 || scene > SCENE_COUNT) {
                    throw new Error(`a scene from 1 to ${SCENE_COUNT} is expected (to leave the scene, select a mode)`);
                }
                switchOn();
                steps.push({ command: COMMAND.SCENE, value: scene, update: { mode: "scene", scene } });
                break;
            }
            case "speedUp":
            case "speedDown":
                if (!toBoolean(val)) {
                    this.log.debug(
                        `[cmd] #${seq} ${target.channel}.${field} = false ignored, write true to press the button`,
                    );
                    break;
                }
                steps.push({
                    command: COMMAND.KEY,
                    value: field === "speedUp" ? KEY.SPEED_UP : KEY.SPEED_DOWN,
                    update: {},
                    reason: "the speed is not reported by the gateway",
                });
                break;
            default:
                this.log.debug(`[cmd] #${seq} ${target.channel}.${field} is not writable by the adapter, ignored`);
        }
        return steps;
    }

    private async selectZone(seq: number, val: ioBroker.StateValue): Promise<void> {
        if (this.zoneMode !== "selector") {
            this.log.debug(`[cmd] #${seq} light.zone ignored, the zone mode is "${this.zoneMode}"`);
            return;
        }
        const zone = toNumber(val);
        if (!Number.isInteger(zone) || zone < ZONE_ALL || zone > ZONE_COUNT) {
            throw new Error(`a zone from 0 (all zones) to ${ZONE_COUNT} is expected`);
        }
        this.selectedZone = zone;
        await this.setState("light.zone", zone, true);
        this.log.debug(`[cmd] #${seq} light.* commands now go to ${zone === ZONE_ALL ? "all zones" : `zone ${zone}`}`);
    }

    private async handleRawCommand(seq: number, id: string, val: ioBroker.StateValue): Promise<void> {
        const dp = id.substring("raw.dp".length);
        let type = this.rawTypes.get(dp);
        if (!type) {
            const obj = await this.getObjectAsync(id);
            type = (obj?.common as ioBroker.StateCommon | undefined)?.type;
            this.log.debug(`[cmd] #${seq} type of ${id} read from its object: ${type ?? "unknown"}`);
        }
        let value: DpValue;
        if (type === "boolean") {
            value = toBoolean(val);
        } else if (type === "number") {
            value = toNumber(val);
        } else {
            value = String(val);
        }
        this.enqueue(seq, id, { [dp]: value });
    }

    private enqueueFrame(seq: number, source: string, frame: Dp101Frame): void {
        this.enqueue(seq, source, { [DP.RAW_FRAME]: frame.base64 }, sentAt =>
            this.confirmSentFrame(seq, frame, sentAt),
        );
    }

    /**
     * Queues the frames of one state command. If the end of the queue holds the same kind of frames that were not
     * sent yet (e.g. from a slider), they are replaced, so only the last value is sent.
     *
     * @param seq - command number
     * @param source - state that caused the command
     * @param commands - frames in the order they have to be sent
     */
    private enqueueWl433(seq: number, source: string, commands: Wl433Command[]): void {
        if (!this.device || !this.gatewayConnected) {
            throw new Error("gateway is not connected");
        }
        const tail = this.commandQueue.slice(-commands.length);
        const replaceable =
            commands.every(command => command.key !== undefined) &&
            tail.length === commands.length &&
            tail.every((queued, index) => queued.wl433?.key === commands[index].key);
        if (replaceable) {
            const offset = this.commandQueue.length - commands.length;
            commands.forEach((command, index) => {
                const replaced = this.commandQueue[offset + index];
                this.commandQueue[offset + index] = {
                    seq,
                    source,
                    dps: { [DP.RAW_FRAME]: command.frame.base64 },
                    queuedAt: replaced.queuedAt,
                    wl433: command,
                };
            });
            this.log.debug(
                `[queue] #${seq} replaces the not yet sent ${seqList(tail)} (${commands.map(command => command.description).join(", ")})`,
            );
            this.scheduleFlush();
            return;
        }
        for (const command of commands) {
            this.enqueue(seq, source, { [DP.RAW_FRAME]: command.frame.base64 }, undefined, command);
        }
    }

    private enqueue(
        seq: number,
        source: string,
        dps: DpMap,
        onSuccess?: Command["onSuccess"],
        wl433?: Wl433Command,
    ): void {
        if (!this.device || !this.gatewayConnected) {
            throw new Error("gateway is not connected");
        }
        if (this.commandQueue.length >= MAX_QUEUED_COMMANDS) {
            const dropped = this.commandQueue.shift();
            this.log.warn(
                `[queue] More than ${MAX_QUEUED_COMMANDS} pending commands, dropping the oldest #${dropped?.seq} ${dropped?.source} ${JSON.stringify(dropped?.dps)}`,
            );
        }
        this.commandQueue.push({ seq, source, dps, queuedAt: Date.now(), onSuccess, wl433 });
        this.log.debug(
            `[queue] #${seq} queued ${wl433 ? `${wl433.description} ${wl433.frame.hex}` : JSON.stringify(dps)} ` +
                `(${this.commandQueue.length} pending${this.sending ? ", a command is being sent" : ""})`,
        );
        this.scheduleFlush();
    }

    private scheduleFlush(): void {
        if (this.sending || this.flushTimer || this.unloading) {
            return;
        }
        this.flushTimer = this.setTimeout(() => {
            this.flushTimer = undefined;
            void this.flushQueue();
        }, COMMAND_DEBOUNCE_MS);
    }

    /**
     * Takes the next command from the queue and merges following commands into it. DP 101 frames are never
     * merged: every frame is a separate command for the gateway.
     */
    private takeBatch(): Command[] {
        const batch: Command[] = [];
        while (this.commandQueue.length) {
            const next = this.commandQueue[0];
            const isFrame = DP.RAW_FRAME in next.dps;
            if (batch.length && (isFrame || DP.RAW_FRAME in batch[0].dps)) {
                break;
            }
            batch.push(next);
            this.commandQueue.shift();
            if (isFrame) {
                break;
            }
        }
        return batch;
    }

    private async flushQueue(): Promise<void> {
        const device = this.device;
        if (this.sending || !device || !this.gatewayConnected || !this.commandQueue.length) {
            return;
        }
        const batch = this.takeBatch();
        const data: DpMap = Object.assign({}, ...batch.map(command => command.dps));
        const ids = seqList(batch);
        const wl433 = batch[0].wl433;
        this.sending = true;
        const sentAt = Date.now();
        try {
            if (wl433) {
                // the gateway answers with its status about 2.5 s after the last change, the commands are confirmed
                // by that status instead of blocking the queue
                await device.set({ multiple: true, data, shouldWaitForResponse: false });
                this.log.debug(
                    `[queue] ${ids} sent ${wl433.description} as ${wl433.frame.hex}, waited ${formatDuration(sentAt - batch[0].queuedAt)} in queue` +
                        `${wl433.internal ? "" : wl433.dmx !== undefined ? ", waiting for the DMX answer of the gateway" : Object.keys(wl433.update).length ? ", waiting for the status of the gateway" : ", not visible in the status of the gateway"}`,
                );
                await this.onWl433Sent(batch[0], wl433, sentAt);
            } else {
                this.log.debug(
                    `[queue] Sending ${ids} to gateway: ${JSON.stringify(data)}` +
                        `${batch.length > 1 ? ` (${batch.length} commands merged)` : ""}, waited ${formatDuration(sentAt - batch[0].queuedAt)} in queue`,
                );
                await device.set({ multiple: true, data });
                this.log.debug(`[queue] ${ids} confirmed by gateway after ${formatDuration(Date.now() - sentAt)}`);
                for (const command of batch) {
                    await command.onSuccess?.(sentAt);
                }
            }
        } catch (error) {
            this.log.warn(
                `[queue] Gateway did not confirm ${ids} ${JSON.stringify(data)} within ${formatDuration(Date.now() - sentAt)}: ${redact(errorText(error), this.secrets)}`,
            );
            this.log.debug(`[queue] ${errorStack(error)}`);
        } finally {
            this.sending = false;
        }
        if (this.commandQueue.length) {
            this.log.debug(`[queue] ${this.commandQueue.length} command(s) still pending`);
            this.scheduleFlush();
        }
    }

    /**
     * Records a sent DP 101 command and waits for the status that confirms it.
     *
     * @param command - queued command
     * @param wl433 - its DP 101 frame
     * @param sentAt - time it was sent
     */
    private async onWl433Sent(command: Command, wl433: Wl433Command, sentAt: number): Promise<void> {
        if (wl433.internal) {
            this.onStatusQuerySent(command.seq);
            return;
        }
        await this.addToHistory(wl433.frame, "tx", sentAt);
        if (wl433.dmx !== undefined) {
            this.waitForDmxAnswer(command.seq, wl433.dmx, sentAt);
            return;
        }
        if (!Object.keys(wl433.update).length) {
            return;
        }
        const superseded = this.pendingConfirmations.filter(pending => pending.command.key === wl433.key);
        if (superseded.length) {
            this.log.debug(
                `[cmd] #${command.seq} ${wl433.description} supersedes the unconfirmed ${seqList(superseded)}`,
            );
            this.pendingConfirmations = this.pendingConfirmations.filter(pending => !superseded.includes(pending));
        }
        this.pendingConfirmations.push({ seq: command.seq, source: command.source, command: wl433, sentAt });
        this.confirmationQueryAsked = false;
        this.armConfirmTimer(STATUS_REPORT_TIMEOUT_MS);
    }

    private armConfirmTimer(delayMs: number): void {
        this.clearConfirmTimer();
        this.confirmTimer = this.setTimeout(() => {
            this.confirmTimer = undefined;
            this.onConfirmTimeout();
        }, delayMs);
    }

    private clearConfirmTimer(): void {
        if (this.confirmTimer) {
            this.clearTimeout(this.confirmTimer);
            this.confirmTimer = undefined;
        }
    }

    /** No status confirmed the commands in time: request the status once, then report them as not confirmed. */
    private onConfirmTimeout(): void {
        if (!this.pendingConfirmations.length || this.unloading) {
            return;
        }
        if (!this.confirmationQueryAsked) {
            this.confirmationQueryAsked = true;
            this.log.debug(
                `[cmd] No status confirmed ${seqList(this.pendingConfirmations)} within ${formatDuration(STATUS_REPORT_TIMEOUT_MS)}, requesting the status`,
            );
            this.requestStatus("confirmation");
            this.armConfirmTimer(STATUS_QUERY_TIMEOUT_MS);
            return;
        }
        const now = Date.now();
        const status = this.status ? describeStatus(this.status) : "none received";
        for (const pending of this.pendingConfirmations) {
            const text =
                `[cmd] #${pending.seq} ${pending.source}: the gateway did not confirm ${pending.command.description} within ` +
                `${formatDuration(now - pending.sentAt)} (last status: ${status}). The command may not have been executed.`;
            if (this.confirmationProblemReported) {
                this.log.debug(text);
            } else {
                this.log.warn(text);
                this.confirmationProblemReported = true;
            }
        }
        this.pendingConfirmations = [];
        this.confirmationQueryAsked = false;
    }

    // ------------------------------------------------------------------ timers

    /** Reads the timers of the instance settings and plans their next runs. */
    private async setupTimers(): Promise<void> {
        const configured = toList(this.config.timers) as TimerConfig[];
        if (configured.length > MAX_TIMERS) {
            this.log.warn(
                `[timer] ${configured.length} timers configured, only the first ${MAX_TIMERS} are used - please delete the others in the instance settings`,
            );
        }
        const active = await this.getStateAsync("timers.active");
        this.timersActive = active?.val !== false;
        this.position = await this.readPosition();
        this.timers = [];
        this.timerErrors.clear();
        configured.slice(0, MAX_TIMERS).forEach((config, position) => {
            const index = position + 1;
            if (config?.enabled === false) {
                this.log.debug(`[timer] Timer ${index} "${configName(config)}" is disabled`);
                return;
            }
            const result = parseTimer(config ?? {}, index);
            if ("error" in result) {
                this.timerErrors.set(index, result.error);
                this.log.warn(
                    `[timer] Timer ${index} "${configName(config)}" is ignored: ${result.error}. Please correct it in the instance settings (tab Timers)`,
                );
                return;
            }
            const timer = result.timer;
            if (timer.trigger !== "time" && !this.position) {
                const error = `uses the sun event "${timer.trigger}", but no position is set in the ioBroker system settings`;
                this.timerErrors.set(index, error);
                this.log.warn(
                    `[timer] Timer ${index} "${timer.name}" ${error} (System settings: latitude and longitude). The timer is ignored`,
                );
                return;
            }
            this.timers.push(timer);
        });
        this.log.info(
            `[timer] ${this.timers.length} timer(s) active${this.timerErrors.size ? `, ${this.timerErrors.size} ignored because of errors` : ""}` +
                `${this.timersActive ? "" : ", all timers are paused (timers.active = false)"}`,
        );
        for (const timer of this.timers) {
            this.log.debug(
                `[timer] Timer ${timer.index} "${timer.name}": ${describeSchedule(timer)} -> ${describeAction(timer)}`,
            );
            this.scheduleTimer(timer, new Date());
        }
        await this.updateTimerStates();
    }

    /** Reads the geographic position from the ioBroker system settings (needed for sun events). */
    private async readPosition(): Promise<GeoPosition | undefined> {
        const needed = (toList(this.config.timers) as TimerConfig[]).some(
            timer =>
                typeof timer?.trigger === "string" && (ASTRO_TRIGGERS as readonly string[]).includes(timer.trigger),
        );
        if (!needed) {
            return undefined;
        }
        try {
            const config = await this.getForeignObjectAsync("system.config");
            const latitude = Number((config?.common as { latitude?: unknown } | undefined)?.latitude);
            const longitude = Number((config?.common as { longitude?: unknown } | undefined)?.longitude);
            if (Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude || longitude)) {
                this.log.debug(`[timer] Position for sun events: latitude ${latitude}, longitude ${longitude}`);
                return { latitude, longitude };
            }
            this.log.debug("[timer] No position in the system settings");
        } catch (error) {
            this.log.debug(`[timer] Cannot read the system settings: ${errorText(error)}`);
        }
        return undefined;
    }

    /**
     * Plans the next run of a timer.
     *
     * @param timer - validated timer
     * @param after - the run must be later than this
     */
    private scheduleTimer(timer: Timer, after: Date): void {
        this.clearTimeoutOf(this.timerTimeouts, timer.index);
        const run = nextRun(timer, after, this.position);
        this.timerRuns.set(timer.index, run);
        if (!run) {
            this.log.warn(
                `[timer] Timer ${timer.index} "${timer.name}" has no run within the next year (${describeSchedule(timer)}), please check weekdays and season`,
            );
            return;
        }
        const shifts = [
            timer.offset ? `offset ${timer.offset} min` : "",
            run.randomShift ? `random ${run.randomShift > 0 ? "+" : ""}${run.randomShift} min` : "",
        ].filter(Boolean);
        this.log.debug(
            `[timer] Timer ${timer.index} "${timer.name}" next run ${formatLocal(run.at)}` +
                `${timer.trigger === "time" ? "" : ` (${timer.trigger} ${formatLocal(run.base)})`}${shifts.length ? `, ${shifts.join(", ")}` : ""}`,
        );
        this.armTimer(timer, run);
    }

    private armTimer(timer: Timer, run: NextRun): void {
        const delayMs = Math.min(Math.max(run.at.getTime() - Date.now(), 0), MAX_TIMER_WAIT_MS);
        const timeout = this.setTimeout(() => void this.runTimer(timer, run), delayMs);
        if (timeout) {
            this.timerTimeouts.set(timer.index, timeout);
        }
    }

    private async runTimer(timer: Timer, run: NextRun): Promise<void> {
        this.timerTimeouts.delete(timer.index);
        if (this.unloading) {
            return;
        }
        const now = Date.now();
        if (now < run.at.getTime() - 1000) {
            // a long wait was split, keep waiting
            this.log.debug(
                `[timer] Timer ${timer.index} "${timer.name}": ${formatDuration(run.at.getTime() - now)} until ${formatLocal(run.at)}, waiting further`,
            );
            this.armTimer(timer, run);
            return;
        }
        if (!this.timersActive) {
            this.log.debug(
                `[timer] Timer ${timer.index} "${timer.name}" skipped: all timers are paused (timers.active)`,
            );
        } else {
            await this.executeTimer(timer, run);
        }
        this.scheduleTimer(timer, new Date(Math.max(now, run.at.getTime()) + 1000));
        await this.updateTimerStates();
    }

    /**
     * Where the commands of a timer go: the zone channel in the zone mode "channels", otherwise light.* with the
     * zone of the timer (the zone selector light.zone is not changed).
     *
     * @param zone - zone of the timer, 0 = all zones
     */
    private timerTarget(zone: number): Target {
        const isZoneChannel = this.zoneMode === "channels" && zone !== ZONE_ALL;
        return { channel: isZoneChannel ? zoneChannelId(zone) : "light", zone, isZoneChannel };
    }

    /**
     * Executes the action of a timer.
     *
     * @param timer - validated timer
     * @param run - the run that is due
     */
    private async executeTimer(timer: Timer, run: NextRun): Promise<void> {
        const seq = ++this.commandSeq;
        const source = `timer ${timer.index} "${timer.name}"`;
        const late = Date.now() - run.at.getTime();
        this.log.debug(
            `[timer] #${seq} Timer ${timer.index} "${timer.name}" runs (planned ${formatLocal(run.at)}${late > 2000 ? `, ${formatDuration(late)} late` : ""}): ${describeAction(timer)}`,
        );
        const fields: [string, ioBroker.StateValue][] = [];
        switch (timer.action) {
            case "on":
                fields.push(["on", true]);
                break;
            case "off":
                fields.push(["on", false]);
                break;
            case "white":
                fields.push(["colorTemperature", timer.temperature ?? 0]);
                break;
            case "colour":
                fields.push(["color", timer.color ?? ""]);
                break;
            case "scene":
                fields.push(["scene", timer.scene ?? 1]);
                break;
            case "brightness":
                break;
        }
        if (timer.action !== "off" && timer.brightness !== undefined) {
            fields.push(["brightness", timer.brightness]);
        }
        const target = this.timerTarget(timer.zone);
        try {
            for (const [field, value] of fields) {
                this.sendField(seq, source, target, field, value);
            }
            if (this.timerProblemReported) {
                this.log.info("[timer] Timers are executed again");
                this.timerProblemReported = false;
            }
        } catch (error) {
            const text = `[timer] #${seq} Timer ${timer.index} "${timer.name}" could not switch the lights: ${errorText(error)}`;
            if (this.timerProblemReported) {
                this.log.debug(text);
            } else {
                this.timerProblemReported = true;
                this.log.warn(text);
            }
            this.log.debug(`[timer] #${seq} ${errorStack(error)}`);
            return;
        }
        await this.setState(
            "timers.lastRun",
            `${formatLocal(new Date())} · ${timer.name} (${describeAction(timer)})`,
            true,
        );
        this.clearTimeoutOf(this.timerOffTimeouts, timer.index);
        if (timer.action !== "off" && timer.duration > 0) {
            this.log.debug(
                `[timer] #${seq} Timer ${timer.index} "${timer.name}" switches off again in ${timer.duration} min`,
            );
            const timeout = this.setTimeout(() => void this.executeTimerOff(timer), timer.duration * 60_000);
            if (timeout) {
                this.timerOffTimeouts.set(timer.index, timeout);
            }
        }
    }

    /**
     * Switches off at the end of the duration of a timer. Runs also while the timers are paused, because the timer
     * has already switched on.
     *
     * @param timer - validated timer
     */
    private async executeTimerOff(timer: Timer): Promise<void> {
        this.timerOffTimeouts.delete(timer.index);
        if (this.unloading) {
            return;
        }
        const seq = ++this.commandSeq;
        const source = `timer ${timer.index} "${timer.name}" (end of ${timer.duration} min)`;
        this.log.debug(`[timer] #${seq} ${source}: switching off ${timer.zone ? `zone ${timer.zone}` : "all zones"}`);
        try {
            this.sendField(seq, source, this.timerTarget(timer.zone), "on", false);
            await this.setState(
                "timers.lastRun",
                `${formatLocal(new Date())} · ${timer.name} (off after ${timer.duration} min)`,
                true,
            );
        } catch (error) {
            this.log.warn(`[timer] #${seq} ${source} could not switch off the lights: ${errorText(error)}`);
            this.log.debug(`[timer] #${seq} ${errorStack(error)}`);
        }
    }

    /** Writes timers.nextRun and timers.overview. */
    private async updateTimerStates(): Promise<void> {
        let next: { at: Date; timer: Timer } | undefined;
        for (const timer of this.timers) {
            const run = this.timerRuns.get(timer.index);
            if (run && (!next || run.at < next.at)) {
                next = { at: run.at, timer };
            }
        }
        const nextText = next ? `${formatLocal(next.at)} · ${next.timer.name}` : "";
        await this.setStateChangedAsync(
            "timers.nextRun",
            this.timersActive || !nextText ? nextText : `paused (${nextText})`,
            true,
        );
        const configured = toList(this.config.timers) as TimerConfig[];
        const overview = configured.slice(0, MAX_TIMERS).map((config, position) => {
            const index = position + 1;
            const timer = this.timers.find(entry => entry.index === index);
            const run = this.timerRuns.get(index);
            return {
                index,
                name: timer?.name ?? (configName(config) || `Timer ${index}`),
                enabled: config?.enabled !== false,
                schedule: timer ? describeSchedule(timer) : undefined,
                action: timer ? describeAction(timer) : undefined,
                nextRun: timer && run ? formatLocal(run.at) : null,
                error: this.timerErrors.get(index),
            };
        });
        await this.setStateChangedAsync("timers.overview", JSON.stringify(overview), true);
    }

    private async setTimersActive(seq: number, active: boolean): Promise<void> {
        this.timersActive = active;
        await this.setState("timers.active", active, true);
        this.log.info(`[timer] #${seq} All timers ${active ? "active again" : "paused"} (timers.active = ${active})`);
        await this.updateTimerStates();
    }

    private clearTimeoutOf(map: Map<number, ioBroker.Timeout>, index: number): void {
        const timeout = map.get(index);
        if (timeout) {
            this.clearTimeout(timeout);
            map.delete(index);
        }
    }

    private clearAllTimers(): void {
        for (const map of [this.timerTimeouts, this.timerOffTimeouts]) {
            for (const timeout of map.values()) {
                this.clearTimeout(timeout);
            }
            map.clear();
        }
    }

    // ------------------------------------------------------------------ DMX start address

    /**
     * Sends a new DMX start address. It applies to the zone of light.* (zone selector) or all zones.
     *
     * @param seq - command number
     * @param source - state ID
     * @param val - new address
     */
    private setDmxAddress(seq: number, source: string, val: ioBroker.StateValue): void {
        const address = toNumber(val);
        if (!Number.isInteger(address) || address < DMX_ADDRESS_MIN || address > DMX_ADDRESS_MAX) {
            throw new Error(`a DMX start address from ${DMX_ADDRESS_MIN} to ${DMX_ADDRESS_MAX} is expected`);
        }
        const zone = this.zoneMode === "selector" ? this.selectedZone : ZONE_ALL;
        const frame = buildDmxCommand(address, zone);
        const description = `DMX start address ${address} (${zone === ZONE_ALL ? "all zones" : `zone ${zone}`})`;
        this.log.debug(`[cmd] #${seq} ${source} -> ${description}`);
        this.enqueueWl433(seq, source, [
            { frame, zone, description, key: "dmx", update: {}, internal: false, dmx: address },
        ]);
    }

    private waitForDmxAnswer(seq: number, address: number, sentAt: number): void {
        this.pendingDmx = { seq, address, sentAt };
        if (this.dmxTimer) {
            this.clearTimeout(this.dmxTimer);
        }
        this.dmxTimer = this.setTimeout(() => {
            this.dmxTimer = undefined;
            const pending = this.pendingDmx;
            this.pendingDmx = undefined;
            if (pending) {
                this.log.warn(
                    `[cmd] #${pending.seq} settings.dmxAddress: the gateway did not confirm the DMX start address ${pending.address} within ${formatDuration(DMX_ANSWER_TIMEOUT_MS)}`,
                );
            }
        }, DMX_ANSWER_TIMEOUT_MS);
    }

    /**
     * The gateway confirmed a DMX start address (also when it was changed in the MiBoxer app).
     *
     * @param address - confirmed address
     */
    private async onDmxAnswer(address: number): Promise<void> {
        const pending = this.pendingDmx;
        if (pending && pending.address === address) {
            this.log.debug(
                `[cmd] #${pending.seq} DMX start address ${address} confirmed by the gateway after ${formatDuration(Date.now() - pending.sentAt)}`,
            );
            this.pendingDmx = undefined;
            if (this.dmxTimer) {
                this.clearTimeout(this.dmxTimer);
                this.dmxTimer = undefined;
            }
        } else {
            this.log.debug(`[rx] DMX start address ${address} reported by the gateway (changed by the app?)`);
        }
        this.dmxAddress = address;
        await this.setStateChangedAsync("settings.dmxAddress", address, true);
    }

    /**
     * The status contains the low byte of the DMX start address. It is taken over unless it matches the known
     * address (addresses above 255 are only known from the DMX answers).
     *
     * @param lowByte - byte 10 of the status
     */
    private async onDmxLowByte(lowByte: number): Promise<void> {
        if (this.dmxAddress !== undefined && (this.dmxAddress & 0xff) === lowByte) {
            return;
        }
        if (lowByte < DMX_ADDRESS_MIN) {
            this.log.debug(`[rx] Status reports DMX low byte ${lowByte}, not a valid address, ignored`);
            return;
        }
        this.log.debug(
            `[rx] DMX start address ${lowByte} from the status${this.dmxAddress === undefined ? "" : ` (was ${this.dmxAddress})`}`,
        );
        this.dmxAddress = lowByte;
        await this.setStateChangedAsync("settings.dmxAddress", lowByte, true);
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MiboxerWl433(options);
} else {
    // otherwise start the instance directly
    (() => new MiboxerWl433())();
}
