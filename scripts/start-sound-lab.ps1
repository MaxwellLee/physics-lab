param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$labUrl = 'http://127.0.0.1:8766/experiments/sound-lab/'
function Test-LabReady {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $labUrl -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content.Contains('id="record-dialog"')
    } catch { return $false }
}
try {
    if (-not (Test-LabReady)) {
        $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
        $env:HOST = '127.0.0.1'
        $env:PORT = '8766'
        Start-Process -FilePath $nodePath -ArgumentList 'scripts/serve.mjs','8766' -WorkingDirectory $labRoot -WindowStyle Hidden
        $ready = $false
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            if (Test-LabReady) { $ready = $true; break }
            Start-Sleep -Milliseconds 250
        }
        if (-not $ready) { throw 'Unable to start Physics Lab. Check whether another application is using port 8766.' }
    }
    Write-Output "Physics Lab ready: $labUrl"
    if (-not $NoBrowser) { Start-Process $labUrl }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
