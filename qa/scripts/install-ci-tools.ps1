$ErrorActionPreference = 'Stop'
$qaRoot = Split-Path $PSScriptRoot -Parent
$targetRoot = Join-Path $qaRoot '.cache/p11-tools'
New-Item -ItemType Directory -Force $targetRoot | Out-Null
$pin = (Get-Content (Join-Path $PSScriptRoot 'toolchain.json') -Raw | ConvertFrom-Json).actionlint
$archive = Join-Path $targetRoot 'actionlint.zip'
if (!(Test-Path $archive) -or (Get-FileHash $archive).Hash.ToLowerInvariant() -ne $pin.sha256) {
    Invoke-WebRequest $pin.url -OutFile $archive -TimeoutSec 180
}
if ((Get-FileHash $archive).Hash.ToLowerInvariant() -ne $pin.sha256) { throw 'Actionlint archive checksum mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $targetRoot 'actionlint') -Force
if ((Get-FileHash (Join-Path $targetRoot 'actionlint/actionlint.exe')).Hash.ToLowerInvariant() -ne $pin.binarySha256) { throw 'Actionlint binary checksum mismatch' }
Write-Output 'Pinned actionlint verified in workspace cache.'
