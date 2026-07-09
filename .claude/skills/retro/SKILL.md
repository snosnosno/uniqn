---
name: retro
description: 회고. retro, 회고, 리뷰, 이번 주, 작업 정리, 뭐했지 요청 시 활성화. gstack retro 기반 + Uniqn 특화.
allowed-tools: Read, Grep, Glob, Bash, Task
---

# 회고 스킬 (gstack retro + Uniqn 특화)

커밋 히스토리와 코드 변경을 분석하여 회고를 생성합니다.

## 프로젝트 컨텍스트

```yaml
커밋 컨벤션: <타입>(스코프): 한글 제목
타입: feat / fix / refactor / style / docs / test / chore / perf
스코프: mobile / functions / firestore / web
```

## 회고 프로세스

### 1단계: 커밋 히스토리 분석
```bash
# 최근 1주일 커밋
git log --oneline --since="1 week ago" --format="%h %s (%an, %ar)"
# 타입별 분류
git log --oneline --since="1 week ago" | grep -c "^[a-f0-9]* feat"
git log --oneline --since="1 week ago" | grep -c "^[a-f0-9]* fix"
git log --oneline --since="1 week ago" | grep -c "^[a-f0-9]* refactor"
# 변경 통계
git diff --stat HEAD~20 --shortstat
```

### 2단계: 변경 패턴 분석
```bash
# 가장 많이 변경된 파일
git log --since="1 week ago" --name-only --format="" | sort | uniq -c | sort -rn | head -10
# 가장 많이 변경된 디렉토리
git log --since="1 week ago" --name-only --format="" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -10
```

### 3단계: 코드 품질 트렌드

현재 상태 스냅샷:
```bash
cd uniqn-mobile
# any 타입 카운트
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | wc -l
# console.log 카운트
grep -rn "console\." src/ --include="*.ts" --include="*.tsx" | grep -v "test\|spec" | wc -l
# 800줄 초과 파일
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | awk '$1 > 800 {print}'
```

### 4단계: 회고 생성

## 출력 형식

```markdown
## 주간 회고 ([시작일] ~ [종료일])

### 작업 요약
- 총 커밋: [N]개
- feat: [N] / fix: [N] / refactor: [N] / 기타: [N]
- 변경 파일: [N]개 / 추가: [N]줄 / 삭제: [N]줄

### 주요 성과
1. [feat 커밋 기반 주요 기능]
2. [fix 커밋 기반 주요 수정]

### 기술 부채 변화
| 지표 | 지난 주 | 이번 주 | 변화 |
|------|---------|---------|------|
| any 타입 | - | [N] | - |
| console.log | - | [N] | - |
| 800줄+ 파일 | - | [N] | - |

### 가장 활발한 영역
[가장 많이 변경된 디렉토리/파일 TOP 5]

### 교훈 & 개선점
1. [반복된 패턴에서 도출한 교훈]
2. [CLAUDE.md 규칙 추가 제안 (해당 시)]

### 다음 주 권장
1. [기술 부채 해소 제안]
2. [품질 개선 제안]
```
