# UI/UX 일관성 루프 — 상태 장부

> 매 회차 시작 시 이 파일을 읽고, 종료 시 갱신한다. 상태: `pending` → `in-progress` → `done` / `deferred`

## 배치 현황

| 배치 | 영역 | 화면 (uniqn-mobile/app/ 기준) | 상태 | 커밋 |
|---|---|---|---|---|
| A | 인증·공개·루트 | `(auth)/login` `(auth)/signup` `(auth)/forgot-password` `(public)/jobs/index` `jobs/index` `jobs/[id]`(공개 alias) `index`(splash) `+not-found` | **done** | `a586e28e9` |
| B | 탭 코어 | `(tabs)/home-jobs` `(tabs)/schedule` `(tabs)/qr` `(tabs)/employer` `(tabs)/_layout` `(app)/home` + TabHeader | pending | |
| C | 게시판 | `(tabs)/board/index` `[boardType]` `write` `edit/[postId]` `post/[postId]` | pending | |
| D | 공고·지원 플로우 | `(app)/jobs/[id]/index` `(app)/jobs/[id]/apply` `applications/[id]/cancel` | pending | |
| E | 리뷰·공지 | `reviews/write` `reviews/[workLogId]` `reviews/pending` `reviews/history` `notices/index` `notices/[id]` | pending | |
| F | 지원센터·알림 | `support/faq` `support/create-inquiry` `support/my-inquiries` `support/inquiry/[id]` `notifications` | pending | |
| G | 설정·프로필 | `settings/profile` `settings/change-password` `settings/my-data` `settings/business-info` `profile-setup` (약관 4종은 레이아웃만 — 본문 금지) | pending | |
| H | 구인자 등록 | `employer-register` `employer-application-status` | pending | |
| I | 구인자 공고관리 | `(employer)/my-postings/create` `[id]/edit` `[id]/applicants` `[id]/settlements` `[id]/collaborators` `[id]/cancellation-requests` | pending | |
| J | 워크스페이스 | `(employer)/workspace/index` `invite` `invitations` `archived` | pending | |
| K | 관리자 1 | `(admin)/index` `announcements/*`(4) `stats` `tournaments` | pending | |
| L | 관리자 2 | `(admin)/reports/*` `board-reports/*` `inquiries/*` `users/*` `employer-applications/*` | pending | |
| M | 공용 컴포넌트 | `src/components/` 버튼·카드·모달·EmptyState·Skeleton·배지·토스트 + 토큰 정합 | pending | |
| W | 지갑 | `(app)/wallet/*` — master에 없음 (`fix/wallet-p1-money-and-ui` 머지 후) | **deferred** | |
| Z | 최종 횡단 패스 | 화면 간 통일 검증 + 전체 jest + quality | pending | |

## 발견·수정 로그

> 형식: `- [배치] P1/P2 | 화면 | 증상 → 조치 (커밋)`

- [A] 워크플로 51에이전트(6그룹 리뷰+건별 적대검증): 확정 45건(P1 8·P2 30·P3 강등 7) + P3 18건. P1/P2 전건 + 경미 P3 3건 수정 (`a586e28e9`)
- [A] P1 깨짐 4건 | BiometricButton·SignupStepTerms·StepIndicator·ForgotPasswordForm | 빈 글리프 `{''}` 아이콘 미렌더 → Lucide 교체 (icons에 FingerprintPattern/ScanFace 신규 등록 — lucide `/icons` 서브패스엔 `Fingerprint` 심볼 없음 주의)
- [A] P1 대비 | login 태그라인·Divider 라벨·+not-found 본문 | secondary-500 on white 2.86:1 → `text-content-secondary` 토큰 통일
- [A] P1 터치타깃 | LoginForm 링크 2곳·auth 헤더 뒤로가기·SignupStepTerms '보기' | <44px → min-h-[44px]/hitSlop + active: pressed
- [A] P2 시스템 | tailwind.config success 300/400·warning 400 티어 추가 → 기존 40+ 파일의 죽은 dark: 클래스 활성화 / 웹 `.bg-divider` 주입(app/_layout.tsx)
- [A] P2 골드 절제 | JobDetail 동시 5곳 → 금액+CTA 2곳 (위치 라벨 뉴트럴·긴급 preset=urgent·역할칩 secondary)
- [A] P2 | PostingSurfaceState | detail 로딩 스피너→Skeleton, partial 배너 미정의 warning 티어 교체, employer 탭 scope="list" 정합
- [A] 카피 | '정원이 마감되었어요'→'되었습니다' 2곳 (합쇼체 994 vs 해요체 415 — 합쇼체가 표준. '마감된 공고입니다' 등은 e2e 셀렉터 의존이라 변경 금지)
- [A] 테스트 갱신 | LoginForm.test 2건 — 구 커스텀 로딩 텍스트 단언 → Button loading(busy/disabled accessibilityState) 계약으로

