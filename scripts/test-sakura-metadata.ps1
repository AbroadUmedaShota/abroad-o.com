$ErrorActionPreference = "Stop"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "Assertion failed: $Message" }
}

function Assert-Throws {
    param([scriptblock]$Action, [string]$Message)
    $threw = $false
    try { & $Action } catch { $threw = $true }
    Assert-True $threw $Message
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deployScriptPath = Join-Path $PSScriptRoot "deploy-sakura.ps1"
$workflowPath = Join-Path $repoRoot ".github/workflows/deploy-sakura.yml"
$helperPath = Join-Path $PSScriptRoot "lib/sakura-remote-metadata.sh"
$deployScript = Get-Content -LiteralPath $deployScriptPath -Raw
$workflow = Get-Content -LiteralPath $workflowPath -Raw
$helper = Get-Content -LiteralPath $helperPath -Raw

Assert-True ($deployScript.Contains('"Metadata"')) "deployment script exposes the fixed Metadata mode"
Assert-True ($workflow.Contains('- "metadata"')) "workflow exposes the fixed metadata choice"
Assert-True ($workflow.Contains("inputs.mode == 'metadata'")) "workflow applies explicit metadata routing"
Assert-True (([regex]::Matches($workflow, '(?m)^      - name: Read Sakura deployment metadata\r?$')).Count -eq 1) "workflow has exactly one fixed metadata step on LF or CRLF checkouts"
Assert-True ([regex]::IsMatch($workflow, '(?ms)- name: Setup Node\.js\r?\n\s+if: \$\{\{ inputs\.mode != ''metadata'' \}\}')) "metadata independently skips Node setup"
Assert-True ([regex]::IsMatch($workflow, '(?ms)- name: Install site dependencies\r?\n\s+if: \$\{\{ inputs\.mode != ''metadata'' \}\}')) "metadata independently skips npm dependency installation"
Assert-True (-not $workflow.Contains('metadata_command')) "workflow exposes no arbitrary metadata command input"
Assert-True (-not $workflow.Contains('metadata_path')) "workflow exposes no arbitrary metadata path input"
$workflowCrLf = (($workflow -replace "`r`n", "`n") -replace "`n", "`r`n")
Assert-True (([regex]::Matches($workflowCrLf, '(?m)^      - name: Read Sakura deployment metadata\r?$')).Count -eq 1) "metadata workflow assertion accepts an explicit CRLF fixture"

$gateCall = $deployScript.LastIndexOf('Assert-SakuraDeploySourceGate -RepoRoot $repoRoot -SelectedSha $SelectedSha', [StringComparison]::Ordinal)
$metadataCall = $deployScript.LastIndexOf('Invoke-SakuraRemoteMetadata -Config $config -RemoteDirectory $remoteDirValue', [StringComparison]::Ordinal)
$packageCall = $deployScript.LastIndexOf('$package = New-DeployPackage', [StringComparison]::Ordinal)
Assert-True ($gateCall -ge 0 -and $metadataCall -gt $gateCall) "script source gate precedes metadata SSH work"
Assert-True ($metadataCall -lt $packageCall) "metadata exits before build and package creation"
$parseTokens = $null
$parseErrors = $null
$deployAst = [Management.Automation.Language.Parser]::ParseInput($deployScript, [ref]$parseTokens, [ref]$parseErrors)
Assert-True ($parseErrors.Count -eq 0) "deployment script parses before AST boundary checks"
$metadataDispatch = @($deployAst.FindAll({
    param($node)
    $node -is [Management.Automation.Language.IfStatementAst] -and
        $node.Clauses.Count -eq 1 -and
        $node.Clauses[0].Item1.Extent.Text -eq '$Mode -eq "Metadata"' -and
        $node.Extent.StartOffset -lt $packageCall
}, $true))[-1]
Assert-True ($null -ne $metadataDispatch) "metadata dispatch block exists before package creation"
$metadataBody = $metadataDispatch.Clauses[0].Item2.Extent.Text
function Test-MetadataBodyHasTerminalExit {
    param([string]$Body)
    return [regex]::IsMatch($Body, '(?ms)Invoke-SakuraRemoteMetadata.*?exit 0\s*\}$')
}
Assert-True (Test-MetadataBodyHasTerminalExit $metadataBody) "successful metadata exits at the end of its AST-bounded dispatch body"
$metadataBodyWithoutExit = $metadataBody -replace '(?m)^\s*exit 0\s*$', ''
Assert-True (-not (Test-MetadataBodyHasTerminalExit $metadataBodyWithoutExit)) "missing metadata exit mutation is rejected"
Assert-True ($metadataBody -notmatch 'New-DeployPackage|Invoke-SakuraDeploy|Invoke-SakuraStage|Invoke-SakuraPromote') "AST-bounded metadata dispatch cannot reach package or deployment calls"
Assert-True ($metadataBody.Contains('throw "Metadata does not accept FileZilla connection input."')) "metadata rejects FileZilla input before connection lookup"
Assert-True ($metadataDispatch.Extent.StartOffset -lt $deployScript.LastIndexOf('Set-ConnectionFromFileZilla', $packageCall, [StringComparison]::Ordinal)) "metadata dispatch precedes FileZilla connection setup"
Assert-True ($deployScript.Contains('if ($Mode -in @("Metadata", "Preflight", "Stage", "Promote", "Deploy"))')) "metadata uses the same script source gate as deployment"
Assert-True ($deployScript.Contains("`$deletePaths[0] -ne 'pdfjs/LICENSE'")) "metadata exact retired path is fixed"
Assert-True ($deployScript.Contains("`$expectedPrefixes = @('TOOL/', 'pdfjs/build/', 'pdfjs/web/')")) "metadata retired prefixes are fixed"
Assert-True (([regex]::Matches($deployScript, 'Invoke-SakuraMetadataTransport -Script \$script')).Count -eq 1) "metadata uses exactly one captured transport call"
$helperWriteScan = $helper -replace '>/dev/null\s+2>&1', '' -replace '2>/dev/null', '' -replace '<\s*"\$[^\"]+"', ''
Assert-True (-not [regex]::IsMatch($helperWriteScan, '(?m)^\s*(mktemp|rm|rmdir|mv|cp|mkdir|touch|chmod|chown|install|ln)\b')) "remote metadata helper contains no filesystem mutation command"
Assert-True (-not $helperWriteScan.Contains('>')) "remote metadata helper contains no output redirection after allowed stderr suppression and input reads are removed"
Assert-True (-not $helper.Contains('-printf')) "remote metadata helper does not assume GNU find -printf"
function Test-HelperPayloadOpenRisk {
    param([string]$Text)
    return [regex]::IsMatch($Text, '(?m)(\b(?:wc|cat|cksum|sha256sum|shasum)\b[^\r\n]*\$(?:candidate|target|item)|<\s*"\$(?:candidate|target|item)")')
}
Assert-True (-not (Test-HelperPayloadOpenRisk $helper)) "production metadata helper never opens archive or retired payloads to obtain sizes"
$payloadReadMutation = $helper + "`nsize=`$(wc -c < `"`$target`")`n"
Assert-True (Test-HelperPayloadOpenRisk $payloadReadMutation) "payload-open guard detects a wc input-redirection regression"
Assert-True ($helper.Contains("stat -f '%z'")) "metadata sizes support the BSD stat dialect"
Assert-True ($helper.Contains("stat -c '%s'")) "metadata sizes support the GNU stat dialect"

$validator = [regex]::Match($deployScript, '(?ms)^function Assert-SakuraMetadataOutput \{.*?^\}')
Assert-True $validator.Success "bounded metadata output validator can be exercised independently"
Invoke-Expression $validator.Value
$validOutput = @(
    'METADATA schema=1',
    'PUBLIC_ROOT state=directory symlink=false realpath=true',
    'BACKUP_DIRECTORY state=directory symlink=false realpath=true',
    'DEPLOY_LOCK exists=false symlink=false ready=true',
    'LATEST_ARCHIVE present=true basename=abroad-o-before-20260910-000000.sra.tgz bytes=123',
    'RETIRED id=pdfjs_license exists=false type=absent files=0 bytes=0',
    'RETIRED id=tool exists=false type=absent files=0 bytes=0',
    'RETIRED id=pdfjs_build exists=false type=absent files=0 bytes=0',
    'RETIRED id=pdfjs_web exists=false type=absent files=0 bytes=0',
    'READY value=true'
)
$accepted = @(Assert-SakuraMetadataOutput -Lines $validOutput)
Assert-True ($accepted.Count -eq 10) "valid fixed metadata output is accepted"
Assert-Throws { Assert-SakuraMetadataOutput -Lines @($validOutput + 'SECRET value=unexpected') } "extra output is rejected before logging"
$invalidArchive = @($validOutput)
$invalidArchive[4] = 'LATEST_ARCHIVE present=true basename=customer name.sra.tgz bytes=123'
Assert-Throws { Assert-SakuraMetadataOutput -Lines $invalidArchive } "unsafe archive basename is rejected before logging"
$customerArchive = @($validOutput)
$customerArchive[4] = 'LATEST_ARCHIVE present=true basename=abroad-o-before-ExampleCustomer.sra.tgz bytes=123'
Assert-Throws { Assert-SakuraMetadataOutput -Lines $customerArchive } "non-timestamp archive basename is rejected before logging"
$inconsistentReady = @($validOutput)
$inconsistentReady[5] = 'RETIRED id=pdfjs_license exists=true type=file files=1 bytes=1'
Assert-Throws { Assert-SakuraMetadataOutput -Lines $inconsistentReady } "inconsistent ready status is rejected before logging"

$capturedProcess = [regex]::Match($deployScript, '(?ms)^function Invoke-SakuraCapturedProcess \{.*?^\}')
$metadataTransport = [regex]::Match($deployScript, '(?ms)^function Invoke-SakuraMetadataTransport \{.*?^\}')
Assert-True ($capturedProcess.Success -and $metadataTransport.Success) "captured metadata transport can be exercised independently"
Invoke-Expression $capturedProcess.Value
Invoke-Expression $metadataTransport.Value
$savedLocalExecute = $env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE
$savedMarker = $env:SAKURA_LOCAL_REMOTE_SCRIPT_MARKER
$transportMarker = [IO.Path]::GetTempFileName()
try {
    $env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE = '1'
    $env:SAKURA_LOCAL_REMOTE_SCRIPT_MARKER = $transportMarker
    [IO.File]::WriteAllText($transportMarker, '', [Text.UTF8Encoding]::new($false))
    $transportScript = "printf '%s\n' " + (($validOutput | ForEach-Object { "'$_'" }) -join ' ')
    $transportOutput = @(Invoke-SakuraMetadataTransport -Script $transportScript)
    Assert-True ($transportOutput.Count -eq 10) "captured metadata transport returns only the expected stdout records"
    Assert-True ((Get-Content -LiteralPath $transportMarker).Count -eq 1 -and (Get-Content -LiteralPath $transportMarker -Raw).Trim() -eq 'invoke-metadata') "one metadata call crosses the local fake SSH boundary exactly once"
    [IO.File]::WriteAllText($transportMarker, '', [Text.UTF8Encoding]::new($false))
    $observable = & {
        try {
            Invoke-SakuraMetadataTransport -Script "printf 'partial output\n'; printf 'TOP_SECRET_STDERR\n' >&2; exit 9"
        } catch {
            Write-Output "CAUGHT:$($_.Exception.Message)"
        }
    } *>&1 | Out-String
    Assert-True ($observable.Trim() -eq 'CAUGHT:Remote metadata command failed.') "partial stdout and stderr are replaced with one fixed transport error across all streams"
    Assert-True ($observable -notmatch 'TOP_SECRET|partial output') "observable transport output does not leak child output"
    Assert-True ((Get-Content -LiteralPath $transportMarker).Count -eq 1) "failed metadata call does not retry the transport"
} finally {
    $env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE = $savedLocalExecute
    $env:SAKURA_LOCAL_REMOTE_SCRIPT_MARKER = $savedMarker
    Remove-Item -LiteralPath $transportMarker -Force -ErrorAction SilentlyContinue
}

$harnessFunction = [regex]::Match($deployScript, '(?ms)^function Test-SakuraMetadataLocalHarness \{.*?^\}')
$invocationContract = [regex]::Match($deployScript, '(?ms)^function Assert-SakuraMetadataInvocationContract \{.*?^\}')
Assert-True ($harnessFunction.Success -and $invocationContract.Success) "fixed invocation contract can be exercised independently"
Invoke-Expression $harnessFunction.Value
Invoke-Expression $invocationContract.Value
$canonicalConfig = Join-Path $repoRoot 'deploy/sakura-public-files.json'
$expectedKeyExpression = '[IO.Path]::GetFullPath((Join-Path $HOME ".ssh/sakura_deploy_key"))'
Assert-True ($deployScript.Contains($expectedKeyExpression)) "metadata pins the normalized workflow SSH key path"
Assert-True ($deployScript.Contains('[StringComparison]::Ordinal')) "metadata key comparison preserves Linux case sensitivity"
Assert-True ($deployScript.Contains('$script:SshKeyPath = $expectedSshKeyPath')) "SSH receives the validated normalized key path"
& {
    function Test-Path { return $true }
    Invoke-Expression $harnessFunction.Value
    Invoke-Expression $invocationContract.Value
    $HostName = 'abroad-o.sakura.ne.jp'
    $UserName = 'abroad-o'
    $Port = 22
    $SshKeyPath = [IO.Path]::GetFullPath((Join-Path $HOME '.ssh/sakura_deploy_key'))
    Assert-SakuraMetadataInvocationContract -RepoRoot $repoRoot -ConfigFullPath $canonicalConfig -RemoteDirectory '/home/abroad-o/www/abroad-o.com'
    $SshKeyPath = [IO.Path]::GetFullPath((Join-Path $HOME '.ssh/SAKURA_DEPLOY_KEY'))
    Assert-Throws { Assert-SakuraMetadataInvocationContract -RepoRoot $repoRoot -ConfigFullPath $canonicalConfig -RemoteDirectory '/home/abroad-o/www/abroad-o.com' } "case-variant SSH key path is rejected even when the file exists"
    $SshKeyPath = $deployScriptPath
    Assert-Throws { Assert-SakuraMetadataInvocationContract -RepoRoot $repoRoot -ConfigFullPath $canonicalConfig -RemoteDirectory '/home/abroad-o/www/abroad-o.com' } "an existing alternate SSH key path is rejected outside the local harness"
    Assert-Throws { Assert-SakuraMetadataInvocationContract -RepoRoot $repoRoot -ConfigFullPath $deployScriptPath -RemoteDirectory '/home/abroad-o/www/abroad-o.com' } "alternate metadata config is rejected outside the local harness"
    $SshKeyPath = [IO.Path]::GetFullPath((Join-Path $HOME '.ssh/sakura_deploy_key'))
    $HostName = 'abroad-o.sakura.ne.jp;echo injected'
    Assert-Throws { Assert-SakuraMetadataInvocationContract -RepoRoot $repoRoot -ConfigFullPath $canonicalConfig -RemoteDirectory '/home/abroad-o/www/abroad-o.com' } "alternate or injected metadata host is rejected"
}

$entryOutput = & pwsh -NoProfile -File $deployScriptPath -Mode Metadata 2>&1 | Out-String
Assert-True ($LASTEXITCODE -ne 0) "metadata without an exact SHA is rejected"
Assert-True ($entryOutput -match 'SelectedSha or SAKURA_SELECTED_SHA must be a full 40-character Git SHA') "metadata rejection comes from the trusted source gate"
Assert-True ($entryOutput -notmatch 'METADATA schema=|Package:|Stage completed:|Promote completed:') "metadata source-gate rejection performs no deployment work"

Write-Host "Sakura metadata mode contract passed."
