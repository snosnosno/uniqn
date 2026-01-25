# UNIQN Mobile 전체 리팩토링 실행 계획

> **기준 문서**: `tidy-fluttering-sutton.md`
> **작업 디렉토리**: `uniqn-mobile/`
> **최종 업데이트**: 2025-01-21
> **상태**: ✅ 전체 완료 (Phase 2 Firestore 마이그레이션 대기)

---

## 진행 현황 요약

| Phase | 목표 | 상태 |
|:-----:|------|:----:|
| 1 | 상태 매핑 통합 (StatusMapper) | ✅ 완료 |
| 2 | ID 마이그레이션 (eventId → jobPostingId) | ⚠️ @deprecated 추가 완료, 마이그레이션 스크립트 준비됨 (실행 대기) |
| 3 | 시간 필드 정규화 (TimeNormalizer) | ✅ 완료 |
| 4 | 역할 처리 통합 (RoleResolver) | ✅ 완료 |
| 5 | 스케줄 병합 분리 (ScheduleMerger + WorkLogCreator) | ✅ 완료 |
| 6 | 정산 계산기 통합 (SettlementCalculator) | ✅ 완료 |
| 7 | 도메인 모듈 구조 완성 | ✅ 완료 |
| 8 | Query Keys 최적화 | ✅ 완료 |
| 9 | 레거시 필드 정리 | 🗑️ 삭제 (Firestore 스키마 변경 허용으로 불필요) |
| 10 | 중복 유틸리티 통합 | ✅ 완료 (이미 통합됨) |
| 11 | 에러 처리 표준화 (hookErrorHandler) | ✅ 완료 |
| 12 | 실시간 구독 통합 (RealtimeManager) | ✅ 완료 |

---

## 실행 원칙

1. **TDD 방식**: 각 Phase 시작 전 테스트 먼저 작성
2. **Phase 완료 시**: 검증 → 테스트 통과 → 커밋 → 문서 업데이트
3. **기능 100% 유지**: Firestore 스키마 변경 허용 (마이그레이션 스크립트)
4. **하위 호환성**: 기존 import 경로 re-export 유지

---

## Phase 1: 상태 매핑 통합

### 목표
7개 상태 타입 간 변환 로직을 단일 `StatusMapper` 클래스로 통합

### 작업 순서

**1. 테스트 작성**
```
src/shared/__tests__/StatusMapper.test.ts
```

**2. 신규 파일 생성**
| 파일 | 설명 |
|------|------|
| `src/shared/status/types.ts` | 상태 타입 정의 |
| `src/shared/status/StatusMapper.ts` | 변환 로직 |
| `src/shared/status/statusFlow.ts` | 상태 전이 규칙 |
| `src/shared/status/index.ts` | 배럴 export |

**3. 수정 파일**
| 파일 | 변경 |
|------|------|
| `src/types/schedule.ts:34-48` | toAttendanceStatus() → StatusMapper 위임 |
| `src/services/scheduleService.ts:118-123,154-159` | 중복 로직 제거, checked_in 버그 수정 |
| `src/services/confirmedStaffService.ts:103-114` | mapWorkLogStatus() 제거 |

### 완료 기준
- [x] StatusMapper.test.ts 통과
- [x] `npm run type-check` 에러 0개
- [x] `npm run lint` 에러 0개
- [x] checked_in 상태 올바르게 처리

### 커밋
```
refactor(shared): Phase 1 - 상태 매핑 StatusMapper로 통합
```

### ✅ Phase 1 완료됨

---

## Phase 2: ID 마이그레이션 (eventId → jobPostingId)

### 현재 상태
- IdNormalizer 구현 완료 (`src/shared/id/IdNormalizer.ts`)
- 테스트 완료 (`src/shared/__tests__/IdNormalizer.test.ts`)

### 추가 작업

**1. 타입 파일 변경 (8개 인터페이스)**
| 파일 | 라인 | 변경 |
|------|:----:|------|
| `src/types/schedule.ts` | 133, 275, 421, 575, 597, 611, 633 | eventId → jobPostingId |
| `src/types/settlement.ts` | 54 | eventId → jobPostingId |

**2. 서비스 쿼리 변경 (31개 위치)**
| 서비스 | 위치 수 |
|--------|:------:|
| settlementService.ts | 8 |
| scheduleService.ts | 7 |
| confirmedStaffService.ts | 4 |
| eventQRService.ts | 6 |
| applicantConversionService.ts | 5 |
| applicationHistoryService.ts | 1 |

