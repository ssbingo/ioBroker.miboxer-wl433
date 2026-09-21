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
var import_color = require("./lib/color");
var import_discovery = require("./lib/discovery");
var import_dp101 = require("./lib/dp101");
var import_objects = require("./lib/objects");
const PROTOCOL_VERSIONS = ["3.1", "3.3", "3.4", "3.5"];
const DEFAULT_PROTOCOL_VERSION = "3.3";
const LOCAL_KEY_LENGTH = 16;
const DISCOVERY_DURATION_MS = 12e3;
const CONNECT_TIMEOUT_MS = 15e3;
const SHORT_CONNECTION_MS = 1e4;
const FAILURES_BEFORE_HINT = 3;
const COMMAND_DEBOUNCE_MS = 150;
const MAX_QUEUED_COMMANDS = 50;
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
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
class MiboxerWl433 extends utils.Adapter {
  device;
  gatewayConnected = false;
  connectedAt = 0;
  unloading = false;
  ip = "";
  protocolVersion = DEFAULT_PROTOCOL_VERSION;
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
  commandQueue = [];
  dp101History = [];
  lastDp101RxAt = 0;
  /** Last known value of every datapoint reported by the gateway */
  dpCache = {};
  /** Value types of the dynamically created raw.dp<n> states */
  rawTypes = /* @__PURE__ */ new Map();
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
    var _a, _b, _c, _d;
    await this.setState("info.connection", false, true);
    for (const definition of import_objects.OBJECT_DEFINITIONS) {
      await this.extendObject(definition.id, definition.obj);
    }
    await this.restoreHistory();
    const deviceId = String((_a = this.config.deviceId) != null ? _a : "").trim();
    const localKey = String((_b = this.config.localKey) != null ? _b : "");
    const version = String((_c = this.config.protocolVersion) != null ? _c : "");
    this.protocolVersion = PROTOCOL_VERSIONS.includes(version) ? version : DEFAULT_PROTOCOL_VERSION;
    if (!deviceId) {
      this.log.error(
        "Adapter is not configured: please enter the device ID and the local key of the WL-433 gateway in the instance settings"
      );
      return;
    }
    if (localKey.length !== LOCAL_KEY_LENGTH) {
      this.log.error(
        `The local key must have exactly ${LOCAL_KEY_LENGTH} characters (configured: ${localKey.length}), please correct it in the instance settings`
      );
      return;
    }
    this.ip = String((_d = this.config.ip) != null ? _d : "").trim();
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
  onUnload(callback) {
    try {
      this.unloading = true;
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
  onStateChange(id, state) {
    if (!state || state.ack || this.unloading) {
      return;
    }
    const localId = id.substring(this.namespace.length + 1);
    this.handleCommand(localId, state.val).catch(
      (error) => this.log.warn(`Command ${localId} = ${JSON.stringify(state.val)} not executed: ${errorText(error)}`)
    );
  }
  /**
   * Handles the "discover" request of the "Search gateway" button in the instance settings.
   *
   * @param obj - message from the admin UI
   */
  async onMessage(obj) {
    if (!(obj == null ? void 0 : obj.callback) || obj.command !== "discover") {
      return;
    }
    const message = obj.message;
    const wantedId = typeof (message == null ? void 0 : message.deviceId) === "string" ? message.deviceId.trim() : "";
    let response;
    try {
      response = await this.handleDiscoverRequest(wantedId);
    } catch (error) {
      response = { error: errorText(error) };
    }
    this.sendTo(obj.from, obj.command, response, obj.callback);
  }
  // ------------------------------------------------------------------ connection
  get reconnectDelayMs() {
    const seconds = Number(this.config.reconnectInterval);
    return (Number.isFinite(seconds) && seconds >= 5 ? seconds : 30) * 1e3;
  }
  get pollDelayMs() {
    const seconds = Number(this.config.pollInterval);
    return Number.isFinite(seconds) && seconds > 0 ? Math.max(10, seconds) * 1e3 : 0;
  }
  async connectGateway() {
    var _a;
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
    (_a = this.device) != null ? _a : this.device = this.createTuyaDevice();
    this.log.debug(`Connecting to gateway ${this.ip} (Tuya protocol ${this.protocolVersion})`);
    try {
      await this.connectWithTimeout(this.device);
    } catch (error) {
      this.onConnectionProblem(errorText(error));
    }
  }
  createTuyaDevice() {
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
    device.on("data", (data) => void this.onData(data));
    device.on("dp-refresh", (data) => void this.onData(data));
    return device;
  }
  /**
   * Discards the tuyapi instance. tuyapi reconnects implicitly for pending requests, so connect() of the
   * discarded instance is disabled to make sure it can never occupy the single local connection again.
   */
  destroyTuyaDevice() {
    var _a;
    const device = this.device;
    if (!device) {
      return;
    }
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
        this.destroyTuyaDevice();
        reject(new Error(`no answer within ${CONNECT_TIMEOUT_MS / 1e3} s`));
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
    const text = `Connected to WL-433 gateway at ${this.ip} (Tuya protocol ${this.protocolVersion})`;
    if (this.failedAttempts) {
      this.log.debug(text);
    } else {
      this.log.info(text);
    }
    this.clearStableTimer();
    this.stableTimer = this.setTimeout(() => this.onConnectionStable(), SHORT_CONNECTION_MS);
    await this.setState("info.connection", true, true);
    this.schedulePoll();
  }
  onConnectionStable() {
    this.stableTimer = void 0;
    if (this.failedAttempts) {
      this.log.info(`Connection to WL-433 gateway at ${this.ip} is stable again`);
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
    this.log.info(`Connection to gateway ${this.ip} lost, reconnecting in ${this.reconnectDelayMs / 1e3} s`);
    this.scheduleReconnect();
  }
  onConnectionProblem(reason) {
    var _a;
    if (this.unloading) {
      return;
    }
    this.failedAttempts++;
    const retry = `retrying in ${this.reconnectDelayMs / 1e3} s`;
    if (this.failedAttempts >= FAILURES_BEFORE_HINT && !this.problemReported) {
      this.problemReported = true;
      this.log.warn(
        `Cannot keep a connection to the WL-433 gateway at ${this.ip} (${reason}). Please check the IP address, the local key and the protocol version. Tuya devices accept only ONE local connection: close the MiBoxer / Smart Life app on phones in the same network and stop other local integrations (ioBroker.tuya, Home Assistant, tinytuya) for this gateway. ${retry}`
      );
    } else if (this.failedAttempts === 1) {
      this.log.info(`Connection to gateway ${this.ip} failed (${reason}), ${retry}`);
    } else {
      this.log.debug(`Connection to gateway ${this.ip} failed (${reason}), ${retry}`);
    }
    if (!String((_a = this.config.ip) != null ? _a : "").trim() && this.failedAttempts % FAILURES_BEFORE_HINT === 0) {
      this.ip = "";
      this.destroyTuyaDevice();
    }
    this.scheduleReconnect();
  }
  onDeviceError(error) {
    if (!this.unloading) {
      this.log.debug(`Gateway: ${errorText(error)}`);
    }
  }
  scheduleReconnect() {
    if (this.unloading) {
      return;
    }
    this.clearReconnectTimer();
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
    const delay = this.pollDelayMs;
    if (!delay || this.unloading) {
      return;
    }
    this.pollTimer = this.setTimeout(() => {
      this.pollTimer = void 0;
      void this.pollStatus();
    }, delay);
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
  async resolveIpByDiscovery() {
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
    const match = devices.find((device) => device.id === deviceId);
    if (!match) {
      const others = devices.length ? ` Other Tuya devices found: ${describeDevices(devices)}.` : "";
      const text = `Gateway ${deviceId} did not announce itself in the local network.${others} Retrying in ${this.reconnectDelayMs / 1e3} s, alternatively enter the IP address in the instance settings.`;
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
        `Gateway announces Tuya protocol ${match.version}, using it instead of the configured ${this.protocolVersion}`
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
  discover(durationMs, stopOnId) {
    return new Promise((resolve) => {
      const found = /* @__PURE__ */ new Map();
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
        resolve([...found.values()]);
      };
      run.discovery = new import_discovery.TuyaDiscovery(
        (device) => {
          if (!found.has(device.id)) {
            this.log.debug(`Discovery: ${device.id} at ${device.ip} (protocol ${device.version})`);
          }
          found.set(device.id, device);
          if (stopOnId && device.id === stopOnId) {
            finish();
          }
        },
        (port, error) => this.log.warn(`Discovery: cannot listen on UDP port ${port}: ${error.message}`)
      );
      this.activeDiscoveries.add(finish);
      run.discovery.start();
      run.timer = this.setTimeout(finish, durationMs);
    });
  }
  async handleDiscoverRequest(wantedId) {
    var _a;
    if (wantedId && wantedId === String((_a = this.config.deviceId) != null ? _a : "").trim() && this.gatewayConnected && this.ip) {
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
  async onData(data) {
    if (this.unloading) {
      return;
    }
    const dps = data == null ? void 0 : data.dps;
    if (!dps || typeof dps !== "object") {
      if (typeof data === "string" && data && !this.undecodableReported) {
        this.undecodableReported = true;
        this.log.warn(
          `Gateway sent data that could not be decoded ("${data.substring(0, 60)}"). Please check the local key and the protocol version (the WL-433 normally uses 3.3).`
        );
      } else {
        this.log.debug(`Ignoring gateway data without datapoints: ${JSON.stringify(data)}`);
      }
      return;
    }
    this.undecodableReported = false;
    try {
      await this.applyDps(dps);
    } catch (error) {
      this.log.warn(`Cannot process data from gateway: ${errorText(error)}`);
    }
  }
  async applyDps(dps) {
    this.log.debug(`Datapoints from gateway: ${JSON.stringify(dps)}`);
    Object.assign(this.dpCache, dps);
    for (const [dp, value] of Object.entries(dps)) {
      switch (dp) {
        case import_objects.DP.SWITCH:
          if (typeof value === "boolean") {
            await this.setStateChangedAsync("light.on", value, true);
          }
          break;
        case import_objects.DP.MODE:
          if (typeof value === "string") {
            await this.setStateChangedAsync("light.mode", value, true);
          }
          break;
        case import_objects.DP.BRIGHTNESS:
          break;
        case import_objects.DP.TEMPERATURE:
          if (typeof value === "number") {
            await this.setStateChangedAsync("light.colorTemperature", (0, import_color.rawToKelvin)(value), true);
          }
          break;
        case import_objects.DP.COLOUR: {
          const hsv = (0, import_color.parseTuyaHsv)(value);
          if (hsv) {
            await this.setStateChangedAsync("light.color", (0, import_color.tuyaHsvToRgbHex)(hsv), true);
          }
          break;
        }
        case import_objects.DP.COUNTDOWN:
          if (typeof value === "number") {
            await this.setStateChangedAsync("light.countdown", value, true);
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
      this.log.debug(`DP 101: unexpected value ${JSON.stringify(value)}`);
      return;
    }
    this.lastDp101RxAt = Date.now();
    let frame;
    try {
      frame = (0, import_dp101.decodeDp101)(value);
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
  async confirmSentFrame(frame, sentAt) {
    if (this.lastDp101RxAt < sentAt) {
      await this.setDp101States(frame);
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
      return;
    }
    try {
      const parsed = JSON.parse(state.val);
      if (Array.isArray(parsed)) {
        this.dp101History = parsed.filter((entry) => entry && typeof entry === "object").slice(-import_objects.DP101_HISTORY_LENGTH);
      }
    } catch {
      this.log.debug("Stored dp101.history is not valid JSON, starting with an empty history");
    }
  }
  async updateRawDatapoint(dp, value) {
    if (!/^\d+$/.test(dp)) {
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
    }
    await this.setStateChangedAsync(id, val, true);
  }
  // ------------------------------------------------------------------ states -> gateway
  async handleCommand(id, val) {
    switch (id) {
      case "light.on":
        this.enqueue({ [import_objects.DP.SWITCH]: toBoolean(val) });
        return;
      case "light.mode": {
        const mode = String(val);
        if (!import_objects.LIGHT_MODES.includes(mode)) {
          throw new Error(`unknown mode, allowed: ${import_objects.LIGHT_MODES.join(", ")}`);
        }
        this.enqueue({ [import_objects.DP.MODE]: mode });
        return;
      }
      case "light.brightness":
        this.enqueue(this.brightnessCommand(toNumber(val)));
        return;
      case "light.colorTemperature":
        this.enqueue({ [import_objects.DP.MODE]: "white", [import_objects.DP.TEMPERATURE]: (0, import_color.kelvinToRaw)(toNumber(val)) });
        return;
      case "light.color": {
        const hsv = (0, import_color.rgbHexToTuyaHsv)(String(val));
        if (!hsv) {
          throw new Error('a colour like "#ff8800" is expected');
        }
        this.enqueue({ [import_objects.DP.MODE]: "colour", [import_objects.DP.COLOUR]: (0, import_color.formatTuyaHsv)(hsv) });
        return;
      }
      case "light.countdown":
        this.enqueue({ [import_objects.DP.COUNTDOWN]: Math.round(clamp(toNumber(val), 0, import_objects.COUNTDOWN_MAX)) });
        return;
      case "dp101.raw":
        this.enqueueFrame((0, import_dp101.decodeDp101)(String(val)));
        return;
      case "dp101.hex": {
        const { frame, corrected } = (0, import_dp101.encodeDp101Hex)(String(val));
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
  brightnessCommand(percent) {
    if (percent <= 0) {
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
    return dps;
  }
  async handleRawCommand(id, val) {
    var _a;
    const dp = id.substring("raw.dp".length);
    let type = this.rawTypes.get(dp);
    if (!type) {
      const obj = await this.getObjectAsync(id);
      type = (_a = obj == null ? void 0 : obj.common) == null ? void 0 : _a.type;
    }
    let value;
    if (type === "boolean") {
      value = toBoolean(val);
    } else if (type === "number") {
      value = toNumber(val);
    } else {
      value = String(val);
    }
    this.enqueue({ [dp]: value });
  }
  enqueueFrame(frame) {
    this.enqueue({ [import_objects.DP.RAW_FRAME]: frame.base64 }, (sentAt) => this.confirmSentFrame(frame, sentAt));
  }
  enqueue(dps, onSuccess) {
    if (!this.device || !this.gatewayConnected) {
      throw new Error("gateway is not connected");
    }
    if (this.commandQueue.length >= MAX_QUEUED_COMMANDS) {
      const dropped = this.commandQueue.shift();
      this.log.warn(`Too many pending commands, dropping ${JSON.stringify(dropped == null ? void 0 : dropped.dps)}`);
    }
    this.commandQueue.push({ dps, onSuccess });
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
    this.sending = true;
    try {
      this.log.debug(`Sending to gateway: ${JSON.stringify(data)}`);
      const sentAt = Date.now();
      await device.set({ multiple: true, data });
      for (const command of batch) {
        await ((_a = command.onSuccess) == null ? void 0 : _a.call(command, sentAt));
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
  module.exports = (options) => new MiboxerWl433(options);
} else {
  (() => new MiboxerWl433())();
}
//# sourceMappingURL=main.js.map
