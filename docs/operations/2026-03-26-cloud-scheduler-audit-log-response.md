# Cloud Scheduler 감사 로그 변경 대응 기록

**작성일**: 2026년 3월 26일  
**대상 프로젝트**: `tholdem-ebc18`  
**상태**: 대응 계획 반영 완료, 운영 자산 확인 대기

## 요약

- 현재 저장소와 실제 배포된 scheduled function 기준으로 이번 Cloud Scheduler 감사 로그 변경의 직접 영향은 없다.
- 즉시 수정이 필요한 앱/Functions 비즈니스 로직은 확인되지 않았다.
- 남은 리스크는 저장소 밖 운영 자산이다.
  - Cloud Logging Log Router sink
  - BigQuery 감사 로그 export
  - SIEM/Splunk/Datadog 등 외부 연동
  - `cloudscheduler.googleapis.com` 감사 로그를 읽는 수동 스크립트

## 배경

- Cloud Scheduler는 2025년 9월 15일부터 App Engine 흐름을 제외하고 표준 GFE 형식의 감사 로그를 생성하기 시작했다.
- 기존 형식 감사 로그는 2026년 9월 30일까지 병행 제공된다.
- 2026년 9월 30일부터 기존 payload 구조만 가정한 파서는 실패할 수 있다.

## 확인 근거

### 1. 저장소 코드 검색 결과

- `functions/src`, `uniqn-mobile/src`, `scripts`, `.github`, `docs`에서 아래 감사 로그 파싱 흔적을 찾지 못했다.
  - `protoPayload`
  - `authorizationInfo`
  - `retryConfig` / `retry_config`
  - `callerIp`
  - `cloudaudit.googleapis.com`
  - `@google-cloud/logging`
- `functions/package.json` 런타임 의존성에도 Logging SDK가 없다.

### 2. 실제 배포된 scheduled function 확인 결과

`npx firebase-tools functions:list --project tholdem-ebc18 --json` 기준으로 현재 배포된 scheduled function은 아래 8개다.

- `cleanupExpiredTokensScheduled`
- `cleanupOrphanAccountsScheduled`
- `cleanupRateLimitsScheduled`
- `expireByLastWorkDate`
- `expireFixedPostings`
- `processScheduledDeletions`
- `retryFailedCounterOpsScheduled`
- `sendReviewRemindersScheduled`

위 목록은 현재 소스 export와 일치한다.

### 3. 레거시 결제 Scheduler 문서 상태

아래 이름은 문서에는 남아 있지만 현재 저장소와 실제 배포된 Functions 기준 활성 대상이 아니다.

- `cleanupExpiredHearts`
- `heartExpiry7Days`
- `heartExpiry3Days`
- `heartExpiryToday`
- `archiveOldData`

## 최종 결론

### 직접 영향

- 없음.
- 현재 `onSchedule()` 기반 함수들은 Cloud Scheduler 감사 로그를 읽지 않고, 스케줄 트리거로만 Cloud Scheduler를 사용한다.
- 따라서 이번 변경으로 인해 앱 또는 Functions 런타임이 즉시 깨질 부분은 확인되지 않았다.

### 조건부 영향

- 운영팀이 Cloud Scheduler 감사 로그를 외부에서 직접 파싱하는 경우에만 영향이 있다.
- 이 경우 old/new 포맷 동시 지원 정규화 레이어를 두고 후속 비즈니스 로직은 정규화된 내부 필드만 보도록 전환해야 한다.

## 실행 계획

### 2026년 3월 31일까지

운영/인프라 담당에게 아래 항목을 확인한다.

- IAM 권한 확보 후 실제 Cloud Scheduler job inventory 조회
- Cloud Logging Log Router sink 존재 여부
- BigQuery로 내보내는 감사 로그 테이블 존재 여부
- SIEM/Splunk/Datadog 등 외부 연동 존재 여부
- `cloudscheduler.googleapis.com` 감사 로그를 읽는 커스텀 스크립트 존재 여부

### 2026년 4월 5일까지

- 외부 연동이 없으면 이번 건을 `무영향, 모니터링 유지`로 종료한다.
- 외부 연동이 있으면 old/new 포맷 동시 지원 정규화 로직 전환 계획을 수립한다.

### 2026년 4월 30일까지

- 새 형식 감사 로그 유입 여부를 1회 재확인한다.
- 공지상 일부 고객은 새 로그 수신이 늦을 수 있으므로, 미수신 자체를 즉시 장애로 판단하지 않는다.

### 2026년 8월 31일까지

- 외부 연동이 있는 경우 마이그레이션 완료 목표일로 잡는다.
- 공식 강제일인 2026년 9월 30일보다 1개월 이상 앞서 마감한다.

## 운영 확인 체크리스트

- `authorizationInfo[].resource`를 직접 문자열 파싱하는 로직이 있는가
- `request.job.retryConfig`만 가정한 파서가 있는가
- `callerIp`를 신뢰값으로 사용하는 규칙이 있는가
- 새 payload 구조의 `resourceAttributes`와 `retry_config`를 수용해야 하는 연동이 있는가

## 제한 사항

- Cloud Scheduler API 조회 권한이 없어 Scheduler job inventory를 직접 열람하지 못했다.
- Cloud Logging view/sink 조회 권한이 없어 로그 view, sink, export 설정을 직접 열람하지 못했다.
- 따라서 현재 대응 원칙은 `코드 수정 없음, 운영 자산 확인 후 종료`다.
