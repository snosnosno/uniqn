# Services 도메인별 폴더 분리 리팩토링

## 배경

`src/services/`에 30+개 서비스 파일이 flat하게 존재하고, `index.ts`가 316개 항목을 re-export하는 거대 barrel이다. 반면 같은 프로젝트의 `src/repositories/firebase/`는 이미 도메인별 폴더(`application/`, `jobPosting/`, `workLog/`)로 분리되어 있다. Repository 패턴을 참고하여 Service 레이어도 동일한 구조로 정리한다.

## 목표

`src/services/index.ts` (316개 export, 461줄)을 제거하고, 도메인별 폴더 + 작은 barrel 구조로 전환한다.

## 참고할 기존 패턴

Repository 레이어의 `application/` 폴더가 모범 사례:
- `repositories/firebase/application/index.ts` → Facade 클래스가 서브모듈 함수를 위임
- `repositories/firebase/application/applicationQueries.ts` → 읽기
- `repositories/firebase/application/applicationTransactions.ts` → 쓰기
- `repositories/firebase/index.ts` → 14개만 re-export하는 작은 barrel

Service 레이어도 이처럼 도메인 폴더 + 폴더별 작은 `index.ts`로 구성한다.

## 도메인 분리 기준

### 1. `services/auth/` — 인증/계정
- `authService.ts` (기존 그대로)
- `accountDeletionService.ts` (기존 그대로)
- `storageService.ts` (프로필 이미지)
- `biometricService.ts` (기존 그대로)
- `index.ts` ← 이 폴더의 export만 re-export

### 2. `services/jobs/` — 구인구직 (공고 + 지원 + 전환)
- `jobService.ts` (스태프: 공고 조회/검색)
- `jobManagementService.ts` (구인자: 공고 CRUD)
- `applicationService.ts` (스태프: 지원/취소)
- `applicationHistoryService.ts` (확정/취소 이력)
- `applicantManagementService.ts` (구인자: 지원자 관리)
- `applicantConversionService.ts` (지원자→스태프 전환)
- `templateService.ts` (공고 템플릿)
- `searchService.ts` (검색)
- `index.ts`

### 3. `services/work/` — 근무 (스케줄 + 출퇴근 + 정산)
- `scheduleService.ts`
- `workLogService.ts`
- `confirmedStaffService.ts`
- `eventQRService.ts`
- `settlement/` (기존 하위 폴더 그대로 유지)
- `index.ts`

### 4. `services/notifications/` — 알림
- `notificationService.ts`
- `pushNotificationService.ts`
- `notificationSyncService.ts`
- `inAppMessageService.ts`
- `index.ts`

### 5. `services/observability/` — 분석/모니터링
- `analyticsService.ts`
- `crashlyticsService.ts`
- `performanceService.ts`
- `deepLinkService.ts`
- `sessionService.ts`
- `tokenRefreshService.ts`
- `featureFlagService.ts`
- `index.ts`

### 6. `services/admin/` — 관리자
- `adminService.ts`
- `reportService.ts`
- `tournamentApprovalService.ts`
- `announcementService.ts`
- `index.ts`

### 7. `services/` 루트에 남는 것
- `cacheService.ts` (범용)
- `reviewService.ts` (리뷰)
- `inquiryService.ts` (문의)
- `versionService.ts` (버전 체크)

## 작업 순서

### Phase 1: 폴더 생성 + 파일 이동
- 6개 도메인 폴더 생성
- 기존 서비스 파일을 해당 폴더로 이동 (내용 변경 없음)
- 각 폴더에 `index.ts` barrel 생성 (해당 폴더의 export만)

### Phase 2: Import 경로 업데이트
- `from '@/services'` → `from '@/services/auth'` 등 도메인 barrel
- `from '@/services/authService'` → `from '@/services/auth/authService'` 또는 `from '@/services/auth'`
- 모든 소비자 파일의 import 경로 수정

### Phase 3: 거대 barrel 제거
- `src/services/index.ts` 삭제
- 도메인 re-export (`@/domains/schedule`, `@/domains/settlement`)는 해당 도메인에서 직접 import하도록 변경

### Phase 4: 검증
```bash
cd uniqn-mobile && npm run quality   # type-check + lint + format:check
cd uniqn-mobile && npm test          # 테스트
```

## 제약사항

- **로직 변경 금지** — 파일 이동 + import 경로만 변경
- **settlement/ 하위 폴더는 유지** — 이미 분리되어 있으므로 `services/work/settlement/`로 이동만
- **테스트 파일도 함께 이동** — `__tests__/authService.test.ts` → `auth/__tests__/authService.test.ts`
- 각 Phase 완료 후 `npm run quality` 실행하여 오류 확인
- CLAUDE.md의 아키텍처 규칙(Service → Repository 의존만 허용) 준수
