# Research: 핵심 Hooks 단위 테스트 작성

**Feature**: 001-hooks-tests
**Date**: 2025-11-06
**Status**: Complete

## Overview

이 문서는 `useNotifications`, `useScheduleData`, `useApplicantActions` 세 가지 핵심 Hook의 단위 테스트 작성을 위한 기술 조사 및 의사결정을 기록합니다.

---

## 1. Testing Library 선택

### Decision

**@testing-library/react 14.x의 내장 `renderHook` 사용**

### Rationale

- **React 18 호환성**: React 18.2부터 `@testing-library/react`에 `renderHook`이 내장되어 별도 패키지 불필요
- **단일 의존성**: `@testing-library/react-hooks`는 더 이상 유지보수되지 않음 (deprecated)
- **현재 프로젝트 상태**: 이미 `@testing-library/react` 14.x 사용 중
- **최신 API**: React 18의 동시성 기능과 완벽히 호환

### Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|------|------|------|-------------------|
| @testing-library/react-hooks 8.x | 기존 레거시 코드와 호환 | Deprecated, React 18 미지원 | 더 이상 유지보수 안 됨 |
| Enzyme | 광범위한 기능 | React 18 미지원, 무거움 | React 팀이 권장하지 않음 |
| 수동 테스트 (ReactDOM) | 완전한 제어 | 보일러플레이트 많음 | 생산성 저하 |

### Implementation Notes

```typescript
// ✅ 권장 패턴 (React 18+)
import { renderHook, waitFor } from '@testing-library/react';

const { result, rerender, unmount } = renderHook(() => useNotifications(userId));
```

---

## 2. Firebase Mocking 전략

### Decision

**Jest의 `jest.mock()`을 사용한 모듈 수준 Mock**

### Rationale

- **타입 안전성**: TypeScript와 완벽히 호환되며 `jest.Mock<T>` 타입 활용 가능
- **세밀한 제어**: 각 테스트마다 다른 동작 시뮬레이션 가능
- **성능**: 실제 Firebase SDK 로드 없이 즉시 Mock 반환
- **유지보수성**: Firebase API 변경 시 Mock만 업데이트하면 됨
- **프로젝트 표준**: 프로젝트에서 이미 Jest 사용 중

### Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|------|------|------|-------------------|
| firebase-mock 라이브러리 | 실제 Firebase와 유사한 동작 | TypeScript 지원 부족, 무거움 | 타입 안전성 부족 |
| Firebase Emulator | 완전한 Firebase 환경 | 느림 (수백 ms), 설정 복잡 | 단위 테스트에는 과도함 |
| Manual mock 구현 | 완전한 제어 | 많은 코드 작성 필요 | jest.mock으로 충분 |

### Implementation Notes

```typescript
// app2/src/__tests__/mocks/firebase.ts
import { DocumentData, QuerySnapshot } from 'firebase/firestore';

export const mockOnSnapshot = jest.fn((callback: (snapshot: QuerySnapshot<DocumentData>) => void) => {
  // 즉시 콜백 호출 (실시간 구독 시뮬레이션)
  const mockSnapshot = {
    docs: [
      { id: 'notif-1', data: () => ({ type: 'work', isRead: false }) },
    ],
  } as unknown as QuerySnapshot<DocumentData>;

  callback(mockSnapshot);

  // Unsubscribe 함수 반환
  return jest.fn();
});

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  onSnapshot: mockOnSnapshot,
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));
```

---

## 3. 비동기 테스트 패턴

### Decision

**`waitFor` + `act` 조합 사용**

### Rationale

- **React 18 권장**: React 팀이 공식 권장하는 비동기 테스트 패턴
- **타임아웃 제어**: 각 `waitFor`마다 타임아웃 설정 가능 (기본 1초)
- **에러 메시지**: 명확한 타임아웃 에러 메시지 제공
- **자동 재시도**: 조건이 충족될 때까지 자동으로 폴링

### Alternatives Considered

| 대안 | 장점 | 단점 | 선택하지 않은 이유 |
|------|------|------|-------------------|
| setTimeout/Promise | 간단함 | 불안정 (경쟁 조건), 느림 | 신뢰성 부족 |
| flush-promises | 명시적 제어 | React 상태 업데이트와 비동기 | waitFor가 더 안정적 |
| jest.runAllTimers | 빠름 | 실제 비동기와 다름 | 타이머가 아닌 Promise 사용 |

### Implementation Notes

```typescript
// ✅ 권장 패턴
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';

test('알림 구독 테스트', async () => {
  const { result } = renderHook(() => useNotifications('user-1'));

  // 비동기 상태 업데이트 대기
  await waitFor(() => {
    expect(result.current.notifications).toHaveLength(1);
  }, { timeout: 3000 }); // 3초 타임아웃

  // 상태 변경 작업은 act로 감싸기
  await act(async () => {
    await result.current.markAsRead('notif-1');
  });

  await waitFor(() => {
    expect(result.current.notifications[0].isRead).toBe(true);
  });
});
```

