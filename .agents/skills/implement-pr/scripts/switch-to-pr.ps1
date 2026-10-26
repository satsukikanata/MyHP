# PR のブランチに切り替えて、この周の specs/ のフォルダを調べる。
# 使い方(リポジトリの一番上のフォルダで):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/implement-pr/scripts/switch-to-pr.ps1 <PR の URL>
#   ブランチ名が分からないと言われたら、PR のページにあるブランチ名を付けて: ... <PR の URL> -Branch <ブランチ名>
# 最後の行が "RESULT: OK" なら成功。"RESULT: STOP" なら、その前の "STOP:" の行に止まった理由がある。

param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Pr,
    [string]$Branch = ""
)

function Invoke-Git {
    param([string[]]$GitArgs)
    $out = & git @GitArgs 2>&1 | ForEach-Object { "$_" }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Out = @($out) }
}

function Stop-Here {
    param([string]$Reason, [string[]]$Detail = @())
    Write-Output "STOP: $Reason"
    foreach ($line in $Detail) { if ($line) { Write-Output "  $line" } }
    Write-Output "RESULT: STOP"
    exit 1
}

# 1. PR の URL(または番号)を読む
$owner = ""; $repo = ""; $number = ""
if ($Pr -match '^https?://github\.com/([^/]+)/([^/]+)/pull/(\d+)') {
    $owner = $Matches[1]; $repo = $Matches[2]; $number = $Matches[3]
} elseif ($Pr -match '^#?(\d+)$') {
    $number = $Matches[1]
} else {
    Stop-Here "PR の URL の形ではない(https://github.com/<持ち主>/<リポジトリ>/pull/<番号>): $Pr"
}

$top = Invoke-Git @('rev-parse', '--show-toplevel')
if ($top.Code -ne 0) { Stop-Here "ここは Git のフォルダではない" $top.Out }
Set-Location -LiteralPath ($top.Out[0])

# 2. URL のリポジトリが、このフォルダのリポジトリ(origin)と同じか
$origin = Invoke-Git @('remote', 'get-url', 'origin')
if ($origin.Code -ne 0) { Stop-Here "GitHub のリポジトリ(origin)がつながっていない" $origin.Out }
$originUrl = $origin.Out[0]
if ($owner) {
    $want = "github.com[:/]$([regex]::Escape($owner))/$([regex]::Escape($repo))(\.git)?/?$"
    if ($originUrl -notmatch $want) {
        Stop-Here "PR のリポジトリ($owner/$repo)と、このフォルダのリポジトリが違う" @("このフォルダ: $originUrl")
    }
}

# 3. まだ commit していない変更が無いか(新しく足しただけのファイルは切り替えても残るので止めない)
$dirty = Invoke-Git @('status', '--porcelain', '--untracked-files=no')
if ($dirty.Out.Count -gt 0) {
    Stop-Here "まだ commit していない変更がある。切り替えると混ざるので、どうするか聞く" $dirty.Out
}

# 4. PR のブランチ名を調べる
$main = "main"
$head = Invoke-Git @('symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
if ($head.Code -eq 0 -and $head.Out[0] -match '^origin/(.+)$') { $main = $Matches[1] }

$fetch = Invoke-Git @('fetch', '--quiet', '--prune', 'origin')
if ($fetch.Code -ne 0) { Stop-Here "GitHub から最新を取ってこられない(ネットか、GitHub へのログイン)" $fetch.Out }

if (-not $Branch) {
    $pull = Invoke-Git @('ls-remote', 'origin', "refs/pull/$number/head")
    if ($pull.Code -ne 0 -or -not $pull.Out[0]) { Stop-Here "PR #$number が見つからない" $pull.Out }
    $sha = ($pull.Out[0] -split '\s+')[0]
    & git fetch --quiet origin "refs/pull/$number/head" 2>$null
    & git merge-base --is-ancestor $sha "origin/$main" 2>$null
    if ($LASTEXITCODE -eq 0) { Stop-Here "PR #$number はもう $main に入っている(作ることが残っていない)" }
    $heads = Invoke-Git @('ls-remote', '--heads', 'origin')
    $found = @()
    foreach ($line in $heads.Out) {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 2 -and $parts[0] -eq $sha) { $found += ($parts[1] -replace '^refs/heads/', '') }
    }
    if ($found.Count -ne 1) {
        Stop-Here "PR #$number のブランチ名が分からない(見つかった数: $($found.Count))。PR のページにあるブランチ名を聞き、-Branch <ブランチ名> を付けてもう一度動かす" $found
    }
    $Branch = $found[0]
}
if ($Branch -eq $main) { Stop-Here "ブランチが $main になっている。$main では作業しない" }

# 5. 切り替えて、GitHub の最新を取り込む
$local = Invoke-Git @('rev-parse', '--verify', '--quiet', "refs/heads/$Branch")
if ($local.Code -eq 0) {
    $sw = Invoke-Git @('switch', $Branch)
    if ($sw.Code -ne 0) { Stop-Here "ブランチ $Branch に切り替えられない" $sw.Out }
    $ff = Invoke-Git @('merge', '--ff-only', "origin/$Branch")
    if ($ff.Code -ne 0) {
        Stop-Here "手元の $Branch と GitHub の $Branch が食い違っていて、最新を取り込めない(GitHub 側で作り直された・手元だけの commit がある)。自分で直さずに聞く" $ff.Out
    }
} else {
    $sw = Invoke-Git @('switch', '-c', $Branch, '--track', "origin/$Branch")
    if ($sw.Code -ne 0) { Stop-Here "ブランチ $Branch に切り替えられない" $sw.Out }
}

# 6. もう main に入っていないか
& git merge-base --is-ancestor HEAD "origin/$main" 2>$null
if ($LASTEXITCODE -eq 0) { Stop-Here "この PR はもう $main に入っている(作ることが残っていない)" }

# 7. この PR で変わったファイルから、この周の specs/ のフォルダを探す
$diff = Invoke-Git @('diff', '--name-only', "origin/$main...HEAD")
$dirs = @($diff.Out | Where-Object { $_ -match '^specs/[^/]+/' } | ForEach-Object { ($_ -split '/')[0..1] -join '/' } | Sort-Object -Unique)
if ($dirs.Count -ne 1) {
    Stop-Here "この PR の specs/ のフォルダが1つに決まらない(見つかった数: $($dirs.Count))。どのフォルダか聞く" $dirs
}
$specDir = $dirs[0]

Write-Output "PR: #$number"
Write-Output "BRANCH: $Branch"
Write-Output "SPEC_DIR: $specDir/"
Write-Output "FILES_IN_SPEC_DIR:"
Get-ChildItem -LiteralPath $specDir -File | ForEach-Object { Write-Output "  $specDir/$($_.Name)" }
Write-Output "CHANGED_IN_PR:"
foreach ($f in $diff.Out) { Write-Output "  $f" }
Write-Output "RESULT: OK"
exit 0
