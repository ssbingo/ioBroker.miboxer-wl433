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

/** DP 101 frame of a received command as hex without the checksum */
function hexOf(dps) {
    return Buffer.from(dps[101], "base64").subarray(0, 11).toString("hex").match(/../g).join(" ").toUpperCase();
}

/**
 * Starts the simulator and the adapter for one suite. The test harness can start the adapter only once, so every zone
 * mode gets its own suite.
 *
 * @param getHarness - harness factory of the suite
 * @param zoneMode - "selector" or "channels"
 */
function setup(getHarness, zoneMode, extraNative = {}) {
    const ctx = {};
    ctx.st = async id => ctx.harness.states.getStateAsync(`${NS}.${id}`);
    ctx.set = async (id, val) => ctx.harness.states.setStateAsync(`${NS}.${id}`, { val, ack: false });
    ctx.framesSince = from => ctx.dev.received.slice(from).filter(dps => dps[101]).map(hexOf);
    ctx.acked = async (id, val) => {
        const s = await ctx.st(id);
        return s?.ack === true && s.val === val;
    };

    before(async function () {
        this.timeout(60000);
        ctx.dev = await fake.start(6668, { reportDelayMs: 300 });
        ctx.harness = getHarness();
        await ctx.harness.changeAdapterConfig("miboxer-wl433", {
            native: {
                ip: "127.0.0.1",
                deviceId: fake.DEVICE_ID,
                localKey: fake.LOCAL_KEY, // the harness encrypts encryptedNative fields itself
                protocolVersion: "3.3",
                reconnectInterval: 5,
                pollInterval: 0,
                zoneMode,
                timers: [],
                ...(typeof extraNative === "function" ? extraNative() : extraNative),
            },
        });
        await ctx.harness.startAdapterAndWait(true);
    });

    after(async function () {
        this.timeout(20000);
        if (ctx.harness?.isAdapterRunning()) {
            await ctx.harness.stopAdapter();
        }
        if (ctx.dev) await ctx.dev.stop();
    });
    return ctx;
}

