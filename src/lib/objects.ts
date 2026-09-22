/**
 * Tuya datapoints of the WL-433 gateway and the ioBroker objects they are mapped to.
 */
import { KELVIN_COLD, KELVIN_STEP, KELVIN_WARM } from "./color";
import { objectName } from "./object-names";
import { MAX_TIMERS } from "./timers";
import { DMX_ADDRESS_MAX, DMX_ADDRESS_MIN, SCENE_COUNT, ZONE_COUNT } from "./wl433";

/** Datapoint IDs of the WL-433 (Tuya standard light DPs plus vendor specific DP 101) */
export const DP = {
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
    RAW_FRAME: "101",
} as const;

/** Standard light datapoints that are only logged, the light states follow the DP 101 status */
export const STATUS_ONLY_DPS: ReadonlySet<string> = new Set([DP.MODE, DP.BRIGHTNESS, DP.TEMPERATURE, DP.COLOUR]);

/** Values of light.mode */
export const LIGHT_MODES = ["white", "colour", "scene"] as const;

/** How zones are offered, selected in the instance settings */
export const ZONE_MODES = ["selector", "channels"] as const;
export type ZoneMode = (typeof ZONE_MODES)[number];

/** Maximum countdown of DP 26 in seconds */
export const COUNTDOWN_MAX = 86400;

/** Number of DP 101 frames kept in dp101.history */
export const DP101_HISTORY_LENGTH = 50;

/** Object ID of the folder with the zone channels */
export const ZONES_FOLDER = "zones";

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

/**
 * Object ID of the channel of a zone, e.g. "zones.zone2".
 *
 * @param zone - zone 1..8
 */
export function zoneChannelId(zone: number): string {
    return `${ZONES_FOLDER}.zone${zone}`;
}

/**
 * The control states of one target: the "light" channel or a zone channel.
 *
 * @param prefix - channel ID, e.g. "light" or "zones.zone2"
 * @param withDefaults - false for zone channels: they stay empty until a value sent to the zone was confirmed
 */
function controlStates(prefix: string, withDefaults: boolean): ObjectDefinition[] {
    const sceneStates: Record<string, string> = { 0: "–" };
    for (let scene = 1; scene <= SCENE_COUNT; scene++) {
        sceneStates[scene] = `M${scene}`;
    }
    const definitions = [
        state(`${prefix}.on`, {
            name: objectName("on"),
            type: "boolean",
            role: "switch.light",
            read: true,
            write: true,
            def: false,
        }),
        state(`${prefix}.mode`, {
            name: objectName("mode"),
            type: "string",
            role: "text",
            read: true,
            write: true,
            def: "white",
            states: { white: "white", colour: "colour", scene: "scene" },
        }),
        state(`${prefix}.scene`, {
            name: objectName("scene"),
            type: "number",
            role: "level",
            read: true,
            write: true,
            min: 0,
            max: SCENE_COUNT,
            def: 0,
            states: sceneStates,
        }),
        state(`${prefix}.brightness`, {
            name: objectName("brightness"),
            type: "number",
            role: "level.dimmer",
            read: true,
            write: true,
            min: 0,
            max: 100,
            unit: "%",
            def: 100,
        }),
        state(`${prefix}.colorTemperature`, {
            name: objectName("colorTemperature"),
            type: "number",
            role: "level.color.temperature",
            read: true,
            write: true,
            min: KELVIN_WARM,
            max: KELVIN_COLD,
            step: KELVIN_STEP,
            unit: "K",
            def: KELVIN_COLD,
        }),
        state(`${prefix}.color`, {
            name: objectName("color"),
            type: "string",
            role: "level.color.rgb",
            read: true,
            write: true,
            def: "#ffffff",
        }),
        state(`${prefix}.hue`, {
            name: objectName("hue"),
            type: "number",
            role: "level.color.hue",
            read: true,
            write: true,
            min: 0,
            max: 360,
            unit: "°",
            def: 0,
        }),
        state(`${prefix}.saturation`, {
            name: objectName("saturation"),
            type: "number",
            role: "level.color.saturation",
            read: true,
            write: true,
            min: 0,
            max: 100,
            unit: "%",
            def: 100,
        }),
        state(`${prefix}.speedUp`, {
            name: objectName("speedUp"),
            type: "boolean",
            role: "button",
            read: false,
            write: true,
            def: false,
        }),
        state(`${prefix}.speedDown`, {
            name: objectName("speedDown"),
            type: "boolean",
            role: "button",
            read: false,
            write: true,
            def: false,
        }),
    ];
    if (!withDefaults) {
        for (const definition of definitions) {
            delete (definition.obj.common as Partial<ioBroker.StateCommon>).def;
        }
    }
    return definitions;
}

