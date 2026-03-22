# UNIQN 병렬 작업 시작 패키지

## 요약
이 문서만 있으면 새 스레드를 여러 개 만들고, 각 스레드에 `첫 메시지 1개만` 넣어서 바로 병렬 작업을 시작할 수 있게 구성합니다. 가장 중요한 원칙은 `스레드 분리 = worktree 분리 = branch 분리 = 파일 소유 범위 분리`입니다. 이 원칙만 지키면 병렬로 진행해도 워크플로우 안정성을 크게 해치지 않습니다.

기본 운영 방식:
- 사용자가 새 스레드를 직접 만듭니다.
- 각 스레드는 아래에 있는 자기 전용 첫 메시지를 그대로 붙여넣고 시작합니다.
- 각 스레드는 자기 worktree와 자기 branch에서만 작업합니다.
- 공통 계약은 먼저 직렬로 끝내고, 그 다음에만 병렬 스트림을 엽니다.
- 모든 병렬 작업은 최종적으로 `통합 스레드`에서 다시 검증 후 병합합니다.

## 시작 전 준비

### 1. worktree와 branch 먼저 만들기
PowerShell에서 아래 순서로 준비합니다.

```powershell
cd C:\Users\user\Desktop\T-HOLDEM

git checkout -b codex/integration

git worktree add C:\Users\user\Desktop\T-HOLDEM-canonical -b codex/canonical-contract
git worktree add C:\Users\user\Desktop\T-HOLDEM-workflow -b codex/workflow-domain
git worktree add C:\Users\user\Desktop\T-HOLDEM-observability -b codex/error-observability
git worktree add C:\Users\user\Desktop\T-HOLDEM-functions -b codex/functions-modularize
```

2차 병렬 단계에서 추가:
```powershell
git worktree add C:\Users\user\Desktop\T-HOLDEM-ui -b codex/ui-shared-surfaces
git worktree add C:\Users\user\Desktop\T-HOLDEM-perf -b codex/perf-cost-optimization
```

### 2. 스레드 생성 순서
반드시 이 순서로 엽니다.

1. `통합 스레드`
2. `Canonical Contract 스레드`
3. `Workflow Domain 스레드`
4. `Error Observability 스레드`
5. `Functions Modularize 스레드`
6. `UI Shared Surfaces 스레드`
7. `Perf Cost Optimization 스레드`

주의:
- `Workflow`, `Error`, `Functions` 스레드는 `Canonical Contract`가 끝난 뒤 시작
- `UI`, `Perf` 스레드는 `Workflow Domain`이 끝난 뒤 시작

## 스레드별 첫 메시지

### 1. 통합 스레드 첫 메시지
```text
작업명: Integration Coordinator

작업 목표:
UNIQN 전체 병렬 리팩터링의 통합 조정 스레드로 동작해주세요. 이 스레드는 직접 대규모 구현을 하지 말고, 각 병렬 스트림의 의존성 순서, merge 순서, 테스트 게이트, 회귀 검증, 최종 통합 검수를 담당합니다.

작업 폴더:
C:\Users\user\Desktop\T-HOLDEM

브랜치:
codex/integration

역할:
- 전체 병렬 스트림의 진행 순서 관리
- 각 스트림의 소유 범위 충돌 여부 확인
- merge 전후 검증 기준 유지
- 최종 통합 시 회귀 리스크 점검
- 필요한 경우 다른 스레드가 따라야 할 invariant를 정리

절대 하지 말 것:
- canonical contract가 확정되기 전 다른 스트림에 계약 변경 허용
- 각 스트림 소유 파일을 직접 선제적으로 수정
- 기능 추가를 끼워 넣는 것

현재 병렬 계획:
- 1차 선행: Canonical Contract
- 2차 병렬: Workflow Domain / Error Observability / Functions Modularize
- 3차 병렬: UI Shared Surfaces / Perf Cost Optimization
- 마지막: integration 검증 및 병합

이 스레드에서 먼저 할 일:
1. 현재 저장소 상태와 병렬 계획의 의존성 구조를 재확인
2. 각 스트림별 merge gate를 체크리스트로 정리
3. 최종적으로 integration branch 기준으로 어떤 순서로 병합할지 확정
4. 이후 각 스트림이 끝날 때 받아야 할 보고 형식을 고정

필수 검증 기준:
- uniqn-mobile: npm run quality
- functions: npm run build
- 관련 Jest / rules 테스트
- 핵심 워크플로우 수동 스모크 기준 유지

보고 형식:
- 현재 전체 상태
- 지금 열어도 되는 스트림 / 아직 열면 안 되는 스트림
- 병합 순서
- 공통 리스크
```

