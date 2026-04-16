# TODOS

프로젝트의 후속 작업 목록. 플랜 리뷰에서 MVP 범위 밖으로 결정된 항목을 기록.

## 홈 대시보드 관련 (2026-04-16 plan-eng-review)

### 홈 진입 튜토리얼 오버레이

- **What**: 앱 첫 진입 시 1회만 표시되는 "로고 탭 = 홈" 안내 오버레이.
- **Why**: "로고 탭 = 홈 이동"은 비표준 패턴. 사용자가 홈 화면의 존재 자체를 발견하지 못할 위험. Reviewer Concern #3과 Codex plan review 모두 지적.
- **Pros**: 사용자 발견율 향상, 신규 기능 교육, 앱 첫인상 개선.
- **Cons**: 오버레이는 거슬림, 기존 사용자에게는 재진입 시에도 보일 수 있어 UX 품질 테스트 필요.
- **Context**: `useTutorial` hook이 이미 프로젝트에 존재하고, `APP_INTRO_STAFF`/`APP_INTRO_EMPLOYER` 튜토리얼 패턴으로 활용 중. `homeIntro`라는 새 튜토리얼 키로 확장하면 됨. 구현 비용 ~30분 (CC+gstack).
- **Depends on**: 홈 대시보드 MVP 배포 완료 (`user-master-design-20260416-114022.md`), 사용자 발견율/이탈 지표 관찰 1-2주.
- **Status**: 사용자가 "배포 후 결정"으로 선택. 배포 후 관찰 결과에 따라 구현 결정.

### viewport 기반 lazy 위젯 로딩

- **What**: 스크롤 아래에 있는 위젯은 viewport 진입 시로 hook 호출 지연.
- **Why**: 현재 홈 진입 시 6개 위젯이 동시 로딩. `useCurrentWorkStatus`(Realtime 구독), `usePendingReviews`(4-fan out), `usePublishedAnnouncements`(InfiniteQuery) 포함. 앱 시작 시간에 영향 가능성. Codex plan review #4 지적.
- **Pros**: 초기 페인트 개선, Supabase 쿼리 비용 절감, 배터리 소모 감소.
- **Cons**: 스크롤 반응 지연, react-native-intersection-observer 같은 추가 라이브러리 필요, 구현 복잡도 상승.
- **Context**: MVP 배포 후 앱 시작 시간(TTI) 측정 결과에 따라 결정. 3초 이내면 현재 상태 유지, 5초 이상이면 구현 고려. Expo의 기본 프로파일링 또는 `@shopify/react-native-performance` 활용 가능.
- **Depends on**: MVP 배포, 실측 데이터 수집.
- **Status**: 비용/최적화 추적 TODO. 성능 지표 정량화 후 판단.
