# Code and Database sync script for n8n integration
Write-Host "Syncing code and database to VM for n8n..." -ForegroundColor Green

# VM Configuration
$VM_HOST = "python-fastapi-u50080.vm.elestio.app"
$VM_USER = "root"

# Check if database file exists
if (!(Test-Path "writegeist.db")) {
    Write-Host "Error: writegeist.db not found in current directory!" -ForegroundColor Red
    exit 1
}

# Check if ai-service directory exists
if (!(Test-Path "ai-service")) {
    Write-Host "Error: ai-service directory not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Database size: $((Get-Item writegeist.db).Length) bytes"

try {
    # Upload updated Python code using scp
    Write-Host "Uploading updated API code to VM..." -ForegroundColor Yellow
    & scp -r ai-service/* "${VM_USER}@${VM_HOST}:/writegeist/ai-service/"
    
    if ($LASTEXITCODE -ne 0) {
        throw "Code upload failed"
    }
    
    # Upload database using scp
    Write-Host "Uploading database to VM..." -ForegroundColor Yellow
    & scp writegeist.db "${VM_USER}@${VM_HOST}:/writegeist/"
    
    if ($LASTEXITCODE -ne 0) {
        throw "Database upload failed"
    }
    
    # Restart API container
    Write-Host "Restarting API container..." -ForegroundColor Yellow
    & ssh "${VM_USER}@${VM_HOST}" "cd /writegeist && docker-compose restart fastapi"
    
    if ($LASTEXITCODE -ne 0) {
        throw "Container restart failed"
    }
    
    Write-Host "✅ Code and database sync complete!" -ForegroundColor Green
    Write-Host "n8n can now access your latest changes with updated API endpoints." -ForegroundColor Green
    
} catch {
    Write-Host "❌ Sync failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 