<#
  Cut a GitHub release for any mod whose source declares a version newer than
  the one published.

  The mods are .NET Framework projects built by the Roslyn compiler in each
  repo's tools\ folder, against the ScriptHookVDotNet3.dll from the GTA V
  install on this machine. Neither is on a cloud runner, so the nightly cloud
  routine can only ever report that a release is due -- this is the half that
  has to run here.

  What it does, per repo:

    reads    src\<Name>\Core\Log.cs         for  public const string Version
    asks     gh release view                for  the published tag
    builds   .\build.ps1 -Package [-Full]   if the first is ahead of the second
    creates  the release, zips attached, the -full one first so the site's
             download button points at the bundle that needs nothing else

  It will not release a repo with uncommitted changes or unpushed commits: a
  release tag names a commit, and a tag on a commit nobody else has is a
  download nobody can rebuild. Those are reported and skipped.

  Nothing here bumps a version. The source is the authority; this only
  publishes what the source already says.

  Usage:
    .\release-mods.ps1              # release whatever is behind
    .\release-mods.ps1 -WhatIf      # say what it would do, do nothing
    .\release-mods.ps1 -Only fumes  # one repo
#>
[CmdletBinding()]
param(
    [switch]$WhatIf,
    [string[]]$Only,
    # the folder the mod repos sit in; this script lives in one of them
    [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'

# repo -> the pretty name the zips are built under, and whether build.ps1
# knows -Full (a bundle carrying ScriptHookVDotNet for people who have none)
$MODS = [ordered]@{
    'hoodrich'       = @{ zip = 'PostedUp';       full = $true  }
    'bare-minimum'   = @{ zip = 'BareMinimum';    full = $true  }
    'fumes'          = @{ zip = 'Fumes';          full = $false }
    'overspray'      = @{ zip = 'Overspray';      full = $true  }
    'five0patrol'    = @{ zip = 'Five0Patrol';    full = $false }
    'vehicle-tweaks' = @{ zip = 'VehicleTweaks';  full = $false }
    'bloodymess'     = @{ zip = 'BloodyMess';     full = $false }
    'franklin-rp'    = @{ zip = 'FranklinRP';     full = $false }
    'weapon-tweaks'  = @{ zip = 'WeaponTweaks';   full = $false }
}

function Say($msg, $colour = 'Gray') { Write-Host $msg -ForegroundColor $colour }

function Get-DeclaredVersion($repo) {
    $log = Get-ChildItem (Join-Path $repo 'src\*\Core\Log.cs') -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $log) { return $null }
    $m = [regex]::Match((Get-Content $log.FullName -Raw), 'Version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"')
    if ($m.Success) { return $m.Groups[1].Value }
    return $null
}

function Get-PublishedTag($slug) {
    $t = & gh release view -R "defthrets/$slug" --json tagName --jq .tagName 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $t) { return $null }
    return $t.Trim()
}

# "v0.4.2" and "0.4.2" are the same release; the repos are not consistent and
# it does not matter which they use, only that we compare like with like
function Same($a, $b) { return ($a -replace '^v', '') -eq ($b -replace '^v', '') }

# The notes a release goes out with, in the order they are worth having:
# whatever the repo prepared for this version, then its changelog entry,
# then a plain line that at least says what the file is.
function Get-Notes($repo, $version, $name) {
    foreach ($p in @("release\notes-$version.md", "release\CHANGELOG-$version.txt", "release\CHANGELOG-$version.md")) {
        $f = Join-Path $repo $p
        if (Test-Path $f) { return (Get-Content $f -Raw) }
    }
    return @"
$name $version.

Unzip and drop the contents into your GTA V folder. Requires ScriptHookV and
ScriptHookVDotNet 3; one build runs on Legacy and Enhanced. No asset
replacement, no .rpf edits.

spitmux.me
"@
}

# Dot-source the file to get the helpers without the run -- which is how the
# checks below were tested against the real repos.
if ($MyInvocation.InvocationName -eq '.') { return }

