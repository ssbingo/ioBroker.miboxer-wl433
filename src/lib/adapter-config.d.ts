// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** IP address of the WL-433 gateway, empty = find it via UDP broadcast */
            ip: string;
            /** Tuya device ID of the WL-433 gateway */
            deviceId: string;
            /** 16-character Tuya local key (stored encrypted) */
            localKey: string;
            /** Tuya LAN protocol version: "3.1", "3.3", "3.4" or "3.5" */
            protocolVersion: string;
            /** Delay in seconds before a lost or failed connection is retried */
            reconnectInterval: number;
            /** Interval in seconds for a full status refresh, 0 = only rely on pushed updates */
            pollInterval: number;
            /** "selector" = zone selector state light.zone, "channels" = one channel per zone (zones.zone1..8) */
            zoneMode: string;
            /** timers of the tab "Timers", see src/lib/timers.ts (TimerConfig) */
            timers: Record<string, unknown>[];
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
