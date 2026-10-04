$ErrorActionPreference = 'Stop'
$qaRoot = Split-Path $PSScriptRoot -Parent
$toolRoot = Join-Path $qaRoot '.cache/security-tools'
New-Item -ItemType Directory -Force $toolRoot | Out-Null
$pins = Get-Content (Join-Path $PSScriptRoot 'tools.json') -Raw | ConvertFrom-Json
foreach ($item in @(@{pin=$pins.gitleaks;file='gitleaks.zip'}, @{pin=$pins.osv;file='osv-scanner.exe'})) {
    $target = Join-Path $toolRoot $item.file
    if (!(Test-Path $target) -or (Get-FileHash $target).Hash.ToLowerInvariant() -ne $item.pin.sha256) {
        Invoke-WebRequest $item.pin.url -OutFile $target -TimeoutSec 300
    }
    if ((Get-FileHash $target).Hash.ToLowerInvariant() -ne $item.pin.sha256) { throw 'Scanner checksum mismatch' }
}
Expand-Archive -LiteralPath (Join-Path $toolRoot 'gitleaks.zip') -DestinationPath (Join-Path $toolRoot 'gitleaks') -Force
if ((Get-FileHash (Join-Path $toolRoot 'gitleaks/gitleaks.exe')).Hash.ToLowerInvariant() -ne $pins.gitleaks.binarySha256) { throw 'Extracted scanner checksum mismatch' }
Write-Output 'Pinned P10 scanners verified and installed in workspace cache.'
