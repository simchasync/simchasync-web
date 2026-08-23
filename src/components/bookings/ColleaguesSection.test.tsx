import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ColleagueCard is pure/presentational, but importing the module pulls in the
// supabase client at load time — stub it so the test needs no env/network.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ColleagueCard } from "./ColleaguesSection";

const baseEc = {
  id: "ec-1",
  name: "David",
  role_instrument: "piano",
  phone: "",
  email: "elideutsch.ny@gmail.com",
  price: 0,
  payment_responsibility: "paid_by_me",
  notes: "",
  invite_status: "pending",
  colleague_type: "external_collaborator",
  user_id: null,
};

function renderCard(overrides: Record<string, unknown> = {}) {
  const onSave = vi.fn();
  render(
    <ColleagueCard
      ec={{ ...baseEc, ...overrides }}
      canWrite={true}
      currentUserId="owner-1"
      isSaving={false}
      onDelete={vi.fn()}
      onSave={onSave}
      onRespond={vi.fn()}
    />
  );
  return { onSave };
}

describe("ColleagueCard (Edit bookings colleague row)", () => {
  it("keeps the typed price (no revert to $0) and auto-saves it on blur", () => {
    const { onSave } = renderCard({ price: 0 });

    // The only number input on the card is the Price field.
    const price = screen.getByRole("spinbutton");
    expect(price).toHaveValue(0);

    fireEvent.change(price, { target: { value: "500" } });
    // Regression: the value must stay 500 and NOT snap back to the server's 0.
    expect(price).toHaveValue(500);

    fireEvent.blur(price);
    expect(onSave).toHaveBeenCalledWith("ec-1", { price: 500 });
  });

  it("lets you switch Payment to 'Paid by Organizer' and saves that choice immediately", async () => {
    const { onSave } = renderCard({ payment_responsibility: "paid_by_me" });

    const paymentSelect = screen.getByRole("combobox");
    fireEvent.pointerDown(paymentSelect, { button: 0, ctrlKey: false });
    fireEvent.click(paymentSelect);
    const option = await screen.findByText("Paid by Organizer");
    fireEvent.click(option);

    // Selecting an option persists it right away (no snap-back, no extra button).
    expect(onSave).toHaveBeenCalledWith("ec-1", { payment_responsibility: "paid_by_organizer" });
    // And the trigger now reflects the new choice.
    expect(paymentSelect).toHaveTextContent("Paid by Organizer");
  });

  it("does not save when a field is blurred without any change", () => {
    const { onSave } = renderCard({ price: 500 });
    fireEvent.blur(screen.getByRole("spinbutton"));
    expect(onSave).not.toHaveBeenCalled();
  });
});
