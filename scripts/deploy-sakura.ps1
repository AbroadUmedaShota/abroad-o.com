param(
    [ValidateSet("Package", "DryRun", "Deploy", "Verify", "Restore")]
    [string]$Mode = "DryRun",

    [string]$ConfigPath = "deploy/sakura-public-files.json",
    [string]$WorkDir = ".deploy/sakura",
    [string]$HostName = $env:SAKURA_HOST,
    [string]$UserName = $env:SAKURA_USER,
    [string]$RemoteDir = $env:SAKURA_REMOTE_DIR,
    [string]$SshKeyPath = $env:SAKURA_SSH_KEY_PATH,
    [int]$Port = $(if ($env:SAKURA_PORT) { [int]$env:SAKURA_PORT } else { 22 }),
    [string]$BackupFile = $env:SAKURA_BACKUP_FILE,
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

    if (Test-Path $stagingDir) {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

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

    $manifest = Get-ChildItem -LiteralPath $stagingDir -Recurse -File -Force |
        ForEach-Object { [IO.Path]::GetRelativePath($stagingDir, $_.FullName).Replace("\", "/") } |
        Sort-Object
    $manifest | Set-Content -Path $manifestPath -Encoding UTF8

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
        FileCount = $manifest.Count
        Stamp = $stamp
    }
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
    $args = @("-p", "$Port", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new")
    if ($SshKeyPath) {
        $args += @("-i", $SshKeyPath)
    }
    return $args
}

function Get-ScpArgs {
    $args = @("-P", "$Port", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new")
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
    & cmd.exe /c "type `"$scriptPath`" | ssh $($sshArgs -join ' ') $target ""sh -s"""
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed."
    }
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

if ($UseFileZillaConfig) {
    Set-ConnectionFromFileZilla
}

if ($Mode -eq "Verify") {
    Invoke-Verification -Config $config
    exit 0
}

if ($Mode -eq "Restore") {
    if (-not $BackupFile) {
        throw "BackupFile or SAKURA_BACKUP_FILE is required for Restore."
    }
    $remoteDirValue = Get-RemoteDir
    $restoreScript = @"
set -eu
REMOTE_DIR='$remoteDirValue'
BACKUP_FILE='$BackupFile'
if [ ! -f "`$BACKUP_FILE" ]; then
  echo "Backup file not found: `$BACKUP_FILE" >&2
  exit 1
fi
mkdir -p "`$REMOTE_DIR"
find "`$REMOTE_DIR" -maxdepth 1 -type f -name '*.html' -delete
rm -rf "`$REMOTE_DIR/css" "`$REMOTE_DIR/fonts" "`$REMOTE_DIR/image" "`$REMOTE_DIR/js" "`$REMOTE_DIR/news" "`$REMOTE_DIR/pdfjs" "`$REMOTE_DIR/slick" "`$REMOTE_DIR/TOOL"
rm -f "`$REMOTE_DIR/.htaccess" "`$REMOTE_DIR/sitemap.xml" "`$REMOTE_DIR/global.css" "`$REMOTE_DIR/style.css" "`$REMOTE_DIR/style2.css" "`$REMOTE_DIR/style3.css"
tar -xzf "`$BACKUP_FILE" -C "`$REMOTE_DIR"
echo "Restored from `$BACKUP_FILE"
"@
    Invoke-RemoteScript -Script $restoreScript
    exit 0
}

$package = New-DeployPackage -RepoRoot $repoRoot -Config $config -WorkDirPath $workDirFullPath
Write-Host "Package: $($package.PackagePath)"
Write-Host "Manifest: $($package.ManifestPath)"
Write-Host "Files: $($package.FileCount)"

$excludedChecks = @("docs/TOOL_USAGE.md", "data/chatwork.sqlite", "issue_body.md", "issue_comment_body.md", "pr_body.md")
$manifestText = Get-Content -Path $package.ManifestPath
foreach ($path in $excludedChecks) {
    if ($manifestText -contains $path) {
        throw "Excluded path was included in package: $path"
    }
    Write-Host "Excluded check passed: $path"
}

if ($Mode -eq "Package" -or $Mode -eq "DryRun") {
    Write-Host "Dry run complete. No files were uploaded."
    exit 0
}

$target = Get-SshTarget
$remoteDirValue = Get-RemoteDir
$remotePackageName = "abroad-o-public-$($package.Stamp).tgz"
$remotePackageForScp = "~/$remotePackageName"
$remoteBackupName = "abroad-o-before-$($package.Stamp).tgz"

$scpArgs = Get-ScpArgs
& scp @scpArgs $package.PackagePath "${target}:$remotePackageForScp"
if ($LASTEXITCODE -ne 0) {
    throw "scp failed while uploading deployment package."
}

$deployScript = @"
set -eu
REMOTE_DIR='$remoteDirValue'
REMOTE_PACKAGE="`$HOME/$remotePackageName"
REMOTE_BACKUP="`$HOME/abroad-o-backups/$remoteBackupName"
TMP_DIR=`$(mktemp -d "`$HOME/abroad-o-deploy.XXXXXX")
mkdir -p "`$REMOTE_DIR" "`$(dirname "`$REMOTE_BACKUP")"
tar -czf "`$REMOTE_BACKUP" -C "`$REMOTE_DIR" .
tar -xzf "`$REMOTE_PACKAGE" -C "`$TMP_DIR"
find "`$REMOTE_DIR" -maxdepth 1 -type f -name '*.html' -delete
rm -rf "`$REMOTE_DIR/css" "`$REMOTE_DIR/fonts" "`$REMOTE_DIR/image" "`$REMOTE_DIR/js" "`$REMOTE_DIR/news" "`$REMOTE_DIR/pdfjs" "`$REMOTE_DIR/slick" "`$REMOTE_DIR/TOOL"
rm -f "`$REMOTE_DIR/.htaccess" "`$REMOTE_DIR/sitemap.xml" "`$REMOTE_DIR/global.css" "`$REMOTE_DIR/style.css" "`$REMOTE_DIR/style2.css" "`$REMOTE_DIR/style3.css"
cp -Rp "`$TMP_DIR/." "`$REMOTE_DIR/"
rm -rf "`$TMP_DIR" "`$REMOTE_PACKAGE"
echo "Backup: `$REMOTE_BACKUP"
"@

Invoke-RemoteScript -Script $deployScript
Invoke-Verification -Config $config
