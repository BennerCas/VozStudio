# start_dev.ps1
# Inicia el servidor backend FastAPI DirectML y el cliente frontend Vite de VozStudio Omni-ES.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Output "Verificando enlaces a modelos locales..."
& pwsh -NoProfile -File (Join-Path $PSScriptRoot "setup_links.ps1")

$env:OLIVE_GPU_MEMORY_LIMIT = "25"
$env:OLIVE_CPU_THREADS = "12"
$env:ORT_DML_DEVICE_ID = "0"
$env:PYTHONPATH = $ProjectRoot

Write-Output "Iniciando Backend FastAPI en http://127.0.0.1:8880 ..."
$BackendProc = Start-Process -FilePath "python" -ArgumentList "-m", "src.main.main" -WorkingDirectory $ProjectRoot -PassThru

$UiDir = Join-Path $ProjectRoot "src\ui"
if (Test-Path (Join-Path $UiDir "package.json")) {
    Write-Output "Iniciando Frontend Vite en http://127.0.0.1:5173 ..."
    Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $UiDir
}

Write-Output "Backend PID: $($BackendProc.Id). Presiona Ctrl+C para detener si se ejecuta en primer plano."
