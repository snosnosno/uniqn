#!/bin/bash

# T-HOLDEM Git 히스토리 정리 스크립트
# 민감한 파일을 Git 히스토리에서 완전히 제거합니다.

echo "🔒 T-HOLDEM Git 히스토리 정리 시작..."
echo "⚠️  경고: 이 작업은 Git 히스토리를 다시 작성합니다!"
echo "⚠️  반드시 백업을 먼저 수행하세요!"
echo ""
read -p "계속하시겠습니까? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "작업이 취소되었습니다."
    exit 1
fi

# 백업 생성
echo "📦 백업 생성 중..."
git branch backup-before-cleaning

# 제거할 파일 목록
FILES_TO_REMOVE=(
    "serviceAccountKey.json"
    "serviceAccountKey*.json"
    "*-service-account.json"
    "*-service-account-*.json"
    "*-adminsdk-*.json"
    "scripts/t-holdem-firebase-adminsdk-*.json"
    "scripts/archive/*-adminsdk-*.json"
    "*.key"
    "*.pem"
    "*.cert"
)

echo "🗑️ 민감한 파일 제거 중..."

# 각 파일 패턴에 대해 filter-branch 실행
for pattern in "${FILES_TO_REMOVE[@]}"
do
    echo "  - $pattern 제거 중..."
    git filter-branch --force --index-filter \
        "git rm --cached --ignore-unmatch $pattern" \
        --prune-empty --tag-name-filter cat -- --all 2>/dev/null || true
done

echo "🧹 Git 정리 중..."

# Git 가비지 컬렉션
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ Git 히스토리 정리 완료!"
echo ""
echo "⚠️  중요: 다음 단계를 수행하세요:"
echo "1. 변경사항 확인: git log --oneline"
echo "2. 강제 푸시 필요: git push --force --all"
echo "3. 팀원들에게 알림: 모든 팀원이 새로 clone 해야 함"
echo ""
echo "💡 문제가 발생한 경우:"
echo "   git checkout backup-before-cleaning"
echo "   으로 백업 브랜치로 돌아갈 수 있습니다."