## P3 백로그 (기록만, 구현 안 함)

> 형식: `- [배치] 화면 | 제안 | 근거`

- [A→M] 전역 | 미정의 팔레트 티어 사용 40+ 파일 일괄 점검 (warning-300/800/900·success-800·info 등 — 티어 추가 or 클래스 교체. ApprovalModal text-success-800 등) | 배치 M에서 처리
- [A→M] src/components/ui/Button.tsx | 이중 focus ring (`focus:border-[#2563EB]` + 래퍼 링) 단일화 | 공용 컴포넌트라 M
- [A→M] 전역 카피 톤 스윕 | 합쇼체/해요체 혼재 (e2e 셀렉터 의존 문자열 목록화 필수: '마감된 공고입니다'·'공고를 찾을 수 없습니다' 등 변경 금지) | Z 패스 후보
- [A] LoginForm | gap-4 컨테이너 + 자식 mt-* 이중 가산 → gap 단일 축 정리
- [A] login.tsx | 로고 text-4xl(스케일 밖) → text-3xl / 스플래시·로그인 태그라인 카피 불일치('홀덤 스태프 매칭' vs '안전한 스태프 채용')
- [A] login ScrollView·forgot-password | keyboardDismissMode="on-drag" 누락
- [A] SocialLoginButtons:31 | Apple 안내 카드 경계 식별 불가 (border-divider 또는 warning 틴트)
- [A] SignupForm:352 | 스텝 전환 springify() → 룰8 감속 이징
- [A] signup.tsx:320 | 헤더 스페이서 w-8 vs 버튼 40px 타이틀 미세 치우침
- [A] ForgotPasswordForm:71 | '다시 시도하기' 라벨이 동작(폼 복귀)과 불일치 / :57 미정의 success 다크 토큰 부수 관찰
- [A] forgot-password.tsx:35 | 에러 메시지 공식(무엇+왜+어떻게) 미충족
- [A] (public)/jobs/index | 비로그인 리다이렉트에 redirect 파라미터 유실 → getLoginRoute(appTabs)로 의도 보존
- [A] jobs/[id] | anon 뒤로가기 fallback '/jobs'가 로그인 강제 화면행 — 공개 랜딩 동선 검토 / RefreshControl Android colors 미지정 / JobDetail 통계 text-content-placeholder 오용·text-[10px]→text-micro 4곳·dark:bg-surface 중복 2파일
- [A] +not-found | 워터마크 text-6xl 스케일 이탈(장식 예외 주석으로 유지 중) / 타이틀 dark:text-secondary-100 혼용 → content-primary 단일화
- [A] index.tsx(스플래시) | 버전 텍스트 테마 가변 토큰을 고정 다크 배경 위에 사용 → text-secondary-500 고정 / PublicBottomTabBar:69 size=22→20|24
- [A] (auth) 헤더 3종 | 수기 헤더 → StackHeader 공용화 검토 (M 배치)

## 회차 메모

> 다음 회차에 넘길 주의사항·미완 항목

- 다음 배치: **B (탭 코어)** — home-jobs·schedule·qr·employer탭·(tabs)/_layout·home + TabHeader. employer.tsx는 배치A에서 scope="list" 1속성 이미 변경됨
- 작업 위치: 워크트리 `C:\Users\user\Desktop\T-HOLDEM-design-loop` 브랜치 `design/ui-ux-consistency-loop` (node_modules 정션 연결됨). 메인 체크아웃의 `docs/design-loop/`는 untracked 사본 — 회차 종료 시 양쪽 동기화할 것
- 워크플로 리뷰 프롬프트·스키마 재사용 가능: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\777c7133-6090-41e5-aff1-03448744ff33\workflows\scripts\batch-a-design-review-wf_5c40c68f-2bb.js` (GROUPS만 교체)
- 패턴 학습: 시맨틱 토큰 우선(`content-*`는 dark: 불필요) / active: pressed 관례 32곳 / 장식 요소는 accessibilityElementsHidden+importantForAccessibility 쌍 / 카피 변경 전 e2e 셀렉터 grep 필수
