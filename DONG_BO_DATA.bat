@echo off
pushd "%~dp0"
echo [%date% %time%] DANG DONG BO DU LIEU EXCEL -> SUPABASE...
node sync.js
echo HOAN TAT!
timeout /t 5
popd
