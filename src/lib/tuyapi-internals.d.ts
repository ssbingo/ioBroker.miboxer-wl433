// Type declarations for the internal tuyapi modules used by the LAN discovery.
// tuyapi only ships typings for its main class, the packet parser and the UDP key are untyped.

declare module "tuyapi/lib/message-parser" {
    /** A single decoded Tuya packet */
    export interface Packet {
        /** decrypted payload, usually a JSON object */
        payload: unknown;
        /** Tuya command byte */
        commandByte: number;
        /** sequence number */
        sequenceN: number;
    }

    /** Low-level Tuya packet encoder/decoder */
    export class MessageParser {
        constructor(options: { key?: Buffer | string; version?: string | number });
        parse(buffer: Buffer): Packet[];
        encode(options: { data: unknown; encrypted?: boolean; commandByte: number; sequenceN?: number }): Buffer;
    }

    export const CommandType: Record<string, number>;
}

declare module "tuyapi/lib/config" {
    /** AES key used by Tuya devices to encrypt their UDP presence broadcasts */
    export const UDP_KEY: Buffer;
}
