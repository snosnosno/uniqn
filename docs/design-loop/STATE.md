# UI/UX 일관성 루프 — 상태 장부

> 매 회차 시작 시 이 파일을 읽고, 종료 시 갱신한다. 상태: `pending` → `in-progress` → `done` / `deferred`

## 배치 현황

| 배치 | 영역 | 화면 (uniqn-mobile/app/ 기준) | 상태 | 커밋 |
|---|---|---|---|---|
| A | 인증·공개·루트 | `(auth)/login` `(auth)/signup` `(auth)/forgot-password` `(public)/jobs/index` `jobs/index` `jobs/[id]`(공개 alias) `index`(splash) `+not-found` | **done** | `a586e28e9` |
| B | 탭 코어 | `(app)/(tabs)/home-jobs` `schedule` `qr` `employer` `profile`(고아라 편입) `_layout` `(app)/home` + TabHeader | **done** | `81dae65cb` `5f6a376c5`(qr) |
| C | 게시판 | `(app)/(tabs)/board/index` `[boardType]` `write` `edit/[postId]` `post/[postId]` `_layout` | **done**(Skeleton잔여✅·error.message→Z) | `3765e405a` `3d3bc97eb`(Skeleton) |
| D | 공고·지원 플로우 | `(app)/jobs/[id]/index` `(app)/jobs/[id]/apply` `applications/[id]/cancel` | **done** | `aea7a0e73` |
| E | 리뷰·공지 | `reviews/write` `reviews/[workLogId]` `reviews/pending` `reviews/history` `notices/index` `notices/[id]`(notices는 redirect) | **done** | `f0dce5ec5` |
| F | 지원센터·알림 | `support/faq` `support/create-inquiry` `support/my-inquiries` `support/inquiry/[id]` `notifications` | **done**(error.message→Z·미정의팔레트→M) | `dfd14081f` |
| G | 설정·프로필 | `settings/profile` `settings/change-password` `settings/my-data` `settings/business-info` `profile-setup` (약관 4종은 레이아웃만 — 본문 금지) | **done**(hand-rolled 버튼→Button M·error.message→Z) | `86d676398` |
| H | 구인자 등록 | `employer-register` `employer-application-status` | **done**(Button라벨 surface-dark·미정의팔레트→M) | `2d899af83` |
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
- [B-qr] P2 4 | 유실됐던 qr verify를 인라인 재검증(배치B 동일 패턴 확정): 헤더 부제·'현재 상태' 라벨·스캔 안내문 secondary-500→600(라이트 AA) + 스캔 Button ScanIcon #FFFFFF→onGold (`5f6a376c5`). quality exit0. **배치B 완전 종료**
- [C] 워크플로 28에이전트(3그룹 리뷰+단일투표 검증, 0 반박·0 유실 — 소규모가 세션한도 회피): 확정 25(검증 후 2건 P3 강등)+P3 8. 22건 수정(`3765e405a`). 배치B 반복패턴이 게시판 전반 재현
- [C] P2 골드 위 onGold(#09090B) | BoardTabBar 활성라벨(white→onGold)·BoardWriteFab +아이콘·PostHeader 추천하트·post[id] 신고Flag·BoardCommentComposer 등록PaperPlane | 골드 위 흰 전경 라이트 2.1:1→9.5:1. BoardWriteFab는 isDark 전경분기 자체 제거(배경 골드 양모드 동일)→unused 변수/import 정리
- [C] P2 라이트 AA 대비 | BoardPostCard 메타3·PostHeader 메타4·EmptyState(공용)·BoardPostEditor 2·BoardImagePicker 3 | secondary-500(흰 2.86:1)→secondary-600/content-secondary(4.9~6.2:1). **EmptyState는 공용→전 화면 빈상태 개선(다크 secondary-400 유지)**
- [C] P2 골드 절제(룰3) | BoardPostCard 댓글 골드→중립·PinnedNoticeBanner border-l-2 골드제거+제목 중립(§14 안티패턴)·작성자/역할 배지 employer primary→info·boardType 배지 작성자role 디커플→secondary | 정보성 배지 골드 제거, getAuthorBadgeVariant/getRoleBadgeVariant 2함수 수정(Badge info/secondary 지원 확인)
- [C] P2 터치·피드백 | BoardTabBar pressed 배경톤+py-2.5(40px)+hitSlop·댓글 반응칩/답글 hitSlop·더보기 hitSlop·이미지삭제 hitSlop6→10·이미지뷰어 chevron 22→24 | 룰5/21/27
- [C] P2 이모지(룰14) | board 홈 섹션 헤더 🔥인기글·🕒활동 → 이모지 제거(e2e 셀렉터 의존 grep 0건 확인)
- [C] 검증 | quality exit0(tsc0·lint0·format0) / jest 89 pass(board 21 suites + EmptyState·BoardPostCard·BoardImagePicker·PinnedNotice)
- [C 잔여] **미수행 P2 3건**: ①error.message 원시노출(board index:81·[boardType]:59) — 앱 전역 11곳 동일관행이라 board 단독변경시 불일치 → **Z 횡단패스로 일괄**(ErrorState 중앙 sanitize or 11곳 통일) ②③Skeleton 구조정합(board/index:71·[boardType]:82) — SkeletonListItem(원형 아바타) → BoardPostCard형 composer 신규작성 규모라 **batch C 잔여**로 분리(차기 회차)
- [C 잔여 ✅완료] (`3d3bc97eb`) Skeleton 구조정합 2건 + 동반 P3 1건 해소: **SkeletonBoardPostItem** composer 신규작성(BoardPostCard 정합 — 배지+제목 행 + 메타 행, 원형 아바타 제거). 내부 Skeleton `accessible=false`(호출부 progressbar 컨테이너가 announce). board/index·[boardType] 5+5 교체 + board 홈 로딩에 progressbar 래퍼 추가([boardType]은 기존 래퍼 존재). BoardPostDetailSkeleton:12 로딩문구 secondary-500→content-secondary. **기존 SkeletonListItem 불변**(아바타 적절한 profile/collaborator/wallet용). 잔여 error.message는 여전히 **Z 횡단패스**
- [D] 워크플로 14에이전트(3그룹 리뷰+단일투표 verify) — **세션한도(12am Asia/Seoul 리셋)로 verify 11건+apply 리뷰 1건 유실**(배치B qr 선례 반복). `confirmed:[]`는 반박 아닌 verify 전멸 결과. detail/cancel 리뷰 findings + verify 라벨이 무엇을 찾았는지 보존 → **인라인 재검증**(qr 선례: 코드 직독+토큰값+룰 대조가 곧 검증)으로 확정 P2 21건 수정(`aea7a0e73`). cancel.tsx는 단순 Redirect(리뷰대상 0)
- [D] P2 골드 위 onGold(#09090B) 3 | CancellationRequestForm:216 대타 체크박스·RoleCheckbox:35 역할 체크 CheckIcon `#FFFFFF`→`#09090B` / PreQuestionForm:79 select 라디오 점 `bg-white`→`bg-content-onGold` | 전부 `bg-primary-500`(골드) 위 흰 전경 2.1:1. **레퍼런스=ApplicationForm:362 이미 #09090B**(동일 체크마크 패턴이 한 파일은 onGold·다른 곳은 흰색 불일치였음)
- [D] P2 라이트 AA 17 | index 4·apply 4·JobDetail:250·ApplicationForm 4·PreQuestionForm 2·AssignmentSelector:188·DateGroupSelection:80 | `text-secondary-500 dark:text-secondary-400`(흰 2.86:1)→`text-content-secondary`(라이트 #606068 ~6.5:1, CSS var가 다크 #C0C0C8 자동). 다크는 secondary-400(#A8A8B0)→#C0C0C8 미세 밝아짐(배치C와 동일·가독성↑). JobDetail:250은 같은 박스 형제(line 243)가 이미 content-secondary라 불일치도 동시 해소
- [D] P2 룰27 아이콘 1 | JobDetail 헤더 ShareIcon size 22(중간값 금지)→24(헤더 아이콘 표준, 배치B HomeTabBar 정합)
- [D] 검증 | quality exit0(tsc0·lint0·format clean — apply/ApplicationForm prettier 재배치) / jest 7스위트 27 pass(JobDetailScreen·JobDetail·ApplicationForm·AssignmentSelector+utils·Skeleton·BoardPostDetailScreen). PreQuestionForm/RoleCheckbox/CancellationRequestForm은 테스트 파일 없음(프레젠테이션)
- [E] 워크플로 14에이전트(3그룹 리뷰+단일투표) — **자정 직후라 verify는 fresh 한도지만 ~13분 느려 사용자 대기** → journal에서 전 review findings 추출 후 **인라인 정독 reconcile**(6컴포넌트+4화면 전부 직독, 워크플로 정지). notices/index·[id]는 board redirect(리뷰대상 0). 워크플로 findings는 내 인라인과 대부분 일치
- [E] P2 라이트 AA 13 | history 3(ScoreSummary 2·비활성탭 라벨)·pending 2·[workLogId] 2(섹션라벨)·ReviewForm:182·ReviewTagSelector 2·ReviewCard:64·ReviewBlindMessage 2 | `text-secondary-500 dark:text-secondary-400`→`text-content-secondary`. **ReviewForm:204는 비활성 제출버튼 라벨(회색 bg, WCAG disabled 예외)→blanket replace 금지, 타깃 편집으로 제외**
- [E] P2 충돌 이중 dark bg | history:54 화면컨테이너 `dark:bg-surface dark:bg-secondary-900`(뒤가 이김→#18181E, 표준#0B0B0E 이탈)→`dark:bg-surface` / ReviewBlindMessage:18,31 카드 dead `dark:bg-surface` 제거(secondary-800 로컬 카드 컨벤션 유지). NativeWind 동일속성 2회 선언은 결과 불확정→1개만 남김
- [E] P2 기타 | ReviewForm 제출 스피너 `color="white"`(제출중 버튼=회색 비활성 bg-secondary-300, 라이트 1.3:1 거의안보임)→`isDarkMode?'#FFFFFF':'#09090B'`(라이트 어두운 스피너·다크 흰) / [workLogId]:152 "리뷰 작성하기" 골드텍스트 primary-500(흰 2:1)→primary-600(pending:83 형제 정합) / write 잘못된접근 에러 ErrorState retry(→history)와 중복된 "히스토리로 이동" Button 제거(룰11, Button import도 제거)
- [E] P2 데드마크업 | ReviewBlindMessage 2·ReviewPromptBanner 1 빈 글리프 `<Text text-2xl>{''}</Text>` 제거(이모지 자리 잔재→팬텀 세로여백). 배치A `{''}` 패턴이나 여기선 버튼 아닌 빈상태 장식슬롯이라 리뷰어도 P3(데드)로 평가. **아이콘 추가(EyeSlash/Clock/Star)는 P3 enhancement로 분리**(빈상태 룰9)
- [E] 검증 | quality exit0(tsc0·lint0·format clean — history/[workLogId]/ReviewTagSelector prettier 재배치, write Button import 제거) / jest 9스위트 31 pass(ReviewForm·ReviewDetailScreen·ReviewWriteScreen·useReviews 등). SentimentSelector/ReviewCard/ReviewTagSelector/ReviewBlindMessage/ReviewPromptBanner 단독 테스트 없음
- [F] **인라인 정독 리뷰**(워크플로 미사용 — D·E 선례대로 5화면+8컴포넌트 직독 + tailwind.config 토큰값/룰 대조). 확정 P2 9건 수정(`dfd14081f`). 배치B~E 반복패턴(라이트AA·골드위onGold·충돌이중darkbg·빈글리프)이 지원센터/알림에 동일 재현. create-inquiry/faq/my-inquiries 화면 본체는 위반 경미(폼/리스트는 공용 FormField·EmptyState·AppFlashList 경유라 정합)
- [F] P2 라이트 AA 4 | inquiry/[id]:50 에러설명·NotificationList:150 헤더·:230 SimpleList 빈상태·NotificationGroupItem:136 그룹본문 | `text-secondary-500 dark:text-secondary-400`(흰 2.86:1)→`text-content-secondary`(라이트 #606068 ~6.5:1, CSS var 다크 #C0C0C8 자동). 배치C~E 동일
- [F] P2 골드 위 전경 SSOT 4 | FAQCategoryTabs:59·NotificationCategoryTabs:102 선택탭 라벨·:115 선택 카운트배지·NotificationList:131 '다시 시도' 버튼 | `text-surface-dark`(#07070A) → `text-content-onGold`(#09090B). 둘 다 거의-검정이나 surface-dark는 "어두운 *배경*" 시맨틱이라 골드 위 전경엔 오용 — content.onGold가 SSOT(배치E ReviewForm:204 선례, support/index:55 이미 정답). **전역 text-surface-dark 73곳 중 골드-전경 오용분만 Z 패스 grep 권장**
- [F] P2 충돌 이중 dark bg 1 | inquiry/[id]:97 내용박스 `bg-surface-page dark:bg-surface p-4 dark:bg-surface/50`(dark:bg-surface 2회 선언, NativeWind 결과 불확정)→`dark:bg-surface` 1개. 배치E history/ReviewBlindMessage 선례 동일
- [F] P2 빈 글리프 데드마크업 1 | inquiry/[id]:135 '답변 대기 중' 카드 `<Text text-2xl>{''}</Text>`(현재 프로덕션도 빈 원 렌더)→`<ClockIcon size={24} color={STATUS_COLORS.warning}>`. 배치A/E는 장식슬롯이라 제거만 했으나 여기선 48px 프로미넌트 원이라 룰9(빈상태=인지) 위해 의미있는 아이콘 추가가 정답(이미 빈 원이므로 행동 보존). 원 dark bg `dark:bg-warning-900/30`(미정의)는 M 이관
- [F] P2 raw bg-white→토큰 1 | NotificationCategoryTabs:72 컨테이너 `bg-white`→`bg-surface-card`(자매 컴포넌트 FAQCategoryTabs 정합, nativewind 룰4 시맨틱토큰)
- [F] 검증 | quality exit0(tsc0·lint0·format clean — NotificationList/GroupItem prettier 재배치) / jest NotificationList 1 pass(refresh-error 경로 보존 확인). 지원센터 화면·FAQ·Category탭은 단독 테스트 없음(프레젠테이션)
- [G] **인라인 정독 리뷰**(워크플로 미사용). 5화면(profile·change-password·my-data·business-info·profile-setup) 직독. 확정 P2 4종 수정(`86d676398`). business-info는 위반 거의 없음(content 토큰 정합, active:opacity-70만 P3). 약관 4종(terms/privacy/employer-terms/liability-waiver)은 본문 금지라 미접촉
- [G] P2 제출 스피너 라이트 대비 2 | profile:527·change-password:266 저장중 버튼 `<ActivityIndicator color="#FFFFFF">` — 제출중 버튼 bg=`bg-secondary-300 dark:bg-surface`(라이트 회색), 흰 스피너 ~1.3:1 거의 안보임 → `isDarkMode ? '#FFFFFF' : '#09090B'`(useThemeStore 추가). **배치E ReviewForm:182 동일 패턴·동일 해법**
- [G] P2 룰27 아이콘 size 22 금지 6 | change-password 비밀번호 표시/숨기기 Eye/EyeSlash 6곳 `size={22}`→`20`(입력필드 py-3 인접, 배치B profile 메뉴아이콘 22→20 정합). 화이트리스트 14/16/18/20/24
- [G] P2 빈 글리프 데드마크업 1 | my-data:203 개인정보 처리방침 카드 `<Text text-2xl mr-3>{''}`(현 프로덕션 빈 텍스트+팬텀 mr-3 12px 갭, flex-row 아이콘 컬럼 의도) → `<ShieldCheckIcon size={24} color={PRIMARY_COLORS[700]}>`(룰9/13 의미있는 아이콘, 배치F ClockIcon 선례 — 프로미넌트 의도된 아이콘 슬롯엔 추가가 정답)
- [G] P2 라이트 AA 1 | profile-setup:106 부제 `text-secondary-500 dark:text-secondary-400`(흰 2.86:1)→`text-content-secondary`
- [G] 검증 | quality exit0(tsc0·lint0·format clean). 5화면 모두 단독 jest 없음(프레젠테이션). 로직 미변경(스피너 색 조건·아이콘 size·색 토큰만)이라 tsc0이 useThemeStore훅·ShieldCheckIcon import 정합 보증
- [H] **인라인 정독 리뷰**(워크플로 미사용). 2화면(employer-register·employer-application-status) 직독. 확정 P2 6건 수정(`2d899af83`). application-status는 5상태(loading/none/pending/approved/rejected) 화면이나 위반은 StatusBadge rounded-full·미정의 팔레트뿐
- [H] P2 라이트 AA 4 | employer-register InfoRow:42 라벨·AgreementCheckbox:96 설명·:237 본인인증 안내·:263 구인소개 설명 | `text-secondary-500 dark:text-secondary-400`(흰 2.86:1)→`text-content-secondary`. replace_all(4곳 동일 fragment, 비활성/조건부 분기 없음 확인)
- [H] P2 골드 위 흰 전경 1 | employer-register AgreementCheckbox:80 동의 체크박스 `<CheckCircleIcon color="#fff">`(checked 시 bg-primary-600 골드 위)→`#09090B`. 배치D RoleCheckbox/CancellationForm 체크마크 onGold 정합
- [H] P2 룰14 rounded-full 1 | employer-application-status StatusBadge:67 `rounded-full`→`rounded-sm`(DESIGN.md rounded 스케일·InquiryStatusBadge/NotificationCategoryTabs 배지 정합). pending/approved/rejected 3상태 배지 공통
- [H] 검증 | quality exit0(tsc0·lint0·format clean — employer-register prettier 재배치) / 2화면 단독 jest 없음(프레젠테이션)

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
- [B-qr] ✅재검증 완료(`5f6a376c5`): P2 4건(라이트 AA·아이콘 onGold) 수정. 잔여 P3: qr.tsx:78 커스텀 bg-white 헤더(TabHeader 미사용·flat 다크 경계) / qr.tsx:122 '출근 필요' 골드 배지(룰3 경계, CTA-인접이라 방어가능) / qr.tsx:91 Card a11y forwarding / qr.tsx:144 히어로 ScanIcon size 80
- [C] 메타 아이콘 size={12} 화이트리스트 외 | BoardPostCard:65·PinnedNoticeBanner:18·BoardCommentItem:235(PlusIcon) | 14px text 인접이라 의도 합리적이나 룰27 위반. size 14로 통일 | M/Z
- [C] BoardPostDetailSkeleton.tsx:12 | 로딩 안내 text-secondary-500 라이트 AA 미달(일시 텍스트라 낮음) → content-secondary | batch C 잔여와 함께
- [C] BoardImageGrid.tsx:77 | 이미지 카운터 text-[10px] 임의값 → text-micro 토큰(검정 위 흰 텍스트라 대비는 OK) | M
- [C] BoardCommentItem:207 | 반응칩/답글/메뉴 Pressed가 active:opacity-70만(룰21: 다크 대비 깨짐) → 배경 톤 토글 | 룰21 일괄(M)
- [C] InlineComposerRow.tsx:33 | reply/edit autoFocus(룰20 위반, 스크린리더 혼선) — 사용자 명시 탭 흐름이라 UX 정당성은 있음 → AccessibilityInfo.isScreenReaderEnabled() 시 스킵 | M
- [C] Card.tsx:27 | 기본 variant 'elevated' shadow-md 항상(룰14 그림자 남발) — 게시판 상세 카드+댓글마다 중첩 → 리스트형 반복카드는 outlined or 배경 elevation | M(공용, 영향 큼)
- [C] BoardPostEditor.tsx:131 | '취소'가 입력중에도 확인없이 초안 폐기(v1 룰12 Undo>Confirm) → title/body 있으면 Alert 1차확인 | D/작성플로우
- [C→Z] error.message 원시노출 11곳(board 2·employer 1·my-postings 3·ApplicantList·ConfirmedStaffList·StaffManagementTab·SettlementList·JobList) | ErrorState 중앙 sanitize or 전수 친화문구 통일 | **Z 횡단패스**
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
- [D→M] AssignmentSelector.tsx:168-176 고정공고 비활성 warning 박스 | **미정의 warning 티어** `text-warning-800`·`dark:text-warning-200`·`bg-warning-900/30`·`dark:text-warning-300`(warning 팔레트는 50/100/400/500/600/700만 존재 → 미정의 클래스는 무스타일·색 미적용) + raw `border-amber-200 dark:border-amber-800`(amber raw Tailwind 금지) | 박스 전체를 일관 토큰으로 재구성 — 핸드오프 "미정의 팔레트 티어 40+파일" 동일 클래스라 **M 일괄**(amber만 단독수정 시 미정의 티어 잔존)
- [D→Z/M] placeholder 색 전역 결정 | `placeholderTextColor={SECONDARY_PALETTE[400]}`(#A8A8B0, 라이트 ~2.1:1) — ApplicationForm:330·CancellationRequestForm:181·PreQuestionForm:143,155 등 **10+파일 지배적 관행**. 반면 `getPlaceholderColor(isDarkMode)`(라이트 #707078 반환)는 **사용처 0건**. 단독 교체 시 오히려 전역 불일치 → 라이트 placeholder 대비 개선하려면 **전역 일괄**(헬퍼 채택 or 토큰화) | 리뷰어가 batch D P3로 제기했으나 인라인 검증서 단독수정 반증
- [D→M] 시맨틱 토큰 위 dark: 중복 (광범위) | `text-content-primary dark:text-off-white`(JobDetail 55/112/216/263·CancellationRequestForm 135/148/219·ApplicationForm 49/258/316/365·FixedRoleSelector) + `text-content-muted dark:text-secondary-300`(JobDetail:141·CancellationRequestForm 140/151/154/222/232) — content-* CSS var가 이미 다크 처리하는데 dark: override 덧댐 | NativeWind 플랫폼 미flip 방어 의도면 정책화, 아니면 dark: 제거 일괄 — **M/Z**
- [D→M] ApplicationForm/JobDetail `dark:bg-surface` 이중중복 | `bg-surface-page dark:bg-surface p-4 dark:bg-surface`(ApplicationForm 251/337/345/376·JobDetail:240) 한 className에 dark:bg-surface 2회 — 무해하나 정리 | M
- [D→M/룰] apply.tsx 히어로 아이콘 size 40/56 (AlertTriangle:34·InformationCircle:53·CheckCircle:270) | §27 화이트리스트(14~32) 외이나 80/96px 원형 일러스트 — 배치B BriefcaseIcon size48 선례와 동일 히어로 예외 | 룰27 히어로 예외 명문화 M/룰문서
- [D→M] apply.tsx:27 LoadingState `Loading variant='layout'`(전체화면 스피너) → 룰16 Skeleton 검토(공고 상세 로드, 배치B home.tsx 선례와 동일) | M/홈·로딩
- [D→M] JobDetail.tsx:141 상세설명 본문이 `text-content-muted`(최저강조 토큰)라 squint test(룰13)서 가장 읽혀야 할 본문이 가장 흐림 + dark leading(룰1) 미적용 → content-secondary 상향 + dark:leading-body-dark | M(개선 아이디어)
- [E→M] **공용 BubbleScoreBadge/SENTIMENT 토큰 미정의 다크티어** | `src/types/review.ts` SENTIMENT_COLORS positive.darkBg `dark:bg-success-900/30`·negative.darkBg `dark:bg-error-900/30`(success-900/error-900 미정의 가능) + BUBBLE_SCORE_COLORS `text-white` on `bg-warning-500`(#D4A017 골드, 흰 ~2:1 대비미달, L406)·on bg-success/error-500 | BubbleScoreBadge는 JobDetail 등 **배치 외 공용**이라 M(공용 컴포넌트+토큰)에서 팔레트 티어 검증 후 일괄. [[배치D AssignmentSelector 미정의 warning 티어]]와 동일 클래스
- [E→M] 미정의 팔레트 티어 (배치E 추가) | pending.tsx:70 D-day 배지 `dark:bg-warning-900/30`·`dark:text-warning-300`(warning은 50/100/400/500/600/700만 존재 → 다크모드 배지 bg/text 미적용) + :61 info-100/700/300/900 확인 필요 | 핸드오프 "미정의 팔레트 40+파일"과 동일 → M 일괄(다크 시각 영향 있어 우선순위 ↑)
- [E→M] 리뷰 카드 dark bg 컨벤션 통일 | ScoreSummary(history:119)·ReviewCard(51,52)·ReviewBlindMessage·SentimentSelector(54)·ReviewTagSelector(107) 등 `dark:bg-secondary-800`(#2A2A30) vs 앱 표준 `dark:bg-surface`(230파일). secondary-800은 10파일 유효 컨벤션이나 비표준 → 전역 카드 dark bg 토큰 결정(secondary-800 vs surface-card) | M
- [E→M] sentiment 이모지(룰14) | SentimentSelector:60 선택버튼(text-2xl 😊😐😞)·ReviewCard:60 배지 | **워크플로 2리뷰어 독립 P2 평가**(라벨+컬러 이미 병행이라 제거 저위험·Black&Gold 톤 이질). 단 SentimentSelector 버튼은 이모지가 주 시각이라 제거=상당한 비주얼 변경(입력 어포던스 vs 상태표시 경계) → **디자인 결정 P3**(사용자 승인 시 제거: SENTIMENT_EMOJI 상수 deprecate + 라벨/컬러만)
- [E→M] 빈상태 아이콘 enhancement | ReviewBlindMessage(EyeSlash 블라인드·Clock 대기)·ReviewPromptBanner(Star) 빈 글리프 제거만 했으니 룰9(빈상태=온보딩) 위해 의미있는 Lucide 아이콘 추가 검토 | M(아이콘 import+색 결정)
- [E→M] active:opacity Pressed(룰21) + 터치타깃(룰5) | pending:42 카드·ReviewPromptBanner:24·SentimentSelector:49·ReviewTagSelector:104 칩(py-1.5 ~28px, hitSlop 없음, active: 부재) | 토글은 선택상태가 피드백이라 경미하나 룰21 일괄(M). 배치 전반 active:opacity → 배경톤 토글 일괄과 함께
- [E→M] 로딩 스피너 vs Skeleton 형제 불일치(룰16) | history:76 전체화면 ActivityIndicator / [workLogId]:104 Loading variant=layout / pending은 Skeleton 사용 | 3 형제 화면 로딩 통일(Skeleton) | M
- [E→M] ReviewForm dark: override 중복(108/123/151 content-primary+dark:text-secondary-100, 166 dark:bg-secondary-800) + :117/144 error-500 dark variant 부재 + :204 골드버튼 텍스트 `text-surface-dark` vs `content-onGold` SSOT / ReviewPromptBanner:40 chevron `{'>'}` 텍스트→ChevronRightIcon(룰27) | 토큰/아이콘 정합 M
- [F→M] **미정의 팔레트 티어 (배치F 추가, 다크 깨짐)** | inquiry/[id]:125 답변박스 `dark:bg-success-900/20`(success는 50/100/300/400/500/600/700만 → 900 미정의=다크 무배경)·:134 대기카드 원 `dark:bg-warning-900/30`(warning 900 미정의) / `INQUIRY_STATUS_CONFIG`(src/types/inquiry.ts:242-248) `dark:bg-warning-900/30`·`dark:text-warning-300`(warning 300/900 미정의)·`dark:bg-success-900/30`(success 900 미정의) — InquiryStatusBadge는 배치L 관리자도 공유 / NotificationList:164-165 인라인에러 박스 raw `border-amber-200 dark:border-amber-700`(amber raw Tailwind 금지) + `text-warning-800 dark:text-warning-200`(warning 800/200 미정의) — **배치D AssignmentSelector 동일 클래스** | M에서 팔레트 티어 추가 or 클래스 교체 일괄(다크 시각 영향 ↑)
- [F→M] NotificationIcon categoryColors `dark:bg-{primary,success,warning,info}-50`(라이트-50 배경을 다크에서도 그대로 사용 → 다크 surface 위 밝은 연색 칩) | 의도된 컬러 아이콘 칩일 수 있으나 다크 일관성 점검 — `dark:bg-{color}-900/30` 등 다크 전용 톤으로 교체 검토 | M(공용 컴포넌트)
- [F→M/Z] my-inquiries 로딩 = 전체화면 `ActivityIndicator color=PRIMARY_COLORS[300]`(룰16 Skeleton 미사용 + 골드 라이트 스피너 ~2.1:1) — 자매 화면 notifications는 ScreenSkeleton 사용. SkeletonInquiryCard composer 신규작성(배치C SkeletonBoardPostItem 선례) + getLoadingColor 스피너 단일소스(배치B Loading.tsx) | M/로딩
- [F→M] faq.tsx:40 로딩 = `<Text>로딩 중...</Text>`(스피너/Skeleton 없음, 룰16) — FAQ 아코디언 Skeleton composer 검토 | M/로딩
- [F→M] NotificationItem:68·NotificationGroupItem:77 읽음 행 `bg-white dark:bg-surface-dark`(raw bg-white, 룰4 시맨틱토큰) + 읽음 제목 dark: override 중복(:90 content-secondary+dark:text-secondary-300, :103 dark:text-secondary-400) | 전역 bg-white→surface-card 스윕과 함께 M/Z
- [F→M/Z] 시맨틱 토큰 위 dark: 중복(배치F) | inquiry/[id]:47 에러타이틀 `text-content-primary dark:text-secondary-100`·NotificationGroupItem:103 미읽음 제목·:127 컨텍스트 `text-content-muted dark:text-secondary-400` — content-* CSS var가 이미 다크 처리하는데 dark: 덧댐 | 배치D/E `dark:text-off-white`·`dark:text-secondary-300` 일괄과 동일 M/Z 정책 결정
- [F] create-inquiry InquiryForm:147,176 `placeholderTextColor={isDark ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}`(라이트 #A8A8B0 ~2.1:1) — 배치D 확정 "placeholder 전역 일괄"(getPlaceholderColor 미사용·SECONDARY_PALETTE[400] 지배관행)과 동일. 단독수정 금지 | M/Z 전역 placeholder 결정
- [G→M] **hand-rolled 제출 버튼 → 공용 Button 교체** | profile:517·change-password:260 저장/변경 버튼이 Pressable+bg-primary-600 수기조립(Button 컴포넌트 미사용) → ①라벨 `text-surface-dark`(content-onGold SSOT 이탈, 배치E ReviewForm:204 동일 deferred) ②**비활성+다크 라벨 불가시**(disabled bg `dark:bg-surface` #0B0B0E 위 text-surface-dark #07070A 거의 동색) ③loading/disabled 상태처리 중복 | Button 컴포넌트로 교체 시 3건 동시 해소(시각 QA 필요라 M)
- [G→M] my-data Modal Input:315 `autoFocus`(룰20 위반, 스크린리더 혼선) — 배치C InlineComposerRow와 동일, AccessibilityInfo.isScreenReaderEnabled() 가드 | M 일괄
- [G→M] my-data:331 Modal 저장 Button 자식 `<ActivityIndicator color="#FFFFFF">`(Button 기본 골드 bg면 흰 스피너 대비 부족) — Button loading prop 활용 권장 | M(Button 컴포넌트)
- [G→M/Z] profile-setup:89 컨테이너 raw `bg-white dark:bg-surface`(다른 G화면은 bg-surface-page) — 단 signup 플로우(SignupStepProfile 재사용) 연속성 의도 가능성 → 전역 bg-white→surface-page 스윕 시 함께 판단 | M/Z
- [G→M/Z] 시맨틱 토큰 위 dark: 중복(배치G) | profile-setup:103 헤더 `text-content-primary dark:text-off-white` | 배치D/E/F 동일 일괄 정책 결정 M/Z
- [G→M] business-info InfoRow:47 `active:opacity-70`(룰21: 다크 대비 깨짐) | 룰21 active:opacity→배경톤 토글 전역 일괄 M
- [G] profile.tsx placeholder 5곳 `placeholderTextColor={SECONDARY_PALETTE[400]}`(라이트 ~2.1:1) — [[배치F create-inquiry]]·배치D와 동일 전역 placeholder 관행 | M/Z 전역 결정
- [H→M] employer Button-child 라벨 `text-surface-dark` 4 | employer-register:319·employer-application-status:91/172/231 `<Button variant="primary"><Text text-surface-dark>` — Button 컴포넌트 자식으로 라벨색 수기지정(content-onGold SSOT 이탈). 배치E/G와 동일 deferred — Button이 라벨색 소유하도록(string 자식) M에서 일괄. employer-register:317 제출 `<Loading color="#fff">`도 Button loading prop으로 이관
- [H→M] **미정의 팔레트 티어(배치H)** | employer-application-status StatusBadge pending `dark:bg-warning-900/30`·`dark:text-warning-300`(warning 900/300 미정의)·approved `dark:bg-success-900/30`(success 900 미정의) + PendingScreen:134 `dark:bg-warning-900/20` | 배치D/E/F와 동일 → M 팔레트 티어 추가 or 교체 일괄(다크 깨짐)
- [H→M] employer-register raw bg-white 2 | AgreementCheckbox:77 미체크 박스 `bg-white`·:276 TextInput `bg-white` + :271 placeholder raw `#9CA3AF`(SECONDARY_PALETTE도 아닌 raw Tailwind gray) | bg-white→surface-card + placeholder 전역결정과 함께 M
- [H→M/Z] 시맨틱 토큰 위 dark: 중복(배치H 광범위) | employer 두 화면 전반 `text-content-primary dark:text-off-white`·`text-content-muted dark:text-secondary-400` 다수 | 배치D~G 동일 M/Z 일괄 정책
- [H→M] employer-register AgreementCheckbox `[보기]`:88 Pressable ml-2 무 hitSlop/패딩(룰5 터치 44px 미달) | hitSlop 추가 M

## 회차 메모

> 다음 회차에 넘길 주의사항·미완 항목

- 다음 배치: **I (구인자 공고관리)** — `(employer)/my-postings/create` `[id]/edit` `[id]/applicants` `[id]/settlements` `[id]/collaborators` `[id]/cancellation-requests` (6화면, 대형 배치 — 공용 컴포넌트 다수 경유 예상). 잔여 error.message·미정의 팔레트·Button라벨·placeholder는 Z/M
- 배치 H 교훈: employer 두 화면도 동일 5패턴(라이트AA·골드위onGold·미정의팔레트·Button라벨 surface-dark·dark중복) 재현. **Button-child에 `<Text text-surface-dark>` 라벨 수기지정**이 employer 화면에 4곳 — F에서 standalone 탭은 fix했으나 Button 자식은 G/H 일관되게 M deferred(Button이 색 소유하는 게 근본해결). 배치 I는 6화면 대형이라 컨텍스트 관리 주의 — 공용 컴포넌트(JobForm·ApplicantList·SettlementList 등) 다수 경유분은 이미 배치C/D/E에서 일부 리뷰됨, 화면 본체 위반 위주로
- 배치 G 교훈: 설정 화면들은 content 토큰 정합도가 높아 위반이 적음(business-info는 거의 0). 위반은 ①제출 스피너 라이트 대비(배치E와 동일, useThemeStore로 isDarkMode split) ②size22 아이콘 ③빈 글리프 ④라이트AA에 집중. **hand-rolled 제출 버튼(Pressable+bg-primary-600 수기)이 profile·change-password에 반복** — 라벨 text-surface-dark·비활성+다크 불가시·상태처리중복 3종을 Button 컴포넌트 교체로 M에서 동시 해소(시각 QA 필요). **profile/change-password에 useThemeStore 신규 도입**(스피너 색 분기용) — 동일 패턴 다른 hand-rolled 버튼에도 적용 가능
- 배치 F 교훈: 워크플로 없이 **인라인 정독만으로 완결**(5화면+8컴포넌트). 지원센터/알림은 공용 프리미티브(FormField·EmptyState·AppFlashList·Card·ScreenSkeleton) 경유 비율이 높아 화면 본체 위반이 적고, 위반은 ①라이트AA ②골드위onGold ③충돌 이중darkbg ④빈글리프 ⑤미정의 팔레트 5클래스에 집중 — 모두 배치C~E 기확립 패턴이라 적대검증 불필요. **`text-surface-dark`가 골드 전경에 73곳 중 일부 오용**(content.onGold가 SSOT)이 신규 발견 — Z 패스 grep 후보. **미정의 팔레트 티어가 또 다수**(success-900·warning-200/300/800/900·info-*) → M 우선순위 재확인(다크 깨짐 실재). raw `bg-white`·raw `border-amber-*`도 알림 컴포넌트에 잔존 → M 전역 스윕
- 배치 E 교훈: **워크플로가 자정 직후에도 느릴 수 있음(~13분)** → journal에서 review findings는 실시간 추출 가능하니, 느리면 정지하고 인라인 reconcile이 빠름. 사용자 대기 길어지면 인라인 우선. **blanket replace_all 주의**: secondary-500이 비활성 버튼/조건부 분기에 있으면 제외(ReviewForm:204 disabled) — 파일 내 같은 클래스라도 맥락 확인 후 타깃 편집. **충돌 이중 dark bg**(`dark:bg-surface dark:bg-secondary-X`)는 배치 E에서 2건(history 화면·ReviewBlindMessage 카드) — Z 패스 grep `dark:bg-\S+ \S*dark:bg-` 권장
- 배치 E 미정의 팔레트 티어 재확인: warning 팔레트=50/100/400/500/600/700만(200/300/800/900 없음). `dark:bg-warning-900`·`text-warning-300` 등은 무스타일 → 다크 시각 깨짐. 배치D AssignmentSelector·배치E pending/review.ts 모두 동일 → **M에서 팔레트 티어 추가 or 클래스 교체 일괄**(다크 영향 커서 우선순위 ↑)
- ⚠️ **세션한도 재발(배치 D)**: 워크플로 verify 11건+apply 리뷰 1건이 12am Asia/Seoul 리셋에 또 전멸(배치B qr와 동일 클래스). **대응 성공 패턴**=리뷰 findings + verify 라벨이 "무엇을 찾았는지"는 보존되므로, 세션 리셋 후 **인라인 재검증**(코드 직독 + tailwind.config 토큰값 + 룰 대조 = 검증 동치)으로 확정. 확정 반복패턴(골드위흰색·라이트AA·size22)은 grep 매핑→직독으로 충분. **다음 회차는 세션 리셋(자정 KST) 시각 피해서 워크플로 실행 권장** or 그룹 더 축소
- 인라인 검증이 리뷰어 P3 1건 **반증**: placeholder SECONDARY_PALETTE[400]가 "표준 우회"라는 리뷰어 주장 → 실제 getPlaceholderColor 사용처 0건·SECONDARY_PALETTE[400]가 10+파일 지배 관행 → 단독수정이 오히려 불일치. 적대검증 없이도 grep으로 반증 가능(전역 관행 확인 필수)
- 배치 D 패턴 학습: 같은 체크마크가 **한 파일은 onGold(#09090B)·다른 파일은 #FFFFFF** 불일치(ApplicationForm 정답 vs Cancellation/RoleCheckbox 오답) — 골드 위 전경은 컴포넌트 간 SSOT 부재로 산발. Z 패스 grep `color="#FFFFFF"`/`bg-white` + 골드 부모 전수 필요. content-onGold는 텍스트(text-)뿐 아니라 **배경(bg-content-onGold)·아이콘 color**에도 적용 가능(#09090B literal이라 native 안전)
- 배치C 패턴 학습: 골드 위 흰 전경(white/#FFFFFF on 골드 버튼/배경)이 **앱 전역 반복 클래스** — Button variant=primary에 아이콘 흰색 넘기는 패턴이 board 5곳+QRPanel/QRCodeDisplay+employer/profile/qr에 산재. Z 패스에서 `color="#FFFFFF"`/`'#fff'` + 골드배경 전수 grep 권장. 정답=`#09090B`(content.onGold) / EmptyState·Card 등 공용 컴포넌트 수정은 1건으로 전 화면 개선(고ROI)이나 영향범위 grep 필수
- 워크플로 세션한도 교훈: 38에이전트 중 11 verify가 7pm 리셋 한도로 실패 → 그룹 단위로 findings 유실(qr 전멸). 큰 배치는 ①그룹 수 축소 or ②verify를 단일투표로 or ③세션 리셋 시각 피해 실행. 배치 C는 5화면이라 리뷰 5+verify로 규모 적정
- 배치B 패턴 학습: 라이트모드 골드/회색-온-화이트 대비(2.1~2.9:1)가 반복 P1 클래스 — `getLayoutColor`/`secondary-600`/`content-onGold` 토큰이 이미 존재하나 하드코딩으로 우회됨(HomeTabBar는 토큰 사용=정답 레퍼런스) / 룰27 size 22는 코드베이스 만연(탭바·헤더·메뉴) → Z 패스에서 전역 grep `size={22}` 일괄 점검 권장 / 골드 위 텍스트·아이콘은 `content-onGold`(#09090B)가 SSOT
- 작업 위치: 워크트리 `C:\Users\user\Desktop\T-HOLDEM-design-loop` 브랜치 `design/ui-ux-consistency-loop` (node_modules 정션 연결됨). 메인 체크아웃의 `docs/design-loop/`는 untracked 사본 — 회차 종료 시 양쪽 동기화할 것
- 워크플로 리뷰 프롬프트·스키마 재사용 가능: `C:\Users\user\.claude\projects\C--Users-user-Desktop-T-HOLDEM\777c7133-6090-41e5-aff1-03448744ff33\workflows\scripts\batch-a-design-review-wf_5c40c68f-2bb.js` (GROUPS만 교체)
- 패턴 학습: 시맨틱 토큰 우선(`content-*`는 dark: 불필요) / active: pressed 관례 32곳 / 장식 요소는 accessibilityElementsHidden+importantForAccessibility 쌍 / 카피 변경 전 e2e 셀렉터 grep 필수
