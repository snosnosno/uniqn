---
name: type-check
description: TypeScript 타입 에러 검사 및 수정. 타입 체크, 타입 에러, tsc, 타입스크립트 요청 시 활성화
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# 타입 검사 스킬

TypeScript 타입 에러를 검사하고 수정합니다.

## 타입 검사 실행

```bash
# 프로젝트별 타입 체크
cd uniqn-mobile && npm run type-check
cd app2 && npm run type-check

# 직접 실행
npx tsc --noEmit
npx tsc --noEmit --skipLibCheck  # 외부 라이브러리 제외
```

## 자주 발생하는 타입 에러

### 1. Property does not exist
```typescript
// ❌ 에러
const name = user.profile.name;
// Property 'profile' does not exist on type 'User'

// ✅ 해결 1: 타입 정의 추가
interface User {
  profile: {
    name: string;
  };
}

// ✅ 해결 2: 옵셔널 체이닝
const name = user?.profile?.name;
```

### 2. Type 'X' is not assignable to type 'Y'
```typescript
// ❌ 에러
const status: 'pending' | 'confirmed' = 'unknown';

// ✅ 해결 1: 올바른 값 사용
const status: 'pending' | 'confirmed' = 'pending';

// ✅ 해결 2: 타입 확장
type Status = 'pending' | 'confirmed' | 'unknown';
```

### 3. Object is possibly 'undefined'
```typescript
// ❌ 에러
const items = data.items;
items.map(item => item.name);

// ✅ 해결 1: 옵셔널 체이닝
const items = data?.items ?? [];
items.map(item => item.name);

// ✅ 해결 2: 타입 가드
if (data?.items) {
  data.items.map(item => item.name);
}

// ✅ 해결 3: Non-null assertion (확실할 때만)
const items = data!.items;
```

### 4. Argument of type 'X' is not assignable to parameter of type 'Y'
```typescript
// ❌ 에러
function process(id: string) { ... }
process(123);  // number는 안됨

// ✅ 해결
process(String(123));
// 또는 함수 오버로드
function process(id: string | number) { ... }
```

### 5. Cannot find module 'X'
```typescript
// ❌ 에러
import { util } from '@/utils/util';
// Cannot find module '@/utils/util'

// ✅ 해결 1: 경로 확인
import { util } from '@/utils/utilFunctions';

// ✅ 해결 2: tsconfig paths 확인
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 6. Type 'any'
```typescript
// ❌ 에러 (strict 모드)
function process(data) { ... }  // implicit any

// ✅ 해결
function process(data: UserData) { ... }

// 타입을 모를 때
function process(data: unknown) {
  if (isUserData(data)) {
    // 타입 가드 후 사용
  }
}
```

### 7. Firebase 타입 에러
```typescript
// ❌ 에러
const data = doc.data();
console.log(data.name);  // 'DocumentData' 타입

// ✅ 해결: 타입 단언 또는 제네릭
interface UserDoc {
  name: string;
  email: string;
}

const data = doc.data() as UserDoc;
// 또는
const userRef = doc(db, 'users', id) as DocumentReference<UserDoc>;
```

### 8. React/React Native 타입 에러
```tsx
// ❌ 에러
<Component style={{ color: 'red' }} />
// Style prop 타입 불일치

// ✅ 해결
import { StyleProp, ViewStyle, TextStyle } from 'react-native';

interface Props {
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}
```

## 타입 수정 전략

### 우선순위
1. **any 제거**: 구체적 타입으로 교체
2. **null/undefined 처리**: 옵셔널 체이닝, 기본값
3. **타입 정의 추가**: 누락된 인터페이스
4. **타입 가드 추가**: 런타임 검증

### any 제거 패턴
```typescript
// 1. 구체적 타입으로
const data: any = fetchData();  →  const data: User[] = fetchData();

// 2. unknown + 타입 가드로
const data: any = JSON.parse(str);
↓
const data: unknown = JSON.parse(str);
if (isValidData(data)) { ... }

// 3. 제네릭으로
function fetch(url: string): any { ... }
↓
function fetch<T>(url: string): Promise<T> { ... }
```

## 프로세스

### 1단계: 에러 수집
```bash
npm run type-check 2>&1 | tee type-errors.txt
```

### 2단계: 에러 분류
- 파일별 그룹화
- 에러 타입별 분류
- 우선순위 결정

### 3단계: 수정
- 한 파일씩 수정
- 관련 타입 정의 확인
- 테스트 실행

### 4단계: 검증
```bash
npm run type-check  # 0 errors 확인
npm run lint        # 린트 통과 확인
npm test            # 테스트 통과 확인
```

## 출력 형식

```markdown
## 타입 검사 결과

### 요약
- 총 에러: [N개]
- 파일 수: [N개]
- 주요 에러 타입: [타입 목록]

### 파일별 에러

#### `src/services/jobService.ts`
1. Line 42: Property 'status' does not exist
   - 원인: JobPosting 타입에 status 필드 누락
   - 해결: 인터페이스에 status 추가

2. Line 78: Type 'string | undefined' is not assignable
   - 원인: 옵셔널 필드 미처리
   - 해결: ?? 연산자로 기본값 제공

### 수정 계획
- [ ] JobPosting 인터페이스 업데이트
- [ ] null 처리 추가
- [ ] 타입 체크 재실행
```
