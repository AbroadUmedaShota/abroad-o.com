param(
    [ValidateSet("Package", "DryRun", "Audit", "Preflight", "Stage", "Promote", "Deploy", "Verify", "Restore", "RestoreSafe")]
    [string]$Mode = "DryRun",

    [string]$ConfigPath = "deploy/sakura-public-files.json",
    [string]$WorkDir = ".deploy/sakura",
    [string]$HostName = $env:SAKURA_HOST,
    [string]$UserName = $env:SAKURA_USER,
    [string]$RemoteDir = $env:SAKURA_REMOTE_DIR,
    [string]$SshKeyPath = $env:SAKURA_SSH_KEY_PATH,
    [int]$Port = $(if ($env:SAKURA_PORT) { [int]$env:SAKURA_PORT } else { 22 }),
    [string]$BackupFile = $env:SAKURA_BACKUP_FILE,
    [string]$StagedReleaseId = $env:SAKURA_STAGED_RELEASE_ID,
    [switch]$UseFileZillaConfig
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    $root = (& git rev-parse --show-toplevel 2>$null)
    if (-not $root) {
        throw "This script must be run inside the git repository."
    }
    return (Resolve-Path $root).Path
}

function Test-NameExcluded {
    param([string]$Name, [object]$Config)
    return $Config.excludeNames -contains $Name
}

function Test-FilePatternExcluded {
    param([string]$Name, [object]$Config)
    foreach ($pattern in $Config.excludeFilePatterns) {
        if ($Name -like $pattern) {
            return $true
        }
    }
    return $false
}

function ConvertFrom-FileZillaPath {
    param([string]$EncodedPath)

    if (-not $EncodedPath) {
        return $null
    }

    $parts = $EncodedPath -split " "
    if ($parts.Count -lt 3) {
        return $EncodedPath
    }

    $segments = @()
    for ($i = 2; $i -lt $parts.Count; ) {
        $length = 0
        if (-not [int]::TryParse($parts[$i], [ref]$length)) {
            break
        }
        if ($i + 1 -ge $parts.Count) {
            break
        }
        $segments += $parts[$i + 1]
        $i += 2
    }

    if ($segments.Count -eq 0) {
        return $EncodedPath
    }

    return "/" + ($segments -join "/")
}

function Get-FileZillaSakuraConfig {
    $paths = @(
        (Join-Path $env:APPDATA "FileZilla\filezilla.xml"),
        (Join-Path $env:APPDATA "FileZilla\sitemanager.xml"),
        (Join-Path $env:APPDATA "FileZilla\recentservers.xml")
    )

    foreach ($path in $paths) {
        if (-not (Test-Path $path)) {
            continue
        }

        [xml]$xml = Get-Content -LiteralPath $path -Raw
        $nodes = @()
        $nodes += $xml.SelectNodes("//Server")
        $nodes += $xml.SelectNodes("//Tab")

        foreach ($node in $nodes) {
            $hostValue = [string]$node.Host
            if (-not $hostValue -or $hostValue -notlike "*.sakura.ne.jp") {
                continue
            }

            $remoteValue = ConvertFrom-FileZillaPath ([string]($node.RemoteDir ?? $node.RemotePath))
            if ($remoteValue -like "*/abroad-o.com/*") {
                $remoteValue = $remoteValue -replace "^(.*?/abroad-o\.com)/.*$", '$1'
            } elseif ($remoteValue -like "*/TOOL") {
                $remoteValue = Split-Path -Path $remoteValue -Parent
                $remoteValue = $remoteValue -replace "\\", "/"
            }

            return [pscustomobject]@{
                Source = $path
                Host = $hostValue
                User = [string]$node.User
                RemoteDir = $remoteValue
                Protocol = [string]$node.Protocol
                Port = [string]$node.Port
            }
        }
    }

    return $null
}

function Set-ConnectionFromFileZilla {
    $fileZillaConfig = Get-FileZillaSakuraConfig
    if (-not $fileZillaConfig) {
        throw "FileZilla Sakura connection was not found under $env:APPDATA\FileZilla."
    }

    if (-not $HostName) {
        $script:HostName = $fileZillaConfig.Host
    }
    if (-not $UserName) {
        $script:UserName = $fileZillaConfig.User
    }
    if (-not $RemoteDir -and $fileZillaConfig.RemoteDir) {
        $script:RemoteDir = $fileZillaConfig.RemoteDir
    }

    if (-not $env:SAKURA_PORT -and $fileZillaConfig.Protocol -eq "1" -and $fileZillaConfig.Port) {
        $script:Port = [int]$fileZillaConfig.Port
    }

    Write-Host "Loaded FileZilla connection: host=$HostName user=$UserName remote=$RemoteDir sshPort=$Port"
    if ($fileZillaConfig.Protocol -eq "0") {
        Write-Host "FileZilla uses FTP/port $($fileZillaConfig.Port); this deploy script still uses SSH/SCP on port $Port."
    }
}

