Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-SakuraRestoreSha256 {
    param([Parameter(Mandatory)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-SakuraRestoreRelativePath {
    param([Parameter(Mandatory)][string]$Path)

    if (
        [string]::IsNullOrWhiteSpace($Path) -or
        $Path.StartsWith("/") -or
        $Path.Contains("..") -or
        $Path.Contains("`r") -or
        $Path.Contains("`n") -or
        $Path.Contains("\\") -or
        $Path -notmatch '^[A-Za-z0-9._/@+-]+$'
    ) {
        throw "Unsafe restore path: $Path"
    }
}

function Assert-SakuraRestoreConfig {
    param([Parameter(Mandatory)][object]$Config)

    if (-not $Config.restoreContract -or [int]$Config.restoreContract.version -ne 1) {
        throw "Restore contract version 1 is required."
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.restoreContract.archiveRoot) -or [string]$Config.restoreContract.archiveRoot -notmatch '^[A-Za-z0-9._-]+$') {
        throw "Restore contract archiveRoot is invalid."
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.restoreContract.remotePublicRoot) -or [string]$Config.restoreContract.remotePublicRoot -notmatch '^/[A-Za-z0-9_./-]+$' -or [string]$Config.restoreContract.remotePublicRoot -match '(^|/)\.\.(/|$)') {
        throw "Restore contract remotePublicRoot must be a safe absolute path."
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.restoreContract.backupDirectory) -or [string]$Config.restoreContract.backupDirectory -notmatch '^/[A-Za-z0-9_./-]+$' -or [string]$Config.restoreContract.backupDirectory -match '(^|/)\.\.(/|$)') {
        throw "Restore contract backupDirectory must be a safe absolute path."
    }
    foreach ($path in @($Config.managedRootFiles)) { Assert-SakuraRestoreRelativePath -Path ([string]$path) }
    foreach ($directory in @($Config.managedDirectories)) {
        if ([string]$directory -notmatch '^[A-Za-z0-9._-]+$') { throw "Unsafe managed directory: $directory" }
    }
    $protected = @($Config.protectedPaths)
    if ($protected.Count -ne 3) { throw "Exactly three protected PDF paths are required."
    }
    foreach ($entry in $protected) {
        $path = [string]$entry.path
        if ($path -notmatch '^pdfjs/[124]c_abroad\.pdf$') { throw "Protected PDF path is invalid: $path" }
        if ([int64]$entry.bytes -lt 1 -or [string]$entry.sha256 -notmatch '^[0-9a-fA-F]{64}$') { throw "Protected PDF metadata is invalid: $path" }
    }
}

function Test-SakuraRestoreManagedPath {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][object]$Config)

    Assert-SakuraRestoreRelativePath -Path $Path
    if ($Path -like "TOOL/*" -or $Path -eq "pdfjs/LICENSE" -or $Path -like "pdfjs/build/*" -or $Path -like "pdfjs/web/*") {
        return $false
    }
    if ($Path -like "pdfjs/*") {
        return @($Config.protectedPaths | ForEach-Object { [string]$_.path }) -contains $Path
    }
    if ($Path -notlike "*/*") {
        return @($Config.managedRootFiles) -contains $Path
    }
    $topDirectory = ($Path -split "/", 2)[0]
    return @($Config.managedDirectories) -contains $topDirectory
}

function Assert-SakuraRestoreArchiveEntry {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Type,
        [Parameter(Mandatory)][string]$ArchiveRoot
    )

    if ($Type -in @("l", "h")) { throw "Restore archive contains a symlink or hard link: $Path" }
    if ($Path.StartsWith("/") -or $Path.Contains("`r") -or $Path.Contains("`n") -or $Path.Contains("\\") -or $Path -match '(^|/)\.\.(/|$)') {
        throw "Restore archive contains an unsafe entry: $Path"
    }
    $prefix = "$ArchiveRoot/"
    if ($Path -eq "$ArchiveRoot/" -or $Path -eq "$ArchiveRoot/payload/") { return }
    if ($Path -in @("$ArchiveRoot/manifest.txt", "$ArchiveRoot/manifest.sha256", "$ArchiveRoot/metadata.json")) { return }
    if ($Path.StartsWith("$prefix`payload/")) {
        Assert-SakuraRestoreRelativePath -Path $Path.Substring("$prefix`payload/".Length)
        return
    }
    throw "Restore archive contains an unexpected entry: $Path"
}

