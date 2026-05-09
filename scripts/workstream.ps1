[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("claim", "heartbeat", "shared-touch", "handoff", "done", "release", "show")]
    [string]$Action = "show",
    [string]$Id,
    [string]$Task,
    [string[]]$Paths,
    [string]$Status,
    [string]$Notes,
    [string]$Agent,
    [string]$Branch,
    [string]$Commit,
    [string]$Verify,
    [int]$Tail = 20,
    [switch]$ActiveOnly,
    [string]$LedgerPath
)

<#
.SYNOPSIS
Append and inspect shared workstream markers for concurrent repo work.

.EXAMPLE
./scripts/workstream.ps1 claim -Id ws-settings-cleanup -Task "Consolidate settings cards" -Paths packages/views/settings/**

.EXAMPLE
./scripts/workstream.ps1 heartbeat -Id ws-settings-cleanup -Notes "Updated card spacing and copy"

.EXAMPLE
./scripts/workstream.ps1 show -ActiveOnly

.EXAMPLE
./scripts/workstream.ps1 show -Paths packages/views/search/search-command.tsx
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
if (-not $LedgerPath) {
    $LedgerPath = Join-Path $repoRoot ".codex/workstreams.jsonl"
}

function New-Utf8Encoding {
    return [System.Text.UTF8Encoding]::new($false)
}

function Ensure-Ledger {
    $ledgerDir = Split-Path -Path $LedgerPath -Parent
    if (-not (Test-Path -LiteralPath $ledgerDir)) {
        New-Item -ItemType Directory -Path $ledgerDir | Out-Null
    }

    if (-not (Test-Path -LiteralPath $LedgerPath)) {
        [System.IO.File]::WriteAllText($LedgerPath, "", (New-Utf8Encoding))
    }
}

function Get-GitOutput {
    param(
        [string[]]$Args
    )

    $result = & git -C $repoRoot @Args 2>$null
    if ($LASTEXITCODE -eq 0) {
        return ($result -join "`n").Trim()
    }

    return $null
}

function Read-Events {
    if (-not (Test-Path -LiteralPath $LedgerPath)) {
        return @()
    }

    $lines = Get-Content -LiteralPath $LedgerPath | Where-Object { $_.Trim() }
    if (-not $lines) {
        return @()
    }

    $sequence = 0
    return @(
        $lines | ForEach-Object {
            $event = $_ | ConvertFrom-Json
            Add-Member -InputObject $event -NotePropertyName "_seq" -NotePropertyValue $sequence -Force
            $sequence += 1
            $event
        }
    )
}

function Resolve-AgentName {
    if ($Agent) {
        return $Agent
    }

    foreach ($name in @("CODEX_AGENT_NAME", "CLAUDE_CODE_AGENT", "CLAUDECODE_AGENT", "USERNAME")) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value) {
            return $value
        }
    }

    return "unknown-agent"
}

function Resolve-StatusValue {
    param(
        [string]$EventName,
        [string]$ExplicitStatus
    )

    if ($ExplicitStatus) {
        return $ExplicitStatus
    }

    switch ($EventName) {
        "claim" { return "active" }
        "heartbeat" { return "active" }
        "shared-touch" { return "active" }
        "handoff" { return "handoff" }
        "done" { return "done" }
        "release" { return "released" }
        default { return "active" }
    }
}

function Normalize-Paths {
    param(
        [object]$Value
    )

    if ($null -eq $Value) {
        return @()
    }

    return @(
        $Value |
            ForEach-Object { "$_".Trim() } |
            Where-Object { $_ }
    )
}

function Get-LatestEvent {
    param(
        [object[]]$Events,
        [string]$WorkstreamId
    )

    if (-not @($Events).Count) {
        return $null
    }

    return $Events |
        Where-Object { $_.id -eq $WorkstreamId } |
        Sort-Object _seq |
        Select-Object -Last 1
}

function Get-EventValue {
    param(
        [object]$Event,
        [string]$Name
    )

    if (-not $Event) {
        return $null
    }

    $property = $Event.PSObject.Properties[$Name]
    if ($property) {
        return $property.Value
    }

    return $null
}

function Append-Event {
    param(
        [hashtable]$Event
    )

    $json = $Event | ConvertTo-Json -Compress -Depth 5
    [System.IO.File]::AppendAllText($LedgerPath, $json + [Environment]::NewLine, (New-Utf8Encoding))
}

function Format-PathsCell {
    param(
        [object]$Value
    )

    return (Normalize-Paths $Value) -join "; "
}

function Test-PathMatch {
    param(
        [string[]]$CandidatePaths,
        [string[]]$FilterPaths
    )

    $normalizedCandidates = Normalize-Paths $CandidatePaths
    $normalizedFilters = Normalize-Paths $FilterPaths

    if (-not @($normalizedFilters).Count) {
        return $true
    }

    foreach ($filterPath in $normalizedFilters) {
        foreach ($candidatePath in $normalizedCandidates) {
            if ($candidatePath -like "*$filterPath*" -or $filterPath -like "*$candidatePath*") {
                return $true
            }
        }
    }

    return $false
}

function Show-Events {
    $events = @(Read-Events)
    if (-not @($events).Count) {
        Write-Host "No workstream events recorded."
        return
    }

    if ($Id) {
        $selected = @(
            $events |
                Where-Object { $_.id -eq $Id } |
                Where-Object { Test-PathMatch -CandidatePaths (Get-EventValue -Event $_ -Name "paths") -FilterPaths $Paths } |
                Sort-Object _seq
        )
        if (-not $selected) {
            Write-Host "No events found for workstream '$Id'."
            return
        }

        $selected |
            Select-Object ts, id, agent, event, status, task,
                @{ Name = "paths"; Expression = { Format-PathsCell $_.paths } },
                notes, branch, commit, verify |
            Format-Table -Wrap -AutoSize
        return
    }

    $selected = @($events |
        Group-Object id |
        ForEach-Object { $_.Group | Sort-Object _seq | Select-Object -Last 1 })

    if ($ActiveOnly) {
        $selected = $selected | Where-Object { $_.status -in @("active", "handoff") }
    }

    if (@($Paths).Count) {
        $selected = @(
            $selected |
                Where-Object { Test-PathMatch -CandidatePaths (Get-EventValue -Event $_ -Name "paths") -FilterPaths $Paths }
        )
    }

    if (-not @($selected).Count) {
        Write-Host "No workstream events matched the requested filters."
        return
    }

    $selected |
        Sort-Object ts -Descending |
        Select-Object -First $Tail |
        Select-Object ts, id, agent, event, status, task,
            @{ Name = "paths"; Expression = { Format-PathsCell $_.paths } },
            notes, branch |
        Format-Table -Wrap -AutoSize
}

if ($Action -eq "show") {
    Show-Events
    exit 0
}

Ensure-Ledger
$events = @(Read-Events)

if (-not $Id) {
    throw "Id is required for '$Action'."
}

$previous = Get-LatestEvent -Events $events -WorkstreamId $Id
$resolvedTask = if ($Task) { $Task } elseif ($previous) { "$(Get-EventValue -Event $previous -Name 'task')" } else { $null }
$resolvedPaths = if ($Paths) { Normalize-Paths $Paths } elseif ($previous) { Normalize-Paths (Get-EventValue -Event $previous -Name 'paths') } else { @() }
$previousBranch = Get-EventValue -Event $previous -Name "branch"
$resolvedBranch = if ($Branch) { $Branch } elseif ($previousBranch) { "$previousBranch" } else { Get-GitOutput -Args @("rev-parse", "--abbrev-ref", "HEAD") }

if (-not $resolvedTask) {
    throw "Task is required for '$Action'. Pass -Task or reuse an existing workstream id."
}

if (-not @($resolvedPaths).Count) {
    throw "Paths are required for '$Action'. Pass -Paths or reuse an existing workstream id."
}

if ($Action -eq "done" -and -not $Commit) {
    $Commit = Get-GitOutput -Args @("rev-parse", "--short", "HEAD")
}

$event = [ordered]@{
    ts = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"
    id = $Id
    agent = Resolve-AgentName
    event = $Action
    task = $resolvedTask
    paths = $resolvedPaths
    status = Resolve-StatusValue -EventName $Action -ExplicitStatus $Status
}

if ($resolvedBranch) {
    $event.branch = $resolvedBranch
}

if ($Notes) {
    $event.notes = $Notes
}

if ($Commit) {
    $event.commit = $Commit
}

if ($Verify) {
    $event.verify = $Verify
}

Append-Event -Event $event
Write-Host "Recorded $Action for $Id -> $LedgerPath"
