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
var timers_exports = {};
__export(timers_exports, {
  ASTRO_TRIGGERS: () => ASTRO_TRIGGERS,
  MAX_TIMERS: () => MAX_TIMERS,
  TIMER_ACTIONS: () => TIMER_ACTIONS,
  describeAction: () => describeAction,
  describeSchedule: () => describeSchedule,
  formatLocal: () => formatLocal,
  inSeason: () => inSeason,
  isoWeekday: () => isoWeekday,
  nextRun: () => nextRun,
  parseDayOfYear: () => parseDayOfYear,
  parseTimeOfDay: () => parseTimeOfDay,
  parseTimer: () => parseTimer,
  sunEventTime: () => sunEventTime,
  toList: () => toList
});
module.exports = __toCommonJS(timers_exports);
var import_suncalc = require("suncalc");
const MAX_TIMERS = 50;
const ASTRO_TRIGGERS = ["dawn", "sunrise", "goldenHour", "sunset", "dusk", "night"];
const TIMER_ACTIONS = ["on", "off", "white", "colour", "scene", "brightness"];
const ALL_DAYS = /* @__PURE__ */ new Set([1, 2, 3, 4, 5, 6, 7]);
const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function toNumber(value) {
  if (value === "" || value === null || value === void 0) {
    return void 0;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : void 0;
}
function parseTimeOfDay(value) {
  var _a;
  if (typeof value !== "string" || !value.trim()) {
    return void 0;
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (match) {
    const [hours, minutes, seconds] = [Number(match[1]), Number(match[2]), Number((_a = match[3]) != null ? _a : 0)];
    return hours < 24 && minutes < 60 && seconds < 60 ? { hours, minutes, seconds } : void 0;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return void 0;
  }
  return { hours: date.getHours(), minutes: date.getMinutes(), seconds: date.getSeconds() };
}
function parseDayOfYear(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const match = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(value.trim());
  if (!match) {
    return void 0;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(2024, month, 0).getDate()) {
    return void 0;
  }
  return { day, month };
}
function toList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    return Object.entries(value).filter(([key]) => /^\d+$/.test(key)).sort(([a], [b]) => Number(a) - Number(b)).map(([, entry]) => entry);
  }
  return [];
}
function parseDays(value) {
  const list = toList(value);
  if (!list.length) {
    return ALL_DAYS;
  }
  const days = /* @__PURE__ */ new Set();
  for (const entry of list) {
    const day = Number(entry);
    if (Number.isInteger(day) && day >= 1 && day <= 7) {
      days.add(day);
    }
  }
  return days;
}
function parseTimer(config, index) {
  var _a, _b, _c, _d, _e, _f;
  const name = typeof config.name === "string" && config.name.trim() ? config.name.trim() : `Timer ${index}`;
  const trigger = (_a = config.trigger) != null ? _a : "time";
  if (trigger !== "time" && !ASTRO_TRIGGERS.includes(trigger)) {
    return { error: `unknown trigger "${String(config.trigger)}"` };
  }
  const time = trigger === "time" ? parseTimeOfDay(config.time) : void 0;
  if (trigger === "time" && !time) {
    return { error: "no valid time set" };
  }
  const action = (_b = config.action) != null ? _b : "on";
  if (!TIMER_ACTIONS.includes(action)) {
    return { error: `unknown action "${String(config.action)}"` };
  }
  const days = parseDays(config.days);
  if (!days.size) {
    return { error: "no weekday selected" };
  }
  let season;
  if (config.seasonFrom || config.seasonTo) {
    const from = parseDayOfYear(config.seasonFrom);
    const to = parseDayOfYear(config.seasonTo);
    if (!from || !to) {
      return { error: 'season needs "from" and "to" as DD.MM.' };
    }
    season = { from, to };
  }
  const zone = (_c = toNumber(config.zone)) != null ? _c : 0;
  if (!Number.isInteger(zone) || zone < 0 || zone > 8) {
    return { error: `zone ${String(config.zone)} is not 0 (all zones) to 8` };
  }
  const brightness = toNumber(config.brightness);
  if (brightness !== void 0 && (brightness < 1 || brightness > 100)) {
    return { error: `brightness ${brightness} % is not 1 to 100` };
  }
  if (action === "brightness" && brightness === void 0) {
    return { error: "action brightness needs a brightness" };
  }
  const timer = {
    index,
    name,
    trigger,
    time,
    offset: (_d = toNumber(config.offset)) != null ? _d : 0,
    random: Math.abs((_e = toNumber(config.random)) != null ? _e : 0),
    days,
    season,
    zone,
    action,
    brightness: brightness === void 0 ? void 0 : Math.round(brightness),
    duration: Math.max(0, (_f = toNumber(config.duration)) != null ? _f : 0)
  };
  if (action === "white") {
    const temperature = toNumber(config.temperature);
    if (temperature === void 0) {
      return { error: "action white needs a colour temperature" };
    }
    timer.temperature = temperature;
  }
  if (action === "colour") {
    if (typeof config.color !== "string" || !/^#?[0-9a-f]{6}$/i.test(config.color.trim())) {
      return { error: "action colour needs a colour like #0000ff" };
    }
    timer.color = config.color.trim().startsWith("#") ? config.color.trim() : `#${config.color.trim()}`;
  }
  if (action === "scene") {
    const scene = toNumber(config.scene);
    if (scene === void 0 || !Number.isInteger(scene) || scene < 1 || scene > 9) {
      return { error: "action scene needs a scene 1 to 9" };
    }
    timer.scene = scene;
  }
  return { timer };
}
function isoWeekday(date) {
  return (date.getDay() + 6) % 7 + 1;
}
function inSeason(date, season) {
  const value = (date.getMonth() + 1) * 100 + date.getDate();
  const from = season.from.month * 100 + season.from.day;
  const to = season.to.month * 100 + season.to.day;
  return from <= to ? value >= from && value <= to : value >= from || value <= to;
}
function sunEventTime(day, trigger, position) {
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
  const time = (0, import_suncalc.getTimes)(noon, position.latitude, position.longitude)[trigger];
  return time instanceof Date && !Number.isNaN(time.getTime()) ? time : null;
}
function nextRun(timer, after, position, random = Math.random) {
  if (timer.trigger !== "time" && !position) {
    return null;
  }
  for (let dayOffset = -1; dayOffset <= 367; dayOffset++) {
    const day = new Date(after.getFullYear(), after.getMonth(), after.getDate() + dayOffset, 12, 0, 0);
    if (!timer.days.has(isoWeekday(day)) || timer.season && !inSeason(day, timer.season)) {
      continue;
    }
    let base;
    if (timer.trigger === "time" && timer.time) {
      base = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        timer.time.hours,
        timer.time.minutes,
        timer.time.seconds
      );
    } else {
      base = sunEventTime(day, timer.trigger, position);
    }
    if (!base) {
      continue;
    }
    const randomShift = timer.random ? Math.round((random() * 2 - 1) * timer.random * 10) / 10 : 0;
    const at = new Date(base.getTime() + (timer.offset + randomShift) * 6e4);
    if (at.getTime() > after.getTime()) {
      return { at, base, randomShift };
    }
  }
  return null;
}
function pad(value) {
  return String(value).padStart(2, "0");
}
function formatLocal(date) {
  return `${DAY_NAMES[isoWeekday(date)]} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function describeSchedule(timer) {
  const when = timer.trigger === "time" && timer.time ? `${pad(timer.time.hours)}:${pad(timer.time.minutes)}${timer.time.seconds ? `:${pad(timer.time.seconds)}` : ""}` : timer.trigger;
  const offset = timer.offset ? ` ${timer.offset > 0 ? "+" : ""}${timer.offset} min` : "";
  const random = timer.random ? ` \xB1${timer.random} min` : "";
  const days = timer.days.size === 7 ? "daily" : [...timer.days].sort().map((day) => DAY_NAMES[day]).join(",");
  const season = timer.season ? `, ${pad(timer.season.from.day)}.${pad(timer.season.from.month)}.-${pad(timer.season.to.day)}.${pad(timer.season.to.month)}.` : "";
  return `${when}${offset}${random}, ${days}${season}`;
}
function describeAction(timer) {
  const target = timer.zone ? `zone ${timer.zone}` : "all zones";
  let action;
  switch (timer.action) {
    case "white":
      action = `white ${timer.temperature} K`;
      break;
    case "colour":
      action = `colour ${timer.color}`;
      break;
    case "scene":
      action = `scene ${timer.scene}`;
      break;
    case "brightness":
      action = "brightness";
      break;
    default:
      action = timer.action;
  }
  const brightness = timer.action !== "off" && timer.brightness !== void 0 ? `, ${timer.brightness} %` : "";
  const duration = timer.action !== "off" && timer.duration ? `, off after ${timer.duration} min` : "";
  return `${target}: ${action}${brightness}${duration}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ASTRO_TRIGGERS,
  MAX_TIMERS,
  TIMER_ACTIONS,
  describeAction,
  describeSchedule,
  formatLocal,
  inSeason,
  isoWeekday,
  nextRun,
  parseDayOfYear,
  parseTimeOfDay,
  parseTimer,
  sunEventTime,
  toList
});
//# sourceMappingURL=timers.js.map
