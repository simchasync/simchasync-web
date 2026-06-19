import { describe, it, expect } from "vitest";
import {
  eventToGooglePayload,
  signState,
  verifyState,
  type EventRow,
} from "../../supabase/functions/_shared/google-calendar";

const baseEvent: EventRow = {
  id: "evt-1",
  event_type: "wedding",
  event_date: "2026-07-15",
  venue: "Grand Hall",
  location: "Brooklyn, NY",
  notes: "Bring extra speakers",
  hebrew_date: "כ״ט תמוז",
  clients: { name: "Cohen Family" },
};

describe("eventToGooglePayload", () => {
  it("maps an event to an all-day Google event with an exclusive end date", () => {
    const p = eventToGooglePayload(baseEvent) as any;
    expect(p.start).toEqual({ date: "2026-07-15" });
    expect(p.end).toEqual({ date: "2026-07-16" });
  });

  it("builds the summary from event type and client name", () => {
    const p = eventToGooglePayload(baseEvent) as any;
    expect(p.summary).toBe("wedding — Cohen Family");
  });

  it("uses venue for location and includes the hebrew date in the description", () => {
    const p = eventToGooglePayload(baseEvent) as any;
    expect(p.location).toBe("Grand Hall");
    expect(p.description).toContain("Bring extra speakers");
    expect(p.description).toContain("כ״ט תמוז");
  });

  it("omits client suffix when there is no client", () => {
    const p = eventToGooglePayload({ ...baseEvent, clients: null }) as any;
    expect(p.summary).toBe("wedding");
  });

  it("falls back to location when venue is missing", () => {
    const p = eventToGooglePayload({ ...baseEvent, venue: null }) as any;
    expect(p.location).toBe("Brooklyn, NY");
  });
});

describe("OAuth state signing", () => {
  const secret = "test-secret-key";

  it("round-trips a valid state token", async () => {
    const state = await signState(secret, { user_id: "u1", tenant_id: "t1" });
    const payload = await verifyState(secret, state);
    expect(payload?.user_id).toBe("u1");
    expect(payload?.tenant_id).toBe("t1");
  });

  it("rejects a tampered token", async () => {
    const state = await signState(secret, { user_id: "u1", tenant_id: "t1" });
    const tampered = state.slice(0, -2) + (state.endsWith("aa") ? "bb" : "aa");
    expect(await verifyState(secret, tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const state = await signState(secret, { user_id: "u1", tenant_id: "t1" });
    expect(await verifyState("other-secret", state)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const state = await signState(secret, { user_id: "u1", tenant_id: "t1" }, -1);
    expect(await verifyState(secret, state)).toBeNull();
  });
});
