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
var logging_exports = {};
__export(logging_exports, {
  MASK: () => MASK,
  bridgeTuyapiDebug: () => bridgeTuyapiDebug,
  cleanDebugLine: () => cleanDebugLine,
  formatDuration: () => formatDuration,
  redact: () => redact,
  shorten: () => shorten
});
module.exports = __toCommonJS(logging_exports);
var import_node_util = require("node:util");
const MASK = "***";
const SESSION_KEY_PATTERN = /((?:Local Random|Remote Random|Session) Key: )[0-9a-f]+/gi;
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
function redact(text, secrets = []) {
  let out = text.replace(SESSION_KEY_PATTERN, `$1${MASK}`);
  for (const secret of secrets) {
    if (secret) {
      out = out.split(secret).join(MASK);
    }
  }
  return out;
}
function shorten(text, max = 300) {
  return text.length > max ? `${text.slice(0, max)}\u2026 (${text.length} characters)` : text;
}
function formatDuration(ms) {
  if (ms < 1e3) {
    return `${Math.round(ms)} ms`;
  }
  if (ms < 6e4) {
    return `${(ms / 1e3).toFixed(1)} s`;
  }
  if (ms < 36e5) {
    return `${(ms / 6e4).toFixed(1)} min`;
  }
  return `${(ms / 36e5).toFixed(1)} h`;
}
function cleanDebugLine(line, namespace) {
  return line.replace(ANSI_PATTERN, "").trim().replace(/^\d{4}-\d{2}-\d{2}T\S+Z\s+/, "").replace(new RegExp(`^${namespace}\\s+`), "").replace(/\s+\+\d+(?:ms|s|m|h)$/, "").replace(/\s*\n\s*/g, " ");
}
const TUYAPI_NAMESPACE = "TuyAPI";
function bridgeTuyapiDebug(write, secrets) {
  const debugPath = require.resolve("debug", { paths: [require.resolve("tuyapi")] });
  const createDebug = require(debugPath);
  const previousNamespaces = createDebug.disable();
  const previousLog = createDebug.log;
  createDebug.enable(previousNamespaces ? `${previousNamespaces},${TUYAPI_NAMESPACE}` : TUYAPI_NAMESPACE);
  createDebug.log = function(...args) {
    if ((this == null ? void 0 : this.namespace) === TUYAPI_NAMESPACE) {
      write(redact(cleanDebugLine((0, import_node_util.format)(...args), TUYAPI_NAMESPACE), secrets));
    } else {
      previousLog.apply(this, args);
    }
  };
  return () => {
    createDebug.log = previousLog;
    createDebug.disable();
    if (previousNamespaces) {
      createDebug.enable(previousNamespaces);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MASK,
  bridgeTuyapiDebug,
  cleanDebugLine,
  formatDuration,
  redact,
  shorten
});
//# sourceMappingURL=logging.js.map
