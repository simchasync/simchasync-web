// Tenant-scoped workspace roles. App-level roles (admin, support_agent,
// billing_admin) live separately — these are membership roles only.
export const USER_ROLES = [
  "owner",
  "booking_manager",
  "social_media_manager",
  "member",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isKnownUserRole(
  value: string | null | undefined
): value is UserRole {
  return !!value && (USER_ROLES as readonly string[]).includes(value);
}
