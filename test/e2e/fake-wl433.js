// Simulated MiBoxer WL-433: Tuya protocol 3.3 device on TCP 6668, built with tuyapi's own codec.
// Used by the E2E tests and standalone for manual tests with the dev-server: "npm run simulator".
// Datapoint 101 behaves like the real gateway (captures of 2026-09-22): commands (0x41) change the status and the
// derived datapoints 20..23, the status is reported (0x42) some time after the last change, a status query (0x43) is
// answered at once (0x44), other frames are ignored without an answer.
const dgram = require("dgram");
const net = require("net");
const { UDP_KEY } = require("tuyapi/lib/config");
const { MessageParser, CommandType } = require("tuyapi/lib/message-parser");

const DEVICE_ID = "bf0000000000wl433abc";
const LOCAL_KEY = "0123456789abcdef";

function checksum(bytes) {
    return bytes.reduce((sum, b) => sum + b, 0) & 0xff;
}

function frame(payload) {
    return Buffer.from([...payload, checksum(payload)]).toString("base64");
}

/** Light model of the gateway: one status for all zones, the last setting wins */
function createLight() {
    return {
        mode: 0x02, // 00 off, 01 colour, 02 white, 03..0B scene 1..9
        lastMode: 0x02,
        hue: 0xab,
        temperature: 38,
        colourBrightness: 100,
        whiteBrightness: 100,
        sceneBrightness: 100,
        saturation: 100,
        speed: 5,
    };
}

function statusFrame(light, type) {
    const mode = light.mode === 0 ? light.lastMode : light.mode;
    const brightness =
        mode === 0x01 ? light.colourBrightness : mode === 0x02 ? light.whiteBrightness : light.sceneBrightness;
    const saturation = mode === 0x01 ? light.saturation : mode === 0x02 ? 0 : mode === 0x03 ? 86 : 0;
    return frame([type, 0, 0, 0, light.mode, light.hue, light.temperature, brightness, saturation, 0x0b, 0x01]);
}

function modeName(mode) {
    return mode === 0x01 ? "colour" : mode === 0x02 ? "white" : "scene";
}

/**
 * Applies a command frame, returns the derived standard datapoints the real gateway reports.
 *
 * @param light - light model
 * @param bytes - frame bytes
 */
function applyCommand(light, bytes) {
    const [, , , , command, value] = bytes;
    const on = mode => {
        light.mode = mode;
        light.lastMode = mode;
    };
    const current = light.mode === 0 ? light.lastMode : light.mode;
    switch (command) {
        case 0x01:
            light.hue = value;
            on(0x01);
            return { 21: "colour" };
        case 0x02:
            if (current === 0x01) {
                light.colourBrightness = value;
            } else if (current === 0x02) {
                light.whiteBrightness = value;
            } else {
                light.sceneBrightness = value;
            }
            return { 22: value * 10 };
        case 0x03:
            light.temperature = value;
            return { 23: value * 26 };
        case 0x04:
            light.saturation = value;
            return {};
        case 0x05:
            on(0x02 + value);
            return { 21: "scene" };
        case 0x06:
            if (value === 0x01) {
                light.mode = light.lastMode;
                return { 20: true, 21: modeName(light.mode) };
            }
            if (value === 0x02) {
                light.lastMode = current;
                light.mode = 0;
                return { 20: false, 21: "white" };
            }
            if (value === 0x06) {
                on(0x02);
                return { 21: "white" };
            }
            if (value === 0x03 || value === 0x04) {
                light.speed += value === 0x04 ? 1 : -1;
            }
            return {};
        default:
            return {};
    }
}

