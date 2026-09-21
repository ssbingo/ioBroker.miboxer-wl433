// Simulated MiBoxer WL-433: Tuya protocol 3.3 device on TCP 6668, built with tuyapi's own codec.
// Used by the E2E tests and standalone for manual tests with the dev-server: "npm run simulator".
const dgram = require("dgram");
const net = require("net");
const { UDP_KEY } = require("tuyapi/lib/config");
const { MessageParser, CommandType } = require("tuyapi/lib/message-parser");

const DEVICE_ID = "bf0000000000wl433abc";
const LOCAL_KEY = "0123456789abcdef";

function start(port = 6668) {
    const parser = new MessageParser({ key: LOCAL_KEY, version: "3.3" });
    const dev = {
        state: { 20: true, 21: "white", 22: 500, 23: 0, 24: "000003e803e8", 26: 0, 101: "QwAAgAAAAAAAgIDD", 102: 7 },
        received: [],
        sockets: new Set(),
        rejectConnections: false,
        onCommand: null,
    };
    const send = (sock, commandByte, data, sequenceN) => {
        sock.write(parser.encode({ data, commandByte, sequenceN, encrypted: true }));
    };
    dev.push = dps => {
        Object.assign(dev.state, dps);
        for (const sock of dev.sockets) {
            send(sock, CommandType.STATUS, { devId: DEVICE_ID, dps, t: Math.floor(Date.now() / 1000) }, 0);
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
                    Object.assign(dev.state, dps);
                    const answer = { ...dps };
                    if ("101" in dps) {
                        // gateway answers a DP 101 command with a status frame
                        answer[101] = "RAAAAAABAAEACwFS";
                        dev.state[101] = answer[101];
                    }
                    send(sock, CommandType.CONTROL, Buffer.alloc(0), p.sequenceN);
                    send(sock, CommandType.STATUS, { devId: DEVICE_ID, dps: answer, t: Math.floor(Date.now() / 1000) }, p.sequenceN);
                }
            }
        });
    });
    dev.dropAll = () => {
        for (const sock of dev.sockets) sock.destroy();
    };
    dev.stop = () =>
        new Promise(resolve => {
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

module.exports = { start, DEVICE_ID, LOCAL_KEY };

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
