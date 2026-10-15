param([int]$Port = 8768, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$previewRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$previewUrl = "http://127.0.0.1:$Port/"
$previewResponds = $false
try {
    $previewResponse = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
    $previewResponds = $previewResponse.Content -match 'demo.js'
} catch { $previewResponds = $false }
if (-not $previewResponds) {
    $previewListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($previewListener) { throw "El puerto $Port ya está ocupado. Ejecuta este archivo con -Port 8769 para usar otro puerto." }
    $previewPython = Get-Command py -ErrorAction SilentlyContinue
    if (-not $previewPython) { throw 'Se necesita Python 3. Instálalo y vuelve a ejecutar este archivo.' }
    $previewArgs = @('-3.12', '-m', 'http.server', "$Port", '--bind', '127.0.0.1', '--directory', ('"' + $previewRoot + '"'))
    $previewProcess = Start-Process -FilePath $previewPython.Source -ArgumentList $previewArgs -WindowStyle Hidden -PassThru -WorkingDirectory $previewRoot -RedirectStandardOutput (Join-Path $previewRoot 'servidor-local.log') -RedirectStandardError (Join-Path $previewRoot 'servidor-local-error.log')
    $previewProcess.Id | Set-Content -LiteralPath (Join-Path $previewRoot 'servidor-local.pid')
    for ($previewAttempt = 0; $previewAttempt -lt 20; $previewAttempt++) {
        Start-Sleep -Milliseconds 200
        try { $null = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2; $previewResponds = $true; break } catch { }
    }
    if (-not $previewResponds) { throw 'No se pudo iniciar la vista previa. Revisa servidor-local-error.log.' }
}
if (-not $NoBrowser) { Start-Process $previewUrl }
Write-Output "Vista previa: $previewUrl"