### 2. Canonical Contract 스레드 첫 메시지
```text
작업명: Canonical Contract

작업 목표:
UNIQN의 v3 canonical 계약을 단일 진실 원천으로 고정해주세요. job posting의 schema, serializer/deserializer, repository write, Firestore rules가 같은 계약을 보도록 정리하는 것이 목표입니다.

작업 폴더:
C:\Users\user\Desktop\T-HOLDEM-canonical

브랜치:
codex/canonical-contract

이 스레드의 소유 범위:
- uniqn-mobile/src/schemas/jobPosting.schema.ts
- uniqn-mobile/src/domains/job-posting/
- uniqn-mobile/src/repositories/firebase/jobPosting/
- firestore.rules
- 관련 테스트

핵심 목표:
- postingType과 schedule.kind 일치 규칙 강제
- fixedConfig.durationDays 정책 통일
- canonical location shape 확정 및 round-trip 유실 방지
- repository write 전 canonical validation 강제
- deserializeJobPostingDocument를 passthrough가 아닌 정규화 계층으로 전환

절대 수정하면 안 되는 범위:
- 공고 카드/상세 UI 리팩터링
- observability/logger 정리
- functions index 분리
- 성능 최적화 작업

중요 제약:
- 예전 데이터 마이그레이션은 고려하지 않음
- app2는 참조만 가능, 구현 기준으로 사용 금지
- 기능 추가 금지, 계약 정합성만 다룰 것

필수 테스트:
- npm run quality
- job posting schema/submission/workflow 관련 Jest suite
- Firestore rules test
- create/update/read/rules 해석 일치 검증

완료 기준:
- postingType/schedule.kind mismatch 불가
- fixed duration 정책이 앱/타입/rules/write path 전부 동일
- location 정보가 serialize/parse 왕복 후 유실되지 않음
- create/update/read/rules가 같은 문서를 같은 방식으로 해석

보고 형식:
- 확정된 canonical invariant
- 바뀐 공개 타입/계약
- 다른 스트림이 의존해야 하는 규칙
- 남은 리스크
```

### 3. Workflow Domain 스레드 첫 메시지
```text
작업명: Workflow Domain

작업 목표:
공고/지원/확정/일정/정산에서 사용하는 workflow 판단 로직을 domain 계층으로 일원화해주세요. fixed/tournament/urgent/public/employer 분기가 화면마다 다르게 해석되지 않도록 selector, facts, projection을 통합하는 것이 목표입니다.

작업 폴더:
C:\Users\user\Desktop\T-HOLDEM-workflow

브랜치:
codex/workflow-domain

선행 의존성:
Canonical Contract 완료본을 기준으로 작업하세요. canonical invariant를 다시 바꾸지 마세요.

이 스레드의 소유 범위:
- uniqn-mobile/src/domains/job-posting/
- uniqn-mobile/src/domains/schedule/
- 공고 workflow selector/facts/projection
- fixed/tournament/urgent 분기와 관련된 service/domain 로직
- 관련 테스트

핵심 목표:
- isFixed/isTournament/role availability/salary display/schedule display/application eligibility를 공통 selector로 통일
- UI와 service가 직접 분기하지 않도록 workflow 판단을 domain 계층으로 회수
- public/employer/application/schedule 흐름이 같은 공고를 같은 방식으로 해석하도록 보장

절대 수정하면 안 되는 범위:
- canonical 계약 자체 재정의
- Firestore rules 수정
- 대규모 UI 마크업 리디자인
- observability/logger 구조 변경

필수 테스트:
- npm run quality
- workflow 관련 Jest suite
- 공고 상세/지원/확정/일정 변환 관련 테스트
- fixed/tournament/urgent 흐름 회귀 검증

완료 기준:
- fixed 판단 기준이 화면마다 다르지 않음
- 역할/급여/일정 projection이 public/employer/application/schedule에서 일관됨
- UI가 workflow 계산을 중복 구현하지 않음

보고 형식:
- 새 selector/facts/projection 구조
- 제거된 중복 판단 지점
- UI 스트림이 그대로 의존해도 되는 입력 계약
- 남은 리스크
```

