# JobPostingForm Sections

구인공고 폼 섹션 컴포넌트 모음

## 📁 디렉토리 구조

```
sections/
├── index.ts                      # 중앙 export
├── BasicInfoSection.tsx          # 기본 정보 섹션 (304줄)
├── DateRequirementsSection.tsx   # 날짜별 요구사항 (110줄)
├── PreQuestionsSection.tsx       # 사전질문 (135줄)
├── SalarySection/                # 급여 정보 섹션
│   ├── index.tsx                 # 메인 컴포넌트 (207줄)
│   ├── RoleSalaryManager.tsx     # 역할별 급여 관리 (117줄)
│   └── README.md                 # 재사용 가이드
└── README.md                     # 이 파일
```

## 🎯 섹션 개요

### 1. BasicInfoSection
**역할**: 공고 제목, 장소, 타입 등 기본 정보 입력
- 공고 제목 (필수)
- 근무 장소 선택 (필수)
- 공고 타입 (지원/고정/대회/긴급)
- 연락처

### 2. SalarySection
**역할**: 급여 정보 및 복리후생 입력
- 기본 급여 (시급/일급/월급/협의)
- 복리후생 (식사/교통/숙소)
- 역할별 차등 급여 (선택)

### 3. DateRequirementsSection
**역할**: 날짜별 인원 요구사항 설정
- 날짜별 타임슬롯 관리
- 역할별 필요 인원 수
- 최대 50개 날짜 지원

### 4. PreQuestionsSection
**역할**: 지원자 사전질문 설정
- 사전질문 토글
- 객관식/주관식 질문
- 질문별 옵션 관리

## 📦 사용법

### 전체 import
```tsx
import {
  BasicInfoSection,
  SalarySection,
  DateRequirementsSection,
  PreQuestionsSection
} from './sections';
```

### 개별 import
```tsx
import BasicInfoSection from './sections/BasicInfoSection';
```

## 🔧 Props Grouping 패턴

모든 섹션은 동일한 패턴을 따릅니다:

```tsx
interface SectionProps<TData, THandlers, TValidation> {
  data: TData;           // 섹션 데이터
  handlers: THandlers;   // 이벤트 핸들러
  validation?: TValidation; // 검증 상태 (선택)
}
```

### 예시

```tsx
<BasicInfoSection
  data={{
    title: '강남 토너먼트',
    location: '강남',
    postingType: 'regular'
  }}
  handlers={{
    onFormChange: (e) => { ... },
    onLocationChange: (loc, dist) => { ... }
  }}
  validation={{
    errors: { title: '제목을 입력하세요' },
    touched: { title: true }
  }}
/>
```

## ⚡ 성능 최적화

### React.memo
모든 섹션에 `React.memo` 적용으로 불필요한 재렌더링 방지

### useMemo
대형 배열(50개 이상) 메모이제이션:
- DateRequirementsSection: `dateSpecificRequirements`

### 조건부 렌더링
- PreQuestionsSection: `usesPreQuestions` 체크
- SalarySection: `useRoleSalary` 체크

## 🎨 다크모드

모든 섹션이 다크모드를 완전히 지원합니다:

```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
```

## 🔍 관련 파일

### 타입 정의
- `app2/src/types/jobPosting/basicInfoProps.ts`
- `app2/src/types/jobPosting/salaryProps.ts`
- `app2/src/types/jobPosting/dateRequirementsProps.ts`
- `app2/src/types/jobPosting/preQuestionsProps.ts`

### Zod 스키마
- `app2/src/schemas/jobPosting/basicInfo.schema.ts`
- `app2/src/schemas/jobPosting/salary.schema.ts`
- `app2/src/schemas/jobPosting/dateRequirements.schema.ts`
- `app2/src/schemas/jobPosting/preQuestions.schema.ts`

## 📝 주의사항

1. **필수 Props**: `data`와 `handlers`는 모든 섹션에서 필수
2. **타입 안전성**: TypeScript strict mode 준수
3. **상대 경로**: 모든 import는 상대 경로 사용
4. **메모이제이션**: 부모에서 `useMemo`로 props 객체 생성 권장

## 🧪 테스트

각 섹션은 독립적으로 테스트 가능:

```tsx
// __tests__/sections/BasicInfoSection.test.tsx
describe('BasicInfoSection', () => {
  it('renders with data', () => {
    const data = { title: 'Test', location: '강남', postingType: 'regular' };
    const handlers = { onFormChange: jest.fn(), onLocationChange: jest.fn() };

    render(<BasicInfoSection data={data} handlers={handlers} />);
    expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
  });
});
```

## 📚 더 알아보기

- [SalarySection 재사용 가이드](./SalarySection/README.md)
- [Props Grouping 패턴 문서](../../../../../docs/patterns/props-grouping.md)
- [메인 폼 문서](../README.md)
