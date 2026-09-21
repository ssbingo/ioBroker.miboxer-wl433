"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_tuyapi = __toESM(require("tuyapi"));
var import_message_parser = require("tuyapi/lib/message-parser");
var import_color = require("./lib/color");
var import_discovery = require("./lib/discovery");
var import_dp101 = require("./lib/dp101");
var import_logging = require("./lib/logging");
var import_objects = require("./lib/objects");
const PROTOCOL_VERSIONS = ["3.1", "3.3", "3.4", "3.5"];
const DEFAULT_PROTOCOL_VERSION = "3.3";
const LOCAL_KEY_LENGTH = 16;
const TUYA_PORT = 6668;
const DISCOVERY_DURATION_MS = 12e3;
const CONNECT_TIMEOUT_MS = 15e3;
const SHORT_CONNECTION_MS = 1e4;
const FAILURES_BEFORE_HINT = 3;
const COMMAND_DEBOUNCE_MS = 150;
const MAX_QUEUED_COMMANDS = 50;
const DEFAULT_RECONNECT_S = 30;
const MIN_RECONNECT_S = 5;
const MIN_POLL_S = 10;
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function errorStack(error) {
  return error instanceof Error && error.stack ? error.stack : String(error);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function toNumber(value) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new Error("a number is expected");
  }
  return num;
}
function toBoolean(value) {
  if (typeof value === "string") {
    return ["true", "1", "on"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}
function describeDevices(devices) {
  return devices.map((device) => `${device.id} @ ${device.ip} (${device.version})`).join(", ");
}
const COMMAND_NAMES = /* @__PURE__ */ new Map();
for (const [name, byte] of Object.entries(import_message_parser.CommandType)) {
  if (!COMMAND_NAMES.has(byte)) {
    COMMAND_NAMES.set(byte, name);
  }
}
function commandName(commandByte) {
  var _a;
  if (commandByte === void 0) {
    return "unknown command";
  }
  return `${(_a = COMMAND_NAMES.get(commandByte)) != null ? _a : "unknown"} (${commandByte})`;
}
function seqList(commands) {
  return commands.map((command) => `#${command.seq}`).join(",");
}
class MiboxerWl433 extends utils.Adapter {
  device;
  gatewayConnected = false;
  connectedAt = 0;
  unloading = false;
  ip = "";
  protocolVersion = DEFAULT_PROTOCOL_VERSION;
  reconnectDelayMs = DEFAULT_RECONNECT_S * 1e3;
  pollDelayMs = 0;
  connectAttempt = 0;
  connectStartedAt = 0;
  failedAttempts = 0;
  problemReported = false;
  discoveryWarned = false;
  lastFoundIp = "";
  undecodableReported = false;
  reconnectTimer;
  pollTimer;
  flushTimer;
  stableTimer;
  sending = false;
  commandSeq = 0;
  commandQueue = [];
  dp101History = [];
  lastDp101RxAt = 0;
  restoreTuyapiDebug;
  /** Values that must never appear in the log */
  secrets = [];
  /** Last known value of every datapoint reported by the gateway */
  dpCache = {};
  /** Value types of the dynamically created raw.dp<n> states */
  rawTypes = /* @__PURE__ */ new Map();
  /** Mapped datapoints that arrived with an unexpected type (reported once) */
  unexpectedDps = /* @__PURE__ */ new Set();
  /** Finish callbacks of running LAN discoveries, called on unload */
  activeDiscoveries = /* @__PURE__ */ new Set();
  constructor(options = {}) {
    super({
      ...options,
      name: "miboxer-wl433"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    await this.setState("info.connection", false, true);
    for (const definition of import_objects.OBJECT_DEFINITIONS) {
      await this.extendObject(definition.id, definition.obj);
    }
    this.log.debug(`[cfg] ${import_objects.OBJECT_DEFINITIONS.length} objects created/updated`);
    await this.restoreHistory();
    if (!this.readConfig()) {
      return;
    }
    if (this.log.level === "silly") {
      this.restoreTuyapiDebug = (0, import_logging.bridgeTuyapiDebug)((line) => this.log.silly(`[tuyapi] ${line}`), this.secrets);
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
  readConfig() {
    var _a, _b, _c, _d;
    const deviceId = String((_a = this.config.deviceId) != null ? _a : "").trim();
    const localKey = String((_b = this.config.localKey) != null ? _b : "");
    this.secrets = localKey ? [localKey] : [];
    const version = String((_c = this.config.protocolVersion) != null ? _c : "");
    if (PROTOCOL_VERSIONS.includes(version)) {
      this.protocolVersion = version;
    } else {
      this.log.warn(
        `[cfg] Unknown Tuya protocol version "${version}", using ${DEFAULT_PROTOCOL_VERSION} (allowed: ${PROTOCOL_VERSIONS.join(", ")})`
      );
      this.protocolVersion = DEFAULT_PROTOCOL_VERSION;
    }
    const reconnect = Number(this.config.reconnectInterval);
    if (Number.isFinite(reconnect) && reconnect >= MIN_RECONNECT_S) {
      this.reconnectDelayMs = reconnect * 1e3;
    } else {
      this.log.warn(
        `[cfg] Reconnect delay "${this.config.reconnectInterval}" is invalid or below ${MIN_RECONNECT_S} s, using ${DEFAULT_RECONNECT_S} s`
      );
      this.reconnectDelayMs = DEFAULT_RECONNECT_S * 1e3;
    }
    const poll = Number(this.config.pollInterval);
    if (!Number.isFinite(poll) || poll <= 0) {
      this.pollDelayMs = 0;
    } else if (poll < MIN_POLL_S) {
      this.log.warn(`[cfg] Status refresh interval ${poll} s is below ${MIN_POLL_S} s, using ${MIN_POLL_S} s`);
      this.pollDelayMs = MIN_POLL_S * 1e3;
    } else {
      this.pollDelayMs = poll * 1e3;
    }
    this.ip = String((_d = this.config.ip) != null ? _d : "").trim();
    if (!deviceId) {
      this.log.error(
        "[cfg] Adapter is not configured: please enter the device ID and the local key of the WL-433 gateway in the instance settings"
      );
      return false;
    }
    if (localKey.length !== LOCAL_KEY_LENGTH) {
      this.log.error(
        `[cfg] The local key must have exactly ${LOCAL_KEY_LENGTH} characters (configured: ${localKey.length}), please correct it in the instance settings`
      );
      return false;
    }
    this.log.info(
      `[cfg] Gateway ${deviceId}, IP ${this.ip || "automatic (UDP discovery)"}, Tuya protocol ${this.protocolVersion}, reconnect delay ${(0, import_logging.formatDuration)(this.reconnectDelayMs)}, status refresh ${this.pollDelayMs ? (0, import_logging.formatDuration)(this.pollDelayMs) : "off"}, local key ${localKey.length} characters (hidden)`
    );
    this.log.debug(`[cfg] Log level ${this.log.level}, node ${process.version}`);
    return true;
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback - Callback function
   */
  onUnload(callback) {
    var _a;
    try {
      this.unloading = true;
      this.log.debug(
        `[unload] Stopping: ${this.activeDiscoveries.size} discovery run(s), ${this.commandQueue.length} pending command(s), connection ${this.gatewayConnected ? "open" : "closed"}`
      );
      this.clearReconnectTimer();
      this.clearPollTimer();
      this.clearStableTimer();
      if (this.flushTimer) {
        this.clearTimeout(this.flushTimer);
        this.flushTimer = void 0;
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
      (_a = this.restoreTuyapiDebug) == null ? void 0 : _a.call(this);
      this.restoreTuyapiDebug = void 0;
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
  onStateChange(id, state) {
    if (!state || state.ack || this.unloading) {
      return;
    }
    const localId = id.substring(this.namespace.length + 1);
    const seq = ++this.commandSeq;
    this.log.debug(
      `[cmd] #${seq} ${localId} = ${JSON.stringify(state.val)} (from ${state.from || "unknown"}${state.user ? `, ${state.user}` : ""})`
    );
    this.handleCommand(seq, localId, state.val).catch((error) => {
      this.log.warn(`[cmd] #${seq} ${localId} = ${JSON.stringify(state.val)} not executed: ${errorText(error)}`);
      this.log.debug(`[cmd] #${seq} ${errorStack(error)}`);
    });
  }
  /**
   * Handles the "discover" request of the "Search gateway" button in the instance settings.
   *
   * @param obj - message from the admin UI
   */
  async onMessage(obj) {
    if (!(obj == null ? void 0 : obj.callback)) {
      return;
    }
    if (obj.command !== "discover") {
      this.log.debug(`[disc] Ignoring unknown message "${obj.command}" from ${obj.from}`);
      return;
    }
    const message = obj.message;
    const wantedId = typeof (message == null ? void 0 : message.deviceId) === "string" ? message.deviceId.trim() : "";
    this.log.debug(`[disc] Search requested by ${obj.from} for ${wantedId ? `device ${wantedId}` : "all devices"}`);
    let response;
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
  async connectGateway() {
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
      `[conn] Attempt #${this.connectAttempt}: connecting to ${this.ip}:${TUYA_PORT} (Tuya protocol ${this.protocolVersion}, ${this.failedAttempts} failure(s) before)`
    );
    try {
      await this.connectWithTimeout(this.device);
    } catch (error) {
      this.onConnectionProblem(
        `attempt #${this.connectAttempt} after ${(0, import_logging.formatDuration)(Date.now() - this.connectStartedAt)}: ${errorText(error)}`
      );
    }
  }
  createTuyaDevice() {
    this.log.debug(`[conn] Creating tuyapi instance for ${this.ip} (protocol ${this.protocolVersion})`);
    const device = new import_tuyapi.default({
      id: String(this.config.deviceId).trim(),
      key: String(this.config.localKey),
      ip: this.ip,
      version: this.protocolVersion,
      issueGetOnConnect: true
    });
    device.on("connected", () => void this.onConnected());
    device.on("disconnected", () => void this.onDisconnected());
    device.on("error", (error) => this.onDeviceError(error));
    device.on("heartbeat", () => this.log.silly("[conn] Heartbeat answered by gateway"));
    device.on(
      "data",
      (data, commandByte, sequenceN) => void this.onData("data", data, commandByte, sequenceN)
    );
    device.on(
      "dp-refresh",
      (data, commandByte, sequenceN) => void this.onData("dp-refresh", data, commandByte, sequenceN)
    );
    return device;
  }
  /**
   * Discards the tuyapi instance. tuyapi reconnects implicitly for pending requests, so connect() of the
   * discarded instance is disabled to make sure it can never occupy the single local connection again.
   *
   * @param reason - why the instance is discarded (for the log)
   */
  destroyTuyaDevice(reason) {
    var _a;
    const device = this.device;
    if (!device) {
      return;
    }
    this.log.debug(`[conn] Discarding tuyapi instance (${reason})`);
    this.device = void 0;
    device.removeAllListeners();
    device.on("error", () => {
    });
    device.connect = () => Promise.reject(new Error("connection closed by adapter"));
    device.disconnect();
    (_a = device.client) == null ? void 0 : _a.destroy();
  }
  connectWithTimeout(device) {
    return new Promise((resolve, reject) => {
      const timer = this.setTimeout(() => {
        this.destroyTuyaDevice(`no answer within ${(0, import_logging.formatDuration)(CONNECT_TIMEOUT_MS)}`);
        reject(new Error(`no answer within ${(0, import_logging.formatDuration)(CONNECT_TIMEOUT_MS)}`));
      }, CONNECT_TIMEOUT_MS);
      device.connect().then(
        () => {
          this.clearTimeout(timer);
          resolve();
        },
        (error) => {
          this.clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    });
  }
  async onConnected() {
    if (this.unloading) {
      return;
    }
    this.gatewayConnected = true;
    this.connectedAt = Date.now();
    this.clearReconnectTimer();
    const text = `[conn] Connected to WL-433 gateway at ${this.ip} (Tuya protocol ${this.protocolVersion})`;
    if (this.failedAttempts) {
      this.log.debug(`${text} \u2013 waiting ${(0, import_logging.formatDuration)(SHORT_CONNECTION_MS)} to see if it stays up`);
    } else {
      this.log.info(text);
    }
    this.log.debug(
      `[conn] Attempt #${this.connectAttempt} succeeded after ${(0, import_logging.formatDuration)(this.connectedAt - this.connectStartedAt)}`
    );
    this.clearStableTimer();
    this.stableTimer = this.setTimeout(() => this.onConnectionStable(), SHORT_CONNECTION_MS);
    await this.setState("info.connection", true, true);
    this.schedulePoll();
  }
  onConnectionStable() {
    this.stableTimer = void 0;
    if (this.failedAttempts) {
      this.log.info(
        `[conn] Connection to WL-433 gateway at ${this.ip} is stable again (after ${this.failedAttempts} failed attempt(s))`
      );
    } else {
      this.log.debug(`[conn] Connection stable for ${(0, import_logging.formatDuration)(SHORT_CONNECTION_MS)}`);
    }
    this.failedAttempts = 0;
    this.problemReported = false;
  }
  clearStableTimer() {
    if (this.stableTimer) {
      this.clearTimeout(this.stableTimer);
      this.stableTimer = void 0;
    }
  }
  async onDisconnected() {
    const wasConnected = this.gatewayConnected;
    const duration = Date.now() - this.connectedAt;
    this.gatewayConnected = false;
    this.clearPollTimer();
    this.clearStableTimer();
    if (this.unloading) {
      return;
    }
    this.log.debug(
      `[conn] tuyapi reports disconnect (was connected: ${wasConnected}${wasConnected ? `, for ${(0, import_logging.formatDuration)(duration)}` : ""})`
    );
    await this.setState("info.connection", false, true);
    if (this.commandQueue.length) {
      this.log.warn(
        `[queue] Connection lost, ${this.commandQueue.length} pending command(s) ${seqList(this.commandQueue)} discarded`
      );
      this.commandQueue = [];
    }
    if (!wasConnected) {
      return;
    }
    if (duration < SHORT_CONNECTION_MS) {
      this.onConnectionProblem(
        `gateway closed the connection right after it was established (after ${(0, import_logging.formatDuration)(duration)})`
      );
      return;
    }
    this.log.info(
      `[conn] Connection to gateway ${this.ip} lost after ${(0, import_logging.formatDuration)(duration)}, reconnecting in ${(0, import_logging.formatDuration)(this.reconnectDelayMs)}`
    );
    this.scheduleReconnect("connection lost");
  }
  onConnectionProblem(reason) {
    var _a;
    if (this.unloading) {
      return;
    }
    this.failedAttempts++;
    const retry = `retrying in ${(0, import_logging.formatDuration)(this.reconnectDelayMs)}`;
    if (this.failedAttempts >= FAILURES_BEFORE_HINT && !this.problemReported) {
      this.problemReported = true;
      this.log.warn(
        `[conn] Cannot keep a connection to the WL-433 gateway at ${this.ip} (${reason}). Please check the IP address, the local key and the protocol version. Tuya devices accept only ONE local connection: close the MiBoxer / Smart Life app on phones in the same network and stop other local integrations (ioBroker.tuya, Home Assistant, tinytuya) for this gateway. ${retry}`
      );
    } else if (this.failedAttempts === 1) {
      this.log.info(`[conn] Connection to gateway ${this.ip} failed (${reason}), ${retry}`);
    } else {
      this.log.debug(
        `[conn] Connection to gateway ${this.ip} failed again (${reason}), failure ${this.failedAttempts}, ${retry}`
      );
    }
    if (!String((_a = this.config.ip) != null ? _a : "").trim() && this.failedAttempts % FAILURES_BEFORE_HINT === 0) {
      this.log.debug(
        `[conn] ${this.failedAttempts} failures with the discovered IP ${this.ip}, searching the gateway again`
      );
      this.ip = "";
      this.destroyTuyaDevice("IP will be searched again");
    }
    this.scheduleReconnect("connection problem");
  }
  onDeviceError(error) {
    if (!this.unloading) {
      this.log.debug(`[conn] tuyapi error event: ${(0, import_logging.redact)(errorText(error), this.secrets)}`);
    }
  }
  scheduleReconnect(reason) {
    if (this.unloading) {
      return;
    }
    this.clearReconnectTimer();
    this.log.debug(`[conn] Next connection attempt in ${(0, import_logging.formatDuration)(this.reconnectDelayMs)} (${reason})`);
    this.reconnectTimer = this.setTimeout(() => {
      this.reconnectTimer = void 0;
      void this.connectGateway();
    }, this.reconnectDelayMs);
  }
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      this.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = void 0;
    }
  }
  schedulePoll() {
    this.clearPollTimer();
    if (!this.pollDelayMs || this.unloading) {
      return;
    }
    this.pollTimer = this.setTimeout(() => {
      this.pollTimer = void 0;
      void this.pollStatus();
    }, this.pollDelayMs);
  }
  clearPollTimer() {
    if (this.pollTimer) {
      this.clearTimeout(this.pollTimer);
      this.pollTimer = void 0;
    }
  }
  /** Requests the complete status, the answer arrives as "data" event */
  async pollStatus() {
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
        this.log.debug(`[poll] Status answered after ${(0, import_logging.formatDuration)(Date.now() - started)}`);
      } catch (error) {
        this.log.debug(
          `[poll] Status request failed after ${(0, import_logging.formatDuration)(Date.now() - started)}: ${errorText(error)}`
        );
      }
    }
    if (this.gatewayConnected) {
      this.schedulePoll();
    }
  }
  // ------------------------------------------------------------------ discovery
  async resolveIpByDiscovery() {
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
    const match = devices.find((device) => device.id === deviceId);
    if (!match) {
      const others = devices.length ? ` Other Tuya devices found: ${describeDevices(devices)}.` : "";
      const text = `[disc] Gateway ${deviceId} did not announce itself in the local network.${others} Retrying in ${(0, import_logging.formatDuration)(this.reconnectDelayMs)}, alternatively enter the IP address in the instance settings.`;
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
        `[disc] Gateway announces Tuya protocol ${match.version}, using it instead of the configured ${this.protocolVersion}`
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
  discover(durationMs, stopOnId) {
    return new Promise((resolve) => {
      const found = /* @__PURE__ */ new Map();
      const started = Date.now();
      let broadcasts = 0;
      const run = {
        finished: false
      };
      const finish = () => {
        var _a;
        if (run.finished) {
          return;
        }
        run.finished = true;
        this.clearTimeout(run.timer);
        (_a = run.discovery) == null ? void 0 : _a.stop();
        this.activeDiscoveries.delete(finish);
        this.log.debug(
          `[disc] Finished after ${(0, import_logging.formatDuration)(Date.now() - started)}: ${broadcasts} broadcast(s), ${found.size} device(s)${found.size ? ` \u2013 ${describeDevices([...found.values()])}` : ""}`
        );
        resolve([...found.values()]);
      };
      run.discovery = new import_discovery.TuyaDiscovery(
        (device) => {
          broadcasts++;
          if (!found.has(device.id)) {
            this.log.debug(
              `[disc] Broadcast from ${device.id} at ${device.ip} (protocol ${device.version}${device.productKey ? `, product key ${device.productKey}` : ""})`
            );
          }
          found.set(device.id, device);
          if (stopOnId && device.id === stopOnId) {
            finish();
          }
        },
        (port, error) => this.log.warn(`[disc] Cannot listen on UDP port ${port}: ${error.message}`)
      );
      this.activeDiscoveries.add(finish);
      this.log.debug(
        `[disc] Listening on UDP ${import_discovery.DISCOVERY_PORTS.join("/")} for up to ${(0, import_logging.formatDuration)(durationMs)}${stopOnId ? ` (stops when ${stopOnId} is seen)` : ""}`
      );
      run.discovery.start();
      run.timer = this.setTimeout(finish, durationMs);
    });
  }
  async handleDiscoverRequest(wantedId) {
    var _a;
    if (wantedId && wantedId === String((_a = this.config.deviceId) != null ? _a : "").trim() && this.gatewayConnected && this.ip) {
      this.log.debug(`[disc] ${wantedId} is the connected gateway, answering without search`);
      return {
        result: "found",
        args: [this.ip, this.protocolVersion],
        native: { ip: this.ip, protocolVersion: this.protocolVersion }
      };
    }
    const devices = await this.discover(DISCOVERY_DURATION_MS, wantedId || void 0);
    if (!devices.length) {
      return { error: "noneFound" };
    }
    if (!wantedId) {
      return { result: "list", args: [describeDevices(devices)], native: {} };
    }
    const match = devices.find((device) => device.id === wantedId);
    if (!match) {
      return { error: "notFoundOthers", args: [wantedId, describeDevices(devices)] };
    }
    const version = PROTOCOL_VERSIONS.includes(match.version) ? match.version : this.protocolVersion;
    return { result: "found", args: [match.ip, version], native: { ip: match.ip, protocolVersion: version } };
  }
  // ------------------------------------------------------------------ gateway -> states
  async onData(event, data, commandByte, sequenceN) {
    var _a;
    if (this.unloading) {
      return;
    }
    const origin = `${event}, ${commandName(commandByte)}, sequence ${sequenceN != null ? sequenceN : "?"}`;
    const dps = data == null ? void 0 : data.dps;
    if (!dps || typeof dps !== "object") {
      if ((data === "" || data === false) && (commandByte === import_message_parser.CommandType.CONTROL || commandByte === import_message_parser.CommandType.CONTROL_NEW)) {
        this.log.debug(`[rx] Gateway acknowledged the command (${origin})`);
      } else if (typeof data === "string" && data && !this.undecodableReported) {
        this.undecodableReported = true;
        this.log.warn(
          `[rx] Gateway sent data that could not be decoded (${JSON.stringify(data.substring(0, 60))}, ${data.length} characters, ${origin}). Please check the local key and the protocol version (the WL-433 normally uses 3.3).`
        );
      } else {
        this.log.debug(
          `[rx] Ignoring gateway data without datapoints (${origin}): ${(0, import_logging.shorten)((_a = JSON.stringify(data)) != null ? _a : String(data))}`
        );
      }
      return;
    }
    this.undecodableReported = false;
    this.log.debug(`[rx] ${origin}: ${(0, import_logging.shorten)(JSON.stringify(dps), 500)}`);
    try {
      await this.applyDps(dps);
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
  unexpectedValue(dp, value, expected) {
    const text = `[rx] DP ${dp} = ${JSON.stringify(value)} is not ${expected}, ignored`;
    if (this.unexpectedDps.has(dp)) {
      this.log.debug(text);
    } else {
      this.unexpectedDps.add(dp);
      this.log.warn(
        `${text}. Please report this value at https://github.com/ssbingo/ioBroker.miboxer-wl433/issues`
      );
    }
  }
  async setMapped(dp, value, stateId, stateValue) {
    this.log.debug(`[rx] DP ${dp} = ${JSON.stringify(value)} -> ${stateId} = ${JSON.stringify(stateValue)}`);
    await this.setStateChangedAsync(stateId, stateValue, true);
  }
  async applyDps(dps) {
    Object.assign(this.dpCache, dps);
    for (const [dp, value] of Object.entries(dps)) {
      switch (dp) {
        case import_objects.DP.SWITCH:
          if (typeof value === "boolean") {
            await this.setMapped(dp, value, "light.on", value);
          } else {
            this.unexpectedValue(dp, value, "a boolean");
          }
          break;
        case import_objects.DP.MODE:
          if (typeof value === "string") {
            await this.setMapped(dp, value, "light.mode", value);
          } else {
            this.unexpectedValue(dp, value, "a string");
          }
          break;
        case import_objects.DP.BRIGHTNESS:
          if (typeof value !== "number") {
            this.unexpectedValue(dp, value, "a number");
          }
          break;
        case import_objects.DP.TEMPERATURE:
          if (typeof value === "number") {
            await this.setMapped(dp, value, "light.colorTemperature", (0, import_color.rawToKelvin)(value));
          } else {
            this.unexpectedValue(dp, value, "a number");
          }
          break;
        case import_objects.DP.COLOUR: {
          const hsv = (0, import_color.parseTuyaHsv)(value);
          if (hsv) {
            await this.setMapped(dp, value, "light.color", (0, import_color.tuyaHsvToRgbHex)(hsv));
          } else {
            this.unexpectedValue(dp, value, 'a colour "hhhhssssvvvv"');
          }
          break;
        }
        case import_objects.DP.COUNTDOWN:
          if (typeof value === "number") {
            await this.setMapped(dp, value, "light.countdown", value);
          } else {
            this.unexpectedValue(dp, value, "a number");
          }
          break;
        case import_objects.DP.RAW_FRAME:
          await this.onDp101Received(value);
          break;
        default:
          await this.updateRawDatapoint(dp, value);
      }
    }
    if (import_objects.DP.MODE in dps || import_objects.DP.BRIGHTNESS in dps || import_objects.DP.COLOUR in dps) {
      const brightness = this.currentBrightnessPercent();
      if (brightness !== void 0) {
        const source = this.dpCache[import_objects.DP.MODE] === "colour" && (0, import_color.parseTuyaHsv)(this.dpCache[import_objects.DP.COLOUR]) ? `v of DP 24 (mode colour)` : `DP 22 (mode ${JSON.stringify(this.dpCache[import_objects.DP.MODE])})`;
        this.log.debug(`[rx] light.brightness = ${brightness} % from ${source}`);
        await this.setStateChangedAsync("light.brightness", brightness, true);
      }
    }
  }
  currentBrightnessPercent() {
    if (this.dpCache[import_objects.DP.MODE] === "colour") {
      const hsv = (0, import_color.parseTuyaHsv)(this.dpCache[import_objects.DP.COLOUR]);
      if (hsv) {
        return (0, import_color.rawToPercent)(hsv.v);
      }
    }
    const raw = this.dpCache[import_objects.DP.BRIGHTNESS];
    return typeof raw === "number" ? (0, import_color.rawToPercent)(raw) : void 0;
  }
  async onDp101Received(value) {
    if (typeof value !== "string") {
      this.unexpectedValue(import_objects.DP.RAW_FRAME, value, "a Base64 string");
      return;
    }
    this.lastDp101RxAt = Date.now();
    let frame;
    try {
      frame = (0, import_dp101.decodeDp101)(value);
    } catch {
      this.log.debug(`[dp101] Received value ${JSON.stringify(value)} is not Base64, stored unchanged`);
      await this.setState("dp101.raw", value, true);
      return;
    }
    this.log.debug(
      `[dp101] Received ${frame.hex} (${frame.bytes.length} bytes, checksum ${frame.checksumValid ? "valid" : "INVALID"}, Base64 ${frame.base64})`
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
  async confirmSentFrame(seq, frame, sentAt) {
    if (this.lastDp101RxAt < sentAt) {
      this.log.debug(`[dp101] #${seq} no answer frame yet, showing the sent frame in dp101.raw/hex`);
      await this.setDp101States(frame);
    } else {
      this.log.debug(
        `[dp101] #${seq} answer frame arrived ${(0, import_logging.formatDuration)(this.lastDp101RxAt - sentAt)} after sending, keeping it in dp101.raw/hex`
      );
    }
    await this.addToHistory(frame, "tx", sentAt);
  }
  async setDp101States(frame) {
    await this.setState("dp101.raw", frame.base64, true);
    await this.setState("dp101.hex", frame.hex, true);
    await this.setState("dp101.checksumValid", frame.checksumValid, true);
  }
  async addToHistory(frame, dir, time) {
    const entry = {
      ts: new Date(time).toISOString(),
      dir,
      base64: frame.base64,
      hex: frame.hex,
      checksumValid: frame.checksumValid
    };
    const index = this.dp101History.findIndex((existing) => {
      const existingTime = Date.parse(existing.ts);
      return existingTime > time || existingTime === time && existing.dir === "rx";
    });
    if (index === -1) {
      this.dp101History.push(entry);
    } else {
      this.dp101History.splice(index, 0, entry);
    }
    if (this.dp101History.length > import_objects.DP101_HISTORY_LENGTH) {
      this.dp101History.splice(0, this.dp101History.length - import_objects.DP101_HISTORY_LENGTH);
    }
    await this.setState("dp101.history", JSON.stringify(this.dp101History), true);
  }
  async restoreHistory() {
    const state = await this.getStateAsync("dp101.history");
    if (typeof (state == null ? void 0 : state.val) !== "string") {
      this.log.debug("[dp101] No stored history");
      return;
    }
    try {
      const parsed = JSON.parse(state.val);
      if (Array.isArray(parsed)) {
        this.dp101History = parsed.filter((entry) => entry && typeof entry === "object").slice(-import_objects.DP101_HISTORY_LENGTH);
      }
      this.log.debug(`[dp101] Restored ${this.dp101History.length} history entries`);
    } catch (error) {
      this.log.debug(
        `[dp101] Stored history is not valid JSON (${errorText(error)}), starting with an empty history`
      );
    }
  }
  async updateRawDatapoint(dp, value) {
    if (!/^\d+$/.test(dp)) {
      this.log.debug(`[rx] Ignoring datapoint with non-numeric key ${JSON.stringify(dp)}`);
      return;
    }
    const val = typeof value === "boolean" || typeof value === "number" || typeof value === "string" ? value : JSON.stringify(value);
    const id = `raw.dp${dp}`;
    if (!this.rawTypes.has(dp)) {
      const type = typeof val;
      await this.extendObject(id, {
        type: "state",
        common: {
          name: { en: `Datapoint ${dp}`, de: `Datenpunkt ${dp}` },
          type,
          role: type === "boolean" ? "switch" : type === "number" ? "level" : "text",
          read: true,
          write: true
        },
        native: { dp: Number(dp) }
      });
      this.rawTypes.set(dp, type);
      this.log.debug(`[rx] Datapoint ${dp} (${type}) is not mapped, stored in ${id}`);
    }
    this.log.debug(`[rx] DP ${dp} = ${JSON.stringify(value)} -> ${id}`);
    await this.setStateChangedAsync(id, val, true);
  }
  // ------------------------------------------------------------------ states -> gateway
  async handleCommand(seq, id, val) {
    switch (id) {
      case "light.on":
        this.enqueue(seq, id, { [import_objects.DP.SWITCH]: toBoolean(val) });
        return;
      case "light.mode": {
        const mode = String(val);
        if (!import_objects.LIGHT_MODES.includes(mode)) {
          throw new Error(`unknown mode, allowed: ${import_objects.LIGHT_MODES.join(", ")}`);
        }
        this.enqueue(seq, id, { [import_objects.DP.MODE]: mode });
        return;
      }
      case "light.brightness":
        this.enqueue(seq, id, this.brightnessCommand(seq, toNumber(val)));
        return;
      case "light.colorTemperature": {
        const kelvin = toNumber(val);
        const raw = (0, import_color.kelvinToRaw)(kelvin);
        this.log.debug(`[cmd] #${seq} ${kelvin} K -> DP 23 = ${raw} (switches to white mode)`);
        this.enqueue(seq, id, { [import_objects.DP.MODE]: "white", [import_objects.DP.TEMPERATURE]: raw });
        return;
      }
      case "light.color": {
        const hsv = (0, import_color.rgbHexToTuyaHsv)(String(val));
        if (!hsv) {
          throw new Error('a colour like "#ff8800" is expected');
        }
        const colour = (0, import_color.formatTuyaHsv)(hsv);
        this.log.debug(
          `[cmd] #${seq} ${String(val)} -> h ${hsv.h}, s ${hsv.s}, v ${hsv.v} -> DP 24 = "${colour}" (switches to colour mode)`
        );
        this.enqueue(seq, id, { [import_objects.DP.MODE]: "colour", [import_objects.DP.COLOUR]: colour });
        return;
      }
      case "light.countdown":
        this.enqueue(seq, id, { [import_objects.DP.COUNTDOWN]: Math.round(clamp(toNumber(val), 0, import_objects.COUNTDOWN_MAX)) });
        return;
      case "dp101.raw": {
        const frame = (0, import_dp101.decodeDp101)(String(val));
        this.log.debug(
          `[dp101] #${seq} sending Base64 as given: ${frame.hex} (checksum ${frame.checksumValid ? "valid" : "INVALID"})`
        );
        this.enqueueFrame(seq, id, frame);
        return;
      }
      case "dp101.hex": {
        const { frame, corrected } = (0, import_dp101.encodeDp101Hex)(String(val));
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
  brightnessCommand(seq, percent) {
    if (percent <= 0) {
      this.log.debug(`[cmd] #${seq} brightness ${percent} % -> switch off (DP 20 = false)`);
      return { [import_objects.DP.SWITCH]: false };
    }
    const dps = {};
    if (this.dpCache[import_objects.DP.SWITCH] === false) {
      dps[import_objects.DP.SWITCH] = true;
    }
    const hsv = this.dpCache[import_objects.DP.MODE] === "colour" ? (0, import_color.parseTuyaHsv)(this.dpCache[import_objects.DP.COLOUR]) : null;
    if (hsv) {
      dps[import_objects.DP.COLOUR] = (0, import_color.formatTuyaHsv)({ ...hsv, v: (0, import_color.percentToRaw)(percent) });
    } else {
      dps[import_objects.DP.BRIGHTNESS] = (0, import_color.percentToRaw)(percent);
    }
    this.log.debug(
      `[cmd] #${seq} brightness ${percent} % -> ${hsv ? "v of DP 24 (mode colour)" : `DP 22 (mode ${JSON.stringify(this.dpCache[import_objects.DP.MODE])})`}${dps[import_objects.DP.SWITCH] ? ", lights are off -> also DP 20 = true" : ""}`
    );
    return dps;
  }
  async handleRawCommand(seq, id, val) {
    var _a;
    const dp = id.substring("raw.dp".length);
    let type = this.rawTypes.get(dp);
    if (!type) {
      const obj = await this.getObjectAsync(id);
      type = (_a = obj == null ? void 0 : obj.common) == null ? void 0 : _a.type;
      this.log.debug(`[cmd] #${seq} type of ${id} read from its object: ${type != null ? type : "unknown"}`);
    }
    let value;
    if (type === "boolean") {
      value = toBoolean(val);
    } else if (type === "number") {
      value = toNumber(val);
    } else {
      value = String(val);
    }
    this.enqueue(seq, id, { [dp]: value });
  }
  enqueueFrame(seq, source, frame) {
    this.enqueue(
      seq,
      source,
      { [import_objects.DP.RAW_FRAME]: frame.base64 },
      (sentAt) => this.confirmSentFrame(seq, frame, sentAt)
    );
  }
  enqueue(seq, source, dps, onSuccess) {
    if (!this.device || !this.gatewayConnected) {
      throw new Error("gateway is not connected");
    }
    if (this.commandQueue.length >= MAX_QUEUED_COMMANDS) {
      const dropped = this.commandQueue.shift();
      this.log.warn(
        `[queue] More than ${MAX_QUEUED_COMMANDS} pending commands, dropping the oldest #${dropped == null ? void 0 : dropped.seq} ${dropped == null ? void 0 : dropped.source} ${JSON.stringify(dropped == null ? void 0 : dropped.dps)}`
      );
    }
    this.commandQueue.push({ seq, source, dps, queuedAt: Date.now(), onSuccess });
    this.log.debug(
      `[queue] #${seq} queued ${JSON.stringify(dps)} (${this.commandQueue.length} pending${this.sending ? ", a command is being sent" : ""})`
    );
    this.scheduleFlush();
  }
  scheduleFlush() {
    if (this.sending || this.flushTimer || this.unloading) {
      return;
    }
    this.flushTimer = this.setTimeout(() => {
      this.flushTimer = void 0;
      void this.flushQueue();
    }, COMMAND_DEBOUNCE_MS);
  }
  /**
   * Takes the next command from the queue and merges following commands into it. DP 101 frames are never
   * merged: every frame is a separate command for the gateway.
   */
  takeBatch() {
    const batch = [];
    while (this.commandQueue.length) {
      const next = this.commandQueue[0];
      const isFrame = import_objects.DP.RAW_FRAME in next.dps;
      if (batch.length && (isFrame || import_objects.DP.RAW_FRAME in batch[0].dps)) {
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
  async flushQueue() {
    var _a;
    const device = this.device;
    if (this.sending || !device || !this.gatewayConnected || !this.commandQueue.length) {
      return;
    }
    const batch = this.takeBatch();
    const data = Object.assign({}, ...batch.map((command) => command.dps));
    const ids = seqList(batch);
    this.sending = true;
    const sentAt = Date.now();
    try {
      this.log.debug(
        `[queue] Sending ${ids} to gateway: ${JSON.stringify(data)}${batch.length > 1 ? ` (${batch.length} commands merged)` : ""}, waited ${(0, import_logging.formatDuration)(sentAt - batch[0].queuedAt)} in queue`
      );
      await device.set({ multiple: true, data });
      this.log.debug(`[queue] ${ids} confirmed by gateway after ${(0, import_logging.formatDuration)(Date.now() - sentAt)}`);
      for (const command of batch) {
        await ((_a = command.onSuccess) == null ? void 0 : _a.call(command, sentAt));
      }
    } catch (error) {
      this.log.warn(
        `[queue] Gateway did not confirm ${ids} ${JSON.stringify(data)} within ${(0, import_logging.formatDuration)(Date.now() - sentAt)}: ${(0, import_logging.redact)(errorText(error), this.secrets)}`
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
  module.exports = (options) => new MiboxerWl433(options);
} else {
  (() => new MiboxerWl433())();
}
//# sourceMappingURL=main.js.map
