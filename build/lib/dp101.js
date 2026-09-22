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
var dp101_exports = {};
__export(dp101_exports, {
  DP101_FRAME_LENGTH: () => DP101_FRAME_LENGTH,
  buildDp101Frame: () => buildDp101Frame,
  decodeDp101: () => decodeDp101,
  dp101Checksum: () => dp101Checksum,
  encodeDp101Hex: () => encodeDp101Hex,
  formatHex: () => formatHex
});
module.exports = __toCommonJS(dp101_exports);
const DP101_FRAME_LENGTH = 12;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function dp101Checksum(bytes, length = bytes.length) {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += bytes[i];
  }
  return sum & 255;
}
function formatHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ").toUpperCase();
}
function toFrame(bytes) {
  return {
    base64: bytes.toString("base64"),
    hex: formatHex(bytes),
    bytes,
    checksumValid: bytes.length === DP101_FRAME_LENGTH && dp101Checksum(bytes, DP101_FRAME_LENGTH - 1) === bytes[DP101_FRAME_LENGTH - 1]
  };
}
function buildDp101Frame(payload) {
  if (payload.length !== DP101_FRAME_LENGTH - 1) {
    throw new RangeError(`A DP 101 frame needs ${DP101_FRAME_LENGTH - 1} payload bytes, got ${payload.length}`);
  }
  const bytes = Buffer.alloc(DP101_FRAME_LENGTH);
  for (let i = 0; i < payload.length; i++) {
    bytes[i] = payload[i] & 255;
  }
  bytes[DP101_FRAME_LENGTH - 1] = dp101Checksum(bytes, DP101_FRAME_LENGTH - 1);
  return toFrame(bytes);
}
function decodeDp101(base64) {
  const value = base64.trim();
  if (!value || !BASE64_PATTERN.test(value)) {
    throw new TypeError(`"${base64}" is not a valid Base64 value`);
  }
  return toFrame(Buffer.from(value, "base64"));
}
function encodeDp101Hex(hex) {
  const clean = hex.replace(/[\s:-]/g, "");
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(clean)) {
    throw new TypeError(`"${hex}" is not a valid hex byte sequence`);
  }
  const input = Buffer.from(clean, "hex");
  if (input.length !== DP101_FRAME_LENGTH - 1 && input.length !== DP101_FRAME_LENGTH) {
    throw new RangeError(
      `A DP 101 frame needs ${DP101_FRAME_LENGTH - 1} bytes (checksum is appended) or ${DP101_FRAME_LENGTH} bytes, got ${input.length}`
    );
  }
  const bytes = Buffer.alloc(DP101_FRAME_LENGTH);
  input.copy(bytes, 0, 0, DP101_FRAME_LENGTH - 1);
  const checksum = dp101Checksum(bytes, DP101_FRAME_LENGTH - 1);
  bytes[DP101_FRAME_LENGTH - 1] = checksum;
  const corrected = input.length === DP101_FRAME_LENGTH && input[DP101_FRAME_LENGTH - 1] !== checksum;
  return { frame: toFrame(bytes), corrected };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DP101_FRAME_LENGTH,
  buildDp101Frame,
  decodeDp101,
  dp101Checksum,
  encodeDp101Hex,
  formatHex
});
//# sourceMappingURL=dp101.js.map
