# 성능 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 모바일앱 기준

현재 성능 가이드는 `uniqn-mobile/`의 실제 구현에 맞춰 작성합니다.

## 현재 적용 중인 핵심 패턴

### 1. FlashList 사용

대용량 목록 화면은 `@shopify/flash-list`를 사용합니다.

예:

- 공고 목록
- 알림 목록
- 문의 목록
- 내 공고 목록
- 리뷰 목록

## 2. 이미지 최적화

- `expo-image`를 사용합니다.
- 상세 화면이나 공지 이미지 선택/표시에서 사용됩니다.

## 3. 서버 상태 캐싱

- TanStack Query를 사용합니다.
- `src/lib/queryClient.ts`에서 캐시 시간, 재시도, 오프라인 우선 모드를 중앙 관리합니다.
- Query Key와 invalidation 규칙을 공통화합니다.

## 4. Repository 재사용

- 화면에서 Firebase를 직접 여러 번 호출하지 않고 Repository를 통해 접근합니다.
- 같은 도메인 데이터를 Service/Hook에서 재조합해 중복 호출을 줄입니다.

## 5. 실시간 동기화 관리

- 필요 시 `useRealtimeQuery`와 관련 매니저를 통해 실시간 구독을 붙입니다.
- 앱 상태 전환과 네트워크 상태도 Query 레이어와 연결합니다.

## 성능 작업 체크리스트

새 화면을 추가할 때:

1. 긴 목록이면 `FlashList` 사용 여부를 먼저 검토합니다.
2. 이미지가 있으면 `expo-image` 사용을 우선 검토합니다.
3. 직접 Firebase 호출보다 기존 Hook/Service/Repository 재사용을 우선합니다.
4. Query Key와 invalidation을 기존 패턴에 맞춥니다.
5. 로딩/새로고침/페이징 상태를 분리합니다.

## 기본 검증 명령어

```bash
cd uniqn-mobile
npm run quality
npm run analyze:bundle
```

## 관련 파일

- `uniqn-mobile/src/lib/queryClient.ts`
- `uniqn-mobile/src/repositories/index.ts`
- `uniqn-mobile/src/hooks/useJobPostings.ts`
- `uniqn-mobile/src/hooks/useRealtimeQuery.ts`
- `uniqn-mobile/src/components/jobs/JobList.tsx`
- `uniqn-mobile/src/components/notifications/NotificationList.tsx`

## 피해야 할 것

- 화면 안에서 동일 데이터를 여러 번 직접 쿼리하는 것
- 긴 목록을 일반 `ScrollView`로 처리하는 것
- 캐시 무효화 없이 낙관적 갱신만 추가하는 것
- 현재 코드에 없는 과거 웹 최적화 수치를 현재 성능 결과처럼 문서화하는 것
