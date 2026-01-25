# UNIQN Mobile 전체 리팩토링 계획

## 📋 개요

**목표**: 모바일 앱(uniqn-mobile/)의 데이터 구조, 서비스, 타입을 정리하여 일관성 및 유지보수성 향상

**범위** (2025-01-20 분석 기준):
- 타입 파일 24개 (총 2,500+ 줄)
- 스키마 파일 18개
- 서비스 파일 31개 (총 16,408줄)
- 훅 파일 33개
- 스토어 7개 (Zustand)
- 유틸리티 파일 15개+

**제약 조건**:
- ✅ 기능 100% 유지
- ✅ **Firestore 스키마 변경 가능** (마이그레이션 스크립트로 처리)
  - `eventId` → `jobPostingId` 통일
  - 기존 데이터 일괄 마이그레이션 진행
- ✅ 기존 import 경로 하위 호환 (re-export)
- ✅ 실시간 구독(onSnapshot) 정상 동작 유지
- ✅ 트랜잭션 무결성 유지

**🔥 2025-01-20 계획 변경**: Firestore 스키마 변경 허용으로 대폭 단순화
- Phase 2: IdNormalizer → **ID 마이그레이션**으로 변경
- Phase 9: 레거시 필드 정리 → **삭제** (더 이상 불필요)
- 전체 복잡도 40% 감소 예상

---

## 🧪 Phase별 필수 테스트 명세

> ⚠️ **중요**: 각 Phase 작업 **전**에 해당 테스트를 먼저 작성하여 리팩토링 전/후 동작 일치 검증

### 테스트 실행 순서

```bash
# Phase 시작 전 해당 테스트 먼저 작성
# 기존 함수로 테스트 통과 확인 후 리팩토링

# Phase 1 전
npm test -- StatusMapper.test.ts

# Phase 2 전
npm test -- IdNormalizer.test.ts

# Phase 3 전
npm test -- TimeNormalizer.test.ts

# Phase 4 전
npm test -- RoleResolver.test.ts

# Phase 5 전
npm test -- ScheduleMerger.test.ts

# Phase 6 전 (가장 중요)
npm test -- SettlementCalculator.test.ts

# 전체 검증
npm test
```

### 테스트 파일 목록

| Phase | 테스트 파일 | 우선순위 |
|:-----:|------------|:--------:|
| 1 | `src/shared/__tests__/StatusMapper.test.ts` | 🔴 높음 |
| 2 | `src/shared/__tests__/IdNormalizer.test.ts` | 🔴 높음 |
| 3 | `src/shared/__tests__/TimeNormalizer.test.ts` | 🟠 중간 |
| 4 | `src/shared/__tests__/RoleResolver.test.ts` | 🟠 중간 |
| 5 | `src/domains/__tests__/ScheduleMerger.test.ts` | 🟡 낮음 |
| 6 | `src/domains/__tests__/SettlementCalculator.test.ts` | 🔴 **최우선** |

---

### Phase 1: 상태 매핑 테스트

**파일**: `src/shared/__tests__/StatusMapper.test.ts`

```typescript
describe('StatusMapper', () => {
  describe('toAttendance', () => {
    it.each([
      ['scheduled', 'not_started'],
      ['checked_in', 'checked_in'],
      ['checked_out', 'checked_out'],
      ['completed', 'checked_out'],
      ['cancelled', 'not_started'],
    ])('WorkLogStatus %s → AttendanceStatus %s', (input, expected) => {
      expect(StatusMapper.toAttendance(input as WorkLogStatus)).toBe(expected);
    });
  });

  describe('workLogToSchedule', () => {
    it.each([
      ['scheduled', 'confirmed'],
      ['checked_in', 'confirmed'],  // 🔴 현재 버그: 'confirmed' 반환
      ['checked_out', 'completed'],
      ['completed', 'completed'],
      ['cancelled', 'cancelled'],
    ])('WorkLogStatus %s → ScheduleType %s', (input, expected) => {
      expect(StatusMapper.workLogToSchedule(input as WorkLogStatus)).toBe(expected);
    });
  });

  describe('applicationToSchedule', () => {
    it.each([
      ['applied', 'applied'],
      ['pending', 'applied'],
      ['confirmed', 'confirmed'],
      ['rejected', null],
      ['cancelled', 'cancelled'],
      ['completed', 'completed'],
      ['cancellation_pending', 'confirmed'],
    ])('ApplicationStatus %s → ScheduleType %s', (input, expected) => {
      expect(StatusMapper.applicationToSchedule(input as ApplicationStatus)).toBe(expected);
    });
  });

  describe('canTransition', () => {
    // 유효한 전이
    it.each([
      ['scheduled', 'checked_in'],
      ['checked_in', 'checked_out'],
      ['checked_out', 'completed'],
      ['scheduled', 'cancelled'],
    ])('✅ %s → %s 허용', (from, to) => {
      expect(StatusMapper.canTransition(from as WorkLogStatus, to as WorkLogStatus)).toBe(true);
    });

    // 무효한 전이
    it.each([
      ['checked_in', 'scheduled'],  // 역방향
      ['completed', 'checked_in'],  // 완료 후 변경
      ['cancelled', 'scheduled'],   // 취소 후 복구
    ])('❌ %s → %s 거부', (from, to) => {
      expect(StatusMapper.canTransition(from as WorkLogStatus, to as WorkLogStatus)).toBe(false);
    });
  });
});
```

---

### Phase 2: ID 정규화 테스트

**파일**: `src/shared/__tests__/IdNormalizer.test.ts`

```typescript
describe('IdNormalizer', () => {
  describe('normalizeJobId', () => {
    it('jobPostingId 우선 반환', () => {
      expect(IdNormalizer.normalizeJobId({
        jobPostingId: 'JOB123',
        eventId: 'EVENT456',
      })).toBe('JOB123');
    });

    it('jobPostingId 없으면 eventId 반환', () => {
      expect(IdNormalizer.normalizeJobId({
        eventId: 'EVENT456',
      })).toBe('EVENT456');
    });

    it('둘 다 없으면 빈 문자열', () => {
      expect(IdNormalizer.normalizeJobId({})).toBe('');
    });
  });

  describe('normalizeUserId', () => {
    it('staffId 우선 반환', () => {
      expect(IdNormalizer.normalizeUserId({
        staffId: 'STAFF123',
        applicantId: 'APP456',
      })).toBe('STAFF123');
    });

    it('staffId 없으면 applicantId 반환', () => {
      expect(IdNormalizer.normalizeUserId({
        applicantId: 'APP456',
      })).toBe('APP456');
    });
  });

  describe('generateApplicationId / parseApplicationId', () => {
    it('생성 후 파싱하면 원본 복원', () => {
      const jobPostingId = 'JOB123';
      const applicantId = 'USER456';

      const applicationId = IdNormalizer.generateApplicationId(jobPostingId, applicantId);
      const parsed = IdNormalizer.parseApplicationId(applicationId);

      expect(parsed.jobPostingId).toBe(jobPostingId);
      expect(parsed.applicantId).toBe(applicantId);
    });
  });

  describe('extractUnifiedIds', () => {
    it('WorkLog + Application에서 중복 없이 ID 추출', () => {
      const workLogs = [
        { eventId: 'JOB1' },
        { eventId: 'JOB2' },
      ] as WorkLog[];

      const applications = [
        { jobPostingId: 'JOB2' },  // 중복
        { jobPostingId: 'JOB3' },
      ] as Application[];

      const ids = IdNormalizer.extractUnifiedIds(workLogs, applications);

      expect(ids.size).toBe(3);
      expect(ids.has('JOB1')).toBe(true);
      expect(ids.has('JOB2')).toBe(true);
      expect(ids.has('JOB3')).toBe(true);
    });
  });
});
```

---

### Phase 3: 시간 정규화 테스트

**파일**: `src/shared/__tests__/TimeNormalizer.test.ts`

```typescript
describe('TimeNormalizer', () => {
  describe('normalize', () => {
    it('checkInTime → actualStart 매핑', () => {
      const workLog = {
        checkInTime: new Date('2025-01-20T09:00:00'),
        checkOutTime: new Date('2025-01-20T18:00:00'),
      } as WorkLog;

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).toEqual(workLog.checkInTime);
      expect(normalized.actualEnd).toEqual(workLog.checkOutTime);
    });

    it('actualStartTime 우선 (레거시 필드보다)', () => {
      const workLog = {
        actualStartTime: new Date('2025-01-20T09:00:00'),
        checkInTime: new Date('2025-01-20T09:05:00'),  // 다른 값
      } as WorkLog;

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).toEqual(workLog.actualStartTime);
    });

    it('출근만 하고 퇴근 안 한 경우', () => {
      const workLog = {
        checkInTime: new Date('2025-01-20T09:00:00'),
        checkOutTime: null,
      } as WorkLog;

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).not.toBeNull();
      expect(normalized.actualEnd).toBeNull();
    });
  });

  describe('calculateHours', () => {
    it('9시간 근무 계산', () => {
      const normalized = {
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T18:00:00'),
      } as NormalizedWorkTime;

      expect(TimeNormalizer.calculateHours(normalized)).toBe(9);
    });

    it('퇴근 시간 없으면 0 반환', () => {
      const normalized = {
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: null,
      } as NormalizedWorkTime;

      expect(TimeNormalizer.calculateHours(normalized)).toBe(0);
    });

    it('30분 단위 반올림', () => {
      const normalized = {
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T17:45:00'),  // 8시간 45분
      } as NormalizedWorkTime;

      // 정책에 따라 8.5 또는 9
      expect(TimeNormalizer.calculateHours(normalized)).toBeCloseTo(8.75, 2);
    });
  });
});
```

---

### Phase 4: 역할 처리 테스트

**파일**: `src/shared/__tests__/RoleResolver.test.ts`

```typescript
describe('RoleResolver', () => {
  describe('resolve', () => {
    it('roles[] 배열 처리', () => {
      const result = RoleResolver.resolve(undefined, ['dealer', 'manager']);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('dealer');
      expect(result[1].code).toBe('manager');
    });

    it('단일 role 문자열 처리', () => {
      const result = RoleResolver.resolve('dealer');

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('dealer');
    });

    it('customRole 표시명 적용', () => {
      const result = RoleResolver.resolve('dealer', undefined, undefined, '수석딜러');

      expect(result[0].code).toBe('dealer');
      expect(result[0].displayName).toBe('수석딜러');
      expect(result[0].isCustom).toBe(true);
    });
  });

  describe('getDisplayName', () => {
    it.each([
      ['dealer', '딜러'],
      ['manager', '매니저'],
      ['floor', '플로어'],
      ['staff', '스태프'],
    ])('역할 코드 %s → 표시명 %s', (code, expected) => {
      expect(RoleResolver.getDisplayName(code)).toBe(expected);
    });

    it('customRole 있으면 우선', () => {
      expect(RoleResolver.getDisplayName('dealer', '수석딜러')).toBe('수석딜러');
    });
  });

  describe('hasPermission', () => {
    it.each([
      ['admin', 'admin', true],
      ['admin', 'employer', true],
      ['admin', 'staff', true],
      ['employer', 'employer', true],
      ['employer', 'staff', true],
      ['employer', 'admin', false],
      ['staff', 'staff', true],
      ['staff', 'employer', false],
      ['staff', 'admin', false],
      [null, 'staff', false],
    ])('userRole=%s, required=%s → %s', (userRole, required, expected) => {
      expect(RoleResolver.hasPermission(userRole as UserRole | null, required as UserRole)).toBe(expected);
    });
  });
});
```

---

### Phase 5: 스케줄 병합 테스트

**파일**: `src/domains/__tests__/ScheduleMerger.test.ts`

```typescript
describe('ScheduleMerger', () => {
  describe('merge', () => {
    it('WorkLog 우선 (Application과 중복 시)', () => {
      const workLogs = [
        createMockWorkLog({ eventId: 'JOB1', date: '2025-01-20', status: 'checked_in' }),
      ];
      const applications = [
        createMockApplication({ jobPostingId: 'JOB1', dates: ['2025-01-20'], status: 'confirmed' }),
      ];
      const jobPostings = new Map([['JOB1', createMockJobPostingCard()]]);

      const result = ScheduleMerger.merge(workLogs, applications, jobPostings);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('workLog');
      expect(result[0].attendanceStatus).toBe('checked_in');
    });

    it('Application만 있는 경우 포함', () => {
      const workLogs: WorkLog[] = [];
      const applications = [
        createMockApplication({ jobPostingId: 'JOB1', dates: ['2025-01-20'], status: 'applied' }),
      ];
      const jobPostings = new Map([['JOB1', createMockJobPostingCard()]]);

      const result = ScheduleMerger.merge(workLogs, applications, jobPostings);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('application');
      expect(result[0].scheduleType).toBe('applied');
    });

    it('다중 날짜 Application 각각 생성', () => {
      const applications = [
        createMockApplication({
          jobPostingId: 'JOB1',
          dates: ['2025-01-20', '2025-01-21', '2025-01-22'],
          status: 'confirmed',
        }),
      ];
      const jobPostings = new Map([['JOB1', createMockJobPostingCard()]]);

      const result = ScheduleMerger.merge([], applications, jobPostings);

      expect(result).toHaveLength(3);
    });
  });

  describe('groupByDate', () => {
    it('날짜별 그룹핑', () => {
      const events = [
        createMockScheduleEvent({ date: '2025-01-20' }),
        createMockScheduleEvent({ date: '2025-01-20' }),
        createMockScheduleEvent({ date: '2025-01-21' }),
      ];

      const groups = ScheduleMerger.groupByDate(events);

      expect(groups).toHaveLength(2);
      expect(groups[0].date).toBe('2025-01-20');
      expect(groups[0].events).toHaveLength(2);
      expect(groups[1].date).toBe('2025-01-21');
      expect(groups[1].events).toHaveLength(1);
    });
  });

  describe('groupByApplication', () => {
    it('같은 applicationId 연속 근무 그룹화', () => {
      const events = [
        createMockScheduleEvent({ applicationId: 'APP1', date: '2025-01-20' }),
        createMockScheduleEvent({ applicationId: 'APP1', date: '2025-01-21' }),
        createMockScheduleEvent({ applicationId: 'APP1', date: '2025-01-22' }),
        createMockScheduleEvent({ applicationId: 'APP2', date: '2025-01-20' }),
      ];

      const result = ScheduleMerger.groupByApplication(events);

      // APP1: 3일 연속 → 1개 그룹, APP2: 1개 단독
      expect(result.filter(r => 'events' in r)).toHaveLength(1);  // 그룹
      expect(result.filter(r => !('events' in r))).toHaveLength(1);  // 단독
    });
  });
});
```

---

### Phase 6: 정산 계산 테스트 (🔴 최우선)

**파일**: `src/domains/__tests__/SettlementCalculator.test.ts`

