import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

const resolvedByTable: Record<string, unknown> = {
  tenants: { data: { name: "Acme", slug: "acme" }, error: null },
  tenant_landing_pages: { data: null, error: null },
  tenant_packages: { data: [], error: null },
};
let builders: Builder[] = [];

function makeBuilder(table: string): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedByTable[table]).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn((table: string) => {
  const builder = makeBuilder(table);
  builders.push(builder);
  return Object.assign(builder, { __table: table });
});

function buildersForTable(table: string) {
  return builders.filter((b) => (b as unknown as { __table?: string }).__table === table);
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
    storage: {
      from: () => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: "x" }, error: null })),
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example.com/logo.png" } }),
      }),
    },
  },
}));

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  writable: true,
});

import LandingPageEditor from "./LandingPageEditor";

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<LandingPageEditor />, { wrapper });
}

beforeEach(() => {
  mockFrom.mockClear();
  builders = [];
  mockToast.mockReset();
  mockUseTenantId.mockReset();
  mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });

  resolvedByTable.tenants = { data: { name: "Acme", slug: "acme" }, error: null };
  resolvedByTable.tenant_landing_pages = { data: null, error: null };
  resolvedByTable.tenant_packages = { data: [], error: null };
});

describe("LandingPageEditor", () => {
  it("shows the public booking link and copies it", async () => {
    renderEditor();
    expect(await screen.findByText(/\/book\/acme/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Copy Link/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/book/acme"));
      expect(screen.getByRole("button", { name: /Copied!/i })).toBeInTheDocument();
    });
  });

  it("pre-fills page content from the existing landing page and saves edits", async () => {
    resolvedByTable.tenant_landing_pages = {
      data: { tagline: "Old tagline", about: "Old about", services_description: "Old services" },
      error: null,
    };
    renderEditor();
    const taglineInput = await screen.findByPlaceholderText("e.g. Making Your Simcha Unforgettable");
    expect(taglineInput).toHaveValue("Old tagline");

    fireEvent.change(taglineInput, { target: { value: "New tagline" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Page Content" }));

    await waitFor(() => {
      const builder = buildersForTable("tenant_landing_pages").find((b) => b.update.mock.calls.length > 0);
      expect(builder?.update).toHaveBeenCalledWith(expect.objectContaining({ tagline: "New tagline" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Landing page saved! ✓" }));
    });
  });

  it("inserts a new landing page row when none exists yet", async () => {
    renderEditor();
    await screen.findByPlaceholderText("e.g. Making Your Simcha Unforgettable");

    fireEvent.click(screen.getByRole("button", { name: "Save Page Content" }));

    await waitFor(() => {
      const builder = buildersForTable("tenant_landing_pages").find((b) => b.insert.mock.calls.length > 0);
      expect(builder?.insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant-1" }));
    });
  });

  it("shows the empty state and adds a new package", async () => {
    renderEditor();
    expect(await screen.findByText("No packages yet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add Package/i }));

    expect(screen.queryByText("No packages yet")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Gold Package")).toBeInTheDocument();
  });

  it("loads existing packages, edits one, and saves", async () => {
    resolvedByTable.tenant_packages = {
      data: [{ id: "p1", name: "Gold", description: "Best", price: "$2,500", features: ["DJ"], is_popular: false, sort_order: 0 }],
      error: null,
    };
    renderEditor();
    const nameInput = await screen.findByDisplayValue("Gold");

    fireEvent.change(nameInput, { target: { value: "Platinum" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Packages" }));

    await waitFor(() => {
      const builder = buildersForTable("tenant_packages").find((b) => b.update.mock.calls.length > 0);
      expect(builder?.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Platinum" }));
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Packages saved! ✓" }));
    });
  });

  it("removes a package from the list", async () => {
    resolvedByTable.tenant_packages = {
      data: [{ id: "p1", name: "Gold", description: "", price: "", features: [""], is_popular: false, sort_order: 0 }],
      error: null,
    };
    renderEditor();
    await screen.findByDisplayValue("Gold");

    fireEvent.click(screen.getByTitle("Remove package"));

    expect(screen.queryByDisplayValue("Gold")).not.toBeInTheDocument();
    expect(screen.getByText("No packages yet")).toBeInTheDocument();
  });

  it("uploads a logo image", async () => {
    renderEditor();
    await screen.findByText("Logo");

    const file = new File(["x"], "logo.png", { type: "image/png" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Logo uploaded!" }));
    });
  });
});
