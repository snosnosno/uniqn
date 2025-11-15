# Redux DevTools 모니터링 가이드

Zustand Store를 Redux DevTools로 모니터링하는 방법입니다.

## 📦 설치 (이미 완료됨)

```bash
# Redux DevTools Extension 설치
# Chrome: https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd
```

## 🎯 Zustand Store에 devtools 미들웨어 적용 (이미 완료됨)

```typescript
// app2/src/stores/unifiedDataStore.ts
import { devtools } from 'zustand/middleware';

export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // ... Store 정의
    })),
    { name: 'UnifiedDataStore' } // Redux DevTools에 표시될 이름
  )
);
```

## 🔍 Redux DevTools 사용 방법

### 1. Redux DevTools 열기

브라우저 개발자 도구(F12) → **Redux** 탭 클릭

### 2. State 탭

현재 Zustand Store의 전체 상태를 확인할 수 있습니다.

```json
{
  "staff": {}, // Map 객체 (비어 보이지만 실제로는 데이터 있음)
  "workLogs": {},
  "applications": {},
  "attendanceRecords": {},
  "jobPostings": {},
  "isLoading": false,
  "error": null
}
```

⚠️ **주의**: Map 객체는 JSON.stringify로 직렬화되지 않아 빈 객체로 표시될 수 있습니다.

### 3. Diff 탭

상태 변경 전후를 비교할 수 있습니다.

```diff
- isLoading: false
+ isLoading: true
```

### 4. Action 탭

실행된 Action 이력을 확인할 수 있습니다.

```
setStaff
setWorkLogs
setApplications
updateWorkLog
deleteJobPosting
```

### 5. Trace 탭

Action이 실행된 소스 코드 위치를 추적할 수 있습니다.

## 📊 주요 모니터링 포인트

### 1. Firebase 실시간 구독 확인

```javascript
// UnifiedDataInitializer가 구독 시작하면:
Action: subscribeAll

// Firebase onSnapshot이 데이터를 받으면:
Action: setStaff (count: 0)
Action: setWorkLogs (count: 3)
Action: setApplications (count: 4)
Action: setJobPostings (count: 1)
```

### 2. 데이터 업데이트 추적

```javascript
// WorkLog 업데이트 시:
Action: updateWorkLog
State Diff:
  workLogs:
    - "wl123": { status: "not_started", ... }
    + "wl123": { status: "checked_in", ... }
```

### 3. 에러 발생 추적

```javascript
// Firebase 에러 발생 시:
Action: setError
State Diff:
  - error: null
  + error: "Firestore error: permission-denied"
```

## 🛠️ 유용한 기능

### 1. Time Travel Debugging

Redux DevTools에서 특정 Action으로 이동하여 상태를 확인할 수 있습니다.

- **Jump**: 특정 시점으로 이동
- **Skip**: 특정 Action 건너뛰기

### 2. Action Filtering

특정 Action만 필터링하여 볼 수 있습니다.

```
setWorkLogs  (근무 기록 변경만 보기)
setError     (에러 발생만 보기)
```

### 3. Export/Import State

현재 상태를 JSON으로 내보내거나 가져올 수 있습니다.

```json
{
  "isLoading": false,
  "error": null,
  "staff": {},
  "workLogs": {},
  ...
}
```

## 🔧 실전 디버깅 예제

### 예제 1: 지원자가 표시되지 않는 문제

1. **Redux DevTools** → **State** 탭 확인
2. `applications` 객체 확인 (Map이라 빈 객체로 보임)
3. **브라우저 콘솔**에서 실제 데이터 확인:

```javascript
// 콘솔에서 실행
window.__REDUX_DEVTOOLS_EXTENSION__.send({ type: 'GET_STATE' }, window.__zustand_store_state__);
```

4. **Action** 탭에서 `setApplications` 실행 이력 확인
5. 로그 메시지 확인:

```
[UnifiedDataStore] Applications 데이터 업데이트 { count: 4 }
```

### 예제 2: 실시간 업데이트 확인

1. Firestore에서 데이터 수정
2. **Redux DevTools** → **Action** 탭에서 자동으로 Action 발생 확인
3. **Diff** 탭에서 변경 사항 확인

## 📈 성능 모니터링

### 1. 렌더링 최적화 확인

```typescript
// useShallow로 불필요한 리렌더링 방지 확인
const { staff, workLogs } = useUnifiedDataStore(
  useShallow((state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
  }))
);
```

**Redux DevTools**에서:
- `setApplications` 실행 시
- `staff`, `workLogs`만 구독한 컴포넌트는 리렌더링되지 않아야 함

### 2. Map 데이터 직접 확인

Redux DevTools는 Map을 직렬화하지 못하므로, 브라우저 콘솔 로그로 확인:

```typescript
// unifiedDataStore.ts의 onSnapshot 콜백에서
logger.info('[UnifiedDataStore] Applications 데이터 업데이트', {
  count: appsMap.size,
  data: Array.from(appsMap.entries()), // Map → Array 변환
});
```

## 🎯 권장 워크플로우

1. **개발 시작**: Redux DevTools 열기
2. **로그인**: `subscribeAll` Action 발생 확인
3. **데이터 로딩**: 각 컬렉션의 `set*` Actions 확인
4. **기능 테스트**: CRUD Actions 실행 확인
5. **에러 발생**: `setError` Action 확인, State에 에러 메시지 확인

## 🚨 트러블슈팅

### Map 데이터가 빈 객체로 표시됨

**원인**: Map 객체는 JSON.stringify로 직렬화되지 않음

**해결책**: 
1. 브라우저 콘솔 로그 확인
2. logger.info로 Array.from(map.values()) 출력

### Redux DevTools에서 Action이 보이지 않음

**원인**: devtools 미들웨어가 제대로 적용되지 않음

**해결책**:
```typescript
// unifiedDataStore.ts 확인
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({ ... })),
    { name: 'UnifiedDataStore' } // ← 이 부분 확인
  )
);
```

### 실시간 업데이트가 Redux DevTools에 반영되지 않음

**원인**: Zustand의 set 함수를 사용하지 않고 직접 Map을 수정함

**해결책**: 항상 set 함수 사용
```typescript
// ❌ 잘못된 방법
state.staff.set('id', newStaff);

// ✅ 올바른 방법
set((state) => {
  state.staff.set('id', newStaff);
});
```

## 📚 참고 자료

- [Zustand DevTools 미들웨어](https://docs.pmnd.rs/zustand/integrations/persisting-store-data#how-can-i-use-it-with-typescript)
- [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)
- [Immer + Map/Set](https://immerjs.github.io/immer/map-set)

---

**마지막 업데이트**: 2025-11-15  
**작성자**: Claude Code  
**프로젝트**: UNIQN (T-HOLDEM)