```typescript
describe('SettlementCalculator', () => {
  // 🔴 리팩토링 전 기존 함수 결과와 비교 (스냅샷)
  describe('기존 함수와 결과 일치 검증', () => {
    const testCases = [
      {
        name: '시급 8시간 기본',
        workLog: { hoursWorked: 8, role: 'dealer' },
        jobPosting: { salaryInfo: { type: 'hourly', amount: 15000 } },
      },
      {
        name: '시급 + 세금 3.3%',
        workLog: { hoursWorked: 8, role: 'dealer' },
        jobPosting: {
          salaryInfo: { type: 'hourly', amount: 15000 },
          taxSettings: { type: 'rate', value: 3.3 },
        },
      },
      {
        name: '일급 + 수당',
        workLog: { hoursWorked: 10, role: 'manager' },
        jobPosting: {
          salaryInfo: { type: 'daily', amount: 200000 },
          allowances: { meal: 10000, transportation: 5000 },
        },
      },
      {
        name: '일급 + 고정세금',
        workLog: { hoursWorked: 8, role: 'staff' },
        jobPosting: {
          salaryInfo: { type: 'daily', amount: 150000 },
          taxSettings: { type: 'fixed', value: 5000 },
        },
      },
    ];

    it.each(testCases)('$name', ({ workLog, jobPosting }) => {
      // 기존 방식
      const legacyResult = calculateSettlementBreakdown(
        createMockWorkLog(workLog),
        createMockJobPosting(jobPosting)
      );

      // 신규 방식
      const newResult = SettlementCalculator.calculate({
        workLog: createMockWorkLog(workLog),
        jobPostingCard: toJobPostingCard(createMockJobPosting(jobPosting)),
      });

      expect(newResult.grossPay).toBe(legacyResult.grossPay);
      expect(newResult.netPay).toBe(legacyResult.netPay);
      expect(newResult.taxAmount).toBe(legacyResult.taxAmount);
      expect(newResult.totalAllowances).toBe(legacyResult.totalAllowances);
    });
  });

  describe('경계값 테스트', () => {
    it('0시간 근무', () => {
      const result = SettlementCalculator.calculate({
        workLog: createMockWorkLog({ hoursWorked: 0 }),
        jobPostingCard: createMockJobPostingCard({ salaryInfo: { type: 'hourly', amount: 15000 } }),
      });

      expect(result.grossPay).toBe(0);
      expect(result.netPay).toBe(0);
    });

    it('PROVIDED_FLAG (-1) 수당 처리', () => {
      const result = SettlementCalculator.calculate({
        workLog: createMockWorkLog({ hoursWorked: 8 }),
        jobPostingCard: createMockJobPostingCard({
          salaryInfo: { type: 'daily', amount: 100000 },
          allowances: { meal: -1, transportation: 5000 },  // -1 = 제공됨
        }),
      });

      // meal은 금액에 포함 안 됨, transportation만 포함
      expect(result.totalAllowances).toBe(5000);
    });

    it('세금이 급여보다 큰 경우 (비정상)', () => {
      const result = SettlementCalculator.calculate({
        workLog: createMockWorkLog({ hoursWorked: 1 }),  // 1시간 = 15000원
        jobPostingCard: createMockJobPostingCard({
          salaryInfo: { type: 'hourly', amount: 15000 },
          taxSettings: { type: 'fixed', value: 20000 },  // 고정세금 > 급여
        }),
      });

      // 정책: netPay 최소 0
      expect(result.netPay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('역할별 급여 조회', () => {
    it('역할별 급여 정보 반환', () => {
      const jobPostingCard = createMockJobPostingCard({
        roles: [
          { role: 'dealer', salaryInfo: { type: 'hourly', amount: 15000 } },
          { role: 'manager', salaryInfo: { type: 'daily', amount: 200000 } },
        ],
      });

      const dealerSalary = SettlementCalculator.getSalaryForRole('dealer', undefined, jobPostingCard);
      const managerSalary = SettlementCalculator.getSalaryForRole('manager', undefined, jobPostingCard);

      expect(dealerSalary.amount).toBe(15000);
      expect(managerSalary.amount).toBe(200000);
    });

    it('customRole 우선 적용', () => {
      const jobPostingCard = createMockJobPostingCard({
        roles: [
          { role: 'dealer', salaryInfo: { type: 'hourly', amount: 15000 } },
        ],
        customRoles: [
          { name: '수석딜러', salaryInfo: { type: 'hourly', amount: 20000 } },
        ],
      });

      const salary = SettlementCalculator.getSalaryForRole('dealer', '수석딜러', jobPostingCard);

      expect(salary.amount).toBe(20000);  // customRole 급여
    });
  });
});
```

---

## 🔄 상태 플로우 다이어그램

### Application → WorkLog → Settlement 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              지원 플로우                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [지원서 제출]     [구인자 확정]      [QR 출근]       [QR 퇴근]      [정산]    │
│       │                │                │               │            │      │
│       ▼                ▼                ▼               ▼            ▼      │
│  Application      Application       WorkLog        WorkLog      WorkLog    │
│   (applied)       (confirmed)      (scheduled)   (checked_in) (checked_out)│
│       │                │                │               │            │      │
│       │                │                ▼               ▼            ▼      │
│       │                └──────────► WorkLog 생성   actualStart  actualEnd  │
│       │                              (scheduled)      기록          기록     │
│       │                                                              │      │
│       ▼                                                              ▼      │
│  [지원 취소]                                                   Settlement    │
│  Application                                                  (completed)   │
│  (cancelled)                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 상태 매핑 테이블

| Application Status | WorkLog Status | Schedule Type | Attendance Status | 설명 |
|:------------------:|:--------------:|:-------------:|:-----------------:|------|
| `applied` | - | `applied` | - | 지원 완료 |
| `pending` | - | `applied` | - | 검토 중 |
| `confirmed` | `scheduled` | `confirmed` | `not_started` | 확정됨 |
| `rejected` | - | - | - | 거절됨 |
| `cancelled` | `cancelled` | `cancelled` | - | 취소됨 |
| `cancellation_pending` | - | `confirmed` | - | 취소 요청 중 |
| `completed` | `completed` | `completed` | `checked_out` | 완료 |
| - | `checked_in` | `confirmed` | `checked_in` | 출근함 |
| - | `checked_out` | `completed` | `checked_out` | 퇴근함 |

### 상태 변환 불일치 (현재 문제)

| 위치 | 함수 | `checked_in` 처리 | 수정 필요 |
|------|------|:-----------------:|:---------:|
| scheduleService.ts:112 | `workLogToScheduleEvent` | → `'confirmed'` | ❌ 버그 |
| confirmedStaffService.ts:103 | `mapWorkLogStatus` | → `'checked_in'` | ✅ 정상 |
| schedule.ts:34 | `toAttendanceStatus` | → `'checked_in'` | ✅ 정상 |

**Phase 1에서 반드시 통합 필요**

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
- `src/shared/status/statusFlow.ts`
- `src/shared/status/index.ts`

**수정 파일**:
- `src/types/schedule.ts` - `toAttendanceStatus()` 이동
- `src/services/confirmedStaffService.ts` - `mapWorkLogStatus()` 제거
- `src/services/scheduleService.ts` - `workLogToScheduleEvent()` 상태 매핑 수정

**StatusMapper 설계** (확장):
```typescript
// src/shared/status/types.ts
export type ApplicationStatus =
  | 'applied' | 'pending' | 'confirmed' | 'rejected'
  | 'cancelled' | 'completed' | 'cancellation_pending';

export type WorkLogStatus =
  | 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled';

export type ScheduleType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

export type PayrollStatus = 'pending' | 'processing' | 'completed';

// src/shared/status/StatusMapper.ts
export class StatusMapper {
  // 기존 변환
  static toAttendance(status: WorkLogStatus): AttendanceStatus;
  static toConfirmedStaff(status: WorkLogStatus): ConfirmedStaffStatus;
  static applicationToSchedule(status: ApplicationStatus): ScheduleType | null;

  // 🆕 추가 변환 (누락됨)
  static applicationToWorkLog(status: ApplicationStatus): WorkLogStatus | null;
  static workLogToSchedule(status: WorkLogStatus): ScheduleType;

  // 🆕 취소 요청 상태 통합 (cancellation_pending 처리)
  static isCancellationPending(app: {
    status: ApplicationStatus;
    cancellationRequest?: { status: string }
  }): boolean;

  // 🆕 상태 흐름 검증
  static canTransition(from: WorkLogStatus, to: WorkLogStatus): boolean;
  static getNextValidStatuses(current: WorkLogStatus): WorkLogStatus[];
}

// src/shared/status/statusFlow.ts
export const STATUS_FLOW = {
  application: {
    applied: ['pending', 'confirmed', 'rejected', 'cancelled'],
    pending: ['confirmed', 'rejected', 'cancelled'],
    confirmed: ['completed', 'cancellation_pending'],
    cancellation_pending: ['confirmed', 'cancelled'],
  },
  workLog: {
    scheduled: ['checked_in', 'cancelled'],
    checked_in: ['checked_out'],
    checked_out: ['completed'],
  },
} as const;
```

**버그 수정 필수**:
```typescript
// scheduleService.ts:112 - 현재 (버그)
case 'checked_in':
  return 'confirmed';  // ❌ 잘못됨

// 수정 후
case 'checked_in':
  return 'confirmed';  // ScheduleType에 'checked_in' 없으므로 정상
// 하지만 AttendanceStatus는 'checked_in' 반환 필요 → StatusMapper 사용
```

---

### Phase 2: ID 마이그레이션 🔥 (계획 변경됨)

**목표**: `eventId` → `jobPostingId` **완전 통일** (Firestore 스키마 변경)

> ⚠️ **2025-01-20 변경**: 스키마 변경 허용으로 정규화 레이어 불필요 → 직접 마이그레이션

---

#### 📊 실제 코드 분석 결과 (2025-01-20 기준)

**영향 범위** (16개 파일, 26개 핵심 위치):

| 카테고리 | 파일 수 | 혼용 심각도 | 설명 |
|---------|:------:|:----------:|------|
| **서비스** | 6개 | 🔴 높음 | Firestore 쿼리에서 직접 혼용 |
| **타입** | 5개 | 🟠 중간 | 인터페이스 필드 정의 |
| **훅** | 2개 | 🟡 낮음 | 서비스 호출 시 전달 |
| **스키마** | 3개 | 🟡 낮음 | Zod 검증 스키마 |

---

#### 🔴 서비스 파일별 상세 현황

**1. settlementService.ts** (8개 위치 - 가장 심각)
```typescript
// 라인 236, 810: 의도적 혼용 패턴
where('eventId', '==', jobPostingId)  // 매개변수는 jobPostingId, 쿼리는 eventId

// 라인 328, 398, 501, 600, 627, 747: WorkLog 필드 참조
workLog.eventId  // WorkLog에서 eventId 읽기
```

**2. scheduleService.ts** (7개 위치)
```typescript
// 라인 149, 169: WorkLog → ScheduleEvent 변환
eventId: workLog.eventId
applicationId: `${workLog.eventId}_${workLog.staffId}`  // 복합 키

// 라인 281, 317: Application → ScheduleEvent 변환
eventId: application.jobPostingId  // jobPostingId를 eventId로 매핑

// 라인 703: 명시적 주석
// "IdNormalizer로 통합 ID 추출 (eventId/jobPostingId 혼용 해결)"
```

**3. confirmedStaffService.ts** (4개 위치)
```typescript
// 라인 124 주석: @param jobPostingId 공고 ID (eventId)
// 라인 136, 200, 415, 515: 동일 패턴
where('eventId', '==', jobPostingId)
```

**4. eventQRService.ts** (6개 위치)
```typescript
// 라인 94, 123, 127, 145, 174, 225, 287, 293
eventId: input.eventId  // QR 데이터에서 eventId 사용
where('eventId', '==', eventId)
```

**5. applicantConversionService.ts** (5개 위치)
```typescript
// 라인 97, 211, 247, 317, 391
// 함수 매개변수명이 eventId이지만 실제로는 jobPostingId 역할
```

**6. applicationHistoryService.ts** (1개 위치)
```typescript
// 라인 349: 명시적 매핑
eventId: applicationData.jobPostingId
```

---

#### 🔵 타입 파일별 상세 현황

| 파일 | 인터페이스 | eventId 라인 | 상태 |
|------|-----------|:------------:|------|
| schedule.ts | ScheduleEvent | 133 | 필수 필드 |
| schedule.ts | GroupedScheduleEvent | 275 | 필수 필드 |
| schedule.ts | WorkLog | 421 | **핵심 - 필수 필드** |
| schedule.ts | EventQRCode | 575 | 필수 필드 |
| schedule.ts | EventQRDisplayData | 597 | 필수 필드 |
| schedule.ts | GenerateEventQRInput | 611 | 필수 필드 |
| schedule.ts | EventQRValidationResult | 633 | 선택 필드 |
| settlement.ts | GroupedSettlement | 54 | 필수 필드 |
| notification.ts | NotificationPayload | 464 | 선택 필드 |
| application.ts | Application | 105 | **레거시 (deprecated)** |

---

#### 🟡 스키마 파일 현황

| 파일 | 필드 | 라인 | 필수 여부 |
|------|------|:----:|:--------:|
| workLog.schema.ts | eventId | 50 | ✅ Required |
| settlement.schema.ts | eventId | 63, 82 | ✅/❓ |
| schedule.schema.ts | eventId | 45 | ✅ Required |

---

#### 🔍 혼용 패턴 분류

**패턴 A: 매개변수-쿼리 불일치** (가장 흔함, 6개 서비스)
```typescript
// 함수는 jobPostingId로 받지만, Firestore 쿼리에서는 eventId로 조회
function getWorkLogs(jobPostingId: string) {
  where('eventId', '==', jobPostingId)  // ⚠️ 혼용
}
```

**패턴 B: 타입 매핑** (Application → WorkLog 변환)
```typescript
// Application의 jobPostingId를 eventId로 변환
const workLog = {
  eventId: application.jobPostingId,  // ⚠️ 명시적 변환
  staffId: application.applicantId,
};
```

**패턴 C: WorkLog 필드 직접 사용** (정상적인 사용)
```typescript
// WorkLog 타입이 eventId를 가지므로 정상
const id = workLog.eventId;
```

---

#### ⚠️ 근본 원인

1. **WorkLog 스키마가 eventId 유지**: Firestore에 저장된 필드명이 `eventId`
2. **Application은 jobPostingId 사용**: 신규 표준으로 변경됨
3. **QR 코드 시스템이 eventId 기반**: 구조 자체가 eventId로 정의

---

**레거시 영향 범위** (참고용):
```
타입 파일 (5개): application.ts, settlement.ts, schedule.ts, notification.ts
서비스 (6개): scheduleService, settlementService, eventQRService, confirmedStaffService, applicantConversionService, applicationHistoryService
스키마 (3개): workLog.schema, settlement.schema, schedule.schema
훅 (2개): useApplicantManagement, useEventQR
```

---

### 📋 작업 순서 (5단계)

#### 2-1. 타입 파일 변경 (8개 인터페이스)

**schedule.ts** (7개 인터페이스 수정):
```typescript
// ScheduleEvent (라인 133)
interface ScheduleEvent {
  // eventId: string;  // ❌ 제거
  jobPostingId: string;  // ✅ 추가
}

// GroupedScheduleEvent (라인 275)
interface GroupedScheduleEvent {
  // eventId: string;  // ❌ 제거
  jobPostingId: string;  // ✅ 추가
}

// WorkLog (라인 421) - 핵심
interface WorkLog {
  // eventId: string;  // ❌ 제거
  jobPostingId: string;  // ✅ 추가
}

// EventQRCode (라인 575)
// EventQRDisplayData (라인 597)
// GenerateEventQRInput (라인 611)
// EventQRValidationResult (라인 633)
// 모두 동일하게 eventId → jobPostingId
```

