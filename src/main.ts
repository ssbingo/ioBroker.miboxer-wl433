/*
 * Created with @iobroker/create-adapter v3.1.5
 *
 * Local control of MiBoxer PW01/PW02 LoRa pool lights via the WL-433 gateway.
 * The gateway is a single Tuya device and is controlled via the Tuya LAN protocol (TCP 6668), no cloud involved.
 * Background: doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md, chapter 5.3 (path A2).
 *
 * Logging: see src/lib/logging.ts for the level concept. Every message carries a component tag:
 * [cfg] configuration, [conn] connection, [rx] gateway -> states, [cmd] states -> commands, [queue] command queue,
 * [poll] status refresh, [disc] LAN discovery, [dp101] raw frames, [unload] shutdown, [tuyapi] library trace.
 */

import * as utils from "@iobroker/adapter-core";
import TuyaDevice from "tuyapi";
import { CommandType } from "tuyapi/lib/message-parser";
import {
    formatTuyaHsv,
    kelvinToRaw,
    parseTuyaHsv,
    percentToRaw,
    rawToKelvin,
    rawToPercent,
    rgbHexToTuyaHsv,
    tuyaHsvToRgbHex,
} from "./lib/color";
import { type DiscoveredDevice, DISCOVERY_PORTS, TuyaDiscovery } from "./lib/discovery";
import { decodeDp101, type Dp101Frame, encodeDp101Hex } from "./lib/dp101";
import { bridgeTuyapiDebug, formatDuration, redact, shorten } from "./lib/logging";
import { COUNTDOWN_MAX, DP, DP101_HISTORY_LENGTH, LIGHT_MODES, OBJECT_DEFINITIONS } from "./lib/objects";

type DpValue = string | number | boolean;
type DpMap = Record<string, DpValue>;

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
/** Collects rapid state changes (e.g. from a slider) into one Tuya command */
const COMMAND_DEBOUNCE_MS = 150;
const MAX_QUEUED_COMMANDS = 50;
const DEFAULT_RECONNECT_S = 30;
const MIN_RECONNECT_S = 5;
const MIN_POLL_S = 10;

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

function seqList(commands: Command[]): string {
    return commands.map(command => `#${command.seq}`).join(",");
}

class MiboxerWl433 extends utils.Adapter {
    private device: TuyaDevice | undefined;
    private gatewayConnected = false;
    private connectedAt = 0;
    private unloading = false;
    private ip = "";
    private protocolVersion = DEFAULT_PROTOCOL_VERSION;
    private reconnectDelayMs = DEFAULT_RECONNECT_S * 1000;
    private pollDelayMs = 0;
    private connectAttempt = 0;
    private connectStartedAt = 0;
    private failedAttempts = 0;
    private problemReported = false;
    private discoveryWarned = false;
    private lastFoundIp = "";
    private undecodableReported = false;
    private reconnectTimer: ioBroker.Timeout | undefined;
    private pollTimer: ioBroker.Timeout | undefined;
    private flushTimer: ioBroker.Timeout | undefined;
    private stableTimer: ioBroker.Timeout | undefined;
    private sending = false;
    private commandSeq = 0;
    private commandQueue: Command[] = [];
    private dp101History: HistoryEntry[] = [];
    private lastDp101RxAt = 0;
    private restoreTuyapiDebug: (() => void) | undefined;
    /** Values that must never appear in the log */
    private secrets: string[] = [];
    /** Last known value of every datapoint reported by the gateway */
    private readonly dpCache: Record<string, unknown> = {};
    /** Value types of the dynamically created raw.dp<n> states */
    private readonly rawTypes = new Map<string, ioBroker.CommonType>();
    /** Mapped datapoints that arrived with an unexpected type (reported once) */
    private readonly unexpectedDps = new Set<string>();
    /** Finish callbacks of running LAN discoveries, called on unload */
    private readonly activeDiscoveries = new Set<() => void>();

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

        for (const definition of OBJECT_DEFINITIONS) {
            await this.extendObject(definition.id, definition.obj);
        }
        this.log.debug(`[cfg] ${OBJECT_DEFINITIONS.length} objects created/updated`);
        await this.restoreHistory();

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
        this.log.debug("[cfg] Subscribed to light.*, dp101.raw, dp101.hex, raw.*");

        await this.connectGateway();
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

        this.log.info(
            `[cfg] Gateway ${deviceId}, IP ${this.ip || "automatic (UDP discovery)"}, Tuya protocol ${this.protocolVersion}, ` +
                `reconnect delay ${formatDuration(this.reconnectDelayMs)}, status refresh ${this.pollDelayMs ? formatDuration(this.pollDelayMs) : "off"}, ` +
                `local key ${localKey.length} characters (hidden)`,
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
                    `connection ${this.gatewayConnected ? "open" : "closed"}`,
            );
            this.clearReconnectTimer();
            this.clearPollTimer();
            this.clearStableTimer();
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
     * discarded instance is disabled to make sure it can never occupy the single local connection again.
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

