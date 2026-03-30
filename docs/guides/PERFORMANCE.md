# 성능 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/src/lib/queryClient.ts`, `uniqn-mobile/src/lib/invalidationStrategy.ts`, `uniqn-mobile/src/hooks/`, `uniqn-mobile/src/repositories/`, `uniqn-mobile/src/services/offline/`

이 문서는 현재 앱에서 실제 사용 중인 성능 패턴과 검증 포인트만 정리합니다.

## 현재 기준

- 서버 상태 캐싱은 TanStack Query로 통일합니다.
- 긴 목록은 `@shopify/flash-list` 사용을 우선 검토합니다.
- 이미지는 `expo-image`를 우선 사용합니다.
- Firestore 접근은 화면에서 직접 반복 호출하지 않고 `Repository -> Service -> Hook` 흐름을 유지합니다.
- 오프라인과 재연결 처리, 일부 실시간 동기화는 공통 서비스와 훅에서 관리합니다.

## 기준 파일

1. `uniqn-mobile/src/lib/queryClient.ts`
2. `uniqn-mobile/src/lib/invalidationStrategy.ts`
3. `uniqn-mobile/src/hooks/useRealtimeQuery.ts`
4. `uniqn-mobile/src/services/offline/criticalOfflineCache.ts`
5. `uniqn-mobile/src/services/offline/reconnectSyncService.ts`
6. `uniqn-mobile/src/services/offline/remoteMutationGuard.ts`
7. `uniqn-mobile/src/components/jobs/JobList.tsx`
8. `uniqn-mobile/src/components/notifications/NotificationList.tsx`

## 주요 운영 패턴

### 목록 렌더링

- 공고, 알림, 문의, 리뷰처럼 항목 수가 커질 수 있는 화면은 `FlashList`를 우선 검토합니다.
- 고정 크기 선택 UI나 단순 그리드는 `FlatList`를 허용합니다.

### 이미지 처리

- 공고 상세, 공지 이미지, 이미지 선택 화면은 `expo-image`를 우선 사용합니다.
- 화면별 예외 캐시 정책을 새로 만들기보다 기존 공통 컴포넌트 패턴을 재사용합니다.

### Query 캐싱과 무효화

- Query Key는 `queryClient.ts`와 `invalidationStrategy.ts` 기준으로 관리합니다.
- 낙관적 갱신을 추가할 때는 캐시 무효화와 오프라인 재시도 흐름을 함께 검토합니다.

### 실시간과 오프라인

- 실시간 구독은 `useRealtimeQuery`, `shared/realtime`, 오프라인 서비스와 함께 검토합니다.
- 앱 포그라운드 전환과 네트워크 상태는 Query 생명주기와 맞물려야 합니다.

## 새 화면 추가 체크리스트

1. 긴 목록이면 `FlashList`가 더 적합한지 먼저 확인합니다.
2. 이미지가 있다면 `expo-image` 또는 기존 이미지 래퍼를 우선 재사용합니다.
3. Firebase 직접 호출 대신 기존 Repository, Service, Hook을 재사용합니다.
4. Query Key, 캐시 무효화, 빈 상태, 오류 상태를 함께 설계합니다.
5. 실시간 갱신이 필요하면 오프라인 재연결 동작까지 같이 확인합니다.

## 검증 명령

```bash
cd uniqn-mobile
npm run quality
npm run analyze:bundle
```

## 현재 제외 범위

- 과거 측정값을 현재 앱 성능 수치처럼 고정하는 것
- 존재하지 않는 최적화 계층을 현재 구현처럼 설명하는 것
- 웹 전용 렌더링 최적화를 모바일 기준 문서에 섞는 것

## 관련 문서

- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/core/TESTING_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
