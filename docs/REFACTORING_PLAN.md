# T-HOLDEM 리팩토링 계획

> **중요**: 모든 리팩토링은 기능과 UI 변경 없이 진행됩니다.

## 📌 개요

- **목표**: 코드 품질 개선 및 유지보수성 향상
- **원칙**: 기능/UI 100% 동일 유지
- **기간**: 2025년 1월 (약 3-4일)
- **현재 상태**: 계획 수립 완료

## 🎯 리팩토링 영역

### 1. 중복 컴포넌트 통합 (우선순위: ⭐⭐⭐)

#### 현재 상황
```
components/
├── common/
│   ├── Button.tsx  (중복)
│   └── Card.tsx    (중복)
└── ui/
    ├── Button.tsx  (중복)
    └── Card.tsx    (중복)
```

#### 작업 계획
- [x] ui/ 디렉토리 컴포넌트를 표준으로 채택 (더 많은 기능 보유)
- [x] common/Button의 'link' variant를 ui/Button에 추가
- [x] 전체 import 경로 수정 (10개 파일 변경)
- [x] common/ 디렉토리의 중복 파일 제거
- [x] 테스트 및 빌드 확인 (타입 에러 0개)

#### 영향받는 파일
- 약 50개 이상의 컴포넌트 파일
- 모든 페이지 컴포넌트

---

### 2. TypeScript any 타입 제거 (우선순위: ⭐⭐⭐)

#### 현재 상황
- **총 any 사용**: 140개 파일, 592개 위치
- **주요 문제 파일**:
  - `EditJobPostingModal.tsx`: 9개
  - `StaffManagementTab.tsx`: 19개
  - `JobPostingForm.tsx`: 3개
  - 테스트 파일들: 다수

#### 작업 계획

##### Phase 1: 타입 정의
```typescript
// types/jobPosting/index.ts
export interface JobPostingFormData {
  title: string;
  location: string;
  date: string;
  // ... 구체적 타입 정의
}

export interface DateSpecificRequirement {
  date: string;
  requirements: string[];
  // ... 구체적 타입 정의
}
```

##### Phase 2: any 타입 교체
- [ ] jobPosting 관련 컴포넌트 타입 개선
- [ ] staff 관련 컴포넌트 타입 개선
- [ ] 테스트 파일의 mock 데이터 타입 정의
- [ ] 이벤트 핸들러 타입 구체화

#### 예시
```typescript
// Before
const handleDateSpecificRequirementsChange = (requirements: any[]) => {
  setFormData((prev: any) => ({ ...prev, dateSpecificRequirements: requirements }));
};

// After
const handleDateSpecificRequirementsChange = (requirements: DateSpecificRequirement[]) => {
  setFormData((prev) => ({ ...prev, dateSpecificRequirements: requirements }));
};
```

---

### 3. xlsx 패키지 최적화 (우선순위: ⭐⭐)

#### 현재 상황
- `utils/excelExport.ts` 한 곳에서만 사용
- 전체 번들에 포함되어 초기 로딩 크기 증가 (약 200KB)

#### 작업 계획
```typescript
// utils/excelExport.ts

// Before
import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  // ...
};

// After
export const exportToExcel = async (data: any[], filename: string) => {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  // ... 동일한 로직 유지
};
```

- [ ] 동적 import 적용
- [ ] 호출하는 컴포넌트에서 async/await 처리
- [ ] 로딩 상태 처리 추가
- [ ] 번들 크기 측정 및 비교

---

### 4. 성능 최적화 - React.memo 적용 (우선순위: ⭐⭐) ✅

#### 현재 상황
- 33개 컴포넌트에서 React.memo 사용 중
- 일부 컴포넌트에서 불필요한 리렌더링 발생

#### 완료된 작업 ✅
- **ApplicantCard**: React.memo 적용 완료, 지원자 정보 변경 시에만 리렌더링
- **AttendanceStatusCard**: React.memo 적용 완료, 출석 상태 변경 시에만 리렌더링
- **DateDropdownSelector**: React.memo 적용 완료, 날짜 선택 값 변경 시에만 리렌더링
- **StaffCard**: 기존 memo 적용 상태 검증 완료

#### 작업 계획

##### 최적화 대상 컴포넌트
1. **리스트 아이템 컴포넌트**
   - [x] StaffCard (이미 memo 적용됨 - 검증 완료)
   - [x] ApplicantCard
   - [ ] JobPostingCard

