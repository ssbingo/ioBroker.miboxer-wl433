/**
 * Conversions between the Tuya standard light datapoints (protocol v3.3 "v2" value ranges) and ioBroker states.
 *
 * DP 22 brightness 10..1000, DP 23 colour temperature 0..1000 (0 = warm), DP 24 colour as 12 hex characters
 * "hhhhssssvvvv" with h 0..360, s 0..1000, v 0..1000.
 */

/** Colour in the Tuya value ranges: h 0..360, s 0..1000, v 0..1000 */
export interface TuyaHsv {
    /** hue 0..360 */
    h: number;
    /** saturation 0..1000 */
    s: number;
    /** value (brightness) 0..1000 */
    v: number;
}

/** Lowest raw brightness / colour value accepted by Tuya lights (1 %) */
export const TUYA_VALUE_MIN = 10;
/** Highest raw brightness / colour / colour temperature value */
export const TUYA_VALUE_MAX = 1000;
/** Colour temperature mapped to raw value 0 (warm white) */
export const KELVIN_WARM = 2700;
/** Colour temperature mapped to raw value 1000 (cold white) */
export const KELVIN_COLD = 6500;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Parses the DP 24 colour string.
 *
 * @param value - 12 hex characters "hhhhssssvvvv"
 * @returns the colour or null if the value is not a valid colour string
 */
export function parseTuyaHsv(value: unknown): TuyaHsv | null {
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

/**
 * Formats a colour as DP 24 string, values are rounded and clamped to the valid ranges.
 *
 * @param hsv - colour in Tuya value ranges
 */
export function formatTuyaHsv(hsv: TuyaHsv): string {
    const h = clamp(Math.round(hsv.h), 0, 360);
    const s = clamp(Math.round(hsv.s), 0, TUYA_VALUE_MAX);
    const v = clamp(Math.round(hsv.v), TUYA_VALUE_MIN, TUYA_VALUE_MAX);
    return [h, s, v].map(n => n.toString(16).padStart(4, "0")).join("");
}

/**
 * Converts a Tuya colour to "#rrggbb" (including the brightness component v).
 *
 * @param hsv - colour in Tuya value ranges
 */
export function tuyaHsvToRgbHex(hsv: TuyaHsv): string {
    const s = hsv.s / TUYA_VALUE_MAX;
    const v = hsv.v / TUYA_VALUE_MAX;
    const h = (hsv.h % 360) / 60;
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    let rgb: [number, number, number];
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
    return `#${rgb
        .map(component =>
            Math.round((component + m) * 255)
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
}

/**
 * Converts "#rrggbb" (or "rrggbb", "#rgb") to a Tuya colour. The brightness component v follows the
 * brightest RGB channel, so "#800000" results in half brightness red.
 *
 * @param rgb - colour string
 * @returns the colour or null if the string is not a valid RGB colour
 */
export function rgbHexToTuyaHsv(rgb: string): TuyaHsv | null {
    let hex = rgb.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        hex = hex
            .split("")
            .map(ch => ch + ch)
            .join("");
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
        v: clamp(Math.round(max * TUYA_VALUE_MAX), TUYA_VALUE_MIN, TUYA_VALUE_MAX),
    };
}

/**
 * Converts a raw brightness (DP 22 or the v part of DP 24, 10..1000) to percent (1..100).
 *
 * @param value - raw brightness
 */
export function rawToPercent(value: number): number {
    return clamp(Math.round(value / 10), 1, 100);
}

/**
 * Converts percent (1..100) to a raw brightness value (10..1000).
 *
 * @param percent - brightness in percent
 */
export function percentToRaw(percent: number): number {
    return clamp(Math.round(percent * 10), TUYA_VALUE_MIN, TUYA_VALUE_MAX);
}

/**
 * Converts the raw colour temperature (DP 23, 0 = warm .. 1000 = cold) to Kelvin.
 *
 * @param value - raw colour temperature
 */
export function rawToKelvin(value: number): number {
    const raw = clamp(value, 0, TUYA_VALUE_MAX);
    return Math.round(KELVIN_WARM + (raw / TUYA_VALUE_MAX) * (KELVIN_COLD - KELVIN_WARM));
}

/**
 * Converts Kelvin to the raw colour temperature (DP 23), clamped to the supported range.
 *
 * @param kelvin - colour temperature in K
 */
export function kelvinToRaw(kelvin: number): number {
    const k = clamp(kelvin, KELVIN_WARM, KELVIN_COLD);
    return Math.round(((k - KELVIN_WARM) / (KELVIN_COLD - KELVIN_WARM)) * TUYA_VALUE_MAX);
}
