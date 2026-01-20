# UNIQN Mobile 전체 리팩토링 계획

## 📋 개요

**목표**: 모바일 앱(uniqn-mobile/)의 데이터 구조, 서비스, 타입을 정리하여 일관성 및 유지보수성 향상

**범위**:
- 타입 파일 15개
- 서비스 파일 8개
- 훅 파일 10개+
- 유틸리티 파일 5개+

**제약 조건**:
- ✅ 기능 100% 유지
- ✅ Firestore 스키마(필드명, 문서 구조) 변경 없음
- ✅ 기존 import 경로 하위 호환 (re-export)

---

## 🎯 리팩토링 목표 구조

```
src/
├── shared/                     # 공유 모듈 (신규)
│   ├── status/                 # 상태 매핑 통합
│   │   ├── types.ts
│   │   ├── StatusMapper.ts
│   │   └── index.ts
│   ├── time/                   # 시간 처리 통합
│   │   ├── types.ts
│   │   ├── TimeNormalizer.ts
│   │   └── index.ts
│   ├── role/                   # 역할 처리 통합
│   │   ├── types.ts
│   │   ├── RoleResolver.ts
│   │   └── index.ts
│   ├── id/                     # ID 정규화
│   │   ├── IdNormalizer.ts
│   │   └── index.ts
│   └── migration/              # 레거시 필드 헬퍼
│       └── LegacyFieldHelper.ts
│
├── domains/                    # 도메인 모듈 (신규)
│   ├── job/
│   ├── application/
│   ├── schedule/
│   │   └── ScheduleMerger.ts   # 병합 로직 클래스
│   ├── settlement/
│   │   └── SettlementCalculator.ts  # 계산기 클래스
│   └── staff/
│
├── types/                      # 기존 (re-export로 호환성 유지)
├── services/                   # 기존 (re-export로 호환성 유지)
├── hooks/                      # 기존 유지
└── utils/                      # 중복 제거 후 정리
```

---

## 📅 단계별 구현 계획

### Phase 1: 상태 매핑 통합

**목표**: 7개 상태 타입 간 변환 로직을 단일 `StatusMapper` 클래스로 통합

**신규 파일**:
- `src/shared/status/types.ts`
- `src/shared/status/StatusMapper.ts`
- `src/shared/status/index.ts`

**수정 파일**:
- `src/types/schedule.ts` - `toAttendanceStatus()` 이동
- `src/services/confirmedStaffService.ts` - `mapWorkLogStatus()` 제거

**StatusMapper 설계**:
```typescript
export class StatusMapper {
  static toAttendance(status: WorkLogStatus): AttendanceStatus;
  static toConfirmedStaff(status: WorkLogStatus): ConfirmedStaffStatus;
  static applicationToSchedule(status: ApplicationStatus): ScheduleType | null;
}
```

---

### Phase 2: ID 정규화

**목표**: `eventId`/`jobPostingId` 혼용 문제 해결 (Firestore 스키마 변경 없이)

**신규 파일**:
- `src/shared/id/IdNormalizer.ts`
- `src/shared/id/index.ts`

**수정 파일**:
- `src/services/scheduleService.ts`
- `src/services/confirmedStaffService.ts`
- `src/services/settlementService.ts`

**IdNormalizer 설계**:
```typescript
export class IdNormalizer {
  static extractJobPostingId(doc: { eventId?: string; jobPostingId?: string }): string;
  static toEventId(jobPostingId: string): string; // 쿼리용 (레거시 호환)
}
```

---

### Phase 3: 시간 필드 정규화

**목표**: `actualStartTime`/`checkInTime` 중복 필드를 단일 인터페이스로 정규화

**신규 파일**:
- `src/shared/time/types.ts`
- `src/shared/time/TimeNormalizer.ts`
- `src/shared/time/index.ts`

**수정 파일**:
- `src/utils/settlement/index.ts`
- `src/services/confirmedStaffService.ts`

**TimeNormalizer 설계**:
```typescript
export interface NormalizedWorkTime {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualStart: Date | null;  // checkInTime 또는 actualStartTime
  actualEnd: Date | null;    // checkOutTime 또는 actualEndTime
  isEstimate: boolean;
}

export class TimeNormalizer {
  static normalize(workLog: WorkLog): NormalizedWorkTime;
  static calculateHours(normalized: NormalizedWorkTime): number;
}
```

---

### Phase 4: 역할 처리 통합

