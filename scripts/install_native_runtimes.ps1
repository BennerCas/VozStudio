<#
Instala los runtimes aislados de VozStudio en .runtimes/ sin alterar el Python
que usa el backend principal. Requiere Miniconda/Conda y winget en Windows.
#>
[CmdletBinding()]
param(
  [switch]$SkipQwen,
  [switch]$SkipF5,
  [switch]$SkipDirectML
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.runtimes'
$condaCommand = Get-Command conda -ErrorAction Stop

function Invoke-EnvironmentInstall {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$PythonVersion,
    [string[]]$CondaPackages = @(),
    [string[]]$PipPackages = @()
  )

  $target = Join-Path $runtimeRoot $Name
  $python = Join-Path $target 'python.exe'
  if (-not (Test-Path $python)) {
    & $condaCommand.Source create --prefix $target "python=$PythonVersion" @CondaPackages -y
  }
  & $python -m pip install --upgrade pip
  if ($PipPackages.Count -gt 0) {
    & $python -m pip install --upgrade @PipPackages
  }
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

if (-not $SkipQwen) {
  Invoke-EnvironmentInstall -Name 'qwen3-tts' -PythonVersion '3.12' -PipPackages @('qwen-tts')
}

if (-not $SkipF5) {
  Invoke-EnvironmentInstall -Name 'f5-tts' -PythonVersion '3.11' -CondaPackages @('ffmpeg') -PipPackages @('f5-tts')
}

if (-not $SkipDirectML) {
  Invoke-EnvironmentInstall -Name 'directml' -PythonVersion '3.10' -PipPackages @('torch-directml')
}

if (Get-Command winget -ErrorAction SilentlyContinue) {
  winget install --id ChrisBagwell.SoX --exact --source winget --accept-package-agreements --accept-source-agreements --silent
}

Write-Host 'Runtimes nativos instalados. Cierra y vuelve a abrir VozStudio para que el lanzador recargue el entorno.'
