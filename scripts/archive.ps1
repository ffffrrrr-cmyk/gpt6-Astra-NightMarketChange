$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$deliveryRoot = Join-Path $projectRoot 'Delivery'
$sourceEntries = @('src', 'scripts', 'tests', 'Documentation', 'Provenance', 'Validation', 'ThirdPartyNotices', '.playwright', '.gitignore', '.npmrc', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'PLAYTEST.md', 'RIGHTS.md', 'Launch.cmd', 'Build.ps1')
$sourcePaths = @($sourceEntries | ForEach-Object { Join-Path $projectRoot $_ })
$sourcePaths += @(Get-ChildItem -LiteralPath $projectRoot -File -Filter '0003_*.md' | ForEach-Object { $_.FullName })
Compress-Archive -LiteralPath $sourcePaths -DestinationPath (Join-Path $deliveryRoot 'FR-0003-Source.zip') -Force
$offlinePaths = @('dist', 'Launch.cmd', 'README.md', 'PLAYTEST.md', 'RIGHTS.md') | ForEach-Object { Join-Path $projectRoot $_ }
Compress-Archive -LiteralPath $offlinePaths -DestinationPath (Join-Path $deliveryRoot 'FR-0003-Offline.zip') -Force
Write-Output 'Source and offline archives created within this project.'
