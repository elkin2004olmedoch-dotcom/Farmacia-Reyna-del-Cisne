param([string]$Nombre = 'Reto2_Farmacia.zip')
$ErrorActionPreference = 'Stop'
if ($Nombre -notmatch '^Reto2_[A-Za-z0-9_-]+\.zip$') { throw 'Usa un nombre Reto2_Apellido_Nombre.zip.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot 'entrega'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
if (((Get-Item -LiteralPath $outputDir -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'La carpeta de entrega no puede ser un enlace.' }
$archivePath = Join-Path $outputDir $Nombre
if (Test-Path -LiteralPath $archivePath) {
  $existing = Get-Item -LiteralPath $archivePath -Force
  if ($existing.PSIsContainer -or ($existing.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'El destino ZIP debe ser un archivo regular.' }
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$entries = @('frontend', 'server', 'mobile', '.github', 'assets', 'js', 'data', 'scripts', 'tests', 'docs', 'index.html', 'catalogo.html', 'producto.html', 'comparar.html', 'cuenta.html', 'checkout.html', 'pedidos.html', 'ayuda.html', 'service-worker.js', 'robots.txt', 'render.yaml', 'package.json', 'package-lock.json', '.env.example', '.gitignore', 'README.md')
$files = foreach ($entry in $entries) {
  $entryPath = Join-Path $projectRoot $entry
  if (Test-Path -LiteralPath $entryPath -PathType Container) { Get-ChildItem -LiteralPath $entryPath -File -Recurse -Force }
  else { Get-Item -LiteralPath $entryPath -Force }
}
$temporaryPath = Join-Path $outputDir ($Nombre + '.tmp-' + [guid]::NewGuid().ToString())
$stream = [System.IO.File]::Open($temporaryPath, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    if (-not $file.FullName.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Archivo fuera del proyecto.' }
    $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
    if ($relative -match '^(server/backups|frontend/assets/uploads)(/|$)') { continue }
    if ($relative -match '^docs/(pruebas|auditorias|agentes|superpowers)(/|$)') { continue }
    if ($relative -match '(^|/)(test-results|TestResults|playwright-report)(/|$)') { continue }
    if ($relative -match '(^|/)(build|\.gradle|\.idea|Pods|DerivedData|xcuserdata)(/|$)') { continue }
    if ($relative -match '^mobile/(www/|android/local\.properties$|android/app/src/main/assets/|ios/App/App/public/|ios/App/App/capacitor\.config\.json$)') { continue }
    if ($file.Name -in @('key.properties', 'keystore.properties')) { continue }
    if ($relative -match '(^|/)(bin|obj|\.vs)(/|$)' -or $relative -match '(^|/)appsettings\.(Production|Development|Local)\.json$') { continue }
    if ($relative -match '(^|/)(\.git|\.publish|node_modules|certificates)(/|$)') { continue }
    if ($file.Name -match '^\.env($|\.)' -and $relative -ne '.env.example') { continue }
    if ($relative -match '\.(env|db|db-journal|db-wal|db-shm|key|pem|p12|pfx|p8|keystore|jks|mobileprovision|log)$') { continue }
    $ancestor = $file.FullName
    $linked = $false
    while ($ancestor -ne $projectRoot) {
      if (([System.IO.File]::GetAttributes($ancestor) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { $linked = $true; break }
      $ancestor = Split-Path -Parent $ancestor
    }
    if ($linked) { continue }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} catch {
  $archive.Dispose(); $stream.Dispose()
  Remove-Item -LiteralPath $temporaryPath -Force
  throw
} finally { $archive.Dispose(); $stream.Dispose() }
Move-Item -LiteralPath $temporaryPath -Destination $archivePath -Force
Write-Output "Entrega creada: $archivePath"