**3. 스키마 변경 (3개 파일)**
- `src/schemas/workLog.schema.ts:50`
- `src/schemas/settlement.schema.ts:63,82`
- `src/schemas/schedule.schema.ts:45`

**4. Firestore 마이그레이션**
```
functions/src/migration/migrateEventIdToJobPostingId.ts
```

### 완료 기준
- [x] 타입 파일에 @deprecated 주석 추가 완료
- [x] `npm run type-check` 에러 0개
- [x] Firestore 마이그레이션 스크립트 작성 완료
- [ ] Firestore 마이그레이션 실행 (프로덕션 배포 전 필수)
- [ ] QR 출퇴근 정상 동작 확인

### 커밋
```
refactor(types): Phase 2 - eventId를 jobPostingId로 통일
```

### ⚠️ Phase 2 부분 완료

**@deprecated 주석 추가 완료** (총 9곳):

| 파일 | 인터페이스 | 라인 | @see 헬퍼 |
|------|-----------|:----:|:---------:|
| schedule.ts | ScheduleEvent.eventId | 128 | ✅ |
| schedule.ts | GroupedScheduleEvent.eventId | 273 | - |
| schedule.ts | WorkLog.eventId | 424 | ✅ |
| schedule.ts | EventQRCode.eventId | 581 | - |
| schedule.ts | EventQRDisplayData.eventId | 604 | - |
| schedule.ts | GenerateEventQRInput.eventId | 619 | - |
| schedule.ts | EventQRValidationResult.eventId | 642 | - |
| settlement.ts | GroupedSettlement.eventId | 57 | - |
| notification.ts | NotificationPayload.eventId | 465 | - |

**IdNormalizer 호환성 레이어**: 활용 중

**Firestore 마이그레이션 스크립트 준비됨**:
- 경로: `functions/src/migrations/migrateEventIdToJobPostingId.ts`
- 대상 컬렉션:
  - `workLogs`: eventId → jobPostingId 복사
  - `eventQRCodes`: eventId → jobPostingId 복사
- 배포된 함수 (admin only):
  - `runEventIdMigration`: 마이그레이션 실행
  - `verifyEventIdMigrationStatus`: 검증
- 로컬 스크립트: `functions/run-migration.js`

**실행 방법 (Firebase Console 권장)**:
1. Firebase Console > Functions > `verifyEventIdMigrationStatus` 로 현황 확인
2. `runEventIdMigration` 함수 호출:
   - 테스트: `{"dryRun": true, "batchSize": 500}`
   - 실행: `{"dryRun": false, "batchSize": 500}`
3. `verifyEventIdMigrationStatus` 로 완료 확인

**로컬 실행 (Service Account 필요)**:
```bash
cd functions
# serviceAccountKey.json 다운로드 후 주석 해제
node run-migration.js verify
node run-migration.js dryrun
node run-migration.js migrate
```

---

## Phase 3: 시간 필드 정규화

### 목표
actualStartTime/checkInTime 중복 필드를 단일 인터페이스로 정규화

### 작업 순서

**1. 테스트 작성**
```
src/shared/__tests__/TimeNormalizer.test.ts
```

**2. 신규 파일**
| 파일 | 설명 |
|------|------|
| `src/shared/time/types.ts` | NormalizedWorkTime |
| `src/shared/time/TimeNormalizer.ts` | 정규화 + calculateHours |
| `src/shared/time/index.ts` | 배럴 export |

**3. 수정 파일**
| 파일 | 변경 |
|------|------|
| `src/utils/settlement/index.ts` | TimeNormalizer 사용 |
| `src/services/confirmedStaffService.ts` | 시간 정규화 적용 |

### 완료 기준
- [x] TimeNormalizer.test.ts 통과
- [x] 정산 금액 기존과 동일
- [x] 근무 시간 계산 정확

### 커밋
```
refactor(shared): Phase 3 - 시간 필드 TimeNormalizer로 통합
```

### ✅ Phase 3 완료됨

---

## Phase 4: 역할 처리 통합

### 목표
role/roles/roleIds/customRole 처리 + 권한 검증 통합

### 작업 순서

**1. 테스트 작성**
```
src/shared/__tests__/RoleResolver.test.ts
```

**2. 신규 파일**
| 파일 | 설명 |
|------|------|
| `src/shared/role/types.ts` | ResolvedRole |
| `src/shared/role/RoleResolver.ts` | 정규화 + hasPermission |
| `src/shared/role/index.ts` | 배럴 export |

