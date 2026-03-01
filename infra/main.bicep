// Event Vote - Azure Infrastructure
// Deploys: Azure Static Web App (Free), Azure Functions (Consumption), Storage Account (Table)
// Uses CORS since SWA Free doesn't support linked backends

targetScope = 'resourceGroup'

// ============================================================================
// Parameters
// ============================================================================

@description('Environment name (e.g., prod, dev)')
@allowed(['prod', 'dev'])
param environment string = 'prod'

@description('Azure region for storage resources')
param location string = resourceGroup().location

@description('Azure region for Static Web App')
param swaLocation string = 'eastus2'

@description('Custom domain for the Static Web App (e.g., evote.k61.dev)')
param customDomain string = ''

@description('Function App custom domain for CORS (e.g., https://evote.k61.dev)')
param allowedOrigin string = ''

@description('Tags to apply to all resources')
param tags object = {
  project: 'event-vote'
  environment: environment
}

// ============================================================================
// Variables
// ============================================================================

var resourceSuffix = environment == 'prod' ? '-prod' : '-${environment}'
var staticSiteName = 'swa-evote${resourceSuffix}'
var functionAppName = 'func-evote${resourceSuffix}'
var appServicePlanName = 'asp-evote${resourceSuffix}'
var storageAccountName = 'stevote${uniqueString(resourceGroup().id)}'

// ============================================================================
// Storage Account
// ============================================================================

module storageAccount 'br/public:avm/res/storage/storage-account:0.19.0' = {
  name: 'storageAccountDeployment'
  params: {
    name: storageAccountName
    location: location
    tags: tags
    skuName: 'Standard_LRS'
    kind: 'StorageV2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }

    // Tables are created by the Functions app on first access
    tableServices: {}
  }
}

// ============================================================================
// Azure Static Web App (Free tier)
// ============================================================================

module staticSite 'br/public:avm/res/web/static-site:0.7.0' = {
  name: 'staticSiteDeployment'
  params: {
    name: staticSiteName
    location: swaLocation
    tags: tags
    sku: 'Free'

    customDomains: customDomain != '' ? [customDomain] : []
  }
}

// ============================================================================
// Azure Functions (Consumption Plan)
// ============================================================================

module appServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: 'appServicePlanDeployment'
  params: {
    name: appServicePlanName
    location: location
    tags: tags
    kind: 'linux'
    reserved: true
    skuName: 'Y1'
    skuCapacity: 0
    zoneRedundant: false
  }
}

module functionApp 'br/public:avm/res/web/site:0.15.1' = {
  name: 'functionAppDeployment'
  params: {
    name: functionAppName
    location: location
    tags: tags
    kind: 'functionapp,linux'
    serverFarmResourceId: appServicePlan.outputs.resourceId
    httpsOnly: true

    managedIdentities: {
      systemAssigned: true
    }

    siteConfig: {
      linuxFxVersion: 'NODE|20'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'

      // CORS: Allow the SWA origin since Free tier can't use linked backends
      cors: {
        allowedOrigins: allowedOrigin != '' ? [allowedOrigin] : ['http://localhost:5173']
        supportCredentials: true
      }
    }

    storageAccountResourceId: storageAccount.outputs.resourceId
    storageAccountUseIdentityAuthentication: false

    appSettingsKeyValuePairs: {
      FUNCTIONS_EXTENSION_VERSION: '~4'
      FUNCTIONS_WORKER_RUNTIME: 'node'
      WEBSITE_NODE_DEFAULT_VERSION: '~20'
      WEBSITE_RUN_FROM_PACKAGE: '1'
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Static Web App default hostname')
output staticSiteDefaultHostname string = staticSite.outputs.defaultHostname

@description('Static Web App resource ID')
output staticSiteResourceId string = staticSite.outputs.resourceId

@description('Function App name')
output functionAppName string = functionApp.outputs.name

@description('Function App default hostname')
output functionAppHostname string = functionApp.outputs.defaultHostname

@description('Function App resource ID')
output functionAppResourceId string = functionApp.outputs.resourceId

@description('Storage Account name')
output storageAccountName string = storageAccount.outputs.name

@description('Storage Account resource ID')
output storageAccountResourceId string = storageAccount.outputs.resourceId

@description('Deployment token (retrieve via Azure CLI after deployment)')
output deploymentTokenNote string = 'Run: az staticwebapp secrets list --name ${staticSiteName} --query "properties.apiKey" -o tsv'
