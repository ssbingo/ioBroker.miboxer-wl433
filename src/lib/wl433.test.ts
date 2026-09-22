import { expect } from "chai";
import { decodeDp101, encodeDp101Hex } from "./dp101";
import {
    buildCommand,
    buildDmxCommand,
    buildStatusQuery,
    COMMAND,
    describeCommand,
    describeStatus,
    KEY,
    parseDmxAnswer,
    parseStatus,
    ZONE_ALL,
} from "./wl433";

// Commands of the MiBoxer app, read from its Android log ("ayxsendData") on 2026-09-22
const APP_COMMANDS: { hex: string; command: number; value: number; zone: number }[] = [
    { hex: "41 00 00 0B 01 49 49 49 49 01 80 F2", command: COMMAND.HUE, value: 0x49, zone: 1 },
    { hex: "41 00 00 0B 01 F7 F7 F7 F7 02 80 AB", command: COMMAND.HUE, value: 0xf7, zone: 2 },
    { hex: "41 00 00 0B 01 52 52 52 52 00 80 15", command: COMMAND.HUE, value: 0x52, zone: ZONE_ALL },
    { hex: "41 00 00 0B 02 33 00 00 00 01 80 02", command: COMMAND.BRIGHTNESS, value: 51, zone: 1 },
    { hex: "41 00 00 0B 03 12 00 00 00 01 80 E2", command: COMMAND.TEMPERATURE, value: 18, zone: 1 },
    { hex: "41 00 00 0B 04 34 00 00 00 01 80 05", command: COMMAND.SATURATION, value: 52, zone: 1 },
    { hex: "41 00 00 0B 05 01 00 00 00 01 80 D3", command: COMMAND.SCENE, value: 1, zone: 1 },
    { hex: "41 00 00 0B 06 01 00 00 00 01 80 D4", command: COMMAND.KEY, value: KEY.ON, zone: 1 },
    { hex: "41 00 00 0B 06 02 00 00 00 01 80 D5", command: COMMAND.KEY, value: KEY.OFF, zone: 1 },
    { hex: "41 00 00 0B 06 03 00 00 00 01 80 D6", command: COMMAND.KEY, value: KEY.SPEED_DOWN, zone: 1 },
    { hex: "41 00 00 0B 06 04 00 00 00 01 80 D7", command: COMMAND.KEY, value: KEY.SPEED_UP, zone: 1 },
    { hex: "41 00 00 0B 06 06 00 00 00 01 80 D9", command: COMMAND.KEY, value: KEY.WHITE, zone: 1 },
];

describe("wl433 => buildCommand", () => {
    for (const sample of APP_COMMANDS) {
        it(`builds the app command ${sample.hex}`, () => {
            const frame = buildCommand(sample.command, sample.value, sample.zone);
            expect(frame.hex).to.equal(sample.hex);
            expect(frame.checksumValid).to.equal(true);
        });
    }

    it("rejects values outside the documented ranges", () => {
        expect(() => buildCommand(COMMAND.BRIGHTNESS, 0, 1)).to.throw(RangeError);
        expect(() => buildCommand(COMMAND.BRIGHTNESS, 101, 1)).to.throw(RangeError);
        expect(() => buildCommand(COMMAND.TEMPERATURE, 39, 1)).to.throw(RangeError);
        expect(() => buildCommand(COMMAND.SCENE, 10, 1)).to.throw(RangeError);
        expect(() => buildCommand(COMMAND.HUE, 256, 1)).to.throw(RangeError);
        expect(() => buildCommand(COMMAND.HUE, 1.5, 1)).to.throw(RangeError);
        expect(() => buildCommand(COMMAND.KEY, 0x05, 1)).to.throw(RangeError);
        expect(() => buildCommand(0x07, 1, 1)).to.throw(RangeError);
        expect(() => buildCommand(COMMAND.HUE, 1, 9)).to.throw(RangeError);
    });
});

describe("wl433 => buildStatusQuery", () => {
    it("builds the query the app sends when it opens", () => {
        expect(buildStatusQuery().base64).to.equal("QwAAgAAAAAAAgIDD");
    });
});

