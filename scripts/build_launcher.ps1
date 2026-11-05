# build_launcher.ps1
# Genera el icono nativo .ico, compila el ejecutable Win64 sin consola VozStudio-Omni-ES.exe
# (/target:winexe) y crea accesos directos (.lnk) listos para usar.

param(
    [switch]$CreateDesktopShortcut
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LauncherSrcDir = Join-Path $PSScriptRoot "launcher"
$IconGenerator = Join-Path $LauncherSrcDir "generate_icon.py"
$IconPath = Join-Path $LauncherSrcDir "vozstudio.ico"
$CsSource = Join-Path $LauncherSrcDir "VozStudioLauncher.cs"
$OutputExe = Join-Path $ProjectRoot "VozStudio-Omni-ES.exe"

Write-Output "[1/4] Generando icono vectorial multi-resolucion vozstudio.ico..."
& python $IconGenerator
if (-not (Test-Path $IconPath)) {
    throw "No se genero el archivo de icono: $IconPath"
}

Write-Output "[2/4] Localizando compilador nativo Win64 C# (csc.exe)..."
$CscPath = Get-ChildItem "C:\Windows\Microsoft.NET\Framework64" -Recurse -Filter "csc.exe" -ErrorAction SilentlyContinue |
    Select-Object -Last 1 -ExpandProperty FullName
if (-not $CscPath) {
    throw "No se encontro csc.exe en Microsoft.NET\Framework64."
}

Write-Output "[3/4] Compilando lanzador sin consola (/target:winexe): $OutputExe ..."
& $CscPath `
    /nologo `
    /target:winexe `
    /optimize+ `
    /platform:x64 `
    "/win32icon:$IconPath" `
    /r:System.dll `
    /r:System.Drawing.dll `
    /r:System.Windows.Forms.dll `
    "/out:$OutputExe" `
    $CsSource

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $OutputExe)) {
    throw "Fallo la compilacion de $OutputExe"
}

Write-Output "[4/4] Creando acceso directo nativo (.lnk)..."
$WshShell = New-Object -ComObject WScript.Shell
$ProjectShortcutPath = Join-Path $ProjectRoot "Iniciar VozStudio Omni-ES.lnk"
$Shortcut = $WshShell.CreateShortcut($ProjectShortcutPath)
$Shortcut.TargetPath = $OutputExe
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.IconLocation = "$IconPath,0"
$Shortcut.WindowStyle = 1
$Shortcut.Description = "VozStudio Omni-ES - Estacion de Voces Neurales Offline (Modo Kiosko Independiente)"
$Shortcut.Save()

if ($CreateDesktopShortcut) {
    $DesktopDir = [Environment]::GetFolderPath("Desktop")
    if ($DesktopDir -and (Test-Path $DesktopDir)) {
        $DeskShortcutPath = Join-Path $DesktopDir "VozStudio Omni-ES.lnk"
        $DeskShortcut = $WshShell.CreateShortcut($DeskShortcutPath)
        $DeskShortcut.TargetPath = $OutputExe
        $DeskShortcut.WorkingDirectory = $ProjectRoot
        $DeskShortcut.IconLocation = "$IconPath,0"
        $DeskShortcut.WindowStyle = 1
        $DeskShortcut.Description = "VozStudio Omni-ES - Estacion de Voces Neurales Offline"
        $DeskShortcut.Save()
        Write-Output "[OK] Acceso directo creado en Escritorio: $DeskShortcutPath"
    }
}

Write-Output "[OK] Lanzador compilado y verificado: $OutputExe"
exit 0
