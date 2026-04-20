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

---

## 전체 QA 발견 (2026-04-20 Phase 1~4)

> 상세는 `.gstack/qa-reports/MASTER_BASELINE.json` 참조. Health 평균 86/100, critical/high 0건, medium 14 + low 9.

### FIX WINDOW 2 (DB-only fast-track)

- **ST-001 board comment_count drift**: `UPDATE board_posts SET comment_count = (SELECT COUNT(*) FROM board_comments WHERE post_id = board_posts.id)` + QA 댓글 cleanup (baseline.json sideEffects 참고)
- **ST-002 notifications 중복**: 레거시 `fn_notify_*` triggers DROP — 실제 DB 확인된 중복 trigger 리스트는 phase-4-admin-notif/notifications/report.md
- **EJ-002 템플릿 시드**: employer b2222222 소유 "주말 스태프 모집 템플릿" migration 추가
- **AD-001 심사용 applicant**: 별도 staff 계정의 pending employer_application 시드 (현재는 admin 본인 계정)

### FIX WINDOW 2B (copy fast-track) ✅ 2026-04-20

- [x] **ST-003** 리뷰 D-day 문구 "근무 완료 후" → "퇴근 후" (checkOutTime anchor 명확화) — fc0f8a48c
- [x] **ST-004** 공지 탭 empty state notice 분기 추가 ("아직 등록된 공지가 없어요") — 16830bde5
- [x] **JS-001** 튜토리얼 "날짜 슬라이더" → "달력" — 7c9e685f7
- [x] **ES-002** 정산 모달 퇴근 시간 색상 중립 + "익일" 배지 — 78cf7d871
- 상세: `.gstack/qa-reports/FIX-WINDOW-2B.md`

### FIX WINDOW 2C (코드 수정) ✅ 2026-04-21

- [x] **EJ-001** 공고 카드 지원자 카운트 실시간 하이드레이션 — 4968a7345
- [x] **JS-002** JobCard aria-label role_catalog 최대 급여 fallback — 7ebff9ffd
- [x] **JS-003** 공고 상세 헤더 titleSuffix headerTint 색상 통일 — aa2c577e3
- [x] **JS-004** 지원 카운트 라벨 단일화 (applicationStatusLabel.ts) — 4968a7345 (JS-004+EJ-001 합쳐짐)
- [x] **WK-001 + WK-002** QR 스캐너 닫기 X + 5초 타임아웃 fallback + 설정 열기 — 9616540ab
- [x] **EJ-003** formatE164ToDisplay 적용 (ContactInfoSection + admin 구인자 신청 상세) — d6cfcdb3a
- [x] **EJ-004** 스태프 관리 COMPLETED 필터 옵션 추가 — 179ef5822
- [x] **AD-002** 이미 구현됨(a5bd38440) → verified-closed
- 상세: `.gstack/qa-reports/FIX-WINDOW-2C.md`

### FIX WINDOW 2D (기획 동의) ✅ 2026-04-21

- [x] **AD-001** 심사용 pending employer_application 시드 (d4444444 / pending-employer-staff@uniqn.app) — 5a2a1ceae
- [x] **ES-001** 정산 요약 '총 정산액(수당 포함)' 라벨 + staff '확정' 의미 차이 안내 — a6ed4b5f3
- [x] **ES-003** 정산 완료 시점 customAllowances snapshot 자동 저장 (retro-active 차단) — 1475218d0
- [x] **WK-004** work_logs.check_in/out_time 레거시 Firebase Timestamp → ISO string(jsonb) 정규화 — 1ee82ccaf
- 상세: `.gstack/qa-reports/FIX-WINDOW-2D.md`

### 후속 세션

- **Phase 5 qa/offline**: 오프라인 복구 QA — 실기기 + 별도 세션 필요
- 알림 emitter 통합: notifications 중복 SQL fix 후 code path 레거시 참조 정리
- **레거시 trigger 함수 본체 정리**: `tr_notify_*` trigger DROP 후 `fn_notify_*` 함수 참조 경로 최종 확인 → DROP FUNCTION (2026-04-20 감사 `.gstack/qa-reports/LEGACY-TRIGGERS-AUDIT.md`)
- **tr_notify_tournament_approval 이관**: UPDATE(재제출) 경로를 `notify_on_job_posting_update` 또는 전용 신규 trigger로 이관 후 레거시 DROP — 현재는 INSERT 중복이지만 재제출 알림 유실 방지 위해 보존
