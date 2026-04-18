> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 설계, 기록, 레거시 참고 또는 시점 한정 로그입니다.
> 현재 기준 문서는 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, `docs/guides/DEPLOYMENT.md`를 우선 확인하세요.
# UNIQN 병렬 리팩터링 실행계획

## 요약
이 계획은 `무회귀 우선`으로 설계한 병렬 실행 계획입니다. 핵심 원칙은 `공통 계약은 직렬로 먼저 잠그고`, 그 위 소비 계층만 병렬화하는 것입니다. 직접 `main`에 합치지 않고, 각 스트림은 고정된 소유 범위와 테스트 게이트를 통과한 뒤에만 통합합니다. 프로덕션 안정성을 위해 핵심 워크플로우는 각 단계마다 에뮬레이터/테스트/수동 스모크를 모두 통과해야 다음 단계로 넘어갑니다.

핵심 워크플로우 보호 대상:
- 공개 공고 목록 → 공고 상세 → 지원
- 고용주 공고 생성/수정 → 지원자 관리 → 확정/취소
- 일정/출퇴근/QR/워크로그/정산
- 관리자 토너먼트 승인/반려/재제출
- 알림/에러/유지보수 모드/강제 업데이트

## 병렬 실행 순서

### 1. Wave 0: 안전장치 구축 (직렬, 병렬 시작 전 필수)
- 공통 보호선부터 만듭니다. 브랜치 전략은 `integration 기준 + 스트림별 브랜치 + 직접 main merge 금지`로 고정합니다.
- 테스트 게이트를 스트림 공통 규칙으로 고정합니다: `npm run quality`, 핵심 Jest suite, functions build, Firestore rules 테스트, 워크플로우 스모크 체크리스트.
- 보호 기준을 문서화합니다: touched workflow에 신규 기능 혼합 금지, 같은 계약 파일을 여러 스트림이 동시에 수정 금지, canonical invariant 변경은 단일 스트림만 소유.
- 핵심 워크플로우의 “의도된 동작”을 golden scenario로 명시하고 이후 모든 스트림의 회귀 기준으로 사용합니다.

### 2. Wave 1: canonical 계약 고정 (직렬, 전체 병렬 작업의 기반)
- `src/schemas/jobPosting.schema.ts`, `src/domains/job-posting/`, `src/repositories/firebase/jobPosting/`, `firestore.rules`를 한 스트림이 독점 소유합니다.
- 여기서 고정할 결정:
- `postingType`와 `schedule.kind` 일치 규칙
- `fixedConfig.durationDays` 단일 정책
- canonical location shape와 round-trip 보존 규칙
- repository write 전 canonical validation 강제
- `deserializeJobPostingDocument()`를 passthrough에서 정규화 계층으로 승격
- 이 단계가 끝나기 전에는 UI, workflow, functions 리팩터링 스트림이 canonical 계약 파일을 건드리지 않습니다.
- 완료 기준은 “새 계약으로 create/update/read/rules가 모두 같은 문서를 같은 방식으로 해석”하는 것입니다.

### 3. Wave 2: 병렬 스트림 A/B/C 시작
- **스트림 A: 워크플로우/도메인 통합**
  공고 facts, selector, projection, fixed/tournament/urgent 분기, role/salary/schedule derivation을 `src/domains/job-posting/` 중심으로 일원화합니다. 목표는 UI와 service에서 중복 판단을 제거하고, 워크플로우가 하나의 도메인 규칙만 보게 만드는 것입니다.
- **스트림 B: 에러 처리/관측성 정리**
  `AppError`, `handleServiceError`, logger, Sentry wrapper를 정리하고 `crashlyticsService`는 호환 alias만 남깁니다. 목표는 recoverable error, silent infra error, critical telemetry를 같은 정책으로 분류하는 것입니다.
- **스트림 C: functions/모듈 경계 정리**
  `functions/src/index.ts`를 도메인별 export barrel로 분리하고, job posting 관련 trigger/callable이 canonical contract를 깨지 않도록 구조를 분해합니다. 앱 계약 파일은 건드리지 않고, functions 쪽 조직화와 테스트 보강만 수행합니다.
- 이 세 스트림은 Wave 1이 끝난 뒤 병렬 가능하며, 공통 계약을 다시 바꾸지 않는 조건에서 동시에 진행합니다.

### 4. Wave 3: 병렬 스트림 D/E 시작
- **스트림 D: UI/UX surface 통합**
  public/employer 공고 카드/상세/관리 화면의 날짜 그룹핑, 역할 라인, 급여 표기, 상태 UI를 shared primitive로 통합합니다. 이 스트림은 반드시 Wave 2의 workflow selector/view-model이 안정된 뒤 시작합니다.