function Get-SakuraRestoreManifest {
    param([Parameter(Mandatory)][string]$ManifestPath, [Parameter(Mandatory)][object]$Config)

    $entries = @{}
    foreach ($line in [IO.File]::ReadAllLines($ManifestPath, [Text.UTF8Encoding]::new($false))) {
        if ($line -notmatch '^([0-9a-f]{64})  ([A-Za-z0-9._/@+-]+)$') { throw "Restore manifest contains an invalid line." }
        $hash = $Matches[1]
        $path = $Matches[2]
        Assert-SakuraRestoreRelativePath -Path $path
        if (-not (Test-SakuraRestoreManagedPath -Path $path -Config $Config)) { throw "Restore manifest contains an unmanaged or prohibited path: $path" }
        if ($entries.ContainsKey($path)) { throw "Restore manifest contains a duplicate path: $path" }
        $entries[$path] = $hash
    }
    if ($entries.Count -eq 0) { throw "Restore manifest is empty." }
    foreach ($protected in @($Config.protectedPaths)) {
        $path = [string]$protected.path
        if (-not $entries.ContainsKey($path) -or $entries[$path] -ne ([string]$protected.sha256).ToLowerInvariant()) {
            throw "Restore manifest does not preserve the protected PDF: $path"
        }
    }
    return $entries
}

