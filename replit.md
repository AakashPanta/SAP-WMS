# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### SAP EWM Mobile (`artifacts/mobile`)
- **Type**: Expo (React Native) mobile app
- **Preview path**: `/`
- **Purpose**: Modern mobile UI for SAP EWM warehouse workflows. Replaces the legacy ITS/WebGUI interface with a professional, enterprise-grade mobile experience.
- **Screens**:
  - `app/index.tsx` — Splash router: checks session validity on launch and redirects (no login if session exists)
  - `app/login.tsx` — SAP sign-in (Email/User + Password, 2-step: credentials then warehouse config)
  - `app/warehouse.tsx` — Warehouse operations screen (Warehouse No., Resource, Dflt Pres. Dev., F2 RcvRe + function keys)
- **Session persistence**:
  - Credentials stored securely via `expo-secure-store` (password) + `AsyncStorage` (username, client, warehouse config)
  - On launch: validates stored session → auto re-authenticates with stored credentials if expired → skips login entirely if valid
  - Users only log in once; subsequent launches go directly to the warehouse screen
- **Key components**:
  - `components/FormField.tsx` — Reusable styled form input
  - `components/ActionButton.tsx` — Primary/secondary/ghost action buttons
  - `components/StatusBadge.tsx` — Connection status indicator
  - `components/SectionCard.tsx` — Card container with header
  - `components/InfoRow.tsx` — Label-value display row
  - `components/SapHeader.tsx` — Top navigation bar
  - `context/SapContext.tsx` — SAP session state, credential storage, auto-reauth logic
- **Design**: SAP S/4HANA Cloud style, navy blue (#0050aa) enterprise theme, Inter font, card-based layout
- **Backend**: Connects to SAP S/4HANA Cloud EWM backend via Express proxy (real cookies, in-memory session store)

### API Server (`artifacts/api-server`)
- **Type**: Express 5 API server
- **Preview path**: `/api`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mobile run dev` — run Expo dev server

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
