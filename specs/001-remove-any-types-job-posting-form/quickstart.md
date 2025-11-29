# Quickstart: useJobPostingForm.ts any 타입 제거

**Phase**: 1 (Design & Contracts)
**Date**: 2025-11-05
**Purpose**: 개발자가 빠르게 타입 안전성 개선 작업을 이해하고 시작할 수 있도록 안내합니다.

## 5분 요약

이 작업은 useJobPostingForm.ts Hook에서 28회 사용 중인 `any` 타입을 완전히 제거하여, TypeScript strict mode를 100% 준수하는 타입 안전성을 확보합니다.

**목표**:
- ✅ `any` 타입 28회 → 0회
- ✅ npm run type-check 에러 0개
- ✅ 기존 기능 100% 정상 작동
- ✅ IDE 자동완성 100% 제공

**범위**:
- 📄 수정 파일: `app2/src/hooks/useJobPostingForm.ts` (370줄)
- 🔗 참조 파일: `app2/src/types/jobPosting/jobPosting.ts`, `app2/src/types/jobPosting/base.ts`

---

## 사전 요구사항

### 필수 지식
- TypeScript 기본 문법 (제네릭, 인터페이스, 타입 가드)
- React Hooks (useState, useCallback)
- Firebase Firestore 타입 (Timestamp)

### 개발 환경
- Node.js 24.3.0+
- TypeScript 4.9.5
- VSCode (권장 IDE)

### 설치된 패키지
```bash
cd app2
npm install
```

---

## 빠른 시작

### 1. 브랜치 체크아웃

```bash
git checkout 001-remove-any-types-job-posting-form
```

### 2. 현재 상태 확인

```bash
cd app2
npm run type-check
```

**예상 결과**: 타입 에러 0개 (수정 후)

### 3. 파일 위치 확인

```bash
code app2/src/hooks/useJobPostingForm.ts
```

### 4. 주요 수정 영역

파일을 열면 다음 패턴이 28회 반복됩니다:

```typescript
// ❌ 수정 전 (any 타입 사용)
const [formData, setFormData] = useState<any>(() => ...);
setFormData((prev: any) => ({ ...prev, ... }));
```

**목표**: 이 모든 `any`를 명시적 타입으로 대체

---

## 핵심 변경 사항

### 변경 1: useState 타입 지정

**수정 전**:
```typescript
const [formData, setFormData] = useState<any>(() =>
  initialData ? initialData : createInitialFormData()
);
```

**수정 후**:
```typescript
const [formData, setFormData] = useState<JobPostingFormData>(() =>
  initialData ? initialData : createInitialFormData()
);
```

**설명**: `JobPostingFormData`는 이미 `app2/src/types/jobPosting/jobPosting.ts`에 정의되어 있습니다.

---

### 변경 2: setFormData 콜백 타입 지정

**수정 전**:
```typescript
setFormData((prev: any) => ({ ...prev, [name]: value }));
```

**수정 후**:
```typescript
setFormData((prev: JobPostingFormData) => ({ ...prev, [name]: value }));
```

**설명**: `prev` 매개변수의 타입을 명시하여 IDE 자동완성과 타입 체크가 정상 작동합니다.

---

### 변경 3: useCallback 의존성 배열 검토

**수정 전**:
```typescript
const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
}, []); // 의존성 배열이 정확한지 확인
```

**수정 후**:
```typescript
const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData((prev: JobPostingFormData) => ({ ...prev, [name]: value }));
}, []); // setFormData는 React가 보장하는 안정적 참조이므로 빈 배열
```

**설명**: 의존성 배열은 변경할 필요 없지만, 타입을 명시하여 안전성을 확보합니다.

---

## 검증 방법

### 단계별 검증

1. **타입 체크**:
   ```bash
   npm run type-check
   ```
   **기대 결과**: 에러 0개

2. **ESLint 검사**:
   ```bash
   npm run lint
   ```
   **기대 결과**: 경고 0개