---

## 4. Hook별 테스트 전략

### 4.1 useNotifications (알림 시스템)

**핵심 과제**: 실시간 Firestore 구독 테스트

**전략**:
1. **구독 시작**: `onSnapshot` Mock이 즉시 콜백 호출하는지 검증
2. **실시간 업데이트**: Mock 콜백을 다시 호출하여 새 데이터 전달
3. **구독 해제**: Hook unmount 시 unsubscribe 함수 호출 검증
4. **필터링**: 읽음/안읽음 상태별 필터링 로직 검증
5. **에러 처리**: onSnapshot이 에러를 throw할 때 처리 검증

**특화 Mock**:
```typescript
let onSnapshotCallback: Function | null = null;

mockOnSnapshot.mockImplementation((callback) => {
  onSnapshotCallback = callback;
  // 초기 데이터 즉시 전달
  callback(mockSnapshot);
  return mockUnsubscribe;
});

// 테스트에서 실시간 업데이트 시뮬레이션
const triggerUpdate = (newData: any[]) => {
  if (onSnapshotCallback) {
    onSnapshotCallback({ docs: newData });
  }
};
```

### 4.2 useScheduleData (급여 계산 - 323줄)

**핵심 과제**: 복잡한 계산 로직 및 캐싱 검증

**전략**:
1. **기본 급여 계산**: 근무 시간 × 시급 정확성 검증
2. **수당 계산**:
   - 야간수당 (22:00-06:00): 시간대 정확성
   - 휴일수당: 휴일 판정 로직 (한국 공휴일 API)
   - 연장수당: 기준 시간 초과분 계산
3. **캐싱 동작**: 동일 입력에 대해 재계산 없이 캐시 반환
4. **데이터 변환**: Firebase 데이터 → UI 표시 형식 변환
5. **에러 케이스**: 잘못된 데이터 (음수 시간, 미래 날짜 등)

**특화 Mock**:
```typescript
// 시간대별 Mock 데이터
const mockWorkLog = {
  staffId: 'staff-1',
  eventId: 'event-1',
  date: '2025-11-06',
  startTime: '22:00', // 야간 시작
  endTime: '06:00',   // 야간 종료 (다음날)
  hourlyRate: 15000,
};

// 휴일 판정 Mock
jest.mock('@/utils/holidays', () => ({
  isHoliday: jest.fn((date: string) => date === '2025-01-01'),
}));
```

### 4.3 useApplicantActions (지원자 관리 - 803줄)

**핵심 과제**: 복잡한 상태 변경 및 Firebase 업데이트 검증

**전략**:
1. **단일 작업**: 개별 지원자 승인/거부
2. **일괄 작업**: 여러 지원자 동시 처리 (Promise.all)
3. **낙관적 업데이트**: UI 즉시 업데이트 후 Firebase 동기화
4. **롤백**: Firebase 업데이트 실패 시 UI 상태 복원
5. **경쟁 조건**: 동시 작업 요청 시 순차 처리 검증
6. **에러 복구**: 네트워크 오류, 권한 오류 등 다양한 에러 시나리오

**특화 Mock**:
```typescript
// Firebase updateDoc Mock
const mockUpdateDoc = jest.fn();

// 성공 케이스
mockUpdateDoc.mockResolvedValue(undefined);

// 실패 케이스 (권한 오류)
mockUpdateDoc.mockRejectedValue(new Error('Permission denied'));

// 테스트: 실패 시 롤백 검증
test('업데이트 실패 시 UI 상태 롤백', async () => {
  mockUpdateDoc.mockRejectedValueOnce(new Error('Network error'));

  const { result } = renderHook(() => useApplicantActions());

  await act(async () => {
    await result.current.approveApplicant('app-1');
  });

  // 에러 상태 확인
  expect(result.current.error).toContain('Network error');
  // UI 상태가 원래대로 복원되었는지 확인
  expect(result.current.applicants.find(a => a.id === 'app-1').status).toBe('pending');
});
```

---

## 5. 테스트 커버리지 도구

### Decision

**Jest 내장 Coverage (Istanbul 기반)**

### Rationale

- **제로 설정**: Jest에 이미 내장, `--coverage` 플래그만 추가
- **다양한 리포트**: HTML, JSON, LCOV 등 다양한 형식 지원
- **프로젝트 통합**: 기존 `npm run test:coverage` 명령어 재사용
- **CI 호환**: GitHub Actions와 완벽 호환

### Implementation Notes

