@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
  call npm run db:generate
  if errorlevel 1 exit /b 1
)
echo Open http://localhost:5173 after the servers are ready.
call npm run dev