function Copy-FilteredItem {
    param(
        [string]$Source,
        [string]$Destination,
        [object]$Config
    )

    $item = Get-Item -LiteralPath $Source -Force
    if (Test-NameExcluded -Name $item.Name -Config $Config) {
        return
    }

    if ($item.PSIsContainer) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
        Get-ChildItem -LiteralPath $item.FullName -Force | ForEach-Object {
            Copy-FilteredItem -Source $_.FullName -Destination (Join-Path $Destination $_.Name) -Config $Config
        }
        return
    }

    if (Test-FilePatternExcluded -Name $item.Name -Config $Config) {
        return
    }

    $parent = Split-Path -Parent $Destination
    if ($parent) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $item.FullName -Destination $Destination -Force
}

function New-DeployPackage {
    param(
        [string]$RepoRoot,
        [object]$Config,
        [string]$WorkDirPath
    )

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $stagingDir = Join-Path $WorkDirPath "staging"
    $packagePath = Join-Path $WorkDirPath "abroad-o-public-$stamp.tgz"
    $manifestPath = Join-Path $WorkDirPath "manifest-$stamp.txt"
    $evidencePath = Join-Path $WorkDirPath "manifest-$stamp.sha256"

    if (Test-Path $stagingDir) {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

    if ($Config.publicRoot) {
        $publicRoot = Join-Path $RepoRoot $Config.publicRoot
        if (-not (Test-Path -LiteralPath $publicRoot)) {
            throw "Generated public root was not found: $publicRoot"
        }
        Get-ChildItem -LiteralPath $publicRoot -Force | ForEach-Object {
            Copy-FilteredItem -Source $_.FullName -Destination (Join-Path $stagingDir $_.Name) -Config $Config
        }
    } else {
        foreach ($pattern in $Config.includeRootFiles) {
            Get-ChildItem -Path $RepoRoot -Filter $pattern -File -Force | ForEach-Object {
                if (-not (Test-FilePatternExcluded -Name $_.Name -Config $Config)) {
                    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stagingDir $_.Name) -Force
                }
            }
        }

        foreach ($directory in $Config.includeDirectories) {
            $sourceDir = Join-Path $RepoRoot $directory
            if (Test-Path $sourceDir) {
                Copy-FilteredItem -Source $sourceDir -Destination (Join-Path $stagingDir $directory) -Config $Config
            }
        }
    }

    $manifest = Get-ChildItem -LiteralPath $stagingDir -Recurse -File -Force |
        ForEach-Object { [IO.Path]::GetRelativePath($stagingDir, $_.FullName).Replace("\", "/") } |
        Sort-Object
    $manifest | Set-Content -Path $manifestPath -Encoding UTF8

    $manifestEvidence = foreach ($path in $manifest) {
        $hash = (Get-FileHash -LiteralPath (Join-Path $stagingDir $path) -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $path"
    }
    $manifestEvidence | Set-Content -Path $evidencePath -Encoding UTF8

    if ($manifest.Count -eq 0) {
        throw "Deployment package is empty."
    }

    & tar -czf $packagePath -C $stagingDir .
    if ($LASTEXITCODE -ne 0) {
        throw "tar failed while creating deployment package."
    }

    [pscustomobject]@{
        StagingDir = $stagingDir
        PackagePath = $packagePath
        ManifestPath = $manifestPath
        EvidencePath = $evidencePath
        ManifestSha256 = (Get-FileHash -LiteralPath $evidencePath -Algorithm SHA256).Hash.ToLowerInvariant()
        FileCount = $manifest.Count
        Stamp = $stamp
    }
}

function Assert-DeployContract {
    param([object]$Package, [object]$Config)

    $paths = @(Get-Content -LiteralPath $Package.ManifestPath)
    $roots = @($paths | Where-Object { $_ -notlike "*/*" } | Sort-Object)
    $expectedRoots = @($Config.managedRootFiles | Sort-Object)
    if (Compare-Object -ReferenceObject $expectedRoots -DifferenceObject $roots) {
        throw "Package root files differ from deploy/sakura-public-files.json. Update the explicit managedRootFiles manifest before deployment."
    }
    $directories = @($paths | Where-Object { $_ -like "*/*" } | ForEach-Object { ($_ -split "/", 2)[0] } | Sort-Object -Unique)
    $expectedDirectories = @($Config.managedDirectories | Sort-Object)
    if (Compare-Object -ReferenceObject $expectedDirectories -DifferenceObject $directories) {
        throw "Package directories differ from the managed directory allowlist."
    }
    foreach ($path in $paths) {
        if ($path -notmatch '^[A-Za-z0-9._/@+-]+$' -or $path.StartsWith("/") -or $path.Contains("..")) {
            throw "Unsafe deployment path: $path"
        }
    }
    foreach ($path in @($Config.deletePaths)) {
        if ($path -notmatch '^[A-Za-z0-9._/@+-]+$' -or $path.StartsWith("/") -or $path.Contains("..") -or $path.Contains("`n") -or $path.Contains("`r")) {
            throw "Unsafe delete allowlist path: $path"
        }
        if ($paths -contains $path) { throw "Delete allowlist path is still in the deployment manifest: $path" }
        if ($path -in @('.htaccess', 'sitemap.xml')) { throw "Protected path cannot be deleted: $path" }
    }
    $allowedDeletePrefixes = @('TOOL/', 'pdfjs/build/', 'pdfjs/web/')
    foreach ($prefix in @($Config.deletePrefixes)) {
        if ($prefix -notmatch '^[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*/$' -or $prefix -notin $allowedDeletePrefixes) {
            throw "Unsafe delete allowlist prefix: $prefix"
        }
        if ($prefix -eq 'pdfjs/' -or $prefix -eq '/') { throw "Broad delete prefix is not allowed: $prefix" }
        if ($paths | Where-Object { $_.StartsWith($prefix, [StringComparison]::Ordinal) }) {
            throw "Delete allowlist prefix is still in the deployment manifest: $prefix"
        }
    }
    foreach ($protected in @($Config.protectedPaths)) {
        $protectedPath = [string]$protected.path
        if ($protectedPath -notmatch '^pdfjs/[124]c_abroad\.pdf$' -or -not ($paths -contains $protectedPath)) {
            throw "Protected PDF path is missing or invalid: $protectedPath"
        }
        $localPath = Join-Path $Package.StagingDir $protectedPath
        if ((Get-Item -LiteralPath $localPath).Length -ne [int64]$protected.bytes) {
            throw "Protected PDF byte count changed: $protectedPath"
        }
        $actualHash = (Get-FileHash -LiteralPath $localPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne ([string]$protected.sha256).ToLowerInvariant()) {
            throw "Protected PDF SHA-256 changed: $protectedPath"
        }
    }
}

function Assert-RemoteInput {
    param([string]$Directory)
    if ($Directory -notmatch '^/[A-Za-z0-9_./-]+$' -or $Directory.Contains('..') -or $Directory.Contains("`n") -or $Directory.Contains("`r")) {
        throw "SAKURA_REMOTE_DIR must be a safe absolute Unix path."
    }
    if ($UserName -notmatch '^[A-Za-z0-9_-]+$') { throw "SAKURA_USER contains unsafe characters." }
}

function Invoke-RemotePreflight {
    param([object]$Package, [string]$RemoteDirectory, [object]$Config)

    $manifestBody = (Get-Content -LiteralPath $Package.ManifestPath) -join "`n"
    $deletePrefixBody = (@($Config.deletePrefixes) -join "`n")
    $stagingBytes = (Get-ChildItem -LiteralPath $Package.StagingDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $script = @"
set -eu
REMOTE_DIR='$RemoteDirectory'
MINIMUM_FREE_BYTES='$($Config.minimumFreeBytes)'
PACKAGE_BYTES='$((Get-Item -LiteralPath $Package.PackagePath).Length)'
STAGING_BYTES='$stagingBytes'
test -d "`$REMOTE_DIR"
test ! -L "`$REMOTE_DIR"
if find "`$REMOTE_DIR" -type l -print -quit | grep -q .; then
  echo 'Remote directory contains a symlink; refusing deployment.' >&2
  exit 1
fi
available=`$(df -Pk "`$REMOTE_DIR" | awk 'NR == 2 { print `$4 * 1024 }')
test -n "`$available"
backup_bytes=`$(du -sk "`$REMOTE_DIR" | awk '{print `$1 * 1024}')
largest_tree="`$backup_bytes"
if [ "`$STAGING_BYTES" -gt "`$largest_tree" ]; then largest_tree="`$STAGING_BYTES"; fi
required=`$((PACKAGE_BYTES + 2 * largest_tree + 20971520))
if [ "`$required" -lt "`$MINIMUM_FREE_BYTES" ]; then required="`$MINIMUM_FREE_BYTES"; fi
if [ "`$available" -lt "`$required" ]; then
  echo "Insufficient free space: available=`$available required=`$required bytes" >&2
  exit 1
fi
expected=`$(mktemp)
deletable=`$(mktemp)
delete_prefixes=`$(mktemp)
allowed=`$(mktemp)
actual=`$(mktemp)
trap 'rm -f "`$expected" "`$deletable" "`$delete_prefixes" "`$allowed" "`$actual"' EXIT
cat > "`$expected" <<'CODEX_MANIFEST'
$manifestBody
CODEX_MANIFEST
cat > "`$deletable" <<'CODEX_DELETE_PATHS'
$(@($Config.deletePaths) -join "`n")
CODEX_DELETE_PATHS
cat > "`$delete_prefixes" <<'CODEX_DELETE_PREFIXES'
$deletePrefixBody
CODEX_DELETE_PREFIXES
while IFS= read -r prefix; do
  [ -n "`$prefix" ] || continue
  case "`$prefix" in TOOL/|pdfjs/build/|pdfjs/web/) ;; *) echo "Unsafe delete prefix: `$prefix" >&2; exit 1 ;; esac
  test "`$prefix" != 'pdfjs/' && test "`$prefix" != '/'
  if [ -d "`$REMOTE_DIR/`$prefix" ]; then
    (cd "`$REMOTE_DIR" && find "`$prefix" -type f -printf '%p\n') >> "`$deletable"
  fi
done < "`$delete_prefixes"
(cd "`$REMOTE_DIR" && find . -type f -printf '%P\n' | LC_ALL=C sort) > "`$actual"
cat "`$expected" "`$deletable" | LC_ALL=C sort -u > "`$allowed"
unknown=`$(comm -23 "`$actual" "`$allowed" || true)
if [ -n "`$unknown" ]; then
  echo 'Remote contains files outside the explicit ownership/deletion contract; refusing to overwrite.' >&2
  printf '%s\n' "`$unknown" >&2
  exit 1
fi
echo "Preflight passed: freeBytes=`$available requiredBytes=`$required manifestSha256=$($Package.ManifestSha256)"
"@
    Invoke-RemoteScript -Script $script
}

function Invoke-RemotePromote {
    param([object]$Package, [string]$RemoteDirectory, [string]$RemotePackage, [string]$RemoteBackup, [object]$Config)

    $manifestBody = (Get-Content -LiteralPath $Package.ManifestPath) -join "`n"
    $deletePrefixBody = (@($Config.deletePrefixes) -join "`n")
    $script = @"
set -eu
REMOTE_DIR='$RemoteDirectory'
REMOTE_PACKAGE='$RemotePackage'
REMOTE_BACKUP='$RemoteBackup'
STAGE_DIR=`$(mktemp -d "`$HOME/abroad-o-stage.XXXXXX")
cleanup() { rm -rf "`$STAGE_DIR"; }
trap cleanup EXIT
test -f "`$REMOTE_PACKAGE"
if find "`$REMOTE_DIR" -type l -print -quit | grep -q .; then
  echo 'Remote directory contains a symlink immediately before promote; refusing deployment.' >&2
  exit 1
fi
unsafe_entries=`$(tar -tzf "`$REMOTE_PACKAGE" | awk '/^\// || /(^|\/)\.\.($|\/)/ { print; exit }')
if [ -n "`$unsafe_entries" ]; then
  echo "Staged archive contains an unsafe entry: `$unsafe_entries" >&2
  exit 1
fi
archive_links=`$(tar -tvzf "`$REMOTE_PACKAGE" | awk 'substr(`$1, 1, 1) == "l" || substr(`$1, 1, 1) == "h" { print; exit }')
if [ -n "`$archive_links" ]; then
  echo 'Staged archive contains a symlink or hard link; refusing deployment.' >&2
  exit 1
fi
mkdir -p "`$(dirname "`$REMOTE_BACKUP")"
tar -czf "`$REMOTE_BACKUP" -C "`$REMOTE_DIR" .
tar -xzf "`$REMOTE_PACKAGE" -C "`$STAGE_DIR"
if find "`$STAGE_DIR" -type l -print -quit | grep -q .; then
  echo 'Extracted staging directory contains a symlink; refusing deployment.' >&2
  exit 1
fi
while IFS= read -r path; do
  test -f "`$STAGE_DIR/`$path"
  mkdir -p "`$(dirname "`$REMOTE_DIR/`$path")"
  cp -p "`$STAGE_DIR/`$path" "`$REMOTE_DIR/`$path"
done <<'CODEX_MANIFEST'
$manifestBody
CODEX_MANIFEST
while IFS= read -r path; do
  [ -n "`$path" ] || continue
  rm -f "`$REMOTE_DIR/`$path"
done <<'CODEX_DELETE_PATHS'
$(@($Config.deletePaths) -join "`n")
CODEX_DELETE_PATHS
while IFS= read -r prefix; do
  [ -n "`$prefix" ] || continue
  case "`$prefix" in TOOL/|pdfjs/build/|pdfjs/web/) ;; *) echo "Unsafe delete prefix: `$prefix" >&2; exit 1 ;; esac
  test "`$prefix" != 'pdfjs/' && test "`$prefix" != '/'
  rm -rf "`$REMOTE_DIR/`$prefix"
done <<'CODEX_DELETE_PREFIXES'
$deletePrefixBody
CODEX_DELETE_PREFIXES
rm -f "`$REMOTE_PACKAGE"
echo "Promote completed: backup=`$REMOTE_BACKUP manifestSha256=$($Package.ManifestSha256)"
"@
    Invoke-RemoteScript -Script $script
}