# Nobody is watching a task that runs at half past three, so it leaves a
# record beside the script.
$logFile = Join-Path $PSScriptRoot 'release-mods.log'
function Note($line) {
    try { Add-Content -Path $logFile -Value $line -Encoding UTF8 } catch { }
}
Note ("=== {0} ===" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

$did = @(); $skipped = @(); $failed = @()

foreach ($slug in $MODS.Keys) {
    if ($Only -and $slug -notin $Only) { continue }
    $repo = Join-Path $Root $slug
    $cfg = $MODS[$slug]
    if (-not (Test-Path (Join-Path $repo 'build.ps1'))) { $skipped += "$slug (no build.ps1)"; continue }

    $version = Get-DeclaredVersion $repo
    if (-not $version) { $skipped += "$slug (declares no version)"; continue }

    $tag = Get-PublishedTag $slug
    if ($tag -and (Same $tag $version)) { Say ("  {0,-15} {1,-8} current" -f $slug, $version); continue }

    # a release names a commit, so the commit had better be somewhere else too
    Push-Location $repo
    try {
        $dirty = (& git status --porcelain) -ne $null
        & git fetch -q origin 2>$null
        $unpushed = @(& git log --oneline '@{u}..HEAD' 2>$null).Count
    } finally { Pop-Location }

    if ($dirty -or $unpushed -gt 0) {
        $why = @(); if ($dirty) { $why += 'uncommitted changes' }; if ($unpushed) { $why += "$unpushed unpushed commit(s)" }
        $skipped += ("{0} {1} -> {2}, but {3}" -f $slug, ($tag ?? 'none'), $version, ($why -join ' and '))
        Say ("  {0,-15} {1,-8} SKIP  {2}" -f $slug, $version, ($why -join ', ')) Yellow
        continue
    }

    Say ("  {0,-15} {1,-8} due  (published: {2})" -f $slug, $version, ($tag ?? 'none')) Cyan
    if ($WhatIf) { $did += "$slug -> $version (not run)"; continue }

    try {
        Push-Location $repo
        try {
            if ($cfg.full) { & .\build.ps1 -Package -Full | Out-Null } else { & .\build.ps1 -Package | Out-Null }
            if ($LASTEXITCODE -ne 0) { throw "build.ps1 exited $LASTEXITCODE" }
        } finally { Pop-Location }

        # the bundle first: it is the one the site links, and the one somebody
        # with nothing installed can actually use
        $zips = @()
        foreach ($n in @("$($cfg.zip)-$version-full.zip", "$($cfg.zip)-$version.zip")) {
            $f = Join-Path $repo "release\$n"
            if (Test-Path $f) { $zips += $f }
        }
        if (-not $zips) { throw "built, but no release\$($cfg.zip)-$version*.zip came out of it" }

        $notes = Get-Notes $repo $version $cfg.zip
        $notesFile = Join-Path $env:TEMP "notes-$slug-$version.md"
        Set-Content -Path $notesFile -Value $notes -Encoding UTF8

        # match whatever prefix the repo already uses, so its tags stay uniform
        $newTag = if ($tag -and $tag.StartsWith('v')) { "v$version" } elseif ($tag) { $version } else { "v$version" }

        & gh release create $newTag -R "defthrets/$slug" --title "$($cfg.zip) $version" --notes-file $notesFile @zips
        if ($LASTEXITCODE -ne 0) { throw "gh release create exited $LASTEXITCODE" }
        Remove-Item $notesFile -ErrorAction SilentlyContinue

        $did += ("{0} {1} ({2})" -f $slug, $newTag, (($zips | ForEach-Object { Split-Path $_ -Leaf }) -join ', '))
        Say ("  {0,-15} released {1}" -f $slug, $newTag) Green
    } catch {
        $failed += "$slug $version : $($_.Exception.Message)"
        Say ("  {0,-15} FAILED  {1}" -f $slug, $_.Exception.Message) Red
    }
}

# The site's own numbers, while we are here. How big each mod is comes out of
# the repos, not out of the site, and they grow with every commit -- a release
# that ships without this leaves the archive quoting last week's size. The
# release dates need no help: the page reads those from GitHub on every visit.
Say ''
Say 'site:' Cyan
try {
    # whatever python this machine calls it: a scheduled task does not
    # inherit the shell you happen to be typing in
    $py = (Get-Command python -ErrorAction SilentlyContinue).Source
    $rc = Join-Path $Root ('spitmux-mods' + [char]92 + 'recount.py')
    $argv = @($rc, '--write', '--push')
    if (-not $py) {
        $py = (Get-Command py -ErrorAction SilentlyContinue).Source
        $argv = @('-3') + $argv
    }
    if (-not $py) { throw 'no python on PATH' }
    $out = & $py @argv 2>&1
    $out | ForEach-Object { Say "  $_" }
    Note ('site: ' + (($out | Where-Object { $_ -match '\S' }) -join ' | '))
} catch {
    Say ("  recount failed: {0}" -f $_.Exception.Message) Red
    Note ("site: recount failed: {0}" -f $_.Exception.Message)
}

Say ''
if ($did)     { Say ("released: " + ($did -join '; ')) Green;      Note ("released: " + ($did -join '; ')) }
if ($skipped) { Say ("skipped:  " + ($skipped -join '; ')) Yellow;  Note ("skipped:  " + ($skipped -join '; ')) }
if ($failed)  { Say ("failed:   " + ($failed -join '; ')) Red;      Note ("failed:   " + ($failed -join '; ')) }
if (-not $did -and -not $failed) { Say 'nothing due.'; Note 'nothing due.' }

# keep the last few hundred lines and no more
try {
    $lines = Get-Content $logFile -ErrorAction Stop
    if ($lines.Count -gt 400) { Set-Content -Path $logFile -Value ($lines | Select-Object -Last 300) -Encoding UTF8 }
} catch { }

if ($failed) { exit 1 }