    /** Requests the complete status, the answer arrives as "data" event */
    private async pollStatus(): Promise<void> {
        const device = this.device;
        if (!device || !this.gatewayConnected) {
            this.log.debug("[poll] Skipped: gateway not connected");
        } else if (this.sending) {
            this.log.debug("[poll] Skipped: a command is being sent");
        } else {
            const started = Date.now();
            try {
                this.log.debug("[poll] Requesting full status");
                await device.get({ schema: true });
                this.log.debug(`[poll] Status answered after ${formatDuration(Date.now() - started)}`);
            } catch (error) {
                this.log.debug(
                    `[poll] Status request failed after ${formatDuration(Date.now() - started)}: ${errorText(error)}`,
                );
            }
        }
        if (this.gatewayConnected) {
            this.schedulePoll();
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
        Object.assign(this.dpCache, dps);

        for (const [dp, value] of Object.entries(dps)) {
            switch (dp) {
                case DP.SWITCH:
                    if (typeof value === "boolean") {
                        await this.setMapped(dp, value, "light.on", value);
                    } else {
                        this.unexpectedValue(dp, value, "a boolean");
                    }
                    break;
                case DP.MODE:
                    if (typeof value === "string") {
                        await this.setMapped(dp, value, "light.mode", value);
                    } else {
                        this.unexpectedValue(dp, value, "a string");
                    }
                    break;
                case DP.BRIGHTNESS:
                    if (typeof value !== "number") {
                        this.unexpectedValue(dp, value, "a number");
                    }
                    // evaluated below together with the mode, in colour mode DP 24 carries the brightness
                    break;
                case DP.TEMPERATURE:
                    if (typeof value === "number") {
                        await this.setMapped(dp, value, "light.colorTemperature", rawToKelvin(value));
                    } else {
                        this.unexpectedValue(dp, value, "a number");
                    }
                    break;
                case DP.COLOUR: {
                    const hsv = parseTuyaHsv(value);
                    if (hsv) {
                        await this.setMapped(dp, value, "light.color", tuyaHsvToRgbHex(hsv));
                    } else {
                        this.unexpectedValue(dp, value, 'a colour "hhhhssssvvvv"');
                    }
                    break;
                }
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
                    await this.updateRawDatapoint(dp, value);
            }
        }

        if (DP.MODE in dps || DP.BRIGHTNESS in dps || DP.COLOUR in dps) {
            const brightness = this.currentBrightnessPercent();
            if (brightness !== undefined) {
                const source =
                    this.dpCache[DP.MODE] === "colour" && parseTuyaHsv(this.dpCache[DP.COLOUR])
                        ? `v of DP 24 (mode colour)`
                        : `DP 22 (mode ${JSON.stringify(this.dpCache[DP.MODE])})`;
                this.log.debug(`[rx] light.brightness = ${brightness} % from ${source}`);
                await this.setStateChangedAsync("light.brightness", brightness, true);
            }
        }
    }

    private currentBrightnessPercent(): number | undefined {
        if (this.dpCache[DP.MODE] === "colour") {
            const hsv = parseTuyaHsv(this.dpCache[DP.COLOUR]);
            if (hsv) {
                return rawToPercent(hsv.v);
            }
        }
        const raw = this.dpCache[DP.BRIGHTNESS];
        return typeof raw === "number" ? rawToPercent(raw) : undefined;
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
            await this.setState("dp101.raw", value, true);
            return;
        }
        this.log.debug(
            `[dp101] Received ${frame.hex} (${frame.bytes.length} bytes, checksum ${frame.checksumValid ? "valid" : "INVALID"}, Base64 ${frame.base64})`,
        );
        await this.setDp101States(frame);
        await this.addToHistory(frame, "rx", this.lastDp101RxAt);
    }

