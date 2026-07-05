---
name: health
description: 프로젝트 건강 상태. health, 건강, 상태, 품질, 코드 품질, 대시보드 요청 시 활성화. gstack health 기반 + Uniqn 특화.
allowed-tools: Read, Grep, Glob, Bash, Task
---

# 프로젝트 건강 대시보드 (gstack health + Uniqn 특화)

프로젝트 전반의 코드 품질을 0-10 점수로 평가합니다.

## 프로젝트 컨텍스트

```yaml
작업 디렉토리: uniqn-mobile/
품질 명령어: npm run quality
테스트: npm test
커버리지 목표: utils 90%+ / services 85%+ / hooks 75%+ / components 70%+
```

## 측정 항목 (가중치 합계 = 10점)

### 1. 타입 안전성 (2.0점)
```bash
cd uniqn-mobile && npx tsc --noEmit 2>&1 | tail -5
# any 타입 카운트
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | wc -l
```
- 0 에러 + any 0개 = 2.0
- 0 에러 + any 1~5개 = 1.5
- 0 에러 + any 6~20개 = 1.0
- 에러 있음 = 0

### 2. 린트 (1.5점)
```bash
cd uniqn-mobile && npx eslint src/ --format compact 2>&1 | tail -5
```
- 0 에러 + 0 경고 = 1.5
- 0 에러 + 경고 있음 = 1.0
- 에러 있음 = 0

### 3. 테스트 (2.0점)
```bash
cd uniqn-mobile && npm test -- --coverage --silent 2>&1 | tail -20
```
- 전체 통과 + 목표 커버리지 달성 = 2.0
- 전체 통과 + 커버리지 미달 = 1.5
- 실패 있음 = 0

### 4. 아키텍처 준수 (1.5점)
```bash
# Presentation/Hooks에서 Firestore 직접 호출 (위반)
grep -rn "collection(\|doc(\|getDoc\|setDoc\|updateDoc\|deleteDoc" uniqn-mobile/src/components/ uniqn-mobile/src/app/ --include="*.ts" --include="*.tsx" | grep -v "test\|spec\|__test" | wc -l
```
- 0 위반 = 1.5
- 1~3 위반 = 1.0
- 4~10 위반 = 0.5
- 10+ 위반 = 0

### 5. 금지 패턴 (1.5점)
```bash
# console.log (앱 런타임)
grep -rn "console\.\(log\|info\|warn\|error\)" uniqn-mobile/src/ --include="*.ts" --include="*.tsx" | grep -v "test\|spec\|__test\|scripts" | wc -l
# snake_case 필드명
grep -rn "staff_id\|user_id\|job_id\|store_id" uniqn-mobile/src/ --include="*.ts" --include="*.tsx" | wc -l
# FlatList 대형 목록
grep -rn "FlatList" uniqn-mobile/src/ --include="*.tsx" | wc -l
```
- 0 위반 = 1.5
- 1~5 위반 = 1.0
- 6~15 위반 = 0.5
- 15+ 위반 = 0

### 6. 의존성 건강 (1.5점)
```bash
cd uniqn-mobile && npm audit 2>&1 | grep -c "critical\|high"
npm outdated --json 2>/dev/null | grep -c '"latest"'
```
- critical/high 취약점 0 + outdated 5 이하 = 1.5
- critical 0 + high 있음 = 1.0
- critical 있음 = 0

## 출력 형식

```markdown
## 프로젝트 건강 대시보드

### 종합 점수: [N.N] / 10.0

| 항목 | 점수 | 상태 |
|------|------|------|
| 타입 안전성 | [N.N]/2.0 | [상태] |
| 린트 | [N.N]/1.5 | [상태] |
| 테스트 | [N.N]/2.0 | [상태] |
| 아키텍처 준수 | [N.N]/1.5 | [상태] |
| 금지 패턴 | [N.N]/1.5 | [상태] |
| 의존성 건강 | [N.N]/1.5 | [상태] |

### 주요 이슈
1. [가장 점수가 낮은 항목의 구체적 문제]
2. ...

### 개선 권장
1. [즉시 개선 가능한 항목]
2. ...
```
