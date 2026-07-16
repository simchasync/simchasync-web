import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { en } from "@/i18n/en";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en }),
}));

const mockUseTenantId = vi.fn();
vi.mock("@/hooks/useTenantId", () => ({
  useTenantId: () => mockUseTenantId(),
}));

const mockUseUserRole = vi.fn();
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));

const mockUseSubscription = vi.fn();
vi.mock("@/contexts/SubscriptionContext", () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock("@/hooks/useRealtimeInvalidate", () => ({
  useRealtimeInvalidate: () => {},
}));

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
};

let resolvedValue: unknown = { data: [], error: null };

function makeBuilder(): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.then = (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => makeBuilder(),
  },
}));

import Inquiries from "./Inquiries";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><Inquiries /></MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Inquiries page", () => {
  beforeEach(() => {
    resolvedValue = { data: [], error: null };
    mockUseTenantId.mockReturnValue({ tenantId: "tenant-1" });
    mockUseUserRole.mockReturnValue({ canWrite: true });
  });

  it("shows an upgrade prompt when not on Premium", () => {
    mockUseSubscription.mockReturnValue({ canAccess: () => false, loading: false });
    renderPage();
    expect(screen.getByText("Customer Inquiries is a Premium feature")).toBeInTheDocument();
    expect(screen.queryByText("Add Inquiry")).not.toBeInTheDocument();
  });

  it("shows the board with all four columns when on Premium", () => {
    mockUseSubscription.mockReturnValue({ canAccess: () => true, loading: false });
    renderPage();
    expect(screen.getByText("Customer Inquiries")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Contacted")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Add Inquiry")).toBeInTheDocument();
  });
});
