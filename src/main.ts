/*
 * Created with @iobroker/create-adapter v3.1.5
 *
 * Local control of MiBoxer PW01/PW02 LoRa pool lights via the WL-433 gateway.
 * The gateway is a single Tuya device and is controlled via the Tuya LAN protocol (TCP 6668), no cloud involved.
 * Background: doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md, chapter 5.3 (path A2).
 */

import * as utils from "@iobroker/adapter-core";
import TuyaDevice from "tuyapi";
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
import { type DiscoveredDevice, TuyaDiscovery } from "./lib/discovery";
import { decodeDp101, type Dp101Frame, encodeDp101Hex } from "./lib/dp101";
import { COUNTDOWN_MAX, DP, DP101_HISTORY_LENGTH, LIGHT_MODES, OBJECT_DEFINITIONS } from "./lib/objects";

type DpValue = string | number | boolean;
type DpMap = Record<string, DpValue>;

/** A queued write to the gateway */
interface Command {
    dps: DpMap;
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

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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

class MiboxerWl433 extends utils.Adapter {
    private device: TuyaDevice | undefined;
    private gatewayConnected = false;
    private connectedAt = 0;
    private unloading = false;
    private ip = "";
    private protocolVersion = DEFAULT_PROTOCOL_VERSION;
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
    private commandQueue: Command[] = [];
    private dp101History: HistoryEntry[] = [];
    private lastDp101RxAt = 0;
    /** Last known value of every datapoint reported by the gateway */
    private readonly dpCache: Record<string, unknown> = {};
    /** Value types of the dynamically created raw.dp<n> states */
    private readonly rawTypes = new Map<string, ioBroker.CommonType>();
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
        await this.restoreHistory();

        const deviceId = String(this.config.deviceId ?? "").trim();
        const localKey = String(this.config.localKey ?? "");
        const version = String(this.config.protocolVersion ?? "");
        this.protocolVersion = PROTOCOL_VERSIONS.includes(version) ? version : DEFAULT_PROTOCOL_VERSION;

        if (!deviceId) {
            this.log.error(
                "Adapter is not configured: please enter the device ID and the local key of the WL-433 gateway in the instance settings",
            );
            return;
        }
        if (localKey.length !== LOCAL_KEY_LENGTH) {
            this.log.error(
                `The local key must have exactly ${LOCAL_KEY_LENGTH} characters (configured: ${localKey.length}), please correct it in the instance settings`,
            );
            return;
        }

        this.ip = String(this.config.ip ?? "").trim();
        if (this.ip) {
            await this.setState("info.ip", this.ip, true);
        }

        this.subscribeStates("light.*");
        this.subscribeStates("dp101.raw");
        this.subscribeStates("dp101.hex");
        this.subscribeStates("raw.*");

