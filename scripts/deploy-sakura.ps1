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
    [string]$BackupArchiveSha256 = $env:SAKURA_RESTORE_ARCHIVE_SHA256,
    [string]$BackupManifestSha256 = $env:SAKURA_RESTORE_MANIFEST_SHA256,
    [string]$StagedReleaseId = $env:SAKURA_STAGED_RELEASE_ID,
    [switch]$RestoreApply,
    [switch]$UseFileZillaConfig
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "lib/sakura-restore-contract.psm1") -Force

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

    $pathManifestSha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $evidenceSha256 = (Get-FileHash -LiteralPath $evidencePath -Algorithm SHA256).Hash.ToLowerInvariant()
    [pscustomobject]@{
        StagingDir = $stagingDir
        PackagePath = $packagePath
        ManifestPath = $manifestPath
        EvidencePath = $evidencePath
        PathManifestSha256 = $pathManifestSha256
        EvidenceSha256 = $evidenceSha256
        # Backward-compatible alias for prior console output; it is the content evidence SHA-256.
        ManifestSha256 = $evidenceSha256
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
    (cd "`$REMOTE_DIR" && find "`$prefix" -type f -print) >> "`$deletable"
  fi
done < "`$delete_prefixes"
(cd "`$REMOTE_DIR" && find . -type f -print | sed 's#^\./##' | LC_ALL=C sort) > "`$actual"
snapshot_bytes=0
while IFS= read -r path; do
  [ -n "`$path" ] || continue
  if [ -f "`$REMOTE_DIR/`$path" ]; then
    bytes=`$(wc -c < "`$REMOTE_DIR/`$path" | tr -d ' ')
    snapshot_bytes=`$((snapshot_bytes + bytes))
  fi
done < "`$expected"
available=`$(df -Pk "`$REMOTE_DIR" | awk 'NR == 2 { print `$4 * 1024 }')
test -n "`$available"
largest_tree="`$snapshot_bytes"
if [ "`$STAGING_BYTES" -gt "`$largest_tree" ]; then largest_tree="`$STAGING_BYTES"; fi
required=`$((PACKAGE_BYTES + 2 * largest_tree + 20971520))
if [ "`$required" -lt "`$MINIMUM_FREE_BYTES" ]; then required="`$MINIMUM_FREE_BYTES"; fi
if [ "`$available" -lt "`$required" ]; then
  echo "Insufficient free space: available=`$available required=`$required snapshotBytes=`$snapshot_bytes bytes" >&2
  exit 1
fi
cat "`$expected" "`$deletable" | LC_ALL=C sort -u > "`$allowed"
unknown=`$(comm -23 "`$actual" "`$allowed" || true)
unknown_count=`$(printf '%s\n' "`$unknown" | sed '/^`$/d' | wc -l | tr -d ' ')
if [ "`$unknown_count" -gt 0 ]; then
  echo "Remote unmanaged files will be preserved: unknownCount=`$unknown_count"
  printf '%s\n' "`$unknown" | awk -F/ 'NF { count[`$1]++ } END { for (name in count) printf "Remote unmanaged top-level: %s count=%s\\n", name, count[name] }' | LC_ALL=C sort
fi
echo "Preflight passed: freeBytes=`$available requiredBytes=`$required snapshotBytes=`$snapshot_bytes unknownCount=`$unknown_count pathManifestSha256=$($Package.PathManifestSha256) evidenceSha256=$($Package.EvidenceSha256)"
"@
    Invoke-RemoteScript -Script $script
}