**settlement.ts** (1개 인터페이스 수정):
```typescript
// GroupedSettlement (라인 54)
interface GroupedSettlement {
  // eventId: string;  // ❌ 제거
  jobPostingId: string;  // ✅ 추가
}
```

**notification.ts** (선택적):
```typescript
// NotificationPayload (라인 464) - 선택 필드이므로 후순위
// eventId?: string;  → jobPostingId?: string;
```

**application.ts** (정리):
```typescript
// Application (라인 105) - 이미 deprecated
// eventId 필드 완전 제거 (이미 optional)
```

---

#### 2-2. 서비스/훅 쿼리 변경 (31개 위치)

**settlementService.ts** (8개 위치):
| 라인 | 변경 전 | 변경 후 |
|:----:|---------|--------|
| 236 | `where('eventId', '==', jobPostingId)` | `where('jobPostingId', '==', jobPostingId)` |
| 328 | `workLog.eventId` | `workLog.jobPostingId` |
| 398 | `workLog.eventId` | `workLog.jobPostingId` |
| 501 | `workLog.eventId` | `workLog.jobPostingId` |
| 600 | `data.eventId` | `data.jobPostingId` |
| 627 | `workLog.eventId` | `workLog.jobPostingId` |
| 747 | `workLog.eventId` | `workLog.jobPostingId` |
| 810 | `where('eventId', '==', ...)` | `where('jobPostingId', '==', ...)` |

**scheduleService.ts** (7개 위치):
| 라인 | 변경 전 | 변경 후 |
|:----:|---------|--------|
| 149 | `eventId: workLog.eventId` | `jobPostingId: workLog.jobPostingId` |
| 169 | `${workLog.eventId}_${workLog.staffId}` | `${workLog.jobPostingId}_${workLog.staffId}` |
| 281 | `eventId: application.jobPostingId` | `jobPostingId: application.jobPostingId` |
| 317 | `eventId: application.jobPostingId` | `jobPostingId: application.jobPostingId` |
| 703 | 주석 업데이트 | (혼용 해결 완료 명시) |
| 836 | `workLog.eventId` | `workLog.jobPostingId` |
| 924 | `wl.eventId` | `wl.jobPostingId` |

**confirmedStaffService.ts** (4개 위치):
| 라인 | 변경 전 | 변경 후 |
|:----:|---------|--------|
| 136 | `where('eventId', '==', jobPostingId)` | `where('jobPostingId', '==', jobPostingId)` |
| 200 | 동일 | 동일 |
| 415 | 동일 | 동일 |
| 515 | 동일 | 동일 |

**eventQRService.ts** (6개 위치):
| 라인 | 변경 내용 |
|:----:|---------|
| 94, 123, 127, 145 | `eventId` → `jobPostingId` |
| 174, 225, 287, 293 | `where('eventId', '==', ...)` → `where('jobPostingId', '==', ...)` |

**applicantConversionService.ts** (5개 위치):
| 라인 | 변경 내용 |
|:----:|---------|
| 97, 317 | 함수 매개변수 `eventId` → `jobPostingId` |
| 211, 247 | WorkLog 생성 시 `eventId` → `jobPostingId` |
| 391 | 쿼리 필드 변경 |

**applicationHistoryService.ts** (1개 위치):
```typescript
// 라인 349
// eventId: applicationData.jobPostingId  // 제거
jobPostingId: applicationData.jobPostingId  // 그대로
```

---

#### 2-3. 스키마 파일 변경 (3개 파일)

```typescript
// workLog.schema.ts (라인 50)
// eventId: z.string().min(1, ...)  // ❌ 제거
jobPostingId: z.string().min(1, '공고 ID가 필요합니다')  // ✅ 추가

// settlement.schema.ts (라인 63, 82)
// eventId 필드 → jobPostingId로 변경

// schedule.schema.ts (라인 45)
// eventId 필드 → jobPostingId로 변경
```

---

#### 2-4. Firestore 마이그레이션 스크립트 (완전판)

```typescript
// functions/src/migration/migrateEventIdToJobPostingId.ts
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

interface MigrationResult {
  collection: string;
  migrated: number;
  skipped: number;
  errors: string[];
}

// 1. WorkLogs 마이그레이션
export async function migrateWorkLogs(): Promise<MigrationResult> {
  const result: MigrationResult = {
    collection: 'workLogs',
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  const BATCH_SIZE = 500;

  while (true) {
    let query = db.collection('workLogs')
      .where('eventId', '!=', null)
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // 이미 마이그레이션된 경우 스킵
      if (data.jobPostingId) {
        result.skipped++;
        continue;
      }

      try {
        batch.update(doc.ref, {
          jobPostingId: data.eventId,         // eventId 값 복사
          _migrated: true,                     // 마이그레이션 플래그
          _migratedAt: FieldValue.serverTimestamp(),
          _migratedFrom: 'eventId',
        });
        batchCount++;
      } catch (error) {
        result.errors.push(`${doc.id}: ${error}`);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      result.migrated += batchCount;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // 진행 상황 로깅
    console.log(`WorkLogs: ${result.migrated} migrated, ${result.skipped} skipped`);
  }

  return result;
}

// 2. EventQRCodes 마이그레이션
export async function migrateEventQRCodes(): Promise<MigrationResult> {
  const result: MigrationResult = {
    collection: 'eventQRCodes',
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  const snapshot = await db.collection('eventQRCodes').get();
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.jobPostingId) {
      result.skipped++;
      continue;
    }

    if (data.eventId) {
      batch.update(doc.ref, {
        jobPostingId: data.eventId,
        _migrated: true,
        _migratedAt: FieldValue.serverTimestamp(),
      });
      result.migrated++;
    }
  }

  if (result.migrated > 0) {
    await batch.commit();
  }

  return result;
}

// 3. 전체 마이그레이션 실행
export async function runFullMigration() {
  console.log('🚀 Starting ID Migration: eventId → jobPostingId');
  console.log('=' .repeat(50));

  const results: MigrationResult[] = [];

  // Step 1: WorkLogs
  console.log('\n📦 Migrating WorkLogs...');
  results.push(await migrateWorkLogs());

  // Step 2: EventQRCodes
  console.log('\n📦 Migrating EventQRCodes...');
  results.push(await migrateEventQRCodes());

  // 결과 요약
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Migration Summary:');
  for (const r of results) {
    console.log(`  ${r.collection}: ${r.migrated} migrated, ${r.skipped} skipped`);
    if (r.errors.length > 0) {
      console.log(`    ⚠️ Errors: ${r.errors.length}`);
    }
  }

  return results;
}

// 4. 롤백 스크립트
export async function rollbackMigration(collection: string = 'workLogs') {
  console.log(`🔄 Rolling back ${collection}...`);

  const snapshot = await db.collection(collection)
    .where('_migrated', '==', true)
    .get();

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      jobPostingId: FieldValue.delete(),
      _migrated: FieldValue.delete(),
      _migratedAt: FieldValue.delete(),
      _migratedFrom: FieldValue.delete(),
    });
    count++;
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`✅ Rolled back ${count} documents`);
  return { rolledBack: count };
}

// 5. 마이그레이션 검증
export async function verifyMigration(): Promise<{
  workLogs: { total: number; migrated: number; pending: number };
  eventQRCodes: { total: number; migrated: number; pending: number };
}> {
  const verifyCollection = async (name: string) => {
    const total = (await db.collection(name).count().get()).data().count;
    const migrated = (await db.collection(name)
      .where('jobPostingId', '!=', null)
      .count()
      .get()
    ).data().count;

    return { total, migrated, pending: total - migrated };
  };

  return {
    workLogs: await verifyCollection('workLogs'),
    eventQRCodes: await verifyCollection('eventQRCodes'),
  };
}
```

---

#### 2-5. IdNormalizer 단순화

```typescript
// src/shared/id/IdNormalizer.ts
// 마이그레이션 완료 후 단순화된 버전

export class IdNormalizer {
  // ✅ 유지: 복합 키 생성
  static generateApplicationId(jobPostingId: string, applicantId: string): string {
    return `${jobPostingId}_${applicantId}`;
  }

  // ✅ 유지: 복합 키 파싱
  static parseApplicationId(applicationId: string): {
    jobPostingId: string;
    applicantId: string;
  } {
    const [jobPostingId, applicantId] = applicationId.split('_');
    return { jobPostingId, applicantId };
  }

  // ❌ 제거: 정규화 로직 (더 이상 불필요)
  // static normalizeJobId() - 제거
  // static normalizeUserId() - 제거
  // static extractJobPostingId() - 제거
}

---

### 🗄️ 마이그레이션 대상 컬렉션

| 컬렉션 | 필드 변경 | 문서 수 (예상) | 우선순위 |
|--------|----------|:-------------:|:--------:|
| **workLogs** | `eventId` → `jobPostingId` | 1,000~10,000+ | 🔴 높음 |
| **eventQRCodes** | `eventId` → `jobPostingId` | 100~500 | 🔴 높음 |

**타입 변경만 필요** (Firestore 저장 안함):
| 타입 | 파일 | 용도 |
|------|------|------|
| ScheduleEvent | schedule.ts | 클라이언트 병합 결과 |
| GroupedScheduleEvent | schedule.ts | 그룹화된 스케줄 |
| GroupedSettlement | settlement.ts | 정산 그룹 |
| NotificationPayload | notification.ts | 알림 페이로드 |

---

### 📅 마이그레이션 실행 순서

```
Day 1: 준비
├── 1. Firestore 백업 (필수)
├── 2. 테스트 환경에서 마이그레이션 스크립트 검증
└── 3. 롤백 스크립트 테스트

Day 2: 코드 변경 (앱 배포 전)
├── 1. 타입 파일 변경 (8개 인터페이스)
├── 2. 스키마 파일 변경 (3개 파일)
├── 3. 서비스/훅 쿼리 변경 (31개 위치)
└── 4. npm run type-check && npm run lint

Day 3: 데이터 마이그레이션
├── 1. Firestore 마이그레이션 스크립트 실행
├── 2. 검증 스크립트로 결과 확인
├── 3. 앱 배포 (신규 코드)
└── 4. 모니터링 (24시간)

Day 4+: 정리 (선택적)
├── 1. eventId 필드 제거 스크립트 실행 (옵션)
└── 2. IdNormalizer 단순화
```

---

### ✅ Phase 2 완료 기준

**Phase 2A - @deprecated 추가 (완료)**:
- [x] 타입 파일에 @deprecated 주석 추가 (9곳)
- [x] IdNormalizer 호환성 레이어 적용
- [x] `npm run type-check` 에러 0개
- [x] `npm run lint` 에러 0개

**Phase 2B - 필드명 변경 (Firestore 마이그레이션 후)**:
- [ ] 타입 파일 8개 인터페이스에서 `eventId` → `jobPostingId`
- [ ] 서비스 파일 6개에서 31개 위치 수정
- [ ] 스키마 파일 3개 수정
- [ ] 훅 파일 2개 수정
- [ ] Firestore 마이그레이션 완료

**데이터 마이그레이션** (Phase 2B):
- [ ] Firestore 백업 완료
- [ ] workLogs 컬렉션 마이그레이션 완료
- [ ] eventQRCodes 컬렉션 마이그레이션 완료
- [ ] 검증 스크립트 통과 (pending: 0)

**기능 테스트** (Phase 2B):
- [ ] 스케줄 탭 정상 표시
- [ ] QR 출퇴근 정상 동작
- [ ] 정산 금액 정상 계산
- [ ] 실시간 구독(onSnapshot) 정상 동작

---

### ⚠️ 위험 요소 및 대응

| 위험 | 확률 | 영향 | 대응 |
|------|:----:|:----:|------|
| 쿼리 결과 0개 | 중간 | 🔴 높음 | 마이그레이션 전 쿼리 먼저 변경 금지 |
| 롤백 필요 | 낮음 | 🟠 중간 | 롤백 스크립트 준비 완료 |
| 부분 마이그레이션 | 낮음 | 🟡 낮음 | 페이지네이션으로 안전한 배치 처리 |
| 인덱스 누락 | 중간 | 🟠 중간 | `jobPostingId` 필드 인덱스 미리 생성 |

**Firestore 인덱스 추가 필요**:
```
// firestore.indexes.json에 추가
{
  "collectionGroup": "workLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "jobPostingId", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "DESCENDING" }
  ]
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
- `src/services/adminService.ts` - 권한 검증 표준화 🆕
- `src/services/announcementService.ts` - 권한 검증 표준화 🆕
- `src/stores/authStore.ts` - normalizeUserRole() 이동 🆕

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

  // 🆕 사용자 역할 정규화 (authStore에서 이동)
  static normalizeUserRole(role: string | null | undefined): UserRole;

  // 🆕 권한 검증 헬퍼
  static hasPermission(userRole: UserRole | null, required: UserRole): boolean;
  static requireAdmin(userRole: UserRole | null): void; // throws PermissionError
}
```

**🆕 권한 검증 표준화**:
```typescript
// ❌ 현재: authStore.ts에만 normalizeUserRole() 존재
// 다른 서비스들은 직접 string 비교

