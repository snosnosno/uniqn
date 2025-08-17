# 🔄 T-HOLDEM 상태 관리 현황 분석

## 📊 현재 상태 관리 구조

### Context API 사용 현황

#### 1. **AuthContext** (인증 상태)
- **위치**: `src/contexts/AuthContext.tsx`
- **관리 상태**:
  - `currentUser`: Firebase 사용자 정보
  - `loading`: 인증 로딩 상태
  - `isAdmin`: 관리자 권한 여부
  - `role`: 사용자 역할
- **제공 함수**:
  - `signIn()`, `signOut()`, `sendPasswordReset()`, `signInWithGoogle()`
- **사용처**: 전체 앱 (최상위 Provider)

#### 2. **TournamentContext** (토너먼트 상태)
- **위치**: `src/contexts/TournamentContext.tsx`
- **관리 상태**:
  - `participants`: 참가자 목록
  - `tables`: 테이블 배치
  - `blindLevels`: 블라인드 레벨
  - `settings`: 토너먼트 설정
- **복잡도**: 높음 (useReducer 사용)
- **사용처**: 토너먼트 관련 페이지

#### 3. **ToastContext** (알림 상태)
- **위치**: `src/contexts/ToastContext.tsx`
- **관리 상태**:
  - `toasts`: 알림 메시지 배열
- **제공 함수**:
  - `showToast()`, `showSuccess()`, `showError()`, `removeToast()`
- **사용처**: 전체 앱

#### 4. **JobPostingContext** (공고 관리)
- **위치**: `src/contexts/JobPostingContext.tsx`
- **관리 상태**:
  - `jobPostings`: 공고 목록
  - `applications`: 지원 현황
  - `staff`: 스태프 정보
- **사용처**: 공고/스태프 관련 페이지

### 상태 관리 복잡도 분석

#### 🔴 높은 복잡도
1. **TournamentContext**
   - useReducer로 복잡한 상태 관리
   - 다중 액션 타입 (10개 이상)
   - 중첩된 상태 구조

2. **JobPostingContext**
   - 여러 관련 엔티티 관리
   - Firebase 실시간 구독
   - 캐싱 로직 포함

#### 🟡 중간 복잡도
1. **AuthContext**
   - Firebase Auth와 통합
   - 역할 기반 권한 관리
   - 세션 상태 추적

#### 🟢 낮은 복잡도
1. **ToastContext**
   - 단순한 배열 상태
   - 명확한 액션

## 🔍 문제점 분석

### 1. **Context Hell (Provider 중첩)**
```tsx
<AuthProvider>
  <ToastProvider>
    <JobPostingProvider>
      <TournamentProvider>
        <App />
      </TournamentProvider>
    </JobPostingProvider>
  </ToastProvider>
</AuthProvider>
```

### 2. **불필요한 리렌더링**
- Context 값이 변경되면 모든 구독 컴포넌트 리렌더링
- 특히 JobPostingContext는 자주 업데이트됨

### 3. **상태 로직 분산**
- 일부는 Context에서, 일부는 커스텀 훅에서 관리
- 일관성 없는 상태 관리 패턴

### 4. **타입 안전성 부족**
- useReducer 액션 타입이 복잡함
- Context 값의 undefined 체크 필요

## 📈 상태 의존성 그래프

```
App
├── AuthContext (전역)
│   ├── 모든 페이지
│   └── PrivateRoute 컴포넌트
├── ToastContext (전역)
│   └── 모든 액션 결과 표시
├── JobPostingContext
│   ├── JobBoardPage
│   ├── StaffListPage
│   ├── StaffManagementTab
│   └── 관련 컴포넌트들
└── TournamentContext
    ├── TournamentDashboard
    ├── TablesPage
    ├── ParticipantsPage
    └── 관련 컴포넌트들
```

## 🎯 개선 방향

### 1. **Zustand 도입의 이점**

#### 장점
- **번들 크기**: ~8KB (매우 가벼움)
- **TypeScript 지원**: 완벽한 타입 추론
- **DevTools**: Redux DevTools 호환
- **선택적 구독**: 필요한 상태만 구독
- **미들웨어**: persist, immer 등 지원

#### 적용 우선순위
1. **TournamentContext** → Zustand (복잡도 높음)
2. **JobPostingContext** → Zustand (업데이트 빈도 높음)
3. **AuthContext** → Context 유지 (전역 필수)
4. **ToastContext** → Context 유지 (단순함)

### 2. **마이그레이션 전략**

#### Phase 1: 하이브리드 접근
```typescript
// stores/tournamentStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface TournamentState {
  participants: Participant[];
  tables: Table[];
  blindLevels: BlindLevel[];
  
  // Actions
  addParticipant: (participant: Participant) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  resetTournament: () => void;
}

export const useTournamentStore = create<TournamentState>()(
  devtools(
    persist(
      (set) => ({
        participants: [],
        tables: [],
        blindLevels: [],
        
        addParticipant: (participant) =>
          set((state) => ({
            participants: [...state.participants, participant]
          })),
          
        updateTable: (tableId, updates) =>
          set((state) => ({
            tables: state.tables.map(table =>
              table.id === tableId ? { ...table, ...updates } : table
            )
          })),
          
        resetTournament: () =>
          set({ participants: [], tables: [], blindLevels: [] })
      }),
      {
        name: 'tournament-storage'
      }
    )
  )
);
```

#### Phase 2: 점진적 마이그레이션
1. 새 기능은 Zustand로 구현
2. 기존 Context는 점진적으로 교체
3. 하위 호환성 유지

### 3. **상태 관리 가이드라인**

#### 언제 Context를 사용할까?
- 전역 인증 상태
- 테마 설정
- 국제화(i18n) 설정

#### 언제 Zustand를 사용할까?
- 복잡한 비즈니스 로직
- 자주 업데이트되는 상태
- 여러 컴포넌트에서 공유하는 상태

#### 언제 로컬 상태를 사용할까?
- 단일 컴포넌트 상태
- 폼 입력 상태
- UI 토글 상태

## 📊 예상 개선 효과

### 성능 개선
- **리렌더링 감소**: 30-50%
- **번들 크기**: Context 코드 감소
- **초기 로딩**: Provider 중첩 제거

### 개발자 경험
- **타입 안전성**: 100% 타입 추론
- **디버깅**: DevTools 지원
- **테스트**: 상태 격리 용이

### 유지보수성
- **코드 구조**: 명확한 상태 관리
- **확장성**: 새 기능 추가 용이
- **일관성**: 통일된 패턴

## 🔧 즉시 적용 가능한 개선

### 1. Context 최적화
```typescript
// 값과 함수 분리
const AuthValueContext = createContext<AuthState | null>(null);
const AuthActionsContext = createContext<AuthActions | null>(null);

// 선택적 구독
export const useAuthState = () => useContext(AuthValueContext);
export const useAuthActions = () => useContext(AuthActionsContext);
```

### 2. 메모이제이션 적용
```typescript
const value = useMemo(() => ({
  currentUser,
  loading,
  isAdmin,
  role
}), [currentUser, loading, isAdmin, role]);

const actions = useMemo(() => ({
  signIn,
  signOut,
  sendPasswordReset
}), []); // 함수는 변경되지 않음
```

### 3. 상태 분할
```typescript
// 큰 Context를 작은 단위로 분할
<UserProfileProvider>
<UserPermissionsProvider>
<UserSettingsProvider>
```

이 분석을 바탕으로 단계적으로 상태 관리를 개선하면 성능과 개발자 경험을 크게 향상시킬 수 있습니다.