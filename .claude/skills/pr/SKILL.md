---
name: pr
description: Pull Request 생성 자동화. PR 만들어줘, PR 생성, pull request 요청 시 활성화
allowed-tools: Bash, Read, Grep, Glob
---

# Pull Request 생성 스킬

현재 브랜치의 변경사항을 분석하여 PR을 생성합니다.

## PR 템플릿

```markdown
## Summary
<1-3줄 요약>

## Changes
- 변경사항 1
- 변경사항 2
- ...

## Test plan
- [ ] 테스트 항목 1
- [ ] 테스트 항목 2

## Screenshots (선택)
<UI 변경 시 스크린샷>

---
Generated with [Claude Code](https://claude.com/claude-code)
```

## 프로세스

### 1단계: 현재 상태 확인
```bash
# 현재 브랜치
git branch --show-current

# 원격 브랜치 상태
git status

# base 브랜치와 차이
git log master..HEAD --oneline
git diff master...HEAD --stat
```

### 2단계: 모든 커밋 분석
- 브랜치의 모든 커밋 메시지 확인
- 변경된 파일 목록 확인
- 주요 변경사항 파악

### 3단계: PR 제목 생성
- 커밋 타입 기반 (feat/fix/refactor 등)
- 핵심 변경사항 요약
- 50자 이내

### 4단계: PR 본문 작성
- Summary: 왜 이 변경이 필요한지
- Changes: 무엇이 변경되었는지
- Test plan: 어떻게 테스트하는지

### 5단계: PR 생성
```bash
# 원격에 푸시 (필요시)
git push -u origin <branch-name>

# PR 생성
gh pr create --title "제목" --body "$(cat <<'EOF'
## Summary
...

## Changes
...

## Test plan
...

---
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## PR 예시

### 기능 추가 PR
```markdown
## Summary
스태프 확정 시 개별 일정을 선택할 수 있는 기능을 추가합니다.
기존에는 모든 일정이 일괄 확정되었으나, 이제 원하는 일정만 선택 가능합니다.

## Changes
- ApplicantCard에 체크박스 UI 추가
- ApplicantConfirmModal에 선택된 일정 표시
- applicantManagementService에 부분 확정 로직 추가

## Test plan
- [ ] 지원자 카드에서 체크박스 선택/해제 확인
- [ ] 확정 모달에서 선택된 일정 목록 표시 확인
- [ ] 부분 확정 후 DB 상태 확인
- [ ] 다크모드에서 UI 확인
```

### 버그 수정 PR
```markdown
## Summary
Firebase에서 undefined 필드 저장 시 발생하는 에러를 수정합니다.

## Changes
- notes, assignmentGroupId 필드를 undefined 대신 null로 저장
- 타입 정의에 null 허용 추가

## Test plan
- [ ] 지원자 확정 시 에러 없이 저장되는지 확인
- [ ] Firestore에서 필드 값이 null로 저장되는지 확인
```

## 주의사항

- **base 브랜치 확인**: 올바른 브랜치를 대상으로 PR 생성
- **충돌 확인**: PR 생성 전 충돌 여부 확인
- **테스트 통과**: CI 테스트가 통과하는지 확인
- **리뷰어 지정**: 필요시 적절한 리뷰어 지정

## 추가 옵션

```bash
# 드래프트 PR
gh pr create --draft

# 특정 base 브랜치
gh pr create --base develop

# 라벨 추가
gh pr create --label "enhancement"

# 리뷰어 지정
gh pr create --reviewer username
```