function Invoke-RemotePromote {
    param([object]$Package, [string]$RemoteDirectory, [string]$RemotePackage, [string]$RemoteBackup, [object]$Config)

    $manifestBody = (Get-Content -LiteralPath $Package.ManifestPath) -join "`n"
    $deletePrefixBody = (@($Config.deletePrefixes) -join "`n")
    $protectedPathsBody = (@($Config.protectedPaths | ForEach-Object { "{0} {1} {2}" -f $_.sha256.ToLowerInvariant(), $_.bytes, $_.path }) -join "`n")
    $archiveRoot = [string]$Config.restoreContract.archiveRoot
    $backupDirectory = [string]$Config.restoreContract.backupDirectory
    $remoteRestoreLibrary = Get-Content -LiteralPath (Join-Path $PSScriptRoot "lib/sakura-restore-remote.sh") -Raw
    $promoteArchiveFault = if ($env:SAKURA_LOCAL_PROMOTE_CORRUPT_BACKUP -eq "1" -and $env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE -eq "1") {
        'printf ''codex-invalid-backup'' >> "$REMOTE_BACKUP"'
    } else {
        ''
    }
    $script = @"
set -eu
REMOTE_DIR='$RemoteDirectory'
REMOTE_PACKAGE='$RemotePackage'
REMOTE_BACKUP='$RemoteBackup'
BACKUP_DIRECTORY='$backupDirectory'
ARCHIVE_ROOT='$archiveRoot'
DEPLOYMENT_PATH_MANIFEST_SHA='$($Package.PathManifestSha256)'
DEPLOYMENT_EVIDENCE_SHA='$($Package.EvidenceSha256)'
STAGE_DIR=`$(mktemp -d "`$HOME/abroad-o-stage.XXXXXX")
cleanup() { rm -rf "`$STAGE_DIR"; }
trap cleanup EXIT
test -f "`$REMOTE_PACKAGE"
test "`$(realpath -e "`$REMOTE_DIR")" = "`$REMOTE_DIR"
test "`$(realpath -e "`$(dirname "`$REMOTE_BACKUP")")" = "`$(dirname "`$REMOTE_BACKUP")" || { echo 'Backup directory has a symlink component.' >&2; exit 1; }
if [ -e "`$REMOTE_BACKUP" ] || [ -L "`$REMOTE_BACKUP" ]; then echo 'Backup destination already exists or is a symlink; refusing promote.' >&2; exit 1; fi
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
test "`$(dirname "`$REMOTE_BACKUP")" = "`$BACKUP_DIRECTORY"
BACKUP_STAGE=`$(mktemp -d "`$HOME/abroad-o-backup.XXXXXX")
backup_verified=0
backup_cleanup() {
  rm -rf "`$BACKUP_STAGE"
  if [ "`$backup_verified" != 1 ]; then rm -f "`$REMOTE_BACKUP"; fi
}
trap 'cleanup; backup_cleanup' EXIT
mkdir -p "`$BACKUP_STAGE/`$ARCHIVE_ROOT/payload"
protected_paths="`$BACKUP_STAGE/protected-paths"
find "`$REMOTE_DIR" -type l -print -quit | grep -q . && { echo 'Remote directory contains a symlink before backup.' >&2; exit 1; }
cat > "`$protected_paths" <<'CODEX_PROTECTED_PATHS'
$protectedPathsBody
CODEX_PROTECTED_PATHS
while IFS= read -r path; do
  [ -n "`$path" ] || continue
  case "`$path" in /*|*'..'*|*'\'*|*"`n"*|*"`r"*) echo "Unsafe manifest path: `$path" >&2; exit 1;; esac
  if [ -f "`$REMOTE_DIR/`$path" ]; then
    mkdir -p "`$BACKUP_STAGE/`$ARCHIVE_ROOT/payload/`$(dirname "`$path")"
    cp -p "`$REMOTE_DIR/`$path" "`$BACKUP_STAGE/`$ARCHIVE_ROOT/payload/`$path"
  fi
done <<'CODEX_CURRENT_MANIFEST'
$manifestBody
CODEX_CURRENT_MANIFEST
while IFS=' ' read -r expected_hash expected_bytes path; do
  [ -n "`$path" ] || continue
  case "`$path" in pdfjs/1c_abroad.pdf|pdfjs/2c_abroad.pdf|pdfjs/4c_abroad.pdf) ;; *) echo "Invalid protected PDF: `$path" >&2; exit 1;; esac
  test -f "`$REMOTE_DIR/`$path"
  actual_bytes=`$(wc -c < "`$REMOTE_DIR/`$path" | tr -d ' ')
  actual_hash=`$(sha256sum "`$REMOTE_DIR/`$path" | awk '{print `$1}')
  test "`$actual_bytes" = "`$expected_bytes" && test "`$actual_hash" = "`$expected_hash"
  mkdir -p "`$BACKUP_STAGE/`$ARCHIVE_ROOT/payload/pdfjs"
  cp -p "`$REMOTE_DIR/`$path" "`$BACKUP_STAGE/`$ARCHIVE_ROOT/payload/`$path"
done < "`$protected_paths"
(cd "`$BACKUP_STAGE/`$ARCHIVE_ROOT/payload" && find . -type f -print | sed 's#^\./##' | LC_ALL=C sort | while IFS= read -r path; do sha256sum "`$path"; done) > "`$BACKUP_STAGE/`$ARCHIVE_ROOT/manifest.txt"
test -s "`$BACKUP_STAGE/`$ARCHIVE_ROOT/manifest.txt"
manifest_sha=`$(sha256sum "`$BACKUP_STAGE/`$ARCHIVE_ROOT/manifest.txt" | awk '{print `$1}')
printf '%s  manifest.txt\n' "`$manifest_sha" > "`$BACKUP_STAGE/`$ARCHIVE_ROOT/manifest.sha256"
printf '{"formatVersion":1,"archiveRoot":"%s","remotePublicRoot":"%s","deploymentPathManifestSha256":"%s","deploymentEvidenceSha256":"%s"}\n' "`$ARCHIVE_ROOT" "`$REMOTE_DIR" "`$DEPLOYMENT_PATH_MANIFEST_SHA" "`$DEPLOYMENT_EVIDENCE_SHA" > "`$BACKUP_STAGE/`$ARCHIVE_ROOT/metadata.json"
mkdir -p "`$BACKUP_DIRECTORY"
tar -czf "`$REMOTE_BACKUP" -C "`$BACKUP_STAGE" "`$ARCHIVE_ROOT"
archive_sha=`$(sha256sum "`$REMOTE_BACKUP" | awk '{print `$1}')
$promoteArchiveFault
VERIFY_STAGE=`$(mktemp -d "`$HOME/abroad-o-backup-verify.XXXXXX")
verify_cleanup() { rm -rf "`$VERIFY_STAGE"; }
trap 'cleanup; backup_cleanup; verify_cleanup' EXIT
test "`$(realpath -e "`$REMOTE_BACKUP")" = "`$REMOTE_BACKUP"
$remoteRestoreLibrary
validate_sanitized_archive "`$REMOTE_BACKUP" "`$VERIFY_STAGE" "`$archive_sha" "`$manifest_sha" "`$ARCHIVE_ROOT" "`$REMOTE_DIR" "`$DEPLOYMENT_PATH_MANIFEST_SHA" "`$DEPLOYMENT_EVIDENCE_SHA"
tar -tzf "`$REMOTE_BACKUP" | awk -v root="`$ARCHIVE_ROOT" '
  /^\// || /(^|\/)\.\.($|\/)/ || /\\/ { bad = 1 }
  `$0 != root "/" && `$0 != root "/payload/" && `$0 != root "/manifest.txt" && `$0 != root "/manifest.sha256" && `$0 != root "/metadata.json" && index(`$0, root "/payload/") != 1 { bad = 1 }
  END { exit bad }'
test -z "`$(tar -tvzf "`$REMOTE_BACKUP" | awk 'substr(`$1, 1, 1) == "l" || substr(`$1, 1, 1) == "h" { print; exit }')"
tar -xzf "`$REMOTE_BACKUP" -C "`$VERIFY_STAGE"
test "`$(sha256sum "`$VERIFY_STAGE/`$ARCHIVE_ROOT/manifest.txt" | awk '{print `$1}')" = "`$manifest_sha"
test "`$(cat "`$VERIFY_STAGE/`$ARCHIVE_ROOT/manifest.sha256")" = "`$manifest_sha  manifest.txt"
expected_metadata=`$(printf '{"formatVersion":1,"archiveRoot":"%s","remotePublicRoot":"%s","deploymentPathManifestSha256":"%s","deploymentEvidenceSha256":"%s"}' "`$ARCHIVE_ROOT" "`$REMOTE_DIR" "`$DEPLOYMENT_PATH_MANIFEST_SHA" "`$DEPLOYMENT_EVIDENCE_SHA")
test "`$(tr -d '\r\n' < "`$VERIFY_STAGE/`$ARCHIVE_ROOT/metadata.json")" = "`$expected_metadata"
test -z "`$(find "`$VERIFY_STAGE/`$ARCHIVE_ROOT" -type l -print -quit)"
awk -v verify_payload="`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload" '
  length(`$0) < 67 || substr(`$0, 1, 64) !~ /^[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]/ || substr(`$0, 65, 2) != "  " { exit 1 }
  { path = substr(`$0, 67); if (path in seen) exit 1; seen[path] = 1; if (path ~ /^TOOL\// || path == "pdfjs/LICENSE" || path ~ /^pdfjs\/(build|web)\// || path !~ /^[A-Za-z0-9._\/@+-]+$/) exit 1; command = "test -f \"" verify_payload "/" path "\" && sha256sum \"" verify_payload "/" path "\""; command | getline line; close(command); split(line, fields, " "); if (fields[1] != substr(`$0, 1, 64)) exit 1 }
  END { if (NR == 0) exit 1 }' "`$VERIFY_STAGE/`$ARCHIVE_ROOT/manifest.txt"
while IFS=' ' read -r expected_hash expected_bytes path; do
  test -f "`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload/`$path"
  test "`$(wc -c < "`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload/`$path" | tr -d ' ')" = "`$expected_bytes"
  test "`$(sha256sum "`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload/`$path" | awk '{print `$1}')" = "`$expected_hash"
done < "`$protected_paths"
test ! -e "`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload/TOOL" && test ! -e "`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload/pdfjs/build" && test ! -e "`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload/pdfjs/web" && test ! -e "`$VERIFY_STAGE/`$ARCHIVE_ROOT/payload/pdfjs/LICENSE"
echo "Sanitized backup: archiveSha256=`$archive_sha manifestSha256=`$manifest_sha"
backup_verified=1
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
echo "Promote completed: backup=`$REMOTE_BACKUP pathManifestSha256=$($Package.PathManifestSha256) evidenceSha256=$($Package.EvidenceSha256)"
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
printf '%s  %s  %s\n' "`$archive_sha" '$($Package.PathManifestSha256)' '$($Package.EvidenceSha256)' > "`$METADATA"
printf '%s\n' "`$PACKAGE"
"@
    $remotePackage = (Invoke-RemoteScriptOutput -Script $script | Select-Object -Last 1).Trim()
    if ($remotePackage -notmatch '^/home/') { throw "Remote stage did not return an absolute package path." }
    Write-Host "Stage SHA-256 verified: $localPackageHash pathManifestSha256=$($Package.PathManifestSha256) evidenceSha256=$($Package.EvidenceSha256) release=$ReleaseId"
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
read archive_sha path_manifest_sha evidence_sha < "`$METADATA"
test "`$path_manifest_sha" = '$($Package.PathManifestSha256)'
test "`$evidence_sha" = '$($Package.EvidenceSha256)'
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
    $scriptPath = Join-Path $workDirFullPath "remote-script.sh"
    $normalizedScript = ($Script -replace "`r`n", "`n") -replace "`r", "`n"
    [System.IO.File]::WriteAllText($scriptPath, $normalizedScript, [System.Text.UTF8Encoding]::new($false))
    if ($env:SAKURA_VALIDATE_REMOTE_SCRIPT -eq "1") {
        $normalizedScript | & bash -n -
        if ($LASTEXITCODE -ne 0) { throw "Generated remote shell syntax validation failed." }
        Write-Host "Generated remote shell syntax passed."
        return
    }
    # Contract tests execute the exact generated remote script locally. This hook is
    # deliberately opt-in and is never set by deployment workflows.
    if ($env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE -eq "1") {
        if ($env:SAKURA_LOCAL_REMOTE_SCRIPT_MARKER) {
            [System.IO.File]::AppendAllText($env:SAKURA_LOCAL_REMOTE_SCRIPT_MARKER, "invoke`n", [System.Text.UTF8Encoding]::new($false))
        }
        $normalizedScript | & bash -s
        if ($LASTEXITCODE -ne 0) {
            throw "Local remote-script contract execution failed."
        }
        return
    }
    $target = Get-SshTarget
    $sshArgs = Get-SshArgs
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
    $scriptPath = Join-Path $workDirFullPath "remote-audit.sh"
    $normalizedScript = ($Script -replace "`r`n", "`n") -replace "`r", "`n"
    [System.IO.File]::WriteAllText($scriptPath, $normalizedScript, [System.Text.UTF8Encoding]::new($false))
    if ($env:SAKURA_VALIDATE_REMOTE_SCRIPT -eq "1") {
        $normalizedScript | & bash -n -
        if ($LASTEXITCODE -ne 0) { throw "Generated remote shell syntax validation failed." }
        Write-Host "Generated remote shell syntax passed."
        return @()
    }
    if ($env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE -eq "1") {
        if ($env:SAKURA_LOCAL_REMOTE_SCRIPT_MARKER) {
            [System.IO.File]::AppendAllText($env:SAKURA_LOCAL_REMOTE_SCRIPT_MARKER, "invoke-output`n", [System.Text.UTF8Encoding]::new($false))
        }
        $output = $normalizedScript | & bash -s
        if ($LASTEXITCODE -ne 0) {
            throw "Local remote-script output contract execution failed."
        }
        return @($output)
    }
    $target = Get-SshTarget
    $sshArgs = Get-SshArgs
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

function Invoke-RemoteSanitizedRestore {
    param(
        [object]$Package,
        [string]$RemoteDirectory,
        [string]$RemoteArchive,
        [string]$ExpectedArchiveSha256,
        [string]$ExpectedManifestSha256,
        [object]$Config,
        [switch]$Apply
    )

    if (-not $RemoteArchive -or $RemoteArchive -notmatch '^/[A-Za-z0-9_./-]+$' -or $RemoteArchive.Contains('..') -or $RemoteArchive.Contains("`r") -or $RemoteArchive.Contains("`n")) { throw "RestoreSafe requires a safe absolute backup archive path." }
    if ($ExpectedArchiveSha256 -notmatch '^[0-9a-fA-F]{64}$' -or $ExpectedManifestSha256 -notmatch '^[0-9a-fA-F]{64}$') { throw "RestoreSafe requires the expected archive and manifest SHA-256 values." }
    if ($RemoteDirectory -ne [string]$Config.restoreContract.remotePublicRoot) { throw "RestoreSafe only supports the fixed configured public root." }
    $backupDirectory = [string]$Config.restoreContract.backupDirectory
    if (-not $RemoteArchive.StartsWith("$backupDirectory/", [StringComparison]::Ordinal) -or $RemoteArchive -notmatch '/abroad-o-before-[A-Za-z0-9._-]+\.sra\.tgz$') { throw "RestoreSafe archive must be a versioned sanitized archive in the configured backup directory." }

    $currentManifestBody = (Get-Content -LiteralPath $Package.ManifestPath) -join "`n"
    $managedRootsBody = (@($Config.managedRootFiles) -join "`n")
    $managedDirectoriesBody = (@($Config.managedDirectories) -join "`n")
    $protectedPathsBody = (@($Config.protectedPaths | ForEach-Object { "{0} {1} {2}" -f $_.sha256.ToLowerInvariant(), $_.bytes, $_.path }) -join "`n")
    $archiveRoot = [string]$Config.restoreContract.archiveRoot
    $applyFlag = if ($Apply) { "1" } else { "0" }
    $remoteRestoreLibrary = Get-Content -LiteralPath (Join-Path $PSScriptRoot "lib/sakura-restore-remote.sh") -Raw
    $script = @"
set -eu
REMOTE_DIR='$RemoteDirectory'
REMOTE_ARCHIVE='$RemoteArchive'
EXPECTED_ARCHIVE_SHA='$($ExpectedArchiveSha256.ToLowerInvariant())'
EXPECTED_MANIFEST_SHA='$($ExpectedManifestSha256.ToLowerInvariant())'
EXPECTED_DEPLOYMENT_PATH_MANIFEST_SHA='$($Package.PathManifestSha256)'
EXPECTED_DEPLOYMENT_EVIDENCE_SHA='$($Package.EvidenceSha256)'
ARCHIVE_ROOT='$archiveRoot'
APPLY='$applyFlag'
RESTORE_STAGE=`$(mktemp -d "`$HOME/abroad-o-restore.XXXXXX")
cleanup_restore() { rm -rf "`$RESTORE_STAGE"; }
trap cleanup_restore EXIT
test -d "`$REMOTE_DIR" && test ! -L "`$REMOTE_DIR"
test "`$(realpath -e "`$REMOTE_DIR")" = "`$REMOTE_DIR"
find "`$REMOTE_DIR" -type l -print -quit | grep -q . && { echo 'Restore target contains a symlink; refusing restore.' >&2; exit 1; }
test -f "`$REMOTE_ARCHIVE" && test ! -L "`$REMOTE_ARCHIVE"
test "`$(realpath -e "`$REMOTE_ARCHIVE")" = "`$REMOTE_ARCHIVE"
test "`$(realpath -e "`$(dirname "`$REMOTE_ARCHIVE")")" = "`$(dirname "`$REMOTE_ARCHIVE")"
$remoteRestoreLibrary
validate_sanitized_archive "`$REMOTE_ARCHIVE" "`$RESTORE_STAGE" "`$EXPECTED_ARCHIVE_SHA" "`$EXPECTED_MANIFEST_SHA" "`$ARCHIVE_ROOT" "`$REMOTE_DIR" "`$EXPECTED_DEPLOYMENT_PATH_MANIFEST_SHA" "`$EXPECTED_DEPLOYMENT_EVIDENCE_SHA"
actual_archive_sha=`$(sha256sum "`$REMOTE_ARCHIVE" | awk '{print `$1}')
test "`$actual_archive_sha" = "`$EXPECTED_ARCHIVE_SHA"
unsafe_entries=`$(tar -tzf "`$REMOTE_ARCHIVE" | awk '/^\// || /(^|\/)\.\.($|\/)/ || /\\/ { print; exit }')
test -z "`$unsafe_entries"
archive_links=`$(tar -tvzf "`$REMOTE_ARCHIVE" | awk 'substr(`$1, 1, 1) == "l" || substr(`$1, 1, 1) == "h" { print; exit }')
test -z "`$archive_links"
tar -xzf "`$REMOTE_ARCHIVE" -C "`$RESTORE_STAGE"
test -d "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload"
test -f "`$RESTORE_STAGE/`$ARCHIVE_ROOT/manifest.txt" && test -f "`$RESTORE_STAGE/`$ARCHIVE_ROOT/manifest.sha256" && test -f "`$RESTORE_STAGE/`$ARCHIVE_ROOT/metadata.json"
actual_manifest_sha=`$(sha256sum "`$RESTORE_STAGE/`$ARCHIVE_ROOT/manifest.txt" | awk '{print `$1}')
test "`$actual_manifest_sha" = "`$EXPECTED_MANIFEST_SHA"
test "`$(cat "`$RESTORE_STAGE/`$ARCHIVE_ROOT/manifest.sha256")" = "`$actual_manifest_sha  manifest.txt"
expected_metadata=`$(printf '{"formatVersion":1,"archiveRoot":"%s","remotePublicRoot":"%s","deploymentPathManifestSha256":"%s","deploymentEvidenceSha256":"%s"}' "`$ARCHIVE_ROOT" "`$REMOTE_DIR" "`$EXPECTED_DEPLOYMENT_PATH_MANIFEST_SHA" "`$EXPECTED_DEPLOYMENT_EVIDENCE_SHA")
test "`$(tr -d '\r\n' < "`$RESTORE_STAGE/`$ARCHIVE_ROOT/metadata.json")" = "`$expected_metadata"
managed_roots="`$RESTORE_STAGE/managed-roots"
managed_directories="`$RESTORE_STAGE/managed-directories"
protected_paths="`$RESTORE_STAGE/protected-paths"
current_manifest="`$RESTORE_STAGE/current-manifest"
previous_manifest="`$RESTORE_STAGE/`$ARCHIVE_ROOT/manifest.txt"
cat > "`$managed_roots" <<'CODEX_MANAGED_ROOTS'
$managedRootsBody
CODEX_MANAGED_ROOTS
cat > "`$managed_directories" <<'CODEX_MANAGED_DIRECTORIES'
$managedDirectoriesBody
CODEX_MANAGED_DIRECTORIES
cat > "`$protected_paths" <<'CODEX_PROTECTED_PATHS'
$protectedPathsBody
CODEX_PROTECTED_PATHS
cat > "`$current_manifest" <<'CODEX_CURRENT_MANIFEST'
$currentManifestBody
CODEX_CURRENT_MANIFEST
is_managed() {
  path="`$1"
  case "`$path" in TOOL/*|pdfjs/LICENSE|pdfjs/build/*|pdfjs/web/*|/*|*'..'*|*'\\'*) return 1;; esac
  case "`$path" in pdfjs/1c_abroad.pdf|pdfjs/2c_abroad.pdf|pdfjs/4c_abroad.pdf) return 0;; pdfjs/*) return 1;; esac
  case "`$path" in */*) top=`${path%%/*}; grep -Fxq "`$top" "`$managed_directories";; *) grep -Fxq "`$path" "`$managed_roots";; esac
}
manifest_has_path() {
  candidate="`$1"
  awk -v path="`$candidate" 'length(`$0) == 66 + length(path) && substr(`$0, 1, 64) ~ /^[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]/ && substr(`$0, 65, 2) == "  " && substr(`$0, 67) == path { found = 1 } END { exit !found }' "`$previous_manifest"
}
archive_payload_entries="`$RESTORE_STAGE/archive-payload-entries"
(cd "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload" && find . -type f -print | sed 's#^\./##' | LC_ALL=C sort) > "`$archive_payload_entries"
test -z "`$(sort "`$archive_payload_entries" | uniq -d)"
manifest_paths="`$RESTORE_STAGE/manifest-paths"
manifest_hashes="`$RESTORE_STAGE/manifest-hashes"
: > "`$manifest_paths"
: > "`$manifest_hashes"
while IFS= read -r line || [ -n "`$line" ]; do
  printf '%s\n' "`$line" | grep -Eq '^[0-9a-f]{64}  [A-Za-z0-9._/@+-]+$' || { echo 'Invalid restore manifest line.' >&2; exit 1; }
  path=`${line#*  }
  is_managed "`$path" || { echo "Unmanaged restore path: `$path" >&2; exit 1; }
  printf '%s\n' "`$path" >> "`$manifest_paths"
  printf '%s\t%s\n' "`$path" "`${line%%  *}" >> "`$manifest_hashes"