### 4. Error Observability 스레드 첫 메시지
```text
작업명: Error Observability

작업 목표:
UNIQN의 에러 처리, logger, observability naming과 telemetry 정책을 정리해주세요. AppError 중심 계약을 강화하고, Sentry 기반 구조와 crashlyticsService 명명 혼선을 안전하게 정리하는 것이 목표입니다.

작업 폴더:
C:\Users\user\Desktop\T-HOLDEM-observability

브랜치:
codex/error-observability

선행 의존성:
Canonical Contract 완료 이후 시작하세요. job posting 계약 재정의는 금지합니다.

이 스레드의 소유 범위:
- uniqn-mobile/src/errors/
- uniqn-mobile/src/utils/logger.ts
- uniqn-mobile/src/services/observability/
- error boundary 관련 컴포넌트
- 관련 테스트/문서 정합성

핵심 목표:
- handleServiceError / handleSilentError / AppError 사용 규칙 일관화
- recoverable business error와 infra error와 critical telemetry 구분 정책 확정
- crashlyticsService는 호환 alias로만 유지하고, 실제 Sentry wrapper 명칭을 명확히 정리
- runtime console 사용을 wrapper 밖에서 줄이기

절대 수정하면 안 되는 범위:
- job posting canonical 계약
- 공고 UI 리팩터링
- functions index 구조 변경
- 성능 최적화

필수 테스트:
- npm run quality
- errors / logger / observability 관련 테스트
- 주요 서비스 error normalization 회귀 검증

완료 기준:
- 서비스 레이어 에러 계약이 일관됨
- Sentry 전송 기준이 문서와 코드에서 동일
- naming 혼선이 줄고, 기존 호출부는 깨지지 않음

보고 형식:
- 정리된 에러 분류 규칙
- 유지한 호환 alias와 제거 후보
- 다른 스트림이 따라야 할 에러/로깅 규칙
- 남은 리스크
```

### 5. Functions Modularize 스레드 첫 메시지
```text
작업명: Functions Modularize

작업 목표:
Firebase Functions 구조를 병렬 작업에 안전한 형태로 정리해주세요. functions/src/index.ts의 과도한 집중도를 낮추고, job posting 관련 callable/trigger가 canonical contract를 깨지 않도록 구조와 테스트를 정리하는 것이 목표입니다.

작업 폴더:
C:\Users\user\Desktop\T-HOLDEM-functions

브랜치:
codex/functions-modularize

선행 의존성:
Canonical Contract 완료 이후 시작하세요. canonical invariant를 다시 정하지 마세요.

이 스레드의 소유 범위:
- functions/src/index.ts
- functions/src/api/
- functions/src/triggers/
- functions/src/scheduled/
- functions/test/
- functions 내부 문서/구조 정리

핵심 목표:
- functions export를 도메인별로 구조화
- job posting 관련 function이 non-canonical 필드를 만들지 않도록 점검
- rules/functions 테스트 기준 강화
- 대규모 index 허브 구조를 유지보수 가능한 단위로 분해

절대 수정하면 안 되는 범위:
- 앱 UI
- 앱 observability 구조
- 앱 workflow selector 구조
- canonical 계약 재정의

필수 테스트:
- npm run build
- 관련 mocha / firestore rules test
- job posting 관련 function contract 검증

완료 기준:
- functions 구조가 도메인별로 나뉨
- export 누락 없음
- job posting 관련 functions가 canonical contract를 위반하지 않음

보고 형식:
- 새 functions 구조 요약
- canonical contract 의존 지점
- 통합 시 주의점
- 남은 리스크
```

### 6. UI Shared Surfaces 스레드 첫 메시지
```text
작업명: UI Shared Surfaces

작업 목표:
공개/고용주 공고 화면의 중복 UI를 shared primitive와 공통 view-model 기반으로 정리해주세요. 이 작업은 비주얼 리디자인이 아니라, 의미와 상태 처리의 일관성 확보가 목적입니다.

작업 폴더:
C:\Users\user\Desktop\T-HOLDEM-ui

브랜치:
codex/ui-shared-surfaces

선행 의존성:
Workflow Domain 완료 이후 시작하세요. workflow selector와 projection 결과를 그대로 사용하세요.

이 스레드의 소유 범위:
- uniqn-mobile/src/components/jobs/
- uniqn-mobile/src/components/employer/posting/
- 공고 카드/상세/관리 관련 shared primitive
- 관련 UI 테스트

핵심 목표:
- 날짜 그룹핑, 역할 라인, 급여 row, 상태 표시 중복 제거
- public/employer 화면이 같은 view-model과 shared helper를 사용하도록 정리
- empty/loading/error/partial-data 상태를 일관되게 정리

절대 수정하면 안 되는 범위:
- canonical 계약
- workflow selector 규칙 자체
- observability/logger
- functions 구조 변경

필수 테스트:
- npm run quality
- 관련 컴포넌트/화면 테스트
- 카드/상세의 grouped schedule, salary, role display 회귀 검증

완료 기준:
- public/employer 공고 surface가 shared primitive 사용
- 의미상 같은 정보가 화면마다 다르게 보이지 않음
- 상태 처리 규칙이 공통화됨

보고 형식:
- 통합된 UI primitive 목록
- 제거된 중복 컴포넌트/로직 유형
- workflow/domain에 의존하는 입력 계약
- 남은 리스크
```

