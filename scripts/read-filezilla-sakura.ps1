$ErrorActionPreference = "Stop"

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

$paths = @(
    (Join-Path $env:APPDATA "FileZilla\filezilla.xml"),
    (Join-Path $env:APPDATA "FileZilla\sitemanager.xml"),
    (Join-Path $env:APPDATA "FileZilla\recentservers.xml")
)

$results = foreach ($path in $paths) {
    if (-not (Test-Path $path)) {
        continue
    }

    [xml]$xml = Get-Content -LiteralPath $path -Raw
    $nodes = @()
    $nodes += $xml.SelectNodes("//Server")
    $nodes += $xml.SelectNodes("//Tab")

    foreach ($node in $nodes) {
        $hostValue = [string]$node.Host
        if (-not $hostValue) {
            continue
        }

        $remoteValue = ConvertFrom-FileZillaPath ([string]($node.RemoteDir ?? $node.RemotePath))
        $suggestedRoot = $remoteValue
        if ($suggestedRoot -like "*/abroad-o.com/*") {
            $suggestedRoot = $suggestedRoot -replace "^(.*?/abroad-o\.com)/.*$", '$1'
        } elseif ($suggestedRoot -like "*/TOOL") {
            $suggestedRoot = (Split-Path -Path $suggestedRoot -Parent) -replace "\\", "/"
        }

        [pscustomobject]@{
            Source = Split-Path -Leaf $path
            Name = [string]($node.Name ?? $node.Site)
            Host = $hostValue
            User = [string]$node.User
            FileZillaProtocol = if ([string]$node.Protocol -eq "0") { "FTP" } elseif ([string]$node.Protocol -eq "1") { "SFTP" } else { [string]$node.Protocol }
            FileZillaPort = [string]$node.Port
            LastRemotePath = $remoteValue
            SuggestedRemoteDir = $suggestedRoot
            HasStoredPassword = [bool]$node.Pass
            HasKeyFile = [bool]$node.KeyFile
        }
    }
}

$results | Format-List