done < "`$previous_manifest"
test -s "`$manifest_paths"
test -z "`$(sort "`$manifest_paths" | uniq -d)"
test "`$(LC_ALL=C sort "`$archive_payload_entries")" = "`$(LC_ALL=C sort "`$manifest_paths")"
cut -d ' ' -f 3- "`$previous_manifest" | while IFS= read -r path; do
  test -f "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload/`$path"
  expected=`$(awk -F '\t' -v path="`$path" '`$1 == path { print `$2 }' "`$manifest_hashes")
  test -n "`$expected"
  actual=`$(sha256sum "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload/`$path" | awk '{print `$1}')
  test "`$expected" = "`$actual"
  printf 'RESTORE %s\n' "`$path"
done
while IFS=' ' read -r expected_hash expected_bytes path; do
  test -f "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload/`$path"
  test "`$(wc -c < "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload/`$path" | tr -d ' ')" = "`$expected_bytes"
  test "`$(sha256sum "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload/`$path" | awk '{print `$1}')" = "`$expected_hash"
done < "`$protected_paths"
while IFS= read -r path; do
  [ -n "`$path" ] || continue
  is_managed "`$path" || { echo "Current manifest has unmanaged restore path: `$path" >&2; exit 1; }
  if ! manifest_has_path "`$path"; then printf 'DELETE_NEW_ONLY %s\n' "`$path"; fi