// ✅ 수정: RoleResolver로 통합
// adminService.ts, announcementService.ts 등에서 사용
RoleResolver.requireAdmin(currentUserRole);
// → admin 아니면 PermissionError 발생
```

---

### Phase 5: 스케줄 병합 로직 분리

**목표**: 클라이언트 병합 로직을 `ScheduleMerger` 클래스로 캡슐화

**신규 파일**:
- `src/domains/schedule/ScheduleMerger.ts`
- `src/domains/schedule/WorkLogCreator.ts` 🆕
- `src/domains/schedule/index.ts`

**수정 파일**:
- `src/services/scheduleService.ts` - 내부 병합 로직 교체
- `src/services/applicantManagementService.ts` - WorkLog 생성 로직 통합 🆕
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

**🆕 WorkLogCreator 설계** (확정 트랜잭션 통합):
```typescript
// src/domains/schedule/WorkLogCreator.ts
export class WorkLogCreator {
  // 지원자 확정 시 WorkLog 생성 (트랜잭션 내부용)
  static createFromApplication(
    transaction: Transaction,
    application: Application,
    assignment: Assignment,
    jobPosting: JobPostingCard
  ): DocumentReference {
    const workLogRef = doc(collection(db, 'workLogs'));
    const workLogData: WorkLog = {
      id: workLogRef.id,
      staffId: application.applicantId,
      jobPostingId: application.jobPostingId,
      eventId: application.jobPostingId,  // 레거시 호환
      status: 'scheduled',
      role: assignment.role,
      customRole: assignment.customRole,
      scheduledDate: assignment.date,
      scheduledStartTime: jobPosting.startTime,
      scheduledEndTime: jobPosting.endTime,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(workLogRef, workLogData);
    return workLogRef;
  }

  // 확정 취소 시 WorkLog 상태 변경
  static cancelWorkLog(
    transaction: Transaction,
    workLogRef: DocumentReference
  ): void {
    transaction.update(workLogRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
```

**확정 트랜잭션 통합 (현재 분산된 로직)**:
```typescript
// 현재: applicantManagementService.ts에서 직접 처리
// 개선: WorkLogCreator 사용
async function confirmApplicant(applicationId: string, assignment: Assignment) {
  return runTransaction(db, async (transaction) => {
    // 1. Application 조회 및 상태 변경
    const appDoc = await transaction.get(applicationRef);
    transaction.update(applicationRef, { status: 'confirmed' });

    // 2. WorkLog 생성 (통합된 로직 사용)
    WorkLogCreator.createFromApplication(
      transaction,
      appDoc.data() as Application,
      assignment,
      jobPostingCard
    );
  });
}
```

---

### Phase 6: 정산 계산기 통합

**목표**: 정산 계산 로직을 `SettlementCalculator` 클래스로 통합 + **캐싱으로 성능 개선**

**신규 파일**:
- `src/domains/settlement/SettlementCalculator.ts`
- `src/domains/settlement/SettlementCache.ts` 🆕
- `src/domains/settlement/TaxCalculator.ts` 🆕
- `src/domains/settlement/index.ts`

**수정 파일**:
- `src/utils/settlement/index.ts` - 핵심 로직 이동
- `src/services/settlementService.ts`
- `src/services/scheduleService.ts`

**SettlementCalculator 설계** (확장):
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
  // 기존
  static calculate(input: CalculationInput): SettlementBreakdown;
  static calculateTotal(inputs: CalculationInput[], returnAfterTax?: boolean): number;
  static getSalaryForRole(role: string, customRole: string | undefined, jobPostingCard: JobPostingCard | undefined, override?: SalaryInfo): SalaryInfo;

  // 🆕 캐시 연동
  static calculateWithCache(input: CalculationInput): SettlementBreakdown;
  static calculateBatch(inputs: CalculationInput[]): SettlementBreakdown[];
}
```

**🆕 SettlementCache 설계** (성능 개선):
```typescript
// src/domains/settlement/SettlementCache.ts
export class SettlementCache {
  private static cache = new Map<string, {
    breakdown: SettlementBreakdown;
    timestamp: number;
    inputHash: string;
  }>();

  private static readonly TTL = 5 * 60 * 1000; // 5분

  // 캐시 키 생성 (WorkLog ID + Override hash)
  static generateKey(workLogId: string, overrides?: object): string;

  // 캐시 조회
  static get(workLogId: string): SettlementBreakdown | null;

  // 캐시 저장
  static set(workLogId: string, breakdown: SettlementBreakdown, inputHash: string): void;

  // 캐시 무효화
  static invalidate(workLogId: string): void;
  static invalidateByJobPosting(jobPostingId: string): void;
  static clear(): void;

  // 🆕 입력값 변경 감지
  static isStale(workLogId: string, inputHash: string): boolean;
}
```

**🆕 TaxCalculator 분리**:
```typescript
// src/domains/settlement/TaxCalculator.ts
export class TaxCalculator {
  static calculate(grossPay: number, settings: TaxSettings): TaxBreakdown;
  static calculateByItems(grossPay: number, allowances: number, settings: TaxSettings): TaxBreakdown;

  // 세금 타입별 계산
  private static calculateFixedTax(grossPay: number, fixedAmount: number): number;
  private static calculateRateTax(taxableAmount: number, rate: number): number;
}

export interface TaxBreakdown {
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
  taxType: 'none' | 'fixed' | 'rate';
}
```

**현재 중복 계산 문제 (4회 반복)**:
```typescript
// 1️⃣ settlementService.getWorkLogsByJobPosting() - 라인 270
// 2️⃣ settlementService.calculateSettlement() - 라인 342
// 3️⃣ settlementService.bulkSettlement() - 라인 665
// 4️⃣ scheduleService.workLogToScheduleEvent() - 매 변환마다

// → SettlementCache로 통합하여 중복 계산 방지
```

**캐시 무효화 트리거**:
| 이벤트 | 무효화 범위 |
|--------|-----------|
| 시간 수정 (updateWorkTime) | 해당 WorkLog만 |
| 급여 오버라이드 변경 | 해당 WorkLog만 |
| 공고 급여 정보 수정 | 해당 공고의 모든 WorkLog |
| 정산 완료 (settleWorkLog) | 해당 WorkLog만 |

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

**목표**: 캐시 무효화 패턴 최적화 및 Optimistic Update 적용

**수정 파일**:
- `src/lib/queryClient.ts`
- `src/hooks/useApplications.ts`
- `src/hooks/useJobPostings.ts`

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

**🆕 Optimistic Update 패턴 추가**:
```typescript
// src/hooks/useApplications.ts - 지원 취소 예시
export const useCancelApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelApplication,

    // 1. Optimistic Update (즉시 UI 반영)
    onMutate: async (applicationId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applications.mine() });
      const previousData = queryClient.getQueryData(queryKeys.applications.mine());

      queryClient.setQueryData(queryKeys.applications.mine(), (old: Application[]) =>
        old?.filter(app => app.id !== applicationId)
      );

      return { previousData };
    },

    // 2. 에러 시 롤백
    onError: (err, applicationId, context) => {
      queryClient.setQueryData(queryKeys.applications.mine(), context?.previousData);
      toast.error('취소에 실패했습니다');
    },

    // 3. 완료 후 캐시 동기화
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() });
    },
  });
};
```

**Optimistic Update 적용 대상**:
| 액션 | 훅 | 적용 이유 |
|------|-----|----------|
| 지원 취소 | `useCancelApplication` | 사용자 경험 (즉시 피드백) |
| 알림 읽음 | `useMarkAsRead` | 빈번한 액션 |
| 즐겨찾기 | `useToggleFavorite` | 토글 즉시 반영 |

---

### ~~Phase 9: 레거시 필드 정리~~ (삭제됨)

> **2025-01-20 계획 변경**: Firestore 스키마 변경 허용으로 Phase 9 삭제
> - LegacyFieldHelper 불필요 (Phase 2에서 직접 마이그레이션)
> - 레거시 필드 처리가 IdNormalizer로 통합됨

<details>
<summary>원본 계획 (참고용)</summary>

**목표**: deprecated 필드 타입에서 제거하고 마이그레이션 헬퍼 제공

**신규 파일**:
- `src/shared/migration/LegacyFieldHelper.ts`

**수정 파일**:
- `src/types/schedule.ts` - 필드 정리
- `src/types/confirmedStaff.ts` - 필드 정리
- `src/types/jobPosting.ts` - 공고 레거시 필드 정리 🆕
- `src/services/jobManagementService.ts` - 마이그레이션 로직 통합 🆕
- `src/schemas/user.schema.ts` - 스키마 통합 🆕
- `src/schemas/admin.schema.ts` - 중복 스키마 제거 🆕
- `src/schemas/announcement.schema.ts` - 중복 스키마 제거 🆕

**LegacyFieldHelper 설계**:
```typescript
export class LegacyFieldHelper {
  static normalizeWorkLog(raw: unknown): WorkLog;
  static withLegacyFields(data: Partial<WorkLog>): Record<string, unknown>;

  // 🆕 공고 레거시 필드 처리
  static normalizeJobPosting(raw: unknown): JobPosting;
  static withJobPostingLegacyFields(data: Partial<JobPosting>): Record<string, unknown>;
}
```

**🆕 공고 레거시 필드 혼용 현황**:
| 신규 필드 | 레거시 필드 | 사용 위치 |
|----------|-----------|----------|
| `postingType` | `type` | jobPosting.ts, jobManagementService.ts |
| `dates[]` | `date` (단일) | jobPosting.ts, scheduleService.ts |
| `roles[]` | `role` (단일) | jobPosting.ts, confirmedStaffService.ts |

**공고 읽기/쓰기 정규화**:
```typescript
// 읽기 시 정규화
static normalizeJobPosting(raw: any): JobPosting {
  return {
    ...raw,
    postingType: raw.postingType ?? raw.type ?? 'regular',
    dates: raw.dates ?? (raw.date ? [raw.date] : []),
    roles: raw.roles ?? (raw.role ? [raw.role] : []),
  };
}

// 쓰기 시 레거시 필드 포함 (하위 호환)
static withJobPostingLegacyFields(data: Partial<JobPosting>): Record<string, any> {
  return {
    ...data,
    type: data.postingType,           // 레거시
    date: data.dates?.[0] ?? null,    // 레거시 (단일)
    role: data.roles?.[0] ?? null,    // 레거시 (단일)
  };
}
```

**🆕 Zod 스키마 중복 정의 통합**:
| 스키마 | 현재 위치 | 문제 |
|--------|----------|------|
| `userRoleSchema` | user.schema.ts, announcement.schema.ts, admin.schema.ts | 3곳 중복 |
| `announcementTypeSchema` | admin.schema.ts | `announcementCategorySchema`와 혼용 |

```typescript
// ❌ 현재: 3곳에서 중복 정의
// user.schema.ts
export const userRoleSchema = z.enum(['admin', 'employer', 'staff']);

// announcement.schema.ts (에러 메시지 추가)
export const userRoleSchema = z.enum(['admin', 'employer', 'staff'], {
  error: '역할을 선택해주세요',
});

// admin.schema.ts (import하여 사용)
import { userRoleSchema } from './user.schema';

// ✅ 수정: 단일 소스
// src/schemas/common.schema.ts (신규)
export const userRoleSchema = z.enum(['admin', 'employer', 'staff'], {
  errorMap: () => ({ message: '역할을 선택해주세요' }),
});

// 다른 파일에서 import
import { userRoleSchema } from './common.schema';
```

</details>

---

### Phase 10: 중복 유틸리티 통합

**목표**: 산재된 유틸리티 함수 정리

**신규/수정 파일**:
- `src/utils/format/date.ts`
- `src/utils/format/currency.ts`
- `src/utils/format/time.ts`
- `src/utils/format/role.ts` 🆕
- `src/utils/format/index.ts`

**중복 함수 통합 대상**:
| 현재 위치 | 함수 | 통합 위치 |
|----------|------|----------|
| `settlement/index.ts` | `formatTime()` | `format/time.ts` (dateUtils에서 import) |
| `settlement/index.ts` | `formatCurrency()` | `format/currency.ts` |
| `allowanceUtils.ts` | `calculateTotalAllowance()` | `settlement/` 통합 |
| `scheduleGrouping.ts` | `formatRolesDisplay()` | `format/role.ts` |
| `formatters.ts` | `formatRole()`, `formatRoles()` | `format/role.ts` |

---

### Phase 11: 에러 처리 표준화 🆕

**목표**: 모든 서비스/훅에서 일관된 에러 처리 패턴 적용

**신규 파일**:
- `src/shared/errors/ErrorHandler.ts`
- `src/shared/errors/index.ts`

**수정 파일**:
- 모든 서비스 파일 (31개)
- 주요 훅 파일 (useApplications, useSchedules 등)
- `src/services/notificationService.ts` - 권한 확인 구현 🆕
- `src/services/pushNotificationService.ts` - 초기화 실패 처리 🆕

**ErrorHandler 설계**:
```typescript
// src/shared/errors/ErrorHandler.ts
import { normalizeError, AppError } from '@/errors';
import { logger } from '@/utils/logger';
import { useToastStore } from '@/stores/toastStore';

export class ErrorHandler {
  // 기본 에러 처리 (로깅만)
  static handle(error: unknown, context?: string): AppError {
    const appError = normalizeError(error);
    logger.error('Error occurred', appError, { context });
    return appError;
  }

  // 토스트 포함 에러 처리
  static handleWithToast(error: unknown, context?: string): AppError {
    const appError = this.handle(error, context);
    useToastStore.getState().addToast({
      type: 'error',
      message: appError.userMessage,
    });
    return appError;
  }

  // 재시도 가능 여부 확인
  static isRetryable(error: AppError): boolean {
    return error.isRetryable && error.category !== 'business';
  }

  // 인증 필요 여부 확인
  static requiresReauth(error: AppError): boolean {
    return error.code === 'E2002' || error.code === 'E2003'; // TOKEN_EXPIRED, SESSION_EXPIRED
  }
}

// 훅용 래퍼
export function useErrorHandler() {
  const { addToast } = useToastStore();

  return {
    handleError: (error: unknown, context?: string) =>
      ErrorHandler.handleWithToast(error, context),
    handleSilent: (error: unknown, context?: string) =>
      ErrorHandler.handle(error, context),
  };
}
```

**현재 불일치 현황**:
```typescript
// 패턴 A: logger + toast (권장)
catch (error) {
  logger.error('작업 실패', error as Error);
  addToast({ type: 'error', message: '...' });
}

// 패턴 B: 에러 반환만 (일부 훅)
catch (error) {
  return { error };
}

// 패턴 C: throw만 (서비스)
catch (error) {
  throw mapFirebaseError(error);
}

// → ErrorHandler로 통합
```

**🆕 알림 시스템 에러 처리 개선**:
```typescript
// ❌ 현재: notificationService.ts - TODO만 있음
export async function checkNotificationPermission(): Promise<NotificationPermissionStatus> {
  // TODO: expo-notifications 설치 후 실제 구현
  return { granted: false, canAskAgain: false, status: 'denied' };
}

// ❌ 현재: pushNotificationService.ts - 실패해도 true 반환
try {
  Notifications = await import('expo-notifications');
} catch {
  isInitialized = true;  // ⚠️ 실패해도 true → 이후 Notifications 사용 불가
  return true;
}

// ✅ 수정: 명확한 에러 처리
export async function initializePushNotifications(): Promise<{
  success: boolean;
  error?: AppError;
}> {
  try {
    Notifications = await import('expo-notifications');
    isInitialized = true;
    return { success: true };
  } catch (error) {
    const appError = ErrorHandler.handle(error, 'pushNotificationService.initialize');
    return { success: false, error: appError };
  }
}
```

---

### Phase 12: 실시간 구독 통합 🆕

**목표**: 중복 구독 방지, 연결 상태 관리, **스토어 hydration 순서 보장**

**신규 파일**:
- `src/shared/realtime/RealtimeManager.ts`
- `src/shared/realtime/index.ts`

**수정 파일**:
- `src/hooks/useSchedules.ts`
- `src/hooks/useNotifications.ts`
- `src/hooks/useWorkLogs.ts`
- `src/stores/index.ts` - hydration 순서 정의 🆕
- `src/stores/notificationStore.ts` - authStore 의존성 처리 🆕

**🆕 스토어 Hydration 순서 보장**:
```typescript
// ❌ 현재: 순서 보장 없음
// authStore.ts - hasHydrated 플래그만 존재
// notificationStore.ts - 독립적으로 초기화

// ✅ 수정: 순서 보장
// src/stores/index.ts
export async function initializeStores() {
  // 1. authStore 먼저 (인증 상태 복구)
  await useAuthStore.persist.rehydrate();

  // 2. authStore hydration 완료 후 다른 스토어
  await useNotificationStore.persist.rehydrate();
  await useThemeStore.persist.rehydrate();
}

// app/_layout.tsx에서 사용
useEffect(() => {
  initializeStores().then(() => {
    setIsReady(true);
  });
}, []);
```

**RealtimeManager 설계**:
```typescript
// src/shared/realtime/RealtimeManager.ts
export class RealtimeManager {
  private static subscriptions = new Map<string, {
    unsubscribe: () => void;
    refCount: number;
    lastUpdate: number;
  }>();

  // 구독 시작 (중복 방지)
  static subscribe(
    key: string,
    subscribeFn: () => () => void
  ): () => void {
    const existing = this.subscriptions.get(key);
    if (existing) {
      existing.refCount++;
      return () => this.unsubscribe(key);
    }

    const unsubscribe = subscribeFn();
    this.subscriptions.set(key, {
      unsubscribe,
      refCount: 1,
      lastUpdate: Date.now(),
    });

    return () => this.unsubscribe(key);
  }

  // 구독 해제 (refCount 기반)
  static unsubscribe(key: string): void {
    const sub = this.subscriptions.get(key);
    if (!sub) return;

    sub.refCount--;
    if (sub.refCount <= 0) {
      sub.unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  // 구독 상태 확인
  static isSubscribed(key: string): boolean {
    return this.subscriptions.has(key);
  }

  // 모든 구독 해제 (앱 종료 시)
  static unsubscribeAll(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
  }

  // 구독 키 생성 헬퍼
  static keys = {
    schedules: (staffId: string) => `schedules:${staffId}`,
    notifications: (userId: string) => `notifications:${userId}`,
    workLogs: (staffId: string) => `workLogs:${staffId}`,
    confirmedStaff: (jobPostingId: string) => `confirmedStaff:${jobPostingId}`,
  };
}
```

**현재 중복 구독 가능성**:
```typescript
// 문제: 같은 데이터에 여러 구독
function ScheduleScreen() {
  useSchedules();           // 구독 1
  useSchedulesByMonth();    // 구독 2 (중복 가능)
  useTodaySchedules();      // 구독 3 (중복 가능)
}

// → RealtimeManager로 중복 방지
```

---

### Phase 13: 테스트 전략 🆕

**목표**: 리팩토링 전/후 기능 동일성 검증

**신규 파일**:
- `src/shared/__tests__/StatusMapper.test.ts`
- `src/shared/__tests__/IdNormalizer.test.ts`
- `src/shared/__tests__/TimeNormalizer.test.ts`
- `src/domains/__tests__/SettlementCalculator.test.ts`
- `src/domains/__tests__/ScheduleMerger.test.ts`

**테스트 범위**:

| 모듈 | 테스트 항목 | 우선순위 |
|------|-----------|:--------:|
| StatusMapper | 모든 상태 변환 매핑 | 🔴 높음 |
| IdNormalizer | eventId/jobPostingId 정규화 | 🔴 높음 |
| SettlementCalculator | 정산 금액 계산 정확성 | 🔴 높음 |
| TimeNormalizer | 시간 필드 정규화 | 🟠 중간 |
| RoleResolver | 역할 정규화 | 🟠 중간 |
| ScheduleMerger | WorkLog + Application 병합 | 🟡 낮음 |

**정산 계산 비교 테스트**:
```typescript
// src/domains/__tests__/SettlementCalculator.test.ts
describe('SettlementCalculator', () => {
  // 기존 함수와 결과 비교
  it('should match legacy calculation results', () => {
    const workLog = createMockWorkLog();
    const jobPosting = createMockJobPosting();

    // 기존 방식
    const legacyResult = calculateSettlementBreakdown(workLog, jobPosting);

    // 신규 방식
    const newResult = SettlementCalculator.calculate({
      workLog,
      jobPostingCard: toJobPostingCard(jobPosting),
    });

    expect(newResult.netPay).toBe(legacyResult.netPay);
    expect(newResult.taxAmount).toBe(legacyResult.taxAmount);
  });

  // 경계값 테스트
  it('should handle zero hours correctly', () => { ... });
  it('should handle PROVIDED_FLAG (-1) allowances', () => { ... });
  it('should apply tax correctly', () => { ... });
});
```

**테스트 커버리지 목표**:
| 영역 | 현재 | 목표 (MVP) | 목표 (출시) |
|------|:----:|:----------:|:----------:|
| shared/ | 0% | 80% | 90% |
| domains/ | 0% | 70% | 80% |
| services/ | 40% | 50% | 70% |
| 전체 | 14% | 40% | 60% |

---

## 📁 파일 변경 요약

### 신규 생성 (30개+)

```
# shared/ (핵심 공유 모듈)
src/shared/status/types.ts
src/shared/status/StatusMapper.ts
src/shared/status/statusFlow.ts              🆕
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
src/shared/errors/ErrorHandler.ts            🆕 Phase 11
src/shared/errors/index.ts                   🆕
src/shared/realtime/RealtimeManager.ts       🆕 Phase 12
src/shared/realtime/index.ts                 🆕

# domains/ (도메인 모듈)
src/domains/schedule/ScheduleMerger.ts
src/domains/schedule/WorkLogCreator.ts         🆕 Phase 5
src/domains/schedule/index.ts
src/domains/settlement/SettlementCalculator.ts
src/domains/settlement/SettlementCache.ts    🆕 Phase 6
src/domains/settlement/TaxCalculator.ts      🆕 Phase 6
src/domains/settlement/index.ts
src/domains/job/index.ts
src/domains/application/index.ts
src/domains/staff/index.ts

# utils/format/ (포맷팅 통합)
# ⚠️ 폴더 미생성 - 기존 파일에 이미 통합되어 있음:
# - src/utils/formatters.ts (currency, role, phone 등)
# - src/utils/dateUtils.ts (date, time)
# 아래는 원본 계획 (미실행):
# src/utils/format/date.ts
# src/utils/format/currency.ts
# src/utils/format/time.ts
# src/utils/format/role.ts
# src/utils/format/index.ts

# __tests__/ (테스트)
src/shared/__tests__/StatusMapper.test.ts    🆕 Phase 13
src/shared/__tests__/IdNormalizer.test.ts    🆕
src/shared/__tests__/TimeNormalizer.test.ts  🆕
src/domains/__tests__/SettlementCalculator.test.ts  🆕
src/domains/__tests__/ScheduleMerger.test.ts 🆕
```

### 수정 (20개+)

```
# 서비스 (핵심)
src/services/scheduleService.ts       ← 병합 로직, 상태 매핑
src/services/settlementService.ts     ← 계산 로직, 캐시 연동
src/services/confirmedStaffService.ts ← 상태 매핑, 시간 정규화
src/services/jobManagementService.ts  ← 역할 처리, 레거시 필드 🆕
src/services/applicationService.ts    ← ID 정규화
src/services/applicantManagementService.ts ← WorkLogCreator 연동 🆕
src/services/reportService.ts         ← admin 권한 검증, ID 정규화 🆕
src/services/notificationService.ts   ← 권한 확인 구현 🆕
src/services/pushNotificationService.ts ← 초기화 에러 처리 🆕
src/services/eventQRService.ts        ← ID 정규화 🆕
src/services/adminService.ts          ← 권한 검증 표준화 🆕 Phase 4
src/services/announcementService.ts   ← 권한 검증 표준화 🆕 Phase 4
src/services/index.ts                 ← re-export

# 타입
src/types/schedule.ts                 ← 변환 함수 이동
src/types/confirmedStaff.ts           ← 레거시 필드 정리
src/types/jobPosting.ts               ← 공고 레거시 필드 정리 🆕
src/types/index.ts                    ← re-export

# 훅
src/hooks/useSchedules.ts             ← RealtimeManager 연동
src/hooks/useApplications.ts          ← Optimistic Update 🆕 Phase 8
src/hooks/useJobPostings.ts           ← Optimistic Update 🆕 Phase 8
src/hooks/useNotifications.ts         🆕 Phase 12
src/hooks/useWorkLogs.ts              🆕 Phase 12

# 유틸리티
src/lib/queryClient.ts                ← 캐시 무효화 패턴
src/utils/settlement/index.ts         ← 핵심 로직 이동
src/utils/scheduleGrouping.ts         ← ScheduleMerger로 이동
src/utils/allowanceUtils.ts           ← 통합
src/utils/formatters.ts               ← 통합
src/utils/index.ts

# 스키마 🆕 Phase 9
src/schemas/common.schema.ts          ← 공통 스키마 통합 (신규)
src/schemas/user.schema.ts            ← 중복 제거
src/schemas/admin.schema.ts           ← 중복 제거
src/schemas/announcement.schema.ts    ← 중복 제거

# 스토어 🆕 Phase 12
src/stores/index.ts                   ← hydration 순서 정의 (신규)
src/stores/authStore.ts               ← normalizeUserRole 이동
src/stores/notificationStore.ts       ← authStore 의존성 처리
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
| **🔴 신고 시스템 admin 권한 누락** 🆕 | `reviewReport()`에 admin 권한 검증 추가 필수 |
| **🔴 관리자 서비스 권한 누락** 🆕 | `adminService`, `announcementService` 권한 검증 추가 |
| 알림 권한 미구현 🆕 | `notificationService` ↔ `pushNotificationService` 통합 |
| Zod 스키마 중복 정의 🆕 | `userRoleSchema` 3곳 중복 → 단일 소스 통합 |
| 스토어 hydration 순서 🆕 | authStore → notificationStore 초기화 순서 보장 |

**🆕 신고 시스템 보안 결함**:
```typescript
// ❌ 현재: reportService.ts - admin 권한 검증 없음
export async function reviewReport(input: ReviewReportInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new AuthError(...);
  // ⚠️ admin 여부 확인 없이 신고 검토 가능

// ✅ 수정 필요
export async function reviewReport(input: ReviewReportInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new AuthError(...);

  // admin 권한 확인
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.data()?.role !== 'admin') {
    throw new PermissionError('E4001', '관리자 권한이 필요합니다');
  }
  // ...
}
```

---

## 🔍 추가 발견 사항 (2025-01-20 코드 분석)

### 핵심 파일 현황

| 파일 | 줄 수 | 복잡도 | 주요 문제 |
|------|:-----:|:------:|----------|
| `scheduleService.ts` | 1,014 | 높음 | eventId 혼용, 상태 변환 중복 |
| `settlement/index.ts` | 787 | 중간 | 중복 계산, 캐싱 없음 |
| `schedule.ts` (타입) | 638 | 중간 | 변환 함수 분산 |
| `confirmedStaffService.ts` | 566 | 높음 | 시간 필드 혼용, N+1 쿼리 |
| `queryClient.ts` | 469 | 중간 | 캐시 무효화 미구현 |

**총 3,859줄** - 리팩토링 대상 규모 상당함

---

### 계획에 없던 추가 문제

#### 1. 정산 중복 계산 (성능 문제)

```typescript
// scheduleService.ts - 매 변환마다 계산
const settlementBreakdown = calculateSettlementBreakdown(...);
// 같은 WorkLog가 여러 쿼리에 포함되면 N번 중복
```

**권장**: Phase 6에서 WorkLog ID 기반 캐싱 로직 추가

#### 2. N+1 쿼리 문제

```typescript
// confirmedStaffService.ts:150
await Promise.all(
  staffIds.map(async (staffId) => {
    const name = await getStaffName(staffId);  // N번 개별 호출
  })
);
```

**권장**: 배치 쿼리로 교체 (Phase 5 또는 별도 Phase)

#### 3. Query Keys 무효화 미구현

```typescript
// queryClient.ts에 정의됨
export const queryKeys = { ... };

// 하지만 서비스에서 실제 invalidateQueries 호출 없음
```

**권장**: Phase 8에서 실제 캐시 무효화 로직 구현 추가

---

### 상태 변환 불일치 (버그 가능성)

| 위치 | 함수 | checked_in 처리 |
|------|------|-----------------|
| scheduleService.ts:112 | workLogToScheduleEvent | → 'confirmed' ❌ |
| confirmedStaffService.ts:103 | mapWorkLogStatus | → 'checked_in' ✅ |
| schedule.ts:34 | toAttendanceStatus | → 'checked_in' ✅ |

**같은 변환인데 결과가 다름** - Phase 1에서 반드시 통합 필요

---

### 수정된 Phase 우선순위 권장 (최종)

| 순위 | Phase | 이유 | 위험도 | 의존성 |
|:----:|-------|------|:------:|--------|
| **1** | Phase 2 (ID 정규화) | 가장 명확한 문제, 다른 Phase 기초 | 🟢 낮음 | 없음 |
| **2** | Phase 1 (상태 매핑) | 버그 수정 + checked_in 불일치 해결 | 🟢 낮음 | 없음 |
| **3** | Phase 3 (시간 정규화) | 정산 계산 전 필요 | 🟡 중간 | Phase 1 |
| **4** | Phase 4 (역할 처리) | 정산 계산 전 필요 | 🟡 중간 | Phase 1 |
| **5** | Phase 6 (정산 + 캐싱) | 성능 개선 핵심, TaxCalculator 분리 | 🔴 높음 | Phase 3, 4 |
| **6** | Phase 8 (Query Keys) | 정산 캐시 무효화 연동 | 🟢 낮음 | Phase 6 |
| **7** | Phase 5 (스케줄 병합) | 가장 복잡, 마지막에 | 🔴 높음 | Phase 1, 2, 3 |
| **8** | Phase 11 (에러 처리) 🆕 | 일관성 개선, 독립적 | 🟢 낮음 | 없음 |
| **9** | Phase 12 (실시간) 🆕 | 중복 구독 방지 | 🟡 중간 | Phase 5 |
| **10** | Phase 9 (레거시 정리) | 마지막 정리 단계 | 🟡 중간 | Phase 2 완료 후 |
| **11** | Phase 10 (유틸리티) | 마지막 정리 | 🟢 낮음 | 없음 |
| **12** | Phase 7 (도메인 구조) | re-export 정리 | 🟢 낮음 | 전체 완료 후 |
| **13** | Phase 13 (테스트) 🆕 | 품질 보장 | 🟢 낮음 | 각 Phase 완료 시 |

---

## 📊 예상 일정 (수정됨)

### 권장 실행 순서

| 순서 | Phase | 작업 | 소요 | 위험도 |
|:----:|:-----:|------|:----:|:------:|
| 1 | **2** | ID 정규화 | 1일 | 🟢 낮음 |
| 2 | **1** | 상태 매핑 통합 | 1-2일 | 🟢 낮음 |
| 3 | **3** | 시간 필드 정규화 | 1일 | 🟡 중간 |
| 4 | **4** | 역할 처리 통합 | 1-2일 | 🟡 중간 |
| 5 | **6** | 정산 계산기 + 캐시 | 2-3일 | 🔴 높음 |
| 6 | **8** | Query Keys 최적화 | 1일 | 🟢 낮음 |
| 7 | **5** | 스케줄 병합 로직 분리 | 2-3일 | 🔴 높음 |
| 8 | **11** | 에러 처리 표준화 🆕 | 1-2일 | 🟢 낮음 |
| 9 | **12** | 실시간 구독 통합 🆕 | 1-2일 | 🟡 중간 |
| 10 | **9** | 레거시 필드 정리 | 1일 | 🟡 중간 |
| 11 | **10** | 중복 유틸리티 통합 | 1일 | 🟢 낮음 |
| 12 | **7** | 도메인 모듈 구조 완성 | 1-2일 | 🟢 낮음 |
| 13 | **13** | 테스트 작성 🆕 | 2-3일 | 🟢 낮음 |
| **합계** | | | **17-23일** | |

### 마일스톤

| 마일스톤 | Phase | 완료 기준 | 예상 완료 |
|---------|:-----:|----------|----------|
| **M1: 기초 정규화** | 1, 2, 3, 4 | ID/상태/시간/역할 통합 | 1주차 |
| **M2: 핵심 로직** | 5, 6 | 정산 캐싱, 스케줄 병합 | 2주차 |
| **M3: 인프라** | 8, 11, 12 | Query, 에러, 실시간 | 3주차 |
| **M4: 정리** | 7, 9, 10 | 레거시 제거, 구조 완성 | 3주차 말 |
| **M5: 품질** | 13 | 테스트 커버리지 40%+ | 4주차 |

### 병렬 작업 가능 영역

```
Week 1:
├─ Phase 2 (ID) ─────┐
├─ Phase 1 (상태) ───┼─► Phase 3 (시간) ─► Phase 4 (역할)
└─ Phase 13 (테스트 설계) 시작

Week 2:
├─ Phase 6 (정산) ──► Phase 8 (Query Keys)
└─ Phase 5 (스케줄) 시작

Week 3:
├─ Phase 5 (스케줄) 완료
├─ Phase 11 (에러) ─┬─► Phase 12 (실시간)
└─ Phase 9 (레거시) ─┘

Week 4:
├─ Phase 10 (유틸리티)
├─ Phase 7 (도메인 구조)
└─ Phase 13 (테스트 작성)
```

---

## 🔑 핵심 파일

1. `src/services/scheduleService.ts` - 스케줄 병합 핵심 로직
2. `src/utils/settlement/index.ts` - 정산 계산 핵심 로직
3. `src/types/schedule.ts` - 상태 타입 및 변환 함수
4. `src/lib/queryClient.ts` - Query Keys 중앙 관리
5. `src/services/confirmedStaffService.ts` - 상태 매핑, 시간 필드 처리

---

## 📦 Firestore 마이그레이션 전략

### 개요

리팩토링 중 Firestore 스키마는 변경하지 않지만, 레거시 필드와 신규 필드가 공존하는 기간이 필요합니다.

### 1단계: 읽기 호환 (IdNormalizer) - Phase 2

```typescript
// 읽기 시 자동 정규화
const workLog = await getDoc(workLogRef);
const jobPostingId = IdNormalizer.extractJobPostingId(workLog.data());
// eventId 또는 jobPostingId 중 있는 값 반환
```

**영향 범위**: 모든 읽기 쿼리
**위험도**: 낮음 (읽기만)

### 2단계: 쓰기 정규화 (LegacyFieldHelper) - Phase 9

```typescript
// 쓰기 시 레거시 필드 포함
const writeData = LegacyFieldHelper.withLegacyFields({
  jobPostingId,
  status: 'scheduled',
  // ...
});
// 결과: { jobPostingId, eventId, status, ... }
```

**영향 범위**: 모든 쓰기 작업
**위험도**: 중간 (데이터 일관성)

### 3단계: 일괄 마이그레이션 스크립트 (선택적)

```typescript
// functions/src/migration/migrateEventIdToJobPostingId.ts
export async function migrateWorkLogs() {
  const batch = db.batch();
  const snapshot = await db.collection('workLogs')
    .where('jobPostingId', '==', null)
    .limit(500)
    .get();

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.eventId && !data.jobPostingId) {
      batch.update(doc.ref, {
        jobPostingId: data.eventId,
        _migrated: true,
        _migratedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  await batch.commit();
  return { migrated: snapshot.size };
}
```

**실행 조건**: 읽기 호환 완료 후
**위험도**: 높음 (일괄 변경)

### 4단계: 레거시 필드 제거 (2025 Q3~Q4)

```typescript
// 타입에서 deprecated 필드 제거
interface WorkLog {
  jobPostingId: string;     // 필수
  // eventId?: string;      // 제거됨
}

// LegacyFieldHelper 제거
// IdNormalizer.toEventId() 제거
```

**실행 조건**: 모든 클라이언트 업데이트 완료 후
**위험도**: 높음 (하위 호환성 중단)

### 마이그레이션 체크리스트

```
Phase 2 완료 후:
☐ IdNormalizer 적용 확인 (읽기 정규화)
☐ 기존 쿼리 정상 동작 확인
☐ onSnapshot 콜백 정상 동작 확인

Phase 9 완료 후:
☐ LegacyFieldHelper 적용 확인 (쓰기 정규화)
☐ 신규 문서에 레거시 필드 포함 확인
☐ 기존 문서 읽기 정상 확인

일괄 마이그레이션 전:
☐ 백업 완료
☐ 롤백 스크립트 준비
☐ 테스트 환경 검증

레거시 제거 전:
☐ 모든 클라이언트 버전 확인
☐ 최소 지원 버전 공지
☐ 마이그레이션 완료율 100% 확인
```

### 롤백 전략

```typescript
// 마이그레이션 실패 시 롤백
export async function rollbackMigration() {
  const batch = db.batch();
  const snapshot = await db.collection('workLogs')
    .where('_migrated', '==', true)
    .limit(500)
    .get();

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      jobPostingId: FieldValue.delete(),
      _migrated: FieldValue.delete(),
      _migratedAt: FieldValue.delete(),
    });
  });

  await batch.commit();
}
```

---

## 🧪 하위 호환성 테스트 체크리스트

### 각 Phase 완료 후 필수 테스트

| 테스트 항목 | 검증 방법 | 담당 Phase |
|------------|----------|:----------:|
| import 경로 호환 | 기존 import 문 그대로 동작 확인 | 전체 |
| 타입 호환성 | `npm run type-check` 에러 0개 | 전체 |
| onSnapshot 콜백 | 실시간 데이터 정상 수신 | 2, 5 |
| 정산 금액 정확성 | 기존 vs 신규 계산 결과 비교 | 6 |
| 트랜잭션 무결성 | 동시 지원 시 정원 초과 방지 | 5 |
| 상태 변환 일관성 | StatusMapper 매핑 테스트 | 1 |
| ID 정규화 | eventId/jobPostingId 혼용 케이스 | 2 |

### 수동 테스트 시나리오

#### 시나리오 1: 지원 플로우
```
1. 공고 상세 → 지원하기 → 지원 완료
2. 내 스케줄 → 지원 중 상태 확인
3. (구인자) 지원자 관리 → 확정
4. 내 스케줄 → 확정 상태 확인
5. QR 출근 → checked_in 상태 확인
6. QR 퇴근 → checked_out 상태 확인
7. (구인자) 정산 → 금액 확인 → 정산 완료
```

#### 시나리오 2: 취소 플로우
```
1. 지원 완료 상태에서 취소 → cancelled
2. 확정 상태에서 취소 요청 → cancellation_pending
3. (구인자) 취소 요청 승인 → cancelled
4. (구인자) 취소 요청 거절 → confirmed 유지
```

#### 시나리오 3: 실시간 동기화
```
1. 스케줄 탭 열기
2. (다른 기기) 공고 확정
3. 스케줄 탭에서 실시간 업데이트 확인
4. 새로고침 없이 상태 변경 확인
```

### 정산 금액 비교 테스트

```typescript
// 테스트 데이터
const testCases = [
  {
    name: '시급 기본',
    workLog: { hoursWorked: 8, role: 'dealer' },
    jobPosting: { salaryInfo: { type: 'hourly', amount: 15000 } },
    expected: { grossPay: 120000, netPay: 120000 },
  },
  {
    name: '시급 + 세금 3.3%',
    workLog: { hoursWorked: 8, role: 'dealer' },
    jobPosting: {
      salaryInfo: { type: 'hourly', amount: 15000 },
      taxSettings: { type: 'rate', value: 3.3 },
    },
    expected: { grossPay: 120000, taxAmount: 3960, netPay: 116040 },
  },
  {
    name: '일급 + 수당',
    workLog: { hoursWorked: 10, role: 'manager' },
    jobPosting: {
      salaryInfo: { type: 'daily', amount: 200000 },
      allowances: { meal: 10000, transportation: 5000 },
    },
    expected: { grossPay: 200000, allowances: 15000, netPay: 215000 },
  },
  // ... 더 많은 케이스
];
```

---

## 🔬 코드 분석 결과 (2025-01-20 심층 분석)

### 현재 아키텍처 평가

| 영역 | 점수 | 상태 | 비고 |
|------|:----:|:----:|------|
| 타입 시스템 | 9/10 | ✅ | 27개 파일, 계층적 구조 |
| 서비스 레이어 | 8/10 | ✅ | 31개 서비스, 관심사 분리 |
| Query Keys | 9/10 | ✅ | 14개 도메인, 중앙 관리 |
| 상태 매핑 | 8/10 | ✅ | checked_in 일관성 있음 |
| ID 정규화 | 5/10 | ❌ | eventId/jobPostingId 혼용 심각 |
| 정산 계산 | 6/10 | ⚠️ | 반복 계산 문제 |
| 실시간 구독 | 7/10 | ⚠️ | 중복 구독 가능성 |
| 에러 처리 | 7/10 | ⚠️ | 훅 레이어 불일치 |

---

## 📊 전체 데이터 흐름 다이어그램

### 도메인 간 연결 구조

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        UNIQN Mobile 데이터 흐름                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [User/Auth]                                                             │
│      │                                                                   │
│      ├─ uid ─────────────────┬─────────────────┬─────────────────┐      │
│      │                       │                 │                 │      │
│      ▼                       ▼                 ▼                 ▼      │
│  UserProfile            Application        WorkLog          Notification │
│  (users/)              (applications/)    (workLogs/)      (notifications/)│
│      │                       │                 │                         │
│      │               applicantId = uid   staffId = uid                  │
│      │                       │                 │                         │
│      │                       │  ┌─────────────┘                         │
│      │                       │  │                                        │
│      │                       ▼  ▼                                        │
│      │                 jobPostingId = eventId (⚠️ 혼용)                 │
│      │                       │                                           │
│      │                       ▼                                           │
│      │                  JobPosting                                       │
│      │                 (jobPostings/)                                    │
│      │                       │                                           │
│      │                       ├─ roles[] ─────┐                          │
│      │                       │               ▼                          │
│      │                       │         salary, allowances, tax          │
│      │                       │               │                          │
│      │                       │               ▼                          │
│      │                       │     SettlementBreakdown (계산값)         │
│      │                       │          (WorkLog에 캐싱)                │
│      │                       │                                           │
│      └───────────────────────┴───────────────────────────────────────────┤
│                                                                          │
│  [트랜잭션 필수 지점] ✅ 현재 잘 구현됨                                  │
│  • Application 확정 → WorkLog 생성                                       │
│  • QR 출퇴근 → WorkLog 상태 전이                                         │
│  • 정산 처리 → WorkLog payrollStatus                                     │
│                                                                          │
│  [캐시 동기화 필요] ⚠️ 개선 필요                                        │
│  • WorkLog 시간 수정 → Settlement 재계산                                 │
│  • JobPosting 급여 변경 → 해당 WorkLogs 캐시 무효화                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 스케줄 탭 데이터 병합 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ScheduleService.getMySchedules() 병합 로직                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WorkLogs Collection                    Applications Collection         │
│  (staffId = uid)                        (applicantId = uid)             │
│       │                                        │                        │
│       │ status IN                              │ status IN              │
│       │ [scheduled, checked_in,                │ [applied, pending,     │
│       │  checked_out, completed]               │  confirmed]            │
│       │                                        │                        │
│       ▼                                        ▼                        │
│  workLogToScheduleEvent()              applicationToScheduleEvents()    │
│       │                                        │                        │
│       │ eventId = jobPostingId                 │ eventId = jobPostingId │
│       │ status → AttendanceStatus              │ status = 'not_started' │
│       │                                        │                        │
│       └──────────────┬─────────────────────────┘                        │
│                      │                                                  │
│                      ▼                                                  │
│          mergeAndDeduplicateSchedules()                                 │
│                      │                                                  │
│                      │ 중복 제거: eventId + date 조합                   │
│                      │ 우선순위: WorkLog > Application                  │
│                      │                                                  │
│                      ▼                                                  │
│             ScheduleEvent[] (통합 결과)                                 │
│                      │                                                  │
│                      ▼                                                  │
│         groupByApplicationId() (선택적)                                 │
│                      │                                                  │
│                      ▼                                                  │
│         GroupedScheduleEvent[] (연속 근무 그룹화)                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 ID 필드 혼용 상세 현황

### 실제 사용 현황 (코드 분석 결과)

| 컬렉션/타입 | 필드명 | 실제 저장 값 | 사용 파일 수 | 표준화 방향 |
|------------|--------|-------------|:-----------:|------------|
| Application | `jobPostingId` | JobPosting ID | 35개 | ✅ 유지 (Primary) |
| Application | `eventId` | JobPosting ID | 레거시 | → 제거 (2025 Q3) |
| WorkLog | `eventId` | JobPosting ID | 27개 | ⚠️ 이름 변경 필요 |
| ScheduleEvent | `eventId` | JobPosting ID | 변환 생성 | ⚠️ 내부 정규화 |
| EventQRCode | `eventId` | JobPosting ID | 12개 | ⚠️ 함수명 일치 |

### 혼용 발생 위치 (상세)

#### scheduleService.ts - 가장 복잡한 혼용

```typescript
// 라인 702-703: 별도 수집
const workLogEventIds = workLogs.map((wl) => wl.eventId);           // eventId 사용
const applicationEventIds = applications.map((app) => app.jobPostingId);  // jobPostingId 사용

// 라인 713, 719: 별도 조회
cardInfo = jobPostingCardMap.get(workLog.eventId);      // eventId로 조회
cardInfo = jobPostingCardMap.get(app.jobPostingId);     // jobPostingId로 조회

// 라인 280, 316: 변환
eventId: application.jobPostingId   // jobPostingId → eventId 변환

// 라인 168: 복합 키 생성
applicationId: `${workLog.eventId}_${workLog.staffId}`  // eventId 사용
```

#### settlementService.ts - 쿼리 불일치

```typescript
// 라인 236: 필드명과 파라미터 불일치
where('eventId', '==', jobPostingId)  // eventId 필드에 jobPostingId 값으로 조회

// 라인 600: 혼재된 수집
jobPostingIds.add(data.eventId);      // eventId를 jobPostingIds Set에 추가
```

### staffId vs applicantId 사용 패턴

| 컨텍스트 | 필드 | 사용 시점 |
|---------|------|----------|
| Application (지원) | `applicantId` | 지원 단계 |
| WorkLog (근무) | `staffId` | 근무 단계 |
| ConfirmedStaff (확정) | 둘 다 | 변환 시점 |
| ScheduleEvent (스케줄) | `staffId` | 표시용 |

**변환 로직 필요**:
```typescript
// Application 확정 → WorkLog 생성 시
const workLog = {
  staffId: application.applicantId,  // applicantId → staffId
  eventId: application.jobPostingId, // jobPostingId → eventId
  // ...
};
```

### IdNormalizer 확장 설계

```typescript
// src/shared/id/IdNormalizer.ts (확장)
export class IdNormalizer {
  // 기존
  static extractJobPostingId(doc: { eventId?: string; jobPostingId?: string }): string;
  static toEventId(jobPostingId: string): string;

  // 🆕 WorkLog/Application 통합
  static normalizeJobId(doc: {
    eventId?: string;
    jobPostingId?: string;
    postId?: string;  // 레거시
  }): string {
    return doc.jobPostingId || doc.eventId || doc.postId || '';
  }

  // 🆕 User ID 통합 (staffId/applicantId)
  static normalizeUserId(doc: {
    staffId?: string;
    applicantId?: string;
    userId?: string;
  }): string {
    return doc.staffId || doc.applicantId || doc.userId || '';
  }

  // 🆕 배치 정규화
  static normalizeWorkLogs<T extends { eventId?: string; jobPostingId?: string }>(
    workLogs: T[]
  ): (T & { normalizedJobPostingId: string })[] {
    return workLogs.map(wl => ({
      ...wl,
      normalizedJobPostingId: this.normalizeJobId(wl),
    }));
  }

  // 🆕 Schedule 병합용 통합 ID 추출
  static extractUnifiedIds(
    workLogs: WorkLog[],
    applications: Application[]
  ): Set<string> {
    const ids = new Set<string>();
    workLogs.forEach(wl => ids.add(this.normalizeJobId(wl)));
    applications.forEach(app => ids.add(app.jobPostingId));
    return ids;
  }
}
```

---

## 🔧 에러 처리 표준화 (Phase 11 확장)

### 현재 문제점

#### 서비스 레이어 (일관성 있음 ✅)

```typescript
// 모든 서비스에서 동일 패턴
try {
  logger.info('작업 시작', { context });
  const result = await operation();
  return result;
} catch (error) {
  logger.error('작업 실패', error as Error, { context });
  throw mapFirebaseError(error);  // AppError로 변환
}
```

#### 훅 레이어 (불일치 ❌) - 20+ 파일에서 발견

```typescript
// 문제 1: 일반 Error 사용
if (!user) {
  throw new Error('로그인이 필요합니다');  // ❌ AppError 아님
}

// 문제 2: userMessage 미사용
onError: (error) => {
  addToast({
    type: 'error',
    message: error instanceof Error ? error.message : '실패했습니다.'  // ❌
  });
}
```

### 표준화 후 패턴

```typescript
// src/shared/errors/hookErrorHandler.ts (신규)
import { normalizeError, AppError, AuthError, ERROR_CODES } from '@/errors';
import { logger } from '@/utils/logger';
import { useToastStore } from '@/stores/toastStore';

// 훅용 에러 핸들러
export function createMutationErrorHandler(
  context: string,
  addToast: (toast: { type: string; message: string }) => void
) {
  return (error: unknown) => {
    const appError = normalizeError(error);
    logger.error(context, appError, { code: appError.code });
    addToast({
      type: 'error',
      message: appError.userMessage,  // ✅ 사용자 친화적 메시지
    });
  };
}

// 인증 체크 헬퍼
export function requireAuth(user: User | null): asserts user is User {
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_REQUIRED, {
      userMessage: '로그인이 필요합니다.',
    });
  }
}

