import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function Bomb({ message }: { message: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches a thrown error and shows the fallback UI with the error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb message="Database is on fire" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Database is on fire")).toBeInTheDocument();
  });

  it("falls back to a generic message when the thrown error has none", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    function ThrowEmpty(): never {
      throw new Error();
    }

    render(
      <ErrorBoundary>
        <ThrowEmpty />
      </ErrorBoundary>
    );

    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });

  it("reloads the page when 'Reload Page' is clicked", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <Bomb message="boom" />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText("Reload Page"));
    expect(reload).toHaveBeenCalledOnce();
  });
});
