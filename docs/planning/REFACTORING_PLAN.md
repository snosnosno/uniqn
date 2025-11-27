# T-HOLDEM 프로젝트 리팩토링 계획

**최종 업데이트**: 2025년 11월 27일
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)
**상태**: 📋 **계획 수립 완료**
**제약조건**: 현재 기능 100% 유지, 하위 호환성 보장
**전략**: 기존 폴더 구조 유지, 점진적 마이그레이션

---

## 1. 현황 분석 요약

### 1.1 프로젝트 규모
| 항목 | 수치 |
|------|------|
| 전체 파일 | 542개 |
| 커스텀 훅 | 80개+ |
| Context | 7개 |
| Zustand Store | 5개 |
| 번들 크기 | 299KB |
| 테스트 커버리지 | 65% |

### 1.2 식별된 핵심 문제점

#### 🔴 Critical (즉시 해결 필요)
| 문제 | 위치 | 영향 |
|------|------|------|
| **AttendanceStatus 3중 정의** | `common.ts`, `attendance.ts`, `schedule.ts` | 타입 불일치, 유지보수 어려움 |
| **WorkLog 3중 정의** | `common.ts`, `attendance.ts`, `unified/workLog.ts` | 필드 타입 불일치 |
| **클라이언트 필터링 O(n)** | `unifiedDataStore.ts:172-223` | 성능 저하 |

#### 🟡 High (조기 해결 권장)
| 문제 | 위치 | 영향 |
|------|------|------|
| **useStaffSelection 2버전** | `hooks/`, `hooks/staff/` | 코드 중복, 혼란 |
| **스태프 훅 7개 분산** | `hooks/` 전반 | 책임 불명확 |
| **Context Adapter 오버헤드** | `*ContextAdapter.tsx` | 불필요한 리렌더링 |
| **JSON.stringify 비교** | `ApplicantCard.tsx:247-248` | 성능 저하 |

#### 🟢 Medium (점진적 개선)
| 문제 | 위치 | 영향 |
|------|------|------|
| **캐시 로직 중복** | `OptimizedUnifiedDataService`, `EventService` | 코드 중복 |
| **Props 파일 13개 분산** | `types/jobPosting/` | 복잡도 증가 |
| **에러 처리 패턴 불일치** | 전반 | 일관성 부족 |

---

## 2. 리팩토링 전략

### 2.1 Phase 1: 타입 통합 (Week 1) - Priority: Critical

#### 목표
- 중복 타입 정의 제거, SSOT(Single Source of Truth) 확립
- 하위 호환성을 위한 별칭 유지

#### 작업 항목

**1.1 시간 필드 타입 표준화**
```typescript
// types/temporal.ts (신규)
export type StandardTimestamp = Timestamp | null;
export type TimeString = string;  // HH:mm
export type DateString = string;  // YYYY-MM-DD
```

**1.2 AttendanceStatus 통합**
- SSOT: `types/attendance.ts`
- `schedule.ts`, `common.ts`에서 re-export

**1.3 WorkLog 통합**
- SSOT: `types/unified/workLog.ts` → `UnifiedWorkLog`
- `common.ts`, `attendance.ts`에서 deprecated + re-export

#### 수정 대상 파일
- `types/attendance.ts` - SSOT 정의
- `types/schedule.ts` - re-export로 변경
- `types/common.ts` - deprecated 처리
- `types/unified/workLog.ts` - 시간 필드 표준화
- `types/index.ts` - 중앙 export 정리

---

### 2.2 Phase 2: 훅 통합 (Week 2) - Priority: High

#### 목표
- 중복 훅 제거, 명확한 책임 분리

#### 작업 항목

**2.1 useStaffSelection 통합**
- 루트 버전(157줄) 기능을 `hooks/staff/useStaffSelection.ts`로 통합
- localStorage 저장, 대량 선택 경고, 콜백 지원 포함
- 루트 버전은 deprecated + re-export

**2.2 스태프 훅 구조화**
```
hooks/staff/
├── index.ts                # barrel export
├── useStaffSelection.ts    # 통합 버전
├── useStaffData.ts         # 데이터 조회/변환
├── useStaffActions.ts      # CRUD 액션
├── useStaffModals.ts       # 모달 상태
└── useStaffPayroll.ts      # 급여 계산 (분리)
```

**2.3 근무 데이터 훅 정리**
- `useUnifiedWorkLogs` - 메인 데이터 훅
- `useScheduleData` - 스케줄 뷰 전용
- `useStaffWorkData` → `useStaffPayroll`로 이동

#### 수정 대상 파일
- `hooks/useStaffSelection.ts` - deprecated 처리
- `hooks/staff/useStaffSelection.ts` - 기능 통합
- `hooks/staff/index.ts` - barrel export 정리
- `hooks/index.ts` - 중복 export 제거

---

### 2.3 Phase 3: 성능 최적화 (Week 3) - Priority: High

#### 목표
- O(n) → O(1) 조회 성능 개선
- 불필요한 리렌더링 제거

#### 작업 항목

**3.1 인덱스 맵 추가 (unifiedDataStore)**
```typescript
interface UnifiedDataState {
  workLogs: Map<string, WorkLog>;
  // 신규 인덱스
  workLogsByEventId: Map<string, Set<string>>;
  workLogsByStaffId: Map<string, Set<string>>;
}
```

**3.2 React.memo 비교 함수 개선**
- `ApplicantCard.tsx`: JSON.stringify → 구조적 비교
- 주요 컴포넌트에 memo 확대 적용

**3.3 Firebase 쿼리 최적화**
- 역할별 차등 쿼리 적용 (staff: 3개월, admin: 1년)
- `where` 조건으로 서버사이드 필터링

