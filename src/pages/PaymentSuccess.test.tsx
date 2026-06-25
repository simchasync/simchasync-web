import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((..._args: unknown[]) => ({ select: mockSelect }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import PaymentSuccess from "./PaymentSuccess";

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/payment-success${search}`]}>
      <PaymentSuccess />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockEq.mockClear();
  mockSingle.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PaymentSuccess", () => {
  it("shows the unverified-processing message immediately when there is no invoice_id", () => {
    renderAt("");
    expect(screen.getByText("Payment Successful!")).toBeInTheDocument();
    expect(screen.getByText(/being processed/i)).toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("shows a verifying spinner while polling, then the confirmed message once paid", async () => {
    mockSingle.mockResolvedValue({ data: { status: "paid" } });
    renderAt("?invoice_id=inv-1");
    expect(screen.getByText("Verifying payment...")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(screen.getByText("Payment Successful!")).toBeInTheDocument();
    expect(screen.getByText(/has been confirmed/i)).toBeInTheDocument();
    expect(mockEq).toHaveBeenCalledWith("id", "inv-1");
  });

  it("stops polling and shows the unverified message after 10 attempts without payment", async () => {
    mockSingle.mockResolvedValue({ data: { status: "pending" } });
    renderAt("?invoice_id=inv-1");

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });
    }

    expect(screen.getByText("Payment Successful!")).toBeInTheDocument();
    expect(screen.getByText(/being processed/i)).toBeInTheDocument();
    expect(mockSingle).toHaveBeenCalledTimes(10);
  });
});
