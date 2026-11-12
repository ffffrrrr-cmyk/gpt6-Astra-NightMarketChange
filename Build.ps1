$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    foreach ($task in @('typecheck', 'test', 'validate', 'build')) {
        & npm run $task
        if ($LASTEXITCODE -ne 0) { throw "Build step failed: $task" }
    }
} finally { Pop-Location }
