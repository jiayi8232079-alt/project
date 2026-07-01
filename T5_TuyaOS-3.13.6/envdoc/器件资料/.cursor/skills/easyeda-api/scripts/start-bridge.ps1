# Start EasyEDA WebSocket Bridge (background). Port range 49620-49629.
function Test-BridgePort {
    foreach ($port in 49620..49629) {
        try {
            $r = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 1 -ErrorAction Stop
            if ($r.service -eq "easyeda-bridge") { return $port }
        } catch { }
    }
    return $null
}

$SkillDir = if ($env:CLAUDE_SKILL_DIR) { $env:CLAUDE_SKILL_DIR } else { Split-Path $PSScriptRoot -Parent }
$server = Join-Path $SkillDir "scripts\bridge-server.mjs"

$existing = Test-BridgePort
if ($existing) {
    Write-Host "Bridge already running on port $existing"
    exit 0
}

Write-Host "Starting EasyEDA bridge from: $SkillDir"
Start-Process -FilePath "node" -ArgumentList "`"$server`"" -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(15)
do {
    Start-Sleep -Seconds 1
    $found = Test-BridgePort
    if ($found) {
        Write-Host "Bridge started on port $found"
        exit 0
    }
} while ((Get-Date) -lt $deadline)

Write-Host "Bridge did not respond within 15s. Check: Invoke-RestMethod http://localhost:49620/health"
exit 1
