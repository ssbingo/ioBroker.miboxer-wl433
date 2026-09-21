import { expect } from "chai";
import {
    formatTuyaHsv,
    kelvinToRaw,
    parseTuyaHsv,
    percentToRaw,
    rawToKelvin,
    rawToPercent,
    rgbHexToTuyaHsv,
    tuyaHsvToRgbHex,
} from "./color";

describe("color => parseTuyaHsv / formatTuyaHsv", () => {
    it("parses the example value from the protocol analysis", () => {
        expect(parseTuyaHsv("00ff03e803e8")).to.deep.equal({ h: 255, s: 1000, v: 1000 });
    });

    it("accepts the full hue range", () => {
        expect(parseTuyaHsv("016803e803e8")).to.deep.equal({ h: 360, s: 1000, v: 1000 });
    });

    it("rejects invalid values", () => {
        expect(parseTuyaHsv("00ff03e803e")).to.equal(null);
        expect(parseTuyaHsv(42)).to.equal(null);
        expect(parseTuyaHsv("016903e803e8")).to.equal(null);
        expect(parseTuyaHsv("000003e903e8")).to.equal(null);
    });

    it("formats with four hex digits per component and clamps", () => {
        expect(formatTuyaHsv({ h: 255, s: 1000, v: 1000 })).to.equal("00ff03e803e8");
        expect(formatTuyaHsv({ h: 400, s: -5, v: 0 })).to.equal("01680000000a");
    });
});

describe("color => RGB conversion", () => {
    const cases: Array<[string, { h: number; s: number; v: number }]> = [
        ["#ff0000", { h: 0, s: 1000, v: 1000 }],
        ["#00ff00", { h: 120, s: 1000, v: 1000 }],
        ["#0000ff", { h: 240, s: 1000, v: 1000 }],
        ["#ffffff", { h: 0, s: 0, v: 1000 }],
        ["#800000", { h: 0, s: 1000, v: 502 }],
    ];
    for (const [rgb, hsv] of cases) {
        it(`converts ${rgb} to Tuya HSV and back`, () => {
            expect(rgbHexToTuyaHsv(rgb)).to.deep.equal(hsv);
            expect(tuyaHsvToRgbHex(hsv)).to.equal(rgb);
        });
    }

    it("accepts short and hash-less notation", () => {
        expect(rgbHexToTuyaHsv("f00")).to.deep.equal({ h: 0, s: 1000, v: 1000 });
        expect(rgbHexToTuyaHsv("FF8800")).to.deep.equal({ h: 32, s: 1000, v: 1000 });
    });

    it("keeps the minimum brightness for black", () => {
        expect(rgbHexToTuyaHsv("#000000")).to.deep.equal({ h: 0, s: 0, v: 10 });
    });

    it("rejects invalid colours", () => {
        expect(rgbHexToTuyaHsv("red")).to.equal(null);
        expect(rgbHexToTuyaHsv("#12345")).to.equal(null);
    });
});

describe("color => brightness and colour temperature", () => {
    it("maps brightness 10..1000 to 1..100 %", () => {
        expect(rawToPercent(10)).to.equal(1);
        expect(rawToPercent(1000)).to.equal(100);
        expect(rawToPercent(0)).to.equal(1);
        expect(percentToRaw(50)).to.equal(500);
        expect(percentToRaw(0.2)).to.equal(10);
        expect(percentToRaw(150)).to.equal(1000);
    });

    it("maps colour temperature 0..1000 to 2700..6500 K", () => {
        expect(rawToKelvin(0)).to.equal(2700);
        expect(rawToKelvin(1000)).to.equal(6500);
        expect(rawToKelvin(500)).to.equal(4600);
        expect(kelvinToRaw(2700)).to.equal(0);
        expect(kelvinToRaw(6500)).to.equal(1000);
        expect(kelvinToRaw(1000)).to.equal(0);
        expect(kelvinToRaw(10000)).to.equal(1000);
        expect(kelvinToRaw(rawToKelvin(250))).to.equal(250);
    });
});
