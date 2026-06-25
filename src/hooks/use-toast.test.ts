import { describe, it, expect } from "vitest";
import { reducer } from "./use-toast";

function makeToast(id: string, overrides: Partial<{ open: boolean }> = {}) {
  return { id, open: true, ...overrides };
}

describe("use-toast reducer", () => {
  it("adds a toast and caps the list at the toast limit (1)", () => {
    const state = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: makeToast("1") });
    expect(state.toasts).toHaveLength(1);

    const next = reducer(state, { type: "ADD_TOAST", toast: makeToast("2") });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].id).toBe("2");
  });

  it("updates a toast by id, leaving others untouched", () => {
    const state = { toasts: [makeToast("1")] };
    const next = reducer(state, { type: "UPDATE_TOAST", toast: { id: "1", title: "Updated" } });
    expect(next.toasts[0]).toMatchObject({ id: "1", title: "Updated" });
  });

  it("marks a specific toast as closed on DISMISS_TOAST with a toastId", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });
    expect(next.toasts.find((t) => t.id === "1")?.open).toBe(false);
    expect(next.toasts.find((t) => t.id === "2")?.open).toBe(true);
  });

  it("marks all toasts as closed on DISMISS_TOAST with no toastId", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(state, { type: "DISMISS_TOAST", toastId: undefined });
    expect(next.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("removes a specific toast on REMOVE_TOAST with a toastId", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });
    expect(next.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("removes all toasts on REMOVE_TOAST with no toastId", () => {
    const state = { toasts: [makeToast("1"), makeToast("2")] };
    const next = reducer(state, { type: "REMOVE_TOAST", toastId: undefined });
    expect(next.toasts).toEqual([]);
  });
});
