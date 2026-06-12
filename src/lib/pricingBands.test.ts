import { describe, it, expect } from "vitest";
import { getPlanFromPrice } from "../../supabase/functions/_shared/pricing";

/** The banded amount→plan mapping must classify BOTH the 2026-06 prices
 * (Lite $29.99 / Pro $49.99 / Premium $99.99) and the grandfathered legacy
 * prices (Lite $59.99 / Full $89.99). A mistake here assigns paying
 * customers the wrong tier. */
describe("getPlanFromPrice", () => {
  it("maps the current prices", () => {
    expect(getPlanFromPrice(2999)).toBe("lite"); // Lite $29.99
    expect(getPlanFromPrice(4999)).toBe("full"); // Pro $49.99
    expect(getPlanFromPrice(9999)).toBe("premium"); // Premium $99.99
  });

  it("maps the grandfathered legacy prices", () => {
    expect(getPlanFromPrice(5999)).toBe("lite"); // legacy Lite $59.99
    expect(getPlanFromPrice(8999)).toBe("full"); // legacy Full $89.99
  });

  it("respects the exact band boundaries", () => {
    expect(getPlanFromPrice(0)).toBe("lite");
    expect(getPlanFromPrice(3999)).toBe("lite");
    expect(getPlanFromPrice(4000)).toBe("full");
    expect(getPlanFromPrice(5499)).toBe("full");
    expect(getPlanFromPrice(5500)).toBe("lite"); // legacy-lite band starts
    expect(getPlanFromPrice(6099)).toBe("lite");
    expect(getPlanFromPrice(6100)).toBe("full"); // legacy-full band starts
    expect(getPlanFromPrice(9099)).toBe("full");
    expect(getPlanFromPrice(9100)).toBe("premium");
    expect(getPlanFromPrice(10999)).toBe("premium");
  });

  it("returns other above the premium band", () => {
    expect(getPlanFromPrice(11000)).toBe("other");
    expect(getPlanFromPrice(99999)).toBe("other");
  });
});
