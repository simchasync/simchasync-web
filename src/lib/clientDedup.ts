import { supabase } from "@/integrations/supabase/client";

interface ClientRecord {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

interface ClientInput {
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

interface ClientResolution {
  client: ClientRecord;
  wasCreated: boolean;
}

const db = supabase as any;

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeEmail = (value?: string | null) => {
  const trimmed = normalizeText(value);
  return trimmed ? trimmed.toLowerCase() : null;
};

const normalizePhone = (value?: string | null) => {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
};

async function findClientByEmail(tenantId: string, email: string): Promise<ClientRecord | null> {
  const { data, error } = await db
    .from("clients")
    .select("id, tenant_id, name, email, phone, notes")
    .eq("tenant_id", tenantId)
    .ilike("email", email)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

async function findClientByPhone(tenantId: string, phone: string): Promise<ClientRecord | null> {
  const { data, error } = await db
    .from("clients")
    .select("id, tenant_id, name, email, phone, notes")
    .eq("tenant_id", tenantId)
    .not("phone", "is", null)
    .order("created_at", { ascending: true })
    .limit(1000);

  if (error) throw error;
  return data.find((client: any) => normalizePhone(client.phone) === phone) ?? null;
}

async function findClientByName(tenantId: string, name: string): Promise<ClientRecord | null> {
  const { data, error } = await db
    .from("clients")
    .select("id, tenant_id, name, email, phone, notes")
    .eq("tenant_id", tenantId)
    .ilike("name", name)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

async function syncClient(existing: ClientRecord, input: { name: string; email: string | null; phone: string | null; notes: string | null }) {
  const updates: Record<string, any> = {};

  if (input.email && normalizeEmail(existing.email) !== input.email) {
    updates.email = input.email;
  }

  if (input.phone && normalizePhone(existing.phone) !== input.phone) {
    updates.phone = input.phone;
  }

  if (input.notes && !normalizeText(existing.notes)) {
    updates.notes = input.notes;
  }

  if (!normalizeText(existing.name) && input.name) {
    updates.name = input.name;
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const { error } = await db.from("clients").update(updates).eq("id", existing.id);
  if (error) throw error;

  return { ...existing, ...updates };
}

export async function getOrCreateClient(input: ClientInput): Promise<ClientResolution> {
  const name = normalizeText(input.name);
  if (!name) {
    throw new Error("Client name is required");
  }

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const notes = normalizeText(input.notes);

  let existing: ClientRecord | null = null;

  if (email) {
    existing = await findClientByEmail(input.tenantId, email);
  }

  if (!existing && phone) {
    existing = await findClientByPhone(input.tenantId, phone);
  }

  if (!existing) {
    existing = await findClientByName(input.tenantId, name);
  }

  if (existing) {
    const client = await syncClient(existing, { name, email, phone, notes });
    return { client, wasCreated: false };
  }

  const { data, error } = await db
    .from("clients")
    .insert({
      tenant_id: input.tenantId,
      name,
      email,
      phone: normalizeText(input.phone),
      notes,
    })
    .select("id, tenant_id, name, email, phone, notes")
    .single();

  if (error) {
    if (error.code === "23505" && email) {
      const matchedClient = await findClientByEmail(input.tenantId, email);
      if (matchedClient) {
        const client = await syncClient(matchedClient, { name, email, phone, notes });
        return { client, wasCreated: false };
      }
    }
    throw error;
  }

  return { client: data, wasCreated: true };
}