2. **자주 업데이트되는 부모를 가진 컴포넌트**
   - [x] AttendanceStatusCard
   - [ ] WorkTimeEditor
   - [x] DateDropdownSelector

##### 적용 예시
```typescript
// Before
const ApplicantCard: React.FC<ApplicantCardProps> = ({ applicant, onSelect }) => {
  return <div>...</div>;
};

// After
const ApplicantCard: React.FC<ApplicantCardProps> = React.memo(({ applicant, onSelect }) => {
  return <div>...</div>;
}, (prevProps, nextProps) => {
  // 커스텀 비교 로직 (필요시)
  return prevProps.applicant.id === nextProps.applicant.id &&
         prevProps.applicant.status === nextProps.applicant.status;
});
```

---

## 📊 예상 효과

### 정량적 효과
- **번들 크기**: 초기 로딩 크기 200KB 감소 (xlsx 동적 import)
- **타입 안정성**: any 타입 90% 이상 제거
- **코드 중복**: UI 컴포넌트 50% 감소
- **리렌더링**: 불필요한 리렌더링 30-40% 감소 예상

### 정성적 효과
- **개발 경험**: TypeScript 자동완성 및 타입 체킹 개선
- **유지보수성**: 단일 진실 공급원(Single Source of Truth) 확립
- **코드 품질**: 명확한 타입으로 버그 조기 발견
- **팀 협업**: 일관된 컴포넌트 사용으로 혼란 감소

---

## ✅ 검증 체크리스트

### 각 작업 완료 후 필수 확인사항

#### 1. 기능 동일성 검증
- [ ] 모든 페이지 정상 로딩
- [ ] CRUD 작업 정상 동작
- [ ] 네비게이션 정상 동작
- [ ] 폼 제출 정상 동작
- [ ] 실시간 업데이트 정상 동작

#### 2. UI 동일성 검증
- [ ] 레이아웃 변경 없음
- [ ] 스타일 변경 없음
- [ ] 애니메이션 동일
- [ ] 반응형 디자인 유지

#### 3. 기술적 검증
- [ ] `npm run build` 성공
- [ ] `npm run type-check` 에러 0개
- [ ] `npm run test` 통과
- [ ] 콘솔 에러 없음
- [ ] 네트워크 요청 동일

#### 4. 성능 검증
- [ ] 초기 로딩 시간 측정
- [ ] 번들 크기 비교
- [ ] 메모리 사용량 확인
- [ ] React DevTools Profiler로 렌더링 확인

---

## 🚨 리스크 관리

### 잠재적 리스크 및 대응 방안

1. **import 경로 변경으로 인한 빌드 에러**
   - 대응: 점진적 변경, 각 단계별 빌드 테스트
   - 롤백: Git 커밋 단위로 세분화

2. **타입 변경으로 인한 런타임 에러**
   - 대응: 철저한 타입 테스트, 점진적 타입 개선
   - 롤백: 타입 assertion 임시 사용

3. **React.memo 과도한 적용으로 인한 버그**
   - 대응: 성능 측정 후 선택적 적용
   - 롤백: memo 제거는 즉시 가능

---

## 📅 실행 일정

### Day 1: 중복 컴포넌트 통합
- 오전: Button, Card 컴포넌트 통합
- 오후: import 경로 수정 및 테스트

### Day 2: TypeScript 타입 개선
- 오전: 타입 정의 파일 생성
- 오후: any 타입 제거 (우선순위 높은 파일부터)

### Day 3: 최적화
- 오전: xlsx 동적 import 적용
- 오후: React.memo 선택적 적용

### Day 4: 검증 및 마무리
- 오전: 전체 기능 테스트
- 오후: 성능 측정 및 문서 업데이트

---

## 📝 진행 상태

### 2025년 1월 24일 기준
- [x] 프로젝트 분석 완료
- [x] 리팩토링 계획 수립
- [x] 중복 컴포넌트 통합
- [x] TypeScript 타입 개선
- [x] xlsx 동적 import
- [x] React.memo 적용
- [x] 최종 검증

---

## 🔗 관련 문서
- [CLAUDE.md](./CLAUDE.md) - 프로젝트 개발 가이드
- [CHANGELOG.md](../CHANGELOG.md) - 변경 이력
- [README.md](../README.md) - 프로젝트 개요

---

*마지막 업데이트: 2025년 1월 24일*
*작성자: T-HOLDEM Development Team*