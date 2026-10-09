param([string]$Nombre = 'Reto2_Olmedo_Elkin.zip')
$ErrorActionPreference = 'Stop'
if ($Nombre -notmatch '^Reto2_[A-Za-z0-9_-]+\.zip$') { throw 'Usa un nombre Reto2_Apellido_Nombre.zip.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot 'entrega'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$archivePath = Join-Path $outputDir $Nombre
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$entries = @('frontend', 'server', 'assets', 'js', 'data', 'scripts', 'tests', 'docs', 'index.html', 'catalogo.html', 'producto.html', 'comparar.html', 'cuenta.html', 'checkout.html', 'pedidos.html', 'ayuda.html', 'service-worker.js', 'robots.txt', 'package.json', 'package-lock.json', '.env.example', '.gitignore', 'README.md')
$files = foreach ($entry in $entries) {
  $entryPath = Join-Path $projectRoot $entry
  if (Test-Path -LiteralPath $entryPath -PathType Container) { Get-ChildItem -LiteralPath $entryPath -File -Recurse -Force }
  else { Get-Item -LiteralPath $entryPath -Force }
}
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    if (-not $file.FullName.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Archivo fuera del proyecto.' }
    $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
    if ($relative -match '^(server/backups|frontend/assets/uploads)(/|$)') { continue }
    if ($relative -match '(^|/)(test-results|playwright-report)(/|$)') { continue }
    if ($relative -match '(^|/)(\.env($|\.)|node_modules|certificates)(/|$)' -and $relative -ne '.env.example') { continue }
    if ($relative -match '\.(db|db-journal|db-wal|db-shm|key|pem|log)$') { continue }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Output "Entrega creada: $archivePath"