    /**
     * Records a frame the gateway accepted. Its answer frame usually arrives before the command is confirmed:
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

    private async setDp101States(frame: Dp101Frame): Promise<void> {
        await this.setState("dp101.raw", frame.base64, true);
        await this.setState("dp101.hex", frame.hex, true);
        await this.setState("dp101.checksumValid", frame.checksumValid, true);
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
                    name: { en: `Datapoint ${dp}`, de: `Datenpunkt ${dp}` },
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
            case "light.on":
                this.enqueue(seq, id, { [DP.SWITCH]: toBoolean(val) });
                return;
            case "light.mode": {
                const mode = String(val);
                if (!(LIGHT_MODES as readonly string[]).includes(mode)) {
                    throw new Error(`unknown mode, allowed: ${LIGHT_MODES.join(", ")}`);
                }
                this.enqueue(seq, id, { [DP.MODE]: mode });
                return;
            }
            case "light.brightness":
                this.enqueue(seq, id, this.brightnessCommand(seq, toNumber(val)));
                return;
            case "light.colorTemperature": {
                const kelvin = toNumber(val);
                const raw = kelvinToRaw(kelvin);
                this.log.debug(`[cmd] #${seq} ${kelvin} K -> DP 23 = ${raw} (switches to white mode)`);
                this.enqueue(seq, id, { [DP.MODE]: "white", [DP.TEMPERATURE]: raw });
                return;
            }
            case "light.color": {
                const hsv = rgbHexToTuyaHsv(String(val));
                if (!hsv) {
                    throw new Error('a colour like "#ff8800" is expected');
                }
                const colour = formatTuyaHsv(hsv);
                this.log.debug(
                    `[cmd] #${seq} ${String(val)} -> h ${hsv.h}, s ${hsv.s}, v ${hsv.v} -> DP 24 = "${colour}" (switches to colour mode)`,
                );
                this.enqueue(seq, id, { [DP.MODE]: "colour", [DP.COLOUR]: colour });
                return;
            }
            case "light.countdown":
                this.enqueue(seq, id, { [DP.COUNTDOWN]: Math.round(clamp(toNumber(val), 0, COUNTDOWN_MAX)) });
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
            default:
                if (id.startsWith("raw.dp")) {
                    await this.handleRawCommand(seq, id, val);
                } else {
                    this.log.debug(`[cmd] #${seq} ${id} is not writable by the adapter, ignored`);
                }
        }
    }

    /**
     * Brightness 0 switches off. In colour mode the brightness is the v part of DP 24, otherwise DP 22.
     * A brightness above 0 also switches the lights on, like a dimmer.
     *
     * @param seq - command number
     * @param percent - brightness 0..100
     */
    private brightnessCommand(seq: number, percent: number): DpMap {
        if (percent <= 0) {
            this.log.debug(`[cmd] #${seq} brightness ${percent} % -> switch off (DP 20 = false)`);
            return { [DP.SWITCH]: false };
        }
        const dps: DpMap = {};
        if (this.dpCache[DP.SWITCH] === false) {
            dps[DP.SWITCH] = true;
        }
        const hsv = this.dpCache[DP.MODE] === "colour" ? parseTuyaHsv(this.dpCache[DP.COLOUR]) : null;
        if (hsv) {
            dps[DP.COLOUR] = formatTuyaHsv({ ...hsv, v: percentToRaw(percent) });
        } else {
            dps[DP.BRIGHTNESS] = percentToRaw(percent);
        }
        this.log.debug(
            `[cmd] #${seq} brightness ${percent} % -> ${hsv ? "v of DP 24 (mode colour)" : `DP 22 (mode ${JSON.stringify(this.dpCache[DP.MODE])})`}` +
                `${dps[DP.SWITCH] ? ", lights are off -> also DP 20 = true" : ""}`,
        );
        return dps;
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

    private enqueue(seq: number, source: string, dps: DpMap, onSuccess?: Command["onSuccess"]): void {
        if (!this.device || !this.gatewayConnected) {
            throw new Error("gateway is not connected");
        }
        if (this.commandQueue.length >= MAX_QUEUED_COMMANDS) {
            const dropped = this.commandQueue.shift();
            this.log.warn(
                `[queue] More than ${MAX_QUEUED_COMMANDS} pending commands, dropping the oldest #${dropped?.seq} ${dropped?.source} ${JSON.stringify(dropped?.dps)}`,
            );
        }
        this.commandQueue.push({ seq, source, dps, queuedAt: Date.now(), onSuccess });
        this.log.debug(
            `[queue] #${seq} queued ${JSON.stringify(dps)} (${this.commandQueue.length} pending${this.sending ? ", a command is being sent" : ""})`,
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
        this.sending = true;
        const sentAt = Date.now();
        try {
            this.log.debug(
                `[queue] Sending ${ids} to gateway: ${JSON.stringify(data)}` +
                    `${batch.length > 1 ? ` (${batch.length} commands merged)` : ""}, waited ${formatDuration(sentAt - batch[0].queuedAt)} in queue`,
            );
            await device.set({ multiple: true, data });
            this.log.debug(`[queue] ${ids} confirmed by gateway after ${formatDuration(Date.now() - sentAt)}`);
            for (const command of batch) {
                await command.onSuccess?.(sentAt);
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
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MiboxerWl433(options);
} else {
    // otherwise start the instance directly
    (() => new MiboxerWl433())();
}
