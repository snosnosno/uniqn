# 🏪 Zustand 마이그레이션 가이드

## 개요

Context API + useReducer에서 Zustand로 마이그레이션하여 상태 관리를 단순화하고 성능을 개선합니다.

## 🚀 마이그레이션 전략

### Phase 1: 호환성 레이어 구현 ✅
- TournamentContextAdapter 생성
- 기존 API 유지하면서 내부적으로 Zustand 사용
- 기존 코드 변경 없이 즉시 적용 가능

### Phase 2: 점진적 마이그레이션
- 새 컴포넌트에서 Zustand 직접 사용
- 기존 컴포넌트를 하나씩 업데이트
- 성능 개선 확인

### Phase 3: 완전 마이그레이션
- Context 래퍼 제거
- Zustand만 사용

## 📊 비교

### Context API + useReducer
```typescript
// 복잡한 설정
const TournamentContext = createContext();
const tournamentReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_PARTICIPANTS':
      return { ...state, participants: action.payload };
    // ... 많은 케이스들
  }
};

// 사용
const { state, dispatch } = useTournament();
dispatch({ type: 'UPDATE_PARTICIPANTS', payload: participants });
```

### Zustand
```typescript
// 간단한 설정
const useTournamentStore = create((set) => ({
  participants: [],
  updateParticipants: (participants) => set({ participants }),
}));

// 사용
const { participants, updateParticipants } = useTournamentStore();
updateParticipants(newParticipants);
```

## 🎯 주요 장점

### 1. 보일러플레이트 감소
- Action 타입 정의 불필요
- Reducer 로직 간소화
- Provider 래핑 최소화

### 2. 성능 개선
- 선택적 구독으로 불필요한 리렌더링 방지
- 자동 메모이제이션
- DevTools 통합

### 3. 개발자 경험
- TypeScript 자동 추론
- 직관적인 API
- 미들웨어 지원 (persist, devtools, immer)

## 🔧 사용 방법

### 기존 방식 (호환성 유지)
```typescript
import { useTournament } from './contexts/TournamentContextAdapter';

const TournamentComponent = () => {
  const { state, dispatch } = useTournament();
  
  const addPlayer = (name: string) => {
    dispatch({ type: 'ADD_PARTICIPANT', payload: { name } });
  };
  
  return (
    <div>
      참가자: {state.participants.length}명
    </div>
  );
};
```

### 새로운 방식 (Zustand 직접 사용)
```typescript
import { useTournamentStore } from './stores/tournamentStore';

const TournamentComponent = () => {
  const participants = useTournamentStore(state => state.participants);
  const addParticipant = useTournamentStore(state => state.addParticipant);
  
  return (
    <div>
      참가자: {participants.length}명
    </div>
  );
};
```

### 선택적 구독 (성능 최적화)
```typescript
// 특정 값만 구독
const blindLevel = useTournamentStore(state => state.blindLevel);
const remainingTime = useTournamentStore(state => state.remainingTime);

// 여러 값과 액션 함께 사용
const { participants, tables, addParticipant } = useTournamentStore(
  state => ({
    participants: state.participants,
    tables: state.tables,
    addParticipant: state.addParticipant,
  })
);
```

## 📈 추가 기능

### 1. 영속성 (Persist)
```typescript
// 자동으로 localStorage에 저장
const useTournamentStore = create(
  persist(
    (set) => ({
      // ... state and actions
    }),
    {
      name: 'tournament-store',
      partialize: (state) => ({
        // 저장할 state만 선택
        participants: state.participants,
        settings: state.settings,
      }),
    }
  )
);
```

### 2. Immer 통합
```typescript
// 불변성 자동 관리
updateParticipant: (id, updates) => set(
  produce((state) => {
    const participant = state.participants.find(p => p.id === id);
    if (participant) {
      Object.assign(participant, updates);
    }
  })
);
```

### 3. DevTools
```typescript
// Redux DevTools에서 상태 확인 가능
const useTournamentStore = create(
  devtools(
    (set) => ({
      // ... state and actions
    }),
    { name: 'Tournament Store' }
  )
);
```

## 🔄 마이그레이션 체크리스트

### Phase 1 (즉시 적용) ✅
- [x] Zustand 설치
- [x] TournamentStore 생성
- [x] TournamentContextAdapter 구현
- [x] 기존 코드 호환성 확인

### Phase 2 (점진적 적용)
- [ ] 새 컴포넌트에서 Zustand 사용
- [ ] 성능 크리티컬 컴포넌트 우선 마이그레이션
- [ ] 선택적 구독으로 최적화

### Phase 3 (완전 마이그레이션)
- [ ] 모든 컴포넌트 업데이트
- [ ] Context 래퍼 제거
- [ ] 문서 업데이트

## ⚠️ 주의사항

1. **선택적 구독 사용**: 전체 state를 구독하면 성능 이점 없음
2. **액션 네이밍**: 동사형으로 명확하게 (updateParticipants, setStatus)
3. **미들웨어 순서**: immer → devtools → persist 순서 유지

## 🚀 고급 패턴

### 1. Computed Values (Selectors)
```typescript
const activePlayers = useTournamentStore(
  state => state.participants.filter(p => p.status === 'active')
);
```

### 2. 액션 조합
```typescript
const eliminateAndBalance = useTournamentStore(state => () => {
  state.eliminateParticipant(playerId);
  state.balanceTables();
});
```

### 3. 구독 최적화
```typescript
// shallow 비교로 불필요한 리렌더링 방지
import { shallow } from 'zustand/shallow';

const { participants, tables } = useTournamentStore(
  state => ({ 
    participants: state.participants, 
    tables: state.tables 
  }),
  shallow
);
```

## 📊 성능 비교

### 리렌더링 감소
- Context API: 모든 구독 컴포넌트 리렌더링
- Zustand: 변경된 값을 구독하는 컴포넌트만 리렌더링

### 번들 크기
- Context API: 0KB (React 내장)
- Zustand: ~8KB (gzipped: ~3KB)

### 개발 속도
- Context API: 많은 보일러플레이트
- Zustand: 50% 적은 코드로 동일 기능 구현

## 🔍 디버깅

Redux DevTools에서:
1. 상태 변화 추적
2. 액션 히스토리 확인
3. 타임 트래블 디버깅
4. 상태 export/import

콘솔에서:
```typescript
// 현재 상태 확인
console.log(useTournamentStore.getState());

// 상태 직접 변경 (개발용)
useTournamentStore.setState({ blindLevel: 5 });
```