tests.integration(path.join(__dirname, "../.."), {
    allowedExitCodes: [11],
    defineAdditionalTests({ suite }) {
        suite("E2E against simulated WL-433, zone mode selector", getHarness => {
            const ctx = setup(getHarness, "selector");
            const { st, set, framesSince, acked } = ctx;
            let harness;
            let dev;
            beforeEach(() => {
                harness = ctx.harness;
                dev = ctx.dev;
            });

            it("connects, queries the DP 101 status and maps it", async function () {
                this.timeout(20000);
                await waitFor(async () => (await st("info.connection"))?.val === true, 15000, "info.connection");
                await waitFor(async () => (await st("dp101.hex"))?.val?.startsWith("44"), 5000, "status answer");
                expect(framesSince(0)).to.include("43 00 00 80 00 00 00 00 00 80 80");
                expect((await st("light.on")).val).to.equal(true);
                expect((await st("light.mode")).val).to.equal("white");
                expect((await st("light.mode")).ack).to.equal(true);
                expect((await st("light.colorTemperature")).val).to.equal(6500);
                expect((await st("light.brightness")).val).to.equal(100);
                expect((await st("light.hue")).val).to.equal(240);
                expect((await st("light.saturation")).val).to.equal(0);
                expect((await st("light.color")).val).to.equal("#ffffff");
                expect((await st("light.scene")).val).to.equal(0);
                expect((await st("light.zone")).val).to.equal(0);
                expect((await st("info.ip")).val).to.equal("127.0.0.1");
                expect((await st("dp101.checksumValid")).val).to.equal(true);
                expect((await st("raw.dp102")).val).to.equal(7);
                expect(await harness.objects.getObjectAsync(`${NS}.zones.zone1`)).to.equal(null);
            });

            it("sets a colour with hue and saturation commands and acknowledges it from the status", async function () {
                this.timeout(15000);
                const from = dev.received.length;
                await set("light.color", "#00ff00");
                await waitFor(() => acked("light.color", "#00ff00"), 8000, "color ack");
                expect(framesSince(from)).to.deep.equal([
                    "41 00 00 0B 01 55 55 55 55 00 80",
                    "41 00 00 0B 04 64 00 00 00 00 80",
                ]);
                expect((await st("light.mode")).val).to.equal("colour");
                expect((await st("light.hue")).val).to.equal(120);
                expect((await st("light.saturation")).val).to.equal(100);
            });

            it("sends only the last value of rapid brightness changes", async function () {
                this.timeout(15000);
                const from = dev.received.length;
                await set("light.brightness", 10);
                await set("light.brightness", 20);
                await set("light.brightness", 40);
                await waitFor(() => acked("light.brightness", 40), 8000, "brightness ack");
                const frames = framesSince(from);
                expect(frames.at(-1)).to.equal("41 00 00 0B 02 28 00 00 00 00 80");
                expect(frames.length).to.be.lessThan(3);
            });

            it("switches to white mode before setting the colour temperature", async function () {
                this.timeout(15000);
                const from = dev.received.length;
                await set("light.colorTemperature", 4500);
                await waitFor(() => acked("light.colorTemperature", 4500), 8000, "ct ack");
                expect(framesSince(from)).to.deep.equal([
                    "41 00 00 0B 06 06 00 00 00 00 80",
                    "41 00 00 0B 03 12 00 00 00 00 80",
                ]);
                expect((await st("light.mode")).val).to.equal("white");
                expect((await st("light.brightness")).val).to.equal(100);
            });

            it("rejects an invalid colour without sending", async function () {
                this.timeout(5000);
                const before = dev.received.length;
                await set("light.color", "rot");
                await sleep(1000);
                expect(dev.received.length).to.equal(before);
            });

            it("selects a scene", async function () {
                this.timeout(15000);
                const from = dev.received.length;
                await set("light.scene", 3);
                await waitFor(() => acked("light.scene", 3), 8000, "scene ack");
                expect(framesSince(from)).to.deep.equal(["41 00 00 0B 05 03 00 00 00 00 80"]);
                expect((await st("light.mode")).val).to.equal("scene");
            });

            it("presses the speed buttons without waiting for a status", async function () {
                this.timeout(10000);
                const from = dev.received.length;
                await set("light.speedUp", true);
                await waitFor(() => framesSince(from).length === 1, 5000, "speed frame");
                expect(framesSince(from)).to.deep.equal(["41 00 00 0B 06 04 00 00 00 00 80"]);
                expect(dev.light.speed).to.equal(6);
            });

            it("switches off and on again with brightness > 0 like a dimmer", async function () {
                this.timeout(15000);
                let from = dev.received.length;
                await set("light.on", false);
                await waitFor(() => acked("light.on", false), 8000, "off");
                expect(framesSince(from)).to.deep.equal(["41 00 00 0B 06 02 00 00 00 00 80"]);
                from = dev.received.length;
                await set("light.brightness", 80);
                await waitFor(() => acked("light.brightness", 80), 8000, "on via dimmer");
                expect(framesSince(from)).to.deep.equal([
                    "41 00 00 0B 06 01 00 00 00 00 80",
                    "41 00 00 0B 02 50 00 00 00 00 80",
                ]);
                expect((await st("light.on")).val).to.equal(true);
                expect((await st("light.mode")).val).to.equal("scene");
            });

            it("processes changes made with the app", async function () {
                this.timeout(10000);
                dev.appCommand([0x41, 0, 0, 0x0b, 0x01, 0x10, 0x10, 0x10, 0x10, 0x01, 0x80]);
                await waitFor(() => acked("light.hue", 23), 5000, "app change");
                expect((await st("light.mode")).val).to.equal("colour");
            });

            it("sends the commands of light.* to the zone selected in light.zone", async function () {
                this.timeout(15000);
                await set("light.zone", 2);
                await waitFor(() => acked("light.zone", 2), 5000, "zone ack");
                const from = dev.received.length;
                await set("light.on", false);
                await waitFor(() => acked("light.on", false), 8000, "zone off");
                expect(framesSince(from)).to.deep.equal(["41 00 00 0B 06 02 00 00 00 02 80"]);
                await set("light.zone", 0);
                await waitFor(() => acked("light.zone", 0), 5000, "zone reset");
            });

            it("sends a DP 101 frame from hex and logs it in the history", async function () {
                this.timeout(10000);
                await set("dp101.hex", "43 00 00 80 00 00 00 00 00 80 80");
                await waitFor(async () => {
                    const history = JSON.parse((await st("dp101.history")).val);
                    return history.some(entry => entry.dir === "tx" && entry.base64 === "QwAAgAAAAAAAgIDD");
                }, 5000, "history tx");
                // the answer of the gateway must survive the confirmation of the sent frame
                await sleep(300);
                expect((await st("dp101.hex")).val.startsWith("44")).to.equal(true);
            });

            it("requests the status and gives up when the gateway does not confirm a command", async function () {
                this.timeout(20000);
                dev.ignoreFrames = true;
                const from = dev.received.length;
                await set("light.brightness", 55);
                await waitFor(() => framesSince(from).includes("43 00 00 80 00 00 00 00 00 80 80"), 9000, "query");
                await sleep(3500);
                const brightness = await st("light.brightness");
                expect(brightness.val).to.equal(55);
                expect(brightness.ack).to.equal(false);
                dev.ignoreFrames = false;
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

        suite("E2E against simulated WL-433, timers and DMX", getHarness => {
            // a timer that fires 45 s after the start of this suite and switches off 3 s later
            const ctx = setup(getHarness, "selector", () => {
                const due = new Date(Date.now() + 45_000);
                const pad = n => String(n).padStart(2, "0");
                return {
                    timers: [
                        {
                            enabled: true,
                            name: "E2E white",
                            trigger: "time",
                            time: `${pad(due.getHours())}:${pad(due.getMinutes())}:${pad(due.getSeconds())}`,
                            days: [1, 2, 3, 4, 5, 6, 7],
                            zone: 3,
                            action: "white",
                            temperature: 3000,
                            brightness: 50,
                            duration: 0.05,
                        },
                        { enabled: true, name: "E2E broken", trigger: "time", time: "20:00:00", action: "colour", color: "" },
                        { enabled: false, name: "E2E disabled", trigger: "time", time: "20:00:00" },
                    ],
                };
            });
            const { st, set, framesSince, acked } = ctx;
            let dev;
            beforeEach(() => {
                dev = ctx.dev;
            });

            it("plans the valid timer and reports the broken one", async function () {
                this.timeout(20000);
                await waitFor(async () => (await st("dp101.hex"))?.val?.startsWith("44"), 10000, "status answer");
                await waitFor(async () => (await st("timers.overview"))?.val?.includes("E2E white"), 10000, "overview");
                const overview = JSON.parse((await st("timers.overview")).val);
                expect(overview).to.have.length(3);
                expect(overview[0].nextRun).to.be.a("string");
                expect(overview[1].error).to.equal("action colour needs a colour like #0000ff");
                expect(overview[2].enabled).to.equal(false);
                expect((await st("timers.nextRun")).val).to.include("E2E white");
            });

            it("sets the DMX start address and takes it from the answer of the gateway", async function () {
                this.timeout(15000);
                const from = dev.received.length;
                await set("settings.dmxAddress", 300);
                await waitFor(() => acked("settings.dmxAddress", 300), 5000, "dmx ack");
                expect(framesSince(from)).to.deep.equal(["49 00 00 0B 02 01 2C 00 00 00 80"]);
                expect(dev.light.dmx).to.equal(300);
            });

            it("runs the timer at its time and switches off after the duration", async function () {
                this.timeout(90000);
                const from = dev.received.length;
                await waitFor(async () => (await st("timers.lastRun"))?.val?.includes("E2E white"), 75000, "timer run");
                await waitFor(() => framesSince(from).includes("41 00 00 0B 06 02 00 00 00 03 80"), 15000, "timer off");
                const frames = framesSince(from);
                expect(frames).to.include("41 00 00 0B 03 03 00 00 00 03 80");
                expect(frames).to.include("41 00 00 0B 02 32 00 00 00 03 80");
                expect((await st("light.zone")).val).to.equal(0);
            });

            it("pauses all timers with timers.active", async function () {
                this.timeout(10000);
                await set("timers.active", false);
                await waitFor(() => acked("timers.active", false), 5000, "pause");
                await waitFor(async () => (await st("timers.nextRun"))?.val?.startsWith("paused"), 5000, "paused text");
                await set("timers.active", true);
                await waitFor(() => acked("timers.active", true), 5000, "resume");
            });
        });

        suite("E2E against simulated WL-433, zone mode channels", getHarness => {
            const ctx = setup(getHarness, "channels");
            const { st, set, framesSince, acked } = ctx;
            let harness;
            let dev;
            beforeEach(() => {
                harness = ctx.harness;
                dev = ctx.dev;
            });

            it("creates one channel per zone in the zone mode 'channels'", async function () {
                this.timeout(20000);
                await waitFor(async () => (await st("dp101.hex"))?.val?.startsWith("44"), 5000, "status answer");
                expect(await harness.objects.getObjectAsync(`${NS}.light.zone`)).to.equal(null);
                expect((await harness.objects.getObjectAsync(`${NS}.zones.zone8.brightness`))?.common.role).to.equal(
                    "level.dimmer",
                );
            });

            it("controls a single zone and shows the confirmed values in its channel", async function () {
                this.timeout(15000);
                await sleep(1000);
                const from = dev.received.length;
                await set("zones.zone2.brightness", 30);
                await waitFor(() => acked("zones.zone2.brightness", 30), 8000, "zone brightness ack");
                expect(framesSince(from)).to.deep.equal([
                    "41 00 00 0B 06 01 00 00 00 02 80",
                    "41 00 00 0B 02 1E 00 00 00 02 80",
                ]);
                expect(await acked("zones.zone2.on", true)).to.equal(true);
                expect((await st("zones.zone3.brightness"))?.val ?? null).to.equal(null);
            });

            it("updates every zone channel with a command of light.* (all zones)", async function () {
                this.timeout(15000);
                const from = dev.received.length;
                await set("light.brightness", 60);
                await waitFor(() => acked("zones.zone5.brightness", 60), 8000, "all zones");
                expect(framesSince(from)).to.deep.equal(["41 00 00 0B 02 3C 00 00 00 00 80"]);
                expect(await acked("zones.zone2.brightness", 60)).to.equal(true);
            });

        });
    },
});