3. **빌드 테스트**:
   ```bash
   npm run build
   ```
   **기대 결과**: 빌드 성공

4. **수동 폼 테스트**:
   ```bash
   npm start
   ```
   - 구인공고 생성 페이지 접속
   - 폼 입력 및 저장
   - 기존 공고 수정
   - 템플릿 불러오기

5. **IDE 자동완성 확인**:
   - VSCode에서 `formData.` 입력 시 모든 필드 자동완성 확인
   - `setFormData((prev) =>` 입력 시 `prev`의 타입이 `JobPostingFormData`로 추론되는지 확인

---

## 일반적인 문제 해결

### 문제 1: "Property 'X' does not exist on type 'JobPostingFormData'"

**원인**: JobPostingFormData 인터페이스에 없는 필드를 사용하려고 합니다.

**해결책**:
1. `app2/src/types/jobPosting/jobPosting.ts`를 열어 해당 필드가 정의되어 있는지 확인
2. 필드가 선택적(`?`)이면 `formData.field ?? defaultValue` 형태로 사용
3. 필드가 없다면 인터페이스에 추가 (단, 이 작업의 범위를 벗어남)

---

### 문제 2: "Type 'unknown' is not assignable to type 'JobPostingFormData'"

**원인**: Firebase에서 로드한 데이터나 외부 입력의 타입이 불명확합니다.

**해결책**: 타입 가드 함수 사용
```typescript
function isValidJobPostingFormData(data: unknown): data is JobPostingFormData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  return (
    typeof d.title === 'string' &&
    typeof d.description === 'string' &&
    typeof d.location === 'string' &&
    Array.isArray(d.dateSpecificRequirements)
  );
}

// 사용
if (isValidJobPostingFormData(data)) {
  setFormData(data);
} else {
  logger.error('Invalid data', { data });
}
```

---

### 문제 3: "Type 'Timestamp' is not assignable to type 'string'"

**원인**: Firebase Timestamp와 문자열 날짜 간 타입 불일치입니다.

**해결책**: Union 타입 사용 (이미 정의되어 있음)
```typescript
// DateSpecificRequirement 인터페이스는 이미 Union 타입 지원
interface DateSpecificRequirement {
  date: string | Timestamp | { seconds: number };
  // ...
}
```

---

### 문제 4: "Argument of type '...' is not assignable to parameter of type '...'"

**원인**: useCallback 콜백 함수의 매개변수 타입이 불일치합니다.

**해결책**: 매개변수 타입을 명시적으로 지정
```typescript
const handleRoleChange = useCallback((oldRole: string, newRole: string) => {
  setFormData((prev: JobPostingFormData) => {
    // ...
  });
}, []);
```

---

## 다음 단계

이 quickstart를 완료했다면:

1. ✅ **Phase 1 완료**: data-model.md와 quickstart.md를 읽었습니다.
2. 🔄 **Phase 2 진행**: `/speckit.tasks` 명령어로 tasks.md를 생성하여 구체적인 작업 항목을 확인하세요.
3. 💻 **구현 시작**: tasks.md의 작업 항목을 순서대로 진행하세요.

---

## 추가 리소스

### 문서
- [spec.md](./spec.md) - 기능 명세서
- [plan.md](./plan.md) - 구현 계획
- [research.md](./research.md) - 기술 조사
- [data-model.md](./data-model.md) - 데이터 모델 정의

### 프로젝트 문서
- [CLAUDE.md](../../CLAUDE.md) - UNIQN 프로젝트 개발 가이드

### TypeScript 리소스
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

---

## 도움말

문제가 발생하면:

1. **타입 에러**: `npm run type-check` 출력을 자세히 읽어보세요
2. **ESLint 경고**: `npm run lint` 출력을 확인하세요
3. **런타임 에러**: 브라우저 콘솔을 확인하세요
4. **질문**: spec.md의 User Scenarios를 다시 확인하세요

**Happy Coding!** 🎉