// 사용 예시
export function useApplications() {
  const { addToast } = useToastStore();
  const handleError = createMutationErrorHandler('지원 처리', addToast);

  return useMutation({
    mutationFn: async (input) => {
      requireAuth(user);  // ✅ AppError 사용
      return applicationService.apply(input, user.uid);
    },
    onError: handleError,  // ✅ 표준화된 핸들러
  });
}
```

### 수정 대상 파일

| 파일 | 문제 | 수정 내용 |
|------|------|----------|
| `useApplications.ts` | throw new Error | → requireAuth + handleError |
| `useSchedules.ts` | throw new Error | → requireAuth + handleError |
| `useSettlement.ts` | throw new Error | → requireAuth + handleError |
| `useApplicantManagement.ts` | throw new Error | → requireAuth + handleError |
| `useJobManagement.ts` | throw new Error | → requireAuth + handleError |
| `useConfirmedStaff.ts` | throw new Error | → requireAuth + handleError |
| `useWorkLogs.ts` | onError 패턴 | → handleError |
| `useQRCodeScanner.ts` | try-catch | → handleError |
| 기타 15+ 파일 | 동일 패턴 | 동일 수정 |

---

## 📡 실시간 구독 관리 강화 (Phase 12 확장)

### 현재 구독 현황

| 서비스 | 함수 | 대상 컬렉션 | 쿼리 |
|--------|------|------------|------|
| scheduleService | subscribeToSchedules | workLogs | staffId, status |
| workLogService | subscribeToMyWorkLogs | workLogs | staffId, dateRange |
| workLogService | subscribeToTodayWorkStatus | workLogs | staffId, today, status |
| notificationService | subscribeToNotifications | notifications | userId |
| notificationService | subscribeToUnreadCount | notifications | userId, isRead=false |
| confirmedStaffService | subscribeToConfirmedStaff | workLogs | eventId, date |

### 중복 구독 문제

```
동일 컴포넌트 또는 화면에서:
├─ subscribeToSchedules(staffId)        → workLogs 구독 #1
├─ subscribeToMyWorkLogs(staffId)       → workLogs 구독 #2
└─ subscribeToTodayWorkStatus(staffId)  → workLogs 구독 #3

