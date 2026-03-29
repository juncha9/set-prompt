# set-prompt CLI integration test
# Run: .\test-cli.ps1

$CLI     = "npx tsx src/index.ts"
$Repo    = "$env:TEMP\sp-test-repo-$(Get-Random)"
$Pass    = 0
$Fail    = 0

function ok($label) { Write-Host "  [PASS] $label" -ForegroundColor Green; $script:Pass++ }
function ng($label) { Write-Host "  [FAIL] $label" -ForegroundColor Red;   $script:Fail++ }

function Run($args_str, $stdin = $null) {
    if ($stdin) {
        $lines = $stdin -split "`n"
        $echos = ($lines | ForEach-Object { "echo $_" }) -join " & "
        $result = (cmd /c "($echos) | $CLI $args_str" 2>&1) | Out-String
    } else {
        $result = (Invoke-Expression "$CLI $args_str" 2>&1) | Out-String
    }
    return @{ output = $result; exit = $LASTEXITCODE }
}

Write-Host "`n===== set-prompt CLI integration test =====" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $Repo | Out-Null
Write-Host "Temp repo: $Repo`n"


# ─── scaffold ────────────────────────────────────────────────────────────────────
Write-Host "[ scaffold ]" -ForegroundColor Yellow

$r = Run "scaffold `"$Repo`" --force"
if ((Test-Path "$Repo\SET_PROMPT_GUIDE.md") -and (Test-Path "$Repo\skills") -and (Test-Path "$Repo\commands")) {
    ok "scaffold --force: repo structure created"
} else {
    ng "scaffold --force: repo structure creation failed`n$($r.output)"
}

$before = (Get-Item "$Repo\SET_PROMPT_GUIDE.md").LastWriteTime
$r = Run "scaffold `"$Repo`" --force"
$after = (Get-Item "$Repo\SET_PROMPT_GUIDE.md").LastWriteTime
if ($after -gt $before) {
    ok "scaffold --force: SET_PROMPT_GUIDE.md overwritten"
} else {
    ng "scaffold --force: SET_PROMPT_GUIDE.md overwrite failed"
}

$r = Run "scaffold"
if ($r.output -match "required|error|Path" -or $r.exit -ne 0) {
    ok "scaffold (no path): error returned"
} else {
    ng "scaffold (no path): error not returned`n$($r.output)"
}


# ─── install ──────────────────────────────────────────────────────────────────
Write-Host "`n[ install ]" -ForegroundColor Yellow

$r = Run "install `"$Repo`"" "y"
if ($r.exit -eq 0) {
    ok "install <local-path>: registered successfully"
} else {
    ng "install <local-path>: registration failed`n$($r.output)"
}

$r = Run "install `"$Repo\nonexistent`""
if ($r.output -match "does not exist|error|invalid" -or $r.exit -ne 0) {
    ok "install <non-existent path>: error returned"
} else {
    ng "install <non-existent path>: error not returned`n$($r.output)"
}


$empty = "$env:TEMP\sp-test-empty-$(Get-Random)"
New-Item -ItemType Directory -Path $empty | Out-Null
$r = Run "scaffold `"$empty`""
if ($r.output -match "missing|Created|valid") {
    ok "scaffold <empty dir>: structure reported"
} else {
    ng "scaffold <empty dir>: unexpected output`n$($r.output)"
}
Remove-Item -Recurse -Force $empty


# ─── link ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ link ]" -ForegroundColor Yellow

$r = Run "link claude-code" "n"
if ($r.exit -eq 0) {
    ok "link claude-code: completed"
} else {
    ng "link claude-code: failed`n$($r.output)"
}

$r = Run "link unknown-agent"
if ($r.output -match "Unknown|unknown|error" -or $r.exit -ne 0) {
    ok "link <unknown agent>: error returned"
} else {
    ng "link <unknown agent>: error not returned`n$($r.output)"
}


# ─── uninstall ────────────────────────────────────────────────────────────────
Write-Host "`n[ uninstall ]" -ForegroundColor Yellow

$r = Run "uninstall" "y"
if ($r.exit -eq 0) {
    ok "uninstall: completed"
} else {
    ng "uninstall: failed`n$($r.output)"
}


# ─── cleanup & result ─────────────────────────────────────────────────────────
Remove-Item -Recurse -Force $Repo -ErrorAction SilentlyContinue

Write-Host "`n===== Result: PASS $Pass / FAIL $Fail =====" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Red" })
if ($Fail -gt 0) { exit 1 }
