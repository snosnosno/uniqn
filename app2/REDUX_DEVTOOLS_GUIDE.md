> 아카이브 문서
>
> 이 문서는 `app2/`의 과거 디버깅 방식을 설명하는 기록입니다. 현재 운영 기준은 `uniqn-mobile/`, `functions/`이며, 재개 기준은 `README.md`, `DORMANT_PRODUCT.md`, `RESTART_GUIDE.md`를 먼저 확인하세요.

# app2 Redux DevTools 기록

## 문서 성격

이 문서는 `app2`가 과거 웹앱으로 개발되던 시점의 Redux DevTools 사용 기록입니다. 현재 부팅 가능한 개발 가이드가 아니며, 아래 내용만 믿고 `npm install`, `npm start`, `npm run build`를 바로 시도하면 현재 상태와 맞지 않을 수 있습니다.

현재 사실:
- `app2/node_modules`는 없습니다.
- `npm run build`는 `craco` 미해결 상태입니다.
- `npm run type-check`는 테스트 타입과 패키지 해상도 문제로 대량 실패합니다.

따라서 이 문서는 "재개 절차"가 아니라 "과거에 어떤 상태/액션을 관찰했는지"를 참고하는 용도로만 사용합니다.

## 언제 참고할지

- `tournament-web/` successor를 만들 때 과거 상태 관리 흐름을 읽고 싶을 때
- `app2`에서 Zustand store와 DevTools 연결 방식을 빠르게 회상하고 싶을 때
- 예전 디버깅 포인트를 토너먼트 전용 흐름으로 재해석할 때

## 그대로 믿지 말아야 할 것

다음 항목은 역사적 기록일 뿐 현재 보장 사항이 아닙니다.

- 설치/실행 명령
- 빌드 가능 여부
- TypeScript 에러 개수
- 테스트 커버리지 수치
- 성능 수치
- 범용 운영 계층(`UnifiedData`)이 앞으로도 유지된다는 가정

## 역사적 핵심만 요약

과거 `app2`에서는 Zustand store를 Redux DevTools에 연결해 상태 변화를 모니터링했습니다. 당시 관심사는 범용 운영 계층의 Firebase 실시간 구독, 상태 변경 trace, 에러 추적이었습니다.

당시 관찰 대상 예시:
- `setStaff`
- `setWorkLogs`
- `setApplications`
- `updateWorkLog`
- `deleteJobPosting`

당시 전제:
- `UnifiedData` 계층이 중심이었습니다.
- DevTools에서 Map 직렬화 한계 때문에 콘솔 로그를 함께 확인했습니다.

## 2025-11-15 기록에서 보존할 세부사항

이 섹션은 과거 문서의 핵심 디버깅 절차를 현재와 충돌하지 않도록 추려서 보존한 것입니다. 실행 가능 상태를 보장하는 문장이 아니라, "당시 무엇을 어떻게 관찰했는지"를 복원하는 목적입니다.

### 당시 store 연결 방식

과거 기록은 `src/stores/unifiedDataStore.ts`의 devtools 연결을 중심으로 정리돼 있었습니다. 현재 트리에도 같은 축의 store 파일이 남아 있습니다.

```typescript
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // ... Store 정의
    })),
    { name: 'UnifiedDataStore' }
  )
);
```

관련 현재 파일:
- `src/stores/unifiedDataStore.ts`
- `src/hooks/useUnifiedData.ts`
- `src/components/UnifiedDataInitializer.tsx`
- `src/stores/__tests__/unifiedDataStore.integration.test.ts`
- `src/stores/__tests__/unifiedDataStore.benchmark.test.ts`

### 당시 DevTools에서 보던 탭과 상태

과거 문서는 Redux 탭에서 다음 흐름을 주로 보라고 안내했습니다.

- `State`: `staff`, `workLogs`, `applications`, `attendanceRecords`, `jobPostings`, `isLoading`, `error`
- `Diff`: `isLoading` 변경과 개별 Map 변경 추적
- `Action`: `setStaff`, `setWorkLogs`, `setApplications`, `updateWorkLog`, `deleteJobPosting`
- `Trace`: 액션이 호출된 소스 위치 추적

### 당시 주요 관찰 포인트

1. Firebase 구독 시작 시 `subscribeAll`이 먼저 호출되는지 본다.
2. 스냅샷 반영 시 `setStaff`, `setWorkLogs`, `setApplications`, `setJobPostings`가 순차적으로 들어오는지 본다.
3. 개별 데이터 수정 시 `updateWorkLog` 같은 액션이 diff에 반영되는지 본다.
4. 에러 시 `setError`와 에러 메시지가 상태에 들어오는지 본다.

### 당시 트러블슈팅 기록

- Map은 JSON 직렬화 한계로 Redux DevTools에서 빈 객체처럼 보일 수 있다.
- 이 경우 콘솔 로그 또는 `Array.from(map.entries())` 형태의 기록을 함께 봤다.
- 액션이 보이지 않으면 `devtools` 미들웨어 연결과 `name: 'UnifiedDataStore'` 설정을 먼저 의심했다.
- 실시간 업데이트가 보이지 않으면 Map을 직접 mutate하지 말고 `set(...)` 경유 여부를 확인했다.

### 의도적으로 제외한 과거 문구

옛 문서 앞부분에 있던 설치/실행 명령, TypeScript 에러 0, 테스트 커버리지 65%, Production Ready 같은 건강지표는 현재 상태와 충돌하므로 여기서는 역사 세부사항으로 승계하지 않았습니다.

## successor 관점의 해석

`tournament-web/` successor를 만들 때는 이 기록을 그대로 복원하지 않습니다. 특히 `UnifiedData` 중심 범용 운영 구조는 successor 직접 승계 대상이 아닙니다.

재사용 관점에서 참고할 만한 부분:
- 액션 단위로 상태 변화를 관찰한 방식
- DevTools로 상태 diff를 추적한 습관
- Map/컬렉션 직렬화 한계를 문서화한 점

재사용하지 않을 부분:
- 공고/지원/근무/출석 중심 상태 설계
- 범용 운영 데이터를 한 store에 합친 구조
- 현재 빌드 체인이 살아 있다고 가정하는 실행 지침

## 관련 파일군

- `src/stores/tournamentStore.ts`
- `src/contexts/TournamentContextAdapter.tsx`
- `src/contexts/TournamentDataContext.tsx`
- `src/hooks/useTournaments.ts`
- `src/hooks/tables/*`

## 다음 문서

- [`README.md`](./README.md)
- [`DORMANT_PRODUCT.md`](./DORMANT_PRODUCT.md)
- [`RESTART_GUIDE.md`](./RESTART_GUIDE.md)
- [`../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md`](../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md)
