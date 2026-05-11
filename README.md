# norva-crm

Internal CRM for **Norva - Corporate** — manage contacts, companies, deal pipeline, projects, and billing in one place.

Built for a small team (2–5 people) with Next.js 14, Supabase, and a custom design system.

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Backend**: Supabase (Postgres, Auth, RLS)
- **Styling**: Tailwind CSS + custom CSS variables (dark minimalist, sharp edges)
- **UI components**: hand-rolled shadcn-style components in `src/components/ui/` (no shadcn CLI)
- **Forms**: react-hook-form + zod
- **Drag & drop**: @dnd-kit (pipeline kanban)

## Modules

- **Auth** — login / signup via Supabase, middleware route protection
- **Contacts** — CRUD, table view, dialog forms
- **Companies** — CRUD, card grid view
- **Pipeline** — kanban with 6 stages (prospect → qualified → proposal → negotiation → won / lost)
- **Projects** — card grid with status filters, linked to deals
- **Billing** — quotes + invoices, line items, TVA, auto-numbering via Supabase RPC
- **Settings** — profile + team member role management (admin-only deletes)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. Run the migration in the Supabase SQL editor:

   ```
   supabase/migrations/001_initial_schema.sql
   ```

   This creates all tables, RLS policies, the auto-profile trigger on `auth.users`, and the `generate_invoice_number` RPC.

### 3. Run the dev server

```bash
npm run dev
```

App is at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |

## Multi-user model

- Profiles auto-created via trigger on `auth.users` insert.
- Roles: `admin` | `member`.
- RLS — every member can read/write all records; only admins can delete.

## Project structure

```
src/
  app/
    (dashboard)/      # protected dashboard route group
    auth/             # login + Supabase OAuth callback
  components/
    ui/               # button, input, dialog, select, ...
    layout/           # sidebar, header, settings
    contacts/         # contacts + companies clients
    pipeline/         # kanban
    projects/
    billing/
  lib/
    supabase/         # browser, server, middleware clients
    utils.ts          # cn(), formatCurrency(), formatDate(), getInitials()
  types/
    index.ts          # shared TypeScript interfaces
  middleware.ts       # session refresh + route protection
supabase/
  migrations/         # SQL schema
```

## License

Private — internal use at Agence Prime.
