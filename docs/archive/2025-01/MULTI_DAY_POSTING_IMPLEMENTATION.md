# 다중 날짜 구인공고 자동 선택 기능 구현

## 📋 개요
여러 날짜(예: 08-24 ~ 08-26)로 설정된 구인공고에 지원자가 지원할 때, 모든 날짜를 자동으로 선택하도록 하는 기능을 구현했습니다.

## 🎯 요구사항
- 다중 날짜 공고(예: 08-24~08-26)에 지원 시 모든 날짜 자동 선택
- 각 날짜를 개별 선택으로 취급
- 지원자 확정 시 각 날짜별로 별도 스태프 엔트리 생성
- 중복 날짜 표시 문제 해결

## 🛠️ 구현 내용

### 1. 자동 날짜 확장 기능 (ApplyModal.tsx)

#### 1.1 useEffect를 통한 자동 선택
```typescript
useEffect(() => {
  if (isOpen && selectedAssignments.length === 0) {
    const autoSelectAssignments: Assignment[] = [];
    
    jobPosting.dateSpecificRequirements?.forEach(dateReq => {
      const firstTimeSlot = dateReq.timeSlots?.[0];
      const hasMultiDuration = firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;
      
      if (hasMultiDuration && firstTimeSlot && firstTimeSlot.duration && firstTimeSlot.duration.endDate) {
        // 날짜 범위 확장
        const expandedDates = generateDateRange(startDate, endDate);
        
        expandedDates.forEach(expandedDate => {
          dateReq.timeSlots.forEach(ts => {
            ts.roles.forEach(role => {
              const assignment: Assignment = {
                timeSlot: ts.time,
                role: role.name,
                date: expandedDate,
                ...(ts.duration && { duration: ts.duration })
              };
              
              // 중복 체크 후 추가
              if (!selectedAssignments.some(selected => 
                selected.timeSlot === assignment.timeSlot && 
                selected.role === assignment.role &&
                selected.date === assignment.date
              )) {
                autoSelectAssignments.push(assignment);
              }
            });
          });
        });
      }
    });
    
    // 자동 선택된 항목들 추가
    if (autoSelectAssignments.length > 0) {
      autoSelectAssignments.forEach(assignment => {
        onAssignmentChange(assignment, true);
      });
    }
  }
}, [isOpen]);
```

#### 1.2 날짜별 그룹화 표시
```typescript
// 선택된 항목 미리보기 - 날짜별로 그룹화
const groupedByDate = selectedAssignments.reduce((acc, assignment) => {
  const dateKey = assignment.date || 'no-date';
  if (!acc[dateKey]) {
    acc[dateKey] = [];
  }
  acc[dateKey]!.push(assignment);
  return acc;
}, {} as Record<string, typeof selectedAssignments>);

// 시간대별로 재그룹화
const groupedByTime = groupedByDate[dateKey]!.reduce((acc, assignment) => {
  if (!acc[assignment.timeSlot]) {
    acc[assignment.timeSlot] = [];
  }
  acc[assignment.timeSlot]!.push(assignment);
  return acc;
}, {} as Record<string, typeof selectedAssignments>);
```

### 2. 데이터 구조 업데이트

#### 2.1 Assignment 인터페이스 확장 (useJobBoard.ts)
```typescript
export interface Assignment {
  timeSlot: string;
  role: string;
  date?: string | any;
  duration?: {
    type: 'single' | 'multi';
    endDate?: string;
  };
}
```

#### 2.2 Firebase 데이터 저장
```typescript
// 지원서 데이터 저장 시 duration 정보 포함
const applicationData = {
  // ... 기존 필드들
  assignedRoles: assignments.map(a => a.role),
  assignedTimes: assignments.map(a => a.timeSlot),
  assignedDates: assignments.map(a => a.date || ''),
  assignedDurations: assignments.map(a => a.duration || null),
  // ...
};
```

### 3. 지원자 데이터 처리

#### 3.1 지원자 선택 정보 가져오기 (applicantHelpers.ts)
```typescript
export const getApplicantSelections = (applicant: Applicant) => {
  // 확정 상태: 실제 확정된 선택사항만 반환
  if (applicant.status === 'confirmed') {
    try {
      const confirmedSelections = ApplicationHistoryService.getConfirmedSelections(applicant);
      return confirmedSelections;
    } catch (error) {
      logger.warn('⚠️ 확정된 선택사항 조회 실패, 폴백 진행:', {
        component: 'applicantHelpers',
        data: { error: error instanceof Error ? error.message : String(error) }
      });
      return [];
    }
  }
  
  // 지원 상태: 원본 데이터 복원
  try {
    const originalData = ApplicationHistoryService.getOriginalApplicationData(applicant);
    
    if (originalData.roles.length > 0) {
      const selections = [];
      const maxLength = Math.max(
        originalData.roles.length,
        originalData.times.length,
        originalData.dates.length
      );
      
      for (let i = 0; i < maxLength; i++) {
        const duration = (applicant as any).assignedDurations?.[i] || undefined;
        selections.push({
          role: originalData.roles[i] ?? '',
          time: originalData.times[i] ?? '',
          date: convertDateToString(originalData.dates[i]),
          ...(duration && { duration })
        });
      }
      
      return selections;
    }
  } catch (error) {
    logger.warn('⚠️ ApplicationHistory 원본 데이터 접근 실패, 폴백 진행:', {
      component: 'applicantHelpers',
      data: { error: error instanceof Error ? error.message : String(error) }
    });
  }
  
  // 폴백 로직...
};
```