**3. 수정 파일**
| 파일 | 변경 |
|------|------|
| `src/stores/authStore.ts` | normalizeUserRole → RoleResolver |
| `src/services/adminService.ts` | requireAdmin 사용 |
| `src/services/announcementService.ts` | 권한 검증 표준화 |

### 완료 기준
- [x] RoleResolver.test.ts 통과
- [x] 역할 표시명 정상
- [x] 권한 검증 정상

### 커밋
```
refactor(shared): Phase 4 - 역할 처리 RoleResolver로 통합
```

### ✅ Phase 4 완료됨

---

## Phase 5: 스케줄 병합 로직 분리

### 목표
WorkLog + Application 병합 로직을 ScheduleMerger로 캡슐화

### 작업 순서

**1. 테스트 작성**
```
src/domains/__tests__/ScheduleMerger.test.ts
```

**2. 신규 파일**
| 파일 | 설명 |
|------|------|
| `src/domains/schedule/ScheduleMerger.ts` | merge, groupByDate, groupByApplication |
| `src/domains/schedule/WorkLogCreator.ts` | 확정 트랜잭션 통합 |
| `src/domains/schedule/index.ts` | 배럴 export |

**3. 수정 파일**
| 파일 | 변경 |
|------|------|
| `src/services/scheduleService.ts` | ScheduleMerger 사용 |
| `src/services/applicantManagementService.ts` | WorkLogCreator 사용 |

### 완료 기준
- [x] ScheduleMerger.test.ts 통과
- [x] WorkLog 우선 병합 정상
- [x] 다중 날짜 Application 처리 정상

### 커밋
```
refactor(domains): Phase 5 - 스케줄 병합 ScheduleMerger로 분리
```

### ✅ Phase 5 완료됨

---

## Phase 6: 정산 계산기 통합 (최우선)

### 목표
정산 계산 로직을 SettlementCalculator로 통합 + 캐싱

### 작업 순서

**1. 테스트 작성 (기존 함수와 비교 필수)**
```
src/domains/__tests__/SettlementCalculator.test.ts
```

**2. 신규 파일**
| 파일 | 설명 |
|------|------|
| `src/domains/settlement/SettlementCalculator.ts` | 정산 계산 |
| `src/domains/settlement/SettlementCache.ts` | 5분 TTL 캐시 |
| `src/domains/settlement/TaxCalculator.ts` | 세금 계산 분리 |
| `src/domains/settlement/index.ts` | 배럴 export |

**3. 수정 파일**
| 파일 | 변경 |
|------|------|
| `src/utils/settlement/index.ts` | SettlementCalculator로 이동 |
| `src/services/settlementService.ts` | Calculator + Cache 사용 |
| `src/services/scheduleService.ts` | Calculator 사용 |

### 완료 기준
- [x] SettlementCalculator.test.ts 통과
- [x] **기존 계산 결과와 100% 일치** (필수)
- [x] 캐시 동작 확인

### 커밋
```
refactor(domains): Phase 6 - 정산 계산 SettlementCalculator로 통합
```

### ✅ Phase 6 완료됨

---

## Phase 7-12: 후속 작업

| Phase | 목표 | 핵심 파일 | 상태 |
|:-----:|------|----------|:----:|
| 7 | 도메인 모듈 구조 완성 | `src/domains/*/index.ts` | ✅ 완료 |
| 8 | Query Keys 최적화 | `src/lib/queryClient.ts` (canConvertToStaff 추가), 9개 컴포넌트 수정 | ✅ 완료 |
| 9 | 레거시 필드 정리 | - | 🗑️ 삭제됨 (Firestore 스키마 변경 허용으로 불필요) |
| 10 | 중복 유틸리티 통합 | `src/utils/formatters.ts` | ✅ 완료 (단일 파일로 통합됨) |
| 11 | 에러 처리 표준화 | `src/shared/errors/hookErrorHandler.ts` | ✅ 완료 |
| 12 | 실시간 구독 통합 | `src/shared/realtime/RealtimeManager.ts` | ✅ 완료 |

### Phase 8 세부사항
- `queryKeys.applicantManagement.canConvertToStaff()` 추가
- `queryKeys.applicantManagement.cancellationRequests()` 추가
- 9개 컴포넌트에서 하드코딩된 `['userProfile', userId]` → `queryKeys.user.profile(userId)` 변경
- **invalidateQueries 객체** (queryClient.ts:440-469):
  - 12개 도메인별 무효화 함수
  - 복합 무효화: `staffManagement(jobPostingId)`, `tournamentApproval()`
  - 별도 `queryInvalidation.ts` 파일 대신 `queryClient.ts`에 통합

