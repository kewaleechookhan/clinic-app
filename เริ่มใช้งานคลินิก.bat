@echo off
title ระบบบริหารคลินิกการแพทย์แผนไทย
echo กำลังเริ่มต้นเซิร์ฟเวอร์สำหรับเข้าใช้งานระบบคลินิก...

:: Run PowerShell static server in a new minimized window
start /min powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"

:: Wait 2 seconds for the server to spin up
timeout /t 2 /nobreak >nul

:: Open browser at the local URL
start http://localhost:8000

echo.
echo =======================================================
echo     ระบบเปิดหน้าต่างเบราว์เซอร์เข้าสู่โปรแกรมสำเร็จแล้ว!
echo     (กรุณาเปิดหน้าต่างนี้ไว้ หรือย่อขนาดลงขณะใช้งานระบบ)
echo =======================================================
echo.
timeout /t 3 >nul
exit