/** Objects that exist in both zone modes (dynamic "raw.dp<n>" states are created on demand) */
export const BASE_OBJECTS: ObjectDefinition[] = [
    state("info.ip", {
        name: objectName("ip"),
        type: "string",
        role: "info.ip",
        read: true,
        write: false,
        def: "",
    }),

    ...controlStates("light", true),
    state("light.countdown", {
        name: objectName("countdown"),
        type: "number",
        role: "level.timer",
        read: true,
        write: true,
        min: 0,
        max: COUNTDOWN_MAX,
        unit: "s",
        def: 0,
    }),

    channel("dp101", objectName("dp101")),
    state("dp101.raw", {
        name: objectName("dp101Raw"),
        type: "string",
        role: "text",
        read: true,
        write: true,
        def: "",
    }),
    state("dp101.hex", {
        name: objectName("dp101Hex"),
        type: "string",
        role: "text",
        read: true,
        write: true,
        def: "",
    }),
    state("dp101.checksumValid", {
        name: objectName("dp101ChecksumValid"),
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    }),
    state("dp101.history", {
        name: objectName("dp101History", DP101_HISTORY_LENGTH),
        type: "string",
        role: "json",
        read: true,
        write: false,
        def: "[]",
    }),

    channel("raw", objectName("raw")),

    channel("settings", objectName("settings")),
    state("settings.dmxAddress", {
        name: objectName("dmxAddress"),
        type: "number",
        role: "level",
        read: true,
        write: true,
        min: DMX_ADDRESS_MIN,
        max: DMX_ADDRESS_MAX,
    }),

    channel("timers", objectName("timers")),
    state("timers.active", {
        name: objectName("timersActive"),
        type: "boolean",
        role: "switch.enable",
        read: true,
        write: true,
        def: true,
    }),
    state("timers.nextRun", {
        name: objectName("timersNextRun"),
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: "",
    }),
    state("timers.lastRun", {
        name: objectName("timersLastRun"),
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: "",
    }),
    state("timers.overview", {
        name: objectName("timersOverview", MAX_TIMERS),
        type: "string",
        role: "json",
        read: true,
        write: false,
        def: "[]",
    }),
];

/**
 * Name of the "light" channel, it tells where the commands go.
 *
 * @param zoneMode - configured zone mode
 */
export function lightChannel(zoneMode: ZoneMode): ObjectDefinition {
    return channel("light", objectName(zoneMode === "selector" ? "lightSelector" : "lightAllZones"));
}

/** Zone selector of the zone mode "selector" */
export function zoneSelectorState(): ObjectDefinition {
    const zoneStates: Record<string, string> = { 0: "all zones" };
    for (let zone = 1; zone <= ZONE_COUNT; zone++) {
        zoneStates[zone] = `zone ${zone}`;
    }
    return state("light.zone", {
        name: objectName("zoneSelector"),
        type: "number",
        role: "level",
        read: true,
        write: true,
        min: 0,
        max: ZONE_COUNT,
        def: 0,
        states: zoneStates,
    });
}

/** Zone channels of the zone mode "channels" */
export function zoneChannelObjects(): ObjectDefinition[] {
    const definitions: ObjectDefinition[] = [
        {
            id: ZONES_FOLDER,
            obj: {
                type: "folder",
                common: { name: objectName("zones") },
                native: {},
            },
        },
    ];
    for (let zone = 1; zone <= ZONE_COUNT; zone++) {
        definitions.push(channel(zoneChannelId(zone), objectName("zone", zone)));
        definitions.push(...controlStates(zoneChannelId(zone), false));
    }
    return definitions;
}
