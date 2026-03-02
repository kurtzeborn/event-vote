# Deployment Guide

## Architecture

```
┌───────────────┐          ┌──────────────────────────────┐
│  Cloudflare   │  CNAME   │  Azure Static Web App (Free) │
│  DNS          │─────────►│  evote.k61.dev               │
│               │          │                              │
└───────────────┘          │  ┌────────────┐ ┌──────────┐ │
                           │  │ React SPA  │ │ Managed  │ │
                           │  │ (Vite)     │ │ Functions│ │
                           │  └────────────┘ └────┬─────┘ │
                           └──────────────────────┼───────┘
                                                  │
                                       ┌──────────▼───────────┐
                                       │  Azure Table Storage  │
                                       │  4 tables: events,    │
                                       │  votingoptions, votes, │
                                       │  votekeepers           │
                                       └───────────────────────┘
```

The API runs as a **SWA managed API** — Functions are deployed alongside the SPA within the same Static Web App resource. SWA securely injects the `x-ms-client-principal` header for authenticated requests. No CORS configuration needed.

## Prerequisites

- Azure subscription
- Azure CLI (`az`) installed
- GitHub repo with Actions enabled

## Infrastructure Deployment

### 1. Create resource group

```bash
az group create --name rg-event-vote --location westus2
```

### 2. Deploy Bicep template

```bash
az deployment group create \
  --resource-group rg-event-vote \
  --template-file infra/main.bicep \
  --parameters \
    environment=prod \
    customDomain=evote.k61.dev
```

This creates:
- **Storage Account** (Standard_LRS) — tables are auto-created by Functions on first access
- **Static Web App** (Free tier) — hosts the React SPA + managed API Functions

### 3. Get deployment token

```bash
az staticwebapp secrets list --name swa-evote-prod --query "properties.apiKey" -o tsv
```

### 4. Set storage connection string

The managed API needs access to Table Storage. Set it as an SWA app setting:

```bash
# Get the storage connection string
CONN=$(az storage account show-connection-string \
  --name <storage-account-name> \
  --resource-group rg-event-vote \
  --query connectionString -o tsv)

# Set it on the SWA
az staticwebapp appsettings set \
  --name swa-evote-prod \
  --setting-names "AZURE_STORAGE_CONNECTION_STRING=$CONN"
```

## CI/CD Setup

### GitHub Secrets

| Secret | Value | Source |
|--------|-------|--------|
| `SWA_DEPLOYMENT_TOKEN` | SWA API key | `az staticwebapp secrets list ...` |

No other secrets or variables are needed.

### Workflows

- **CI** (`.github/workflows/ci.yml`) — Runs on every push and PR: builds both projects, runs Functions tests, type-checks web.
- **Deploy** (`.github/workflows/deploy.yml`) — Runs on push to `main`: builds, tests, and deploys both SPA and managed API to SWA in a single step.

## Custom Domain

1. Add a CNAME record in Cloudflare: `evote` → SWA default hostname (proxy **OFF**)
2. Configure via Bicep `customDomain` parameter or Azure portal
3. SWA handles SSL automatically

## Updating

Push to `main` → CI runs → Deploy triggers automatically.

For infrastructure changes, re-run the Bicep deployment:
```bash
az deployment group create \
  --resource-group rg-event-vote \
  --template-file infra/main.bicep \
  --parameters environment=prod customDomain=evote.k61.dev
```
