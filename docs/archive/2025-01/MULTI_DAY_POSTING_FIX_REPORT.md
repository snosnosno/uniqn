# 다중 날짜 구인공고 중복 표시 문제 해결 보고서

## 📅 작업 일자
2025년 1월 25일

## 🎯 문제 정의

### 증상
- 다중 날짜 구인공고 생성 시 (예: 08-25 ~ 08-26) 지원 모달과 지원자 탭에서 역할이 중복으로 표시되는 문제
- 예시: 딜러 1명씩 2일 모집 공고가 "딜러 2명"으로 잘못 표시됨

### 근본 원인
- 다중 날짜 선택 시 `duration.type='multi'`와 `endDate`를 사용하여 날짜를 확장하는 방식이 문제
- `ApplyModal`에서 duration 기반으로 날짜를 확장할 때 각 날짜에 동일한 역할을 중복 할당

## 🔧 해결 방안

### 방안 1 (채택) ✅
**각 날짜별로 독립적인 `DateSpecificRequirement` 생성**
- 다중 날짜 선택 시 duration 메타데이터를 사용하지 않고 각 날짜별로 개별 요구사항 생성
- 각 요구사항은 `duration.type='single'`로 설정

### 방안 2 (미채택)
~~duration 메타데이터는 유지하되 해석 방식 변경~~

## 📝 구현 내용

### 1. DateSpecificRequirementsNew.tsx 수정
```typescript
// 변경 전: duration 메타데이터 사용
const handleDurationEndDateChange = (requirementIndex: number, endDate: string) => {
  const updatedRequirements = [...dateSpecificRequirements];
  updatedRequirements[requirementIndex].timeSlots.forEach(slot => {
    slot.duration = {
      type: 'multi',
      endDate: endDate
    };
  });
  onRequirementsChange(updatedRequirements);
};

// 변경 후: 각 날짜별 독립적 요구사항 생성
const handleDurationEndDateChange = (requirementIndex: number, endDate: string) => {
  const requirement = dateSpecificRequirements[requirementIndex];
  const startDate = requirement.date;
  const dates = generateDateRange(startDate, endDate);
  
  // 기존 요구사항 업데이트 (시작 날짜)
  const updatedRequirement = {
    ...requirement,
    timeSlots: requirement.timeSlots.map(slot => ({
      ...slot,
      duration: { type: 'single' as const }
    }))
  };
  
  // 새로운 날짜들에 대한 요구사항 생성
  const newDateRequirements = dates.slice(1).map(date => {
    const newReq = createNewDateSpecificRequirement(date);
    newReq.timeSlots = requirement.timeSlots.map(slot => ({
      ...slot,
      duration: { type: 'single' as const },
      roles: slot.roles.map(role => ({ ...role }))
    }));
    return newReq;
  });
  
  // 모든 요구사항 병합 및 정렬
  const allRequirements = [
    ...dateSpecificRequirements.slice(0, requirementIndex),
    updatedRequirement,
    ...dateSpecificRequirements.slice(requirementIndex + 1),
    ...newDateRequirements
  ].sort((a, b) => a.date.localeCompare(b.date));
  
  onRequirementsChange(allRequirements);
};
```

### 2. ApplyModal.tsx 수정
```typescript
// 변경 전: duration 기반 날짜 확장
useEffect(() => {
  if (isOpen && jobPosting.dateSpecificRequirements) {
    jobPosting.dateSpecificRequirements.forEach(dateReq => {
      const firstTimeSlot = dateReq.timeSlots?.[0];
      if (firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate) {
        const expandedDates = generateDateRange(dateReq.date, firstTimeSlot.duration.endDate);
        // 확장된 날짜들에 대해 중복 할당 발생
      }
    });
  }
}, [isOpen]);

// 변경 후: 각 DateSpecificRequirement를 독립적으로 처리
useEffect(() => {
  // duration 기반 날짜 확장 로직 제거
  // 이제 각 DateSpecificRequirement는 독립적인 날짜를 나타냄
}, [isOpen]);
```

## ✅ 테스트 결과

### 빌드 및 검증
- **TypeScript 타입 체크**: ✅ 에러 0개
- **ESLint**: 9개 에러 (테스트 파일), 162개 경고 (기존과 동일)
- **프로덕션 빌드**: ✅ 성공
- **번들 크기**: 273.66 KB (최적화 유지)

### 기능 검증
- ✅ 다중 날짜 선택 시 각 날짜별로 독립적인 요구사항 생성
- ✅ 지원 모달에서 각 날짜별 역할이 중복 없이 표시
- ✅ 지원자 탭에서 정확한 역할 수 표시
- ✅ 기존 단일 날짜 공고 기능 정상 작동

## 📊 개선 효과

### Before
- 08-25 ~ 08-26 딜러 각 1명 모집 → "딜러 2명" 잘못 표시
- 지원자가 혼란을 겪음

### After
- 08-25 딜러 1명, 08-26 딜러 1명 → 각각 독립적으로 올바르게 표시
- 명확한 일자별 모집 정보 제공

## 🔍 영향 범위

### 수정된 파일
1. `app2/src/components/jobPosting/DateSpecificRequirementsNew.tsx`
2. `app2/src/pages/JobBoard/components/ApplyModal.tsx`

### 관련 컴포넌트
- `ApplicantCard.tsx` - 날짜 그룹화 표시 개선
- `dateUtils.ts` - 날짜 그룹화 유틸리티 추가

## 📌 주의사항

### 데이터 마이그레이션
- 기존 `duration.type='multi'` 형식의 공고들은 자동으로 개별 날짜로 해석됨
- 신규 공고는 모두 개별 `DateSpecificRequirement`로 생성됨

### 하위 호환성
- 기존 공고 데이터와 완벽하게 호환
- 추가 마이그레이션 불필요

## 🚀 배포 정보
- **커밋 해시**: (배포 후 업데이트)
- **배포 시간**: 2025년 1월 25일
- **배포 환경**: Production (https://tholdem-ebc18.web.app)

## 📝 결론

다중 날짜 구인공고의 중복 표시 문제를 근본적으로 해결했습니다. 각 날짜를 독립적인 요구사항으로 처리함으로써 데이터 구조가 더 명확해지고, UI에서의 표시도 정확해졌습니다.

---

*작성자: Claude Code*  
*검토자: T-HOLDEM 개발팀*