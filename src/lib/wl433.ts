/**
 * Zone, scene and light protocol of the MiBoxer WL-433 in the vendor specific datapoint 101.
 *
 * Decoded on 2026-09-22 from the status frames of a real gateway and the commands the MiBoxer app writes to its
 * Android log ("ayxsendData"), see doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md, chapter 3.1.8.
 * All frames have 12 bytes, byte 11 is the 8-bit sum of bytes 0..10 (dp101.ts).
 *
 * Command (app / adapter -> gateway):  41 00 00 0B <cmd> <value> <v> <v> <v> <zone> 80 <sum>
 *   cmd 01 hue 0..255 (value repeated in bytes 5..8, also switches to colour mode)
 *   cmd 02 brightness 1..100 %, cmd 03 colour temperature step 0..38, cmd 04 saturation 0..100 %, cmd 05 scene 1..9
 *   cmd 06 key: 01 on, 02 off, 03 speed down (S-), 04 speed up (S+), 06 white mode
 *     (05 also switches off and is not a toggle, possibly a night light - not used by the app, not offered)
 *   zone 00 = all zones, 01..08 = zone 1..8
 * DMX start address:                   49 00 00 0B 02 <addr hi> <addr lo> 00 00 <zone> 80 <sum>
 *   answer of the gateway:             49 00 00 0B 02 01 <ct> <brightness> <saturation> <addr hi> <addr lo> <sum>
 * Status query:                        43 00 00 80 00 00 00 00 00 80 80 <sum>, answered with a type 44 frame
 * Status (gateway -> app):             42|44 00 00 00 <mode> <hue> <ct> <brightness> <saturation> 0B 01 <sum>
 *   42 = change report (about 2.5 s after the last change), 44 = answer to a status query
 *   mode 00 off, 01 colour, 02 white, 03..0B scene 1..9; byte 10 = DMX start address (low byte)
 * The status is one state for the whole gateway (the last setting of any zone), it does not contain the zone.
 */
import { buildDp101Frame, DP101_FRAME_LENGTH, type Dp101Frame } from "./dp101";

/** Byte 0 of a frame */
export const FRAME_TYPE = {
    COMMAND: 0x41,
    REPORT: 0x42,
    QUERY: 0x43,
    ANSWER: 0x44,
    DMX: 0x49,
} as const;

/** Range of the DMX start address (the gateway uses 5 channels from there: R, G, B, cold white, warm white) */
export const DMX_ADDRESS_MIN = 1;
export const DMX_ADDRESS_MAX = 512;

/** Byte 4 of a command frame */
export const COMMAND = {
    HUE: 0x01,
    BRIGHTNESS: 0x02,
    TEMPERATURE: 0x03,
    SATURATION: 0x04,
    SCENE: 0x05,
    KEY: 0x06,
} as const;

/** Byte 5 of a key command */
export const KEY = {
    ON: 0x01,
    OFF: 0x02,
    SPEED_DOWN: 0x03,
    SPEED_UP: 0x04,
    WHITE: 0x06,
} as const;

/** Zone number that addresses all zones */
export const ZONE_ALL = 0;
/** Number of zones of the WL-433 (and the FUT086 remote) */
export const ZONE_COUNT = 8;
/** Number of scenes (M1..M9 in the app) */
export const SCENE_COUNT = 9;

/** Status byte 4 of the first scene (M1), scene n is SCENE_MODE_OFFSET + n */
const SCENE_MODE_OFFSET = 0x02;

/** Light mode as reported by the gateway */
export type Wl433Mode = "colour" | "white" | "scene";

/** Decoded status frame. Values are kept by the gateway while the lights are off. */
export interface Wl433Status {
    /** "report" (0x42, sent after a change) or "answer" (0x44, answer to the status query) */
    type: "report" | "answer";
    /** false while the lights are off (mode byte 00) */
    on: boolean;
    /** mode of the lights, undefined while they are off (the gateway does not report the mode then) */
    mode: Wl433Mode | undefined;
    /** active scene 1..9, 0 if no scene is running */
    scene: number;
    /** hue byte 0..255 */
    hue: number;
    /** colour temperature step 0..38 */
    temperature: number;
    /** brightness 0..100 % */
    brightness: number;
    /** saturation 0..100 % */
    saturation: number;
    /** byte 10: DMX start address, only the low byte (addresses above 255 are not visible in the status) */
    dmxLowByte: number;
    /** bytes 1..10, identical values mean an identical status */
    signature: string;
}

const COMMAND_NAMES: Record<number, string> = {
    [COMMAND.HUE]: "hue",
    [COMMAND.BRIGHTNESS]: "brightness",
    [COMMAND.TEMPERATURE]: "colour temperature step",
    [COMMAND.SATURATION]: "saturation",
    [COMMAND.SCENE]: "scene",
    [COMMAND.KEY]: "key",
};

const KEY_NAMES: Record<number, string> = {
    [KEY.ON]: "on",
    [KEY.OFF]: "off",
    [KEY.SPEED_DOWN]: "speed down (S-)",
    [KEY.SPEED_UP]: "speed up (S+)",
    [KEY.WHITE]: "white mode",
    0x05: "off variant 05",
};

function byte(value: number, name: string, min: number, max: number): number {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new RangeError(`${name} must be an integer from ${min} to ${max}, got ${value}`);
    }
    return value;
}

/**
 * Text for log messages, e.g. "brightness 40 (zone 2)" or "key off (all zones)".
 *
 * @param command - command byte
 * @param value - value byte
 * @param zone - zone 0..8
 */
