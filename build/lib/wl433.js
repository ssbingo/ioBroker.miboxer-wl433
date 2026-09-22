"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var wl433_exports = {};
__export(wl433_exports, {
  COMMAND: () => COMMAND,
  DMX_ADDRESS_MAX: () => DMX_ADDRESS_MAX,
  DMX_ADDRESS_MIN: () => DMX_ADDRESS_MIN,
  FRAME_TYPE: () => FRAME_TYPE,
  KEY: () => KEY,
  SCENE_COUNT: () => SCENE_COUNT,
  ZONE_ALL: () => ZONE_ALL,
  ZONE_COUNT: () => ZONE_COUNT,
  buildCommand: () => buildCommand,
  buildDmxCommand: () => buildDmxCommand,
  buildStatusQuery: () => buildStatusQuery,
  describeCommand: () => describeCommand,
  describeStatus: () => describeStatus,
  parseDmxAnswer: () => parseDmxAnswer,
  parseStatus: () => parseStatus
});
module.exports = __toCommonJS(wl433_exports);
var import_dp101 = require("./dp101");
const FRAME_TYPE = {
  COMMAND: 65,
  REPORT: 66,
  QUERY: 67,
  ANSWER: 68,
  DMX: 73
};
const DMX_ADDRESS_MIN = 1;
const DMX_ADDRESS_MAX = 512;
const COMMAND = {
  HUE: 1,
  BRIGHTNESS: 2,
  TEMPERATURE: 3,
  SATURATION: 4,
  SCENE: 5,
  KEY: 6
};
const KEY = {
  ON: 1,
  OFF: 2,
  SPEED_DOWN: 3,
  SPEED_UP: 4,
  WHITE: 6
};
const ZONE_ALL = 0;
const ZONE_COUNT = 8;
const SCENE_COUNT = 9;
const SCENE_MODE_OFFSET = 2;
const COMMAND_NAMES = {
  [COMMAND.HUE]: "hue",
  [COMMAND.BRIGHTNESS]: "brightness",
  [COMMAND.TEMPERATURE]: "colour temperature step",
  [COMMAND.SATURATION]: "saturation",
  [COMMAND.SCENE]: "scene",
  [COMMAND.KEY]: "key"
};
const KEY_NAMES = {
  [KEY.ON]: "on",
  [KEY.OFF]: "off",
  [KEY.SPEED_DOWN]: "speed down (S-)",
  [KEY.SPEED_UP]: "speed up (S+)",
  [KEY.WHITE]: "white mode",
  5: "off variant 05"
};
function byte(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}, got ${value}`);
  }
  return value;
}
function describeCommand(command, value, zone) {
  var _a, _b;
  const target = zone === ZONE_ALL ? "all zones" : `zone ${zone}`;
  const name = (_a = COMMAND_NAMES[command]) != null ? _a : `command 0x${command.toString(16)}`;
  const shown = command === COMMAND.KEY ? (_b = KEY_NAMES[value]) != null ? _b : `0x${value.toString(16)}` : String(value);
  return `${name} ${shown} (${target})`;
}
function buildCommand(command, value, zone) {
  byte(zone, "zone", ZONE_ALL, ZONE_COUNT);
  switch (command) {
    case COMMAND.HUE:
      byte(value, "hue", 0, 255);
      break;
    case COMMAND.BRIGHTNESS:
      byte(value, "brightness", 1, 100);
      break;
    case COMMAND.TEMPERATURE:
      byte(value, "colour temperature step", 0, 38);
      break;
    case COMMAND.SATURATION:
      byte(value, "saturation", 0, 100);
      break;
    case COMMAND.SCENE:
      byte(value, "scene", 1, SCENE_COUNT);
      break;
    case COMMAND.KEY:
      if (!Object.values(KEY).includes(value)) {
        throw new RangeError(`unknown key 0x${value.toString(16)}`);
      }
      break;
    default:
      throw new RangeError(`unknown command 0x${command.toString(16)}`);
  }
  const extra = command === COMMAND.HUE ? value : 0;
  return (0, import_dp101.buildDp101Frame)([FRAME_TYPE.COMMAND, 0, 0, 11, command, value, extra, extra, extra, zone, 128]);
}
function buildDmxCommand(address, zone) {
  byte(address, "DMX address", DMX_ADDRESS_MIN, DMX_ADDRESS_MAX);
  byte(zone, "zone", ZONE_ALL, ZONE_COUNT);
  return (0, import_dp101.buildDp101Frame)([
    FRAME_TYPE.DMX,
    0,
    0,
    11,
    2,
    address >> 8,
    address & 255,
    0,
    0,
    zone,
    128
  ]);
}
function parseDmxAnswer(frame) {
  const bytes = frame.bytes;
  if (!frame.checksumValid || bytes.length !== import_dp101.DP101_FRAME_LENGTH || bytes[0] !== FRAME_TYPE.DMX || bytes[5] !== 1) {
    return null;
  }
  const address = bytes[9] << 8 | bytes[10];
  return address >= DMX_ADDRESS_MIN && address <= DMX_ADDRESS_MAX ? address : null;
}
function buildStatusQuery() {
  return (0, import_dp101.buildDp101Frame)([FRAME_TYPE.QUERY, 0, 0, 128, 0, 0, 0, 0, 0, 128, 128]);
}
function parseStatus(frame) {
  const bytes = frame.bytes;
  if (!frame.checksumValid || bytes.length !== import_dp101.DP101_FRAME_LENGTH) {
    return null;
  }
  if (bytes[0] !== FRAME_TYPE.REPORT && bytes[0] !== FRAME_TYPE.ANSWER) {
    return null;
  }
  const modeByte = bytes[4];
  if (modeByte > SCENE_MODE_OFFSET + SCENE_COUNT) {
    return null;
  }
  let mode;
  let scene = 0;
  if (modeByte === 1) {
    mode = "colour";
  } else if (modeByte === 2) {
    mode = "white";
  } else if (modeByte > SCENE_MODE_OFFSET) {
    mode = "scene";
    scene = modeByte - SCENE_MODE_OFFSET;
  }
  return {
    type: bytes[0] === FRAME_TYPE.REPORT ? "report" : "answer",
    on: modeByte !== 0,
    mode,
    scene,
    hue: bytes[5],
    temperature: bytes[6],
    brightness: bytes[7],
    saturation: bytes[8],
    dmxLowByte: bytes[10],
    signature: bytes.subarray(1, 11).toString("hex")
  };
}
function describeStatus(status) {
  var _a;
  const mode = status.mode === "scene" ? `scene ${status.scene}` : (_a = status.mode) != null ? _a : "mode not reported";
  return `${status.on ? "on" : "off"}, ${mode}, hue ${status.hue}, colour temperature step ${status.temperature}, brightness ${status.brightness} %, saturation ${status.saturation} %`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  COMMAND,
  DMX_ADDRESS_MAX,
  DMX_ADDRESS_MIN,
  FRAME_TYPE,
  KEY,
  SCENE_COUNT,
  ZONE_ALL,
  ZONE_COUNT,
  buildCommand,
  buildDmxCommand,
  buildStatusQuery,
  describeCommand,
  describeStatus,
  parseDmxAnswer,
  parseStatus
});
//# sourceMappingURL=wl433.js.map
