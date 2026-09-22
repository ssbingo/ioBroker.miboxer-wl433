import { expect } from "chai";
import {
    describeAction,
    describeSchedule,
    formatLocal,
    inSeason,
    isoWeekday,
    nextRun,
    parseDayOfYear,
    parseTimeOfDay,
    parseTimer,
    sunEventTime,
    type Timer,
    type TimerConfig,
    toList,
} from "./timers";

const BERLIN = { latitude: 52.5, longitude: 13.28 };

function timer(config: TimerConfig): Timer {
    const result = parseTimer(config, 1);
    if ("error" in result) {
        throw new Error(result.error);
    }
    return result.timer;
}

describe("timers => parsing", () => {
    it("parses times of day", () => {
        expect(parseTimeOfDay("07:05")).to.deep.equal({ hours: 7, minutes: 5, seconds: 0 });
        expect(parseTimeOfDay("23:59:30")).to.deep.equal({ hours: 23, minutes: 59, seconds: 30 });
        expect(parseTimeOfDay("24:00")).to.equal(undefined);
        expect(parseTimeOfDay("")).to.equal(undefined);
        expect(parseTimeOfDay(5)).to.equal(undefined);
    });

    it("parses yearly dates", () => {
        expect(parseDayOfYear("01.05.")).to.deep.equal({ day: 1, month: 5 });
        expect(parseDayOfYear("30.9")).to.deep.equal({ day: 30, month: 9 });
        expect(parseDayOfYear("29.02.")).to.deep.equal({ day: 29, month: 2 });
        expect(parseDayOfYear("31.04.")).to.equal(undefined);
        expect(parseDayOfYear("1.13.")).to.equal(undefined);
    });

    it("accepts a complete timer and fills defaults", () => {
        const result = timer({ time: "20:00" });
        expect(result.name).to.equal("Timer 1");
        expect(result.trigger).to.equal("time");
        expect(result.action).to.equal("on");
        expect(result.zone).to.equal(0);
        expect([...result.days]).to.deep.equal([1, 2, 3, 4, 5, 6, 7]);
        expect(result.brightness).to.equal(undefined);
    });

    it("rejects incomplete timers with a reason", () => {
        expect(parseTimer({ trigger: "time" }, 1)).to.deep.equal({ error: "no valid time set" });
        expect(parseTimer({ trigger: "moonrise" }, 1)).to.have.property("error");
        expect(parseTimer({ time: "20:00", action: "white" }, 1)).to.have.property("error");
        expect(parseTimer({ time: "20:00", action: "colour", color: "blue" }, 1)).to.have.property("error");
        expect(parseTimer({ time: "20:00", action: "scene", scene: 10 }, 1)).to.have.property("error");
        expect(parseTimer({ time: "20:00", action: "brightness" }, 1)).to.have.property("error");
        expect(parseTimer({ time: "20:00", zone: 9 }, 1)).to.have.property("error");
        expect(parseTimer({ time: "20:00", brightness: 0 }, 1)).to.have.property("error");
        expect(parseTimer({ time: "20:00", days: ["x"] }, 1)).to.deep.equal({ error: "no weekday selected" });
        expect(parseTimer({ time: "20:00", seasonFrom: "01.05." }, 1)).to.have.property("error");
    });

    it("accepts weekdays as numbers or strings and colours without #", () => {
        const result = timer({ time: "20:00", days: ["1", 5], action: "colour", color: "00ff00" });
        expect([...result.days]).to.deep.equal([1, 5]);
        expect(result.color).to.equal("#00ff00");
    });
});

describe("timers => lists", () => {
    it("accepts arrays and objects with numeric keys", () => {
        expect(toList([1, 2])).to.deep.equal([1, 2]);
        expect(toList({ 1: "b", 0: "a", x: "ignored" })).to.deep.equal(["a", "b"]);
        expect(toList(undefined)).to.deep.equal([]);
        expect([...timer({ time: "20:00", days: { 0: 6, 1: 7 } }).days]).to.deep.equal([6, 7]);
    });
});