done < "`$current_manifest"
if [ "`$APPLY" != 1 ]; then
  echo 'RestoreSafe dry run complete. No files were changed.'
  exit 0
fi
cut -d ' ' -f 3- "`$previous_manifest" | while IFS= read -r path; do
  mkdir -p "`$(dirname "`$REMOTE_DIR/`$path")"
  cp -p "`$RESTORE_STAGE/`$ARCHIVE_ROOT/payload/`$path" "`$REMOTE_DIR/`$path"
done
while IFS= read -r path; do
  [ -n "`$path" ] || continue
  if ! manifest_has_path "`$path"; then rm -f "`$REMOTE_DIR/`$path"; fi
done < "`$current_manifest"
echo 'RestoreSafe apply completed.'
"@
    Invoke-RemoteScript -Script $script
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
$configFullPath = if ([IO.Path]::IsPathRooted($ConfigPath)) { [IO.Path]::GetFullPath($ConfigPath) } else { Join-Path $repoRoot $ConfigPath }
if (-not (Test-Path $configFullPath)) {
    throw "Config not found: $configFullPath"
}

$config = Get-Content -Path $configFullPath -Raw | ConvertFrom-Json
Assert-SakuraRestoreConfig -Config $config
$workDirFullPath = if ([IO.Path]::IsPathRooted($WorkDir)) { [IO.Path]::GetFullPath($WorkDir) } else { Join-Path $repoRoot $WorkDir }
New-Item -ItemType Directory -Path $workDirFullPath -Force | Out-Null

