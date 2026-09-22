import { expect } from "chai";
import {
    degreesToHueByte,
    hueByteToDegrees,
    hueSaturationToRgbHex,
    kelvinToTemperatureStep,
    rgbHexToHueSaturation,
    TEMPERATURE_STEPS,
    temperatureStepToKelvin,
} from "./color";

describe("color => hue byte", () => {
    it("maps the byte values seen on the real gateway to the colours shown in the app", () => {
        // red F9/FD/04, green 45/48, blue A8/AB (captures 2026-09-22)
        expect(hueByteToDegrees(0x04)).to.equal(6);
        expect(hueByteToDegrees(0xfd)).to.equal(356);
        expect(hueByteToDegrees(0x48)).to.equal(101);
        expect(hueByteToDegrees(0xab)).to.equal(240);
    });

    it("converts degrees to the byte and wraps at 360°", () => {
        expect(degreesToHueByte(0)).to.equal(0);
        expect(degreesToHueByte(120)).to.equal(85);
        expect(degreesToHueByte(240)).to.equal(171);
        expect(degreesToHueByte(359.9)).to.equal(0);
        expect(degreesToHueByte(360)).to.equal(0);
        expect(degreesToHueByte(-120)).to.equal(171);
    });

    it("survives a round trip without drifting", () => {
        for (const degrees of [0, 30, 60, 90, 120, 180, 240, 300, 359]) {
            expect(Math.abs(hueByteToDegrees(degreesToHueByte(degrees)) - degrees)).to.be.at.most(1);
        }
    });
});

describe("color => colour temperature", () => {
    it("has 38 steps of 100 K", () => {
        expect(TEMPERATURE_STEPS).to.equal(38);
        expect(temperatureStepToKelvin(0)).to.equal(2700);
        expect(temperatureStepToKelvin(0x12)).to.equal(4500);
        expect(temperatureStepToKelvin(0x26)).to.equal(6500);
    });

    it("rounds and clamps Kelvin to a step", () => {
        expect(kelvinToTemperatureStep(4549)).to.equal(18);
        expect(kelvinToTemperatureStep(4550)).to.equal(19);
        expect(kelvinToTemperatureStep(2000)).to.equal(0);
        expect(kelvinToTemperatureStep(9000)).to.equal(38);
    });

    it("clamps out of range steps", () => {
        expect(temperatureStepToKelvin(-3)).to.equal(2700);
        expect(temperatureStepToKelvin(99)).to.equal(6500);
    });
});

describe("color => RGB", () => {
    it("converts hue and saturation to a colour at full brightness", () => {
        expect(hueSaturationToRgbHex(0, 100)).to.equal("#ff0000");
        expect(hueSaturationToRgbHex(120, 100)).to.equal("#00ff00");
        expect(hueSaturationToRgbHex(240, 100)).to.equal("#0000ff");
        expect(hueSaturationToRgbHex(240, 0)).to.equal("#ffffff");
        expect(hueSaturationToRgbHex(0, 50)).to.equal("#ff8080");
        expect(hueSaturationToRgbHex(360, 100)).to.equal("#ff0000");
    });

    it("converts RGB to hue and saturation and ignores the brightness", () => {
        expect(rgbHexToHueSaturation("#ff0000")).to.deep.equal({ hue: 0, saturation: 100 });
        expect(rgbHexToHueSaturation("#800000")).to.deep.equal({ hue: 0, saturation: 100 });
        expect(rgbHexToHueSaturation("00ff00")).to.deep.equal({ hue: 120, saturation: 100 });
        expect(rgbHexToHueSaturation("#00f")).to.deep.equal({ hue: 240, saturation: 100 });
        expect(rgbHexToHueSaturation("#ff8080")).to.deep.equal({ hue: 0, saturation: 50 });
        expect(rgbHexToHueSaturation("#ffffff")).to.deep.equal({ hue: 0, saturation: 0 });
        expect(rgbHexToHueSaturation("#000000")).to.deep.equal({ hue: 0, saturation: 0 });
    });

    it("rejects invalid colours", () => {
        expect(rgbHexToHueSaturation("red")).to.equal(null);
        expect(rgbHexToHueSaturation("#12345")).to.equal(null);
    });
});