function New-SakuraSanitizedRestoreArchive {
    param(
        [Parameter(Mandatory)][string]$SourceDirectory,
        [Parameter(Mandatory)][string]$ArchivePath,
        [Parameter(Mandatory)][object]$Config,
        [Parameter(Mandatory)][string]$DeploymentPathManifestSha256,
        [Parameter(Mandatory)][string]$DeploymentEvidenceSha256,
        [string[]]$IncludePaths
    )

    Assert-SakuraRestoreConfig -Config $Config
    if ($DeploymentPathManifestSha256 -notmatch '^[0-9a-fA-F]{64}$' -or $DeploymentEvidenceSha256 -notmatch '^[0-9a-fA-F]{64}$') { throw "Deployment manifest SHA-256 is invalid." }
    $source = (Resolve-Path -LiteralPath $SourceDirectory).Path
    $archiveFullPath = [IO.Path]::GetFullPath($ArchivePath)
    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("abroad-o-restore-archive-" + [Guid]::NewGuid().ToString("N"))
    $archiveRoot = [string]$Config.restoreContract.archiveRoot
    try {
        $payload = Join-Path $temporaryRoot "$archiveRoot/payload"
        New-Item -ItemType Directory -Path $payload -Force | Out-Null
        $paths = @()
        if ($IncludePaths) {
            foreach ($relativePath in @($IncludePaths | Sort-Object -Unique)) {
                if (-not (Test-SakuraRestoreManagedPath -Path $relativePath -Config $Config)) { throw "Restore snapshot path is unmanaged or prohibited: $relativePath" }
                $sourcePath = Join-Path $source $relativePath
                if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
                    if (((Get-Item -LiteralPath $sourcePath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Restore source contains a symbolic link: $sourcePath" }
                    $paths += $relativePath
                }
            }
        }
        else {
            foreach ($item in Get-ChildItem -LiteralPath $source -Recurse -File -Force) {
                if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Restore source contains a symbolic link: $($item.FullName)" }
                $relativePath = [IO.Path]::GetRelativePath($source, $item.FullName).Replace("\", "/")
                if (Test-SakuraRestoreManagedPath -Path $relativePath -Config $Config) { $paths += $relativePath }
            }
        }
        $paths = @($paths | Sort-Object -Unique)
        foreach ($protected in @($Config.protectedPaths)) {
            $protectedPath = [string]$protected.path
            if ($paths -notcontains $protectedPath) { throw "Restore source is missing the protected PDF: $protectedPath" }
            $localPath = Join-Path $source $protectedPath
            if ((Get-Item -LiteralPath $localPath).Length -ne [int64]$protected.bytes -or (Get-SakuraRestoreSha256 -Path $localPath) -ne ([string]$protected.sha256).ToLowerInvariant()) {
                throw "Restore source protected PDF changed: $protectedPath"
            }
        }
        $manifestLines = foreach ($relativePath in $paths) {
            $sourcePath = Join-Path $source $relativePath
            $destinationPath = Join-Path $payload $relativePath
            New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
            Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
            "$(Get-SakuraRestoreSha256 -Path $sourcePath)  $relativePath"
        }
        $manifestPath = Join-Path $temporaryRoot "$archiveRoot/manifest.txt"
        [IO.File]::WriteAllText($manifestPath, (($manifestLines -join "`n") + "`n"), [Text.UTF8Encoding]::new($false))
        $manifestHash = Get-SakuraRestoreSha256 -Path $manifestPath
        [IO.File]::WriteAllText((Join-Path $temporaryRoot "$archiveRoot/manifest.sha256"), "$manifestHash  manifest.txt`n", [Text.UTF8Encoding]::new($false))
        $metadata = [ordered]@{ formatVersion = 1; archiveRoot = $archiveRoot; remotePublicRoot = [string]$Config.restoreContract.remotePublicRoot; deploymentPathManifestSha256 = $DeploymentPathManifestSha256.ToLowerInvariant(); deploymentEvidenceSha256 = $DeploymentEvidenceSha256.ToLowerInvariant() } | ConvertTo-Json -Compress
        [IO.File]::WriteAllText((Join-Path $temporaryRoot "$archiveRoot/metadata.json"), "$metadata`n", [Text.UTF8Encoding]::new($false))
        $archiveParent = Split-Path -Parent $archiveFullPath
        if ($archiveParent) { New-Item -ItemType Directory -Path $archiveParent -Force | Out-Null }
        & tar -czf $archiveFullPath -C $temporaryRoot $archiveRoot
        if ($LASTEXITCODE -ne 0) { throw "tar failed while creating the sanitized restore archive." }
        $archiveHash = Get-SakuraRestoreSha256 -Path $archiveFullPath
        $result = [pscustomobject]@{ ArchivePath = $archiveFullPath; ArchiveSha256 = $archiveHash; ManifestSha256 = $manifestHash; DeploymentPathManifestSha256 = $DeploymentPathManifestSha256.ToLowerInvariant(); DeploymentEvidenceSha256 = $DeploymentEvidenceSha256.ToLowerInvariant(); Paths = $paths }
        $verifiedArchive = Test-SakuraSanitizedRestoreArchive -ArchivePath $archiveFullPath -ExpectedArchiveSha256 $archiveHash -ExpectedManifestSha256 $manifestHash -ExpectedDeploymentPathManifestSha256 $DeploymentPathManifestSha256 -ExpectedDeploymentEvidenceSha256 $DeploymentEvidenceSha256 -Config $Config
        Remove-SakuraSanitizedRestoreArchiveExtraction -Archive $verifiedArchive
        return $result
    }
    finally {
        if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force }
    }
}

function Test-SakuraSanitizedRestoreArchive {
    param(
        [Parameter(Mandatory)][string]$ArchivePath,
        [Parameter(Mandatory)][string]$ExpectedArchiveSha256,
        [Parameter(Mandatory)][string]$ExpectedManifestSha256,
        [Parameter(Mandatory)][string]$ExpectedDeploymentPathManifestSha256,
        [Parameter(Mandatory)][string]$ExpectedDeploymentEvidenceSha256,
        [Parameter(Mandatory)][object]$Config
    )

    Assert-SakuraRestoreConfig -Config $Config
    if ($ExpectedArchiveSha256 -notmatch '^[0-9a-fA-F]{64}$' -or $ExpectedManifestSha256 -notmatch '^[0-9a-fA-F]{64}$' -or $ExpectedDeploymentPathManifestSha256 -notmatch '^[0-9a-fA-F]{64}$' -or $ExpectedDeploymentEvidenceSha256 -notmatch '^[0-9a-fA-F]{64}$') { throw "Expected restore hashes are invalid." }
    $archive = (Resolve-Path -LiteralPath $ArchivePath).Path
    if ((Get-SakuraRestoreSha256 -Path $archive) -ne $ExpectedArchiveSha256.ToLowerInvariant()) { throw "Sanitized restore archive SHA-256 does not match." }
    $archiveRoot = [string]$Config.restoreContract.archiveRoot
    $entries = @(& tar -tzf $archive)
    if ($LASTEXITCODE -ne 0 -or $entries.Count -eq 0) { throw "Cannot list the sanitized restore archive." }
    $detailLines = @(& tar -tvzf $archive)
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect the sanitized restore archive." }
    foreach ($entry in $entries) { Assert-SakuraRestoreArchiveEntry -Path $entry -Type "-" -ArchiveRoot $archiveRoot }
    foreach ($detail in $detailLines) {
        if ($detail.Length -gt 0 -and $detail.Substring(0, 1) -in @("l", "h")) {
            throw "Restore archive contains a symlink or hard link: $detail"
        }
    }
    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("abroad-o-restore-verify-" + [Guid]::NewGuid().ToString("N"))
    try {
        New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
        & tar -xzf $archive -C $temporaryRoot
        if ($LASTEXITCODE -ne 0) { throw "Cannot extract the sanitized restore archive." }
        $root = Join-Path $temporaryRoot $archiveRoot
        $manifestPath = Join-Path $root "manifest.txt"
        $manifestEvidencePath = Join-Path $root "manifest.sha256"
        $metadataPath = Join-Path $root "metadata.json"
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or -not (Test-Path -LiteralPath $manifestEvidencePath -PathType Leaf) -or -not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { throw "Sanitized restore archive metadata is incomplete." }
        $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
        if ([int]$metadata.formatVersion -ne 1 -or [string]$metadata.archiveRoot -ne $archiveRoot -or [string]$metadata.remotePublicRoot -ne [string]$Config.restoreContract.remotePublicRoot -or [string]$metadata.deploymentPathManifestSha256 -ne $ExpectedDeploymentPathManifestSha256.ToLowerInvariant() -or [string]$metadata.deploymentEvidenceSha256 -ne $ExpectedDeploymentEvidenceSha256.ToLowerInvariant()) { throw "Sanitized restore archive is not bound to this deployment manifest, content evidence, and public root." }
        $manifestHash = Get-SakuraRestoreSha256 -Path $manifestPath
        if ($manifestHash -ne $ExpectedManifestSha256.ToLowerInvariant()) { throw "Sanitized restore manifest SHA-256 does not match." }
        $manifestEvidence = [IO.File]::ReadAllText($manifestEvidencePath, [Text.UTF8Encoding]::new($false)).Trim()
        if ($manifestEvidence -ne "$manifestHash  manifest.txt") { throw "Sanitized restore manifest evidence does not match." }
        $hashes = Get-SakuraRestoreManifest -ManifestPath $manifestPath -Config $Config
        $payload = Join-Path $root "payload"
        foreach ($path in $hashes.Keys) {
            $file = Join-Path $payload $path
            if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-SakuraRestoreSha256 -Path $file) -ne $hashes[$path]) { throw "Sanitized restore payload hash does not match: $path" }
        }
        if (Get-ChildItem -LiteralPath $root -Recurse -Force | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 } | Select-Object -First 1) { throw "Sanitized restore archive extracted a symbolic link." }
        return [pscustomobject]@{ ArchivePath = $archive; ArchiveSha256 = $ExpectedArchiveSha256.ToLowerInvariant(); ManifestSha256 = $manifestHash; DeploymentPathManifestSha256 = $ExpectedDeploymentPathManifestSha256.ToLowerInvariant(); DeploymentEvidenceSha256 = $ExpectedDeploymentEvidenceSha256.ToLowerInvariant(); ExtractionDirectory = $temporaryRoot; PayloadDirectory = $payload; Paths = @($hashes.Keys | Sort-Object); Hashes = $hashes }
    }
    catch {
        if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force }
        throw
    }
}

