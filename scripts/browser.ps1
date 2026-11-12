param([Parameter(ValueFromRemainingArguments = $true)][string[]]$BrowserArguments)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:PWTEST_DAEMON_SESSION_DIR = Join-Path $projectRoot 'output\playwright\.cache'
Push-Location -LiteralPath $projectRoot
try {
    & node (Join-Path $projectRoot 'node_modules\@playwright\cli\playwright-cli.js') '-s=night-market-0003' @BrowserArguments
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
