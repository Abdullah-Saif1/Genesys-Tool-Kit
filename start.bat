@echo off
cd /d "%~dp0"

echo Starting Genesys Cloud Toolkit server...
start "Genesys Toolkit - Server" cmd /k "npm start"

timeout /t 3 /nobreak >nul

echo Starting public tunnel (Cloudflare)...
start "Genesys Toolkit - Tunnel" cmd /k ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --protocol http2 --url http://localhost:3000"

echo.
echo Two windows just opened:
echo   1) "Genesys Toolkit - Server"  - shows the login username/password
echo   2) "Genesys Toolkit - Tunnel"  - shows your new https://....trycloudflare.com link
echo.
echo Keep both windows open while you want the site reachable. Closing this window is fine.
pause