### 7. Perf Cost Optimization 스레드 첫 메시지
```text
작업명: Perf Cost Optimization

작업 목표:
공고/일정/조회 관련 비용과 성능을 최적화해주세요. projection 중복 계산, 재조회, cache shape, trigger churn을 줄이되, business rule이나 UI 의미를 바꾸지 않는 것이 목표입니다.

작업 폴더:
C:\Users\user\Desktop\T-HOLDEM-perf

브랜치:
codex/perf-cost-optimization

선행 의존성:
Canonical Contract와 Workflow Domain 완료 이후 시작하세요.

이 스레드의 소유 범위:
- query/projection/cache/performance 관련 코드
- searchIndex/trigger churn 점검
- offline cache shape/versioning
- 관련 성능/회귀 테스트

핵심 목표:
- 화면마다 반복되는 projection/date grouping 계산 줄이기
- 필요 이상 재조회/중복 fetch 줄이기
- cache shape를 canonical projection 기준으로 정리
- trigger churn과 불필요한 sync 비용 줄이기

절대 수정하면 안 되는 범위:
- canonical invariant 변경
- UI 의미 변경
- functions 구조 전면 개편
- error handling 정책 재정의

필수 테스트:
- npm run quality
- 관련 query/projection 테스트
- 같은 workflow 기준 쿼리 수 증가 금지 확인
- 캐시 invalidate/versioning 회귀 검증

완료 기준:
- 의미 변화 없이 조회 비용 감소
- projection 중복 계산 감소
- cache와 trigger가 canonical 구조에 맞게 정리

보고 형식:
- 줄인 비용/중복 유형
- 캐시 shape 변경 사항
- merge 시 주의할 성능 리스크
- 남은 리스크
```

## 전체 진행 가이드

### 운영 규칙
- 각 스레드는 자기 worktree만 사용
- 각 스레드는 자기 branch만 사용
- 같은 파일을 두 스레드가 동시에 수정하지 않음
- 계약 변경이 필요하면 자기 스레드에서 바로 바꾸지 말고 통합 스레드에 승격
- 기능 추가 금지, 구조개선과 안정화만 수행
- merge 전에는 반드시 integration 기준으로 재검증

### 실전 순서
1. 사용자가 `통합 스레드` 생성 후 첫 메시지 입력
2. 사용자가 `Canonical Contract 스레드` 생성 후 첫 메시지 입력
3. Canonical Contract가 끝나면 통합 스레드에 결과 반영
4. 그 다음 `Workflow`, `Error`, `Functions` 세 스레드 병렬 시작
5. Workflow가 끝나면 `UI`, `Perf` 스레드 시작
6. 각 스레드 종료 시 통합 스레드에 결과 요약 전달
7. 통합 스레드에서 순차 merge와 회귀 검증 진행

### 각 스레드 완료 시 받아야 할 보고 형식
각 스레드 마지막 보고는 아래 형식으로 통일합니다.
```text
1. 변경 요약
2. 수정한 핵심 파일/영역
3. 확정된 규칙 또는 새 입력 계약
4. 실행한 테스트와 결과
5. 남은 리스크
6. 다른 스레드가 알아야 할 사항
```

## 병합 및 검증 가이드

### 병합 순서
1. `codex/canonical-contract`
2. `codex/workflow-domain`
3. `codex/error-observability`
4. `codex/functions-modularize`
5. `codex/ui-shared-surfaces`
6. `codex/perf-cost-optimization`

### 병합 전 체크
각 스트림마다:
- `uniqn-mobile`: `npm run quality`
- 관련 Jest suite
- `functions`: `npm run build`
- rules/function 관련 변경이면 관련 테스트
- 핵심 워크플로우 스모크 확인

### 최종 통합 스모크
- 공개 공고 목록 → 상세 → 지원
- 고용주 공고 생성/수정
- 지원자 확정/취소
- 일정 조회
- QR / 출퇴근
- 워크로그 / 정산
- 관리자 승인 / 반려 / 재제출
- 유지보수 모드 / 강제 업데이트 / 에러 노출 상태

## 기본 가정
- 사용자가 새 스레드를 직접 생성한다
- 각 새 스레드는 동일한 저장소 규칙과 AGENTS 지침을 공유한다
- 예전 데이터 마이그레이션은 범위 밖이다
- `app2/`는 참조만 가능하고 구현 기준이 아니다
- fixed duration은 별도 제품 요구가 없으면 단일 정책으로 고정한다
