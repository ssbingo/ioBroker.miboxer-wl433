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
var objects_exports = {};
__export(objects_exports, {
  BASE_OBJECTS: () => BASE_OBJECTS,
  COUNTDOWN_MAX: () => COUNTDOWN_MAX,
  DP: () => DP,
  DP101_HISTORY_LENGTH: () => DP101_HISTORY_LENGTH,
  LIGHT_MODES: () => LIGHT_MODES,
  STATUS_ONLY_DPS: () => STATUS_ONLY_DPS,
  ZONES_FOLDER: () => ZONES_FOLDER,
  ZONE_MODES: () => ZONE_MODES,
  lightChannel: () => lightChannel,
  zoneChannelId: () => zoneChannelId,
  zoneChannelObjects: () => zoneChannelObjects,
  zoneSelectorState: () => zoneSelectorState
});
module.exports = __toCommonJS(objects_exports);
var import_color = require("./color");
var import_object_names = require("./object-names");
var import_timers = require("./timers");
var import_wl433 = require("./wl433");
const DP = {
  /** switch_led (bool), derived by the gateway from DP 101 commands */
  SWITCH: "20",
  /** work_mode (enum white / colour / scene), reports "white" while the lights are off */
  MODE: "21",
  /** bright_value_v2 (10..1000), not updated by the gateway after a mode change */
  BRIGHTNESS: "22",
  /** temp_value_v2 (0..1000) */
  TEMPERATURE: "23",
  /** colour_data_v2 ("hhhhssssvvvv"), not used by the MiBoxer app, writing it does not set the colour */
  COLOUR: "24",
  /** countdown (0..86400 s) */
  COUNTDOWN: "26",
  /** vendor specific frames (Base64): commands, status query and status of lights, zones and scenes */
  RAW_FRAME: "101"
};
const STATUS_ONLY_DPS = /* @__PURE__ */ new Set([DP.MODE, DP.BRIGHTNESS, DP.TEMPERATURE, DP.COLOUR]);
const LIGHT_MODES = ["white", "colour", "scene"];
const ZONE_MODES = ["selector", "channels"];
const COUNTDOWN_MAX = 86400;
const DP101_HISTORY_LENGTH = 50;
const ZONES_FOLDER = "zones";
function state(id, common) {
  return { id, obj: { type: "state", common, native: {} } };
}
function channel(id, name) {
  return { id, obj: { type: "channel", common: { name }, native: {} } };
}
function zoneChannelId(zone) {
  return `${ZONES_FOLDER}.zone${zone}`;
}
function controlStates(prefix, withDefaults) {
  const sceneStates = { 0: "\u2013" };
  for (let scene = 1; scene <= import_wl433.SCENE_COUNT; scene++) {
    sceneStates[scene] = `M${scene}`;
  }
  const definitions = [
    state(`${prefix}.on`, {
      name: (0, import_object_names.objectName)("on"),
      type: "boolean",
      role: "switch.light",
      read: true,
      write: true,
      def: false
    }),
    state(`${prefix}.mode`, {
      name: (0, import_object_names.objectName)("mode"),
      type: "string",
      role: "text",
      read: true,
      write: true,
      def: "white",
      states: { white: "white", colour: "colour", scene: "scene" }
    }),
    state(`${prefix}.scene`, {
      name: (0, import_object_names.objectName)("scene"),
      type: "number",
      role: "level",
      read: true,
      write: true,
      min: 0,
      max: import_wl433.SCENE_COUNT,
      def: 0,
      states: sceneStates
    }),
    state(`${prefix}.brightness`, {
      name: (0, import_object_names.objectName)("brightness"),
      type: "number",
      role: "level.dimmer",
      read: true,
      write: true,
      min: 0,
      max: 100,
      unit: "%",
      def: 100
    }),
    state(`${prefix}.colorTemperature`, {
      name: (0, import_object_names.objectName)("colorTemperature"),
      type: "number",
      role: "level.color.temperature",
      read: true,
      write: true,
      min: import_color.KELVIN_WARM,
      max: import_color.KELVIN_COLD,
      step: import_color.KELVIN_STEP,
      unit: "K",
      def: import_color.KELVIN_COLD
    }),
    state(`${prefix}.color`, {
      name: (0, import_object_names.objectName)("color"),
      type: "string",
      role: "level.color.rgb",
      read: true,
      write: true,
      def: "#ffffff"
    }),
    state(`${prefix}.hue`, {
      name: (0, import_object_names.objectName)("hue"),
      type: "number",
      role: "level.color.hue",
      read: true,
      write: true,
      min: 0,
      max: 360,
      unit: "\xB0",
      def: 0
    }),
    state(`${prefix}.saturation`, {
      name: (0, import_object_names.objectName)("saturation"),
      type: "number",
      role: "level.color.saturation",
      read: true,
      write: true,
      min: 0,
      max: 100,
      unit: "%",
      def: 100
    }),
    state(`${prefix}.speedUp`, {
      name: (0, import_object_names.objectName)("speedUp"),
      type: "boolean",
      role: "button",
      read: false,
      write: true,
      def: false
    }),
    state(`${prefix}.speedDown`, {
      name: (0, import_object_names.objectName)("speedDown"),
      type: "boolean",
      role: "button",
      read: false,
      write: true,
      def: false
    })
  ];
  if (!withDefaults) {
    for (const definition of definitions) {
      delete definition.obj.common.def;
    }
  }
  return definitions;
}
const BASE_OBJECTS = [
  state("info.ip", {
    name: (0, import_object_names.objectName)("ip"),
    type: "string",
    role: "info.ip",
    read: true,
    write: false,
    def: ""
  }),
  ...controlStates("light", true),
  state("light.countdown", {
    name: (0, import_object_names.objectName)("countdown"),
    type: "number",
    role: "level.timer",
    read: true,
    write: true,
    min: 0,
    max: COUNTDOWN_MAX,
    unit: "s",
    def: 0
  }),
  channel("dp101", (0, import_object_names.objectName)("dp101")),
  state("dp101.raw", {
    name: (0, import_object_names.objectName)("dp101Raw"),
    type: "string",
    role: "text",
    read: true,
    write: true,
    def: ""
  }),
  state("dp101.hex", {
    name: (0, import_object_names.objectName)("dp101Hex"),
    type: "string",
    role: "text",
    read: true,
    write: true,
    def: ""
  }),
  state("dp101.checksumValid", {
    name: (0, import_object_names.objectName)("dp101ChecksumValid"),
    type: "boolean",
    role: "indicator",
    read: true,
    write: false,
    def: false
  }),
  state("dp101.history", {
    name: (0, import_object_names.objectName)("dp101History", DP101_HISTORY_LENGTH),
    type: "string",
    role: "json",
    read: true,
    write: false,
    def: "[]"
  }),
  channel("raw", (0, import_object_names.objectName)("raw")),
  channel("settings", (0, import_object_names.objectName)("settings")),
  state("settings.dmxAddress", {
    name: (0, import_object_names.objectName)("dmxAddress"),
    type: "number",
    role: "level",
    read: true,
    write: true,
    min: import_wl433.DMX_ADDRESS_MIN,
    max: import_wl433.DMX_ADDRESS_MAX
  }),
  channel("timers", (0, import_object_names.objectName)("timers")),
  state("timers.active", {
    name: (0, import_object_names.objectName)("timersActive"),
    type: "boolean",
    role: "switch.enable",
    read: true,
    write: true,
    def: true
  }),
  state("timers.nextRun", {
    name: (0, import_object_names.objectName)("timersNextRun"),
    type: "string",
    role: "text",
    read: true,
    write: false,
    def: ""
  }),
  state("timers.lastRun", {
    name: (0, import_object_names.objectName)("timersLastRun"),
    type: "string",
    role: "text",
    read: true,
    write: false,
    def: ""
  }),
  state("timers.overview", {
    name: (0, import_object_names.objectName)("timersOverview", import_timers.MAX_TIMERS),
    type: "string",
    role: "json",
    read: true,
    write: false,
    def: "[]"
  })
];
function lightChannel(zoneMode) {
  return channel("light", (0, import_object_names.objectName)(zoneMode === "selector" ? "lightSelector" : "lightAllZones"));
}
function zoneSelectorState() {
  const zoneStates = { 0: "all zones" };
  for (let zone = 1; zone <= import_wl433.ZONE_COUNT; zone++) {
    zoneStates[zone] = `zone ${zone}`;
  }
  return state("light.zone", {
    name: (0, import_object_names.objectName)("zoneSelector"),
    type: "number",
    role: "level",
    read: true,
    write: true,
    min: 0,
    max: import_wl433.ZONE_COUNT,
    def: 0,
    states: zoneStates
  });
}
function zoneChannelObjects() {
  const definitions = [
    {
      id: ZONES_FOLDER,
      obj: {
        type: "folder",
        common: { name: (0, import_object_names.objectName)("zones") },
        native: {}
      }
    }
  ];
  for (let zone = 1; zone <= import_wl433.ZONE_COUNT; zone++) {
    definitions.push(channel(zoneChannelId(zone), (0, import_object_names.objectName)("zone", zone)));
    definitions.push(...controlStates(zoneChannelId(zone), false));
  }
  return definitions;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BASE_OBJECTS,
  COUNTDOWN_MAX,
  DP,
  DP101_HISTORY_LENGTH,
  LIGHT_MODES,
  STATUS_ONLY_DPS,
  ZONES_FOLDER,
  ZONE_MODES,
  lightChannel,
  zoneChannelId,
  zoneChannelObjects,
  zoneSelectorState
});
//# sourceMappingURL=objects.js.map
