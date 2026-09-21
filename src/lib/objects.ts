/**
 * Tuya datapoints of the WL-433 gateway and the ioBroker objects they are mapped to.
 */
import { KELVIN_COLD, KELVIN_WARM } from "./color";

/** Datapoint IDs of the WL-433 (Tuya standard light DPs plus vendor specific DP 101) */
export const DP = {
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
    RAW_FRAME: "101",
} as const;

/** Datapoints with a dedicated mapping, all others end up in the "raw" channel */
export const MAPPED_DPS: ReadonlySet<string> = new Set(Object.values(DP));

/** Values of DP 21 */
export const LIGHT_MODES = ["white", "colour", "scene", "music"] as const;

/** Maximum countdown of DP 26 in seconds */
export const COUNTDOWN_MAX = 86400;

/** Number of DP 101 frames kept in dp101.history */
export const DP101_HISTORY_LENGTH = 50;

/** Object definition used with extendObject */
export interface ObjectDefinition {
    /** object ID relative to the adapter namespace */
    id: string;
    /** object passed to extendObject */
    obj: ioBroker.SettableObject;
}

function state(id: string, common: ioBroker.StateCommon): ObjectDefinition {
    return { id, obj: { type: "state", common, native: {} } };
}

function channel(id: string, name: ioBroker.StringOrTranslated): ObjectDefinition {
    return { id, obj: { type: "channel", common: { name }, native: {} } };
}

/** All static objects of the adapter (dynamic "raw.dp<n>" states are created on demand) */
export const OBJECT_DEFINITIONS: ObjectDefinition[] = [
    state("info.ip", {
        name: { en: "IP address of the gateway", de: "IP-Adresse des Gateways" },
        type: "string",
        role: "info.ip",
        read: true,
        write: false,
        def: "",
    }),

    channel("light", { en: "Pool lights (all lamps of the gateway)", de: "Poolleuchten (alle Lampen des Gateways)" }),
    state("light.on", {
        name: { en: "On / off (DP 20)", de: "Ein / Aus (DP 20)" },
        type: "boolean",
        role: "switch.light",
        read: true,
        write: true,
        def: false,
    }),
    state("light.mode", {
        name: { en: "Mode (DP 21)", de: "Modus (DP 21)" },
        type: "string",
        role: "text",
        read: true,
        write: true,
        def: "white",
        states: { white: "white", colour: "colour", scene: "scene", music: "music" },
    }),
    state("light.brightness", {
        name: {
            en: "Brightness (DP 22, in colour mode DP 24)",
            de: "Helligkeit (DP 22, im Farbmodus DP 24)",
        },
        type: "number",
        role: "level.dimmer",
        read: true,
        write: true,
        min: 0,
        max: 100,
        unit: "%",
        def: 100,
    }),
    state("light.colorTemperature", {
        name: { en: "Colour temperature (DP 23)", de: "Farbtemperatur (DP 23)" },
        type: "number",
        role: "level.color.temperature",
        read: true,
        write: true,
        min: KELVIN_WARM,
        max: KELVIN_COLD,
        unit: "K",
        def: KELVIN_WARM,
    }),
    state("light.color", {
        name: { en: "Colour #rrggbb (DP 24)", de: "Farbe #rrggbb (DP 24)" },
        type: "string",
        role: "level.color.rgb",
        read: true,
        write: true,
        def: "#ffffff",
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
        def: 0,
    }),

    channel("dp101", {
        en: "Datapoint 101 (raw frames, zones and scenes)",
        de: "Datenpunkt 101 (Roh-Frames, Zonen und Szenen)",
    }),
    state("dp101.raw", {
        name: { en: "Last frame as Base64 (writable)", de: "Letzter Frame als Base64 (schreibbar)" },
        type: "string",
        role: "text",
        read: true,
        write: true,
        def: "",
    }),
    state("dp101.hex", {
        name: {
            en: "Last frame as hex (writable, checksum is added automatically)",
            de: "Letzter Frame als Hex (schreibbar, Prüfsumme wird automatisch ergänzt)",
        },
        type: "string",
        role: "text",
        read: true,
        write: true,
        def: "",
    }),
    state("dp101.checksumValid", {
        name: { en: "Checksum of the last frame is valid", de: "Prüfsumme des letzten Frames ist gültig" },
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    }),
    state("dp101.history", {
        name: {
            en: `Last ${DP101_HISTORY_LENGTH} frames (received and sent)`,
            de: `Letzte ${DP101_HISTORY_LENGTH} Frames (empfangen und gesendet)`,
        },
        type: "string",
        role: "json",
        read: true,
        write: false,
        def: "[]",
    }),

    channel("raw", { en: "Other datapoints", de: "Weitere Datenpunkte" }),
];