- **스트림 E: 비용/성능/중복 최적화**
  projection 중복 계산, 과도한 재조회, query helper 사용 방식, offline cache shape, trigger churn을 줄입니다. 이 스트림은 계약과 workflow가 고정된 상태에서만 진행하며, 기능 의미를 바꾸는 최적화는 금지합니다.
- Wave 3는 UI와 성능 작업이 서로 충돌하지 않도록 `presentation ownership`과 `data-fetch ownership`을 분리합니다.

### 5. Final Wave: 통합 검증과 순차 merge (직렬)
- merge 순서는 `Wave 1 -> A/B/C -> D/E -> final integration`으로 고정합니다.
- 각 스트림 merge 전에는 공용 integration branch에서 리베이스 후 테스트를 다시 돌립니다.
- 최종 통합 단계에서만 cross-stream 정리 작업을 허용합니다: deprecated alias 제거 후보 정리, 문서 갱신, 최종 naming 통일, 공통 테스트 게이트 확정.
- 프로덕션 반영은 한 번에 하지 않고, 최소한 내부 QA 스모크를 거친 뒤 순차 배포합니다.

## 구현 변경 방향

### 공통 인터페이스/타입
- `JobPosting`은 Firestore raw document와 분리된 정규화 runtime entity로 취급합니다.
- `postingType`, `schedule.kind`, `fixedConfig`, `location`은 invariant helper를 공유합니다.
- shared posting card/detail/manage view-model을 공용 UI 입력 타입으로 고정합니다.
- observability는 새 facade 이름을 기준으로 하고 기존 `crashlyticsService`는 임시 호환 alias만 유지합니다.

### 데이터 흐름
- component는 Firebase를 모르고, hook은 raw write를 모르며, service는 repository를 우회하지 않는 구조를 강제합니다.
- version/observability 같은 인프라성 예외는 유지하되, 예외 목록을 명시적으로 문서화합니다.
- legacy form facade는 입력 어댑터로만 유지하고, canonical business logic은 도메인 계층에서만 계산합니다.

### 충돌 방지용 소유 범위
- Wave 1은 canonical 계약 파일 독점
- 스트림 A는 domain/workflow 판단 파일 독점
- 스트림 B는 errors/logger/observability 독점
- 스트림 C는 functions export 구조와 관련 테스트 독점
- 스트림 D는 공고 관련 UI surface와 shared primitive 독점
- 스트림 E는 query/projection/cache/trigger cost 최적화 파일 독점

## 테스트 및 검증 계획
- Wave 1 필수 테스트:
  - `postingType`/`schedule.kind` mismatch 거부
  - `fixedConfig.durationDays` 정책 일치
  - location round-trip 보존
  - repository write 전 validation 실패 보장
  - Firestore rules와 앱 schema 일치
- 스트림 A 필수 테스트:
  - public/employer/application/confirmation/schedule 흐름에서 fixed/tournament/urgent 해석이 동일
  - role/salary/schedule projection이 화면마다 같은 결과
- 스트림 B 필수 테스트:
  - business error와 infra error가 같은 정책으로 로깅/노출
  - Sentry 전송 기준과 silent 처리 기준 회귀 없음
- 스트림 C 필수 테스트:
  - job posting 관련 functions가 canonical 필드 외 문서를 생성하지 않음
  - functions index 분해 후 export 누락 없음
- 스트림 D 필수 테스트:
  - 공고 카드/상세 UI가 public/employer에서 같은 grouped schedule과 salary 규칙 사용
  - empty/loading/error/partial state 일관성
- 스트림 E 필수 테스트:
  - 같은 화면 기준 쿼리 수 증가 금지
  - 캐시 shape 변경 시 invalidate/versioning 동작 검증
- 모든 merge의 공통 수동 스모크:
  - 공고 생성/수정/조회
  - 지원/확정/취소
  - 일정 조회/QR/출퇴근/정산
  - 관리자 승인/반려/재제출
  - 알림 수신/유지보수 모드/강제 업데이트 체크

## 기본 가정과 안전 규칙
- “절대 문제 없음”은 보장 문구가 아니라 운영 목표로 취급하며, 실제 실행은 `무회귀 게이트 통과 전 merge 금지`로 강제합니다.
- canonical 계약 변경은 Wave 1 이후 금지하며, 이후 발견된 예외는 hotfix가 아니라 integration branch에서 먼저 합의 후 반영합니다.
- touched workflow에 신규 기능 추가는 전체 리팩터링 종료 전 금지합니다.
- UI 개선은 의미 수정만 허용하고, 제품 정책 변경이나 대규모 비주얼 리디자인은 범위 밖입니다.
- fixed posting duration은 별도 제품 요구가 없으면 단일 정책으로 통일합니다.
- `app2/`는 참조만 가능하며 runtime 판단 근거로 사용하지 않습니다.

