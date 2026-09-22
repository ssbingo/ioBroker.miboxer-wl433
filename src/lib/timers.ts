/**
 * Local timers of the adapter (tab "Timers" in the instance settings).
 *
 * The timers of the MiBoxer app are stored and triggered in the Tuya cloud and only switch datapoint 20 of all zones.
 * These timers run inside ioBroker instead: fixed time or sun position with offset and random shift, weekdays,
 * season, zone and every action of the lights, optionally switching off again after a duration.
 * This module only validates the configuration and calculates the next run, the adapter executes the actions.
 */
import { getTimes, type SunTimeName } from "suncalc";

/** Maximum number of timers that are evaluated */
export const MAX_TIMERS = 50;

/** Sun events a timer can follow (names of suncalc) */
export const ASTRO_TRIGGERS = ["dawn", "sunrise", "goldenHour", "sunset", "dusk", "night"] as const;
export type AstroTrigger = (typeof ASTRO_TRIGGERS)[number];
export type TimerTrigger = "time" | AstroTrigger;

export const TIMER_ACTIONS = ["on", "off", "white", "colour", "scene", "brightness"] as const;
export type TimerAction = (typeof TIMER_ACTIONS)[number];

/** A timer as stored in the instance settings (native.timers), every field may be missing or have a wrong type */
export interface TimerConfig {
    /** timer is active */
    enabled?: unknown;
    /** name shown in the log and in timers.overview */
    name?: unknown;
    /** "time" or a sun event */
    trigger?: unknown;
    /** time of day HH:mm or HH:mm:ss */
    time?: unknown;
    /** shift in minutes, negative = earlier */
    offset?: unknown;
    /** random shift of up to ± this many minutes */
    random?: unknown;
    /** ISO weekdays 1 (Monday) .. 7 (Sunday), empty = every day */
    days?: unknown;
    /** first day of the season DD.MM. */
    seasonFrom?: unknown;
    /** last day of the season DD.MM. */
    seasonTo?: unknown;
    /** 0 = all zones, 1..8 */
    zone?: unknown;
    /** what the timer does */
    action?: unknown;
    /** brightness 1..100 %, empty = unchanged */
    brightness?: unknown;
    /** colour temperature in K for "white" */
    temperature?: unknown;
    /** colour "#rrggbb" for "colour" */
    color?: unknown;
    /** scene 1..9 for "scene" */
    scene?: unknown;
    /** switch off again after this many minutes, 0 = no */
    duration?: unknown;
}

/** Day and month of a yearly recurring date */
export interface DayOfYear {
    /** day of the month 1..31 */
    day: number;
    /** month 1..12 */
    month: number;
}

/** A validated timer */
export interface Timer {
    /** position in the list, starting with 1 */
    index: number;
    /** name shown in the log and in timers.overview */
    name: string;
    /** "time" or a sun event */
    trigger: TimerTrigger;
    /** time of day for the trigger "time" */
    time?: { hours: number; minutes: number; seconds: number };
    /** shift in minutes, negative = earlier */
    offset: number;
    /** random shift of up to ± this many minutes */
    random: number;
    /** ISO weekdays 1 (Monday) .. 7 (Sunday) */
    days: ReadonlySet<number>;
    /** season, e.g. 01.05. - 30.09., may wrap around the new year */
    season?: { from: DayOfYear; to: DayOfYear };
    /** 0 = all zones, 1..8 */
    zone: number;
    /** what the timer does */
    action: TimerAction;
    /** 1..100 %, undefined = unchanged */
    brightness?: number;
    /** Kelvin for "white" */
    temperature?: number;
    /** "#rrggbb" for "colour" */
    color?: string;
    /** 1..9 for "scene" */
    scene?: number;
    /** switch off again after this many minutes, 0 = no */
    duration: number;
}

/** Geographic position of the ioBroker installation (system settings) */
export interface GeoPosition {
    /** latitude in degrees */
    latitude: number;
    /** longitude in degrees */
    longitude: number;
}

/** Result of the validation: the timer or why it is ignored */
export type TimerParseResult = { timer: Timer } | { error: string };

const ALL_DAYS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6, 7]);
const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toNumber(value: unknown): number | undefined {
    if (value === "" || value === null || value === undefined) {
        return undefined;
    }
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
}

/**
 * Parses a time of day "HH:mm" or "HH:mm:ss". A full date string (older admin versions of the time picker) is
 * accepted as well, then its local time of day is used.
 *
 * @param value - configured time
 */
