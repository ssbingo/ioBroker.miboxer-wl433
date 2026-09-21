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
  COUNTDOWN_MAX: () => COUNTDOWN_MAX,
  DP: () => DP,
  DP101_HISTORY_LENGTH: () => DP101_HISTORY_LENGTH,
  LIGHT_MODES: () => LIGHT_MODES,
  MAPPED_DPS: () => MAPPED_DPS,
  OBJECT_DEFINITIONS: () => OBJECT_DEFINITIONS
});
module.exports = __toCommonJS(objects_exports);
var import_color = require("./color");
const DP = {
  /** switch_led (bool) */
  SWITCH: "20",
  /** work_mode (enum white / colour / scene / music) */
  MODE: "21",
  /** bright_value_v2 (10..1000) */
  BRIGHTNESS: "22",
  /** temp_value_v2 (0..1000) */
  TEMPERATURE: "23",
  /** colour_data_v2 ("hhhhssssvvvv") */
  COLOUR: "24",
  /** countdown (0..86400 s) */
  COUNTDOWN: "26",
  /** vendor specific raw frames (Base64) for zones and scenes */
  RAW_FRAME: "101"
};
const MAPPED_DPS = new Set(Object.values(DP));
const LIGHT_MODES = ["white", "colour", "scene", "music"];
const COUNTDOWN_MAX = 86400;
const DP101_HISTORY_LENGTH = 50;
function state(id, common) {
  return { id, obj: { type: "state", common, native: {} } };
}
function channel(id, name) {
  return { id, obj: { type: "channel", common: { name }, native: {} } };
}
const OBJECT_DEFINITIONS = [
  state("info.ip", {
    name: { en: "IP address of the gateway", de: "IP-Adresse des Gateways" },
    type: "string",
    role: "info.ip",
    read: true,
    write: false,
    def: ""
  }),
  channel("light", { en: "Pool lights (all lamps of the gateway)", de: "Poolleuchten (alle Lampen des Gateways)" }),
  state("light.on", {
    name: { en: "On / off (DP 20)", de: "Ein / Aus (DP 20)" },
    type: "boolean",
    role: "switch.light",
    read: true,
    write: true,
    def: false
  }),
  state("light.mode", {
    name: { en: "Mode (DP 21)", de: "Modus (DP 21)" },
    type: "string",
    role: "text",
    read: true,
    write: true,
    def: "white",
    states: { white: "white", colour: "colour", scene: "scene", music: "music" }
  }),
  state("light.brightness", {
    name: {
      en: "Brightness (DP 22, in colour mode DP 24)",
      de: "Helligkeit (DP 22, im Farbmodus DP 24)"
    },
    type: "number",
    role: "level.dimmer",
    read: true,
    write: true,
    min: 0,
    max: 100,
    unit: "%",
    def: 100
  }),
  state("light.colorTemperature", {
    name: { en: "Colour temperature (DP 23)", de: "Farbtemperatur (DP 23)" },
    type: "number",
    role: "level.color.temperature",
    read: true,
    write: true,
    min: import_color.KELVIN_WARM,
    max: import_color.KELVIN_COLD,
    unit: "K",
    def: import_color.KELVIN_WARM
  }),
  state("light.color", {
    name: { en: "Colour #rrggbb (DP 24)", de: "Farbe #rrggbb (DP 24)" },
    type: "string",
    role: "level.color.rgb",
    read: true,
    write: true,
    def: "#ffffff"
  }),
  state("light.countdown", {
    name: { en: "Countdown until toggle (DP 26)", de: "Countdown bis zum Umschalten (DP 26)" },
    type: "number",
    role: "level.timer",
    read: true,
    write: true,
    min: 0,
    max: COUNTDOWN_MAX,
    unit: "s",
    def: 0
  }),
  channel("dp101", {
    en: "Datapoint 101 (raw frames, zones and scenes)",
    de: "Datenpunkt 101 (Roh-Frames, Zonen und Szenen)"
  }),
  state("dp101.raw", {
    name: { en: "Last frame as Base64 (writable)", de: "Letzter Frame als Base64 (schreibbar)" },
    type: "string",
    role: "text",
    read: true,
    write: true,
    def: ""
  }),
  state("dp101.hex", {
    name: {
      en: "Last frame as hex (writable, checksum is added automatically)",
      de: "Letzter Frame als Hex (schreibbar, Pr\xFCfsumme wird automatisch erg\xE4nzt)"
    },
    type: "string",
    role: "text",
    read: true,
    write: true,
    def: ""
  }),
  state("dp101.checksumValid", {
    name: { en: "Checksum of the last frame is valid", de: "Pr\xFCfsumme des letzten Frames ist g\xFCltig" },
    type: "boolean",
    role: "indicator",
    read: true,
    write: false,
    def: false
  }),
  state("dp101.history", {
    name: {
      en: `Last ${DP101_HISTORY_LENGTH} frames (received and sent)`,
      de: `Letzte ${DP101_HISTORY_LENGTH} Frames (empfangen und gesendet)`
    },
    type: "string",
    role: "json",
    read: true,
    write: false,
    def: "[]"
  }),
  channel("raw", { en: "Other datapoints", de: "Weitere Datenpunkte" })
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  COUNTDOWN_MAX,
  DP,
  DP101_HISTORY_LENGTH,
  LIGHT_MODES,
  MAPPED_DPS,
  OBJECT_DEFINITIONS
});
//# sourceMappingURL=objects.js.map
