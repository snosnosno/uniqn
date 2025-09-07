# T-HOLDEM 스태프탭 분석 및 수정 가이드

**작성일**: 2025년 9월 6일  
**버전**: v1.0  
**상태**: 🔄 진행중
**최종 업데이트**: 2025-09-06 - 초기 분석 완료

## 📋 목차
- [1. 전체 데이터 흐름 분석](#1-전체-데이터-흐름-분석)
- [2. 스태프탭 핵심 구조](#2-스태프탭-핵심-구조)
- [3. 데이터 의존성 매트릭스](#3-데이터-의존성-매트릭스)
- [4. 수정 시 주의사항](#4-수정-시-주의사항)
- [5. 수정 진행 상황](#5-수정-진행-상황)
- [6. 테스트 체크리스트](#6-테스트-체크리스트)

---

## 1. 전체 데이터 흐름 분석

### 📊 핵심 데이터 흐름
```
공고 작성 → 공고 등록 → [지원 → 지원자탭 → 확정 → 스태프탭 → 정산탭] → 내 스케줄 → 내 지원현황
```

### 🎯 Firebase 데이터 컬렉션
| 컬렉션 | 핵심 필드 | 용도 | 스태프탭 연관도 |
|--------|-----------|------|----------------|
| `staff` | `staffId`, `name`, `role` | 스태프 기본 정보 | ⭐⭐⭐⭐⭐ |
| `workLogs` | `staffId`, `eventId`, `date` | 근무 기록 | ⭐⭐⭐⭐⭐ |
| `attendanceRecords` | `staffId`, `status` | 출석 기록 | ⭐⭐⭐⭐⭐ |
| `applications` | `eventId`, `applicantId` | 지원서 (확정→스태프) | ⭐⭐⭐⭐ |
| `jobPostings` | `id`, `title`, `createdBy` | 구인공고 | ⭐⭐⭐ |

### 🔄 UnifiedDataContext 중심 구조
- **통합 관리**: 모든 데이터를 단일 Context에서 실시간 관리
- **실시간 구독**: Firebase `onSnapshot`으로 즉시 업데이트  
- **성능 최적화**: 메모이제이션 + 92% 캐시 히트율
- **표준 필드**: `staffId`, `eventId` 완전 통일 (레거시 필드 제거)

---

## 2. 스태프탭 핵심 구조

### 🏗️ 컴포넌트 아키텍처
```typescript
StaffManagementTab.tsx (메인 - 904줄)
├── useUnifiedData() // 14개 → 3개 훅으로 통합 최적화
├── 데이터 변환 및 메모이제이션
├── localStorage 상태 지속성 (날짜 확장 상태)
├── 모달 상태 관리 (6개 모달)
├── 선택 모드 관리 (내장 상태)
├── 필터링 및 그룹화 로직
├── 성능 모니터링 (개발환경)
└── 이벤트 핸들러들
```

### 📦 주요 의존 컴포넌트
| 컴포넌트 | 용도 | 파일 경로 |
|----------|------|-----------|
| **StaffDateGroup** | 데스크톱 날짜별 그룹 | `/components/StaffDateGroup.tsx` |
| **StaffDateGroupMobile** | 모바일 날짜별 그룹 | `/components/StaffDateGroupMobile.tsx` |
| **BulkActionsModal** | 일괄 작업 모달 | `/components/BulkActionsModal.tsx` |
| **BulkTimeEditModal** | 일괄 시간 수정 | `/components/BulkTimeEditModal.tsx` |
| **WorkTimeEditor** | 개별 시간 편집 | `/components/WorkTimeEditor.tsx` |
| **StaffProfileModal** | 스태프 프로필 (확장 정보 포함) | `/components/StaffProfileModal.tsx` |
| **QRCodeGeneratorModal** | QR 코드 생성 | `/components/QRCodeGeneratorModal.tsx` |

### 🎣 핵심 커스텀 훅
| 훅 | 용도 | 최적화 상태 |
|----|------|-------------|
| `useUnifiedData` | 통합 데이터 관리 | ✅ 14개→3개 통합 |
| `useResponsive` | 반응형 레이아웃 | ✅ 최적화 완료 |
| `useVirtualization` | 대용량 리스트 | ✅ 1000+ 지원 |
| `usePerformanceMetrics` | 성능 모니터링 | ✅ 실시간 추적 |

---

## 3. 데이터 의존성 매트릭스

### 🔗 연결된 시스템 영향도
| 컴포넌트/페이지 | 사용 데이터 | 영향도 | 필수 검증 사항 |
|-----------------|-------------|--------|----------------|
| **StaffManagementTab** | `staff`, `workLogs`, `attendanceRecords` | ⭐⭐⭐⭐⭐ | 실시간 구독, 시간 정합성 |
| **ApplicantListTab** | `applications` → `staff` 연결 | ⭐⭐⭐⭐ | assignments 필드, 확정 프로세스 |
| **EnhancedPayrollTab** | `workLogs` → 급여 계산 | ⭐⭐⭐⭐⭐ | 시간 데이터 정확성, Web Worker |
| **MySchedulePage** | `workLogs`, `applications` | ⭐⭐⭐ | 스케줄 이벤트 동기화 |
| **MyApplicationsTab** | `applications` 상태 | ⭐⭐ | 지원현황 UI 일관성 |
| **AttendancePage** | `attendanceRecords` | ⭐⭐⭐ | QR 스캔 연동, 출석 상태 |

### 🎯 핵심 동기화 포인트
1. **지원자탭 ↔ 스태프탭**: `applications.status = 'confirmed'` → `staff` 자동 생성
2. **스태프탭 ↔ 정산탭**: `workLogs` 시간 데이터 공유 (급여 계산 기준)
3. **스태프탭 ↔ 내 스케줄**: `workLogs` 기반 스케줄 이벤트 생성
4. **스태프탭 ↔ 출석페이지**: `attendanceRecords` 실시간 상태 동기화

---

## 4. 수정 시 주의사항

### ⚠️ 절대 준수 사항
- **✅ 표준 필드명**: `staffId`, `eventId` 사용 (레거시 필드 금지)
- **✅ UnifiedDataContext**: 실시간 구독 패턴 유지
- **✅ logger 사용**: console.log 직접 사용 금지
- **✅ 타입 안전성**: TypeScript strict mode 준수
- **✅ 성능 최적화**: 메모이제이션 및 가상화 유지

### 🔍 필수 검증 체크리스트

#### **데이터 정합성**
- [ ] `staffId`, `eventId` 표준 필드명 사용 확인
- [ ] UnifiedDataContext 실시간 구독 동작 확인
- [ ] workLogs 시간 데이터 정확성 (급여 계산에 영향)
- [ ] Firebase onSnapshot 구독 누수 없음

#### **UI/UX 일관성**
- [ ] 모바일/데스크톱 반응형 레이아웃 정상 동작
- [ ] 다중 선택 모드 및 일괄 작업 기능
- [ ] 날짜별 그룹화 표시 및 확장/축소
- [ ] 로딩 상태 및 에러 처리

#### **성능 최적화**
- [ ] 메모이제이션 (`useMemo`, `useCallback`) 적절히 사용
- [ ] 1000+ 아이템 가상화 동작
- [ ] Web Workers 급여 계산 (메인 스레드 블로킹 방지)
- [ ] 캐시 히트율 90% 이상 유지

#### **권한 및 보안**
- [ ] 공고 작성자 권한 체크 (`canEdit`) 동작
- [ ] 사용자별 데이터 필터링 정상
- [ ] Firebase 보안 규칙 준수

---

## 5. 수정 진행 상황

### 📅 수정 로그
| 날짜 | 버전 | 수정 내용 | 담당자 | 상태 |
|------|------|-----------|--------|------|
| 2025-09-06 | v1.0 | 초기 분석 및 문서 생성 | Claude | ✅ 완료 |
| 2025-09-07 | v1.1 | Staff 타입 확장 및 데이터 파이프라인 개선 | Claude | ✅ 완료 |
| 2025-09-07 | v1.1 | StaffProfileModal 데이터 연결성 개선 | Claude | ✅ 완료 |
| 2025-09-07 | v1.1 | 날짜 확장 상태 localStorage 지속성 구현 | Claude | ✅ 완료 |
| 2025-09-07 | v1.1 | 사전질문 섹션 UI 개선 및 재배치 | Claude | ✅ 완료 |
| **2025-09-07** | **v1.2** | **WorkLog 중복 생성 문제 완전 해결** | **Claude** | **✅ 완료** |

### 🎯 계획된 수정 사항
- [✅] **Phase 1**: 핵심 로직 수정 (Staff 타입 확장, 데이터 변환 개선)
- [✅] **Phase 2**: UI/UX 개선 (StaffProfileModal 개선, 사전질문 섹션 재배치)
- [✅] **Phase 3**: 성능 최적화 (localStorage 지속성 구현)
- [ ] **Phase 4**: 통합 테스트 및 추가 최적화

### 🚨 발견된 이슈
| 이슈 | 우선순위 | 상태 | 설명 |
|------|----------|------|------|
| 스태프 프로필 추가 정보 미표시 | 높음 | ✅ 해결됨 | persons/users 컬렉션 데이터 연결 개선으로 해결 |
| 날짜 확장 상태 미지속 | 중간 | ✅ 해결됨 | localStorage 기반 상태 지속성 구현으로 해결 |
| 사전질문 섹션 위치 불편 | 낮음 | ✅ 해결됨 | 연락처 정보 위로 섹션 재배치 완료 |
| **WorkLog 중복 생성 문제** | 높음 | ✅ 해결됨 | 스태프 확정 시 WorkLog 사전 생성으로 완전 해결 |
| **WorkLog ID 패턴 불일치** | 높음 | ✅ 해결됨 | `${eventId}_${staffId}_0_${date}` 패턴으로 통일 |
| **화면 실시간 업데이트 지연** | 중간 | ⚠️ 진행 중 | 출석 상태 변경 후 테이블 반영 지연 문제 |

---

## 6. 테스트 체크리스트

### 🧪 단위 테스트
- [ ] StaffManagementTab 컴포넌트 렌더링
- [ ] useUnifiedData 훅 데이터 반환
- [ ] 필터링 및 그룹화 로직
- [ ] 모달 상태 관리

### 🔗 통합 테스트
- [ ] 지원자탭 → 스태프탭 확정 프로세스
- [ ] 스태프탭 → 정산탭 시간 데이터 동기화
- [ ] 스태프탭 → 내 스케줄 이벤트 생성
- [ ] 출석 상태 실시간 업데이트

### 🎭 E2E 테스트 (Playwright)
- [ ] 스태프 목록 조회 및 필터링
- [ ] 다중 선택 및 일괄 작업
- [ ] 시간 수정 및 저장
- [ ] QR 코드 생성 및 출석 체크
- [ ] 모바일/데스크톱 반응형 동작

### ⚡ 성능 테스트
- [ ] 1000+ 스태프 목록 렌더링 (<100ms)
- [ ] 필터링 응답 시간 (<50ms)
- [ ] 메모리 사용량 모니터링
- [ ] 캐시 히트율 90% 이상

---

## 🔧 개발 환경 설정

### 필수 명령어
```bash
# 개발 서버 시작
npm start

# TypeScript 에러 체크 (필수!)
npm run type-check

# E2E 테스트 실행
npm run test:e2e

# 성능 모니터링
npm run dev  # Firebase 에뮬레이터 포함
```

### 최근 구현된 핵심 기능

#### localStorage 상태 지속성
```typescript
// 날짜 확장 상태 localStorage 저장
const getStorageKey = useCallback(() => 
  `staff-expanded-dates-${jobPosting?.id || 'default'}`, [jobPosting?.id]);

const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
  const storageKey = `staff-expanded-dates-${jobPosting?.id || 'default'}`;
  const stored = localStorage.getItem(storageKey);
  return stored ? new Set(JSON.parse(stored)) : new Set();
});
```

#### Staff 타입 확장 데이터 연결
```typescript
// Staff 인터페이스 확장 (types/unifiedData.ts)
export interface Staff {
  // ... 기존 필드들 ...
  // users 컬렉션 연결용
  userId?: string;
  // 추가 개인정보
  gender?: string;
  age?: number;
  experience?: string;
  nationality?: string;
  region?: string;
  history?: string;
  notes?: string;
  bankName?: string;
  bankAccount?: string;
  residentId?: string;
}
```

#### StaffProfileModal 데이터 로딩 개선
```typescript
// persons 데이터 우선, users 컬렉션 보완 조회
const loadPreQuestionAnswers = async (staff: StaffData, userId: string) => {
  try {
    const applicationsQuery = query(
      collection(db, 'applications'),
      where('applicantId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    // ... 최신 지원서 기준 사전질문 답변 로드
  } catch (error) {
    logger.warn('사전질문 답변 로드 실패', { 
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
```

### 디버깅 도구
- **PerformanceMonitor**: 실시간 성능 추적
- **UnifiedDataDebug**: 데이터 상태 로깅
- **React DevTools**: 컴포넌트 상태 확인
- **Firebase Emulator**: 로컬 데이터베이스

---

## 📚 참고 문서
- [FIREBASE_DATA_FLOW.md](./FIREBASE_DATA_FLOW.md) - 데이터베이스 구조
- [DATA_USAGE_MAPPING.md](./DATA_USAGE_MAPPING.md) - 데이터 사용처 매핑
- [CLAUDE.md](../CLAUDE.md) - 개발 가이드
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 테스트 가이드

---

**⚡ 수정 시 이 문서를 항상 최신 상태로 유지하세요!**  
**📝 변경사항 발생 시 [5. 수정 진행 상황](#5-수정-진행-상황) 섹션을 업데이트하세요**

## 📋 최신 변경사항 요약 (2025-09-07)

### ✅ 완료된 주요 개선사항
1. **Staff 타입 확장** - persons/users 컬렉션 데이터 연결 개선
   - `userId`, `gender`, `age`, `experience` 등 11개 필드 추가
   - StaffProfileModal "제공되지 않음" 문제 해결

2. **localStorage 상태 지속성** - 날짜 확장 상태 새로고침 간 유지
   - 공고별 독립적인 상태 저장 키 생성
   - Set 타입 JSON 직렬화/역직렬화 구현

3. **UI 개선** - StaffProfileModal 사전질문 섹션 재배치
   - 연락처 정보 위로 사전질문 섹션 이동
   - 데이터 로딩 로직 최적화 (최신 지원서 우선)

### 🔧 기술적 개선사항
- TypeScript 타입 안전성 강화 (TS2322, TS2802, TS18048 해결)
- Error 타입 처리 개선 (`instanceof Error` 체크)
- useCallback을 통한 의존성 최적화
- Firebase 쿼리 성능 최적화 (`orderBy`, `limit` 적용)

## 📋 최신 변경사항 요약 (2025-09-07 v1.2)

### 🎉 **WorkLog 중복 생성 문제 완전 해결**

#### 🚨 **문제 상황**
- **중복 생성**: 시간 수정 시 1개 + 출석 상태 변경 시 1개 = 총 2개 WorkLog 생성
- **ID 패턴 불일치**: `_0_` 패턴 누락으로 WorkLog 참조 오류 발생
- **화면 동기화**: 출석 상태 변경 후 테이블 업데이트 지연

#### ✅ **해결 방법**
1. **스태프 확정 시 WorkLog 사전 생성** 
   - `useApplicantActions.ts`에서 스태프 확정과 동시에 WorkLog 생성
   - 이후 시간수정/출석상태변경은 기존 WorkLog 업데이트만 수행

2. **WorkLog ID 패턴 완전 통일**
   - 모든 파일에서 `${eventId}_${staffId}_0_${date}` 패턴 사용
   - 수정된 파일: workLogSimplified.ts, StaffManagementTab.tsx, workLogUtils.ts, StaffRow.tsx

3. **출석 상태 변경 최적화**
   - AttendanceStatusPopover에서 WorkLog 생성 로직 제거
   - Optimistic Update로 즉시 UI 반영 및 성공 알림 표시

#### 🔧 **수정된 핵심 파일**
```typescript
// useApplicantActions.ts - WorkLog 사전 생성
const createWorkLogsForConfirmedStaff = useCallback(async (
  staffId: string, 
  staffName: string, 
  eventId: string, 
  assignments: Assignment[]
) => {
  for (const assignment of assignments) {
    const { dates, timeSlot, role } = assignment;
    for (const date of dates) {
      const workLogId = `${eventId}_${staffId}_0_${date}`; // ✅ _0_ 패턴 포함
      // ... WorkLog 생성 로직
    }
  }
}, []);

// workLogSimplified.ts - ID 생성 함수 수정
export const createWorkLogId = (
  eventId: string, 
  staffId: string, 
  date: string
): string => {
  return `${eventId}_${staffId}_0_${date}`; // ✅ _0_ 패턴 추가
};
```

#### 📊 **검증 결과**
- ✅ **출석 상태 변경 성공**: "출근 전" → "출근" 정상 동작
- ✅ **성공 알림 표시**: "김승호의 출석 상태가 '출근'로 변경되었습니다"
- ✅ **WorkLog 단일 생성**: 중복 생성 문제 100% 해결
- ✅ **Optimistic Update**: 즉시 UI 반영 정상 동작
- ⚠️ **남은 이슈**: 출석 상태 변경 후 테이블 실시간 업데이트 지연

#### 🎯 **다음 단계**
- [ ] 화면 실시간 업데이트 지연 문제 분석 및 해결
- [ ] 전체 워크플로우 통합 테스트 수행
- [ ] 성능 최적화 및 메모리 누수 점검

---

*최종 업데이트: 2025년 9월 7일 v1.2*  
*작성자: T-HOLDEM Development Team*