export function describeCommand(command: number, value: number, zone: number): string {
    const target = zone === ZONE_ALL ? "all zones" : `zone ${zone}`;
    const name = COMMAND_NAMES[command] ?? `command 0x${command.toString(16)}`;
    const shown = command === COMMAND.KEY ? (KEY_NAMES[value] ?? `0x${value.toString(16)}`) : String(value);
    return `${name} ${shown} (${target})`;
}

/**
 * Builds a command frame.
 *
 * @param command - command byte (COMMAND)
 * @param value - value byte, range depends on the command
 * @param zone - 0 = all zones, 1..8
 * @throws {RangeError} on values outside the documented ranges
 */
export function buildCommand(command: number, value: number, zone: number): Dp101Frame {
    byte(zone, "zone", ZONE_ALL, ZONE_COUNT);
    switch (command) {
        case COMMAND.HUE:
            byte(value, "hue", 0, 255);
            break;
        case COMMAND.BRIGHTNESS:
            byte(value, "brightness", 1, 100);
            break;
        case COMMAND.TEMPERATURE:
            byte(value, "colour temperature step", 0, 38);
            break;
        case COMMAND.SATURATION:
            byte(value, "saturation", 0, 100);
            break;
        case COMMAND.SCENE:
            byte(value, "scene", 1, SCENE_COUNT);
            break;
        case COMMAND.KEY:
            if (!Object.values(KEY).includes(value as (typeof KEY)[keyof typeof KEY])) {
                throw new RangeError(`unknown key 0x${value.toString(16)}`);
            }
            break;
        default:
            throw new RangeError(`unknown command 0x${command.toString(16)}`);
    }
    // the app repeats the hue in bytes 5..8, all other commands only use byte 5
    const extra = command === COMMAND.HUE ? value : 0;
    return buildDp101Frame([FRAME_TYPE.COMMAND, 0x00, 0x00, 0x0b, command, value, extra, extra, extra, zone, 0x80]);
}

/**
 * Builds the command that sets the DMX start address, the gateway answers with a type 0x49 frame.
 *
 * @param address - DMX start address 1..512
 * @param zone - zone the address applies to, 0 = all zones (the app sends the zone selected in the app)
 * @throws {RangeError} on values outside the allowed ranges
 */
export function buildDmxCommand(address: number, zone: number): Dp101Frame {
    byte(address, "DMX address", DMX_ADDRESS_MIN, DMX_ADDRESS_MAX);
    byte(zone, "zone", ZONE_ALL, ZONE_COUNT);
    return buildDp101Frame([
        FRAME_TYPE.DMX,
        0x00,
        0x00,
        0x0b,
        0x02,
        address >> 8,
        address & 0xff,
        0x00,
        0x00,
        zone,
        0x80,
    ]);
}

/**
 * Decodes the answer of the gateway to a DMX command.
 *
 * @param frame - received DP 101 frame
 * @returns the confirmed DMX start address, or null if the frame is no valid DMX answer
 */
export function parseDmxAnswer(frame: Dp101Frame): number | null {
    const bytes = frame.bytes;
    if (
        !frame.checksumValid ||
        bytes.length !== DP101_FRAME_LENGTH ||
        bytes[0] !== FRAME_TYPE.DMX ||
        bytes[5] !== 0x01
    ) {
        return null;
    }
    const address = (bytes[9] << 8) | bytes[10];
    return address >= DMX_ADDRESS_MIN && address <= DMX_ADDRESS_MAX ? address : null;
}

/** Builds the status query the app sends when it opens, the gateway answers with a type 0x44 status frame. */
export function buildStatusQuery(): Dp101Frame {
    return buildDp101Frame([FRAME_TYPE.QUERY, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x80]);
}

/**
 * Decodes a status frame of the gateway.
 *
 * @param frame - received DP 101 frame
 * @returns the status, or null if the frame is not a valid status frame (other type, wrong length or checksum)
 */
export function parseStatus(frame: Dp101Frame): Wl433Status | null {
    const bytes = frame.bytes;
    if (!frame.checksumValid || bytes.length !== DP101_FRAME_LENGTH) {
        return null;
    }
    if (bytes[0] !== FRAME_TYPE.REPORT && bytes[0] !== FRAME_TYPE.ANSWER) {
        return null;
    }
    const modeByte = bytes[4];
    if (modeByte > SCENE_MODE_OFFSET + SCENE_COUNT) {
        return null;
    }
    let mode: Wl433Mode | undefined;
    let scene = 0;
    if (modeByte === 0x01) {
        mode = "colour";
    } else if (modeByte === 0x02) {
        mode = "white";
    } else if (modeByte > SCENE_MODE_OFFSET) {
        mode = "scene";
        scene = modeByte - SCENE_MODE_OFFSET;
    }
    return {
        type: bytes[0] === FRAME_TYPE.REPORT ? "report" : "answer",
        on: modeByte !== 0x00,
        mode,
        scene,
        hue: bytes[5],
        temperature: bytes[6],
        brightness: bytes[7],
        saturation: bytes[8],
        dmxLowByte: bytes[10],
        signature: bytes.subarray(1, 11).toString("hex"),
    };
}

/**
 * Text for log messages, e.g. "on, scene 1, hue 73, colour temperature step 18, brightness 100 %, saturation 86 %".
 *
 * @param status - decoded status
 */
export function describeStatus(status: Wl433Status): string {
    const mode = status.mode === "scene" ? `scene ${status.scene}` : (status.mode ?? "mode not reported");
    return (
        `${status.on ? "on" : "off"}, ${mode}, hue ${status.hue}, colour temperature step ${status.temperature}, ` +
        `brightness ${status.brightness} %, saturation ${status.saturation} %`
    );
}
