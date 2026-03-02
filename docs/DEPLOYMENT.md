# Deployment Guide

## Architecture

```
┌─────────────────┐     CORS      ┌──────────────────────┐
│  Azure Static   │◄────────────►│   Azure Functions    │
│  Web App (Free) │              │   (Consumption/Y1)   │
│  evote.k61.dev  │              │   func-evote-prod    │
└─────────────────┘              └──────────┬───────────┘
                                            │
                                 ┌──────────▼───────────┐
                                 │   Azure Table Storage │
                                 │   4 tables:           │
                                 │   events, options,    │
                                 │   votes, votekeepers  │
                                 └──────────────────────┘
```

**Note**: SWA Free tier doesn't support linked backends. The Function App is deployed separately, and CORS is configured to allow the SWA origin.

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
    customDomain=evote.k61.dev \
    allowedOrigin=https://evote.k61.dev
```

This creates:
- **Storage Account** (Standard_LRS) — tables are auto-created by Functions on first access
- **Static Web App** (Free tier) — hosts the React SPA
- **App Service Plan** (Y1 Consumption) — serverless compute
- **Function App** (Linux, Node.js 20) — API backend with managed identity

### 3. Get deployment outputs

```bash
# SWA deployment token
az staticwebapp secrets list --name swa-evote-prod --query "properties.apiKey" -o tsv

# Function App publish profile
az functionapp deployment list-publishing-profiles \
  --name func-evote-prod \
  --resource-group rg-event-vote \
  --xml
```

## CI/CD Setup

### GitHub Secrets

Add these secrets to the GitHub repository:

| Secret | Value | Source |
|--------|-------|--------|
| `SWA_DEPLOYMENT_TOKEN` | SWA API key | `az staticwebapp secrets list ...` |
| `AZURE_FUNCTIONS_PUBLISH_PROFILE` | Function App publish profile XML | `az functionapp deployment list-publishing-profiles ...` |

### GitHub Variables

| Variable | Value |
|----------|-------|
| `FUNCTION_APP_NAME` | `func-evote-prod` |

> **Note**: The deploy workflow automatically derives `VITE_API_BASE` from `FUNCTION_APP_NAME` during web build (`https://{FUNCTION_APP_NAME}.azurewebsites.net/api`). No separate variable needed.

### Workflows

- **CI** (`.github/workflows/ci.yml`) — Runs on every push and PR: builds both projects, runs Functions tests, type-checks web.
- **Deploy** (`.github/workflows/deploy.yml`) — Runs on push to `main`: builds, tests, and deploys both SWA and Functions to Azure.

## Custom Domain

1. Add a CNAME record: `evote.k61.dev` → SWA default hostname
2. Configure in Azure portal or via Bicep `customDomain` parameter
3. SWA handles SSL automatically

## Environment Variables

The Function App needs these app settings (set via Bicep or Azure portal):

| Setting | Value |
|---------|-------|
| `FUNCTIONS_EXTENSION_VERSION` | `~4` |
| `FUNCTIONS_WORKER_RUNTIME` | `node` |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` |
| `AzureWebJobsStorage` | Storage account connection string (auto-configured) |

## Updating

Push to `main` → CI runs → Deploy triggers automatically.

For infrastructure changes, re-run the Bicep deployment:
```bash
az deployment group create \
  --resource-group rg-event-vote \
  --template-file infra/main.bicep \
  --parameters environment=prod
```
