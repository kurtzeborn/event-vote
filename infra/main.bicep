// Event Vote - Azure Infrastructure
// Deploys: Azure Static Web App (Free) with managed API, Storage Account (Table)

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
// Azure Static Web App (Free tier with managed API)
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
// Outputs
// ============================================================================

@description('Static Web App default hostname')
output staticSiteDefaultHostname string = staticSite.outputs.defaultHostname

@description('Static Web App resource ID')
output staticSiteResourceId string = staticSite.outputs.resourceId

@description('Storage Account name')
output storageAccountName string = storageAccount.outputs.name

@description('Storage Account resource ID')
output storageAccountResourceId string = storageAccount.outputs.resourceId

@description('Deployment token (retrieve via Azure CLI after deployment)')
output deploymentTokenNote string = 'Run: az staticwebapp secrets list --name ${staticSiteName} --query "properties.apiKey" -o tsv'