결과: 같은 workLogs 컬렉션에 3개의 리스너
문제: 문서 변경 시 콜백 3번 실행 → 불필요한 리렌더링
```

### WorkLogSubscriptionManager 설계

```typescript
// src/shared/realtime/WorkLogSubscriptionManager.ts (신규)
import { onSnapshot, query, collection, where, orderBy } from 'firebase/firestore';

type WorkLogFilter = {
  staffId?: string;
  eventId?: string;
  dateRange?: { start: Date; end: Date };
  status?: WorkLogStatus[];
};

type Listener = {
  id: string;
  filter: WorkLogFilter;
  callback: (workLogs: WorkLog[]) => void;
};

export class WorkLogSubscriptionManager {
  private static instance: WorkLogSubscriptionManager | null = null;
  private subscription: (() => void) | null = null;
  private listeners = new Map<string, Listener>();
  private allWorkLogs: WorkLog[] = [];
  private currentStaffId: string | null = null;

  static getInstance(): WorkLogSubscriptionManager {
    if (!this.instance) {
      this.instance = new WorkLogSubscriptionManager();
    }
    return this.instance;
  }

  // 리스너 등록 (중복 구독 방지)
  subscribe(
    listenerId: string,
    staffId: string,
    filter: Omit<WorkLogFilter, 'staffId'>,
    callback: (workLogs: WorkLog[]) => void
  ): () => void {
    // staffId가 변경되면 기존 구독 해제 후 재구독
    if (this.currentStaffId !== staffId) {
      this.unsubscribeAll();
      this.currentStaffId = staffId;
      this.startSubscription(staffId);
    }

    // 리스너 등록
    this.listeners.set(listenerId, {
      id: listenerId,
      filter: { ...filter, staffId },
      callback,
    });

    // 즉시 현재 데이터로 콜백 호출
    this.notifyListener(listenerId);

    // 구독 해제 함수 반환
    return () => this.unsubscribe(listenerId);
  }

