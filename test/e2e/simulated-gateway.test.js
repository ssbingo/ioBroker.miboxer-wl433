// End-to-end test of the adapter against a simulated WL-433 gateway (Tuya protocol 3.3 on 127.0.0.1:6668).
// Not part of CI, run manually with "npm run test:e2e" after "npm run build".
const path = require("path");
const { tests } = require("@iobroker/testing");
const { expect } = require("chai");
const fake = require("./fake-wl433");

const NS = "miboxer-wl433.0";


const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(check, timeout = 10000, what = "condition") {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
        try {
            last = await check();
            if (last) return last;
        } catch {
            // retry
        }
        await sleep(200);
    }
    throw new Error(`timeout waiting for ${what}`);
}

tests.integration(path.join(__dirname, "../.."), {
    allowedExitCodes: [11],
    defineAdditionalTests({ suite }) {
        suite("E2E against simulated WL-433", getHarness => {
            let harness;
            let dev;
            const st = async id => harness.states.getStateAsync(`${NS}.${id}`);
            const set = async (id, val) => harness.states.setStateAsync(`${NS}.${id}`, { val, ack: false });

            before(async function () {
                this.timeout(60000);
                dev = await fake.start(6668);
                harness = getHarness();
                await harness.changeAdapterConfig("miboxer-wl433", {
                    native: {
                        ip: "127.0.0.1",
                        deviceId: fake.DEVICE_ID,
                        localKey: fake.LOCAL_KEY, // the harness encrypts encryptedNative fields itself
                        protocolVersion: "3.3",
                        reconnectInterval: 5,
                        pollInterval: 0,
                    },
                });
                await harness.startAdapterAndWait();
            });

            after(async function () {
                this.timeout(20000);
                if (dev) await dev.stop();
            });

            it("connects and maps the initial datapoints", async function () {
                this.timeout(20000);
                await waitFor(async () => (await st("info.connection"))?.val === true, 15000, "info.connection");
                await waitFor(async () => (await st("light.brightness"))?.val === 50, 5000, "brightness");
                expect((await st("light.on")).val).to.equal(true);
                expect((await st("light.on")).ack).to.equal(true);
                expect((await st("light.mode")).val).to.equal("white");
                expect((await st("light.colorTemperature")).val).to.equal(2700);
                expect((await st("light.color")).val).to.equal("#ff0000");
                expect((await st("light.countdown")).val).to.equal(0);
                expect((await st("info.ip")).val).to.equal("127.0.0.1");
                expect((await st("dp101.raw")).val).to.equal("QwAAgAAAAAAAgIDD");
                expect((await st("dp101.hex")).val).to.equal("43 00 00 80 00 00 00 00 00 80 80 C3");
                expect((await st("dp101.checksumValid")).val).to.equal(true);
                expect((await st("raw.dp102")).val).to.equal(7);
                const obj = await harness.objects.getObjectAsync(`${NS}.raw.dp102`);
                expect(obj.common.type).to.equal("number");
                expect(obj.common.role).to.equal("level");
            });

            it("sets a colour (mode colour + DP 24) and acknowledges it", async function () {
                this.timeout(10000);
                const before = dev.received.length;
                await set("light.color", "#00ff00");
                await waitFor(async () => (await st("light.color"))?.ack === true, 5000, "color ack");
                expect(dev.received.length).to.equal(before + 1);
                expect(dev.received.at(-1)).to.deep.equal({ 21: "colour", 24: "007803e803e8" });
                expect((await st("light.color")).val).to.equal("#00ff00");
                expect((await st("light.mode")).val).to.equal("colour");
                expect((await st("light.brightness")).val).to.equal(100);
            });

            it("dims in colour mode via the v part of DP 24 and merges rapid changes", async function () {
                this.timeout(10000);
                const before = dev.received.length;
                await set("light.brightness", 10);
                await set("light.brightness", 20);
                await set("light.brightness", 40);
                await waitFor(async () => {
                    const s = await st("light.brightness");
                    return s?.ack === true && s.val === 40;
                }, 5000, "brightness ack");
                await sleep(500);
                expect(dev.received.length).to.equal(before + 1);
                expect(dev.received.at(-1)).to.deep.equal({ 24: "007803e80190" });
                expect((await st("light.color")).val).to.equal("#006600");
            });

            it("sets the colour temperature (mode white + DP 23)", async function () {
                this.timeout(10000);
                await set("light.colorTemperature", 4600);
                await waitFor(async () => (await st("light.colorTemperature"))?.ack === true, 5000, "ct ack");
                expect(dev.received.at(-1)).to.deep.equal({ 21: "white", 23: 500 });
                expect((await st("light.colorTemperature")).val).to.equal(4600);
                expect((await st("light.mode")).val).to.equal("white");
                expect((await st("light.brightness")).val).to.equal(50);
            });

            it("rejects an invalid colour without sending", async function () {
                this.timeout(5000);
                const before = dev.received.length;
                await set("light.color", "rot");
                await sleep(1000);
                expect(dev.received.length).to.equal(before);
            });

            it("sends a DP 101 frame from hex with checksum, logs tx and rx in the history", async function () {
                this.timeout(10000);
                await set("dp101.hex", "42 00 00 00 02 01 00 01 00 0b 01");
                await waitFor(async () => (await st("dp101.raw"))?.val === "RAAAAAABAAEACwFS", 5000, "dp101 answer");
                expect(dev.received.at(-1)).to.deep.equal({ 101: "QgAAAAIBAAEACwFS" });
                await sleep(300);
                // the answer of the gateway must survive the confirmation of the sent frame
                expect((await st("dp101.raw")).val).to.equal("RAAAAAABAAEACwFS");
                expect((await st("dp101.raw")).ack).to.equal(true);
                const history = JSON.parse((await st("dp101.history")).val);
                const last2 = history.slice(-2).map(e => `${e.dir}:${e.base64}`);
                expect(last2).to.deep.equal(["tx:QgAAAAIBAAEACwFS", "rx:RAAAAAABAAEACwFS"]);
            });

            it("processes status pushes of the gateway (e.g. app via cloud)", async function () {
                this.timeout(10000);
                dev.push({ 20: false });
                await waitFor(async () => (await st("light.on"))?.val === false, 5000, "push");
                expect((await st("light.on")).ack).to.equal(true);
            });

            it("switches on with brightness > 0 like a dimmer", async function () {
                this.timeout(10000);
                await set("light.brightness", 80);
                await waitFor(async () => (await st("light.on"))?.val === true, 5000, "on via dimmer");
                expect(dev.received.at(-1)).to.deep.equal({ 20: true, 22: 800 });
            });

            it("writes unknown datapoints via raw.dp<n> with the right type", async function () {
                this.timeout(10000);
                await set("raw.dp102", "9");
                await waitFor(async () => (await st("raw.dp102"))?.ack === true, 5000, "raw ack");
                expect(dev.received.at(-1)).to.deep.equal({ 102: 9 });
            });

            it("answers the discover request from the running connection", async function () {
                this.timeout(10000);
                const response = await new Promise(resolve =>
                    harness.sendTo(NS, "discover", { deviceId: fake.DEVICE_ID }, resolve),
                );
                expect(response).to.deep.equal({
                    result: "found",
                    args: ["127.0.0.1", "3.3"],
                    native: { ip: "127.0.0.1", protocolVersion: "3.3" },
                });
            });

            it("reconnects after the gateway dropped the connection", async function () {
                this.timeout(30000);
                dev.dropAll();
                await waitFor(async () => (await st("info.connection"))?.val === false, 5000, "disconnect");
                await waitFor(async () => (await st("info.connection"))?.val === true, 15000, "reconnect");
            });

            it("releases the connection on unload", async function () {
                this.timeout(20000);
                await harness.stopAdapter();
                await waitFor(() => dev.sockets.size === 0, 5000, "socket closed");
            });
        });
    },
});
