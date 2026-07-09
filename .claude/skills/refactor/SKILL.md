---
name: refactor
description: 코드 리팩토링 분석 및 실행. 리팩토링, 개선, 정리해줘, 클린업, 중복 제거 요청 시 활성화
allowed-tools: Read, Edit, Write, Grep, Glob, Task, Bash
---

# 리팩토링 스킬

코드 품질을 개선하면서 기능은 유지합니다.

## 리팩토링 원칙

1. **기능 변경 없음**: 동작은 그대로, 구조만 개선
2. **작은 단위**: 한 번에 하나의 리팩토링만
3. **테스트 유지**: 기존 테스트가 통과해야 함
4. **점진적 개선**: 완벽보다 꾸준한 개선

## 리팩토링 체크리스트

### 1. 중복 코드 (DRY)
- [ ] 동일한 코드가 2곳 이상에 존재하는가?
- [ ] 유사한 로직이 여러 곳에 흩어져 있는가?
- [ ] 공통 유틸리티로 추출 가능한가?

```typescript
// ❌ 중복
const formatDate1 = (date: Date) => date.toLocaleDateString('ko-KR');
const formatDate2 = (date: Date) => date.toLocaleDateString('ko-KR');

// ✅ 통합
// utils/formatters.ts
export const formatDate = (date: Date) => date.toLocaleDateString('ko-KR');
```

### 2. 함수 분리 (Single Responsibility)
- [ ] 함수가 한 가지 일만 하는가?
- [ ] 함수 길이가 50줄을 넘는가?
- [ ] 함수명이 동작을 정확히 설명하는가?

```typescript
// ❌ 여러 책임
async function processApplication(app: Application) {
  // 검증
  if (!app.userId) throw new Error();
  // 저장
  await setDoc(ref, app);
  // 알림
  await sendNotification(app.userId);
  // 로깅
  logger.info('처리 완료');
}

// ✅ 분리
async function processApplication(app: Application) {
  validateApplication(app);
  await saveApplication(app);
  await notifyUser(app.userId);
  logApplicationProcessed(app);
}
```

### 3. 컴포넌트 분리
- [ ] 컴포넌트가 200줄을 넘는가?
- [ ] props가 10개 이상인가?
- [ ] 재사용 가능한 부분이 있는가?

```tsx
// ❌ 거대 컴포넌트
function JobPostingPage() {
  // 500줄의 코드...
}

// ✅ 분리
function JobPostingPage() {
  return (
    <PageContainer>
      <JobPostingHeader />
      <JobPostingContent />
      <JobPostingActions />
    </PageContainer>
  );
}
```

### 4. 타입 강화
- [ ] any 타입이 사용되고 있는가?
- [ ] 타입 추론이 가능한 곳에 명시적 타입이 있는가?
- [ ] 유니온 타입이 적절히 좁혀지는가?

```typescript
// ❌ 약한 타입
const data: any = await fetchData();
function process(item: any) { ... }

// ✅ 강한 타입
const data: JobPosting[] = await fetchData();
function process(item: JobPosting) { ... }
```

### 5. 네이밍 개선
- [ ] 변수/함수명이 의도를 명확히 표현하는가?
- [ ] 약어가 남용되고 있는가?
- [ ] 일관된 네이밍 컨벤션을 따르는가?

```typescript
// ❌ 불명확
const d = new Date();
const arr = items.filter(x => x.s === 'a');
function proc(i) { ... }

// ✅ 명확
const currentDate = new Date();
const activeItems = items.filter(item => item.status === 'active');
function processApplication(application) { ... }
```

### 6. 조건문 단순화
- [ ] 중첩된 조건문이 3단계 이상인가?
- [ ] 조기 반환(early return)을 사용할 수 있는가?
- [ ] 조건을 변수로 추출할 수 있는가?

```typescript
// ❌ 복잡한 조건
if (user) {
  if (user.role === 'admin') {
    if (user.isActive) {
      return true;
    }
  }
}
return false;

// ✅ 단순화
if (!user) return false;
if (user.role !== 'admin') return false;
if (!user.isActive) return false;
return true;

// 또는
const isActiveAdmin = user?.role === 'admin' && user?.isActive;
return isActiveAdmin ?? false;
```

### 7. 메모이제이션
- [ ] 비용이 큰 계산이 매 렌더링마다 실행되는가?
- [ ] 콜백이 매번 새로 생성되는가?
- [ ] 불필요한 리렌더링이 발생하는가?

```tsx
// ❌ 매 렌더링마다 계산
function Component({ items }) {
  const sorted = items.sort((a, b) => b.date - a.date);
  const onClick = () => console.log('clicked');
}

// ✅ 메모이제이션
function Component({ items }) {
  const sorted = useMemo(() =>
    [...items].sort((a, b) => b.date - a.date),
    [items]
  );
  const onClick = useCallback(() => console.log('clicked'), []);
}
```

### 8. 불필요한 코드 제거
- [ ] 사용되지 않는 변수/함수가 있는가?
- [ ] 주석 처리된 코드가 있는가?
- [ ] 도달할 수 없는 코드가 있는가?

## 리팩토링 프로세스

### 1단계: 현황 파악
```bash
# 파일 크기 확인
wc -l src/**/*.ts

# 중복 코드 검색
grep -r "특정 패턴" src/

# 사용되지 않는 export 확인
npx ts-unused-exports tsconfig.json
```

### 2단계: 우선순위 결정
1. 보안/버그 위험이 있는 코드
2. 자주 수정되는 파일
3. 복잡도가 높은 코드
4. 중복 코드

### 3단계: 리팩토링 실행
1. 작은 단위로 변경
2. 각 변경 후 테스트 실행
3. 커밋 분리

### 4단계: 검증
```bash
npm run type-check
npm run lint
npm test
```

## 위험도 평가 (guard 연동)

리팩토링 전 변경 대상의 위험도를 평가합니다:

### CRITICAL 영역 (추가 확인 필수)
- Firebase Security Rules 관련 코드
- RevenueCat 결제 로직
- UserRole 권한 체계
- Firebase Auth 인증 흐름
- runTransaction 포함 코드

### HIGH 영역 (신중하게 진행)
- Service 레이어 (비즈니스 로직)
- Repository 레이어 (데이터 접근)
- 에러 처리 (AppError 체계)

### LOW 영역 (안전하게 진행 가능)
- UI 컴포넌트 분리
- 유틸리티 함수 추출
- 타입 정의 정리
- 네이밍 개선

위험도가 HIGH 이상인 경우, 반드시 기존 테스트가 통과하는지 확인 후 진행합니다.

## 출력 형식

```markdown
## 리팩토링 제안

### 현황
- 대상 파일: [파일 경로]
- 코드 라인: [라인 수]
- 주요 문제: [문제점]

### 제안 사항
1. **[제안 1]**
   - 이유: ...
   - 예상 효과: ...

2. **[제안 2]**
   - 이유: ...
   - 예상 효과: ...

### 수정 계획
- [ ] Step 1: ...
- [ ] Step 2: ...
- [ ] Step 3: 테스트 확인
```
