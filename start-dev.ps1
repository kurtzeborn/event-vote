<#
.SYNOPSIS
    Start the local development environment for Event Vote.

.DESCRIPTION
    This script starts all required services for local development:
    - Azurite (Azure Storage Emulator) in WSL
    - Azure Functions in WSL
    - Vite dev server

.PARAMETER FunctionsPort
    Port for Azure Functions (default: 7071).

.EXAMPLE
    .\start-dev.ps1
#>

param(
    [int]$FunctionsPort = 7071
)

$ErrorActionPreference = "Stop"

# Get the repo root path and convert to WSL path
$repoRoot = $PSScriptRoot
$driveLetter = $repoRoot.Substring(0, 1).ToLower()
$pathWithoutDrive = $repoRoot.Substring(2) -replace '\\', '/'
$wslRepoRoot = "/mnt/$driveLetter$pathWithoutDrive"

Write-Host "`nEvent Vote - Local Development Setup" -ForegroundColor Cyan
Write-Host "=====================================`n" -ForegroundColor Cyan

# Check WSL is available
Write-Host "[1/7] Checking WSL..." -ForegroundColor Yellow
try {
    $wslVersion = wsl --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "WSL not found" }
    Write-Host "   OK: WSL is installed" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: WSL is not installed. Please run: wsl --install -d Ubuntu-22.04" -ForegroundColor Red
    exit 1
}

$distros = wsl -l -q
if ($distros -notcontains "Ubuntu-22.04") {
    Write-Host "   ERROR: Ubuntu-22.04 not found. Please run: wsl --install -d Ubuntu-22.04" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Ubuntu-22.04 is available" -ForegroundColor Green

# Get WSL IP
Write-Host "`n[2/7] Getting WSL IP address..." -ForegroundColor Yellow
$wslIp = (wsl -d Ubuntu-22.04 -- hostname -I).Trim().Split()[0]
if (-not $wslIp) {
    Write-Host "   ERROR: Failed to get WSL IP" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: WSL IP: $wslIp" -ForegroundColor Green

# Check WSL dependencies
Write-Host "`n[3/7] Checking WSL dependencies..." -ForegroundColor Yellow

$nodeVersion = wsl -d Ubuntu-22.04 -- node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERROR: Node.js not installed in WSL. See docs/DEVELOPMENT.md for setup." -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Node.js: $nodeVersion" -ForegroundColor Green

$funcVersion = wsl -d Ubuntu-22.04 -- func --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERROR: Azure Functions Core Tools not installed in WSL." -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Azure Functions Core Tools: $funcVersion" -ForegroundColor Green

$azuriteCheck = wsl -d Ubuntu-22.04 -- which azurite 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERROR: Azurite not installed in WSL. Run: wsl -d Ubuntu-22.04 -- sudo npm install -g azurite" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Azurite is installed" -ForegroundColor Green

# Kill existing processes
Write-Host "`n[4/7] Cleaning up existing processes..." -ForegroundColor Yellow
wsl -d Ubuntu-22.04 -- bash -c "pkill -f azurite 2>/dev/null; pkill -f func 2>/dev/null" 2>$null
Start-Sleep -Seconds 1
Write-Host "   OK: Cleaned up" -ForegroundColor Green

# Start Azurite
Write-Host "`n[5/7] Starting Azurite (Storage Emulator)..." -ForegroundColor Yellow
$azuriteJob = Start-Job -ScriptBlock {
    wsl -d Ubuntu-22.04 -- bash -c "mkdir -p ~/azurite-data && azurite --location ~/azurite-data --blobHost 0.0.0.0 --blobPort 10000 --queueHost 0.0.0.0 --queuePort 10001 --tableHost 0.0.0.0 --tablePort 10002 --skipApiVersionCheck --loose 2>&1"
}
Start-Sleep -Seconds 2

$azuriteRunning = wsl -d Ubuntu-22.04 -- bash -c "pgrep -f azurite" 2>&1
if ($azuriteRunning) {
    Write-Host "   OK: Azurite started (ports 10000-10002)" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Failed to start Azurite" -ForegroundColor Red
    exit 1
}

# Install and build functions
$functionsNodeModules = Join-Path $PSScriptRoot "functions\node_modules"
if (-not (Test-Path $functionsNodeModules)) {
    Write-Host "`n   Installing functions dependencies..." -ForegroundColor Yellow
    wsl -d Ubuntu-22.04 -- bash -c "cd ${wslRepoRoot}/functions && npm install 2>&1" | Out-Null
    Write-Host "   OK: Dependencies installed" -ForegroundColor Green
}

Write-Host "`n[6/7] Building Azure Functions..." -ForegroundColor Yellow
$buildResult = wsl -d Ubuntu-22.04 -- bash -c "cd ${wslRepoRoot}/functions && npm run build 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERROR: Build failed:" -ForegroundColor Red
    Write-Host $buildResult
    exit 1
}
Write-Host "   OK: Build complete" -ForegroundColor Green

# Start Azure Functions
Write-Host "`n[7/7] Starting Azure Functions on port $FunctionsPort..." -ForegroundColor Yellow
$funcJob = Start-Job -ScriptBlock {
    param($port, $wslPath)
    wsl -d Ubuntu-22.04 -- bash -c "cd ${wslPath}/functions && func start --port $port 2>&1"
} -ArgumentList $FunctionsPort, $wslRepoRoot

Write-Host "   Waiting for functions to initialize..." -ForegroundColor Gray
$maxRetries = 30
$retry = 0
$functionsReady = $false
while ($retry -lt $maxRetries -and -not $functionsReady) {
    Start-Sleep -Seconds 1
    try {
        $response = curl.exe -s "http://${wslIp}:${FunctionsPort}/api/me" 2>$null
        if ($response) { $functionsReady = $true }
    } catch {}
    $retry++
    Write-Host "." -NoNewline -ForegroundColor Gray
}
Write-Host ""

if ($functionsReady) {
    Write-Host "   OK: Azure Functions started" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Azure Functions failed to start. Check: Receive-Job $($funcJob.Id)" -ForegroundColor Red
    exit 1
}

# Set API_TARGET env var for Vite proxy
$env:API_TARGET = "http://${wslIp}:${FunctionsPort}"
Write-Host "   OK: API_TARGET set to http://${wslIp}:${FunctionsPort}" -ForegroundColor Green

# Install web dependencies if needed
$nodeModulesPath = Join-Path $PSScriptRoot "web\node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "`nInstalling web dependencies..." -ForegroundColor Yellow
    Push-Location (Join-Path $PSScriptRoot "web")
    npm install
    Pop-Location
    Write-Host "   OK: Dependencies installed" -ForegroundColor Green
}

# Start Vite dev server
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "  Development environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  Web App:     http://localhost:5173" -ForegroundColor White
Write-Host "  Functions:   http://${wslIp}:${FunctionsPort}" -ForegroundColor White
Write-Host "  Azurite:     Ports 10000-10002 (in WSL)" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Gray
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

$cleanup = {
    Write-Host "`n`nShutting down..." -ForegroundColor Yellow
    wsl -d Ubuntu-22.04 -- bash -c "pkill -f azurite 2>/dev/null; pkill -f func 2>/dev/null"
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "   OK: All services stopped" -ForegroundColor Green
}

try {
    Push-Location (Join-Path $PSScriptRoot "web")
    npm run dev
} finally {
    & $cleanup
    Pop-Location
}
