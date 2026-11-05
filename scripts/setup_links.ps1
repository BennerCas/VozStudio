# setup_links.ps1
# Crea puentes reales (Directory Junctions) desde models_link/ hacia los directorios centrales de modelos en C:\antigravityAS\
# Cumple estrictamente GEMINI.md Regla 22 y ESTRUCTURA.md (cero duplicacion de modelos).

$ErrorActionPreference = "Stop"

$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$LinksRoot    = Join-Path $ProjectRoot "models_link"
$BrainsSpace  = "C:\antigravityAS\Modelos -ai-brains"
$BrainsHyphen = "C:\antigravityAS\Modelos-ai-brains"

if (-not (Test-Path $BrainsSpace)) {
    throw "No se encontro el directorio central de modelos: $BrainsSpace"
}

if (-not (Test-Path $LinksRoot)) {
    New-Item -ItemType Directory -Path $LinksRoot -Force | Out-Null
}

$ModelMappings = @(
    @{ Link = "kokoro-tts-voices";                Base = $BrainsSpace;  Target = "kokoro-tts";                    Required = $true  },
    @{ Link = "kokoro-v1_0-onnx";                 Base = $BrainsHyphen; Target = "kokoro-tts";                    Required = $true  },
    @{ Link = "kokoro-multi-lang-v1_1";           Base = $BrainsSpace;  Target = "kokoro-multi-lang-v1_1";        Required = $true  },
    @{ Link = "CosyVoice3-ONNX";                  Base = $BrainsSpace;  Target = "CosyVoice3-ONNX";               Required = $true  },
    @{ Link = "vits-piper-es_AR-daniela-high";    Base = $BrainsSpace;  Target = "vits-piper-es_AR-daniela-high"; Required = $true  },
    @{ Link = "vits-piper-es_ES-carlfm-x_low";    Base = $BrainsSpace;  Target = "vits-piper-es_ES-carlfm-x_low"; Required = $true  },
    @{ Link = "vits-piper-es_ES-davefx-medium";   Base = $BrainsSpace;  Target = "vits-piper-es_ES-davefx-medium";Required = $true  },
    @{ Link = "vits-piper-es_ES-sharvard-medium"; Base = $BrainsSpace;  Target = "vits-piper-es_ES-sharvard-medium"; Required = $true },
    @{ Link = "vits-piper-es_MX-ald-medium";      Base = $BrainsSpace;  Target = "vits-piper-es_MX-ald-medium";   Required = $true  },
    @{ Link = "vits-piper-es_MX-claude-high";     Base = $BrainsSpace;  Target = "vits-piper-es_MX-claude-high";  Required = $true  },
    @{ Link = "mms-tts-spa";                      Base = $BrainsSpace;  Target = "mms-tts-spa";                   Required = $false },
    @{ Link = "F5-Spanish";                       Base = $BrainsSpace;  Target = "F5-Spanish";                    Required = $false },
    @{ Link = "styletts2-spanish-multispeaker";   Base = $BrainsSpace;  Target = "styletts2-spanish-multispeaker";Required = $false },
    @{ Link = "MeloTTS-Spanish";                  Base = $BrainsSpace;  Target = "MeloTTS-Spanish";               Required = $false }
)

$LinkedCount = 0
$OptionalPending = 0

foreach ($item in $ModelMappings) {
    $targetPath = Join-Path $item.Base $item.Target
    $linkPath   = Join-Path $LinksRoot $item.Link

    if (Test-Path $targetPath) {
        if (Test-Path $linkPath) {
            $existing = Get-Item $linkPath -Force
            if ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                Write-Output "[OK] Enlace activo: $($item.Link) -> $targetPath"
                $LinkedCount++
                continue
            } else {
                Remove-Item -Path $linkPath -Recurse -Force
            }
        }
        New-Item -ItemType Junction -Path $linkPath -Target $targetPath | Out-Null
        Write-Output "[CREADO] Junction: $($item.Link) -> $targetPath"
        $LinkedCount++
    } else {
        if ($item.Required) {
            throw "Modelo requerido ausente en Brains: $targetPath"
        } else {
            Write-Output "[PENDIENTE OPCIONAL] $($item.Target) aun no descargado en $BrainsSpace."
            $OptionalPending++
        }
    }
}

Write-Output "---------------------------------------------------------"
Write-Output "Resumen de puentes a modelos: $LinkedCount vinculados, $OptionalPending opcionales pendientes."
exit 0
