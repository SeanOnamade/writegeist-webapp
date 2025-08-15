@echo off
echo Syncing database to VM...

REM Replace with your actual VM details
set VM_HOST=python-fastapi-u50080.vm.elestio.app
set VM_USER=root

REM Copy database to VM
echo Uploading database...
scp writegeist.db %VM_USER%@%VM_HOST%:/writegeist/

REM Restart the API container to pick up changes
echo Restarting API container...
ssh %VM_USER%@%VM_HOST% "cd /writegeist && docker-compose restart fastapi"

echo Database sync complete!
echo n8n should now have access to your latest changes.
pause 