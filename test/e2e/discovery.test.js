// End-to-end test: IP discovery via UDP broadcast, reconnect handling and resource cleanup.
// Not part of CI, run manually with "npm run test:e2e" after "npm run build".
const dgram = require("dgram");
const path = require("path");
const { tests } = require("@iobroker/testing");
const { expect } = require("chai");
const { MessageParser, CommandType } = require("tuyapi/lib/message-parser");
const { UDP_KEY } = require("tuyapi/lib/config");
const fake = require("./fake-wl433");

const NS = "miboxer-wl433.0";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(check, timeout = 10000, what = "condition") {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        try {
            if (await check()) return;
        } catch {
            // retry
        }
        await sleep(200);
    }
    throw new Error(`timeout waiting for ${what}`);
}

function startBroadcasting(devices) {
    const socket = dgram.createSocket("udp4");
    const parser = new MessageParser({ key: UDP_KEY, version: "3.3" });
    const timer = setInterval(() => {
        for (const d of devices) {
            const msg = parser.encode({
                data: { ip: d.ip, gwId: d.id, active: 2, encrypt: true, productKey: "key", version: "3.3" },
                encrypted: true,
                commandByte: CommandType.UDP_NEW,
                sequenceN: 0,
            });
            socket.send(msg, 6667, "127.0.0.1");
        }
    }, 1000);
    return () => {
        clearInterval(timer);
        socket.close();
    };
}

tests.integration(path.join(__dirname, "../.."), {
    allowedExitCodes: [11],
    defineAdditionalTests({ suite }) {
        suite("E2E discovery and connection problems", getHarness => {
            let harness;
            let dev;
            let stopBroadcast;
            const st = async id => harness.states.getStateAsync(`${NS}.${id}`);

            before(async function () {
                this.timeout(60000);
                dev = await fake.start(6668);
                stopBroadcast = startBroadcasting([
                    { id: "otherdevice000000001", ip: "10.0.0.99" },
                    { id: fake.DEVICE_ID, ip: "127.0.0.1" },
                ]);
                harness = getHarness();
                await harness.changeAdapterConfig("miboxer-wl433", {
                    native: {
                        ip: "",
                        deviceId: fake.DEVICE_ID,
                        localKey: fake.LOCAL_KEY,
                        protocolVersion: "3.3",
                        reconnectInterval: 5,
                        pollInterval: 10,
                    },
                });
                await harness.startAdapterAndWait();
            });

            after(async function () {
                this.timeout(20000);
                stopBroadcast?.();
                if (dev) await dev.stop();
            });

            it("finds the gateway IP via UDP broadcast and connects", async function () {
                this.timeout(30000);
                await waitFor(async () => (await st("info.connection"))?.val === true, 25000, "connection");
                expect((await st("info.ip")).val).to.equal("127.0.0.1");
            });

            it("lists all Tuya devices when the discover request has no device ID", async function () {
                this.timeout(20000);
                const response = await new Promise(resolve => harness.sendTo(NS, "discover", { deviceId: "" }, resolve));
                expect(response.result).to.equal("list");
                expect(response.args[0]).to.contain("otherdevice000000001 @ 10.0.0.99 (3.3)");
                expect(response.args[0]).to.contain(`${fake.DEVICE_ID} @ 127.0.0.1 (3.3)`);
                expect(response.native).to.deep.equal({});
            });

            it("reports an unknown device ID together with the devices found", async function () {
                this.timeout(20000);
                const response = await new Promise(resolve =>
                    harness.sendTo(NS, "discover", { deviceId: "doesnotexist" }, resolve),
                );
                expect(response.error).to.equal("notFoundOthers");
                expect(response.args[0]).to.equal("doesnotexist");
            });

            it("keeps retrying while the gateway refuses connections and recovers afterwards", async function () {
                this.timeout(90000);
                dev.rejectConnections = true;
                dev.dropAll();
                await waitFor(async () => (await st("info.connection"))?.val === false, 5000, "disconnect");
                // 3 failed attempts with 5 s delay trigger the hint (checked in the log output)
                await sleep(32000);
                dev.rejectConnections = false;
                await waitFor(async () => (await st("info.connection"))?.val === true, 40000, "recovery");
                // wait for the "stable again" message
                await sleep(11000);
            });

            it("releases everything on unload", async function () {
                this.timeout(20000);
                await harness.stopAdapter();
                await waitFor(() => dev.sockets.size === 0, 5000, "socket closed");
                // UDP ports must be free again: bind exclusively
                const s = dgram.createSocket({ type: "udp4", reuseAddr: false });
                await new Promise((resolve, reject) => {
                    s.once("error", reject);
                    s.bind(6666, () => resolve());
                });
                s.close();
            });
        });
    },
});
