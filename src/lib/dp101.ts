/**
 * Codec for the vendor specific Tuya datapoint 101 of the MiBoxer WL-433 gateway.
 *
 * DP 101 carries Base64 encoded binary frames. All frames are 12 bytes long and end with an 8-bit checksum:
 * byte 11 = (sum of bytes 0..10) mod 256. This module only transports and validates frames, the meaning of the
 * bytes (commands, status) is implemented in wl433.ts.
 * See doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md, chapter 3.1.5 and appendix A.
 */

/** Length of all DP 101 frames observed so far (11 payload bytes + 1 checksum byte) */
export const DP101_FRAME_LENGTH = 12;

/** A decoded DP 101 frame */
export interface Dp101Frame {
    /** Frame as sent over the Tuya protocol */
    base64: string;
    /** Frame as space separated hex bytes, e.g. "43 00 00 80 …" */
    hex: string;
    /** Raw frame bytes */
    bytes: Buffer;
    /** True if the frame has 12 bytes and the last byte matches the 8-bit sum of the others */
    checksumValid: boolean;
}

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Calculates the 8-bit sum checksum over the first `length` bytes.
 *
 * @param bytes - frame bytes
 * @param length - number of leading bytes to include
 */
export function dp101Checksum(bytes: Uint8Array, length: number = bytes.length): number {
    let sum = 0;
    for (let i = 0; i < length; i++) {
        sum += bytes[i];
    }
    return sum & 0xff;
}

/**
 * Formats bytes as upper case, space separated hex pairs.
 *
 * @param bytes - bytes to format
 */
export function formatHex(bytes: Uint8Array): string {
    return Array.from(bytes, b => b.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase();
}

function toFrame(bytes: Buffer): Dp101Frame {
    return {
        base64: bytes.toString("base64"),
        hex: formatHex(bytes),
        bytes,
        checksumValid:
            bytes.length === DP101_FRAME_LENGTH &&
            dp101Checksum(bytes, DP101_FRAME_LENGTH - 1) === bytes[DP101_FRAME_LENGTH - 1],
    };
}

/**
 * Builds a frame from its 11 payload bytes and appends the checksum.
 *
 * @param payload - bytes 0..10, values 0..255
 * @throws {RangeError} if the payload does not have 11 bytes
 */
export function buildDp101Frame(payload: ArrayLike<number>): Dp101Frame {
    if (payload.length !== DP101_FRAME_LENGTH - 1) {
        throw new RangeError(`A DP 101 frame needs ${DP101_FRAME_LENGTH - 1} payload bytes, got ${payload.length}`);
    }
    const bytes = Buffer.alloc(DP101_FRAME_LENGTH);
    for (let i = 0; i < payload.length; i++) {
        bytes[i] = payload[i] & 0xff;
    }
    bytes[DP101_FRAME_LENGTH - 1] = dp101Checksum(bytes, DP101_FRAME_LENGTH - 1);
    return toFrame(bytes);
}

/**
 * Decodes a DP 101 value as received from or sent to the gateway.
 *
 * @param base64 - Base64 encoded frame
 * @throws {TypeError} if the value is not valid Base64
 */
export function decodeDp101(base64: string): Dp101Frame {
    const value = base64.trim();
    if (!value || !BASE64_PATTERN.test(value)) {
        throw new TypeError(`"${base64}" is not a valid Base64 value`);
    }
    return toFrame(Buffer.from(value, "base64"));
}

/**
 * Builds a DP 101 frame from hex input. 11 bytes get the checksum appended, for 12 bytes the last byte is
 * replaced by the correct checksum. Whitespace, ":" and "-" separators are ignored.
 *
 * @param hex - frame as hex string, e.g. "43 00 00 80 00 00 00 00 00 80 80"
 * @returns the frame and whether a given (12th) checksum byte had to be corrected
 * @throws {TypeError | RangeError} on invalid input
 */
export function encodeDp101Hex(hex: string): { frame: Dp101Frame; corrected: boolean } {
    const clean = hex.replace(/[\s:-]/g, "");
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(clean)) {
        throw new TypeError(`"${hex}" is not a valid hex byte sequence`);
    }
    const input = Buffer.from(clean, "hex");
    if (input.length !== DP101_FRAME_LENGTH - 1 && input.length !== DP101_FRAME_LENGTH) {
        throw new RangeError(
            `A DP 101 frame needs ${DP101_FRAME_LENGTH - 1} bytes (checksum is appended) or ${DP101_FRAME_LENGTH} bytes, got ${input.length}`,
        );
    }
    const bytes = Buffer.alloc(DP101_FRAME_LENGTH);
    input.copy(bytes, 0, 0, DP101_FRAME_LENGTH - 1);
    const checksum = dp101Checksum(bytes, DP101_FRAME_LENGTH - 1);
    bytes[DP101_FRAME_LENGTH - 1] = checksum;
    const corrected = input.length === DP101_FRAME_LENGTH && input[DP101_FRAME_LENGTH - 1] !== checksum;
    return { frame: toFrame(bytes), corrected };
}
