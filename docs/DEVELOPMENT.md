# Development Guide

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **WSL with Ubuntu 22.04** (Windows) — `wsl --install -d Ubuntu-22.04`
- **Azure Functions Core Tools v4** — installed as dev dependency, or install globally
- **Azurite** (Azure Storage Emulator) — `npm install -g azurite` or use via WSL

## Local Setup

### 1. Clone & install

```bash
git clone https://github.com/kurtzeborn/event-vote.git
cd event-vote

# Install functions dependencies
cd functions
npm install
cd ..

# Install web dependencies
cd web
npm install
cd ..
```

### 2. Configure local settings

```bash
cp functions/local.settings.json.template functions/local.settings.json
```

The default settings use Azurite's local storage connection string — no Azure account needed.

### 3. Start development

**Windows (ARM64):**
```powershell
.\start-dev.ps1
```

**macOS/Linux/Windows x64:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

This starts:
- **Azurite** on port 10002 (Table Storage emulator)
- **Azure Functions** on port 7071
- **Vite dev server** on port 5173 (with proxy to Functions)

### 4. Open in browser

Navigate to [http://localhost:5173](http://localhost:5173).

## Development Workflow

### Project layout

| Directory | What | Build command |
|-----------|------|---------------|
| `functions/` | Azure Functions API (TypeScript) | `npm run build` |
| `web/` | React SPA (Vite + Tailwind) | `npx vite build` |
| `infra/` | Bicep infrastructure templates | N/A (deployed via Azure CLI) |

### Running tests

```bash
# Functions unit tests
cd functions
npm run test:run      # single run
npm test              # watch mode

# Type check web
cd web
npx tsc -b
```

### Key files to know

| File | Purpose |
|------|---------|
| `functions/src/types.ts` | Shared TypeScript interfaces |
| `functions/src/functions/events.ts` | Event CRUD + lifecycle transitions |
| `functions/src/functions/vote.ts` | Vote submission + anti-fraud |
| `functions/src/functions/results.ts` | Results, reveal, PDF generation |
| `web/src/api.ts` | Typed API client |
| `web/src/pages/VoterPage.tsx` | Voter mobile experience |
| `web/src/pages/ManageEventPage.tsx` | Votekeeper admin + reveal view |
| `web/src/pages/ResultsPage.tsx` | Public results with animations |

### Authentication in dev mode

SWA auth is not available locally. Mock auth is built in:

1. **Seed the dev votekeeper** (first time only — requires Azurite running):
   ```bash
   cd functions
   npm run seed
   ```
   This creates tables and adds `scott@kurtzeborn.org` as a votekeeper.

2. **Sign in** — click "Votekeeper Sign In" on the landing page. You'll see a mock login form instead of Microsoft Entra ID. Enter the seeded email and click Sign In.

3. **How it works** — the mock stores a fake `clientPrincipal` in localStorage. The API client sends it as `x-ms-client-principal` header on every request, matching what Azure SWA does in production.

### Vite proxy

The Vite dev server proxies `/api/*` requests to `http://localhost:7071` — see `web/vite.config.js`.

## Code Style

- TypeScript strict mode
- Tailwind CSS v4 (utility-first)
- React function components with hooks
- TanStack Query for all data fetching with polling
- No CSS-in-JS — all styling via Tailwind classes
