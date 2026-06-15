import { describe, it, expect } from "vitest";
import { getEventPaymentStatus } from "./eventPaymentStatus";

describe("getEventPaymentStatus", () => {
  describe("with no linked invoices — falls back to the event row", () => {
    it("uses the event's own payment_status", () => {
      expect(getEventPaymentStatus({ payment_status: "paid" }, [])).toBe("paid");
      expect(getEventPaymentStatus({ payment_status: "partial" }, [])).toBe("partial");
      expect(getEventPaymentStatus({ payment_status: "unpaid" }, [])).toBe("unpaid");
    });

    it("defaults to unpaid when the event has no status", () => {
      expect(getEventPaymentStatus({}, [])).toBe("unpaid");
      expect(getEventPaymentStatus({ payment_status: null }, [])).toBe("unpaid");
    });
  });

  describe("with linked invoices — invoices take precedence", () => {
    it("is paid only when every invoice is paid", () => {
      expect(getEventPaymentStatus({ payment_status: "unpaid" }, [{ status: "paid" }, { status: "paid" }])).toBe("paid");
    });

    it("is partial when at least one invoice is paid or sent but not all paid", () => {
      expect(getEventPaymentStatus({}, [{ status: "paid" }, { status: "draft" }])).toBe("partial");
      expect(getEventPaymentStatus({}, [{ status: "sent" }, { status: "draft" }])).toBe("partial");
    });

    it("is unpaid when no invoice is paid or sent", () => {
      expect(getEventPaymentStatus({ payment_status: "paid" }, [{ status: "draft" }, { status: "overdue" }])).toBe("unpaid");
    });

    it("overrides a 'paid' event row when invoices are still outstanding", () => {
      // event says paid, but a linked draft invoice means it's not fully settled
      expect(getEventPaymentStatus({ payment_status: "paid" }, [{ status: "draft" }])).toBe("unpaid");
    });
  });
});