function Assert-RemoteStage {
    param([object]$Package, [string]$ReleaseId)
    if ($ReleaseId -notmatch '^[A-Za-z0-9._-]+$') { throw "Unsafe staged release id." }
    $localPackageHash = (Get-FileHash -LiteralPath $Package.PackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $script = @"
set -eu
RELEASE_ID='$ReleaseId'
PACKAGE="`$HOME/`$RELEASE_ID.tgz"
METADATA="`$HOME/.abroad-o-stages/`$RELEASE_ID.meta"
test -f "`$PACKAGE"
if command -v sha256sum >/dev/null 2>&1; then archive_sha=`$(sha256sum "`$PACKAGE" | awk '{print `$1}'); else archive_sha=`$(shasum -a 256 "`$PACKAGE" | awk '{print `$1}'); fi
test "`$archive_sha" = '$localPackageHash'
mkdir -p "`$(dirname "`$METADATA")"
printf '%s  %s\n' "`$archive_sha" '$($Package.ManifestSha256)' > "`$METADATA"
printf '%s\n' "`$PACKAGE"
"@
    $remotePackage = (Invoke-RemoteScriptOutput -Script $script | Select-Object -Last 1).Trim()
    if ($remotePackage -notmatch '^/home/') { throw "Remote stage did not return an absolute package path." }
    Write-Host "Stage SHA-256 verified: $localPackageHash manifestSha256=$($Package.ManifestSha256) release=$ReleaseId"
    return $remotePackage
}