function Get-SakuraSanitizedRestorePlan {
    param(
        [Parameter(Mandatory)][object]$Archive,
        [Parameter(Mandatory)][string[]]$CurrentManifestPaths,
        [Parameter(Mandatory)][object]$Config
    )

    Assert-SakuraRestoreConfig -Config $Config
    foreach ($path in $CurrentManifestPaths) {
        if (-not (Test-SakuraRestoreManagedPath -Path $path -Config $Config)) { throw "Current manifest contains an unmanaged or prohibited restore path: $path" }
    }
    $current = @($CurrentManifestPaths | Sort-Object -Unique)
    $previous = @($Archive.Paths | Sort-Object -Unique)
    return [pscustomobject]@{ Archive = $Archive; RestorePaths = $previous; DeletePaths = @($current | Where-Object { $previous -notcontains $_ }) }
}

function Remove-SakuraSanitizedRestoreArchiveExtraction {
    param([Parameter(Mandatory)][object]$Archive)

    if (-not $Archive.ExtractionDirectory -or -not ([string]$Archive.ExtractionDirectory).StartsWith([IO.Path]::GetTempPath(), [StringComparison]::OrdinalIgnoreCase)) {
        throw "Restore extraction directory is not a recognized temporary directory."
    }
    if (Test-Path -LiteralPath $Archive.ExtractionDirectory) { Remove-Item -LiteralPath $Archive.ExtractionDirectory -Recurse -Force }
}

