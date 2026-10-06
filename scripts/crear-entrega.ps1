param(
    [ValidatePattern('^Reto1_[A-Za-z0-9_-]+\.zip$')]
    [string]$Nombre = 'Reto1_Olmedo_Elkin.zip'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$deliveryDirectory = Join-Path $projectRoot 'entrega'
$archivePath = Join-Path $deliveryDirectory $Nombre
$projectEntries = @(
    'index.html', 'catalogo.html', 'README.md',
    'assets', 'data', 'js', 'docs', 'scripts', 'tests',
    'robots.txt', 'service-worker.js'
)
$archiveEntries = foreach ($entry in $projectEntries) {
    $entryPath = Join-Path $projectRoot $entry
    if (-not (Test-Path -LiteralPath $entryPath)) {
        throw "Falta un archivo o carpeta de la entrega: $entry"
    }
    $entryPath
}

New-Item -ItemType Directory -Path $deliveryDirectory -Force | Out-Null
Compress-Archive -LiteralPath $archiveEntries -DestinationPath $archivePath -Force
Write-Output "Entrega creada: $archivePath"
