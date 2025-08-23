# 정산탭-스태프탭 동기화 분석 보고서

**작성일**: 2025년 1월 30일  
**분석 대상**: 정산탭(EnhancedPayrollTab), 스태프탭(StaffManagementTab), 정산 상세 모달(DetailEditModal)

## 📊 현재 동기화 상태

### ✅ 정상 작동 부분
1. **공통 데이터 소스 사용**
   - 두 탭 모두 JobPostingContext를 통해 동일한 데이터 소스 사용
   - confirmedStaff와 workLogs 데이터 실시간 동기화

2. **새로고침 메커니즘**
   - refreshStaff(), refreshWorkLogs() 함수 공유
   - 데이터 업데이트 시 자동 반영

### ⚠️ 동기화 이슈

#### 1. **역할별 데이터 분리 불일치**
- **문제**: 정산탭에서 한 스태프가 여러 역할을 가진 경우 역할별로 별도 행 생성
- **코드 위치**: `useStaffWorkData.ts` line 314
```typescript
const uniqueKey = `${staff.userId}_${role}`;
```
- **영향**: 
  - 정산탭: 스태프 1명이 2개 역할 → 2개 행으로 표시
  - 스태프탭: 스태프 1명 → 1개 행으로 표시
  - 결과적으로 정산탭과 스태프탭의 총 인원수가 다르게 표시될 수 있음

#### 2. **WorkLog 매칭 로직 차이**
- **스태프탭 매칭**: 
  ```typescript
  // 단순 ID 매칭
  workLog.staffId === staff.userId
  ```
- **정산탭 매칭**:
  ```typescript
  // 복합 매칭 (ID + applicantId + 이름)
  matchStaffIdentifier(log, [staff.userId, staff.applicantId]) || 
  log.staffName === staff.name
  ```
- **영향**: 정산탭이 더 많은 WorkLog를 매칭할 가능성

#### 3. **실시간 동기화 지연**
- **문제**: 정산탭에서 setTimeout 500ms 사용
- **코드 위치**: `EnhancedPayrollTab.tsx` line 144-146
- **영향**: 데이터 업데이트 시 0.5초 지연 발생

#### 4. **정산 상세 모달의 독립적 데이터 구독**
- **문제**: DetailEditModal이 독립적으로 useUnifiedWorkLogs 호출
- **영향**: Context의 데이터와 일시적 불일치 가능

## 🔧 개선 방안

### 즉시 적용 가능한 수정

#### 1. **역할별 분리 옵션 추가**
```typescript
// useStaffWorkData.ts 수정
interface UseStaffWorkDataProps {
  eventId?: string;
  startDate?: string;
  endDate?: string;
  separateByRole?: boolean; // 새 옵션 추가
}

// 정산탭에서 사용 시
const { staffWorkData } = useStaffWorkData({
  eventId: jobPosting?.id,
  separateByRole: false // 역할별 분리 비활성화
});
```

#### 2. **WorkLog 매칭 로직 통일**
```typescript
// utils/staffMatcher.ts 생성
export const matchStaffToWorkLog = (
  workLog: UnifiedWorkLog, 
  staff: ConfirmedStaff
): boolean => {
  // 통일된 매칭 로직
  const staffIdentifiers = [staff.userId];
  if (staff.applicantId && staff.applicantId !== staff.userId) {
    staffIdentifiers.push(staff.applicantId);
  }
  
  return matchStaffIdentifier(workLog, staffIdentifiers) || 
         workLog.staffName === staff.name;
};
```

#### 3. **setTimeout 제거**
```typescript
// EnhancedPayrollTab.tsx 수정
const handleRefresh = useCallback(() => {
  refreshStaff();
  refreshWorkLogs();
  // setTimeout 제거
}, [refreshStaff, refreshWorkLogs]);
```

### 장기 개선 사항

1. **EventService 활용 강화**
   - Phase 2에서 구현한 EventService를 통한 중앙화된 데이터 관리
   - 캐싱과 실시간 구독 통합

2. **서브컬렉션 완전 마이그레이션**
   - confirmedStaff 필드 → staff 서브컬렉션 완전 이전
   - workLogs 서브컬렉션 활용 강화

3. **역할 관리 시스템 개선**
   - 스태프의 주 역할과 보조 역할 구분
   - 역할별 근무 시간 추적 강화

## 📈 영향도 평가

| 이슈 | 심각도 | 빈도 | 우선순위 |
|------|--------|------|----------|
| 역할별 분리 불일치 | 높음 | 자주 | 1 |
| WorkLog 매칭 차이 | 중간 | 가끔 | 2 |
| 동기화 지연 | 낮음 | 자주 | 3 |
| 모달 독립 구독 | 낮음 | 가끔 | 4 |

## 🎯 권장 조치

### 단기 (1주일 내)
1. ✅ 역할별 분리 옵션 추가로 정산탭/스태프탭 인원수 일치
2. ✅ WorkLog 매칭 로직 통일 함수 생성
3. ✅ setTimeout 제거로 즉시 동기화

### 중기 (1개월 내)
1. EventService 통합 강화
2. 테스트 케이스 작성
3. 성능 모니터링 추가

### 장기 (3개월 내)
1. 서브컬렉션 완전 마이그레이션
2. 역할 관리 시스템 재설계
3. 실시간 동기화 아키텍처 개선

## 📝 결론

현재 정산탭과 스태프탭은 기본적으로 동기화되고 있으나, **역할별 데이터 처리 방식의 차이**로 인해 표시되는 정보가 다를 수 있습니다. 특히 한 스태프가 여러 역할을 수행하는 경우 정산탭에서는 역할별로 별도의 행으로 표시되어 총 인원수가 다르게 보일 수 있습니다.

즉시 적용 가능한 수정사항들을 통해 대부분의 동기화 이슈는 해결 가능하며, 장기적으로는 Phase 2에서 구현한 EventService와 서브컬렉션 구조를 완전히 활용하여 더욱 견고한 동기화 시스템을 구축할 수 있습니다.