export function parseTimeOfDay(value: unknown): { hours: number; minutes: number; seconds: number } | undefined {
    if (typeof value !== "string" || !value.trim()) {
        return undefined;
    }
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (match) {
        const [hours, minutes, seconds] = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
        return hours < 24 && minutes < 60 && seconds < 60 ? { hours, minutes, seconds } : undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }
    return { hours: date.getHours(), minutes: date.getMinutes(), seconds: date.getSeconds() };
}

/**
 * Parses a yearly recurring date "DD.MM." or "DD.MM".
 *
 * @param value - configured date
 */
export function parseDayOfYear(value: unknown): DayOfYear | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const match = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(value.trim());
    if (!match) {
        return undefined;
    }
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > new Date(2024, month, 0).getDate()) {
        return undefined;
    }
    return { day, month };
}

/**
 * Returns a list as array. Objects with numeric keys (created e.g. by merging configurations or editing them on the
 * command line) are converted in the order of their keys.
 *
 * @param value - array, object with numeric keys or anything else
 */
export function toList(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (value && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>)
            .filter(([key]) => /^\d+$/.test(key))
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, entry]) => entry);
    }
    return [];
}

function parseDays(value: unknown): ReadonlySet<number> {
    const list = toList(value);
    if (!list.length) {
        return ALL_DAYS;
    }
    const days = new Set<number>();
    for (const entry of list) {
        const day = Number(entry);
        if (Number.isInteger(day) && day >= 1 && day <= 7) {
            days.add(day);
        }
    }
    return days;
}

/**
 * Validates one timer of the instance settings.
 *
 * @param config - timer as stored in native.timers
 * @param index - position in the list, starting with 1
 */
