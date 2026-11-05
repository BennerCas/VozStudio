# clean_cache.ps1
# Limpia caches temporales de Python, pytest, Vite y archivos residuales sin tocar modelos ni biblioteca.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

$Patterns = @("__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache")
$Removed = 0

foreach ($pat in $Patterns) {
    $dirs = Get-ChildItem -Path $ProjectRoot -Directory -Recurse -Filter $pat -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\models_link\\" }
    foreach ($d in $dirs) {
        Remove-Item -Path $d.FullName -Recurse -Force
        $Removed++
    }
}

$TmpFiles = Get-ChildItem -Path $ProjectRoot -File -Recurse -Include "*.tmp" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\models_link\\" }
foreach ($t in $TmpFiles) {
    Remove-Item -Path $t.FullName -Force
    $Removed++
}

[System.GC]::Collect()
Write-Output "[OK] Limpieza de caches completada ($Removed elementos eliminados)."
exit 0
