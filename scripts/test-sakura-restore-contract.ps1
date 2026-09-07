[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$modulePath = Join-Path $PSScriptRoot "lib/sakura-restore-contract.psm1"
Import-Module $modulePath -Force

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "Assertion failed: $Message" }
}

function Assert-Throws {
    param([scriptblock]$Action, [string]$Message)
    try {
        & $Action
    }
    catch {
        return
    }
    throw "Expected failure: $Message"
}

function Get-TestHash {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("abroad-o-restore-contract-" + [Guid]::NewGuid().ToString("N"))
$previous = Join-Path $testRoot "previous"
$published = Join-Path $testRoot "published"
$archive = Join-Path $testRoot "backup.sra.tgz"
$verified = $null
$deploymentPathManifestSha256 = ("a" * 64)
$deploymentEvidenceSha256 = ("c" * 64)

try {
    New-Item -ItemType Directory -Path $previous, $published -Force | Out-Null
    foreach ($root in @($previous, $published)) {
        New-Item -ItemType Directory -Path (Join-Path $root "css"), (Join-Path $root "pdfjs"), (Join-Path $root "TOOL"), (Join-Path $root "pdfjs/build"), (Join-Path $root "pdfjs/web") -Force | Out-Null
    }

    [IO.File]::WriteAllText((Join-Path $previous "index.html"), "before")
    [IO.File]::WriteAllText((Join-Path $previous "css/old.css"), "old")
    [IO.File]::WriteAllText((Join-Path $previous "TOOL/index.html"), "legacy-tool")
    [IO.File]::WriteAllText((Join-Path $previous "pdfjs/build/pdf.js"), "legacy-build")
    [IO.File]::WriteAllText((Join-Path $previous "pdfjs/web/viewer.html"), "legacy-viewer")
    [IO.File]::WriteAllText((Join-Path $previous "pdfjs/LICENSE"), "legacy-license")
    foreach ($pdf in @("1c_abroad.pdf", "2c_abroad.pdf", "4c_abroad.pdf")) {
        [IO.File]::WriteAllText((Join-Path $previous "pdfjs/$pdf"), "previous-$pdf")
    }

    $protectedPaths = foreach ($pdf in @("1c_abroad.pdf", "2c_abroad.pdf", "4c_abroad.pdf")) {
        $path = Join-Path $previous "pdfjs/$pdf"
        [pscustomobject]@{ path = "pdfjs/$pdf"; bytes = (Get-Item -LiteralPath $path).Length; sha256 = Get-TestHash $path }
    }
    $config = [pscustomobject]@{
        managedRootFiles = @("index.html", "new-only.html")
        managedDirectories = @("css", "pdfjs")
        protectedPaths = @($protectedPaths)
        restoreContract = [pscustomobject]@{ version = 1; archiveRoot = "restore-contract-v1"; remotePublicRoot = "/fixed/public/root"; backupDirectory = "/fixed/backups" }
    }

    $currentManifest = @("index.html", "new-only.html", "css/new.css", "pdfjs/1c_abroad.pdf", "pdfjs/2c_abroad.pdf", "pdfjs/4c_abroad.pdf")
    $archiveInfo = New-SakuraSanitizedRestoreArchive -SourceDirectory $previous -ArchivePath $archive -Config $config -DeploymentPathManifestSha256 $deploymentPathManifestSha256 -DeploymentEvidenceSha256 $deploymentEvidenceSha256 -IncludePaths $currentManifest
    Assert-True (Test-Path -LiteralPath $archive) "sanitized archive is created"
    Assert-True ($archiveInfo.Paths -contains "index.html") "managed root file is archived"
    Assert-True (-not ($archiveInfo.Paths | Where-Object { $_ -like "TOOL/*" -or $_ -like "pdfjs/build/*" -or $_ -like "pdfjs/web/*" -or $_ -eq "pdfjs/LICENSE" })) "forbidden legacy paths are excluded"
    $verified = Test-SakuraSanitizedRestoreArchive -ArchivePath $archive -ExpectedArchiveSha256 $archiveInfo.ArchiveSha256 -ExpectedManifestSha256 $archiveInfo.ManifestSha256 -ExpectedDeploymentPathManifestSha256 $deploymentPathManifestSha256 -ExpectedDeploymentEvidenceSha256 $deploymentEvidenceSha256 -Config $config
    Assert-True ($verified.Paths.Count -eq 4) "only previous files referenced by the published manifest are included"

    [IO.File]::WriteAllText((Join-Path $published "index.html"), "after")
    [IO.File]::WriteAllText((Join-Path $published "new-only.html"), "new")
    [IO.File]::WriteAllText((Join-Path $published "css/new.css"), "new")
    [IO.File]::WriteAllText((Join-Path $published "unknown.txt"), "keep")
    foreach ($pdf in @("1c_abroad.pdf", "2c_abroad.pdf", "4c_abroad.pdf")) {
        [IO.File]::WriteAllText((Join-Path $published "pdfjs/$pdf"), "after-$pdf")
    }
    # Simulate Promote's explicit retirement allowlist before a restore is attempted.
    Remove-Item -LiteralPath (Join-Path $published "TOOL"), (Join-Path $published "pdfjs/build"), (Join-Path $published "pdfjs/web") -Recurse -Force

    $plan = Get-SakuraSanitizedRestorePlan -Archive $verified -CurrentManifestPaths $currentManifest -Config $config
    Assert-True ($plan.RestorePaths -contains "index.html") "previous managed file is restored"
    Assert-True ($plan.DeletePaths -contains "new-only.html") "new-only managed root is deleted"
    Assert-True ($plan.DeletePaths -contains "css/new.css") "new-only managed directory file is deleted"
    Assert-True (-not ($plan.DeletePaths | Where-Object { $_ -like "TOOL/*" -or $_ -like "pdfjs/build/*" -or $_ -like "pdfjs/web/*" -or $_ -eq "pdfjs/LICENSE" })) "forbidden paths are never restore delete targets"
    Invoke-SakuraSanitizedRestorePlan -Plan $plan -DestinationDirectory $published -ExpectedDestinationDirectory $published -Apply

    Assert-True ([IO.File]::ReadAllText((Join-Path $published "index.html")) -eq "before") "previous file content is restored"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $published "css/old.css"))) "unpublished previous-only managed file is not introduced"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $published "new-only.html"))) "new-only managed root is removed"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $published "css/new.css"))) "new-only managed directory file is removed"
    Assert-True ([IO.File]::ReadAllText((Join-Path $published "unknown.txt")) -eq "keep") "unknown file remains unchanged"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $published "TOOL"))) "TOOL remains retired after restore"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $published "pdfjs/build"))) "PDF.js build remains retired after restore"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $published "pdfjs/web"))) "PDF.js viewer remains retired after restore"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $published "pdfjs/LICENSE"))) "PDF.js license remains retired after restore"
    foreach ($pdf in @("1c_abroad.pdf", "2c_abroad.pdf", "4c_abroad.pdf")) {
        Assert-True ([IO.File]::ReadAllText((Join-Path $published "pdfjs/$pdf")) -eq "previous-$pdf") "protected PDF $pdf is restored"
    }

    foreach ($unsafePath in @("/absolute.html", "../escape.html", "dir/../escape.html", "line`nfeed.html", "back\\slash.html")) {
        Assert-Throws { Assert-SakuraRestoreRelativePath -Path $unsafePath } "unsafe path $unsafePath is rejected"
    }
    Assert-Throws { Assert-SakuraRestoreArchiveEntry -Path "restore-contract-v1/payload/link" -Type "l" -ArchiveRoot "restore-contract-v1" } "symlink archive entry is rejected"
    Assert-Throws { Assert-SakuraRestoreArchiveEntry -Path "restore-contract-v1/payload/link" -Type "h" -ArchiveRoot "restore-contract-v1" } "hardlink archive entry is rejected"
    Assert-Throws { Test-SakuraSanitizedRestoreArchive -ArchivePath $archive -ExpectedArchiveSha256 ("0" * 64) -ExpectedManifestSha256 $archiveInfo.ManifestSha256 -ExpectedDeploymentPathManifestSha256 $deploymentPathManifestSha256 -ExpectedDeploymentEvidenceSha256 $deploymentEvidenceSha256 -Config $config } "archive hash mismatch is rejected"
    Assert-Throws { Test-SakuraSanitizedRestoreArchive -ArchivePath $archive -ExpectedArchiveSha256 $archiveInfo.ArchiveSha256 -ExpectedManifestSha256 ("0" * 64) -ExpectedDeploymentPathManifestSha256 $deploymentPathManifestSha256 -ExpectedDeploymentEvidenceSha256 $deploymentEvidenceSha256 -Config $config } "manifest hash mismatch is rejected"
    Assert-Throws { Test-SakuraSanitizedRestoreArchive -ArchivePath $archive -ExpectedArchiveSha256 $archiveInfo.ArchiveSha256 -ExpectedManifestSha256 $archiveInfo.ManifestSha256 -ExpectedDeploymentPathManifestSha256 ("b" * 64) -ExpectedDeploymentEvidenceSha256 $deploymentEvidenceSha256 -Config $config } "different deployment path manifest binding is rejected"
    Assert-Throws { Test-SakuraSanitizedRestoreArchive -ArchivePath $archive -ExpectedArchiveSha256 $archiveInfo.ArchiveSha256 -ExpectedManifestSha256 $archiveInfo.ManifestSha256 -ExpectedDeploymentPathManifestSha256 $deploymentPathManifestSha256 -ExpectedDeploymentEvidenceSha256 ("d" * 64) -Config $config } "different deployment evidence binding is rejected"
    Assert-Throws { Invoke-SakuraSanitizedRestorePlan -Plan $plan -DestinationDirectory $published -ExpectedDestinationDirectory (Join-Path $testRoot "other") -Apply } "unexpected restore destination is rejected"

    $deployScript = Join-Path $PSScriptRoot "deploy-sakura.ps1"
    $deployScriptText = Get-Content -LiteralPath $deployScript -Raw
    Assert-True (-not $deployScriptText.Contains("-printf")) "remote shell avoids GNU-only find -printf"
    Assert-True ($deployScriptText.Contains('Write-Host "Package SHA-256: $($package.PackageSha256)"')) "DryRun reports the RC package SHA-256"
    Assert-True ($deployScriptText.Contains('if ($env:SAKURA_VALIDATE_REMOTE_SCRIPT -ne "1" -and $env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE -ne "1")')) "only non-remote harnesses omit post-Promote verification"
    Assert-True (([regex]::Matches($deployScriptText, 'Assert-ExternalNetworkAllowed -Protocol "ssh"')).Count -eq 2) "both SSH execution boundaries are guarded"
    Assert-True (([regex]::Matches($deployScriptText, 'Assert-ExternalNetworkAllowed -Protocol "scp"')).Count -eq 1) "the SCP execution boundary is guarded"

    $savedShellValidation = $env:SAKURA_VALIDATE_REMOTE_SCRIPT
    $savedNetworkBlockMarker = $env:SAKURA_TEST_NETWORK_BLOCK_MARKER
    $networkBlockMarker = Join-Path $testRoot "network-attempts.log"
    try {
        $env:SAKURA_VALIDATE_REMOTE_SCRIPT = "1"
        $env:SAKURA_TEST_NETWORK_BLOCK_MARKER = $networkBlockMarker

        $networkGuardDefinition = [regex]::Match($deployScriptText, '(?ms)^function Assert-ExternalNetworkAllowed \{.*?^\}')
        Assert-True $networkGuardDefinition.Success "external network guard can be exercised independently"
        Invoke-Expression $networkGuardDefinition.Value
        foreach ($protocol in @("http", "ssh", "scp")) {
            Remove-Item -LiteralPath $networkBlockMarker -Force -ErrorAction SilentlyContinue
            $blockedMessage = $null
            try {
                Assert-ExternalNetworkAllowed -Protocol $protocol
            }
            catch {
                $blockedMessage = $_.Exception.Message
            }
            Assert-True ($blockedMessage -eq "External $protocol access is blocked by the test harness.") "$protocol is blocked before an external operation"
            Assert-True ((Get-Content -LiteralPath $networkBlockMarker -Raw).Trim() -eq $protocol) "$protocol attempt is recorded observably"
        }
        Remove-Item -LiteralPath $networkBlockMarker -Force

        $selectedSha = (& git -C $repoRoot rev-parse HEAD)
        & pwsh -NoProfile -File $deployScript -Mode Preflight -SelectedSha $selectedSha -HostName "syntax-only.invalid" -UserName "abroad-o" -RemoteDir "/home/abroad-o/www/abroad-o.com" -SshKeyPath "ignored"
        if ($LASTEXITCODE -ne 0) { throw "Generated Preflight shell syntax check failed." }
        Assert-True (-not (Test-Path -LiteralPath $networkBlockMarker)) "Preflight syntax validation makes no external network attempt"
        & pwsh -NoProfile -File $deployScript -Mode RestoreSafe -HostName "syntax-only.invalid" -UserName "abroad-o" -RemoteDir "/home/abroad-o/www/abroad-o.com" -SshKeyPath "ignored" -BackupFile "/home/abroad-o/abroad-o-backups/abroad-o-before-test.sra.tgz" -BackupArchiveSha256 ("a" * 64) -BackupManifestSha256 ("b" * 64)
        if ($LASTEXITCODE -ne 0) { throw "Generated RestoreSafe shell syntax check failed." }
        Assert-True (-not (Test-Path -LiteralPath $networkBlockMarker)) "RestoreSafe syntax validation makes no external network attempt"
        & pwsh -NoProfile -File $deployScript -Mode Promote -SelectedSha $selectedSha -HostName "syntax-only.invalid" -UserName "abroad-o" -RemoteDir "/home/abroad-o/www/abroad-o.com" -SshKeyPath "ignored" -StagedReleaseId "syntax-only-release"
        if ($LASTEXITCODE -ne 0) { throw "Generated Promote shell syntax check failed." }
        Assert-True (-not (Test-Path -LiteralPath $networkBlockMarker)) "Promote syntax validation makes no external network attempt"

        $env:SAKURA_VALIDATE_REMOTE_SCRIPT = $savedShellValidation
        $verifyOutput = @(& pwsh -NoProfile -File $deployScript -Mode Verify 2>&1)
        $verifyExitCode = $LASTEXITCODE
        Assert-True ($verifyExitCode -ne 0) "ordinary Verify reaches the guarded HTTP boundary"
        Assert-True ((Get-Content -LiteralPath $networkBlockMarker -Raw).Trim() -eq "http") "ordinary Verify records one blocked HTTP attempt before any request"
        Remove-Item -LiteralPath $networkBlockMarker -Force
    }
    finally {
        $env:SAKURA_VALIDATE_REMOTE_SCRIPT = $savedShellValidation
        $env:SAKURA_TEST_NETWORK_BLOCK_MARKER = $savedNetworkBlockMarker
    }

    Write-Host "Sakura sanitized restore contract tests passed."
}
finally {
    if ($verified) { Remove-SakuraSanitizedRestoreArchiveExtraction -Archive $verified }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
