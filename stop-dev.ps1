<#
.SYNOPSIS
    Stop the local development environment for Event Vote.
#>

Write-Host "Stopping Event Vote development services..." -ForegroundColor Yellow

# Stop WSL processes
wsl -d Ubuntu-22.04 -- bash -c "pkill -f azurite 2>/dev/null; pkill -f func 2>/dev/null" 2>$null

# Stop background jobs
Get-Job | Stop-Job -ErrorAction SilentlyContinue
Get-Job | Remove-Job -ErrorAction SilentlyContinue

Write-Host "   OK: All services stopped" -ForegroundColor Green