function Get-VerifiedStagedPackage {
    param([object]$Package, [string]$ReleaseId)
    if (-not $ReleaseId -or $ReleaseId -notmatch '^[A-Za-z0-9._-]+$') { throw "StagedReleaseId or SAKURA_STAGED_RELEASE_ID is required for Promote." }
    $script = @"
set -eu
RELEASE_ID='$ReleaseId'
PACKAGE="`$HOME/`$RELEASE_ID.tgz"
METADATA="`$HOME/.abroad-o-stages/`$RELEASE_ID.meta"
test -f "`$PACKAGE" && test -f "`$METADATA"
read archive_sha manifest_sha < "`$METADATA"
test "`$manifest_sha" = '$($Package.ManifestSha256)'
if command -v sha256sum >/dev/null 2>&1; then actual_sha=`$(sha256sum "`$PACKAGE" | awk '{print `$1}'); else actual_sha=`$(shasum -a 256 "`$PACKAGE" | awk '{print `$1}'); fi
test "`$actual_sha" = "`$archive_sha"
printf '%s\n' "`$PACKAGE"
"@
    return (Invoke-RemoteScriptOutput -Script $script | Select-Object -Last 1).Trim()
}

function Get-SshTarget {
    if (-not $HostName -or -not $UserName) {
        throw "SAKURA_HOST and SAKURA_USER are required for $Mode."
    }
    return "$UserName@$HostName"
}