```json
// package.json (기존 설정 활용)
{
  "scripts": {
    "test:coverage": "jest --coverage --collectCoverageFrom='src/**/*.{ts,tsx}'"
  },
  "jest": {
    "coverageThreshold": {
      "src/hooks/useNotifications.ts": {
        "lines": 70,
        "branches": 70,
        "functions": 70,
        "statements": 70
      },
      "src/pages/MySchedulePage/components/hooks/useScheduleData.ts": {
        "lines": 70,
        "branches": 70
      },
      "src/components/applicants/ApplicantManagement/hooks/useApplicantActions.ts": {
        "lines": 70,
        "branches": 70
      }
    }
  }
}
```

---

## 6. 공통 테스트 유틸리티

### Decision

**중앙화된 Mock Factory 및 Test Data**

### Rationale

- **재사용성**: 여러 테스트에서 동일한 Mock 데이터 재사용
- **일관성**: 모든 테스트가 동일한 데이터 구조 사용
- **유지보수성**: Mock 데이터 수정 시 한 곳만 변경
- **타입 안전성**: Factory 함수에 제네릭 타입 적용

### Implementation Notes

```typescript
// app2/src/__tests__/setup/mockFactories.ts
export const createMockNotification = (overrides?: Partial<Notification>): Notification => ({
  id: 'notif-1',
  userId: 'user-1',
  type: 'work',
  message: 'Test notification',
  isRead: false,
  createdAt: new Date('2025-11-06'),
  ...overrides,
});

export const createMockWorkLog = (overrides?: Partial<WorkLog>): WorkLog => ({
  staffId: 'staff-1',
  eventId: 'event-1',
  date: '2025-11-06',
  startTime: '10:00',
  endTime: '18:00',
  hourlyRate: 15000,
  ...overrides,
});

export const createMockApplicant = (overrides?: Partial<Applicant>): Applicant => ({
  id: 'app-1',
  eventId: 'event-1',
  name: 'Test User',
  status: 'pending',
  appliedAt: new Date('2025-11-05'),
  ...overrides,
});
```

---

## 7. 성능 최적화 전략

### Decision

**테스트 병렬 실행 + 타임아웃 최적화**

### Rationale

- **병렬 실행**: Jest 기본값 (CPU 코어 수만큼)으로 여러 테스트 파일 동시 실행
- **타임아웃 최적화**: 각 `waitFor`의 타임아웃을 필요 최소치로 설정 (기본 1초 → 500ms)
- **Mock 캐싱**: 공통 Mock 객체는 `beforeAll`에서 생성하여 재사용

### Performance Targets

| 항목 | 목표 | 실제 측정 방법 |
|------|------|---------------|
| 전체 테스트 실행 시간 | ≤ 8초 | `time npm run test` |
| 각 Hook 테스트 파일 | ≤ 3초 | Jest 리포트 참조 |
| 개별 테스트 케이스 | ≤ 500ms | `--verbose` 플래그 |

### Implementation Notes

```typescript
// Jest 설정 최적화
module.exports = {
  testTimeout: 10000,          // 전체 타임아웃 10초
  maxWorkers: '50%',           // CPU 코어의 50% 사용 (안정성)
  clearMocks: true,            // 각 테스트 후 Mock 자동 클리어
  resetModules: true,          // 모듈 캐시 리셋으로 독립성 보장
};

// 개별 테스트의 타임아웃 최적화
await waitFor(() => {
  expect(result.current.data).toBeDefined();
}, { timeout: 500, interval: 50 }); // 500ms 타임아웃, 50ms 폴링
```

---

## 8. CI/CD 통합 고려사항

### Decision

**GitHub Actions 기존 워크플로우 활용**

### Rationale

- **기존 인프라**: 프로젝트에 이미 GitHub Actions 사용 중
- **캐싱**: `actions/cache`로 node_modules 캐싱하여 속도 향상
- **병렬 실행**: 매트릭스 전략으로 Node.js 버전별 테스트 가능

### Implementation Notes

```yaml
# .github/workflows/test.yml (기존 파일 활용)
- name: Run unit tests
  run: npm run test -- --coverage --ci

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    flags: unittests
```

---

## Research Summary

| 항목 | 선택한 기술 | 주요 근거 |
|------|------------|-----------|
| Testing Library | @testing-library/react 14.x (renderHook) | React 18 내장, Deprecated 패키지 회피 |
| Firebase Mock | jest.mock() 모듈 수준 Mock | 타입 안전성, 성능, 세밀한 제어 |
| 비동기 패턴 | waitFor + act 조합 | React 18 권장, 자동 재시도, 명확한 에러 |
| Coverage Tool | Jest 내장 (Istanbul) | 제로 설정, 기존 인프라 활용 |
| Mock Factory | 중앙화된 Factory 함수 | 재사용성, 일관성, 타입 안전성 |
| 성능 최적화 | 병렬 실행 + 타임아웃 최적화 | 8초 이내 목표 달성 |

**All research items resolved. Ready for Phase 1: Design.**