  private startSubscription(staffId: string) {
    const q = query(
      collection(db, 'workLogs'),
      where('staffId', '==', staffId),
      orderBy('date', 'desc')
    );

    this.subscription = onSnapshot(
      q,
      (snapshot) => {
        this.allWorkLogs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as WorkLog[];

        // 모든 리스너에 필터링된 데이터 전달
        this.listeners.forEach((_, listenerId) => {
          this.notifyListener(listenerId);
        });
      },
      (error) => {
        logger.error('WorkLog 구독 에러', error);
      }
    );
  }

  private notifyListener(listenerId: string) {
    const listener = this.listeners.get(listenerId);
    if (!listener) return;

    const filtered = this.filterWorkLogs(this.allWorkLogs, listener.filter);
    listener.callback(filtered);
  }

  private filterWorkLogs(workLogs: WorkLog[], filter: WorkLogFilter): WorkLog[] {
    return workLogs.filter(wl => {
      if (filter.eventId && wl.eventId !== filter.eventId) return false;
      if (filter.status && !filter.status.includes(wl.status)) return false;
      if (filter.dateRange) {
        const date = new Date(wl.date);
        if (date < filter.dateRange.start || date > filter.dateRange.end) return false;
      }
      return true;
    });
  }

  private unsubscribe(listenerId: string) {
    this.listeners.delete(listenerId);

    // 모든 리스너가 제거되면 구독 해제
    if (this.listeners.size === 0) {
      this.unsubscribeAll();
    }
  }

  private unsubscribeAll() {
    this.subscription?.();
    this.subscription = null;
    this.allWorkLogs = [];
    this.currentStaffId = null;
  }

  // 디버깅용
  getActiveListenerCount(): number {
    return this.listeners.size;
  }
}

// 사용 예시
const manager = WorkLogSubscriptionManager.getInstance();

// useSchedules에서
const unsubscribe = manager.subscribe(
  'schedules',
  staffId,
  { status: ['scheduled', 'checked_in', 'checked_out'] },
  (workLogs) => setSchedules(workLogs)
);

// useTodayWorkStatus에서
const unsubscribe = manager.subscribe(
  'todayStatus',
  staffId,
  { dateRange: { start: today, end: today }, status: ['checked_in'] },
  (workLogs) => setTodayWorkLog(workLogs[0] || null)
);

// 결과: 단일 onSnapshot → 클라이언트 필터링 → 각 콜백
```

---

## 🔄 Query Invalidation 전략 (Phase 8 확장)

### 무효화 트리거 맵

```typescript
// src/lib/queryInvalidation.ts (신규)
import { queryClient, queryKeys } from './queryClient';
import { SettlementCache } from '@/domains/settlement/SettlementCache';

export const invalidationTriggers = {
  // 지원 제출 시
  onApplicationSubmitted: (jobPostingId: string, applicantId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.detail(jobPostingId) });
  },

  // Application 확정 시 (가장 중요)
  onApplicationConfirmed: (jobPostingId: string, applicantId: string) => {
    // 지원 관련
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() });

    // 스케줄 관련
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });

    // 스태프 관리 관련
    queryClient.invalidateQueries({ queryKey: queryKeys.confirmedStaff.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.applicantManagement.byJobPosting(jobPostingId) });

    // 정산 캐시 (아직 계산 안 됨)
    SettlementCache.invalidateByJobPosting(jobPostingId);
  },

  // QR 출근 시
  onCheckIn: (workLogId: string, jobPostingId: string, staffId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.detail(workLogId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.confirmedStaff.byJobPosting(jobPostingId) });
  },

  // QR 퇴근 시
  onCheckOut: (workLogId: string, jobPostingId: string, staffId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.detail(workLogId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.confirmedStaff.byJobPosting(jobPostingId) });
    // 정산 가능 상태가 됨
    SettlementCache.invalidate(workLogId);
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJobPosting(jobPostingId) });
  },

  // WorkLog 시간 수정 시
  onWorkTimeUpdated: (workLogId: string, jobPostingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.detail(workLogId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.calculation(workLogId) });
    SettlementCache.invalidate(workLogId);
  },

  // 정산 완료 시
  onSettlementCompleted: (workLogId: string, jobPostingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.detail(workLogId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.summary(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.mySummary() });
    SettlementCache.invalidate(workLogId);
  },

  // 일괄 정산 완료 시
  onBulkSettlementCompleted: (workLogIds: string[], jobPostingId: string) => {
    workLogIds.forEach(id => SettlementCache.invalidate(id));
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.summary(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.mySummary() });
  },

  // JobPosting 급여 정보 변경 시
  onJobPostingSalaryUpdated: (jobPostingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.detail(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJobPosting(jobPostingId) });
    SettlementCache.invalidateByJobPosting(jobPostingId);
  },

  // 취소 요청 시
  onCancellationRequested: (applicationId: string, jobPostingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.applicantManagement.cancellationRequests(jobPostingId) });
  },
};
```

### 서비스에서 트리거 호출

```typescript
// applicationService.ts 수정
import { invalidationTriggers } from '@/lib/queryInvalidation';

export async function confirmApplicationV2(...) {
  // ... 기존 트랜잭션 로직

  // 트랜잭션 성공 후 캐시 무효화
  invalidationTriggers.onApplicationConfirmed(jobPostingId, applicantId);

  return result;
}

// eventQRService.ts 수정
export async function processQRAction(...) {
  // ... 기존 로직

  if (action === 'checkIn') {
    invalidationTriggers.onCheckIn(workLogId, eventId, staffId);
  } else {
    invalidationTriggers.onCheckOut(workLogId, eventId, staffId);
  }
}
```

---

## 🧩 Phase 14: 컴포넌트 재사용 전략 (신규)

### 목표

중복되는 UI 패턴을 통합하여 일관성 향상 및 유지보수성 개선

### 재사용 대상 패턴

#### 1. StatusBadge 통합

```
현재 (중복):
├─ ApplicationStatusBadge
├─ WorkLogStatusBadge
├─ AttendanceStatusBadge
├─ PayrollStatusBadge
└─ ConfirmedStaffStatusBadge

통합 후:
└─ StatusBadge<T extends StatusType>
```

**StatusBadge 설계**:
```typescript
// src/components/ui/StatusBadge.tsx
type StatusConfig<T extends string> = {
  label: Record<T, string>;
  colors: Record<T, string>;  // NativeWind 클래스
};

interface StatusBadgeProps<T extends string> {
  status: T;
  config: StatusConfig<T>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'filled' | 'outlined' | 'soft';
}

export function StatusBadge<T extends string>({
  status,
  config,
  size = 'md',
  variant = 'filled',
}: StatusBadgeProps<T>) {
  return (
    <View className={cn(
      'rounded-full px-2 py-0.5',
      sizeClasses[size],
      variantClasses[variant],
      config.colors[status]
    )}>
      <Text className="text-center font-medium">
        {config.label[status]}
      </Text>
    </View>
  );
}

// 사용 예시
<StatusBadge
  status={application.status}
  config={{
    label: APPLICATION_STATUS_LABELS,
    colors: APPLICATION_STATUS_COLORS,
  }}
/>
```

#### 2. DetailSheet 통합

```
현재 (중복):
├─ ScheduleDetailSheet
├─ SettlementDetailModal
├─ ApplicantDetailModal
├─ WorkLogDetailModal
└─ StaffProfileModal

통합 후:
└─ DetailSheet<T extends DetailData>
    ├─ sections: DetailSection[]
    └─ actions: ActionButton[]
```

**DetailSheet 설계**:
```typescript
// src/components/ui/DetailSheet.tsx
interface DetailSection {
  title: string;
  items: {
    label: string;
    value: string | React.ReactNode;
    type?: 'text' | 'currency' | 'date' | 'status' | 'custom';
  }[];
}

interface DetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sections: DetailSection[];
  actions?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  }[];
  loading?: boolean;
}

export function DetailSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  sections,
  actions,
  loading,
}: DetailSheetProps) {
  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose}>
      <SheetHeader title={title} subtitle={subtitle} />

      {loading ? (
        <DetailSheetSkeleton />
      ) : (
        sections.map((section, i) => (
          <Section key={i} title={section.title}>
            {section.items.map((item, j) => (
              <DetailItem key={j} {...item} />
            ))}
          </Section>
        ))
      )}

      {actions && (
        <ActionBar actions={actions} />
      )}
    </BottomSheetModal>
  );
}

