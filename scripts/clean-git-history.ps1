# T-HOLDEM Git 히스토리 정리 스크립트 (Windows PowerShell)
# 민감한 파일을 Git 히스토리에서 완전히 제거합니다.

Write-Host "[보안] T-HOLDEM Git 히스토리 정리 시작..." -ForegroundColor Cyan
Write-Host "[경고] 이 작업은 Git 히스토리를 다시 작성합니다!" -ForegroundColor Yellow
Write-Host "[경고] 반드시 백업을 먼저 수행하세요!" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "계속하시겠습니까? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "작업이 취소되었습니다." -ForegroundColor Red
    exit 1
}

# 백업 생성
Write-Host "[백업] 백업 생성 중..." -ForegroundColor Green
git branch backup-before-cleaning

# 제거할 파일 목록
$filesToRemove = @(
    "serviceAccountKey.json",
    "serviceAccountKey*.json",
    "*-service-account.json",
    "*-service-account-*.json",
    "*-adminsdk-*.json",
    "scripts/t-holdem-firebase-adminsdk-*.json",
    "scripts/archive/*-adminsdk-*.json",
    "*.key",
    "*.pem",
    "*.cert"
)

Write-Host "[제거] 민감한 파일 제거 중..." -ForegroundColor Yellow

# 각 파일 패턴에 대해 filter-branch 실행
foreach ($pattern in $filesToRemove) {
    Write-Host "  - $pattern 제거 중..." -ForegroundColor Gray
    $cmd = "git rm --cached --ignore-unmatch $pattern"
    git filter-branch --force --index-filter $cmd --prune-empty --tag-name-filter cat -- --all 2>$null
}

Write-Host "[정리] Git 정리 중..." -ForegroundColor Yellow

# Git 가비지 컬렉션
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host "[완료] Git 히스토리 정리 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "[중요] 다음 단계를 수행하세요:" -ForegroundColor Yellow
Write-Host "1. 변경사항 확인: git log --oneline" -ForegroundColor White
Write-Host "2. 강제 푸시 필요: git push --force --all" -ForegroundColor White
Write-Host "3. 팀원들에게 알림: 모든 팀원이 새로 clone 해야 함" -ForegroundColor White
Write-Host ""
Write-Host "문제가 발생한 경우:" -ForegroundColor Cyan
Write-Host "   git checkout backup-before-cleaning" -ForegroundColor White
Write-Host "   으로 백업 브랜치로 돌아갈 수 있습니다." -ForegroundColor White