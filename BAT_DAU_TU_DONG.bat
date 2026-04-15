@echo off
pushd "%~dp0"
title HE THONG TU DONG CAP NHAT DASHBOARD
cls
echo ----------------------------------------------------
echo    ORTHOLITE PRODUCTION - AUTO SYNC SYSTEM
echo ----------------------------------------------------
echo.
echo [*] Dang khoi dong che do tu dong...
echo [*] He thong se tu dong day du lieu moi khi file Excel thay doi.
echo [*] Vui long KHONG dong cua so nay khi dang lam viec.
echo.
node auto_sync.js
pause
popd
