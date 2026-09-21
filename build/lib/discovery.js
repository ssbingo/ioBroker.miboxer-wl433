"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var discovery_exports = {};
__export(discovery_exports, {
  DISCOVERY_PORTS: () => DISCOVERY_PORTS,
  TuyaDiscovery: () => TuyaDiscovery,
  parseBroadcast: () => parseBroadcast
});
module.exports = __toCommonJS(discovery_exports);
var dgram = __toESM(require("node:dgram"));
var import_config = require("tuyapi/lib/config");
var import_message_parser = require("tuyapi/lib/message-parser");
const DISCOVERY_PORTS = [6666, 6667];
const PARSE_VERSIONS = ["3.3", "3.5", "3.1"];
function parseBroadcast(message) {
  var _a;
  for (const version of PARSE_VERSIONS) {
    try {
      const parser = new import_message_parser.MessageParser({ key: import_config.UDP_KEY, version });
      const payload = (_a = parser.parse(message)[0]) == null ? void 0 : _a.payload;
      if (payload && typeof payload.gwId === "string" && typeof payload.ip === "string") {
        return {
          id: payload.gwId,
          ip: payload.ip,
          version: typeof payload.version === "string" ? payload.version : version,
          productKey: typeof payload.productKey === "string" ? payload.productKey : void 0
        };
      }
    } catch {
    }
  }
  return null;
}
class TuyaDiscovery {
  /**
   * @param onDevice - called for every received presence broadcast
   * @param onError - called if a port cannot be opened (e.g. already used exclusively by another program)
   */
  constructor(onDevice, onError) {
    this.onDevice = onDevice;
    this.onError = onError;
  }
  sockets = [];
  /** Opens the UDP listeners */
  start() {
    for (const port of DISCOVERY_PORTS) {
      const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
      socket.on("message", (message) => {
        const device = parseBroadcast(message);
        if (device) {
          this.onDevice(device);
        }
      });
      socket.on("error", (error) => {
        this.onError(port, error);
        this.closeSocket(socket);
      });
      socket.bind(port);
      this.sockets.push(socket);
    }
  }
  /** Closes all UDP listeners */
  stop() {
    for (const socket of [...this.sockets]) {
      this.closeSocket(socket);
    }
  }
  closeSocket(socket) {
    const index = this.sockets.indexOf(socket);
    if (index !== -1) {
      this.sockets.splice(index, 1);
    }
    socket.removeAllListeners("message");
    try {
      socket.close();
    } catch {
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DISCOVERY_PORTS,
  TuyaDiscovery,
  parseBroadcast
});
//# sourceMappingURL=discovery.js.map
