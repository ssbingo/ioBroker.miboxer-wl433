/**
 * Listens for the UDP presence broadcasts of Tuya devices in the local network.
 *
 * Tuya devices announce themselves on UDP 6666 (plain, v3.1) and 6667 (AES encrypted with a well-known key, v3.3+).
 * tuyapi's own find() cannot be cancelled, so the sockets are managed here to be able to close them on unload.
 */
import * as dgram from "node:dgram";
import { UDP_KEY } from "tuyapi/lib/config";
import { MessageParser } from "tuyapi/lib/message-parser";

/** UDP ports of the Tuya presence broadcasts */
export const DISCOVERY_PORTS = [6666, 6667] as const;

/** A Tuya device announced in the local network */
export interface DiscoveredDevice {
    /** Tuya device ID (gwId) */
    id: string;
    /** IP address announced by the device */
    ip: string;
    /** Tuya LAN protocol version announced by the device */
    version: string;
    /** Tuya product key */
    productKey?: string;
}

const PARSE_VERSIONS = ["3.3", "3.5", "3.1"];

/**
 * Parses a single UDP presence broadcast.
 *
 * @param message - received datagram
 * @returns the announced device or null if the datagram is no Tuya presence broadcast
 */
export function parseBroadcast(message: Buffer): DiscoveredDevice | null {
    for (const version of PARSE_VERSIONS) {
        try {
            const parser = new MessageParser({ key: UDP_KEY, version });
            const payload = parser.parse(message)[0]?.payload as Record<string, unknown> | undefined;
            if (payload && typeof payload.gwId === "string" && typeof payload.ip === "string") {
                return {
                    id: payload.gwId,
                    ip: payload.ip,
                    version: typeof payload.version === "string" ? payload.version : version,
                    productKey: typeof payload.productKey === "string" ? payload.productKey : undefined,
                };
            }
        } catch {
            // not parseable with this protocol version, try the next one
        }
    }
    return null;
}

/**
 * Collects Tuya presence broadcasts until stop() is called.
 */
export class TuyaDiscovery {
    private readonly sockets: dgram.Socket[] = [];

    /**
     * @param onDevice - called for every received presence broadcast
     * @param onError - called if a port cannot be opened (e.g. already used exclusively by another program)
     */
    public constructor(
        private readonly onDevice: (device: DiscoveredDevice) => void,
        private readonly onError: (port: number, error: Error) => void,
    ) {}

    /** Opens the UDP listeners */
    public start(): void {
        for (const port of DISCOVERY_PORTS) {
            const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
            socket.on("message", (message: Buffer) => {
                const device = parseBroadcast(message);
                if (device) {
                    this.onDevice(device);
                }
            });
            socket.on("error", (error: Error) => {
                this.onError(port, error);
                this.closeSocket(socket);
            });
            socket.bind(port);
            this.sockets.push(socket);
        }
    }

    /** Closes all UDP listeners */
    public stop(): void {
        for (const socket of [...this.sockets]) {
            this.closeSocket(socket);
        }
    }

    private closeSocket(socket: dgram.Socket): void {
        const index = this.sockets.indexOf(socket);
        if (index !== -1) {
            this.sockets.splice(index, 1);
        }
        socket.removeAllListeners("message");
        try {
            socket.close();
        } catch {
            // socket was not bound or is already closed
        }
    }
}
