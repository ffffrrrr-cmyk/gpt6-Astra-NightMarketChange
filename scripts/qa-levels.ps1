param([int]$Width = 1280, [int]$Height = 720)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$reports = (Get-Content -LiteralPath (Join-Path $projectRoot 'Validation\level-solutions.json') -Raw | ConvertFrom-Json).reports
$template = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'qa-level.js') -Raw
$env:PWTEST_DAEMON_SESSION_DIR = Join-Path $projectRoot 'output\playwright\.cache'
$cli = Join-Path $projectRoot 'node_modules\@playwright\cli\playwright-cli.js'
Push-Location -LiteralPath $projectRoot
try {
    & node $cli '-s=night-market-0003' resize $Width $Height
    foreach ($report in $reports) {
        $fixture = @{ levelId = $report.levelId; efficient = $report.efficient } | ConvertTo-Json -Depth 12 -Compress
        $code = $template.Replace('__LEVEL_REPORT__', $fixture)
        $result = & node $cli '-s=night-market-0003' '--raw' run-code $code 2>&1
        $result | Tee-Object -FilePath (Join-Path $projectRoot "Validation\browser-levels-$Width.txt") -Append
        if ($LASTEXITCODE -ne 0 -or ($result -join "`n") -match '### Error') { throw "关卡浏览器验证失败：$($report.levelId)" }
    }
} finally { Pop-Location }