#### 수정 대상 파일
- `stores/unifiedDataStore.ts` - 인덱스 맵 추가
- `components/applicants/ApplicantCard.tsx` - 비교 함수 개선
- `hooks/useUnifiedData.ts` - 쿼리 최적화

---

### 2.4 Phase 4: Context Adapter 단순화 (Week 4) - Priority: Medium

#### 목표
- 불필요한 래퍼 레이어 제거
- 직접 Store 접근으로 전환

#### 작업 항목

**4.1 TournamentContextAdapter**
- `useTournament()` → 직접 `useTournamentStore()` 반환
- 레거시 dispatch 인터페이스는 액션 매핑으로 유지

**4.2 JobPostingContextAdapter**
- workLogs 변환 로직을 selector로 이동
- Context Provider 제거, 직접 Store 호출

#### 수정 대상 파일
- `contexts/TournamentContextAdapter.tsx`
- `contexts/JobPostingContextAdapter.tsx`
- 관련 컴포넌트들 (import 경로 변경)

---

### 2.5 Phase 5: 에러 처리 표준화 (Week 5) - Priority: Medium

#### 목표
- 일관된 에러 처리 패턴 적용

#### 작업 항목

**5.1 Result 타입 정의**
```typescript
export type Result<T> = SuccessResult<T> | ErrorResult;

export async function safeAsync<T>(
  asyncFn: () => Promise<T>,
  context: ErrorContext
): Promise<Result<T>>;
```

**5.2 주요 훅에 적용**
- useUnifiedWorkLogs
- useJobPostings
- useStaffActions

#### 수정 대상 파일
- `utils/errorHandler.ts` - Result 타입, safeAsync 추가
- 주요 훅 파일들 - 패턴 적용

---

### 2.6 Phase 6: 캐시 통합 및 정리 (Week 6) - Priority: Low

#### 목표
- 중복 캐시 로직 통합
- JobPosting Props 파일 정리

#### 작업 항목

**6.1 CacheManager 추출**
```typescript
// core/cache/CacheManager.ts
class CacheManager {
  get<T>(collection: string, key: string): T | null;
  set<T>(collection: string, key: string, data: T): void;
  invalidate(collection?: string, key?: string): void;
}
```

**6.2 JobPosting Props 통합**
- 13개 → 3개 파일로 통합
- `base.ts`, `props.ts`, `index.ts`

#### 수정 대상 파일
- `services/OptimizedUnifiedDataService.ts`
- `services/EventService.ts`
- `types/jobPosting/*` (13개 → 3개)

---

## 3. 마이그레이션 전략

### 3.1 점진적 마이그레이션 원칙
1. **Deprecated 마커 활용**: 기존 코드는 즉시 삭제하지 않고 deprecated 처리
2. **Re-export 유지**: 기존 import 경로 유지
3. **Phase별 검증**: 각 Phase 완료 후 전체 테스트 실행

### 3.2 하위 호환성 보장
```typescript
// 예시: 타입 마이그레이션
// types/common.ts
/** @deprecated Use UnifiedWorkLog from 'types/unified/workLog' */
export type WorkLog = import('./unified/workLog').UnifiedWorkLog;
```

---

## 4. 검증 체크리스트

### 각 Phase 완료 시
- [ ] `npm run type-check` - 에러 0개
- [ ] `npm run lint` - 통과
- [ ] `npm run test` - 기존 테스트 100% 통과
- [ ] `npm run build` - 성공
- [ ] 주요 기능 수동 테스트

### 전체 완료 시
- [ ] 번들 크기 유지 (~299KB)
- [ ] 테스트 커버리지 65% → 80%
- [ ] 중복 타입/훅 정의 0개
- [ ] deprecated 경고 문서화

---

## 5. Critical Files 목록

구현 시 반드시 읽어야 할 파일들:

| 파일 | 이유 |
|------|------|
| `types/unified/workLog.ts` | WorkLog SSOT, 통합 기준 |
| `types/attendance.ts` | AttendanceStatus SSOT |
| `hooks/useStaffSelection.ts` | 훅 통합 기준 (157줄 버전) |
| `hooks/staff/useStaffSelection.ts` | 통합 대상 |
| `stores/unifiedDataStore.ts` | 인덱스 맵 추가 대상 |
| `services/OptimizedUnifiedDataService.ts` | 캐시 통합 참조 |
| `contexts/JobPostingContextAdapter.tsx` | Context 단순화 대상 |
| `components/applicants/ApplicantCard.tsx` | memo 최적화 대상 |
| `utils/errorHandler.ts` | 에러 처리 표준화 |
| `hooks/index.ts` | barrel export 정리 |

---

## 6. 예상 효과

| 영역 | 현재 | 목표 | 개선율 |
|------|------|------|-------|
| 중복 타입 정의 | 8개 | 0개 | 100% |
| 중복 훅 정의 | 5개 | 0개 | 100% |
| workLog 조회 성능 | O(n) | O(1) | 90%+ |
| 테스트 커버리지 | 65% | 80% | 23% |
| 번들 크기 | 299KB | ~280KB | 6% |

---

## 7. 일정 요약

| Phase | 기간 | 주요 작업 | 우선순위 |
|-------|------|----------|---------|
| Phase 1 | Week 1 | 타입 통합 | 🔴 Critical |
| Phase 2 | Week 2 | 훅 통합 | 🟡 High |
| Phase 3 | Week 3 | 성능 최적화 | 🟡 High |
| Phase 4 | Week 4 | Context 단순화 | 🟢 Medium |
| Phase 5 | Week 5 | 에러 처리 | 🟢 Medium |
| Phase 6 | Week 6 | 캐시/Props 정리 | 🟢 Low |

**총 예상 기간**: 6주 (점진적 마이그레이션)
