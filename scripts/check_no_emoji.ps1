# check_no_emoji.ps1
# Valida la politica estricta de CERO EMOJIS en codigo fuente, interfaz UI, scripts y documentacion del proyecto.
# Permite unicamente simbolos tipograficos autorizados como ® (U+00AE) para la firma oficial de DISENO.md.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

$ScanPaths = @(
    (Join-Path $ProjectRoot "src"),
    (Join-Path $ProjectRoot "tests"),
    (Join-Path $ProjectRoot "scripts"),
    (Join-Path $ProjectRoot "docs"),
    (Join-Path $ProjectRoot "README.md")
)

$ValidExtensions = @(".py", ".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".md", ".ps1", ".json")
$ExcludedDirs = @("node_modules", "dist", ".vite", "__pycache__", ".pytest_cache", "playwright-report", "test-results")

# Rangos Unicode de emojis, dingbats, emoticonos, pictogramas, banderas regionales y variadores emoji
$EmojiRegex = '[\u2600-\u27BF]|[\uFE0F]|[\u200D]|\p{Cs}'

$Violations = @()

foreach ($base in $ScanPaths) {
    if (-not (Test-Path $base)) { continue }
    $item = Get-Item $base
    if ($item.PSIsContainer) {
        $files = Get-ChildItem -Path $base -Recurse -File | Where-Object {
            $extOk = $ValidExtensions -contains $_.Extension.ToLower()
            $full = $_.FullName
            $excluded = $false
            foreach ($ex in $ExcludedDirs) {
                if ($full -match [regex]::Escape("\$ex\")) { $excluded = $true; break }
            }
            $extOk -and (-not $excluded) -and ($_.Name -ne "package-lock.json")
        }
    } else {
        $files = @($item)
    }

    foreach ($f in $files) {
        # No auto-detectar la expresion regular literal en este propio script o en test_no_emoji.py
        if ($f.Name -in @("check_no_emoji.ps1", "test_no_emoji.py")) { continue }
        $lines = [System.IO.File]::ReadAllLines($f.FullName, [System.Text.Encoding]::UTF8)
        for ($i = 0; $i -lt $lines.Length; $i++) {
            if ($lines[$i] -match $EmojiRegex) {
                $Violations += "$($f.FullName):$($i + 1) -> Caracter emoji prohibido detectado."
            }
        }
    }
}

if ($Violations.Count -gt 0) {
    Write-Output "[FALLO] Se detectaron violaciones a la regla CERO EMOJIS:"
    foreach ($v in $Violations) {
        Write-Output "  $v"
    }
    exit 1
}

Write-Output "[OK] Verificacion CERO EMOJIS superada sin infracciones."
exit 0
