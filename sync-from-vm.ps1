# Sync database FROM VM to local
Write-Host "Syncing database from VM to local..." -ForegroundColor Green

# Download the database from VM
Write-Host "Downloading database from VM..." -ForegroundColor Yellow
scp root@python-fastapi-u50080.vm.elestio.app:/writegeist/writegeist.db ./writegeist.db

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database synced successfully from VM!" -ForegroundColor Green
    Write-Host "Your local database now has the latest changes from n8n workflows." -ForegroundColor Cyan
} else {
    Write-Host "Failed to sync database from VM" -ForegroundColor Red
    exit 1
} 