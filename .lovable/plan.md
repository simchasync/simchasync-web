

# Plan: Copy Simcha Sync 2 into This Project

## Overview

Copy the entire [Simcha sync 2](/projects/fcd442e6-e902-4545-8d06-48bc05964c9f) codebase into this project, using the already-connected external Supabase project ("Simcha pro") as the backend.

## What Will Be Copied

### Total file count: ~130+ files

**Config & Root (5 files):** `package.json`, `vite.config.ts`, `tailwind.config.ts`, `index.html`, `components.json`

**Styles & Entry (3 files):** `src/index.css`, `src/App.css`, `src/main.tsx`, `src/App.tsx`

**Pages (22 files):**
- Root: Index, Auth, ResetPassword, PublicBooking, PaymentSuccess, PaymentCancelled, NotFound
- App (12): Dashboard, Bookings, Clients, Invoices, Finance, Team, SocialMedia, Agents, LandingPageEditor, SettingsPage, Support, UpgradePage
- Admin (10): AdminShell, AdminLogin, AdminTenants, AdminUsers, AdminBilling, AdminRevenue, AdminAuditLog, AdminManageAdmins, AdminImpersonate, AdminSupportTickets

**Components (~30 files):**
- Root-level (11): AppShell, AuthRedirect, BookingRequests, ErrorBoundary, LanguageSwitcher, NavLink, NotificationsDropdown, PWAInstallPrompt, PageTransition, TrialBanner, WorkspaceSwitcher
- Subdirectories: admin (1), billing (1), bookings (14), clients (1), invoices (4), public (2)
- UI: page-skeletons.tsx (new one not in current project)

**Contexts (3):** AuthContext, LanguageContext, SubscriptionContext

**Hooks (5):** use-mobile, use-toast, useAdminRole, useTenantId, useUserRole

**i18n (3):** en.ts, he.ts, yi.ts

**Integrations (3):** supabase/client.ts, supabase/types.ts, lovable/index.ts

**Lib (5):** utils.ts, hebrewDate.ts, subscription-tiers.ts, supabase.ts, clientDedup.ts

**Public assets (3):** favicon.ico, pwa-192.png, pwa-512.png

**Supabase backend (87+ files):**
- 63 migration files
- 18 edge function directories (each with index.ts)
- 6 shared email template files
- config.toml

## Key Adaptations

- **Supabase client**: Will use `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the already-connected external project
- **`@lovable.dev/cloud-auth-js`**: Will be removed from dependencies since you are using external Supabase auth, not Lovable Cloud auth
- **Edge functions and migrations**: Copied as-is -- migrations will be applied to your external Supabase instance via the migration tool

## Execution Batches

Due to the volume (~130+ files), this will be done in approximately **6-10 implementation messages**:

1. **Batch 1** -- Config, styles, entry files, public assets (~10 files)
2. **Batch 2** -- Contexts, hooks, i18n, lib, integrations (~19 files)
3. **Batch 3** -- All 22 pages
4. **Batch 4** -- All ~30 components
5. **Batch 5** -- Database migrations (63 files, applied via migration tool)
6. **Batch 6** -- Edge functions (18 functions + shared templates)

## After Completion

- The app will look and function identically to Simcha Sync 2
- All backend data will live in your own Supabase project ("Simcha pro")
- You maintain full control of the database independently of Lovable