**목표**: `role/roles/roleIds/customRole` 처리 로직 통합

**신규 파일**:
- `src/shared/role/types.ts`
- `src/shared/role/RoleResolver.ts`
- `src/shared/role/index.ts`

**수정 파일**:
- `src/services/jobManagementService.ts`
- `src/services/confirmedStaffService.ts`

**RoleResolver 설계**:
```typescript
export interface ResolvedRole {
  code: string;
  displayName: string;
  isCustom: boolean;
}

export class RoleResolver {
  static resolve(role?: string, roles?: string[], roleIds?: string[], customRole?: string): ResolvedRole[];
  static getDisplayName(code: string, customRole?: string): string;
  static fromAssignment(assignment: Assignment): ResolvedRole[];
}
```

---

### Phase 5: 스케줄 병합 로직 분리

**목표**: 클라이언트 병합 로직을 `ScheduleMerger` 클래스로 캡슐화

**신규 파일**:
- `src/domains/schedule/ScheduleMerger.ts`
- `src/domains/schedule/index.ts`

**수정 파일**:
- `src/services/scheduleService.ts` - 내부 병합 로직 교체
- `src/utils/scheduleGrouping.ts` - 기능 이동

**ScheduleMerger 설계**:
```typescript
export interface MergeOptions {
  includeApplications: boolean;
  groupByApplication: boolean;
  minGroupSize: number;
}

export class ScheduleMerger {
  static merge(
    workLogs: WorkLog[],
    applications: Application[],
    jobPostings: Map<string, JobPostingCard>,
    options?: Partial<MergeOptions>
  ): ScheduleEvent[];

  static groupByDate(events: ScheduleEvent[]): ScheduleGroup[];
  static groupByApplication(events: ScheduleEvent[]): (ScheduleEvent | GroupedScheduleEvent)[];
}
```

---

### Phase 6: 정산 계산기 통합

**목표**: 정산 계산 로직을 `SettlementCalculator` 클래스로 통합

**신규 파일**:
- `src/domains/settlement/SettlementCalculator.ts`
- `src/domains/settlement/index.ts`

**수정 파일**:
- `src/utils/settlement/index.ts` - 핵심 로직 이동
- `src/services/settlementService.ts`
- `src/services/scheduleService.ts`

**SettlementCalculator 설계**:
```typescript
export interface CalculationInput {
  workLog: WorkLog;
  jobPostingCard?: JobPostingCard;
  overrides?: {
    salaryInfo?: SalaryInfo;
    allowances?: Allowances;
    taxSettings?: TaxSettings;
  };
}

export class SettlementCalculator {
  static calculate(input: CalculationInput): SettlementBreakdown;
  static calculateTotal(inputs: CalculationInput[], returnAfterTax?: boolean): number;
  static getSalaryForRole(role: string, customRole: string | undefined, jobPostingCard: JobPostingCard | undefined, override?: SalaryInfo): SalaryInfo;
}
```

---

### Phase 7: 도메인 모듈 구조 완성

**목표**: 나머지 도메인 모듈 생성 및 기존 코드 re-export

**신규 파일**:
- `src/domains/job/index.ts`
- `src/domains/application/index.ts`
- `src/domains/staff/index.ts`

**수정 파일**:
- `src/services/index.ts` - re-export 추가
- `src/types/index.ts` - re-export 추가

**하위 호환성 유지**:
```typescript
// src/services/index.ts
export * from '../domains/job';
export * from '../domains/application';
export * from '../domains/schedule';
export * from '../domains/settlement';
export * from '../domains/staff';
```

---

### Phase 8: Query Keys 최적화

**목표**: 캐시 무효화 패턴 최적화 및 중복 제거

**수정 파일**:
- `src/lib/queryClient.ts`

**개선된 캐시 무효화 패턴**:
```typescript
export const invalidateQueries = {
  job: (jobPostingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.job.detail(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.application.byJob(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.staff.confirmed.byJob(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJob(jobPostingId) });
  },

  staffChange: (jobPostingId: string, staffId: string) => {
    invalidateQueries.job(jobPostingId);
    queryClient.invalidateQueries({ queryKey: queryKeys.schedule.mine() });
  },
};
```

---

### Phase 9: 레거시 필드 정리

**목표**: deprecated 필드 타입에서 제거하고 마이그레이션 헬퍼 제공

**신규 파일**:
- `src/shared/migration/LegacyFieldHelper.ts`