function Invoke-SakuraSanitizedRestorePlan {
    param(
        [Parameter(Mandatory)][object]$Plan,
        [Parameter(Mandatory)][string]$DestinationDirectory,
        [Parameter(Mandatory)][string]$ExpectedDestinationDirectory,
        [switch]$Apply
    )

    $destination = [IO.Path]::GetFullPath($DestinationDirectory)
    $expected = [IO.Path]::GetFullPath($ExpectedDestinationDirectory)
    if (-not [string]::Equals($destination, $expected, [StringComparison]::OrdinalIgnoreCase)) { throw "Restore destination does not match the fixed public root." }
    if (-not (Test-Path -LiteralPath $destination -PathType Container)) { throw "Restore destination does not exist." }
    if (Get-ChildItem -LiteralPath $destination -Recurse -Force | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 } | Select-Object -First 1) { throw "Restore destination contains a symbolic link." }
    foreach ($path in $Plan.RestorePaths) {
        $source = Join-Path $Plan.Archive.PayloadDirectory $path
        if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or (Get-SakuraRestoreSha256 -Path $source) -ne $Plan.Archive.Hashes[$path]) { throw "Restore payload changed before restore: $path" }
        Write-Host "RESTORE $path"
    }
    foreach ($path in $Plan.DeletePaths) { Write-Host "DELETE_NEW_ONLY $path" }
    if (-not $Apply) { return }
    foreach ($path in $Plan.RestorePaths) {
        $source = Join-Path $Plan.Archive.PayloadDirectory $path
        $target = Join-Path $destination $path
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $target -Force
    }
    foreach ($path in $Plan.DeletePaths) {
        $target = Join-Path $destination $path
        if (Test-Path -LiteralPath $target -PathType Leaf) { Remove-Item -LiteralPath $target -Force }
    }
}

Export-ModuleMember -Function @(
    "Assert-SakuraRestoreConfig",
    "Assert-SakuraRestoreRelativePath",
    "Assert-SakuraRestoreArchiveEntry",
    "Test-SakuraRestoreManagedPath",
    "New-SakuraSanitizedRestoreArchive",
    "Test-SakuraSanitizedRestoreArchive",
    "Get-SakuraSanitizedRestorePlan",
    "Remove-SakuraSanitizedRestoreArchiveExtraction",
    "Invoke-SakuraSanitizedRestorePlan"
)
