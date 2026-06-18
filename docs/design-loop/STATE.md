# UI/UX 일관성 루프 — 상태 장부

> 매 회차 시작 시 이 파일을 읽고, 종료 시 갱신한다. 상태: `pending` → `in-progress` → `done` / `deferred`

## 배치 현황

| 배치 | 영역 | 화면 (uniqn-mobile/app/ 기준) | 상태 | 커밋 |
|---|---|---|---|---|
| A | 인증·공개·루트 | `(auth)/login` `(auth)/signup` `(auth)/forgot-password` `(public)/jobs/index` `jobs/index` `jobs/[id]`(공개 alias) `index`(splash) `+not-found` | **done** | `a586e28e9` |
| B | 탭 코어 | `(app)/(tabs)/home-jobs` `schedule` `qr` `employer` `profile`(고아라 편입) `_layout` `(app)/home` + TabHeader | **done**(⚠️qr 재검증 대기) | `81dae65cb` |
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
- [B] 워크플로 38에이전트(6그룹 리뷰+건별 적대검증): 확정 P1/P2 20건(검증 후 4건 P3 강등)+P3 17건. ⚠️ **세션 한도(7pm 리셋)로 qr 그룹 + 일부 home-jobs/employer verify 에이전트 11건 실패** → qr P1/P2 5건(라이트 AA·nativewind·룰27 아이콘색·헤더 일관성·골드 절제) 유실, 재검증 필요. 검증 통과 16 P2 + 무위험 3 P3 수정 (`81dae65cb`)
- [B] P2 라이트 대비 | _layout·schedule·employer·profile | 활성/비활성 탭 tint·StatsCard 라벨·FilterTabs 라벨·출석 CTA가 라이트모드 골드/회색-온-화이트 2.1~2.9:1(AA 미달) → getLayoutColor 토큰/secondary-600/content-onGold로 4.5:1+ 확보 (다크 무변경)
- [B] P2 탭 일관성 | _layout·employer | 탭바/헤더 아이콘 size 22(룰27 금지 중간값) → 24(HomeTabBar 정합) / profile 메뉴 아이콘 22→20(파일 내 Chevron/Edit 정합)
- [B] P2 골드 절제·토큰 | profile 역할배지 골드→중립(60-30-10) / employer 공유공고 raw blue→info 토큰 / DashboardViewToggle raw hex→primary-500·onGold
- [B] P2 빈상태·어포던스 | schedule 캘린더뷰 온보딩 EmptyState 추가(월 0건 게이트) / employer 선택 필 라이트 트랙 분리(bg-secondary-100) / PostingTypeChips min-h-[40px]+hitSlop
- [B] P2 접근성·안티패턴 | profile 평점배지 hitSlop12+role/label / BalanceBadge 💖→'하트' 텍스트(룰14) / PostingTypeChips 죽은 빈 아이콘 Text 제거(팬텀 마진)
- [B] 검증 | quality exit0(tsc0·lint0·format0) / jest 21 pass(BalanceBadge·PostingTypeChips·DashboardViewToggle·TabHeader·JobsScreen). BalanceBadge.test 💖→'하트' 정규식(/3/·/D-2/·/만료/) 무영향 확인

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
- [B→재검증] qr.tsx | 세션한도로 verify 유실된 P1/P2 5건(라이트 AA 대비·nativewind 토큰·룰27 아이콘색 일관성+대비·탭헤더 일관성·룰3 골드 절제) | qr 단일 화면 재리뷰(인라인 가능, 203줄) 필요 — 다음 회차 또는 Z 패스에서
- [B] src/components/ui/Loading.tsx:18 | 라이트 스피너 PRIMARY[300]=#D4AF37 흰배경 2.1:1 거의 안보임 → getLoadingColor(라이트 #8A7228) 재사용 단일소스. home.tsx 로딩이 사용 | M 배치
- [B] src/components/headers/TabHeader.tsx:48 | 헤더 borderBottom 부재 — 다크 헤더bg=콘텐츠bg=#0B0B0E 동색이라 스크롤 시 경계 소실. LAYOUT_COLORS.headerBorder 토큰 미사용(의도된 flat이면 무시) | M 배치
- [B] app/(app)/home.tsx:41 | 대시보드 로딩 Loading variant='layout'(전체화면 스피너) → 위젯 카드 Skeleton 컴포저(룰16, layout shift 감소) | M/홈 배치
- [B] DashboardViewToggle.tsx:12 | 세그먼트 Pressable이 selected만 스타일·pressed 즉시 피드백 부재(룰4/21) → active: 배경 토글 | M 배치
- [B] PostingTypeChips:50 vs DateCalendar 선택셀 | 같은 home-jobs 화면 선택 골드 톤 불일치(칩 primary-600/700 vs 셀 primary-500) → 브랜드 골드 통일 | 
- [B] jobs/JobList.tsx:80 | 검색/브라우즈 빈 상태에 행동(CTA) 없음(룰9) + 검색 무결과에 search variant 미전달(DocumentIcon 노출). emptyMessage e2e 셀렉터 grep 필요 |
- [B] jobs/DateCalendar/CalendarCell.tsx:76 | 일반 탭 달력 펼침 시 공고있는 날짜 셀마다 bg-primary-500/25 골드 카운트 → 한 달 그리드 골드 다수(룰3 초과). 비선택은 중립 톤으로 |
- [B] schedule.tsx:102/234 | content-primary(다크 CSS var 자동)에 dark:text-secondary-100 덧댐 → 중복+미세 드리프트. dark: 제거 | M/Z
- [B] qr.tsx:91 | 현재상태 Card에 accessibilityLabel 주나 Card 비-onPress 분기가 forwarding 안 함 → 자식 Text 파편 읽힘 | Card.tsx M 배치
- [B] qr.tsx:144 | 히어로 ScanIcon size={80} 화이트리스트 이탈(일러스트 예외 미명문화) → 룰27에 히어로 예외 명문화 or 주석 | M/룰문서
- [B] employer.tsx:313 | Button icon mr-2 + 라벨 ml-2 이중 간격(16px, 의도 8px) → ml-2 제거 |
- [B] employer.tsx:356/353 | 빈상태 BriefcaseIcon size=48 화이트리스트 초과 + EmptyState actionLabel 미전달(상단 CTA 상존이라 경미) | 히어로 예외와 함께
- [B] employer.tsx:60 | FilterTabs 탭 높이 ~36px(세그먼트 40px 예외도 미달, hitSlop 없음) → min-h-[44px] (flex-1 풀폭이라 가로는 충분, P3 강등) |
- [B] profile.tsx:56/149/195 | active:opacity-70/80 누름 피드백(룰21 위반: 다크 대비 깨짐) → 배경 톤 토글(HEADER_CLASSES.actionPressed 재사용) | 룰21 일괄(M)
- [B] profile.tsx:198 | 로딩 ellipsis 혼용('처리 중…' vs '로그아웃 중...') → 유니코드 … 통일. e2e grep |
- [B] profile.tsx:184/206 | 지갑 잔액배지 비인터랙티브 dead-end(IA: MenuItem화 검토) / 메뉴 아이콘 색 테마 비반응(getIconColor 통일) |
- [B→M] 골드 위 흰 아이콘 반복편차 | QRPanel.tsx:352·QRCodeDisplay.tsx:148 RefreshIcon #FFFFFF→onGold (employer PlusIcon과 동일) / 💖 이모지 PaywallModal:28,48·PurchaseSheet:133 (BalanceBadge와 동일, 룰14) | M/지갑 배치