describe("wl433 => parseStatus", () => {
    it("decodes a change report in colour mode", () => {
        const status = parseStatus(decodeDp101("QgAAAAH7JmQvCwED"));
        expect(status).to.deep.include({
            type: "report",
            on: true,
            mode: "colour",
            scene: 0,
            hue: 0xfb,
            temperature: 38,
            brightness: 100,
            saturation: 47,
        });
    });

    it("decodes the answer to the status query", () => {
        const status = parseStatus(decodeDp101("RAAAAAH7JmQvCwEF"));
        expect(status?.type).to.equal("answer");
        expect(status?.mode).to.equal("colour");
    });

    it("decodes white mode, off and scenes", () => {
        expect(parseStatus(encodeDp101Hex("42 00 00 00 02 49 12 64 00 0B 01").frame)).to.deep.include({
            on: true,
            mode: "white",
            temperature: 18,
            brightness: 100,
        });
        expect(parseStatus(encodeDp101Hex("42 00 00 00 00 49 12 64 56 0B 01").frame)).to.deep.include({
            on: false,
            mode: undefined,
            scene: 0,
            brightness: 100,
        });
        expect(parseStatus(encodeDp101Hex("42 00 00 00 03 49 12 64 56 0B 01").frame)).to.deep.include({
            on: true,
            mode: "scene",
            scene: 1,
            saturation: 86,
        });
        expect(parseStatus(encodeDp101Hex("42 00 00 00 0B 49 12 64 56 0B 01").frame)?.scene).to.equal(9);
    });

    it("gives identical states the same signature regardless of the frame type", () => {
        const report = parseStatus(decodeDp101("QgAAAAH7JmQvCwED"));
        const answer = parseStatus(decodeDp101("RAAAAAH7JmQvCwEF"));
        expect(report?.signature).to.equal(answer?.signature);
    });

    it("ignores commands, queries, invalid checksums and unknown modes", () => {
        expect(parseStatus(decodeDp101("QQAACwYBAAAAAIDT"))).to.equal(null);
        expect(parseStatus(buildStatusQuery())).to.equal(null);
        expect(parseStatus(decodeDp101("QgAAAAH7JmQvCwEE"))).to.equal(null);
        expect(parseStatus(encodeDp101Hex("42 00 00 00 0C 49 12 64 56 0B 01").frame)).to.equal(null);
        expect(parseStatus(decodeDp101("AQID"))).to.equal(null);
    });
});

describe("wl433 => DMX start address", () => {
    it("builds the commands of the app (captured 2026-09-22, zone 2 selected)", () => {
        expect(buildDmxCommand(123, 2).hex).to.equal("49 00 00 0B 02 00 7B 00 00 02 80 53");
        expect(buildDmxCommand(300, 2).hex).to.equal("49 00 00 0B 02 01 2C 00 00 02 80 05");
        expect(buildDmxCommand(1, 2).hex).to.equal("49 00 00 0B 02 00 01 00 00 02 80 D9");
    });

    it("rejects addresses outside 1..512", () => {
        expect(() => buildDmxCommand(0, 0)).to.throw(RangeError);
        expect(() => buildDmxCommand(513, 0)).to.throw(RangeError);
    });

    it("decodes the answers of the gateway", () => {
        expect(parseDmxAnswer(encodeDp101Hex("49 00 00 0B 02 01 03 28 00 00 7B").frame)).to.equal(123);
        expect(parseDmxAnswer(encodeDp101Hex("49 00 00 0B 02 01 03 28 00 01 2C").frame)).to.equal(300);
        // the frame published in tinytuya #623
        expect(parseDmxAnswer(encodeDp101Hex("49 00 00 0B 02 01 00 01 00 00 01").frame)).to.equal(1);
        expect(parseDmxAnswer(buildDmxCommand(123, 2))).to.equal(null);
        expect(parseDmxAnswer(decodeDp101("QgAAAAH7JmQvCwED"))).to.equal(null);
    });

    it("reads the low byte of the DMX address from the status", () => {
        expect(parseStatus(encodeDp101Hex("44 00 00 00 02 AB 03 28 00 0B 7B").frame)?.dmxLowByte).to.equal(0x7b);
    });
});

describe("wl433 => log texts", () => {
    it("describes commands and states", () => {
        expect(describeCommand(COMMAND.BRIGHTNESS, 40, 2)).to.equal("brightness 40 (zone 2)");
        expect(describeCommand(COMMAND.KEY, KEY.OFF, ZONE_ALL)).to.equal("key off (all zones)");
        const status = parseStatus(encodeDp101Hex("42 00 00 00 03 49 12 64 56 0B 01").frame);
        expect(status && describeStatus(status)).to.equal(
            "on, scene 1, hue 73, colour temperature step 18, brightness 100 %, saturation 86 %",
        );
    });
});