function Get-RemoteDir {
    if ($RemoteDir) {
        return $RemoteDir
    }
    if (-not $UserName) {
        throw "SAKURA_REMOTE_DIR is required when SAKURA_USER is not set."
    }
    return "/home/$UserName/www"
}

function Get-SshArgs {
    $args = @("-p", "$Port", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new")
    if ($SshKeyPath) {
        $args += @("-i", $SshKeyPath)
    }
    return $args
}

function Get-ScpArgs {
    $args = @("-P", "$Port", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new")
    if ($SshKeyPath) {
        $args += @("-i", $SshKeyPath)
    }
    return $args
}

function Invoke-RemoteScript {
    param([string]$Script)
    $target = Get-SshTarget
    $sshArgs = Get-SshArgs
    $scriptPath = Join-Path $workDirFullPath "remote-script.sh"
    $normalizedScript = ($Script -replace "`r`n", "`n") -replace "`r", "`n"
    [System.IO.File]::WriteAllText($scriptPath, $normalizedScript, [System.Text.UTF8Encoding]::new($false))
    if ($IsWindows) {
        & cmd.exe /c "type `"$scriptPath`" | ssh $($sshArgs -join ' ') $target ""sh -s"""
    }
    else {
        Get-Content -LiteralPath $scriptPath -Raw | & ssh @sshArgs $target "sh -s"
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed."
    }
}

function Invoke-RemoteScriptOutput {
    param([string]$Script)
    $target = Get-SshTarget
    $sshArgs = Get-SshArgs
    $scriptPath = Join-Path $workDirFullPath "remote-audit.sh"
    $normalizedScript = ($Script -replace "`r`n", "`n") -replace "`r", "`n"
    [System.IO.File]::WriteAllText($scriptPath, $normalizedScript, [System.Text.UTF8Encoding]::new($false))
    if ($IsWindows) {
        $output = & cmd.exe /c "type `"$scriptPath`" | ssh $($sshArgs -join ' ') $target `"sh -s`""
    }
    else {
        $output = Get-Content -LiteralPath $scriptPath -Raw | & ssh @sshArgs $target "sh -s"
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed."
    }
    return @($output)
}

function Invoke-ContentAudit {
    param(
        [object]$Package,
        [string]$RemoteDirectory
    )

    $manifest = @(Get-Content -LiteralPath $Package.ManifestPath)
    foreach ($path in $manifest) {
        if ($path -notmatch '^[A-Za-z0-9._/@+-]+$') {
            throw "Audit does not support this public path: $path"
        }
    }

    $textExtensions = @(".css", ".html", ".js", ".json", ".less", ".map", ".md", ".properties", ".rb", ".scss", ".svg", ".txt", ".xml")
    $localHashes = @{}
    $localNormalizedHashes = @{}
    foreach ($path in $manifest) {
        $localPath = Join-Path $Package.StagingDir $path
        $localHashes[$path] = (Get-FileHash -LiteralPath $localPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
        $fileName = [IO.Path]::GetFileName($path)
        if ($textExtensions -contains $extension -or $fileName -in @(".htaccess", "LICENSE")) {
            $bytes = [IO.File]::ReadAllBytes($localPath)
            $normalizedStream = [IO.MemoryStream]::new()
            try {
                for ($index = 0; $index -lt $bytes.Length; $index++) {
                    $byte = $bytes[$index]
                    if ($byte -eq 13 -and $index + 1 -lt $bytes.Length -and $bytes[$index + 1] -eq 10) {
                        continue
                    }
                    $normalizedStream.WriteByte($byte)
                }
                $sha256 = [Security.Cryptography.SHA256]::Create()
                try {
                    $localNormalizedHashes[$path] = [Convert]::ToHexString($sha256.ComputeHash($normalizedStream.ToArray())).ToLowerInvariant()
                }
                finally {
                    $sha256.Dispose()
                }
            }
            finally {
                $normalizedStream.Dispose()
            }
        }
    }

    $manifestBody = $manifest -join "`n"
    $auditScript = @"
set -eu
REMOTE_DIR='$RemoteDirectory'
cd "`$REMOTE_DIR"
if command -v sha256sum >/dev/null 2>&1; then
  HASH_COMMAND='sha256sum'
elif command -v shasum >/dev/null 2>&1; then
  HASH_COMMAND='shasum -a 256'
else
  echo 'Neither sha256sum nor shasum is available on the remote host.' >&2
  exit 1
fi
HASH_LIST=`$(mktemp)
trap 'rm -f "`$HASH_LIST"' EXIT
while IFS= read -r path; do
  if [ -f "`$path" ]; then
    printf '%s\n' "`$path" >> "`$HASH_LIST"
  else
    printf 'MISSING  %s\n' "`$path"
  fi
done <<'CODEX_MANIFEST'
$manifestBody
CODEX_MANIFEST
if [ -s "`$HASH_LIST" ]; then
  xargs `$HASH_COMMAND < "`$HASH_LIST"
fi
while IFS= read -r path; do
  case "`$path" in
    *.css|*.html|*.js|*.json|*.less|*.map|*.md|*.properties|*.rb|*.scss|*.svg|*.txt|*.xml|*/.htaccess|.htaccess|*/LICENSE|LICENSE)
      if [ -f "`$path" ]; then
        NORMALIZED_HASH=`$(perl -pe 's/\r\n/\n/g' < "`$path" | `$HASH_COMMAND | awk '{ print `$1 }')
        printf 'NORMALIZED %s  %s\n' "`$NORMALIZED_HASH" "`$path"
      fi
      ;;
  esac
done <<'CODEX_NORMALIZED_MANIFEST'
$manifestBody
CODEX_NORMALIZED_MANIFEST
"@

    $remoteOutput = Invoke-RemoteScriptOutput -Script $auditScript
    $remoteHashes = @{}
    $remoteNormalizedHashes = @{}
    $missing = @()
    foreach ($line in $remoteOutput) {
        if ($line -match '^MISSING\s{2}(.+)$') {
            $missing += $Matches[1]
            continue
        }
        if ($line -match '^([0-9a-fA-F]{64})\s+\*?(.+)$') {
            $remoteHashes[$Matches[2]] = $Matches[1].ToLowerInvariant()
            continue
        }
        if ($line -match '^NORMALIZED\s+([0-9a-fA-F]{64})\s{2}(.+)$') {
            $remoteNormalizedHashes[$Matches[2]] = $Matches[1].ToLowerInvariant()
        }
    }

    $different = @()
    $lineEndingOnly = @()
    foreach ($path in $manifest) {
        if ($remoteHashes.ContainsKey($path) -and $remoteHashes[$path] -ne $localHashes[$path]) {
            if (
                $localNormalizedHashes.ContainsKey($path) -and
                $remoteNormalizedHashes.ContainsKey($path) -and
                $localNormalizedHashes[$path] -eq $remoteNormalizedHashes[$path]
            ) {
                $lineEndingOnly += $path
            }
            else {
                $different += $path
            }
        }
    }

    foreach ($path in $missing) {
        Write-Host "MISSING $path"
    }
    foreach ($path in $different) {
        Write-Host "DIFFERENT $path"
    }
    foreach ($path in $lineEndingOnly) {
        Write-Host "LINE_ENDING_ONLY $path"
    }

    Write-Host "Audit files: $($manifest.Count)"
    Write-Host "Audit missing: $($missing.Count)"
    Write-Host "Audit different: $($different.Count)"
    Write-Host "Audit line-ending-only: $($lineEndingOnly.Count)"

    if ($missing.Count -gt 0 -or $different.Count -gt 0) {
        throw "Public content audit found drift."
    }

    Write-Host "Public content audit passed."
}

function Invoke-Verification {
    param([object]$Config)

    $failed = $false

    foreach ($url in $Config.verification.expectedOk) {
        try {
            $response = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5 -UseBasicParsing
            if ($response.StatusCode -ne 200) {
                Write-Error "Expected 200 but got $($response.StatusCode): $url"
                $failed = $true
            } else {
                Write-Host "OK 200 $url"
            }
        } catch {
            Write-Error "Expected 200 but request failed: $url - $($_.Exception.Message)"
            $failed = $true
        }
    }

    foreach ($url in $Config.verification.expectedNotFound) {
        try {
            $response = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 0 -UseBasicParsing
            Write-Error "Expected 404 but got $($response.StatusCode): $url"
            $failed = $true
        } catch {
            $statusCode = $null
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
            if ($statusCode -eq 404) {
                Write-Host "OK 404 $url"
            } else {
                Write-Error "Expected 404 but request failed: $url - $($_.Exception.Message)"
                $failed = $true
            }
        }
    }

    if ($failed) {
        throw "Verification failed."
    }
}

$repoRoot = Resolve-RepoRoot
$configFullPath = Join-Path $repoRoot $ConfigPath
if (-not (Test-Path $configFullPath)) {
    throw "Config not found: $configFullPath"
}

$config = Get-Content -Path $configFullPath -Raw | ConvertFrom-Json
$workDirFullPath = Join-Path $repoRoot $WorkDir
New-Item -ItemType Directory -Path $workDirFullPath -Force | Out-Null

if ($config.publicRoot -and $Mode -notin @("Verify", "Restore")) {
    $npmCommand = if ($IsWindows) { "npm.cmd" } else { "npm" }
    & $npmCommand run build:site
    if ($LASTEXITCODE -ne 0) {
        throw "Eleventy site build failed. Run npm ci before packaging."
    }
}

if ($UseFileZillaConfig) {
    Set-ConnectionFromFileZilla
}

if ($Mode -eq "Verify") {
    Invoke-Verification -Config $config
    exit 0
}

if ($Mode -eq "Restore") {
    throw "Restore is disabled for this migration because it can reintroduce retired TOOL/PDF.js files."
}

$package = New-DeployPackage -RepoRoot $repoRoot -Config $config -WorkDirPath $workDirFullPath
Write-Host "Package: $($package.PackagePath)"
Write-Host "Manifest: $($package.ManifestPath)"
Write-Host "Manifest evidence: $($package.EvidencePath)"
Write-Host "Manifest SHA-256: $($package.ManifestSha256)"
Write-Host "Files: $($package.FileCount)"

Assert-DeployContract -Package $package -Config $config

if ($Mode -eq "RestoreSafe") {
    throw "RestoreSafe is disabled until a sanitized pre-change backup format and remote restoration procedure are independently validated."
}

$excludedChecks = @("data/chatwork.sqlite", "issue_body.md", "issue_comment_body.md", "pr_body.md")
$manifestText = Get-Content -Path $package.ManifestPath
foreach ($path in $excludedChecks) {
    if ($manifestText -contains $path) {
        throw "Excluded path was included in package: $path"
    }
    Write-Host "Excluded check passed: $path"
}

if ($Mode -eq "Audit") {
    Invoke-ContentAudit -Package $package -RemoteDirectory (Get-RemoteDir)
    exit 0
}

if ($Mode -eq "Package" -or $Mode -eq "DryRun") {
    Write-Host "Dry run complete. No files were uploaded."
    exit 0
}

$target = Get-SshTarget
$remoteDirValue = Get-RemoteDir
Assert-RemoteInput -Directory $remoteDirValue
$releaseId = "abroad-o-public-$($package.Stamp)"
$remotePackageForScp = "~/$releaseId.tgz"
$remoteBackupName = "abroad-o-before-$($package.Stamp).tgz"
$remoteBackupPath = "/home/$UserName/abroad-o-backups/$remoteBackupName"

if ($Mode -in @("Preflight", "Stage", "Promote", "Deploy")) {
    Invoke-RemotePreflight -Package $package -RemoteDirectory $remoteDirValue -Config $config
}

if ($Mode -eq "Preflight") {
    exit 0
}

$scpArgs = Get-ScpArgs
if ($Mode -in @("Stage", "Deploy")) {
    & scp @scpArgs $package.PackagePath "${target}:$remotePackageForScp"
    if ($LASTEXITCODE -ne 0) {
        throw "scp failed while uploading deployment package."
    }
    $remotePackagePath = Assert-RemoteStage -Package $package -ReleaseId $releaseId
    Write-Host "Stage completed: release=$releaseId manifestSha256=$($package.ManifestSha256)"
    if ($Mode -eq "Stage") {
        exit 0
    }
}

if ($Mode -eq "Promote") {
    $remotePackagePath = Get-VerifiedStagedPackage -Package $package -ReleaseId $StagedReleaseId
}
Invoke-RemotePromote -Package $package -RemoteDirectory $remoteDirValue -RemotePackage $remotePackagePath -RemoteBackup $remoteBackupPath -Config $config
Invoke-Verification -Config $config