## 회차 메모

> 다음 회차에 넘길 주의사항·미완 항목

- 다음 배치: **C (게시판)** — `(app)/(tabs)/board/index` `[boardType]` `write` `edit/[postId]` `post/[postId]`. ⚠️ **그 전에/병행: qr.tsx 재검증**(배치B에서 세션한도로 verify 유실, 203줄 인라인 리뷰면 충분 — 워크플로 불필요). 실제 탭 경로는 `app/(app)/(tabs)/` (STATE 표의 `(tabs)/`는 약식)
- 워크플로 세션한도 교훈: 38에이전트 중 11 verify가 7pm 리셋 한도로 실패 → 그룹 단위로 findings 유실(qr 전멸). 큰 배치는 ①그룹 수 축소 or ②verify를 단일투표로 or ③세션 리셋 시각 피해 실행. 배치 C는 5화면이라 리뷰 5+verify로 규모 적정
- 배치B 패턴 학습: 라이트모드 골드/회색-온-화이트 대비(2.1~2.9:1)가 반복 P1 클래스 — `getLayoutColor`/`secondary-600`/`content-onGold` 토큰이 이미 존재하나 하드코딩으로 우회됨(HomeTabBar는 토큰 사용=정답 레퍼런스) / 룰27 size 22는 코드베이스 만연(탭바·헤더·메뉴) → Z 패스에서 전역 grep `size={22}` 일괄 점검 권장 / 골드 위 텍스트·아이콘은 `content-onGold`(#09090B)가 SSOT
- 작업 위치: 워크트리 `C:\Users\user\Desktop\T-HOLDEM-design-loop` 브랜치 `design/ui-ux-consistency-loop` (node_modules 정션 연결됨). 메인 체크아웃의 `docs/design-loop/`는 untracked 사본 — 회차 종료 시 양쪽 동기화할 것
- 워크플로 리뷰 프롬프트·스키마 재사용 가능: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\777c7133-6090-41e5-aff1-03448744ff33\workflows\scripts\batch-a-design-review-wf_5c40c68f-2bb.js` (GROUPS만 교체)
- 패턴 학습: 시맨틱 토큰 우선(`content-*`는 dark: 불필요) / active: pressed 관례 32곳 / 장식 요소는 accessibilityElementsHidden+importantForAccessibility 쌍 / 카피 변경 전 e2e 셀렉터 grep 필수
