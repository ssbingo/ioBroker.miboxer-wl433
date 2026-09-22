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
  KELVIN_STEP: () => KELVIN_STEP,
  KELVIN_WARM: () => KELVIN_WARM,
  TEMPERATURE_STEPS: () => TEMPERATURE_STEPS,
  degreesToHueByte: () => degreesToHueByte,
  hueByteToDegrees: () => hueByteToDegrees,
  hueSaturationToRgbHex: () => hueSaturationToRgbHex,
  kelvinToTemperatureStep: () => kelvinToTemperatureStep,
  rgbHexToHueSaturation: () => rgbHexToHueSaturation,
  temperatureStepToKelvin: () => temperatureStepToKelvin
});
module.exports = __toCommonJS(color_exports);
const KELVIN_WARM = 2700;
const KELVIN_COLD = 6500;
const KELVIN_STEP = 100;
const TEMPERATURE_STEPS = (KELVIN_COLD - KELVIN_WARM) / KELVIN_STEP;
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function hueByteToDegrees(value) {
  return Math.round(clamp(value, 0, 255) * 360 / 256) % 360;
}
function degreesToHueByte(degrees) {
  const normalized = (degrees % 360 + 360) % 360;
  return Math.round(normalized * 256 / 360) % 256;
}
function temperatureStepToKelvin(step) {
  return KELVIN_WARM + clamp(Math.round(step), 0, TEMPERATURE_STEPS) * KELVIN_STEP;
}
function kelvinToTemperatureStep(kelvin) {
  return clamp(Math.round((kelvin - KELVIN_WARM) / KELVIN_STEP), 0, TEMPERATURE_STEPS);
}
function hueSaturationToRgbHex(hue, saturation) {
  const s = clamp(saturation, 0, 100) / 100;
  const h = (hue % 360 + 360) % 360 / 60 % 6;
  const c = s;
  const x = c * (1 - Math.abs(h % 2 - 1));
  const m = 1 - c;
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
function rgbHexToHueSaturation(rgb) {
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
  let hue = 0;
  if (delta > 0) {
    if (max === r) {
      hue = 60 * (((g - b) / delta + 6) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
  }
  return {
    hue: Math.round(hue) % 360,
    saturation: max === 0 ? 0 : Math.round(delta / max * 100)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  KELVIN_COLD,
  KELVIN_STEP,
  KELVIN_WARM,
  TEMPERATURE_STEPS,
  degreesToHueByte,
  hueByteToDegrees,
  hueSaturationToRgbHex,
  kelvinToTemperatureStep,
  rgbHexToHueSaturation,
  temperatureStepToKelvin
});
//# sourceMappingURL=color.js.map
