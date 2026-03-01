# Event Vote

Live audience voting for events. Attendees scan a QR code or enter a 4-letter event code to cast their votes from their phones — no login required.

## Features

- **Votekeepers** (admins) create events, configure voting options, and control the event lifecycle
- **Voters** join via code/QR, allocate votes across options, and watch results revealed live
- Scavenger-hunt-style reveal: results shown from lowest to highest rank with animations
- Medal icons for top 3, winner celebration banner with sparkles
- PDF report generation for completed events
- Anti-fraud protection via device fingerprinting + session cookies
- Works great on mobile — sticky vote counter, safe area support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 + TanStack Query v5 |
| **Backend** | Azure Functions v4 (Node.js 20 / TypeScript) |
| **Storage** | Azure Table Storage (4 tables) |
| **Hosting** | Azure Static Web Apps (Free) + Azure Functions (Consumption) |
| **Charts** | Recharts v2.15 (results page) + pdf-lib (server-side PDF) |
| **Domain** | evote.k61.dev |

## Quick Start

**Windows (ARM64):**
```powershell
.\start-dev.ps1
```

**macOS/Linux/Windows x64:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

## How It Works

1. **Votekeeper** signs in and creates an event
2. **Votekeeper** adds voting options (projected on screen for the audience)
3. **Votekeeper** clicks **Open Voting** — attendees scan QR code from their phones
4. **Attendees** distribute their votes (default 3) across options
5. **Votekeeper** closes voting and triggers the reveal
6. Results unveiled **last-to-first** with animations and medals
7. Winner announced with celebration effect
8. PDF report available for download

## Project Structure

```
event-vote/
├── functions/           # Azure Functions API (TypeScript)
│   └── src/
│       ├── functions/   # HTTP trigger handlers (events, vote, results, options, etc.)
│       ├── services/    # Business logic + tests
│       └── types.ts     # Shared type definitions
├── web/                 # React SPA (Vite + Tailwind)
│   └── src/
│       ├── pages/       # Route pages (Landing, Voter, Manage, Results, etc.)
│       ├── components/  # Shared components (ErrorBoundary, OfflineBanner)
│       ├── contexts/    # React contexts (Auth)
│       └── api.ts       # Typed API client
├── infra/               # Azure Bicep infrastructure
├── docs/                # Documentation
│   ├── plan.md          # Full development plan
│   ├── DEVELOPMENT.md   # Local dev setup
│   └── DEPLOYMENT.md    # Azure deployment guide
└── .github/workflows/   # CI/CD pipelines
    ├── ci.yml           # Build + test on PR
    └── deploy.yml       # Deploy to Azure on push to main
```

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) — Local setup, prerequisites, dev workflow
- [Deployment Guide](docs/DEPLOYMENT.md) — Azure deployment, secrets, infrastructure
- [Development Plan](docs/plan.md) — Full feature plan with phases

## License

Private repository.