### Phase 10 세부사항 (유틸리티 통합)

**상태**: ✅ 완료 - 별도 폴더 생성 대신 기존 `formatters.ts` 단일 파일로 유지

**원래 계획 vs 실제 구현**:
| 원래 계획 | 실제 구현 | 이유 |
|---------|---------|------|
| `src/utils/format/date.ts` | `src/utils/dateUtils.ts` | 이미 존재, 충분히 통합됨 |
| `src/utils/format/currency.ts` | `src/utils/settlement/index.ts` | formatCurrency 포함 |
| `src/utils/format/time.ts` | `src/utils/dateUtils.ts` | 시간 포맷도 포함 |
| `src/utils/format/role.ts` | `src/utils/formatters.ts` | formatRole, formatRoles 포함 |
| `src/utils/format/index.ts` | `src/utils/formatters.ts` | 통합 파일 역할 |

**현재 유틸리티 구조** (`src/utils/`):
```
utils/
├── formatters.ts          # 통합 포맷팅 (20+ 함수)
│   ├── formatNumber, formatCurrencyShort
│   ├── formatPhone, maskPhone
│   ├── maskName, maskEmail
│   ├── formatRole, formatRoles
│   ├── formatSalaryType, formatSalary
│   ├── formatJobStatus, formatPositions
│   ├── formatPercent, formatFileSize
│   └── truncate, capitalize, padNumber
├── dateUtils.ts           # 날짜/시간 포맷팅
├── dateRangeUtils.ts      # 날짜 범위 유틸리티
├── settlement/index.ts    # 정산 (formatCurrency 포함)
├── allowanceUtils.ts      # 수당 포맷팅
├── normalizers/           # 정규화 유틸리티
│   ├── roleNormalizer.ts
│   └── scheduleNormalizer.ts
└── security.ts            # XSS 방지
```

**re-export 관계**:
- `formatters.ts`에서 `formatCurrency`를 `settlement/index.ts`에서 import 후 re-export
- 다른 모듈에서 `import { formatCurrency } from '@/utils/formatters'` 가능

**테스트**: `src/utils/__tests__/formatters.test.ts` 존재

### Phase 11 세부사항 (hookErrorHandler.ts)
- `createMutationErrorHandler()`: 뮤테이션용 표준 에러 핸들러
- `handleSilentError()`: 토스트 없이 로깅만
- `requireAuth()`: 인증 상태 타입 가드
- `extractErrorMessage()`, `canRetry()`, `needsReauth()` 유틸리티

### Phase 12 세부사항 (RealtimeManager.ts)
- 참조 카운트 기반 구독 관리
- 중복 구독 방지
- `Keys` 헬퍼로 일관된 키 패턴

---

## 검증 방법

### 각 Phase 완료 후
```bash
cd uniqn-mobile

# 1. 타입/린트 검사
npm run type-check && npm run lint

# 2. 테스트 실행
npm test

# 3. 수동 테스트
# - 스케줄 탭 정상 표시
# - QR 출퇴근 정상 동작
# - 정산 금액 정확
# - 실시간 구독 정상
```

### 문서 업데이트
각 Phase 완료 시 `tidy-fluttering-sutton.md`의 체크리스트 업데이트

---

## 위험 요소

| 위험 | 영향 | 대응 |
|------|:----:|------|
| 정산 금액 오차 | 높음 | 기존 함수와 비교 테스트 필수 |
| Firestore 쿼리 0건 | 높음 | 마이그레이션 순서 준수 |
| 실시간 구독 중단 | 높음 | onSnapshot 테스트 |

---

## 예상 일정

| 마일스톤 | Phase | 위험도 |
|---------|:-----:|:------:|
| M1: 기초 정규화 | 1, 2, 3, 4 | 낮음 |
| M2: 핵심 로직 | 5, 6 | **높음** |
| M3: 인프라 | 7, 8, 11, 12 | 중간 |
| M4: 정리 | 9, 10 | 낮음 |

---

## 범위 외 Phase (향후 검토)

| Phase | 목표 | 상태 | 비고 |
|:-----:|------|:----:|------|
| 13 | 테스트 전략 | 📋 | TDD 방식으로 각 Phase 구현 시 테스트 작성됨 |
| 14 | 컴포넌트 재사용 | 📋 | UI 리팩토링 단계에서 검토 예정 |

**참조**: `tidy-fluttering-sutton.md` Phase 13 (라인 2097), Phase 14 (라인 3304)