// 사용 예시 (ScheduleDetailSheet)
<DetailSheet
  isOpen={isOpen}
  onClose={onClose}
  title={schedule.title}
  subtitle={formatDate(schedule.date)}
  sections={[
    {
      title: '근무 정보',
      items: [
        { label: '역할', value: schedule.role },
        { label: '시간', value: formatTimeRange(schedule.startTime, schedule.endTime) },
        { label: '상태', value: schedule.status, type: 'status' },
      ],
    },
    {
      title: '정산 정보',
      items: [
        { label: '예상 금액', value: schedule.expectedPay, type: 'currency' },
        { label: '정산 상태', value: schedule.payrollStatus, type: 'status' },
      ],
    },
  ]}
  actions={[
    { label: '취소 요청', onPress: handleCancel, variant: 'danger' },
  ]}
/>
```

#### 3. DataCard + CardList 패턴

```
현재 (중복):
├─ ScheduleCard + ScheduleList
├─ SettlementCard + SettlementList
├─ ApplicantCard + ApplicantList
├─ WorkLogCard + WorkLogList
└─ GroupedScheduleCard + GroupedList

통합 후:
├─ DataCard<T> (개별 카드)
└─ DataCardList<T> (리스트 + 빈 상태 + 로딩)
```

**DataCard 설계**:
```typescript
// src/components/ui/DataCard.tsx
interface DataCardProps<T> {
  data: T;
  renderHeader: (data: T) => React.ReactNode;
  renderContent: (data: T) => React.ReactNode;
  renderFooter?: (data: T) => React.ReactNode;
  onPress?: (data: T) => void;
  variant?: 'default' | 'highlighted' | 'muted';
}

// src/components/ui/DataCardList.tsx
interface DataCardListProps<T> {
  data: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyState?: {
    title: string;
    description?: string;
    action?: { label: string; onPress: () => void };
  };
  ListHeaderComponent?: React.ReactNode;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function DataCardList<T>({
  data,
  renderCard,
  keyExtractor,
  loading,
  emptyState,
  ...props
}: DataCardListProps<T>) {
  if (loading) {
    return <CardListSkeleton />;
  }

  if (data.length === 0 && emptyState) {
    return (
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
      />
    );
  }

  return (
    <FlashList
      data={data}
      renderItem={({ item, index }) => renderCard(item, index)}
      keyExtractor={keyExtractor}
      estimatedItemSize={100}
      {...props}
    />
  );
}
```

### 수정 대상 파일

| 현재 컴포넌트 | 통합 컴포넌트 | 우선순위 |
|-------------|-------------|:--------:|
| ApplicationStatusBadge | StatusBadge | 높음 |
| WorkLogStatusBadge | StatusBadge | 높음 |
| PayrollStatusBadge | StatusBadge | 높음 |
| ScheduleDetailSheet | DetailSheet | 중간 |
| SettlementDetailModal | DetailSheet | 중간 |
| ScheduleCard | DataCard | 낮음 |
| SettlementCard | DataCard | 낮음 |
| ScheduleList | DataCardList | 낮음 |

---

## 📐 최종 Phase 순서 (수정됨)

### 의존성 기반 실행 순서

| 순서 | Phase | 작업 | 위험도 | 의존성 |
|:----:|:-----:|------|:------:|--------|
| 1 | **2** | ID 정규화 (IdNormalizer 확장) | 🟢 낮음 | 없음 |
| 2 | **1** | 상태 매핑 통합 (StatusMapper) | 🟢 낮음 | 없음 |
| 3 | **11** | 에러 처리 표준화 + 훅 레이어 | 🟢 낮음 | 없음 |
| 4 | **3** | 시간 필드 정규화 (TimeNormalizer) | 🟡 중간 | Phase 1 |
| 5 | **4** | 역할 처리 통합 (RoleResolver) | 🟡 중간 | Phase 1 |
| 6 | **6** | 정산 계산기 + 캐시 | 🔴 높음 | Phase 3, 4 |
| 7 | **12** | 실시간 구독 통합 + 중복 방지 | 🟡 중간 | 없음 |
| 8 | **8** | Query Keys + Invalidation 트리거 | 🟢 낮음 | Phase 6 |
| 9 | **5** | 스케줄 병합 로직 (ScheduleMerger) | 🔴 높음 | Phase 1, 2, 3 |
| 10 | **14** 🆕 | 컴포넌트 재사용 패턴 | 🟡 중간 | 없음 |
| 11 | **9** | 레거시 필드 정리 | 🟡 중간 | Phase 2 완료 후 |
| 12 | **10** | 중복 유틸리티 통합 | 🟢 낮음 | 없음 |
| 13 | **7** | 도메인 모듈 구조 완성 | 🟢 낮음 | 전체 완료 후 |
| 14 | **13** | 테스트 작성 | 🟢 낮음 | 각 Phase 완료 시 |

### 수정된 마일스톤

| 마일스톤 | Phase | 완료 기준 | 예상 완료 |
|---------|:-----:|----------|----------|
| **M1: 기초 정규화** | 2, 1, 11 | ID/상태 통합, 에러 표준화 | 1주차 |
| **M2: 데이터 처리** | 3, 4, 6 | 시간/역할/정산 통합 | 2주차 |
| **M3: 인프라** | 12, 8 | 실시간 구독, Query 무효화 | 2주차 말 |
| **M4: 핵심 로직** | 5, 14 | 스케줄 병합, UI 재사용 | 3주차 |
| **M5: 정리** | 9, 10, 7 | 레거시 제거, 구조 완성 | 3주차 말 |
| **M6: 품질** | 13 | 테스트 커버리지 40%+ | 4주차 |

### 병렬 작업 영역 (수정됨)

```
Week 1:
├─ Phase 2 (ID) ──────────┐
├─ Phase 1 (상태) ────────┼─► Phase 3 (시간)
├─ Phase 11 (에러) ───────┘
└─ Phase 13 (테스트 설계) 시작

Week 2:
├─ Phase 4 (역할) ────────┐
├─ Phase 6 (정산) ────────┼─► Phase 8 (Query)
└─ Phase 12 (실시간) ─────┘

Week 3:
├─ Phase 5 (스케줄) ──────┐
└─ Phase 14 (컴포넌트) ───┴─► UI 통합 테스트

Week 4:
├─ Phase 9 (레거시) ──────┐
├─ Phase 10 (유틸리티) ───┼─► Phase 7 (도메인 구조)
└─ Phase 13 (테스트 작성) ─┘
```

---

## 🛡️ 데이터 일관성 보장 전략

### 트랜잭션 필수 지점 (현재 구현 상태)

| 작업 | 관련 문서 | 트랜잭션 | 파일 위치 |
|------|----------|:--------:|----------|
| 지원하기 | Application + JobPosting | ✅ | applicationService.ts:393-520 |
| 지원 확정 | Application + WorkLog | ✅ | applicantManagementService.ts |
| 지원 취소 | Application + JobPosting | ✅ | applicationService.ts:700-780 |
| QR 출퇴근 | WorkLog (상태 전이) | ✅ | eventQRService.ts:311-393 |
| 정산 처리 | WorkLog (payrollStatus) | ✅ | settlementService.ts |
| 일괄 정산 | WorkLogs[] | ✅ | settlementService.ts:660-760 |

### 캐시 동기화 필수 지점

| 이벤트 | 무효화 대상 | 현재 상태 | 개선 방안 |
|--------|-----------|:---------:|----------|
| Application 확정 | schedules, confirmedStaff, workLogs | ⚠️ 부분적 | invalidationTriggers 적용 |
| WorkLog 시간 수정 | settlement 캐시 | ❌ 없음 | SettlementCache 연동 |
| JobPosting 급여 변경 | settlement 계산 | ❌ 없음 | invalidateByJobPosting |
| QR 출퇴근 | schedules, confirmedStaff | ⚠️ 부분적 | 트리거 통합 |

### 실시간 구독 동기화

```
현재 문제:
├─ workLogs 컬렉션에 3개의 독립 구독
├─ notifications 컬렉션에 2개의 독립 구독
└─ 각 구독이 별도로 데이터 관리

개선 방안:
├─ WorkLogSubscriptionManager (단일 구독 + 클라이언트 필터링)
├─ NotificationSubscriptionManager (단일 구독 + 필터링)
└─ 중앙화된 구독 상태 관리
```

---

## 📁 신규 파일 요약 (전체)

```
src/
├── shared/
│   ├── status/
│   │   ├── types.ts                      # 상태 타입 통합
│   │   ├── StatusMapper.ts               # 상태 변환 클래스
│   │   ├── statusFlow.ts                 # 상태 전이 규칙
│   │   └── index.ts
│   ├── id/
│   │   ├── IdNormalizer.ts               # ID 정규화 (확장)
│   │   └── index.ts
│   ├── time/
│   │   ├── types.ts
│   │   ├── TimeNormalizer.ts
│   │   └── index.ts
│   ├── role/
│   │   ├── types.ts
│   │   ├── RoleResolver.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── ErrorHandler.ts               # 서비스 에러 처리
│   │   ├── hookErrorHandler.ts           # 훅 에러 처리 🆕
│   │   └── index.ts
│   ├── realtime/
│   │   ├── RealtimeManager.ts
│   │   ├── WorkLogSubscriptionManager.ts # 중복 구독 방지 🆕
│   │   └── index.ts
│   ├── cache/
│   │   └── SettlementCache.ts            # 정산 캐시 🆕
│   └── migration/
│       └── LegacyFieldHelper.ts
│
├── domains/
│   ├── schedule/
│   │   ├── ScheduleMerger.ts
│   │   └── index.ts
│   ├── settlement/
│   │   ├── SettlementCalculator.ts
│   │   ├── SettlementCache.ts
│   │   ├── TaxCalculator.ts
│   │   └── index.ts
│   ├── job/
│   │   └── index.ts
│   ├── application/
│   │   └── index.ts
│   └── staff/
│       └── index.ts
│
├── lib/
│   ├── queryClient.ts                    # 기존 (Query Keys)
│   └── queryInvalidation.ts              # 무효화 트리거 🆕
│
├── components/ui/
│   ├── StatusBadge.tsx                   # 상태 배지 통합 🆕
│   ├── DetailSheet.tsx                   # 상세 시트 통합 🆕
│   ├── DataCard.tsx                      # 데이터 카드 🆕
│   └── DataCardList.tsx                  # 카드 리스트 🆕
│
└── __tests__/
    ├── shared/
    │   ├── StatusMapper.test.ts
    │   ├── IdNormalizer.test.ts
    │   └── TimeNormalizer.test.ts
    └── domains/
        ├── SettlementCalculator.test.ts
        └── ScheduleMerger.test.ts
```

---

## ✅ 검증 체크리스트 (최종)

### Phase별 완료 기준

```
Phase 2 (ID 정규화) 완료 후: ✅ 2025-01-20 완료
☑ IdNormalizer.normalizeJobId() 적용
☑ IdNormalizer.normalizeUserId() 적용
☑ scheduleService 배치 조회 통합
☑ 기존 쿼리 정상 동작 확인
☑ onSnapshot 콜백 정상 동작 확인 (25개 테스트)

Phase 1 (상태 매핑) 완료 후: ✅ 2025-01-21 완료
☑ StatusMapper.toAttendance() 적용
☑ StatusMapper.workLogToSchedule() 적용
☑ 기존 toAttendanceStatus() → StatusMapper로 위임
☑ 상태 변환 일관성 테스트 통과 (44개 테스트)

Phase 3 (시간 정규화) 완료 후: ✅ 2025-01-21 완료
☑ TimeNormalizer.normalize() 구현 (actualStartTime > checkInTime 우선순위)
☑ TimeNormalizer.calculateHours() 구현
☑ TimeNormalizer.getEffectiveHours() 구현
☑ Timestamp, Date, ISO string 모든 형식 지원
☑ 시간 정규화 테스트 통과 (28개 테스트)

Phase 4 (역할 처리) 완료 후: ✅ 2025-01-21 완료
☑ RoleResolver.normalizeUserRole() 구현 (대소문자 무관, manager→employer 하위호환)
☑ RoleResolver.hasPermission() 구현 (계층 기반 권한 검증)
☑ RoleResolver.requireAdmin/requireRole() 구현 (PermissionError 발생)
☑ RoleResolver.getStaffRoleDisplayName() 구현 (직무 역할 표시명)
☑ RoleResolver.resolveStaffRoles() 구현 (role/roles/roleIds/customRole 통합)
☑ 역할 처리 테스트 통과 (66개 테스트)

Phase 11 (에러 처리) 완료 후: ✅ 완료
☑ hookErrorHandler.ts 생성 (src/shared/errors/)
☑ createMutationErrorHandler() 구현
☑ requireAuth() 타입 가드 구현
☑ extractErrorMessage(), canRetry(), needsReauth() 유틸리티

Phase 6 (정산) 완료 후: ✅ 2025-01-21 완료
☑ SettlementCalculator.calculate() 구현 (시간/급여/수당/세금 통합)
☑ SettlementCalculator.calculateTotal() 구현 (배치 계산)
☑ SettlementCalculator.getSalaryForRole() 구현 (역할별 급여 조회)
☑ TaxCalculator 분리 (none/fixed/rate + 항목별 과세)
☑ SettlementCache 구현 (5분 TTL, inputHash 기반 변경 감지)
☑ 정산 계산 테스트 통과 (44개 테스트)

Phase 12 (실시간) 완료 후: ✅ 완료
☑ RealtimeManager.ts 생성
☑ 참조 카운트 기반 구독 관리
☑ Keys 헬퍼로 일관된 키 패턴

Phase 8 (Query) 완료 후: ✅ 완료
☑ invalidateQueries 객체 통합 (queryClient.ts:440-469)
☑ 12개 도메인별 무효화 함수
☑ 복합 무효화: staffManagement(), tournamentApproval()

Phase 5 (스케줄) 완료 후: ✅ 2025-01-21 완료
☑ ScheduleMerger.merge() 구현 (WorkLog 우선 병합, 날짜 범위 필터)
☑ ScheduleMerger.groupByDate() 구현 (날짜별 그룹화 + 한글 label)
☑ ScheduleMerger.groupByApplication() 구현 (applicationId 그룹화)
☑ ScheduleMerger.isConsecutiveDates() 구현 (연속 날짜 확인)
☑ ScheduleMerger.calculateStats() 구현 (타입별 통계)
☑ 스케줄 병합 테스트 통과 (20개 테스트)

Phase 7 (도메인) 완료 후: ✅ 2025-01-21 완료
☑ src/domains/job/index.ts 생성 (공고 타입 re-export)
☑ src/domains/application/index.ts 생성 (지원서 타입 re-export)
☑ src/domains/staff/index.ts 생성 (스태프 타입 re-export)
☑ src/domains/index.ts 생성 (중앙 배럴 export)
☑ src/services/index.ts 수정 (도메인 re-export 추가)
☑ 타입 검사 통과 / 린트 통과 / 테스트 통과 (64개)

Phase 14 (컴포넌트) 완료 후:
☐ StatusBadge 통합
☐ DetailSheet 통합
☐ 기존 컴포넌트 마이그레이션
☐ UI 일관성 확인

전체 완료 후:
☐ npm run type-check 에러 0개
☐ npm run lint 에러 0개
☐ npm run build 성공
☐ 테스트 커버리지 40%+
☐ 수동 테스트 시나리오 통과
```