if ($config.publicRoot -and $Mode -notin @("Verify", "Restore") -and $env:SAKURA_VALIDATE_REMOTE_SCRIPT -ne "1" -and $env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE -ne "1") {
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
Write-Host "Path manifest SHA-256: $($package.PathManifestSha256)"
Write-Host "Content evidence SHA-256: $($package.EvidenceSha256)"
Write-Host "Files: $($package.FileCount)"

Assert-DeployContract -Package $package -Config $config

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
$configuredPublicRoot = [string]$config.restoreContract.remotePublicRoot
if ($remoteDirValue -ne $configuredPublicRoot) {
    throw "Configured SAKURA_REMOTE_DIR must exactly match the fixed restore contract public root."
}

if ($Mode -eq "RestoreSafe") {
    Invoke-RemoteSanitizedRestore -Package $package -RemoteDirectory $remoteDirValue -RemoteArchive $BackupFile -ExpectedArchiveSha256 $BackupArchiveSha256 -ExpectedManifestSha256 $BackupManifestSha256 -Config $config -Apply:$RestoreApply
    exit 0
}

$releaseId = "abroad-o-public-$($package.Stamp)"
$remotePackageForScp = "~/$releaseId.tgz"
$remoteBackupName = "abroad-o-before-$($package.Stamp).sra.tgz"
$remoteBackupPath = "$([string]$config.restoreContract.backupDirectory)/$remoteBackupName"

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
    Write-Host "Stage completed: release=$releaseId pathManifestSha256=$($package.PathManifestSha256) evidenceSha256=$($package.EvidenceSha256)"
    if ($Mode -eq "Stage") {
        exit 0
    }
}

if ($Mode -eq "Promote") {
    $remotePackagePath = Get-VerifiedStagedPackage -Package $package -ReleaseId $StagedReleaseId
}
Invoke-RemotePromote -Package $package -RemoteDirectory $remoteDirValue -RemotePackage $remotePackagePath -RemoteBackup $remoteBackupPath -Config $config
if ($env:SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE -ne "1") {
    Invoke-Verification -Config $config
}