        await this.connectGateway();
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback - Callback function
     */
    private onUnload(callback: () => void): void {
        try {
            this.unloading = true;
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
            this.commandQueue = [];
            this.destroyTuyaDevice();
            this.gatewayConnected = false;
            void this.setState("info.connection", false, true);
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${errorText(error)}`);
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
        this.handleCommand(localId, state.val).catch((error: unknown) =>
            this.log.warn(`Command ${localId} = ${JSON.stringify(state.val)} not executed: ${errorText(error)}`),
        );
    }

    /**
     * Handles the "discover" request of the "Search gateway" button in the instance settings.
     *
     * @param obj - message from the admin UI
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj?.callback || obj.command !== "discover") {
            return;
        }
        const message = obj.message as { deviceId?: unknown } | undefined;
        const wantedId = typeof message?.deviceId === "string" ? message.deviceId.trim() : "";
        let response: Record<string, unknown>;
        try {
            response = await this.handleDiscoverRequest(wantedId);
        } catch (error) {
            response = { error: errorText(error) };
        }
        this.sendTo(obj.from, obj.command, response, obj.callback);
    }

    // ------------------------------------------------------------------ connection

    private get reconnectDelayMs(): number {
        const seconds = Number(this.config.reconnectInterval);
        return (Number.isFinite(seconds) && seconds >= 5 ? seconds : 30) * 1000;
    }

    private get pollDelayMs(): number {
        const seconds = Number(this.config.pollInterval);
        return Number.isFinite(seconds) && seconds > 0 ? Math.max(10, seconds) * 1000 : 0;
    }

    private async connectGateway(): Promise<void> {
        if (this.unloading) {
            return;
        }
        this.clearReconnectTimer();

        if (!this.ip) {
            await this.resolveIpByDiscovery();
            if (!this.ip) {
                this.scheduleReconnect();
                return;
            }
        }
        if (this.unloading) {
            return;
        }

        this.device ??= this.createTuyaDevice();
        this.log.debug(`Connecting to gateway ${this.ip} (Tuya protocol ${this.protocolVersion})`);
        try {
            await this.connectWithTimeout(this.device);
        } catch (error) {
            this.onConnectionProblem(errorText(error));
        }
    }

    private createTuyaDevice(): TuyaDevice {
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
        device.on("data", (data: unknown) => void this.onData(data));
        device.on("dp-refresh", (data: unknown) => void this.onData(data));
        return device;
    }

    /**
     * Discards the tuyapi instance. tuyapi reconnects implicitly for pending requests, so connect() of the
     * discarded instance is disabled to make sure it can never occupy the single local connection again.
     */
    private destroyTuyaDevice(): void {
        const device = this.device;
        if (!device) {
            return;
        }
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
                this.destroyTuyaDevice();
                reject(new Error(`no answer within ${CONNECT_TIMEOUT_MS / 1000} s`));
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
        const text = `Connected to WL-433 gateway at ${this.ip} (Tuya protocol ${this.protocolVersion})`;
        if (this.failedAttempts) {
            // while connections keep failing, only report once the connection proved to be stable
            this.log.debug(text);
        } else {
            this.log.info(text);
        }
        this.clearStableTimer();
        this.stableTimer = this.setTimeout(() => this.onConnectionStable(), SHORT_CONNECTION_MS);
        await this.setState("info.connection", true, true);
        this.schedulePoll();
    }

    private onConnectionStable(): void {
        this.stableTimer = undefined;
        if (this.failedAttempts) {
            this.log.info(`Connection to WL-433 gateway at ${this.ip} is stable again`);
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
        this.gatewayConnected = false;
        this.clearPollTimer();
        this.clearStableTimer();
        if (this.unloading) {
            return;
        }
        await this.setState("info.connection", false, true);

        if (this.commandQueue.length) {
            this.log.warn(`Connection lost, ${this.commandQueue.length} pending command(s) discarded`);
            this.commandQueue = [];
        }
        if (!wasConnected) {
            return;
        }
        if (Date.now() - this.connectedAt < SHORT_CONNECTION_MS) {
            this.onConnectionProblem("gateway closed the connection right after it was established");
            return;
        }
        this.log.info(`Connection to gateway ${this.ip} lost, reconnecting in ${this.reconnectDelayMs / 1000} s`);
        this.scheduleReconnect();
    }

    private onConnectionProblem(reason: string): void {
        if (this.unloading) {
            return;
        }
        this.failedAttempts++;
        const retry = `retrying in ${this.reconnectDelayMs / 1000} s`;
        if (this.failedAttempts >= FAILURES_BEFORE_HINT && !this.problemReported) {
            this.problemReported = true;
            this.log.warn(
                `Cannot keep a connection to the WL-433 gateway at ${this.ip} (${reason}). ` +
                    "Please check the IP address, the local key and the protocol version. Tuya devices accept only ONE local connection: " +
                    "close the MiBoxer / Smart Life app on phones in the same network and stop other local integrations " +
                    `(ioBroker.tuya, Home Assistant, tinytuya) for this gateway. ${retry}`,
            );
        } else if (this.failedAttempts === 1) {
            this.log.info(`Connection to gateway ${this.ip} failed (${reason}), ${retry}`);
        } else {
            this.log.debug(`Connection to gateway ${this.ip} failed (${reason}), ${retry}`);
        }

        // an IP found by discovery may be outdated (DHCP), search again from time to time
        if (!String(this.config.ip ?? "").trim() && this.failedAttempts % FAILURES_BEFORE_HINT === 0) {
            this.ip = "";
            this.destroyTuyaDevice();
        }
        this.scheduleReconnect();
    }

    private onDeviceError(error: unknown): void {
        if (!this.unloading) {
            // connection and command failures are reported where they are handled, this is only additional detail
            this.log.debug(`Gateway: ${errorText(error)}`);
        }
    }

    private scheduleReconnect(): void {
        if (this.unloading) {
            return;
        }
        this.clearReconnectTimer();
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
        const delay = this.pollDelayMs;
        if (!delay || this.unloading) {
            return;
        }
        this.pollTimer = this.setTimeout(() => {
            this.pollTimer = undefined;
            void this.pollStatus();
        }, delay);
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
        if (device && this.gatewayConnected && !this.sending) {
            try {
                await device.get({ schema: true });
            } catch (error) {
                this.log.debug(`Status refresh failed: ${errorText(error)}`);
            }
        }
        if (this.gatewayConnected) {
            this.schedulePoll();
        }
    }

    // ------------------------------------------------------------------ discovery

    private async resolveIpByDiscovery(): Promise<void> {
        const deviceId = String(this.config.deviceId).trim();
        const searching = `No IP address configured, searching gateway ${deviceId} in the local network`;
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
            const text = `Gateway ${deviceId} did not announce itself in the local network.${others} Retrying in ${this.reconnectDelayMs / 1000} s, alternatively enter the IP address in the instance settings.`;
            if (this.discoveryWarned) {
                this.log.debug(text);
            } else {
                this.discoveryWarned = true;
                this.log.warn(text);
            }
            return;
        }

        this.discoveryWarned = false;
        this.destroyTuyaDevice();
        this.ip = match.ip;
        if (PROTOCOL_VERSIONS.includes(match.version) && match.version !== this.protocolVersion) {
            this.log.info(
                `Gateway announces Tuya protocol ${match.version}, using it instead of the configured ${this.protocolVersion}`,
            );
            this.protocolVersion = match.version;
        }
        if (this.ip !== this.lastFoundIp) {
            this.log.info(`Found gateway ${deviceId} at ${this.ip}`);
            this.lastFoundIp = this.ip;
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
                resolve([...found.values()]);
            };

            run.discovery = new TuyaDiscovery(
                device => {
                    if (!found.has(device.id)) {
                        this.log.debug(`Discovery: ${device.id} at ${device.ip} (protocol ${device.version})`);
                    }
                    found.set(device.id, device);
                    if (stopOnId && device.id === stopOnId) {
                        finish();
                    }
                },
                (port, error) => this.log.warn(`Discovery: cannot listen on UDP port ${port}: ${error.message}`),
            );
            this.activeDiscoveries.add(finish);
            run.discovery.start();
            run.timer = this.setTimeout(finish, durationMs);
        });
    }

    private async handleDiscoverRequest(wantedId: string): Promise<Record<string, unknown>> {
        // a connected Tuya device usually stops broadcasting, so answer from the running connection
        if (wantedId && wantedId === String(this.config.deviceId ?? "").trim() && this.gatewayConnected && this.ip) {
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

    private async onData(data: unknown): Promise<void> {
        if (this.unloading) {
            return;
        }
        const dps = (data as { dps?: unknown } | null | undefined)?.dps;
        if (!dps || typeof dps !== "object") {
            if (typeof data === "string" && data && !this.undecodableReported) {
                this.undecodableReported = true;
                this.log.warn(
                    `Gateway sent data that could not be decoded ("${data.substring(0, 60)}"). ` +
                        "Please check the local key and the protocol version (the WL-433 normally uses 3.3).",
                );
            } else {
                this.log.debug(`Ignoring gateway data without datapoints: ${JSON.stringify(data)}`);
            }
            return;
        }
        this.undecodableReported = false;
        try {
            await this.applyDps(dps as Record<string, unknown>);
        } catch (error) {
            this.log.warn(`Cannot process data from gateway: ${errorText(error)}`);
        }
    }

    private async applyDps(dps: Record<string, unknown>): Promise<void> {
        this.log.debug(`Datapoints from gateway: ${JSON.stringify(dps)}`);
        Object.assign(this.dpCache, dps);

        for (const [dp, value] of Object.entries(dps)) {
            switch (dp) {
                case DP.SWITCH:
                    if (typeof value === "boolean") {
                        await this.setStateChangedAsync("light.on", value, true);
                    }
                    break;
                case DP.MODE:
                    if (typeof value === "string") {
                        await this.setStateChangedAsync("light.mode", value, true);
                    }
                    break;
                case DP.BRIGHTNESS:
                    // evaluated below together with the mode, in colour mode DP 24 carries the brightness
                    break;
                case DP.TEMPERATURE:
                    if (typeof value === "number") {
                        await this.setStateChangedAsync("light.colorTemperature", rawToKelvin(value), true);
                    }
                    break;
                case DP.COLOUR: {
                    const hsv = parseTuyaHsv(value);
                    if (hsv) {
                        await this.setStateChangedAsync("light.color", tuyaHsvToRgbHex(hsv), true);
                    }
                    break;
                }
                case DP.COUNTDOWN:
                    if (typeof value === "number") {
                        await this.setStateChangedAsync("light.countdown", value, true);
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
            this.log.debug(`DP 101: unexpected value ${JSON.stringify(value)}`);
            return;
        }
        this.lastDp101RxAt = Date.now();
        let frame: Dp101Frame;
        try {
            frame = decodeDp101(value);
        } catch {
            this.log.debug(`DP 101: received value "${value}" is not Base64`);
            await this.setState("dp101.raw", value, true);
            return;
        }
        this.log.debug(`DP 101 received: ${frame.hex} (checksum ${frame.checksumValid ? "valid" : "invalid"})`);
        await this.setDp101States(frame);
        await this.addToHistory(frame, "rx", this.lastDp101RxAt);
    }

    /**
     * Records a frame the gateway accepted. Its answer frame usually arrives before the command is confirmed:
     * the answer must not be overwritten in the states and must not appear before the sent frame in the history.
     *
     * @param frame - sent frame
     * @param sentAt - time the command was sent
     */
    private async confirmSentFrame(frame: Dp101Frame, sentAt: number): Promise<void> {
        if (this.lastDp101RxAt < sentAt) {
            await this.setDp101States(frame);
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
            return;
        }
        try {
            const parsed: unknown = JSON.parse(state.val);
            if (Array.isArray(parsed)) {
                this.dp101History = (
                    parsed.filter(entry => entry && typeof entry === "object") as HistoryEntry[]
                ).slice(-DP101_HISTORY_LENGTH);
            }
        } catch {
            this.log.debug("Stored dp101.history is not valid JSON, starting with an empty history");
        }
    }

    private async updateRawDatapoint(dp: string, value: unknown): Promise<void> {
        if (!/^\d+$/.test(dp)) {
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
        }
        await this.setStateChangedAsync(id, val, true);
    }

    // ------------------------------------------------------------------ states -> gateway

    private async handleCommand(id: string, val: ioBroker.StateValue): Promise<void> {
        switch (id) {
            case "light.on":
                this.enqueue({ [DP.SWITCH]: toBoolean(val) });
                return;
            case "light.mode": {
                const mode = String(val);
                if (!(LIGHT_MODES as readonly string[]).includes(mode)) {
                    throw new Error(`unknown mode, allowed: ${LIGHT_MODES.join(", ")}`);
                }
                this.enqueue({ [DP.MODE]: mode });
                return;
            }
            case "light.brightness":
                this.enqueue(this.brightnessCommand(toNumber(val)));
                return;
            case "light.colorTemperature":
                this.enqueue({ [DP.MODE]: "white", [DP.TEMPERATURE]: kelvinToRaw(toNumber(val)) });
                return;
            case "light.color": {
                const hsv = rgbHexToTuyaHsv(String(val));
                if (!hsv) {
                    throw new Error('a colour like "#ff8800" is expected');
                }
                this.enqueue({ [DP.MODE]: "colour", [DP.COLOUR]: formatTuyaHsv(hsv) });
                return;
            }
            case "light.countdown":
                this.enqueue({ [DP.COUNTDOWN]: Math.round(clamp(toNumber(val), 0, COUNTDOWN_MAX)) });
                return;
            case "dp101.raw":
                this.enqueueFrame(decodeDp101(String(val)));
                return;
            case "dp101.hex": {
                const { frame, corrected } = encodeDp101Hex(String(val));
                if (corrected) {
                    this.log.info(`DP 101: checksum corrected, sending ${frame.hex}`);
                }
                this.enqueueFrame(frame);
                return;
            }
            default:
                if (id.startsWith("raw.dp")) {
                    await this.handleRawCommand(id, val);
                }
        }
    }

    /**
     * Brightness 0 switches off. In colour mode the brightness is the v part of DP 24, otherwise DP 22.
     * A brightness above 0 also switches the lights on, like a dimmer.
     *
     * @param percent - brightness 0..100
     */
    private brightnessCommand(percent: number): DpMap {
        if (percent <= 0) {
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
        return dps;
    }

    private async handleRawCommand(id: string, val: ioBroker.StateValue): Promise<void> {
        const dp = id.substring("raw.dp".length);
        let type = this.rawTypes.get(dp);
        if (!type) {
            const obj = await this.getObjectAsync(id);
            type = (obj?.common as ioBroker.StateCommon | undefined)?.type;
        }
        let value: DpValue;
        if (type === "boolean") {
            value = toBoolean(val);
        } else if (type === "number") {
            value = toNumber(val);
        } else {
            value = String(val);
        }
        this.enqueue({ [dp]: value });
    }

    private enqueueFrame(frame: Dp101Frame): void {
        this.enqueue({ [DP.RAW_FRAME]: frame.base64 }, sentAt => this.confirmSentFrame(frame, sentAt));
    }

    private enqueue(dps: DpMap, onSuccess?: Command["onSuccess"]): void {
        if (!this.device || !this.gatewayConnected) {
            throw new Error("gateway is not connected");
        }
        if (this.commandQueue.length >= MAX_QUEUED_COMMANDS) {
            const dropped = this.commandQueue.shift();
            this.log.warn(`Too many pending commands, dropping ${JSON.stringify(dropped?.dps)}`);
        }
        this.commandQueue.push({ dps, onSuccess });
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
        this.sending = true;
        try {
            this.log.debug(`Sending to gateway: ${JSON.stringify(data)}`);
            const sentAt = Date.now();
            await device.set({ multiple: true, data });
            for (const command of batch) {
                await command.onSuccess?.(sentAt);
            }
        } catch (error) {
            this.log.warn(`Gateway did not confirm ${JSON.stringify(data)}: ${errorText(error)}`);
        } finally {
            this.sending = false;
        }
        if (this.commandQueue.length) {
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
