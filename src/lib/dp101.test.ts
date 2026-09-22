import { expect } from "chai";
import { buildDp101Frame, decodeDp101, dp101Checksum, encodeDp101Hex, formatHex } from "./dp101";

// Frames published in tinytuya discussion #623, see appendix A of the protocol analysis in doc/
const PUBLISHED_FRAMES = [
    { base64: "QwAAgAAAAAAAgIDD", hex: "43 00 00 80 00 00 00 00 00 80 80 C3" },
    { base64: "SQAACwIAAQAAAIDX", hex: "49 00 00 0B 02 00 01 00 00 00 80 D7" },
    { base64: "QQAACwYBAAAAAIDT", hex: "41 00 00 0B 06 01 00 00 00 00 80 D3" },
    { base64: "QQAACwYGAAAAAIDY", hex: "41 00 00 0B 06 06 00 00 00 00 80 D8" },
    { base64: "RAAAAAABAAEACwFS", hex: "44 00 00 00 00 01 00 01 00 0B 01 52" },
];

describe("dp101 => dp101Checksum", () => {
    it("sums up the bytes modulo 256", () => {
        expect(dp101Checksum(Uint8Array.from([0xff, 0x02]))).to.equal(0x01);
        expect(dp101Checksum(Uint8Array.from([0x43, 0x00, 0x00, 0x80, 0xc3]), 4)).to.equal(0xc3);
    });
});

describe("dp101 => decodeDp101", () => {
    for (const frame of PUBLISHED_FRAMES) {
        it(`decodes ${frame.base64} with a valid checksum`, () => {
            const decoded = decodeDp101(frame.base64);
            expect(decoded.hex).to.equal(frame.hex);
            expect(decoded.bytes).to.have.length(12);
            expect(decoded.base64).to.equal(frame.base64);
            expect(decoded.checksumValid).to.equal(true);
        });
    }

    it("detects the typo in the published Base64 frame SQAACwIBAAEAAAFY", () => {
        const decoded = decodeDp101("SQAACwIBAAEAAAFY");
        expect(decoded.hex).to.equal("49 00 00 0B 02 01 00 01 00 00 01 58");
        expect(decoded.checksumValid).to.equal(false);
    });

    it("marks frames with another length as invalid instead of throwing", () => {
        expect(decodeDp101("AQID").checksumValid).to.equal(false);
    });

    it("rejects values that are not Base64", () => {
        expect(() => decodeDp101("")).to.throw(TypeError);
        expect(() => decodeDp101("not base64!")).to.throw(TypeError);
        expect(() => decodeDp101("QwA")).to.throw(TypeError);
    });
});

describe("dp101 => encodeDp101Hex", () => {
    it("appends the checksum to 11 bytes", () => {
        const { frame, corrected } = encodeDp101Hex("42 00 00 00 02 01 00 01 00 0b 01");
        expect(frame.hex).to.equal("42 00 00 00 02 01 00 01 00 0B 01 52");
        expect(frame.checksumValid).to.equal(true);
        expect(corrected).to.equal(false);
    });

    it("keeps a correct checksum of 12 bytes", () => {
        const { frame, corrected } = encodeDp101Hex("4300008000000000008080c3");
        expect(frame.base64).to.equal("QwAAgAAAAAAAgIDD");
        expect(corrected).to.equal(false);
    });

    it("corrects a wrong checksum", () => {
        const { frame, corrected } = encodeDp101Hex("49:00:00:0b:02:01:00:01:00:00:01:58");
        expect(frame.hex).to.equal("49 00 00 0B 02 01 00 01 00 00 01 59");
        expect(corrected).to.equal(true);
    });

    it("rejects invalid hex and wrong lengths", () => {
        expect(() => encodeDp101Hex("zz")).to.throw(TypeError);
        expect(() => encodeDp101Hex("123")).to.throw(TypeError);
        expect(() => encodeDp101Hex("01 02 03")).to.throw(RangeError);
        expect(() => encodeDp101Hex("00".repeat(13))).to.throw(RangeError);
    });
});

describe("dp101 => buildDp101Frame", () => {
    it("appends the checksum to 11 payload bytes", () => {
        const frame = buildDp101Frame([0x43, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x80]);
        expect(frame.base64).to.equal("QwAAgAAAAAAAgIDD");
        expect(frame.checksumValid).to.equal(true);
    });

    it("rejects other payload lengths", () => {
        expect(() => buildDp101Frame([0x43])).to.throw(RangeError);
    });
});

describe("dp101 => formatHex", () => {
    it("formats upper case hex pairs", () => {
        expect(formatHex(Uint8Array.from([0, 10, 255]))).to.equal("00 0A FF");
    });
});
