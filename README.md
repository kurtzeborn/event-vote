# Event Vote

Live audience voting for events. Attendees scan a QR code or enter a 4-letter event code to cast their votes.

## Features

- **Votekeepers** (admins) create events, configure voting options, and control the event lifecycle
- **Voters** join via code/QR, allocate votes across options, and watch results revealed live
- Scavenger-hunt-style reveal: results shown from lowest to highest rank
- PDF report generation for completed events
- Anti-fraud protection via device fingerprinting + session cookies

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + React Router v7 + TanStack Query
- **Backend:** Azure Functions v4 (Node.js/TypeScript)
- **Storage:** Azure Table Storage
- **Hosting:** Azure Static Web Apps (Free tier) + Azure Functions (Consumption)
- **Domain:** evote.k61.dev

## Quick Start

**Windows (ARM64):**
```powershell
.\start-dev.ps1
```

**macOS/Linux:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

See [docs/plan.md](docs/plan.md) for the full development plan.

## Project Structure

```
event-vote/
├── functions/      # Azure Functions API (TypeScript)
│   └── src/
│       ├── functions/   # HTTP trigger handlers
│       ├── services/    # Business logic
│       └── types.ts     # Shared type definitions
├── web/            # React SPA (Vite + Tailwind)
│   └── src/
│       ├── pages/       # Route pages
│       ├── contexts/    # React contexts
│       └── api.ts       # API client
├── infra/          # Azure Bicep templates
├── docs/           # Documentation
└── tests/          # Integration/smoke tests
```
