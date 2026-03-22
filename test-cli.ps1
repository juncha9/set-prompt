# set-prompt CLI 통합 테스트
# 실행: .\test-cli.ps1

$CLI     = "npx tsx src/index.ts"
$Repo    = "$env:TEMP\sp-test-repo-$(Get-Random)"
$Pass    = 0
$Fail    = 0

function ok($label) { Write-Host "  [PASS] $label" -ForegroundColor Green; $script:Pass++ }
function ng($label) { Write-Host "  [FAIL] $label" -ForegroundColor Red;   $script:Fail++ }

function Run($args_str, $stdin = $null) {
    if ($stdin) {
        $result = ($stdin | Invoke-Expression "$CLI $args_str" 2>&1) | Out-String
    } else {
        $result = (Invoke-Expression "$CLI $args_str" 2>&1) | Out-String
    }
    return @{ output = $result; exit = $LASTEXITCODE }
}

Write-Host "`n===== set-prompt CLI 통합 테스트 =====" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $Repo | Out-Null
Write-Host "임시 repo: $Repo`n"


# ─── check ────────────────────────────────────────────────────────────────────
Write-Host "[ check ]" -ForegroundColor Yellow

$r = Run "check `"$Repo`" --force"
if ((Test-Path "$Repo\SET_PROMPT_GUIDE.md") -and (Test-Path "$Repo\skills") -and (Test-Path "$Repo\commands")) {
    ok "check --force: repo 구조 생성"
} else {
    ng "check --force: repo 구조 생성 실패`n$($r.output)"
}

$before = (Get-Item "$Repo\SET_PROMPT_GUIDE.md").LastWriteTime
$r = Run "check `"$Repo`" --force"
$after = (Get-Item "$Repo\SET_PROMPT_GUIDE.md").LastWriteTime
if ($after -gt $before) {
    ok "check --force: SET_PROMPT_GUIDE.md 덮어쓰기"
} else {
    ng "check --force: SET_PROMPT_GUIDE.md 덮어쓰기 실패"
}

$r = Run "check"
if ($r.output -match "required|error|Path" -or $r.exit -ne 0) {
    ok "check (path 미지정): 오류 반환"
} else {
    ng "check (path 미지정): 오류 반환 실패`n$($r.output)"
}


# ─── load ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ load ]" -ForegroundColor Yellow

$r = Run "load `"$Repo`"" "y"
if ($r.exit -eq 0) {
    ok "load <local-path>: 등록 성공"
} else {
    ng "load <local-path>: 등록 실패`n$($r.output)"
}

$r = Run "load `"$Repo\nonexistent`""
if ($r.output -match "does not exist|error|invalid" -or $r.exit -ne 0) {
    ok "load <없는 경로>: 오류 반환"
} else {
    ng "load <없는 경로>: 오류 반환 실패`n$($r.output)"
}


# ─── validate ─────────────────────────────────────────────────────────────────
Write-Host "`n[ validate ]" -ForegroundColor Yellow

$r = Run "validate `"$Repo`""
if ($r.output -match "valid") {
    ok "validate <유효한 repo>: valid 결과 출력"
} else {
    ng "validate <유효한 repo>: valid 결과 없음`n$($r.output)"
}

$empty = "$env:TEMP\sp-test-empty-$(Get-Random)"
New-Item -ItemType Directory -Path $empty | Out-Null
$r = Run "validate `"$empty`""
if ($r.output -match "invalid|missing") {
    ok "validate <빈 디렉터리>: invalid 결과 출력"
} else {
    ng "validate <빈 디렉터리>: invalid 결과 없음`n$($r.output)"
}
Remove-Item -Recurse -Force $empty


# ─── use ──────────────────────────────────────────────────────────────────────
Write-Host "`n[ use ]" -ForegroundColor Yellow

$r = Run "use claude-code" "n"
if ($r.exit -eq 0) {
    ok "use claude-code: 실행 완료"
} else {
    ng "use claude-code: 실패`n$($r.output)"
}

$r = Run "use unknown-agent"
if ($r.output -match "Unknown|unknown|error" -or $r.exit -ne 0) {
    ok "use <알 수 없는 agent>: 오류 반환"
} else {
    ng "use <알 수 없는 agent>: 오류 반환 실패`n$($r.output)"
}


# ─── unload ───────────────────────────────────────────────────────────────────
Write-Host "`n[ unload ]" -ForegroundColor Yellow

$r = Run "unload" "y"
if ($r.exit -eq 0) {
    ok "unload: 실행 완료"
} else {
    ng "unload: 실패`n$($r.output)"
}


# ─── 정리 & 결과 ──────────────────────────────────────────────────────────────
Remove-Item -Recurse -Force $Repo -ErrorAction SilentlyContinue

Write-Host "`n===== 결과: PASS $Pass / FAIL $Fail =====" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Red" })
if ($Fail -gt 0) { exit 1 }
