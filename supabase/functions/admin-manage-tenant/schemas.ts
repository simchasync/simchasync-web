import { z } from "zod";

const uuid = z.string().uuid();
const pagination = {
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().optional(),
};

export const adminActionSchemas = {
  list_tenants: z.object({
    search: z.string().optional(),
    ...pagination,
  }).passthrough(),

  search_tenants: z.object({
    search: z.string().optional(),
  }).passthrough(),

  extend_trial: z.object({
    tenant_id: uuid,
    new_trial_end: z.string().min(1),
  }).passthrough(),

  change_plan: z.object({
    tenant_id: uuid,
    plan: z.enum(["trial", "lite", "full", "other"]),
  }).passthrough(),

  remove_override: z.object({
    tenant_id: uuid,
  }).passthrough(),

  set_custom_price: z.object({
    tenant_id: uuid,
    custom_price_cents: z.number().int().nonnegative().nullable().optional(),
  }).passthrough(),

  reset_password: z.object({
    target_user_id: uuid,
    new_password: z.string().min(6, "password too short (min 6)"),
  }).passthrough(),

  invite_tenant: z.object({
    email: z.string().email(),
    password: z.string().min(6, "password too short (min 6)"),
    full_name: z.string().optional(),
  }).passthrough(),

  assign_admin_role: z.object({
    target_user_id: uuid,
    role: z.enum(["admin", "billing_admin", "support_agent"]),
  }).passthrough(),

  remove_admin_role: z.object({
    target_user_id: uuid,
    role: z.string().min(1),
  }).passthrough(),

  list_admin_users: z.object({}).passthrough(),

  find_user_by_email: z.object({
    email: z.string().min(1),
  }).passthrough(),

  update_tenant_notes: z.object({
    tenant_id: uuid,
    notes: z.string().nullable().optional(),
  }).passthrough(),

  resync_stripe: z.object({
    tenant_id: uuid,
  }).passthrough(),

  list_audit_logs: z.object({
    tenant_id: uuid.optional(),
    limit: z.number().int().positive().optional(),
  }).passthrough(),

  impersonate_tenant: z.object({
    tenant_id: uuid,
  }).passthrough(),

  list_all_users: z.object({
    search: z.string().optional(),
    ...pagination,
  }).passthrough(),

  deactivate_user: z.object({
    target_user_id: uuid,
    ban: z.boolean().optional(),
  }).passthrough(),

  delete_user: z.object({
    target_user_id: uuid,
  }).passthrough(),

  list_support_tickets: z.object({
    status: z.string().optional(),
    ...pagination,
  }).passthrough(),

  get_ticket_replies: z.object({
    ticket_id: uuid,
  }).passthrough(),

  reply_to_ticket: z.object({
    ticket_id: uuid,
    message: z.string().min(1),
  }).passthrough(),

  update_ticket_status: z.object({
    ticket_id: uuid,
    status: z.string().min(1),
  }).passthrough(),

  list_admin_activity: z.object({}).passthrough(),
} as const;

export type AdminAction = keyof typeof adminActionSchemas;
