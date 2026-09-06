$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deployScript = Join-Path $PSScriptRoot "deploy-sakura.ps1"
$scriptText = Get-Content -LiteralPath $deployScript -Raw
$gateCall = $scriptText.LastIndexOf('Assert-SakuraDeploySourceGate -RepoRoot $repoRoot -SelectedSha $SelectedSha', [StringComparison]::Ordinal)
$sshBoundary = $scriptText.LastIndexOf('$target = Get-SshTarget', [StringComparison]::Ordinal)
if ($gateCall -lt 0 -or $sshBoundary -lt 0 -or $gateCall -gt $sshBoundary) {
    throw "The shared source gate must execute before the first SSH target is resolved."
}

function Assert-RejectedBeforeRemote {
    param([string[]]$Arguments, [string]$ExpectedMessage)

    $output = & pwsh -NoProfile -File $deployScript @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        throw "Deployment entry unexpectedly accepted: $($Arguments -join ' ')"
    }
    if ($output -notmatch [regex]::Escape($ExpectedMessage)) {
        throw "Expected rejection was not observed. Output: $output"
    }
    if ($output -match 'Package:|Preflight passed:|Stage completed:|Promote completed:') {
        throw "Deployment work started before the source gate rejected the request."
    }
}

Assert-RejectedBeforeRemote -Arguments @('-Mode', 'Preflight') -ExpectedMessage 'SelectedSha or SAKURA_SELECTED_SHA must be a full 40-character Git SHA'
Assert-RejectedBeforeRemote -Arguments @('-Mode', 'Deploy', '-SelectedSha', ('0' * 40)) -ExpectedMessage 'SelectedSha must exactly match the deployment worktree HEAD'
$savedValidation = $env:SAKURA_VALIDATE_REMOTE_SCRIPT
try {
    $env:SAKURA_VALIDATE_REMOTE_SCRIPT = '1'
    $headSha = (& git -C $repoRoot rev-parse HEAD)
    Assert-RejectedBeforeRemote -Arguments @('-Mode', 'Deploy', '-SelectedSha', $headSha) -ExpectedMessage 'The non-remote test harness cannot authorize Stage or Deploy'
} finally {
    $env:SAKURA_VALIDATE_REMOTE_SCRIPT = $savedValidation
}

Write-Host "Sakura deployment entry gate ordering passed."
