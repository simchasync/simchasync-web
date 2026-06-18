import { describe, it, expect } from "vitest";
import { getTimeBasedTheme, msUntilNextThemeChange, DAY_START_HOUR, DAY_END_HOUR } from "./autoTheme";

const at = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

describe("getTimeBasedTheme", () => {
  it("is light across the whole day window", () => {
    expect(getTimeBasedTheme(at(DAY_START_HOUR))).toBe("light");
    expect(getTimeBasedTheme(at(12))).toBe("light");
    expect(getTimeBasedTheme(at(DAY_END_HOUR - 1, 59))).toBe("light");
  });

  it("is dark before sunrise and after sunset", () => {
    expect(getTimeBasedTheme(at(DAY_START_HOUR - 1, 59))).toBe("dark");
    expect(getTimeBasedTheme(at(DAY_END_HOUR))).toBe("dark");
    expect(getTimeBasedTheme(at(23))).toBe("dark");
    expect(getTimeBasedTheme(at(0))).toBe("dark");
  });
});

describe("msUntilNextThemeChange", () => {
  it("counts to sunrise when it's pre-dawn", () => {
    const ms = msUntilNextThemeChange(at(DAY_START_HOUR - 2));
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });

  it("counts to sunset during the day", () => {
    const ms = msUntilNextThemeChange(at(DAY_END_HOUR - 3));
    expect(ms).toBe(3 * 60 * 60 * 1000);
  });

  it("counts to tomorrow's sunrise after sunset", () => {
    const now = at(DAY_END_HOUR + 1);
    const expectedHours = 24 - (DAY_END_HOUR + 1) + DAY_START_HOUR;
    expect(msUntilNextThemeChange(now)).toBe(expectedHours * 60 * 60 * 1000);
  });

  it("never returns a zero/negative delay on the boundary", () => {
    expect(msUntilNextThemeChange(at(DAY_START_HOUR))).toBeGreaterThanOrEqual(1000);
    expect(msUntilNextThemeChange(at(DAY_END_HOUR))).toBeGreaterThanOrEqual(1000);
  });
});
