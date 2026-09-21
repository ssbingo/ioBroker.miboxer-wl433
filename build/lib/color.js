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
var color_exports = {};
__export(color_exports, {
  KELVIN_COLD: () => KELVIN_COLD,
  KELVIN_WARM: () => KELVIN_WARM,
  TUYA_VALUE_MAX: () => TUYA_VALUE_MAX,
  TUYA_VALUE_MIN: () => TUYA_VALUE_MIN,
  formatTuyaHsv: () => formatTuyaHsv,
  kelvinToRaw: () => kelvinToRaw,
  parseTuyaHsv: () => parseTuyaHsv,
  percentToRaw: () => percentToRaw,
  rawToKelvin: () => rawToKelvin,
  rawToPercent: () => rawToPercent,
  rgbHexToTuyaHsv: () => rgbHexToTuyaHsv,
  tuyaHsvToRgbHex: () => tuyaHsvToRgbHex
});
module.exports = __toCommonJS(color_exports);
const TUYA_VALUE_MIN = 10;
const TUYA_VALUE_MAX = 1e3;
const KELVIN_WARM = 2700;
const KELVIN_COLD = 6500;
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function parseTuyaHsv(value) {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{12}$/.test(value)) {
    return null;
  }
  const h = parseInt(value.substring(0, 4), 16);
  const s = parseInt(value.substring(4, 8), 16);
  const v = parseInt(value.substring(8, 12), 16);
  if (h > 360 || s > TUYA_VALUE_MAX || v > TUYA_VALUE_MAX) {
    return null;
  }
  return { h, s, v };
}
function formatTuyaHsv(hsv) {
  const h = clamp(Math.round(hsv.h), 0, 360);
  const s = clamp(Math.round(hsv.s), 0, TUYA_VALUE_MAX);
  const v = clamp(Math.round(hsv.v), TUYA_VALUE_MIN, TUYA_VALUE_MAX);
  return [h, s, v].map((n) => n.toString(16).padStart(4, "0")).join("");
}
function tuyaHsvToRgbHex(hsv) {
  const s = hsv.s / TUYA_VALUE_MAX;
  const v = hsv.v / TUYA_VALUE_MAX;
  const h = hsv.h % 360 / 60;
  const c = v * s;
  const x = c * (1 - Math.abs(h % 2 - 1));
  const m = v - c;
  let rgb;
  if (h < 1) {
    rgb = [c, x, 0];
  } else if (h < 2) {
    rgb = [x, c, 0];
  } else if (h < 3) {
    rgb = [0, c, x];
  } else if (h < 4) {
    rgb = [0, x, c];
  } else if (h < 5) {
    rgb = [x, 0, c];
  } else {
    rgb = [c, 0, x];
  }
  return `#${rgb.map(
    (component) => Math.round((component + m) * 255).toString(16).padStart(2, "0")
  ).join("")}`;
}
function rgbHexToTuyaHsv(rgb) {
  let hex = rgb.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex.split("").map((ch) => ch + ch).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta + 6) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }
  const s = max === 0 ? 0 : delta / max;
  return {
    h: Math.round(h) % 360,
    s: Math.round(s * TUYA_VALUE_MAX),
    v: clamp(Math.round(max * TUYA_VALUE_MAX), TUYA_VALUE_MIN, TUYA_VALUE_MAX)
  };
}
function rawToPercent(value) {
  return clamp(Math.round(value / 10), 1, 100);
}
function percentToRaw(percent) {
  return clamp(Math.round(percent * 10), TUYA_VALUE_MIN, TUYA_VALUE_MAX);
}
function rawToKelvin(value) {
  const raw = clamp(value, 0, TUYA_VALUE_MAX);
  return Math.round(KELVIN_WARM + raw / TUYA_VALUE_MAX * (KELVIN_COLD - KELVIN_WARM));
}
function kelvinToRaw(kelvin) {
  const k = clamp(kelvin, KELVIN_WARM, KELVIN_COLD);
  return Math.round((k - KELVIN_WARM) / (KELVIN_COLD - KELVIN_WARM) * TUYA_VALUE_MAX);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  KELVIN_COLD,
  KELVIN_WARM,
  TUYA_VALUE_MAX,
  TUYA_VALUE_MIN,
  formatTuyaHsv,
  kelvinToRaw,
  parseTuyaHsv,
  percentToRaw,
  rawToKelvin,
  rawToPercent,
  rgbHexToTuyaHsv,
  tuyaHsvToRgbHex
});
//# sourceMappingURL=color.js.map
