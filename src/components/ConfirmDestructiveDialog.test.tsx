import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDestructiveDialog } from "./ConfirmDestructiveDialog";

describe("ConfirmDestructiveDialog", () => {
  it("renders nothing visible when closed", () => {
    render(
      <ConfirmDestructiveDialog
        open={false}
        onOpenChange={() => {}}
        title="Delete event"
        description="This cannot be undone."
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText("Delete event")).not.toBeInTheDocument();
  });

  it("renders the title, description, and default button labels when open", () => {
    render(
      <ConfirmDestructiveDialog
        open
        onOpenChange={() => {}}
        title="Delete event"
        description="This cannot be undone."
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText("Delete event")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("uses custom confirm/cancel labels when provided", () => {
    render(
      <ConfirmDestructiveDialog
        open
        onOpenChange={() => {}}
        title="Remove member"
        description="Are you sure?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDestructiveDialog
        open
        onOpenChange={() => {}}
        title="Delete event"
        description="This cannot be undone."
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows the pending label and disables both buttons while isPending", () => {
    render(
      <ConfirmDestructiveDialog
        open
        onOpenChange={() => {}}
        title="Delete event"
        description="This cannot be undone."
        pendingLabel="Deleting…"
        onConfirm={() => {}}
        isPending
      />
    );
    const confirmButton = screen.getByRole("button", { name: "Deleting…" });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