**수정 파일**:
- `src/types/schedule.ts` - 필드 정리
- `src/types/confirmedStaff.ts` - 필드 정리

**LegacyFieldHelper 설계**:
```typescript
export class LegacyFieldHelper {
  static normalizeWorkLog(raw: unknown): WorkLog;
  static withLegacyFields(data: Partial<WorkLog>): Record<string, unknown>;
}
```

---

### Phase 10: 중복 유틸리티 통합

**목표**: 산재된 유틸리티 함수 정리

**신규/수정 파일**:
- `src/utils/format/date.ts`
- `src/utils/format/currency.ts`
- `src/utils/format/time.ts`
- `src/utils/format/index.ts`

---

## 📁 파일 변경 요약

### 신규 생성 (20개)

```
src/shared/status/types.ts
src/shared/status/StatusMapper.ts
src/shared/status/index.ts
src/shared/id/IdNormalizer.ts
src/shared/id/index.ts
src/shared/time/types.ts
src/shared/time/TimeNormalizer.ts
src/shared/time/index.ts
src/shared/role/types.ts
src/shared/role/RoleResolver.ts
src/shared/role/index.ts
src/shared/migration/LegacyFieldHelper.ts
src/domains/schedule/ScheduleMerger.ts
src/domains/settlement/SettlementCalculator.ts
src/domains/job/index.ts
src/domains/application/index.ts
src/domains/schedule/index.ts
src/domains/settlement/index.ts
src/domains/staff/index.ts
src/utils/format/index.ts
```

### 수정 (15개)

```
src/services/scheduleService.ts
src/services/settlementService.ts
src/services/confirmedStaffService.ts
src/services/jobManagementService.ts
src/services/applicationService.ts
src/services/index.ts
src/types/schedule.ts
src/types/confirmedStaff.ts
src/types/index.ts
src/hooks/useSchedules.ts
src/lib/queryClient.ts
src/utils/settlement/index.ts
src/utils/scheduleGrouping.ts
src/utils/index.ts
```

---

## ✅ 검증 방법

### 각 Phase 완료 후

```bash
cd uniqn-mobile
npm run type-check   # TypeScript 에러 0개
npm run lint         # ESLint 에러 0개
```

### 전체 완료 후 수동 테스트

| 기능 | 테스트 항목 |
|------|-----------|
| 스케줄 탭 | WorkLog/Application 기반 스케줄 표시, 그룹핑 |
| 정산 탭 | 금액 계산, 개별 오버라이드, 세금 |
| 스태프 관리 | 확정/취소, 역할 변경, 시간 수정 |
| 공고 관리 | 생성/수정, 역할 설정 |
| 지원 플로우 | 지원/확정/취소 요청 |
| 실시간 구독 | onSnapshot 정상 동작 |

---

## ⚠️ 위험 요소 및 대응

| 위험 | 대응 |
|------|------|
| Firestore 쿼리 호환성 | `IdNormalizer`로 쿼리 레벨에서 호환성 유지 |
| 실시간 구독 중단 | 각 Phase에서 onSnapshot 테스트 필수 |
| 정산 금액 오차 | 기존 계산 결과와 비교 테스트 |
| Import 순환 의존성 | `type` import 사용, 레이어 규칙 준수 |

---

## 📊 예상 일정

| Phase | 작업 | 소요 |
|-------|------|------|
| 1 | 상태 매핑 통합 | 1-2일 |
| 2 | ID 정규화 | 1일 |
| 3 | 시간 필드 정규화 | 1일 |
| 4 | 역할 처리 통합 | 1-2일 |
| 5 | 스케줄 병합 로직 분리 | 2일 |
| 6 | 정산 계산기 통합 | 2일 |
| 7 | 도메인 모듈 구조 완성 | 2-3일 |
| 8 | Query Keys 최적화 | 1일 |
| 9 | 레거시 필드 정리 | 1일 |
| 10 | 중복 유틸리티 통합 | 1일 |
| **합계** | | **13-16일** |

---

## 🔑 핵심 파일

1. `src/services/scheduleService.ts` - 스케줄 병합 핵심 로직
2. `src/utils/settlement/index.ts` - 정산 계산 핵심 로직
3. `src/types/schedule.ts` - 상태 타입 및 변환 함수
4. `src/lib/queryClient.ts` - Query Keys 중앙 관리
5. `src/services/confirmedStaffService.ts` - 상태 매핑, 시간 필드 처리