describe("timers => calendar", () => {
    it("numbers weekdays from Monday = 1 to Sunday = 7", () => {
        expect(isoWeekday(new Date(2026, 8, 21))).to.equal(1);
        expect(isoWeekday(new Date(2026, 8, 27))).to.equal(7);
    });

    it("checks seasons, also across the new year", () => {
        const summer = { from: { day: 1, month: 5 }, to: { day: 30, month: 9 } };
        expect(inSeason(new Date(2026, 4, 1), summer)).to.equal(true);
        expect(inSeason(new Date(2026, 8, 30), summer)).to.equal(true);
        expect(inSeason(new Date(2026, 9, 1), summer)).to.equal(false);
        const winter = { from: { day: 1, month: 11 }, to: { day: 28, month: 2 } };
        expect(inSeason(new Date(2026, 11, 24), winter)).to.equal(true);
        expect(inSeason(new Date(2027, 0, 10), winter)).to.equal(true);
        expect(inSeason(new Date(2026, 5, 1), winter)).to.equal(false);
    });

    it("calculates sun events for Berlin", () => {
        const sunset = sunEventTime(new Date(2026, 8, 22), "sunset", BERLIN);
        expect(sunset).to.be.instanceOf(Date);
        // sunset in Berlin on 22 Sep 2026 is about 17:10 UTC
        const minutesUtc = (sunset as Date).getUTCHours() * 60 + (sunset as Date).getUTCMinutes();
        expect(minutesUtc).to.be.within(17 * 60 - 10, 17 * 60 + 25);
    });

    it("has no sunset at the North Pole in summer", () => {
        expect(sunEventTime(new Date(2026, 5, 21), "sunset", { latitude: 89, longitude: 0 })).to.equal(null);
    });
});

describe("timers => next run", () => {
    const monday = new Date(2026, 8, 21, 10, 0, 0);

    it("finds the same day if the time is still ahead", () => {
        const run = nextRun(timer({ time: "20:00" }), monday, undefined);
        expect(run?.at.getTime()).to.equal(new Date(2026, 8, 21, 20, 0, 0).getTime());
    });

    it("finds the next day if the time has passed", () => {
        const run = nextRun(timer({ time: "08:00" }), monday, undefined);
        expect(run?.at.getTime()).to.equal(new Date(2026, 8, 22, 8, 0, 0).getTime());
    });

    it("respects weekdays", () => {
        const run = nextRun(timer({ time: "08:00", days: [6, 7] }), monday, undefined);
        expect(run?.at.getTime()).to.equal(new Date(2026, 8, 26, 8, 0, 0).getTime());
    });

    it("respects the season", () => {
        const run = nextRun(
            timer({ time: "20:00", seasonFrom: "01.05.", seasonTo: "30.09." }),
            new Date(2026, 9, 5),
            undefined,
        );
        expect(run?.at.getTime()).to.equal(new Date(2027, 4, 1, 20, 0, 0).getTime());
    });

    it("applies the offset, also across midnight", () => {
        const run = nextRun(timer({ time: "00:30", offset: -60 }), monday, undefined);
        expect(run?.at.getTime()).to.equal(new Date(2026, 8, 21, 23, 30, 0).getTime());
    });

    it("follows sun events with offset", () => {
        const run = nextRun(timer({ trigger: "sunset", offset: -15 }), monday, BERLIN);
        const sunset = sunEventTime(monday, "sunset", BERLIN) as Date;
        expect(run?.base.getTime()).to.equal(sunset.getTime());
        expect(run?.at.getTime()).to.equal(sunset.getTime() - 15 * 60_000);
    });

    it("needs a position for sun events", () => {
        expect(nextRun(timer({ trigger: "sunrise" }), monday, undefined)).to.equal(null);
    });

    it("shifts randomly within the configured range", () => {
        const late = nextRun(timer({ time: "20:00", random: 10 }), monday, undefined, () => 1);
        const early = nextRun(timer({ time: "20:00", random: 10 }), monday, undefined, () => 0);
        expect(late?.randomShift).to.equal(10);
        expect(early?.randomShift).to.equal(-10);
        expect(late?.at.getTime()).to.equal(new Date(2026, 8, 21, 20, 10, 0).getTime());
    });

    it("returns null if no day can match", () => {
        const never = timer({ time: "20:00", days: [1], seasonFrom: "02.02.", seasonTo: "02.02." });
        // 2 Feb is a Monday only in some years; within one year from 1 Mar 2026 (next: Tue 2 Feb 2027) it never matches
        expect(nextRun(never, new Date(2026, 2, 1), undefined)).to.equal(null);
    });
});

describe("timers => texts", () => {
    it("describes schedule and action", () => {
        const white = timer({
            trigger: "sunset",
            offset: -15,
            random: 5,
            days: [1, 2, 3, 4, 5],
            seasonFrom: "1.5.",
            seasonTo: "30.9.",
            zone: 2,
            action: "white",
            temperature: 3000,
            brightness: 60,
            duration: 90,
        });
        expect(describeSchedule(white)).to.equal("sunset -15 min ±5 min, Mon,Tue,Wed,Thu,Fri, 01.05.-30.09.");
        expect(describeAction(white)).to.equal("zone 2: white 3000 K, 60 %, off after 90 min");
        expect(describeAction(timer({ time: "22:00", action: "off", brightness: 50 }))).to.equal("all zones: off");
    });

    it("formats local times", () => {
        expect(formatLocal(new Date(2026, 8, 22, 19, 5, 0))).to.equal("Tue 2026-09-22 19:05:00");
    });
});
