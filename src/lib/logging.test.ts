import { expect } from "chai";
import { bridgeTuyapiDebug, cleanDebugLine, formatDuration, MASK, redact, shorten } from "./logging";

// the "debug" module instance tuyapi uses, so the bridge is tested against the real wiring
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createDebug = require(require.resolve("debug", { paths: [require.resolve("tuyapi")] })) as (
    namespace: string,
) => ((...args: unknown[]) => void) & { enabled: boolean };

describe("logging => redact", () => {
    it("masks secrets and tuyapi session keys", () => {
        expect(redact("key 0123456789abcdef used", ["0123456789abcdef"])).to.equal(`key ${MASK} used`);
        expect(redact("Protocol 3.4, 3.5: Session Key: a1b2c3d4")).to.equal(`Protocol 3.4, 3.5: Session Key: ${MASK}`);
        expect(redact("Protocol 3.4, 3.5: Local Random Key: 00ff")).to.equal(
            `Protocol 3.4, 3.5: Local Random Key: ${MASK}`,
        );
        expect(redact("nothing secret", [""])).to.equal("nothing secret");
    });
});

describe("logging => shorten / formatDuration", () => {
    it("shortens long texts and keeps short ones", () => {
        expect(shorten("abc", 5)).to.equal("abc");
        expect(shorten("abcdefgh", 5)).to.equal("abcde… (8 characters)");
    });

    it("formats durations", () => {
        expect(formatDuration(850)).to.equal("850 ms");
        expect(formatDuration(12_340)).to.equal("12.3 s");
        expect(formatDuration(270_000)).to.equal("4.5 min");
        expect(formatDuration(5_400_000)).to.equal("1.5 h");
    });
});

describe("logging => cleanDebugLine", () => {
    it("removes time stamp, namespace, colours and the time delta", () => {
        expect(cleanDebugLine("2026-09-21T12:00:00.000Z TuyAPI Pinging 10.0.0.5", "TuyAPI")).to.equal(
            "Pinging 10.0.0.5",
        );
        expect(
            cleanDebugLine("  \u001b[36;1mTuyAPI \u001b[0mSocket connected. \u001b[36m+3ms\u001b[0m", "TuyAPI"),
        ).to.equal("Socket connected.");
        expect(cleanDebugLine("TuyAPI {\n  gwId: 'bf01',\n  dps: {}\n} +1ms", "TuyAPI")).to.equal(
            "{ gwId: 'bf01', dps: {} }",
        );
    });
});

describe("logging => bridgeTuyapiDebug", () => {
    it("routes the TuyAPI namespace to the adapter log, redacted, and restores the previous state", () => {
        const lines: string[] = [];
        const tuyapiDebug = createDebug("TuyAPI");
        const otherDebug = createDebug("other-lib");

        const restore = bridgeTuyapiDebug(line => lines.push(line), ["0123456789abcdef"]);
        try {
            expect(tuyapiDebug.enabled).to.equal(true);
            expect(otherDebug.enabled).to.equal(false);
            tuyapiDebug("Connecting to %s...", "10.0.0.5");
            tuyapiDebug("Protocol 3.4, 3.5: Session Key: deadbeef");
            tuyapiDebug("key 0123456789abcdef");
            otherDebug("must not appear");
        } finally {
            restore();
        }

        expect(lines).to.deep.equal([
            "Connecting to 10.0.0.5...",
            `Protocol 3.4, 3.5: Session Key: ${MASK}`,
            `key ${MASK}`,
        ]);
        expect(tuyapiDebug.enabled).to.equal(false);
    });
});