export function parseTimer(config: TimerConfig, index: number): TimerParseResult {
    const name = typeof config.name === "string" && config.name.trim() ? config.name.trim() : `Timer ${index}`;
    const trigger = (config.trigger ?? "time") as TimerTrigger;
    if (trigger !== "time" && !(ASTRO_TRIGGERS as readonly string[]).includes(trigger)) {
        return { error: `unknown trigger "${String(config.trigger)}"` };
    }
    const time = trigger === "time" ? parseTimeOfDay(config.time) : undefined;
    if (trigger === "time" && !time) {
        return { error: "no valid time set" };
    }
    const action = (config.action ?? "on") as TimerAction;
    if (!(TIMER_ACTIONS as readonly string[]).includes(action)) {
        return { error: `unknown action "${String(config.action)}"` };
    }
    const days = parseDays(config.days);
    if (!days.size) {
        return { error: "no weekday selected" };
    }
    let season: Timer["season"];
    if (config.seasonFrom || config.seasonTo) {
        const from = parseDayOfYear(config.seasonFrom);
        const to = parseDayOfYear(config.seasonTo);
        if (!from || !to) {
            return { error: 'season needs "from" and "to" as DD.MM.' };
        }
        season = { from, to };
    }
    const zone = toNumber(config.zone) ?? 0;
    if (!Number.isInteger(zone) || zone < 0 || zone > 8) {
        return { error: `zone ${String(config.zone)} is not 0 (all zones) to 8` };
    }
    const brightness = toNumber(config.brightness);
    if (brightness !== undefined && (brightness < 1 || brightness > 100)) {
        return { error: `brightness ${brightness} % is not 1 to 100` };
    }
    if (action === "brightness" && brightness === undefined) {
        return { error: "action brightness needs a brightness" };
    }
    const timer: Timer = {
        index,
        name,
        trigger,
        time,
        offset: toNumber(config.offset) ?? 0,
        random: Math.abs(toNumber(config.random) ?? 0),
        days,
        season,
        zone,
        action,
        brightness: brightness === undefined ? undefined : Math.round(brightness),
        duration: Math.max(0, toNumber(config.duration) ?? 0),
    };
    if (action === "white") {
        const temperature = toNumber(config.temperature);
        if (temperature === undefined) {
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
        if (scene === undefined || !Number.isInteger(scene) || scene < 1 || scene > 9) {
            return { error: "action scene needs a scene 1 to 9" };
        }
        timer.scene = scene;
    }
    return { timer };
}

/**
 * ISO weekday 1 (Monday) .. 7 (Sunday) of a local date.
 *
 * @param date - date
 */
export function isoWeekday(date: Date): number {
    return ((date.getDay() + 6) % 7) + 1;
}

/**
 * Checks whether a local date lies in a yearly season, which may wrap around the new year.
 *
 * @param date - date
 * @param season - season
 * @param season.from - first day
 * @param season.to - last day
 */
export function inSeason(date: Date, season: { from: DayOfYear; to: DayOfYear }): boolean {
    const value = (date.getMonth() + 1) * 100 + date.getDate();
    const from = season.from.month * 100 + season.from.day;
    const to = season.to.month * 100 + season.to.day;
    return from <= to ? value >= from && value <= to : value >= from || value <= to;
}

/**
 * Time of a sun event on a local day, null if it does not happen there (polar regions).
 *
 * @param day - local day
 * @param trigger - sun event
 * @param position - geographic position
 */
export function sunEventTime(day: Date, trigger: AstroTrigger, position: GeoPosition): Date | null {
    const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
    const time = getTimes(noon, position.latitude, position.longitude)[trigger as SunTimeName];
    return time instanceof Date && !Number.isNaN(time.getTime()) ? time : null;
}

/** The next run of a timer */
export interface NextRun {
    /** when the action runs */
    at: Date;
    /** time before offset and random shift (the time or the sun event) */
    base: Date;
    /** applied random shift in minutes */
    randomShift: number;
}

/**
 * Calculates the next run after a point in time. Days without the sun event or outside weekdays / season are
 * skipped, at most one year is searched.
 *
 * @param timer - validated timer
 * @param after - the run must be later than this
 * @param position - geographic position, needed for sun events
 * @param random - random number generator 0..1 (replaceable for tests)
 */
export function nextRun(
    timer: Timer,
    after: Date,
    position: GeoPosition | undefined,
    random: () => number = Math.random,
): NextRun | null {
    if (timer.trigger !== "time" && !position) {
        return null;
    }
    // start one day earlier: a negative offset can move a run of tomorrow's event to today
    for (let dayOffset = -1; dayOffset <= 367; dayOffset++) {
        const day = new Date(after.getFullYear(), after.getMonth(), after.getDate() + dayOffset, 12, 0, 0);
        if (!timer.days.has(isoWeekday(day)) || (timer.season && !inSeason(day, timer.season))) {
            continue;
        }
        let base: Date | null;
        if (timer.trigger === "time" && timer.time) {
            base = new Date(
                day.getFullYear(),
                day.getMonth(),
                day.getDate(),
                timer.time.hours,
                timer.time.minutes,
                timer.time.seconds,
            );
        } else {
            base = sunEventTime(day, timer.trigger as AstroTrigger, position as GeoPosition);
        }
        if (!base) {
            continue;
        }
        const randomShift = timer.random ? Math.round((random() * 2 - 1) * timer.random * 10) / 10 : 0;
        const at = new Date(base.getTime() + (timer.offset + randomShift) * 60_000);
        if (at.getTime() > after.getTime()) {
            return { at, base, randomShift };
        }
    }
    return null;
}

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

/**
 * Local date and time for log messages and states, e.g. "Tue 2026-09-22 19:42:00".
 *
 * @param date - date
 */
export function formatLocal(date: Date): string {
    return (
        `${DAY_NAMES[isoWeekday(date)]} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}

/**
 * Short description of when a timer runs, e.g. "sunset -15 min ±10 min, Mon-Fri, 01.05.-30.09.".
 *
 * @param timer - validated timer
 */
export function describeSchedule(timer: Timer): string {
    const when =
        timer.trigger === "time" && timer.time
            ? `${pad(timer.time.hours)}:${pad(timer.time.minutes)}${timer.time.seconds ? `:${pad(timer.time.seconds)}` : ""}`
            : timer.trigger;
    const offset = timer.offset ? ` ${timer.offset > 0 ? "+" : ""}${timer.offset} min` : "";
    const random = timer.random ? ` ±${timer.random} min` : "";
    const days =
        timer.days.size === 7
            ? "daily"
            : [...timer.days]
                  .sort()
                  .map(day => DAY_NAMES[day])
                  .join(",");
    const season = timer.season
        ? `, ${pad(timer.season.from.day)}.${pad(timer.season.from.month)}.-${pad(timer.season.to.day)}.${pad(timer.season.to.month)}.`
        : "";
    return `${when}${offset}${random}, ${days}${season}`;
}

/**
 * Short description of what a timer does, e.g. "zone 2: white 3000 K, 60 %, off after 90 min".
 *
 * @param timer - validated timer
 */
export function describeAction(timer: Timer): string {
    const target = timer.zone ? `zone ${timer.zone}` : "all zones";
    let action: string;
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
    const brightness = timer.action !== "off" && timer.brightness !== undefined ? `, ${timer.brightness} %` : "";
    const duration = timer.action !== "off" && timer.duration ? `, off after ${timer.duration} min` : "";
    return `${target}: ${action}${brightness}${duration}`;
}
