$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$LogDir = Join-Path $Root "run_logs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$env:PYTHONIOENCODING = "utf-8"
$env:VITE_API_TARGET = "http://127.0.0.1:8001"

Write-Host "Starting PhishGuard backend on http://127.0.0.1:8001 ..."
Start-Process -FilePath "py" `
  -ArgumentList "-3", "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001" `
  -WorkingDirectory $Backend `
  -RedirectStandardOutput (Join-Path $LogDir "backend.out.log") `
  -RedirectStandardError (Join-Path $LogDir "backend.err.log") `
  -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "Starting PhishGuard frontend on http://127.0.0.1:5174 ..."
Start-Process -FilePath "npm" `
  -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "5174" `
  -WorkingDirectory $Frontend `
  -RedirectStandardOutput (Join-Path $LogDir "frontend.out.log") `
  -RedirectStandardError (Join-Path $LogDir "frontend.err.log") `
  -WindowStyle Hidden

Write-Host ""
Write-Host "PhishGuard is starting."
Write-Host "Open: http://127.0.0.1:5174"
Write-Host "API:  http://127.0.0.1:8001"