#### 3.2 안전한 날짜 변환
```typescript
export const convertDateToString = (rawDate: any): string => {
  if (!rawDate) return '';
  
  if (typeof rawDate === 'string') {
    return rawDate;
  } else if (rawDate.toDate) {
    // Firestore Timestamp 객체
    try {
      return rawDate.toDate().toISOString().split('T')[0] || '';
    } catch (error) {
      logger.error('❌ Timestamp 변환 오류:', error);
      return '';
    }
  } else if (rawDate.seconds) {
    // seconds 속성이 있는 경우
    try {
      return new Date(rawDate.seconds * 1000).toISOString().split('T')[0] || '';
    } catch (error) {
      logger.error('❌ seconds 변환 오류:', error);
      return '';
    }
  } else {
    // 기타 타입
    try {
      return String(rawDate);
    } catch (error) {
      logger.error('❌ 날짜 변환 오류:', error);
      return '';
    }
  }
};
```

### 4. UI 개선 - 중복 날짜 표시 해결

#### 4.1 ApplyModal 선택 항목 미리보기 개선
**이전 문제**: 같은 날짜가 역할 수만큼 반복 표시
```
📅 08-25(일) - ⏰ 09:00 - 👤 딜러
📅 08-25(일) - ⏰ 09:00 - 👤 플로어
📅 08-25(일) - ⏰ 09:00 - 👤 서빙
```

**개선 후**: 날짜별로 그룹화하여 깔끔하게 표시
```
📅 08-25(일)
  ⏰ 09:00 - 딜러, 플로어, 서빙
```

#### 4.2 ApplicantCard 확정 정보 표시 개선
**이전 문제**: 각 역할별로 날짜가 개별 표시되어 중복
**개선 후**: 날짜별로 카드를 만들어 시간대와 역할을 그룹화

```typescript
// 날짜별로 그룹화하여 표시
const groupedByDate = confirmedSelections.reduce((acc, selection) => {
  const dateKey = selection.date || 'no-date';
  if (!acc[dateKey]) {
    acc[dateKey] = [];
  }
  acc[dateKey].push(selection);
  return acc;
}, {} as Record<string, typeof confirmedSelections>);

// 각 날짜를 별도 카드로 표시
sortedDates.map(dateKey => (
  <div key={dateKey} className="bg-white p-3 rounded border">
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md">
      📅 {formatDateDisplay(dateKey)}
    </span>
    {/* 시간대별 역할 표시 */}
  </div>
))
```

## 🐛 해결된 문제들

### 1. Date.toISOString() Invalid time value 에러
- **원인**: Firestore Timestamp 객체를 직접 Date로 변환 시도
- **해결**: 안전한 날짜 변환 함수 구현 (convertDateToString)

### 2. TypeScript 타입 에러
- **원인**: undefined 가능성이 있는 객체 접근
- **해결**: Non-null assertion operator(!) 사용 및 타입 명시

### 3. 중복 렌더링 문제
- **원인**: 조건부 렌더링에서 두 개의 return 문 사용
- **해결**: if-else 구조로 변경하여 단일 return 보장

### 4. 날짜 중복 표시
- **원인**: 각 역할별로 개별 assignment 생성 및 표시
- **해결**: 날짜별, 시간대별 그룹화 로직 구현

## 📁 수정된 파일들

1. **ApplyModal.tsx** (`app2/src/pages/JobBoard/components/`)
   - 자동 날짜 선택 useEffect 추가
   - 선택 항목 미리보기 그룹화
   - 안전한 날짜 변환 처리

2. **useJobBoard.ts** (`app2/src/pages/JobBoard/hooks/`)
   - Assignment 인터페이스에 duration 필드 추가
   - Firebase 저장 시 assignedDurations 포함

3. **applicantHelpers.ts** (`app2/src/components/applicants/ApplicantListTab/utils/`)
   - convertDateToString 함수 추가
   - getApplicantSelections 함수 개선
   - duration 정보 처리 추가

4. **ApplicantCard.tsx** (`app2/src/components/applicants/ApplicantListTab/`)
   - 확정 정보 날짜별 그룹화 표시
   - 시간대별 역할 그룹화

5. **useApplicantData.ts** (`app2/src/components/applicants/ApplicantListTab/hooks/`)
   - assignedDurations 필드 매핑 추가

6. **types.ts** (`app2/src/components/applicants/ApplicantListTab/`)
   - Applicant 인터페이스에 duration 관련 타입 추가

## ✅ 최종 결과

- **TypeScript 컴파일**: 에러 0개
- **빌드 상태**: 성공 (경고만 존재)
- **기능 동작**: 
  - ✅ 다중 날짜 공고 자동 선택
  - ✅ 각 날짜 개별 토글 가능
  - ✅ 중복 없는 깔끔한 UI 표시
  - ✅ 안전한 날짜 변환 처리

## 🔄 워크플로우

1. **구인공고 생성**: 관리자가 여러 날짜 선택 (예: 08-24 ~ 08-26)
2. **지원자 지원**: 
   - 모달 열림 시 자동으로 모든 날짜 선택됨
   - 지원자는 필요시 개별 날짜 선택/해제 가능
3. **데이터 저장**: 각 날짜-시간-역할 조합이 개별 assignment로 저장
4. **지원자 확인**: 관리자가 지원자 탭에서 날짜별로 그룹화된 정보 확인
5. **스태프 확정**: 각 날짜별로 별도 스태프 엔트리 생성

## 📝 주의사항

- Firestore Timestamp 객체는 직접 Date로 변환 불가
- TypeScript strict mode에서는 undefined 체크 필수
- React useEffect 의존성 배열 관리 주의 (무한 루프 방지)
- 날짜 그룹화 시 정렬 순서 고려 필요

---

*마지막 업데이트: 2025년 1월 25일*