param([int]$Minutes = 15)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:PWTEST_DAEMON_SESSION_DIR = Join-Path $projectRoot 'output\playwright\.cache'
$cli = Join-Path $projectRoot 'node_modules\@playwright\cli\playwright-cli.js'
$resultPath = Join-Path $projectRoot 'Validation\performance-samples.jsonl'
$watch = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location -LiteralPath $projectRoot
try {
    for ($sample = 0; $sample -le $Minutes; $sample++) {
        while ($watch.Elapsed.TotalSeconds -lt ($sample * 60)) { Start-Sleep -Seconds 1 }
        $result = & node $cli '-s=night-market-perf-0003' '--raw' run-code '--filename=scripts/qa-performance.js' 2>&1
        if ($LASTEXITCODE -ne 0 -or ($result -join "`n") -match '### Error') { throw ($result -join "`n") }
        $data = ($result -join "`n") | ConvertFrom-Json
        if ($data.diagnostics.levelId -ne 'night-12' -or $data.diagnostics.page -ne 'game' -or $null -ne $data.diagnostics.modal -or $data.diagnostics.documentHidden) { throw '性能采样场景不正确或已暂停' }
        $result | Add-Content -LiteralPath $resultPath -Encoding utf8
        Write-Output "Performance sample $sample / $Minutes captured at $([math]::Round($watch.Elapsed.TotalSeconds)) seconds."
    }
} finally { Pop-Location }
