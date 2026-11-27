<#
.SYNOPSIS
  Runs the developer agent (OpenAI Codex CLI) task by task, each task in a fresh session
  (clean context), until the milestone is done, the agent needs the author,
  or the session limit is reached.

.DESCRIPTION
  After every session the script reads the state line in docs/progress.md
  ("**<label>:** continue | milestone-done | needs-author"):
    continue        -> start the next session
    milestone-done  -> stop: read the milestone report in docs/reports/
    needs-author    -> stop: see the "waiting for the author" section in docs/progress.md
  The final message of every session is saved to .agent-logs/ (ignored by git).

  Requires: Codex CLI logged in, and network access for the sandbox in ~/.codex/config.toml:
    [sandbox_workspace_write]
    network_access = true

  Another agent CLI: replace the single "codex exec" line below with its non-interactive command.

.EXAMPLE
  .\scripts\agent-loop.ps1
  .\scripts\agent-loop.ps1 -MaxSessions 3
#>
param(
  [int]$MaxSessions = 20
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$progressFile = Join-Path $repoRoot 'docs\progress.md'
$logDir = Join-Path $repoRoot '.agent-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# English on purpose: Windows PowerShell 5.1 may garble non-ASCII command-line arguments.
# AGENTS.md tells the agent to talk to the author in Russian.
$prompt = 'Read AGENTS.md and docs/progress.md. Do exactly one task (the next one in docs/progress.md) following the task cycle in AGENTS.md, then update the state in docs/progress.md and finish. Reply to the author in Russian.'

function Get-AgentState {
  $line = Select-String -Path $progressFile -Pattern '^\*\*.+:\*\*\s*`?(continue|milestone-done|needs-author)`?' | Select-Object -First 1
  if (-not $line) { return 'unknown' }
  return $line.Matches[0].Groups[1].Value
}

$state = Get-AgentState
if ($state -ne 'continue') {
  Write-Host "State in docs/progress.md is '$state', not 'continue'." -ForegroundColor Yellow
  Write-Host "Read the latest report in docs/reports/ or the questions in docs/progress.md, then set the state to 'continue'." -ForegroundColor Yellow
  exit 0
}

for ($i = 1; $i -le $MaxSessions; $i++) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $lastMessage = Join-Path $logDir "$stamp-last-message.md"
  Write-Host ""
  Write-Host "=== Session $i of $MaxSessions ($stamp) ===" -ForegroundColor Cyan

  codex exec --sandbox workspace-write -o $lastMessage $prompt

  if ($LASTEXITCODE -ne 0) {
    Write-Warning "The agent exited with code $LASTEXITCODE. Stopping. See $lastMessage"
    exit $LASTEXITCODE
  }

  $state = Get-AgentState
  Write-Host "State after session: $state" -ForegroundColor Cyan

  if ($state -ne 'continue') {
    Write-Host ""
    Write-Host "Stopped: $state" -ForegroundColor Green
    if (Test-Path $lastMessage) { Get-Content -Path $lastMessage -Encoding UTF8 }
    exit 0
  }
}

Write-Host "Reached the limit of $MaxSessions sessions. Run the script again to continue." -ForegroundColor Yellow