function start(port = 6668, options = {}) {
    const parser = new MessageParser({ key: LOCAL_KEY, version: "3.3" });
    const light = createLight();
    const dev = {
        light,
        state: { 20: true, 21: "white", 22: 1000, 23: 1000, 26: 0, 101: statusFrame(light, 0x42), 102: 7 },
        received: [],
        sockets: new Set(),
        rejectConnections: false,
        /** true: DP 101 commands and queries are accepted but never answered (for the confirmation timeout) */
        ignoreFrames: false,
        /** the real gateway reports about 2.5 s after the last change */
        reportDelayMs: options.reportDelayMs ?? 2500,
        onCommand: null,
    };
    let reportTimer;
    const send = (sock, commandByte, data, sequenceN) => {
        sock.write(parser.encode({ data, commandByte, sequenceN, encrypted: true }));
    };
    dev.push = dps => {
        Object.assign(dev.state, dps);
        for (const sock of dev.sockets) {
            send(sock, CommandType.STATUS, { devId: DEVICE_ID, dps, t: Math.floor(Date.now() / 1000) }, 0);
        }
    };
    const scheduleReport = () => {
        clearTimeout(reportTimer);
        reportTimer = setTimeout(() => dev.push({ 101: statusFrame(light, 0x42) }), dev.reportDelayMs);
    };
    /** Command as if it came from the MiBoxer app (cloud or second LAN connection) */
    dev.appCommand = payload => {
        const derived = applyCommand(light, payload);
        if (Object.keys(derived).length) {
            dev.push(derived);
        }
        scheduleReport();
    };
    const handleFrame = base64 => {
        const bytes = [...Buffer.from(base64, "base64")];
        if (dev.ignoreFrames || bytes.length !== 12 || checksum(bytes.slice(0, 11)) !== bytes[11]) {
            return;
        }
        if (bytes[0] === 0x43) {
            setTimeout(() => dev.push({ 101: statusFrame(light, 0x44) }), 20);
        } else if (bytes[0] === 0x41) {
            const derived = applyCommand(light, bytes);
            if (Object.keys(derived).length) {
                setTimeout(() => dev.push(derived), 20);
            }
            scheduleReport();
        }
    };
    dev.server = net.createServer(sock => {
        if (dev.rejectConnections) {
            sock.destroy();
            return;
        }
        dev.sockets.add(sock);
        sock.on("close", () => dev.sockets.delete(sock));
        sock.on("error", () => {});
        sock.on("data", buf => {
            let packets;
            try {
                packets = parser.parse(buf);
            } catch (e) {
                console.error("FAKE parse error", e.message);
                return;
            }
            for (const p of packets) {
                if (p.commandByte === CommandType.HEART_BEAT) {
                    send(sock, CommandType.HEART_BEAT, Buffer.alloc(0), p.sequenceN);
                } else if (p.commandByte === CommandType.DP_QUERY) {
                    send(sock, CommandType.DP_QUERY, { devId: DEVICE_ID, dps: dev.state }, p.sequenceN);
                } else if (p.commandByte === CommandType.CONTROL) {
                    const dps = p.payload.dps;
                    dev.received.push(dps);
                    dev.onCommand?.(dps);
                    send(sock, CommandType.CONTROL, Buffer.alloc(0), p.sequenceN);
                    const { 101: raw, ...others } = dps;
                    if (raw !== undefined) {
                        handleFrame(raw);
                    }
                    if (Object.keys(others).length) {
                        Object.assign(dev.state, others);
                        send(
                            sock,
                            CommandType.STATUS,
                            { devId: DEVICE_ID, dps: others, t: Math.floor(Date.now() / 1000) },
                            p.sequenceN,
                        );
                    }
                }
            }
        });
    });
    dev.dropAll = () => {
        for (const sock of dev.sockets) sock.destroy();
    };
    dev.stop = () =>
        new Promise(resolve => {
            clearTimeout(reportTimer);
            dev.dropAll();
            dev.server.close(() => resolve());
        });
    return new Promise(resolve => dev.server.listen(port, "127.0.0.1", () => resolve(dev)));
}

/**
 * Sends the presence broadcast of the simulated gateway to 127.0.0.1:6667 every 5 s, so the automatic IP search and
 * the "Search gateway" button of the adapter find it.
 */
function startBroadcast() {
    const socket = dgram.createSocket("udp4");
    const parser = new MessageParser({ key: UDP_KEY, version: "3.3" });
    const message = parser.encode({
        data: { ip: "127.0.0.1", gwId: DEVICE_ID, active: 2, encrypt: true, productKey: "simulator", version: "3.3" },
        encrypted: true,
        commandByte: CommandType.UDP_NEW,
        sequenceN: 0,
    });
    const timer = setInterval(() => socket.send(message, 6667, "127.0.0.1"), 5000);
    return () => {
        clearInterval(timer);
        socket.close();
    };
}

module.exports = { start, DEVICE_ID, LOCAL_KEY, frame };

if (require.main === module) {
    start(6668).then(dev => {
        const stopBroadcast = startBroadcast();
        dev.onCommand = dps => console.log(`${new Date().toLocaleTimeString()}  command received: ${JSON.stringify(dps)}`);
        console.log("Simulated MiBoxer WL-433 (Tuya protocol 3.3) listening on 127.0.0.1:6668");
        console.log(`  Device ID : ${DEVICE_ID}`);
        console.log(`  Local key : ${LOCAL_KEY}`);
        console.log("  IP address: 127.0.0.1 (or leave empty, presence broadcasts are sent every 5 s)");
        console.log("Press Ctrl+C to stop.");
        process.on("SIGINT", async () => {
            stopBroadcast();
            await dev.stop();
            process.exit(0);
        });
    });
}
