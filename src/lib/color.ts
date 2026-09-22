/**
 * Conversions between the value ranges of the WL-433 (datapoint 101) and ioBroker states.
 *
 * Hue 0..255 as one byte (0 = red, the full circle of 360°), saturation and brightness 0..100 %, colour temperature
 * in 38 steps of 100 K from 2700 K (warm) to 6500 K (cold).
 */

/** Warmest colour temperature (step 0) */
export const KELVIN_WARM = 2700;
/** Coldest colour temperature (step 38) */
export const KELVIN_COLD = 6500;
/** Colour temperature per step */
export const KELVIN_STEP = 100;
/** Highest colour temperature step (6500 K) */
export const TEMPERATURE_STEPS = (KELVIN_COLD - KELVIN_WARM) / KELVIN_STEP;

/** Hue and saturation of a colour */
export interface HueSaturation {
    /** hue in degrees 0..359 */
    hue: number;
    /** saturation 0..100 % */
    saturation: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Converts the hue byte of the WL-433 (0..255) to degrees (0..359).
 *
 * @param value - hue byte
 */
export function hueByteToDegrees(value: number): number {
    return Math.round((clamp(value, 0, 255) * 360) / 256) % 360;
}

/**
 * Converts degrees to the hue byte of the WL-433, 360° wraps to 0.
 *
 * @param degrees - hue in degrees, any value (cyclic)
 */
export function degreesToHueByte(degrees: number): number {
    const normalized = ((degrees % 360) + 360) % 360;
    return Math.round((normalized * 256) / 360) % 256;
}

/**
 * Converts a colour temperature step of the WL-433 (0..38) to Kelvin.
 *
 * @param step - colour temperature step
 */
export function temperatureStepToKelvin(step: number): number {
    return KELVIN_WARM + clamp(Math.round(step), 0, TEMPERATURE_STEPS) * KELVIN_STEP;
}

/**
 * Converts Kelvin to the nearest colour temperature step of the WL-433, clamped to 2700..6500 K.
 *
 * @param kelvin - colour temperature in K
 */
export function kelvinToTemperatureStep(kelvin: number): number {
    return clamp(Math.round((kelvin - KELVIN_WARM) / KELVIN_STEP), 0, TEMPERATURE_STEPS);
}

/**
 * Converts hue and saturation to "#rrggbb" at full brightness (the brightness is a separate value of the lamp).
 *
 * @param hue - hue in degrees
 * @param saturation - saturation 0..100 %
 */
export function hueSaturationToRgbHex(hue: number, saturation: number): string {
    const s = clamp(saturation, 0, 100) / 100;
    const h = ((((hue % 360) + 360) % 360) / 60) % 6;
    const c = s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = 1 - c;
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
 * Converts "#rrggbb" (or "rrggbb", "#rgb") to hue and saturation. The brightness of the RGB value is ignored,
 * "#800000" and "#ff0000" are both fully saturated red.
 *
 * @param rgb - colour string
 * @returns hue and saturation or null if the string is not a valid RGB colour
 */
export function rgbHexToHueSaturation(rgb: string): HueSaturation | null {
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
        saturation: max === 0 ? 0 : Math.round((delta / max) * 100),
    };
}
