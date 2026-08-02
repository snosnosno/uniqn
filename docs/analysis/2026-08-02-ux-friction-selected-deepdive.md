# 선별 14항목 심층 분석 — 근본원인·수정설계 (2026-08-02)

> 1차 감사(`2026-08-02-employer-seeker-ux-friction-audit.md`)에서 사용자가 고른 항목만 재분석.
> 방법: 7묶음 병렬 심층(opus/xhigh — 재현 → 경쟁가설 3+ → 코드로 기각 → 인과사슬 → 수정설계) → 묶음별 적대적 검증(fable/xhigh — 인용 재확인·숨은 제약·난이도 재조정).
> 기준 커밋 `75d4b3fe4`. 코드 변경 0건. 제외: CSV 내보내기, 구인자 온보딩.


| ID | 주장 | 심사 | 설계 | 난이도 | 마이그 |
|---|---|---|---|---|---|
| `bookmark-no-list` | 사실 | CONFIRMED | 수정필요 | M→M | 불필요 |
| `report-status-untrackable` | 사실 | CONFIRMED | 수정필요 | M→L | 필요 |
| `job-updated-says-nothing` | 사실 | CONFIRMED | 실행가능 | M→M | 필요 |
| `B-1` | 사실 | CONFIRMED | 수정필요 | S→S | 불필요 |
| `B-2` | 부분사실 | CONFIRMED | 실행가능 | S→S | 불필요 |
| `B-3` | 부분사실 | CONFIRMED | 수정필요 | M→M | 불필요 |
| `fixed-posting-no-unconfirm` | 사실 | CONFIRMED | 실행가능 | S→S | 불필요 |
| `cancel-request-no-withdraw` | 사실 | CONFIRMED | 수정필요 | L→L | 필요 |
| `venue-no-delete` | 사실 | CONFIRMED | 수정필요 | L→L | 필요 |
| `notification-delete-no-confirm` | 사실 | CONFIRMED | 수정필요 | M→M | 불필요 |
| `apply-submit-disabled-silent` | 사실 | CONFIRMED | 수정필요 | S→M | 불필요 |
| `applicant-confirm-disabled-silent` | 사실 | CONFIRMED | 수정필요 | M→M | 불필요 |
| `schedule-sheet-confirm-disabled-silent` | 사실 | CONFIRMED | 실행가능 | S→M | 불필요 |
| `biometric-switch-disabled-silent` | 부분사실 | CONFIRMED | 실행가능 | S→S | 불필요 |
| `venue-chip-unselected-silently-unlinked` | 부분사실 | CONFIRMED | 수정필요 | M→M | 불필요 |
| `venue-settlement-detail-amount-mismatch` | 사실 | CONFIRMED | 실행가능 | S→S | 불필요 |
| `applicant-reputation-invisible` | 부분사실 | PARTIAL | 수정필요 | L→L | 필요 |
| `role-level-fill-invisible` | 부분사실 | CONFIRMED | 수정필요 | M→M | 불필요 |
| `preset-no-delete-rename` | 부분사실 | CONFIRMED | 수정필요 | M→M | 불필요 |
| `posting-no-duplicate` | 부분사실 | PARTIAL | 수정필요 | S→M | 불필요 |


---

# A-죽은회로


## `bookmark-no-list` — 북마크 목록 화면 부재 — 저장은 되는데 되돌아갈 문이 없다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→M · **마이그레이션**: 불필요

### 근거 (실측)
기준 커밋 75d4b3fe4 에서 직접 Read·grep 함.
· `uniqn-mobile/src/hooks/useBookmarks.ts:7` — 파일 헤더에 저자가 직접 남긴 표식: `@todo 북마크 목록 화면 구현 필요 (프로필 탭 또는 설정에서 "내 북마크" 페이지 추가)`.
· `useBookmarks.ts:102-112` addBookmark → `addToast({type:'success', message:'북마크에 추가되었습니다'})` + `trackEvent('bookmark_added', {job_id})`. 132-153 toggleBookmark 도 동일 토스트/퍼널.
· `useBookmarks.ts:166-175` 훅이 8개 API(bookmarks·bookmarkCount·recentBookmarks·isBookmarked·toggleBookmark·addBookmark·removeBookmark·clearBookmarks)를 반환하는데, 전 레포에서 실제로 소비되는 건 2개뿐이다.
· `uniqn-mobile/src/components/jobs/JobCard.tsx:8,36,38,48-63,104-133` — 유일한 소비처. `const { isBookmarked, toggleBookmark } = useBookmarks();` 로 하트 채움과 토글만 쓴다. 나머지 6개 API 소비처 0.
· `uniqn-mobile/src/stores/bookmarkStore.ts:65-145` — zustand persist, `name:'bookmark-storage'`, `storage: createJSONStorage(() => mmkvStorage)`. 즉 **기기 로컬 MMKV** 저장이다. 저장 스냅샷은 `{id,title,location,workDate,bookmarkedAt}`(:17-28)뿐이고 status 가 없다.
· `bookmarkStore.ts:59,83-92` — MAX_BOOKMARKS=100, 초과 시 가장 오래된 항목을 **무음 축출**(logger.warn 만).
· app/ 전역 `북마크` grep 1건 = `app/(app)/applications/[id]/cancel.tsx:4` 의 "레거시 딥링크/북마크 호환" 주석(브라우저 북마크 뜻, 무관).
· `uniqn-mobile/supabase/migrations/` 64개 파일 전체에서 bookmark|saved_posting|favorite **0건**.

### 근본 원인
미완성이다. 근거 셋. (1) 훅 파일 첫 문단의 `@todo` 가 "목록 화면이 없다"를 저자가 스스로 명시한다 — 의도적 제약이라면 이렇게 쓰지 않는다. (2) `trackEvent('bookmark_added'/'bookmark_removed')` 계측을 심어 두었다 — 측정할 화면이 뒤따를 것을 전제한 설계다. (3) `git log --all -S"bookmark" -- uniqn-mobile/app` 이 0 커밋 → 화면이 있었다가 지워진 잔해가 아니라 **애초에 만들어진 적이 없다**. 스토어·훅·아이콘·토스트·퍼널까지 다 깔아 두고 마지막 한 칸(화면+진입점)만 비었다.

### 인과사슬
공고 카드 하트 탭 → `JobCard.tsx:57 handleBookmarkClick` → `:48 handleBookmarkPress` → `useBookmarks.ts:132 toggleBookmark` → `bookmarkStore.ts:109 toggleBookmark` → `:73 addBookmark` 가 MMKV 키 'bookmark-storage' 에 `{id,title,location,workDate,bookmarkedAt}` 스냅샷을 적재 → `useBookmarks.ts:145-149` 가 '북마크에 추가되었습니다' 토스트 + 퍼널 발화. 여기까지가 회로의 전부다. 이 배열을 읽는 코드는 같은 카드의 `isBookmarked`(하트 채움) 하나뿐이므로, 사용자는 저장 확인 피드백을 받고도 그 목록에 도달할 경로가 없다. 인과는 여기서 끝나지 않는다 — 100건을 넘기면 `bookmarkStore.ts:83-92` 가 가장 오래된 항목을 조용히 버리는데, 목록 화면이 없으니 **무엇이 사라졌는지 확인할 방법 자체가 없다**. 즉 증상은 '화면 없음'이지만 결함은 '쓰기만 있고 읽기가 없는 저장소'다.

### 파급 범위
· 렌더 소비처가 `JobCard.tsx` 1곳뿐 → 화면 신설은 기존 경로를 전혀 건드리지 않는다(회귀 위험이 구조적으로 낮다).
· 진입점 후보는 `app/(app)/(tabs)/profile.tsx:178-233` 의 Card 안 MenuItem 목록(구인자 신청·라이브 대회 운영·내 평점·리뷰 이력·커뮤니티·설정센터·고객센터). 자리가 이미 마련돼 있다.
· MMKV 로컬이라 기기 교체·앱 재설치·웹↔앱 사이에 승계되지 않는다. '저장한 공고'라는 사용자 기대와 어긋나는 지점.
· 저장 스냅샷에 status 가 없다 + RLS `job_postings_select_all`(baseline:13592)·`jp_select_public_search`(:13636)가 approved/active/capacity_full/closed 만 허용 → **cancelled 공고는 재조회 시 결과에서 사라진다**. 목록 화면은 '누락 id' 를 반드시 다뤄야 한다.
· `JobPostingRepository.getByIdBatch`(:351-371)가 이미 존재하고 `.neq('status', CONTAINER)` 로 컨테이너를 걸러 준다 — 새 리포지토리 메서드가 필요 없다.

### 기각한 경쟁 가설
(b) 다른 화면이 이미 제공 중이다 → 기각. app/ 전역 '북마크' grep 1건(무관 주석), '관심 공고'·'찜'·'저장한 공고'·'스크랩' grep 은 `useBulkShare.ts:106`·`bulkJobShareMessage.ts:178,194` 의 '카톡 스크랩' 주석뿐. `useBookmarks`/`useBookmarkStore` import 는 JobCard 와 테스트 2개가 전부다.
(c) 의도적 플래그 게이트로 숨겨 둔 것이다 → 기각. `src/constants/` 에 featureFlags 파일이 없고, bookmarkStore·useBookmarks 어디에도 게이트 분기가 없다. 이 레포에서 게이트가 걸린 기능은 `profile.tsx:28,74` 의 `useOpsHubEnabled()` 처럼 훅으로 명시되는데 북마크엔 그런 배선이 0이다.
(d) 리팩터링 잔해 — 화면이 있다가 삭제됐다 → 기각. `git log --all -S"bookmark" -- uniqn-mobile/app` 0 커밋.
(e) 서버 저장이라 목록은 다른 표면에서 본다 → 기각. 마이그레이션 64개에 bookmark 계열 테이블·RPC·컬럼 0건. 저장소는 MMKV 단일.

### 수정 설계
1) 신규 화면 `uniqn-mobile/app/(app)/bookmarks.tsx` — `app/(app)/support/my-inquiries.tsx` 구조를 형판으로 삼는다: `SafeAreaView(edges=['top','bottom'])` + `StackHeader title="저장한 공고" fallbackHref="/(app)/(tabs)/profile"` + 리스트 + 빈 상태.
2) 신규 훅 `uniqn-mobile/src/hooks/useBookmarkedPostings.ts` — `useBookmarks().bookmarks` 에서 id 배열을 뽑아 `useQuery({ queryKey: [...queryKeys.jobPostings.details(), 'bookmarked', ...ids], queryFn: () => jobPostingRepository.getByIdBatch(ids), enabled: ids.length > 0, staleTime: queryCachingOptions.jobPostings.staleTime })`. TanStack 읽기 전용이므로 Repository 직접 호출이 규약상 허용된다. 선례: `src/hooks/useReviews.ts:339-354` 가 동일 패턴(`getByIdBatch` → Map 구성).
3) 조회 결과를 `toJobPostingCard`(`src/domains/job-posting/projections.ts:197`)로 매핑해 기존 `JobList`(`src/components/jobs/JobList.tsx:35`)에 그대로 넘긴다. `filledCounts`·`applicationStatuses` 는 옵셔널(:22-24)이라 미전달해도 칩만 빠지고 깨지지 않는다. 카드·하트·공유가 전부 재사용된다.
4) 누락 id 처리 — 조회 결과에 없는 북마크 id(취소·삭제 공고)를 자동 삭제하지 말 것(사용자 데이터 무음 유실). 목록 하단에 "더 이상 볼 수 없는 공고 N건" 안내 + '정리하기' 버튼 → `useBookmarks().removeBookmark(id)` 를 명시적으로 호출.
5) 진입점 — `app/(app)/(tabs)/profile.tsx` 의 Card 안 '내 평점·리뷰 이력' MenuItem 위에 추가: `icon={<HeartOutlineIcon size={20} color={SECONDARY_PALETTE[500]} />}`, `label="저장한 공고"`, `onPress={() => router.push('/(app)/bookmarks')}`. `HeartOutlineIcon` 은 `@/components/icons` 에 이미 있다(JobCard 가 쓰는 그것).
6) 무음 축출 고지 — `bookmarkStore.ts:83-92` 의 100건 초과 축출은 목록 화면이 생기는 순간 눈에 띄는 결함이 된다. `useBookmarks.ts:102 addBookmark` 가 축출 발생을 감지해(추가 전 `bookmarks.length >= 100` 확인) `addToast({type:'info', message:'저장 공고가 100건을 넘어 가장 오래된 항목이 삭제되었습니다'})` 를 띄운다.

### 리스크
· 실질 위험 1개: 북마크 목록 안에서도 `JobCard` 가 하트를 렌더하므로, 목록에서 하트를 끄면 zustand 구독 때문에 그 행이 **즉시 사라진다**. 애니메이션·되돌리기 없이 사라지면 오조작으로 읽힌다. 전역 impeccable §12(Undo > Confirm) 대로 5초 되돌리기 토스트로 완충할 것.
· `JobList` 의 `filledCounts`·`applicationStatuses` 미전달은 안전함을 코드로 확인했다(JobList.tsx:22-24 옵셔널, :58 `applicationStatuses?.get`).
· `getByIdBatch` 는 `.neq('status', CONTAINER)`(:363) 로 컨테이너를 배제한다 — 컨테이너는 공고 목록에 뜨지 않아 북마크될 일이 없으므로 무해.
· 기존 회귀 위험은 낮다: 북마크 소비처가 1곳이고 스토어·훅은 손대지 않는다(6번만 예외).

### 선행 의존성
없음. 단 진입점 배치가 `app/(app)/(tabs)/profile.tsx` 를 수정하므로, 같은 파일을 만지는 다른 작업(ops 허브 표면)과 충돌 가능 — 실행 원장 `docs/planning/2026-07-31-execution-session-prompts.md` 의 파일 충돌 핫스팟 확인 후 착수.

### 🔍 검증 — 놓친 제약
① bookmarkStore 는 zustand persist(MMKV)라 하이드레이션 완료 전 목록 화면이 렌더되면 bookmarks=[] 로 '저장한 공고 없음' 빈 상태가 잠깐 오탐된다 — 스토어에 이미 있는 `_hasHydrated`(bookmarkStore.ts:34,127-129) 게이트를 화면에서 소비해야 하는데 설계에 빠졌다. ② 무음 축출 고지(fix 6)의 배선 지점이 틀렸다: `useBookmarks.addBookmark`(:102)에 넣겠다고 했지만 실제 UI 유일 경로는 JobCard→`toggleBookmark`(:132) — addBookmark 는 소비처 0인 죽은 API 라 그 위치의 토스트는 영원히 안 뜬다. ③ Undo 토스트는 타입상 지원됨(toastStore.ts:23-26 `action?: {label, onPress}`)을 확인했으나 실제 Toast UI 컴포넌트가 action 버튼을 렌더하는지는 실기 관찰 필요. ④ e2e 충돌 없음(profile 메뉴를 단언하는 스펙 없음, support-faq.spec 만 testID 사용), 기능 플래그 없음(src/constants 에 featureFlags 파일 부재 실확인) — 기각가설 (c)의 검증은 타당.

### 🔧 검증 — 설계 보정
① fix 6 재배선: 축출 감지는 store `addBookmark` 반환값(evicted 여부)으로 올리거나, 훅의 `toggleBookmark` 추가 분기(:144-150)에서 `bookmarks.length >= 100` 를 검사하라 — 설계 문구 그대로면 실경로에서 죽은 코드다. ② 신규 화면에 `useBookmarkStore(s => s._hasHydrated)` 게이트 추가 — false 면 Skeleton(impeccable §16), 빈 상태 판정은 하이드레이션 후에만. ③ queryKey 의 ids 스프레드는 정렬해서 넣어라(`[...ids].sort()`) — 형판으로 지목한 useReviews.ts:337 도 `.sort()` 를 한다. 미정렬이면 순서만 바뀌어도 배치 전체 재조회. ④ 사소한 사실 정정: migrations *.sql 은 64개가 아니라 63개(bookmark 계열 0건은 맞음), app/ 의 bookmark 계열은 한글 '북마크' 1건 외에 `app/(employer)/my-postings/create-success.tsx:14,101` 의 `BookmarkOutlineIcon` 장식 사용 1곳이 더 있다(기능 무관, 결론 불변). 진입점 Card 는 profile.tsx:179-234(주장 178-233과 사실상 동일).

### 검증 메모
핵심 근거 전수 재확인: @todo 헤더(useBookmarks.ts:7)·8개 API 중 2개만 소비(JobCard.tsx:36 + 테스트 목)·MMKV 로컬 저장 스냅샷에 status 부재(bookmarkStore.ts:17-28)·100건 무음 축출(:83-92, logger.warn 만)·RLS 가 cancelled 를 숨김(baseline:13592 job_postings_select_all·:13636 jp_select_public_search, 이후 정책 변경 마이그 0건)·getByIdBatch 의 `.neq(status, CONTAINER)`(:363) 전부 사실. git 고고학도 재검증: 대소문자 무시 pickaxe(-i --pickaxe-regex)로도 app/ 에 북마크 화면이 존재했던 커밋 없음(히트 2건은 아이콘 장식·레거시 주석). JobList 옵셔널 props(:22-24,:58)와 TanStack+Repository 직접 호출 규약 허용(선례 useReviews.ts:348)도 확인 — 수정설계의 골격은 견고하고 위 3건만 보정하면 실행 가능. 난이도 M 적정.

### 🙋 사람이 결정할 것
북마크를 기기 로컬(MMKV)로 유지할 것인가, 서버(예: `posting_bookmarks(user_id, job_posting_id, created_at)` + RLS `user_id = auth.uid()`)로 승격할 것인가. 승격하면 기기 교체·웹↔앱 승계가 되고 100건 상한도 없앨 수 있지만 마이그레이션·RLS·오프라인 동기화가 새로 생긴다. 화면 자체는 어느 쪽이든 같은 구조라 **먼저 로컬로 출하하고 나중에 저장소만 교체**해도 되지만, 저장소 승격을 나중에 하면 기존 로컬 북마크 이관 로직이 추가로 필요하다. 제품 오너 결정.


## `report-status-untrackable` — 내 신고 내역 화면 부재 — 게다가 REPORT_RESOLVED 알림은 발신자가 0이다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→L · **마이그레이션**: 필요

### 근거 (실측)
주장은 사실이고, 실제 상태는 주장보다 나쁘다. REPORT_RESOLVED 알림도 **한 번도 발송되지 않는다**.
· `uniqn-mobile/src/services/admin/reportService.ts:108-113` `getMyReports()` → `requireCurrentUser()` → `reportRepository.getByReporterId(user.id)`.
· `uniqn-mobile/src/repositories/supabase/ReportRepository.ts:91-93` → `:270-293 queryReports('reporter_id', value, ...)` = `.select(TABLE_COLUMNS).eq('reporter_id', value).order('created_at', {ascending:false})`. 동작 가능한 정상 쿼리다.
· `uniqn-mobile/src/lib/queryClient.ts:407` `myReports: () => [...queryKeys.reports.all, 'myReports']`.
· 소비처 전수 grep(`src/`·`app/`·`e2e/`): `reportService.ts:108,201`, 배럴 `src/services/index.ts:36`, 테스트 `src/services/admin/__tests__/reportService.test.ts:12,297-314`. **화면·훅 0건**. `myReports` 쿼리키는 정의 라인 1곳 외 소비 0건.
· RLS 는 허용한다 — baseline `20260710000002_baseline_schema_from_prod.sql:13943`: `CREATE POLICY rep_select ON public.reports FOR SELECT USING (((reporter_id = (SELECT auth.uid())) OR ((SELECT public.get_my_role()) = 'admin')))`. 이후 마이그레이션에서 `rep_*` 정책을 바꾼 파일 0건(grep 결과는 `20260713010000` 의 board_reports 건뿐).
· `review_report` RPC(baseline:8807-8850)는 권한 검사 → 상태 검증 → `UPDATE public.reports SET status/reviewer_id/reviewer_notes/reviewed_at` 이 전부다. **notifications INSERT 가 없다.**
· reports 트리거 3개(baseline:12212,12219,12226) = `report_notify_insert`(AFTER INSERT), `reports_updated_at`, `reports_xss_check`. UPDATE 알림 트리거 없음.
· `notify_on_report_insert`(baseline:5079-5133)는 `FROM public.users u WHERE u.role = 'admin'` — **관리자에게만** 간다. 신고자에겐 아무것도 없다.
· `report_resolved` 문자열 전수: 클라 수신측 5곳(`src/types/notification.ts:94,217,295,477` · `src/constants/notificationTemplates.ts:290-295` · `src/components/notifications/NotificationIcon.tsx:89` · `src/shared/deeplink/NotificationRouteMap.ts:97`) + EF `supabase/functions/send-push-notification/typeCategoryMap.ts:56`. **마이그레이션 64개에 0건 = 생산자 0.**
· 약속 문구: `src/types/inquiry.ts:326` FAQ "접수된 신고는 관리자가 검토 후 … **처리 결과는 앱 내 알림으로 안내드립니다**". `src/components/employer/ReportModal.tsx:413` "신고 내용은 관리자가 검토 후". 제출 피드백은 `src/components/schedule/useOwnerReport.ts:77` 토스트 '신고가 접수되었습니다.' 뿐.

### 근본 원인
두 결함이 겹쳐 있다. (1) `getMyReports` 는 **설계 누락**이다 — `getByJobPostingId`/`getByTargetId`/`getByReporterId` 3형제를 Repository 대칭성으로 만들면서 앞의 둘만 소비처를 얻었다. `git log --all -S"getMyReports" -- uniqn-mobile/app uniqn-mobile/src/hooks` 가 **0 커밋** → 화면·훅이 붙었다 떨어진 게 아니라 한 번도 붙은 적이 없다. (2) REPORT_RESOLVED 는 **Firebase→Supabase 이식 잔해**다. `notify_on_report_insert` 의 COMMENT(baseline:5141)가 스스로 "Firebase onReportCreated 대체"라고 밝히는 반면, 검토 완료 쪽(onReportReviewed 상당)의 대체물이 없다. 수신측 배선(타입·템플릿·아이콘·라우트맵·EF 카테고리)만 1:1로 옮겨오고 발신측이 남겨졌다.

### 인과사슬
사용자가 근무 상세 시트 → `useOwnerReport.open`(`src/components/schedule/useOwnerReport.ts:46`) → `ReportModal` 제출 → `createReport`(`reportService.ts:40`) → `create_report` RPC → `reports` INSERT → 트리거 `report_notify_insert` 가 `notify_on_report_insert` 를 돌려 **관리자 전원에게만** `new_report` 알림. 사용자는 `useOwnerReport.ts:77` 의 '신고가 접수되었습니다.' 토스트를 보고 모달이 닫히면(:79) 그걸로 끝이다.
이후 관리자가 `app/(admin)/reports/[id]` 에서 처리 → `reviewReport`(`reportService.ts:132`) → `reviewWithTransaction`(`ReportRepository.ts:231`) → `review_report` RPC → `reports.status = 'resolved'|'dismissed'` UPDATE. 이 UPDATE 를 듣는 알림 트리거가 없고, RPC 본문도 알림을 만들지 않는다. 동시에 신고자가 자기 신고를 조회할 화면도 없다.
결과: 신고자는 접수 이후 상태를 **영구히 알 수 없다** — 검토 중인지, 처리됐는지, 기각됐는지. `REPORT_STATUS_LABELS`(`src/types/report.ts:211-216`)에 '검토 대기/검토 중/처리 완료/기각' 4상태가 정의돼 있지만 사용자에게 이 값을 보여주는 경로가 0이다. 그리고 FAQ(`src/types/inquiry.ts:326`)는 "처리 결과는 앱 내 알림으로 안내드립니다"라고 명시적으로 약속하고 있다 — 단순 기능 누락이 아니라 **문서화된 약속의 불이행**이다.

### 파급 범위
· 화면 신설은 소비처 0이라 기존 렌더 경로 무영향.
· 알림 트리거 신설은 파급이 있다 — `app/(admin)/reports/[id]` 의 처리 액션이 실사용자에게 푸시를 쏘게 된다. `e2e/tests/p0-critical/admin-report-resolution.spec.ts` 가 이 경로를 돈다(해당 스펙에 알림 단언은 없음 — '알림' grep 1건은 :39 온보딩 스킵).
· **프라이버시가 이미 새고 있다**: `rep_select` 는 신고자에게 행 전체를 준다. `ReportRepository.TABLE_COLUMNS`(:40-41)에 `reviewer_id, reviewer_notes, severity` 가 포함돼 있으므로 관리자 내부 메모가 **지금도 PostgREST 로 읽힌다**. 화면을 만들면 '이미 새는 것'이 '보이는 것'이 된다 — 새로 새는 게 아니라는 점이 중요하다(설계 결정을 회피하지 말 것).
· 재사용 후보 `src/components/admin/ReportCard.tsx` 는 심각도·상태·유형·설명·신고자→피신고자·공고명·경과시간을 렌더한다. 신고자 화면에 그대로 쓰면 내부 트리아지 값(심각도)까지 노출된다.
· 진입점 후보 `app/(app)/support/index.tsx:88-113` 의 Card — '자주 묻는 질문 / 1:1 문의하기 / 문의 내역' 3개 MenuItem 구조가 이미 있고 `badge` prop 도 배선돼 있다(:56-61).

### 기각한 경쟁 가설
(a) RLS 가 본인 신고 SELECT 를 막아서 의도적으로 화면을 안 만들었다 → 기각. baseline:13943 `rep_select` 가 `reporter_id = auth.uid()` 를 명시적으로 허용하고, 이후 마이그레이션에서 `rep_*` 정책을 건드린 파일이 0건이다. `getMyReports` 는 지금 붙이면 그대로 동작한다.
(b) REPORT_RESOLVED 알림이 이미 대체 경로를 제공한다 → 기각. `report_resolved` 를 INSERT 하는 SQL 이 마이그레이션 64개 어디에도 없고 `review_report` RPC 본문(baseline:8807-8850)에도 없다. 수신측 5곳 + EF 1곳은 전부 죽은 배선이다.
(c) 관리자 화면(`app/(admin)/reports/`)이 있으니 충분하다 → 기각. `(admin)` 라우트 그룹은 admin 게이트라 신고자(staff/employer)는 진입 불가. CLAUDE.md 라우트 게이트 표대로다.
(d) 리팩터링 잔해다 → **부분 기각**. `getMyReports` 는 잔해가 아니라 한 번도 안 쓰인 신설물이다(`git log -S` 로 소비 커밋 0). 반면 REPORT_RESOLVED 수신측은 Firebase 이식 잔해가 맞다 — 두 결함의 성격이 다르므로 처방도 다르다.
(e) 신고는 민감해서 일부러 조용히 처리한다 → 기각. FAQ(`src/types/inquiry.ts:326`)가 "처리 결과는 앱 내 알림으로 안내드립니다"라고 반대로 약속한다.

### 수정 설계
**1단계 — 화면(당김)**
1) 신규 훅 `uniqn-mobile/src/hooks/useMyReports.ts` — `useQuery({ queryKey: [...queryKeys.reports.myReports(), user?.uid], queryFn: () => reportService.getMyReports(), enabled: !!user?.uid, staleTime: cachingPolicies.realtime })`. 형판은 `src/hooks/useInquiry.ts:54-74 useMyInquiries`.
2) 신규 화면 `uniqn-mobile/app/(app)/support/my-reports.tsx` — `app/(app)/support/my-inquiries.tsx` 구조 복제: `SafeAreaView(edges=['top','bottom'])` + `StackHeader title="신고 내역" fallbackHref="/(app)/support"` + `AppFlashList` + `EmptyState(title="접수한 신고가 없어요", description="근무 중 문제가 있으면 근무 상세에서 신고할 수 있어요.")`.
3) 카드 재사용 — `src/components/admin/ReportCard.tsx` 를 `src/components/report/ReportCard.tsx` 로 이동하고 `src/components/admin/index.ts` 에 re-export 를 남겨 admin 화면은 무변경. `showReporter?: boolean`(기본 true)·`showSeverity?: boolean`(기본 true) prop 을 추가해 신고자 화면에선 **둘 다 false** — 내 화면에서 '신고자→피신고자'는 자명하고, 심각도는 내부 트리아지 값이다.
4) 진입점 — `app/(app)/support/index.tsx` 의 Card 안 '문의 내역' MenuItem 아래에 `<Divider spacing="sm" />` + MenuItem 추가: `label="신고 내역"`, `description="접수한 신고의 처리 상태를 확인하세요"`, `testID="support-menu-my-reports"`, `onPress={() => router.push('/(app)/support/my-reports')}`, `badge` = status 가 'pending'|'reviewed' 인 건수. settings 가 아니라 support 인 근거: FAQ 의 신고 카테고리(`src/types/inquiry.ts:320-327`)와 1:1 문의가 이미 support 에 있고 '문의 내역'과 정확히 같은 성격이다.
5) 상세 화면은 1단계에서 만들지 않는다. 카드에 `REPORT_STATUS_LABELS`(`src/types/report.ts:211-216`) 배지만 노출하고 `reviewerNotes` 는 **렌더하지 않는다**.

**2단계 — 알림(밀기)**
6) 신규 마이그레이션 `uniqn-mobile/supabase/migrations/<ts>_notify_reporter_on_report_review.sql`:
   - `CREATE FUNCTION public.notify_on_report_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions','pg_temp'`
   - 조건: `OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('resolved','dismissed') AND NEW.reporter_id IS NOT NULL`
   - `INSERT INTO public.notifications(recipient_id, type, title, body, link, data, priority) VALUES (NEW.reporter_id, 'report_resolved', '신고 처리 완료', format('''%s'' 관련 신고가 %s되었습니다.', COALESCE(NULLIF(NEW.job_posting_title,''), '해당 공고'), CASE NEW.status WHEN 'resolved' THEN '처리' ELSE '기각' END), '/support/my-reports', jsonb_build_object('reportId', NEW.id, 'reportStatus', NEW.status), 'normal')`. **`reviewer_notes` 는 절대 싣지 않는다.**
   - `EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; RETURN NEW;` — 기존 알림 트리거들과 동일 패턴(baseline:5129).
   - `CREATE TRIGGER report_notify_review AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_review();`
   - `REVOKE EXECUTE ON FUNCTION public.notify_on_report_review() FROM PUBLIC, anon, authenticated;` — `20260731090000_revoke_public_execute_trigger_functions.sql` 와 같은 규율.
   - 적용 전 `node scripts/graph-db-deps.mjs triggers` 로 reports AFTER UPDATE 중복 검사(supabase-patterns §10).
7) `src/shared/deeplink/NotificationRouteMap.ts:97` 의 REPORT_RESOLVED 착지를 `() => ({ name: 'notifications' })` 에서 `() => ({ name: 'support/my-reports' })` 로 교체. 지금은 알림을 눌러도 알림 목록으로 되돌아온다(자기 자신으로의 착지). 짝 테스트 `src/shared/deeplink/__tests__/NotificationRouteMap.test.ts:158` 도 갱신.
8) `src/constants/notificationTemplates.ts:293` 의 `link: () => '/notifications'` 를 `'/support/my-reports'` 로 맞춘다(서버 알림엔 안 쓰이지만 계약 일관성).

### DB 변경
신규 마이그레이션 1개(2단계 한정). 내용: ① `notify_on_report_review()` 트리거 함수 신설 — SECURITY DEFINER + `SET search_path TO 'public','extensions','pg_temp'`(회귀 가드 `supabase/tests/parity_baseline_guard.test.sql:136-145` 가 pg_temp 누락 함수 0을 강제한다), ② `report_notify_review` AFTER UPDATE ON public.reports 트리거, ③ 신규 함수에 대한 `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. 테이블 스키마 변경·RLS 변경은 **없다** — `rep_select`(baseline:13943)가 이미 본인 신고 SELECT 를 허용하므로 1단계 화면은 마이그레이션 없이 동작한다. 기존 마이그레이션 수정 금지: `review_report` RPC 본문을 고치는 대신 트리거로 분리해야 관리자 콘솔 외 경로(직접 UPDATE·향후 자동 처리)도 함께 커버된다. 함수 수 +1 이므로 파리티 베이스라인 카운트 갱신 필요.

### 리스크
· `reports.reporter_id` 는 **nullable** 이다(baseline:10511). NULL 인 행이 처리되면 `notifications.recipient_id` NOT NULL 위반으로 INSERT 가 터진다 → WHERE 조건에 `NEW.reporter_id IS NOT NULL` 필수(설계에 반영함).
· 트리거 신설은 `report_notify_insert` 와 이벤트가 다르므로(INSERT vs UPDATE) supabase-patterns §10 의 중복 판정(같은 테이블+같은 타이밍+같은 이벤트)에 걸리지 않는다 — 그래도 `graph-db-deps.mjs triggers` 로 실측할 것. "중복_후보 0건 = 안전 확정"이 아니라는 규칙도 함께 적용.
· `e2e/tests/p0-critical/admin-report-resolution.spec.ts` 가 실제 알림 행을 만들게 된다. 스펙이 알림 개수를 단언하지 않으므로 red 는 안 나지만, 알림 카운터 가드(`20260731130000_notification_counter_insert_guard.sql`)와의 상호작용은 실측 확인 필요.
· `ReportCard` 를 admin→report 로 옮기면 import 경로가 바뀐다. `src/components/admin/index.ts` re-export 로 흡수하면 admin 화면·기존 테스트는 무변경.
· 상수·문구 변경이 아니므로 `e2e/` 별도 grep 리스크는 낮지만, `support-menu-*` testID 계열이 e2e 페이지 객체에 있는지는 확인할 것.

### 선행 의존성
2단계(6~8번, 알림 복구)는 1단계(2·4번, `/support/my-reports` 라우트)가 먼저 존재해야 `link` 가 유효하다 — **화면 먼저, 알림 나중**. 알림이 없는 화면은 반쪽이라도 쓸모가 있지만, 화면 없는 알림은 07-31 PR#365 에서 데인 '착지 없는 알림'의 재현이다.

### 🔍 검증 — 놓친 제약
① 딥링크 라우트는 닫힌 계약이다: `{name:'support/my-reports'}` 를 쓰려면 `src/shared/deeplink/types.ts` union 추가 + `RouteRegistry.ts`(EXPO_ROUTES) + `RouteMapper.ts` toExpoPath case + DB link '/support/my-reports' 를 유효 링크로 인정시킬 URL 파서(deepLinkRouteParser) + RouteMapper.test 갱신이 전부 필요하다. 설계는 NotificationRouteMap.ts:97 과 테스트 1개만 언급 — union 누락은 tsc 가 잡아주지만 파서 누락은 조용히 링크가 버려지고 라우트맵 폴백으로만 착지한다(getRouteFromNotification 은 parseDeepLink 가 인정한 링크만 쓴다 — deepLinkNavigationExecutor.ts:172-174 실확인). ② `src/components/admin/index.ts` 배럴은 존재하지 않는다(디렉토리 실측: ApprovalModal·ReportCard·announcements·stats 뿐) — 'index.ts 에 re-export 남겨 admin 무변경' 방안은 무효. 실제 import 는 app/(admin)/reports/index.tsx:24 한 곳뿐이다. ③ REPORT_RESOLVED 는 클라·EF 양쪽 category='admin'(notification.ts:217, typeCategoryMap.ts:56)인데 인앱 카테고리 탭에는 admin 탭이 없어(NotificationCategoryTabs.tsx:33-52 — 전체/지원/출퇴근/정산/공고/시스템) '전체' 탭에서만 보인다. EF 푸시 게이트는 fail-open(index.ts:114-138)이라 발송은 되며, INQUIRY_ANSWERED 가 같은 패턴으로 이미 운영 중인 선례가 있어 차단은 아니지만 설계가 이 축을 언급하지 않았다. ④ 안전 확인 완료 2건: notifications.type 은 CHECK 제약 없는 자유 text(baseline:10067-10081)라 'report_resolved' INSERT 안전, is_read 는 DEFAULT false NOT NULL(20260731130000)이라 신규 INSERT 는 카운터 +1 정상 — 리스크 항목의 '상호작용 실측 필요'는 정적으로 해소 가능.

### 🔧 검증 — 설계 보정
① 2단계 7번을 '딥링크 라우트 신설 체인'으로 확장: types.ts union + RouteRegistry(supportMyReports: '/(app)/support/my-reports') + RouteMapper case + 파서 경로 인식 + RouteMapper.test/NotificationRouteMap.test 갱신 — 약 5개 파일. ② ReportCard 이동의 하위호환은 배럴이 아니라 파일 단위로: `src/components/admin/ReportCard.tsx` 를 `export { ReportCard } from '@/components/report/ReportCard'` 한 줄 re-export 로 남기거나, 더 단순하게는 유일 소비처 app/(admin)/reports/index.tsx:24 의 import 한 줄을 고치면 끝이다(후자 권장). ③ 카테고리 결정을 설계에 명시: 신고자 수신 알림이 '관리자' 카테고리로 남는 것을 수용할지(INQUIRY_ANSWERED 선례 동일), 아니면 SYSTEM 으로 재분류할지 — 재분류 시 typeCategoryMap 드리프트 가드 테스트(src/services/notifications/internal/__tests__/typeCategoryMapDrift.test.ts)가 양쪽 동시 수정을 강제한다. ④ 사소한 라인 정정: reporter_id nullable 은 baseline:10512(주장 10511), 파리티 pg_temp 가드는 parity_baseline_guard.test.sql:134-144(주장 136-145). 파리티 함수 수 assertion 갱신은 설계에 이미 있음 — 유지.

### 검증 메모
주장 전체가 사실이고 '주장보다 나쁘다'는 판정도 재확인됨: review_report RPC(baseline:8807-8850)에 notifications INSERT 없음, reports 트리거 3개 중 UPDATE 알림 없음(:12212,12219,12226), notify_on_report_insert 는 admin 전용(:5124-5125)이며 COMMENT(:5141)가 'Firebase onReportCreated 대체'를 자인 — 검토 완료 쪽 대체물 부재라는 이식 잔해 진단 타당. rep_select(:13943)의 본인 SELECT 허용, TABLE_COLUMNS 의 reviewer_notes/severity 노출(ReportRepository.ts:40-41), FAQ 의 '앱 내 알림으로 안내' 약속(inquiry.ts:326), getMyReports 소비처 0(정의·배럴·테스트뿐), e2e 스펙의 알림 단언 부재(:39 온보딩 스킵 1건) 전부 실측 일치. 난이도는 M→L 상향: 화면 1단계(훅+화면+카드 이동+진입점 배지) + 마이그 1개(함수 신설·REVOKE·파리티 갱신·로컬 3경로 실측) + 딥링크 체인 5파일 + 테스트 3종은 단일 세션 M 을 넘는다 — 설계 자신이 제시한 '화면 먼저, 알림 나중' 순서대로 2 PR 분할 권장.

### 🙋 사람이 결정할 것
관리자 내부 메모(`reviewer_notes`)를 신고자에게 보여줄 것인가. 현재 `rep_select` 가 행 전체를 주므로 **지금도 API 로는 읽힌다** — 즉 '화면에 안 그린다'가 곧 비밀유지가 아니다. 정말 숨겨야 한다면 별도 조치(신고자용 뷰 신설 또는 `rep_select` 를 컬럼 제한 뷰 경유로 축소)가 필요하고, 이는 별도 마이그레이션이다. 반대로 '처리 사유를 알려주는 게 맞다'면 지금 구조 그대로 렌더하면 된다. 제품/법무 결정 사항이며, 이 판단 없이는 상세 화면(5번을 넘어서는 단계)을 설계할 수 없다.


## `job-updated-says-nothing` — 공고 변경 알림이 무엇이 바뀌었는지 말하지 않음 — payload 는 있는데 렌더 경로가 0

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 실행가능 · **난이도**: M→M · **마이그레이션**: 필요

### 근거 (실측)
· 현행 함수는 `uniqn-mobile/supabase/migrations/20260727000000_posting_auto_close_gaps.sql:413-524` 의 `CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()` 이다(baseline:4950 정의를 덮어씀). 트리거는 baseline:12149 `job_posting_notify_update AFTER UPDATE ON public.job_postings`.
· `:457-483` ELSE 분기에서 8개 컬럼을 비교해 **영어 camelCase** 를 적립: title / location / workDate / workDates / schedule / compensation / roleCatalog / postingType. (status 는 :484 주석대로 의도적 제외 — capacity_full 자동 전이 알림 폭탄 방지.)
· `:489-496` body = `format('''%s'' 공고가 수정되었습니다. 변경 내용을 확인하세요.', COALESCE(NEW.title, '공고'))` — **무엇이 바뀌었는지 한 글자도 없다**. priority 는 `:496` 에서 'normal' 고정.
· `:497-503` data = `jsonb_build_object('jobPostingId', …, 'jobPostingTitle', …, 'changedFields', array_to_string(v_changed_fields, ', '), 'senderId', …)` → 실제 값 예시 `"compensation, schedule"`.
· `:505-519` 수신자 = `applications.status IN ('confirmed','applied','cancellation_pending')` 전원.
· 클라이언트 `changedFields` grep: `src/`·`app/` **0건**(히트는 .sql 3파일뿐 — baseline, 20260727000000, archive/20260417030000).
· 렌더 계약: `src/components/notifications/NotificationItem.tsx:105` 가 `{notification.body}` 를 그대로 출력한다. `NotificationTemplates`(`src/constants/notificationTemplates.ts`)의 소비처는 `src/services/work/shiftReminderScheduler.ts:16` **하나뿐**(로컬 예약 알림) — 서버 알림 문구는 100% SQL 소관이다. 템플릿의 `JOB_UPDATED` body(:190)조차 `changedFields` 를 안 쓴다.
· 푸시: `supabase/functions/send-push-notification/index.ts:167` `body: notification.body` — DB 행을 그대로 트레이로 보낸다. `:161` `const priority = notification.priority === 'high' ? 'high' : 'default'`.
· 드리프트: `src/types/notification.ts:278` 은 `JOB_UPDATED: 'low'` 로 선언 — DB 가 쓰는 'normal' 과 불일치(해당 상수 소비처 0이라 런타임 영향은 없지만 계약이 갈라져 있다).

### 근본 원인
미완성 + 이식 잔해가 겹쳤고, 결정적으로 **지금까지 렌더할 이유가 없었다**. `changedFields` 는 Firebase 시절 payload(`supabase/migrations/archive/20260417030000_job_posting_notifications.sql:34,74~`)부터 있었고 Supabase 이식 때 그대로 왔지만 소비 클라 코드는 처음부터 없었다(`git log --all -S"changedFields" -- uniqn-mobile/src` **0 커밋**). 더 중요한 사실: 같은 파일 `:399-403` 주석이 밝히듯 이 트리거는 `v_changed_fields := v_changed_fields || 'title'` 의 `anyarray || anyarray` 오버로드 선택 때문에 `malformed array literal` 로 **항상 실패**했고 EXCEPTION 핸들러가 삼켜 prod `job_updated` 누적 0건이었다. 07-27 에 `array_append` 로 복구했지만 **문구 개선은 그 PR 의 스코프가 아니었다**. 즉 payload 를 렌더하지 않은 건 게으름이 아니라, 알림 자체가 나간 적이 없어 문제가 관측되지 않았기 때문이다.

### 인과사슬
사장이 공고 수정 저장 → `job_postings` UPDATE → 트리거 `job_posting_notify_update`(baseline:12149) → `notify_on_job_posting_update` 가 status 전이가 아니므로 ELSE 분기(:457)로 진입 → `OLD.compensation IS DISTINCT FROM NEW.compensation`(:474) 참 → `v_changed_fields = ['compensation']` → body 는 `'○○ 대회 딜러 모집' 공고가 수정되었습니다. 변경 내용을 확인하세요.`(:492), data.changedFields = `'compensation'`(:500), priority='normal'(:496) → `:506-519` 가 confirmed/applied/cancellation_pending 지원자 전원에게 INSERT → 푸시 EF 가 **같은 body** 를 트레이로 보내고(`index.ts:167`) `NotificationItem.tsx:105` 가 **같은 body** 를 목록에 그린다.
확정자 입장: 자기 일당이 바뀐 건지, 장소가 바뀐 건지, 사장이 오타를 고친 건지 구분할 수 없다. 공고 상세로 들어가 이전 값과 대조해야 하는데 **이전 값은 어디에도 남지 않는다**(job_postings 에 변경 이력 컬럼 없음, `modification_history` 는 work_logs 전용). 따라서 대조가 원리적으로 불가능하다. `changedFields` 는 DB 행에 실려 있지만 읽는 코드가 0이라 **관측 불가능한 상태로 버려진다**. 결함은 '문구가 짧다'가 아니라 '이미 계산된 정보를 전달 경로에서 폐기한다'다.

### 파급 범위
· 수신자 폭이 넓다 — 해당 공고의 confirmed/applied/cancellation_pending 지원자 전원(:519).
· **같은 함수가 job_cancelled(:431-443)·job_closed(:444-456) 도 담당한다**. 재정의 시 오타 하나로 취소·마감 알림까지 죽고, `EXCEPTION WHEN OTHERS`(:522-524)가 이를 WARNING 으로만 남긴다 → **실패가 조용하다**. 정확히 07-27 이전에 벌어진 사고 형태.
· `location` 은 jsonb 통째 비교(:462)라 하위 키가 하나만 늘어도 '장소 변경'으로 잡힌다. B1 주소검색(PR #391)이 `location` 하위 필드를 늘리고 기존 행을 백필한다면, 백필이 도는 순간 전 공고 지원자에게 '공고 수정' 알림이 대량 발사될 수 있다.
· `20260801100000_rename_default_venue_containers.sql` 는 title 을 바꾸지만 대상이 `status='container'` 이고 컨테이너엔 applications 가 0건이라 무해함 — 확인함.
· 클라 변경이 필요 없다는 점이 파급을 좁힌다: `NotificationItem`·`NotificationRouteMap`(:68-69 JOB_UPDATED 는 jobPostingId 로 공고 상세 착지)·`NotificationIcon` 모두 무변경.

### 기각한 경쟁 가설
(a) prod 엔 더 최신 정의가 있어 이미 상세 문구가 나간다 → 기각. `grep "FUNCTION public.notify_on_job_posting_update" supabase/migrations/*.sql` 결과는 baseline:4950(정의), `20260711100000_secdef_pg_temp_batch_and_overload_drop.sql:70`(ALTER search_path), `20260727000000:413`(CREATE OR REPLACE) 셋뿐. 20260727000000 이후 마이그레이션 12개 중 이 함수를 건드린 파일 0건.
(b) 클라가 템플릿으로 문구를 다시 조립한다 → 기각. `NotificationTemplates` 소비처는 `shiftReminderScheduler.ts:16` 하나(로컬 알림)이고, `NotificationItem.tsx:105` 는 DB body 를 그대로 렌더한다. 템플릿의 JOB_UPDATED body(:190)도 changedFields 를 안 쓴다.
(c) 필드명이 내부 구현이라 일부러 노출하지 않는다 → 기각. 그렇다면 payload 에 실을 이유가 없다. 게다가 같은 레포의 다른 트리거들은 **SQL 안에서 한글 라벨을 직접 만든다** — `notify_on_report_insert`(baseline:5085-5100)의 `v_type_label` CASE 12분기, `notify_on_work_log_update`(`20260731140000_notify_on_time_slot_change.sql`)의 `v_time_change_parts`. 'SQL 이 사람이 읽을 문장을 만든다'가 이 레포의 확립된 계약이다.
(d) 클라에서 렌더하는 쪽이 옳다 → 기각. 푸시 body 가 EF 에서 DB 행을 그대로 읽으므로(`index.ts:167`) 클라 렌더는 **인앱 목록만** 고치고 트레이 알림은 그대로 방치한다. 둘 다 고치려면 한글 라벨 맵이 SQL 과 TS 양쪽에 복제되는데, 이 레포가 반복해 데인 '판정 복제' 패턴이다(#388 이 같은 판정을 4곳에 복제해 회귀를 만든 이력).
(e) 리팩터링 잔해라 그냥 지우면 된다 → 기각. `changedFields` 는 이미 계산돼 있고 정확하다. 지울 게 아니라 소비할 것.

### 수정 설계
새 마이그레이션 **하나**로 끝낸다. 기존 `20260727000000_posting_auto_close_gaps.sql` 은 **수정 금지**(머지·적용 완료).
신규 파일 `uniqn-mobile/supabase/migrations/<ts>_job_updated_notification_detail.sql`:
1) `CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()` — **DROP 금지**. `20260731090000_revoke_public_execute_trigger_functions.sql:43` 이 이 함수의 PUBLIC EXECUTE 를 회수했는데 DROP 하면 기본 GRANT 로 되살아난다. 헤더는 `RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions','pg_temp'` 를 **그대로** 유지(`20260711100000:70` 의 하드닝이 proconfig 통째 교체로 날아간다; 회귀 가드 `supabase/tests/parity_baseline_guard.test.sql:136-145`).
2) 취소(:431-443)·마감(:444-456) 분기는 현행 그대로 **한 글자도 바꾸지 않고** 옮겨 적는다.
3) ELSE 분기에서 영어 키와 한글 라벨을 **함께** 쌓는다. `v_changed_labels text[] := ARRAY[]::text[];` 를 DECLARE 에 추가하고 각 IF 에서 `v_changed_labels := array_append(v_changed_labels, '급여')` 형태로 병행 적립.
   매핑: title→제목 / location→근무 장소 / workDate→근무일 / workDates→근무일 / schedule→근무 시간 / compensation→급여 / roleCatalog→모집 직무·급여 / postingType→공고 유형.
   ※ workDate 와 workDates 가 동시에 바뀌면 '근무일'이 두 번 들어가므로 라벨 배열은 중복 제거: `SELECT array_agg(DISTINCT lbl) INTO v_changed_labels FROM unnest(v_changed_labels) lbl;` (순서 안정성이 필요하면 적립 시 `IF NOT ('근무일' = ANY(v_changed_labels)) THEN` 가드).
4) body 교체: `format('''%s'' 공고의 %s이(가) 변경되었습니다. 확인해 주세요.', COALESCE(NEW.title, '공고'), array_to_string(v_changed_labels, '·'))` → 예: `'○○ 대회 딜러 모집' 공고의 급여·근무 시간이(가) 변경되었습니다. 확인해 주세요.`
5) priority 승격: `v_notif_priority := CASE WHEN v_changed_fields && ARRAY['compensation','roleCatalog','schedule','workDate','workDates'] THEN 'high' ELSE 'normal' END;`. 근거 — 이 5개는 지원자의 '갈 것인가' 판단을 바꾸는 축이고, EF(`index.ts:161`)가 'high' 만 Expo high priority 로 올린다. 제목·공고유형까지 high 로 올리면 알림 피로만 는다. 취소(high)·마감(normal) 분기의 기존 priority 는 유지.
6) data 는 **하위호환**으로 기존 `changedFields`(영어) 키를 그대로 두고 `changedFieldLabels`(한글, `array_to_string(v_changed_labels, ', ')`)를 추가한다. 기존 키를 바꾸면 이미 쌓인 알림 행과 계약이 갈라진다.
7) 클라이언트는 원칙적으로 무변경. 단 `uniqn-mobile/src/types/notification.ts:278` 의 `[NotificationType.JOB_UPDATED]: 'low'` 를 `'normal'` 로 맞춰 DB 와의 표기 드리프트를 제거한다(소비처 0이라 런타임 영향 없음 — 다음 사람이 속지 않게 하는 게 목적).
8) 검증 — 적용 전 `node scripts/graph-db-deps.mjs triggers` 로 job_postings AFTER UPDATE 중복 없음 확인. 적용 후 로컬(`npm run db:reset`)에서 ① compensation 만 바꾸는 UPDATE ② status→cancelled ③ status→closed 세 경로를 각각 실행하고 `notifications` 행의 body·priority·data 를 **실측**한다. 정적 파싱으로는 EXCEPTION 핸들러에 삼켜지는 실패를 못 잡는다 — 07-27 사고가 정확히 그 형태였다.

### DB 변경
신규 마이그레이션 1개. 내용 = `CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()` **전체 재정의**(취소·마감·수정 3분기를 통째로 옮겨 적어야 한다 — PL/pgSQL 은 부분 수정이 불가능). 테이블·RLS·트리거 정의 변경 없음(`job_posting_notify_update` 트리거는 그대로 이 함수를 가리킨다). 함수 수 불변이므로 파리티 카운트 영향 없음.
🔴 필수 제약 3가지: ① `SET search_path TO 'public','extensions','pg_temp'` 누락 시 `supabase/tests/parity_baseline_guard.test.sql:136-145` 가 red — proconfig 는 `CREATE OR REPLACE` 의 SET 절로 통째 교체되고, 정본은 baseline 이 아니라 `20260711100000_secdef_pg_temp_batch_and_overload_drop.sql:70` 의 ALTER 다. ② `DROP FUNCTION` 사용 시 `20260731090000:43` 의 EXECUTE 회수가 무효화된다. ③ 한글 라벨이 SQL 파일에 들어가므로 인코딩 사고 방지 — Edit/python 으로 작성(PS5 Set-Content 금지).

### 리스크
· **가장 큰 위험은 조용한 실패다.** 이 함수는 job_cancelled·job_closed 도 담당하는데 통째 재정의라 오타 하나로 취소 알림까지 죽고, `EXCEPTION WHEN OTHERS`(:522)가 이를 WARNING 으로만 남긴다. 07-27 사고가 정확히 이 형태(누적 0건인데 아무도 몰랐다). 재정의 후 3분기 각각을 실제 UPDATE 로 관측하는 것이 유일한 방어다.
· priority 'high' 승격은 Expo 푸시 우선순위를 실제로 올린다(EF `index.ts:161,174`). 대회사 D-7 집중 시즌에 급여·일정 조정이 잦으면 알림 피로가 늘 수 있고, 대상이 지원자 전원이라 폭이 넓다. 승격 축을 5개로 좁힌 이유가 이것이다.
· `location` jsonb 비교(:462)는 하위 키가 하나만 늘어도 '근무 장소 변경'으로 잡는다 — B1 주소검색이 기존 행을 백필하면 오탐 알림이 대량 발생한다(아래 dependencies 참조).
· 라벨 중복 제거를 빠뜨리면 workDate+workDates 동시 변경 시 '근무일·근무일'이 그대로 사용자에게 노출된다. 실제로 두 컬럼은 함께 갱신되는 경우가 흔하다.
· 클라 변경이 7번 한 줄뿐이라 tsc/lint/e2e 파급은 사실상 없다(해당 상수 소비처 0을 grep 으로 확인).

### 선행 의존성
B1(주소 검색, PR #391) 이 `job_postings.location` 을 백필하거나 기존 행을 재작성하는지 **확인이 선행돼야 한다**. 백필이 있다면 이 알림 개선을 먼저 넣을 경우 '근무 장소가 변경되었습니다' 오탐이 전 공고 지원자에게 대량 발사된다. 백필이 확인되면 ① 백필 트랜잭션에서 `ALTER TABLE public.job_postings DISABLE TRIGGER job_posting_notify_update` → 백필 → `ENABLE`, 또는 ② 세션 GUC 로 트리거 억제 분기를 두는 장치가 필요하다. 이 확인 없이는 머지 순서를 정할 수 없다.

### 🔍 검증 — 놓친 제약
① 'notification.ts:278 은 소비처 0이라 런타임 영향 없음' 주장은 틀렸다 — `NOTIFICATION_DEFAULT_PRIORITY` 는 notificationGrouping.ts:19,139 의 resolvePriority 폴백으로 실소비된다. 다만 용도가 'urgent 미읽음 상단 고정' 판정뿐이라 low→normal 변경의 행동 변화는 0 — 결론(안전)은 유지되나 근거가 부정확. ② 선행 조건이 이미 해소됐다: B1(#391, 33472d8be)은 기준 커밋 이전에 머지 완료됐고 마이그레이션 0건(git show --stat 실측) — location 백필이 없으므로 '머지 순서를 정할 수 없다'는 지금은 성립하지 않는다. 잔여 위험은 감사 후속 M9(주소 소거)·B2 등 향후 주소 작업이 location 을 재작성할 때이며, 그때 DISABLE TRIGGER 장치가 필요하다. ③ proconfig 정본 서술의 뉘앙스: 현행 정의(20260727000000:417)가 이미 인라인 `SET search_path TO 'public','extensions','pg_temp'` 로 재선언돼 있어 이 파일 헤더를 그대로 베끼면 충분하다 — 20260711100000:70 ALTER 를 별도로 추적할 필요는 없다(결과 지시는 동일하므로 무해). ④ NotificationItem 은 body 를 numberOfLines={2} 로 자른다(:101-106) — 라벨 5개가 동시에 붙는 긴 body 는 목록에서 잘릴 수 있으니 라벨 순서를 중요도순(급여·근무일 먼저)으로 적립할 것.

### 🔧 검증 — 설계 보정
① 선행 섹션을 갱신하라: 'B1 백필 확인'은 완료됐고(백필 없음 확정), 의존성은 '향후 location 재작성 작업(M9 주소 소거·B2)과의 순서 조율'로 바꿔 쓸 것 — 지금 바로 착수 가능하다. ② 소비처 0 정정 반영(위 ①). ③ 라벨 중복 제거는 `array_agg(DISTINCT ...)` 대신 적립 시 `IF NOT ('근무일' = ANY(...))` 가드를 기본으로 — DISTINCT 는 정렬 부작용으로 라벨 순서가 가나다순이 되어 중요도 순서 의도가 깨진다(설계가 이미 대안으로 적어둔 쪽을 기본으로 승격). ④ 검증 8번에 '20260731090000 의 EXECUTE 회수가 재정의 후에도 유지되는지 pg_proc ACL 재조회'를 추가 — CREATE OR REPLACE 는 ACL 을 보존하지만 실측 1회가 이 레포의 규율이다.

### 검증 메모
핵심 주장 전수 실측 일치: 현행 함수는 20260727000000:413-524(8필드 영어 camelCase 적립 :459-482, status 의도적 제외 :483, 무정보 body :491-494, priority normal 고정 :496, changedFields 를 data 에만 적재 :500, 수신자 3상태 전원 :517-519), 클라 changedFields 소비 0건(src/·app/·e2e/ Grep 도구로 재확인 — Bash grep app/ 함정 회피), NotificationItem.tsx:105 의 body 직렌더, NotificationTemplates 소비처는 shiftReminderScheduler.ts:16 단독(+constants 배럴 재수출뿐), EF 의 body 그대로 전달(:167)과 high 만 승격(:161), 07-27 '항상 실패' 고고학은 파일 주석(:399-405)이 자인, 함수 재정의 이력 3건뿐이고 이후 12개 마이그가 안 건드림, location jsonb(baseline:374) 통째 비교, 20260801100000 컨테이너 rename 무해 논거(:22 주석) 전부 사실. 기각가설 5개의 기각 논리도 검증됨 — 특히 (d) 'SQL 이 사람이 읽을 문장을 만든다' 계약은 notify_on_report_insert 의 12분기 한글 라벨(:5087-5101)로 실증. DROP 금지·pg_temp 유지·하위호환 data 키·priority 승격 축 5개 한정 등 설계의 위험 처리가 정확해 3건 중 가장 완성도 높음. 난이도 M 적정(SQL 통재정의 + 클라 1줄 + 로컬 3경로 실측).

### 🙋 사람이 결정할 것
급여·일정이 바뀌었을 때 확정자에게 '확인만' 시킬 것인가, **재동의/취소 경로**를 함께 열 것인가. 선례가 있다 — `20260731140000_notify_on_time_slot_change.sql` 은 출근 시각 변경 알림에 `applicationId` 를 실어 스케줄 상세 모달의 '취소 요청' 버튼까지 정밀 착지시키며, 그 파일 주석이 "무음 변경 금지의 짝은 거부할 수 있는 경로다"라고 원칙을 명시한다. 공고 급여 변경은 출근 시각 변경보다 파급이 크므로 같은 원칙을 적용해야 하는지가 제품 결정이다. 적용한다면 data 에 `applicationId` 를 실어야 하는데, 현재 INSERT 는 `SELECT DISTINCT a.applicant_id`(:511) 로 지원자 id 만 뽑으므로 행별 applicationId 를 함께 싣도록 SELECT 를 바꿔야 한다(추가 작업 S).



---

# B-프로필감옥


## `B-1` — 프로필 설정 화면에 로그아웃/이탈 출구가 전무 — 가드가 전 라우트에서 되돌려 보내 사실상 감옥

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: S→S · **마이그레이션**: 불필요

### 근거 (실측)
직접 읽은 근거를 인용 순서대로 적는다.

① `uniqn-mobile/app/(app)/profile-setup.tsx:83-86`
```tsx
// 뒤로가기 방지 (프로필 완성 필수)
const handleBack = useCallback(() => {
  toast.info('프로필을 완성해야 서비스를 이용할 수 있습니다.');
}, [toast]);
```
네비게이션 호출이 한 줄도 없다. 이 `handleBack` 은 `profile-setup.tsx:112-117` 에서 `SignupStepProfile` 의 `onBack` 으로만 전달되고, 그 컴포넌트는 `SignupStepProfile.tsx:423-425` 에서 `<Button onPress={onBack} variant="ghost">이전</Button>` 을 렌더한다. 즉 사용자가 보는 '이전' 버튼 = 토스트 1개.

② 화면 전체(1-122줄)에 `signOut` import 도, 호출도 없다. `import { completeProfile, checkNicknameExists, getUserProfile } from '@/services/auth';`(15줄) 이 auth 서비스에서 가져오는 전부다.

③ 헤더가 아예 없다 — `app/(app)/_layout.tsx:117-127` 의 `<Stack screenOptions={{ headerShown: false, ... }}>` 이고, `_layout.tsx:128-133` 은 profile-setup 에 대해 `gestureEnabled: false` 만 추가로 건다. 그래서 네이티브 헤더 백 버튼도, iOS 엣지 스와이프도 없다.

④ 안드로이드 하드웨어 백 인터셉트도 없다. 레포 전체 `BackHandler` grep 결과 앱 화면 사용처는 `app/(auth)/signup.tsx:304`, `src/components/employer/applicants/AddStaffModal.tsx:123`, `src/components/ui/TimeWheelPicker.tsx:645` 셋뿐 — profile-setup 은 없다.

⑤ 다른 화면으로 우회해도 되돌아온다. `src/hooks/useAuthGuard.ts:341-352`
```ts
if (isAuthenticated && authenticatedEntryRoute.includes('/profile-setup') && !isOnProfileSetup) {
  routerRef.current.replace(resolvedAuthenticatedRoute);
  return;
}
```
이고 `isOnProfileSetup` 은 `useAuthGuard.ts:172` 에서 `pathname === '/profile-setup' || pathname === '/(app)/profile-setup'` 로만 참이 된다.

⑥ 로그인 화면으로 직접 가도 튕긴다. `useAuthGuard.ts:298-310` 이 `(auth)` 그룹 + 인증됨이면 `replace(resolvedAuthenticatedRoute)` 를 실행하고, 예외는 `authenticatedEntryRoute.includes('/signup') && isOnSignup` 뿐이다. profileCompleted=false 의 진입 라우트는 `/(app)/profile-setup`(authRedirect.ts:117-121) 이라 이 예외에 걸리지 않는다.

⑦ 로그아웃이 있는 화면 3곳은 전부 가드 뒤에 있다: `app/(app)/(tabs)/profile.tsx:90-111`, `app/(app)/settings/index.tsx:104-122`, `app/(app)/settings/delete-account.tsx:98,188` — 모두 `(app)` 그룹이라 ⑤에 걸려 profile-setup 으로 replace 된다.

⑧ 앱을 껐다 켜도 같은 곳이다. `app/index.tsx:56-61` 이 `getAuthenticatedEntryRoute` 를 그대로 계산하고 `app/index.tsx:101-103` 에서 `router.replace(user ? authenticatedEntryRoute : AUTH_LOGIN_ROUTE)` 한다. 세션은 유지되므로 재부팅=재수감.

### 근본 원인
**리팩터링 잔해 + 설계 누락의 합성**이다. 근거는 git 이력이다.

`git log --diff-filter=A -- 'uniqn-mobile/app/(app)/profile-setup.tsx'` → **`1d7b2a950 refactor(mobile,functions): 회원가입 4단계→3단계 축소 및 프로필 분리`** 단 하나. 커밋 메시지: "고아 계정 문제 해결을 위해 … 기존 Step 4(프로필)를 제거하고 Step 3(본인인증) 완료 시 즉시 계정을 생성 … 프로필은 가입 후 앱 첫 진입 시 별도 화면에서 입력."

리팩터 **직전** 코드(`git show 1d7b2a950^:…/SignupForm.tsx`)에는
```tsx
case 4: // 프로필 (최종 제출)
  return <SignupStepProfile onNext={handleProfileSubmit} onBack={handleProfileBack} … />
```
가 있었다. 위저드 안에서는 `onBack` = "3단계로 돌아가기"라는 **의미가 있었다**. 위저드에서 떼어내 단독 화면으로 승격하면서 prop 시그니처는 그대로 두고 구현만 토스트로 바꿨다 — 같은 커밋의 `git show 1d7b2a950:…/profile-setup.tsx` 에 이미 `toast.info('프로필을 완성해야 서비스를 이용할 수 있습니다.')` 가 그대로 들어 있다.

즉 **'뒤로가기 차단'은 의도적이었지만(주석이 그렇게 말한다), '차단했으니 대신 다른 출구를 준다'는 후속 설계가 없었다.** 같은 문제를 형제 화면은 나중에 해결했다 — `app/(auth)/signup.tsx:249-296` 의 `handleBack` 이 social/reverify 모드에서 `confirmAction` → `signOut()` → `router.replace('/(auth)/login')` 을 하고, 주석(254-256줄)이 정확히 이 사고를 설명한다: "OAuth 세션이 이미 활성 상태라 router.back() 만으로는 useAuthGuard 가 미완성 프로필을 감지해 다시 이 화면으로 redirect 한다. 로그인 화면으로 진짜 빠져나가려면 명시적 signOut 필요." **패턴은 이미 레포 안에 있는데 profile-setup 만 적용을 못 받았다.**

### 인과사슬
원인 → 코드 경로 → 증상까지 끊지 않고 추적한다.

**[1] profileCompleted=false 가 만들어지는 지점 (질문 1)**
- DB 컬럼 기본값이 false: `supabase/migrations/20260710000002_baseline_schema_from_prod.sql:10647` → `profile_completed boolean DEFAULT false`.
- 트리거 `handle_new_user`(현행 정의 = `20260719233000_team_terminology_unification.sql:30-74`)는 `INSERT INTO public.users (id, email, name, role, social_provider)` 만 한다 — `profile_completed` 를 **명시하지 않으므로 DEFAULT false 로 굳는다.**
- 그 다음 Edge Function 이 덮어쓴다: `supabase/functions/verify-and-save-portone-profile/index.ts:245` `const trimmedNickname = nickname?.trim() || null;` → `:281` `profile_completed: Boolean(trimmedNickname)`.
- 그런데 **현재 가입 플로우는 닉네임을 보내지 않는다.** `app/(auth)/signup.tsx:5-7` 주석대로 순서가 약관→본인인증→계정이고, `SignupForm.tsx:24-26` 은 `SignupStepAccount / SignupStepIdentity / SignupStepTerms` 만 import 한다. 닉네임 단계가 없다 → `trimmedNickname === null` → **모든 신규 가입자가 예외 없이 profile_completed=false 로 생성된다.**
- 클라 반영: `signUp`(authCoreService) 이 EF 호출 후 `getUserProfile(user.id)` 로 재조회해 반환하고, `signup.tsx:82` `setProfile(toStoreProfile(result.profile))` 로 스토어에 넣는다. `profileConverter.ts:117` 이 `profileCompleted` 를 보존한다.
- true 로 바뀌는 유일한 경로: `src/services/auth/profileService.ts:315-357` 의 `completeProfile()` → `firestoreUpdates = { nickname, profileCompleted: true }`(322-325줄) → `userRepository.updateFields`(355줄). **소비처는 `profile-setup.tsx:54` 단 하나**(레포 전체 grep 결과).
- 가입 도중 실패 시 잔존 상태: EF 가 upsert 를 마쳤으면 `phone_verified/identity_verified=true, profile_completed=false` 인 완전한 users row 가 남는다. 이 상태가 정확히 profile-setup 수감 상태다.

**[2] 라우팅 판정 (질문 2)**
`src/shared/navigation/authRedirect.ts:92-124` `getAuthenticatedEntryRoute` 의 분기는 위에서부터 정확히 4개다:
1. `phoneVerified !== true && identityVerified === false` → socialProvider 유무에 따라 `signup` / `signup?mode=social` (101-103줄, 2026-05-16 reverify trap 안전망)
2. `socialProvider && phoneVerified !== true` → `signup?mode=social` (106-108줄)
3. `identityVerified === false` → `signup?mode=reverify` (113-115줄)
4. **`profileCompleted === false` → `/(app)/profile-setup`** (119-121줄)
5. 그 외 → `/(app)/(tabs)/home-jobs`
주목: 4번은 `=== false` 엄격 비교다. 레거시 사용자(NULL)는 통과한다(`authRedirect.test.ts:40` 이 이 계약을 잠근다).

`useAuthGuard.ts` 에서 profile-setup 으로 보내는 분기는 **두 곳**이다:
- `:341-352` — 라우트 그룹이 `(app)/(employer)/(admin)/(auth)` 중 하나이고 현재 위치가 profile-setup 이 아니면 replace. redirect 파라미터는 `buildPostAuthRedirectFromSegments(segments)`(154줄) 로 원래 목적지를 보존한다.
- `:274-292` — 웹 공개 별칭(`/jobs/:id`) 진입 시. `useAuthGuard.test.ts:285-303` 이 `'/(app)/profile-setup?redirect=%2F(app)%2Fjobs%2F123'` 로 잠가 놨다.
예외는 `:185-194`(isLoading / 비밀번호 복구 진입)와 `:201-235`(profile 이 아직 null → 재시도)뿐이고, 둘 다 profile 이 로드되면 사라진다.

**[3] 증상**
가입 마지막 화면에 도착한 사용자는 (a) 닉네임을 넣어 완성하거나 (b) 앱을 지우거나(웹이면 스토리지를 비우거나) 둘 중 하나만 할 수 있다. **계정을 잘못 만든 것을 이 화면에서 깨달아도 다른 계정으로 갈아탈 방법이 없다.** 실패가 지속되는 경우(네트워크·RLS·race) 에러 문구는 `profile-setup.tsx:75` 의 `'프로필 저장에 실패했습니다. 다시 시도해주세요.'` 뿐이고 다음 행동 선택지가 없다.

### 파급 범위
실제로 grep 해서 확인한 범위다.

**직접 영향 = 신규 가입자 100%.** 위 [1]에서 확인했듯 현재 플로우로 가입하면 profile_completed 가 항상 false 다. 즉 이 화면은 예외 경로가 아니라 **모든 사용자의 필수 통과 지점**이다.

**되돌려 보내지는 화면 = 인증 4개 그룹 전부.** `useAuthGuard.ts:40-59` 의 `ROUTE_CONFIGS` 키가 `(public)/(auth)/(app)/(employer)/(admin)` 이고, `:341-352` 은 routeGroup 이 non-null 이기만 하면 발동한다. 확인한 실제 화면: `(app)/(tabs)/profile`(로그아웃 있음), `(app)/settings/index`(로그아웃 있음), `(app)/settings/delete-account`(로그아웃 있음), `(auth)/login`, `(auth)/signup`, `(employer)/*`, `(admin)/*`.

**수정이 닿는 파일은 2개뿐이다.**
- `app/(app)/profile-setup.tsx` — 소비처 없음(라우트 파일).
- `src/components/auth/signup/SignupStepProfile.tsx` — **소비처가 profile-setup 하나뿐**임을 grep 으로 확정(B-2 참조).

**닿지 않는 것**: `useAuthGuard.ts` 를 손대지 않으므로 `src/hooks/__tests__/useAuthGuard.test.ts` 의 21개 케이스와 `src/shared/navigation/__tests__/authRedirect.test.ts` 는 무영향. `e2e/` 전체에 `profile-setup`·`'프로필 설정'`·`'나중에 입력하기'` 문자열이 **0건**이라 E2E 도 무영향(⚠️ 반대로 말하면 이 화면은 E2E 미보호 구간이다).

**역할 축**: UserRole 무관. `getAuthenticatedEntryRoute` 는 role 을 아예 읽지 않는다 — employer 로 가입한 사장도 profile_completed=false 면 `(app)/profile-setup` 에 갇힌다(`(app)` 그룹은 requiredRole 'staff' 이고 `RoleResolver.hasPermission` 위계상 employer > staff 라 통과한다).

### 기각한 경쟁 가설
경쟁 가설 5개를 세워 코드로 검증했고 3개를 기각했다.

**(a) 기각 — "다른 경로로 이미 로그아웃이 제공되고 있다"**
`app/` 전체 `signOut` grep 결과 4개 파일뿐: `(auth)/signup.tsx`, `(app)/(tabs)/profile.tsx`, `(app)/settings/index.tsx`, `(app)/settings/delete-account.tsx`. 뒤의 3개는 `(app)` 그룹이라 `useAuthGuard.ts:341-352` 에 걸려 도달 불가. 앞의 1개는 `(auth)` 그룹이라 `:298-310` 에 걸려 도달 불가. **전역 UI 에도 없다** — `app/_layout.tsx:208-210` 의 전역 오버레이는 `ToastManager / ModalManager / OfflineStatusBar` 뿐이고, `(app)/_layout.tsx:165-173` 의 `DeletionScheduledModal` 은 탈퇴 예약자 전용이라 일반 사용자에게 뜨지 않는다.

**(b) 기각 — "앱 재시작이나 딥링크로 빠져나갈 수 있다"**
재시작: `app/index.tsx:56-61` 이 같은 `getAuthenticatedEntryRoute` 를 계산해 `:101-103` 에서 replace 한다. 세션은 `supabase.auth` 에 영속되고 `authStore` 도 persist(`authStore.ts:136-145` partialize 에 user·profile 포함) 되므로 **재부팅이 곧 재수감**이다. 딥링크: 어떤 URL 로 들어와도 그룹이 붙는 순간 위 두 분기가 발동한다. 유일한 예외는 (c) 참조.

**(c) 부분 채택 → 별도 항목 B-3 으로 분리 — "`(ops)`·`(public)` 상세는 가드를 우회한다"**
`ROUTE_CONFIGS`(useAuthGuard.ts:40-59)에 `'(ops)'` 가 **없다**. `extractRouteGroup`(:71-79) 이 null 을 반환하고 `:237-294` 의 null 분기는 루트 경로/공개 별칭이 아니면 그냥 `return` 한다 → **`/(ops)/tournaments` 는 profile-setup 으로 안 튕긴다.** 하지만 `app/(ops)/` 아래 파일은 `_layout.tsx`, `tournaments/{index,new,[id]}.tsx` 4개뿐이고 signOut 이 하나도 없다. **탈출구가 아니라 가드 구멍**이므로 감옥 판정은 유지된다.

**(d) 기각 — "의도적 보안·정합성 제약이다"**
뒤로가기 차단 자체는 의도적이다(`profile-setup.tsx:83` 주석). 그러나 로그아웃 차단은 어떤 보안 목적도 달성하지 못한다 — 세션은 이미 발급됐고, 사용자는 앱을 지우거나(`웹은 storage 삭제`) 그냥 방치하면 된다. 오히려 형제 화면 `signup.tsx:257-281` 이 **똑같은 상황(활성 OAuth 세션 + 미완성 프로필)에서 signOut 출구를 명시적으로 제공**하고 있어, 프로젝트의 의도는 "출구 없음"이 아니라 "확인 후 로그아웃"임이 증명된다.

**(e) 기각 — "닉네임 중복이 무한 루프를 만든다"(원 주장 4번 항목의 과장)**
루프가 아니다. `profile-setup.tsx:46-51` 은 중복 시 `toast.error` 후 `setIsLoading(false); return;` 만 하고 화면·폼 상태를 파괴하지 않는다. `SignupStepProfile.tsx:117-125` 의 `handleNicknameChange` 가 타이핑 즉시 `nicknameStatus` 를 'idle' 로 되돌려 제출 버튼 disabled(`:403-408`)를 해제한다. 서버 축도 `users_nickname_key UNIQUE`(baseline_schema_from_prod.sql:11191, `20260712010100…sql:99-108` 이 파리티 보증) + `check_nickname_exists` RPC 이므로 **다른 닉네임을 넣으면 통과한다.** 게다가 닉네임은 나중에 바꿀 수 있다 — `app/(app)/settings/profile.tsx:153-179`. **원 주장 중 이 부분만 과장이고, 감옥의 원인은 중복 검사와 무관하다.**

### 수정 설계
두 파일만 고친다. 기존 `signup.tsx` 이탈 패턴을 그대로 복제한다.

---
**① `app/(app)/profile-setup.tsx` — 이탈 핸들러 신설**

import 추가:
```tsx
import { View, Text, Pressable } from 'react-native';
import { completeProfile, checkNicknameExists, getUserProfile, signOut } from '@/services/auth';
import { confirmAction } from '@/utils/confirmAction';
```
스토어 액션 추가(기존 `setProfile` 옆, 31줄 근처):
```tsx
const resetAuth = useAuthStore((s) => s.reset);
```
죽은 `handleBack`(83-86줄)을 **`handleExit` 으로 교체**:
```tsx
// 프로필 미완성 상태의 유일한 이탈구. 뒤로가기(router.back)는 useAuthGuard 가
// 즉시 이 화면으로 되돌리므로 반드시 명시적 signOut 이어야 한다
// (같은 이유의 선례: app/(auth)/signup.tsx:254-256).
const handleExit = useCallback(() => {
  // 저장 진행 중 이탈 금지 — completeProfile 과 signOut 의 race 차단
  // (signup.tsx:252 의 isLoading 가드와 동일).
  if (isLoading) return;

  confirmAction({
    title: '로그아웃할까요?',
    message:
      '프로필을 완성해야 공고 지원 등 서비스를 이용할 수 있어요.\n계정은 그대로 남아 있고, 다시 로그인하면 이 화면부터 이어서 진행합니다.',
    confirmText: '로그아웃',
    cancelText: '계속 작성',
    destructive: true,
    onConfirm: async () => {
      try {
        await signOut();
      } catch (error) {
        logger.warn('프로필 설정 이탈 signOut 실패', {
          component: 'ProfileSetupScreen',
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        // sessionService 의 onAuthStateChange 핸들러는 setTimeout(0) 로 지연 실행된다
        // (services/observability/sessionService.ts:119-125). replace 가 먼저 도착하면
        // authStore 에 user 가 남아 useAuthGuard:298-310 이 다시 profile-setup 으로 튕긴다.
        // 동기적으로 스토어를 비워 반동을 차단한다 (선례: (tabs)/profile.tsx:94-96).
        resetAuth();
        router.replace('/(auth)/login');
      }
    },
  });
}, [isLoading, resetAuth]);
```

**② `app/(app)/profile-setup.tsx` — 헤더 이탈 진입점 추가**
`SafeAreaView` 바로 아래, `KeyboardAwareScrollView` **위**에 헤더 행을 넣는다(스크롤과 무관하게 항상 보이도록). `signup.tsx:322-337` 헤더와 같은 골격이되 좌측 셰브론 대신 **우측 텍스트 버튼**을 쓴다 — 이 동작은 '뒤로'가 아니라 '로그아웃'이라 셰브론은 오해를 부른다:
```tsx
<View className="flex-row items-center justify-end px-4 py-2 border-b border-divider">
  <Pressable
    onPress={handleExit}
    disabled={isLoading}
    hitSlop={10}
    className={`min-h-[44px] justify-center px-2 -mr-2 ${isLoading ? 'opacity-40' : ''}`}
    accessibilityRole="button"
    accessibilityLabel="로그아웃하고 로그인 화면으로 이동"
    accessibilityState={{ disabled: isLoading }}
  >
    <Text className="text-sm font-sans-medium text-content-secondary dark:text-content-secondary">
      로그아웃
    </Text>
  </Pressable>
</View>
```
(터치 타깃 44px = impeccable 룰 5, `dark:` 명시 = CLAUDE.md 다크모드 규칙.)

**③ 죽은 '이전' 버튼 → 같은 핸들러로 재배선**
`profile-setup.tsx:112-117` 을 `onBack={handleExit}` 로 바꾸고, `SignupStepProfile.tsx:423-425` 의 라벨을 `이전` → `로그아웃` 으로, `variant="ghost"` 유지. 폼이 길어(성별+닉네임+선택 4필드+안내박스) 스크롤 하단에서는 헤더가 안 보이므로 **바닥에도 출구가 필요하다.** 상세 근거와 대안은 B-2 참조.

---
**아키텍처 규약 점검**
- Presentation → Service 직접 호출: `signOut` 은 `@/services/auth` 경유(Supabase 직접 호출 아님). ✅
- `confirmAction()` 사용, `Alert.alert()` 직접 호출 없음. ✅
- 다중 쓰기 아님(로그아웃은 단일 세션 종료) → RPC 불필요. ✅
- `useAuthStore.reset` 직접 호출: CLAUDE.md 의 authStore 허용 액션 목록에는 없으나, **`app/(app)/(tabs)/profile.tsx:74,95` 가 이미 프로덕션에서 같은 방식으로 쓰고 있는 선례**가 있다. 규약의 취지(Presentation 에서 Supabase 직접 접근 금지)에는 위배되지 않는다 — reset 은 로컬 스토어 초기화다.

### 리스크
세 가지를 실측 기반으로 짚는다.

**① `resetAuth()` 가 로딩 오버레이를 띄울 위험 — 낮음.** `authStore.reset` 은 `set(initialState)`(authStore.ts) 이고 initialState 는 `isLoading: false, isInitialized: false` 다. `(app)/_layout.tsx:96` 의 `showLoading = isLoading || isOnboardingLoading` 은 스토어의 `isLoading` 을 보는데 false 가 되므로 오버레이는 뜨지 않는다. `AppContent`(app/_layout.tsx:216-219)가 보는 `isInitialized` 는 **스토어가 아니라 `useAppInitialize` 의 자체 state**(useAppInitialize.ts:66-73)라 영향 없다. 그리고 `(tabs)/profile.tsx` 가 이미 같은 시퀀스를 프로덕션에서 돌리고 있다.

**② 저장 중 이탈 race — 차단됨.** `if (isLoading) return;` 가드가 `completeProfile` 진행 중 confirm 자체를 막는다. `signup.tsx:250-252` 가 동일 사고("절반 저장된 프로필 + 세션 종료 race")를 이렇게 막고 있다. 단, `confirmAction` 을 띄운 **뒤** 사용자가 뒤에서 제출을 누르는 것은 물리적으로 불가(모달 다이얼로그).

**③ 이탈 후 재가입 시 IV_DUPLICATE_PHONE — 신규 위험 아님, 그러나 노출된다.** 로그아웃한 사용자가 "새로 가입"을 시도하면 Edge Function 이 `verify-and-save-portone-profile/index.ts:183-205` 에서 기존 row 의 phone/CI 를 잡아 `IV_DUPLICATE_PHONE` 을 반환한다. 이건 **지금도 존재하는 동작**(앱을 지우고 재설치해도 동일)이고 수정이 만드는 것이 아니다. 다만 출구가 생기면 이 경로를 밟는 사용자가 늘어난다 → confirm 문구에 "계정은 그대로 남아 있고, 다시 로그인하면 이어서 진행합니다"를 넣어 **재가입이 아니라 재로그인으로 유도**하는 것이 위 fixDesign 의 의도다.

**깨뜨리지 않는 것(근거 있음)**: `useAuthGuard.ts`·`authRedirect.ts` 를 건드리지 않으므로 두 파일의 테스트 스위트 전체가 무영향. `e2e/` 에 이 화면 참조가 0건이라 E2E red 위험 없음.

### 선행 의존성
없음. 이 수정은 DB·RPC·다른 PR 에 의존하지 않고 단독 머지 가능하다.

다만 **같이 묶는 편이 자연스러운 것**이 하나 있다: B-2(죽은 '이전' 버튼 처리)는 같은 두 파일을 만지므로 같은 커밋에서 처리해야 충돌이 없다. B-3((ops) 가드 구멍)은 `useAuthGuard.ts` 를 만지므로 **별도 PR 로 분리**해야 이 수정의 무영향 보증이 유지된다.

### 🔍 검증 — 놓친 제약
① CLAUDE.md 의 authStore 직접 호출 허용 목록(refreshSession/getUser/signOut/refreshProfile)에 reset 은 없다 — (tabs)/profile.tsx:74·94-96 선례 실재는 확인했으나, 규약 문서와 코드가 이미 어긋난 상태를 이 PR 이 3번째로 복제하는 셈이라 CLAUDE.md 목록에 reset 추가(또는 주석으로 선례 명시)를 같이 하는 편이 옳다. ② Android 하드웨어 백 미배선 — 수정설계는 헤더+하단 버튼 출구만 만들고 signup.tsx:301-309 의 BackHandler 인터셉트 선례를 적용하지 않았다. 현행 유지(무반응/앱 백그라운드)라 회귀는 아니지만 '출구 신설' 목적에서 안드로이드 물리 백만 공백으로 남는다. ③ handleExit 이 postAuthRedirect 를 버린다 — signup.tsx:273-277 선례는 login 에 redirect 를 보존해 재로그인 후 원래 목적지로 복귀시킨다. profile-setup 도 :34 에 postAuthRedirect 가 이미 있다. ④ signOut 실패 시 finally 로 resetAuth+replace 진행하는 의미론: signOut 서비스(authCoreService.ts:386-438)는 supabase.auth.signOut() 전 단계(getUser 등)에서 throw 가능 — 이때 스토리지 세션이 잔존해 콜드스타트 시 재로그인→재수감된다. confirm 문구('다시 로그인하면 이어서')와는 정합이라 수용 가능하나 주석 필요. ⑤ 마이그/RPC/RLS 불필요 판단은 정확, e2e 의 profile-setup 참조 0건도 재확인.

### 🔧 검증 — 설계 보정
수정설계에 4가지 보정: (1) handleExit 의 router.replace 를 signup.tsx:273-277 과 동일하게 postAuthRedirect 보존형으로: replace(postAuthRedirect ? `/(auth)/login?redirect=${encodeURIComponent(postAuthRedirect)}` : '/(auth)/login') — 의존성 배열에 postAuthRedirect 추가. (2) signup.tsx:301-309 선례대로 BackHandler 인터셉트를 추가해 안드로이드 물리 백도 handleExit 으로 위임(가드가 어차피 되돌리므로 필수는 아니나 3면 출구 완결). (3) 수정설계 주석의 sessionService 라인 인용(119-125)은 부정확 — setTimeout(0) 지연 메커니즘은 파일 헤더 주석 :15-18 에 있다. 인용을 헤더로 교체. (4) CLAUDE.md authStore 허용 액션에 reset 추가(선례 profile.tsx 준용 명시)를 같은 PR 문서 변경으로. 나머지 설계(confirmAction 시그니처·signOut export·reset 존재·isLoading 가드·헤더 배치·(app)/_layout showLoading 무영향·useAppInitialize isInitialized 분리)는 전부 실측 일치 — 그대로 실행 가능.

### 검증 메모
인용 라인 전수 재검증 일치(profile-setup.tsx:84-86 토스트 핸들러, useAuthGuard.ts:341-352/:172/:298-310, authRedirect.ts:119-121, app/index.tsx:56-61/:101-103, EF Boolean(trimmedNickname), handle_new_user 20260719233000:42 INSERT 에 profile_completed 미명시, completeProfile 유일 소비처). '신규 가입자 100% profile_completed=false' 주장은 SignupForm STEP_FLOW(terms→identity→account)와 SignupForm·signup.tsx·socialAuthService 전체 nickname 0건 grep 으로 독립 재확인 — SignupForm.tsx:84 주석('orphan… profile_completed=false 잔존')이 방증. git 고고학(1d7b2a950 단독 추가·직전 SignupForm 이 SignupStepProfile 렌더·같은 커밋에 toast.info)도 재실행으로 확인. 감옥 판정 자체에 반례를 찾지 못했다.

### 🙋 사람이 결정할 것
제품 오너가 결정해야 할 것 2가지.

**① 출구의 성격 — '로그아웃'만인가, '가입 취소(계정 삭제)'도 주는가?**
현재 코드에서 이 화면에 도달한 시점에 이미 `auth.users` + `public.users` row 가 생성돼 있다(EF 가 `20260710000002…sql:10647` 의 users 에 upsert 완료). 로그아웃만 주면 사용자는 "가입을 취소했다"고 믿지만 실제로는 계정이 남아, 같은 휴대폰으로 재가입 시 `IV_DUPLICATE_PHONE`(EF index.ts:203) 을 만난다. `app/(app)/settings/delete-account.tsx` 에 삭제 플로우가 이미 있으나 그 화면 역시 가드 뒤라 여기서는 못 쓴다. **선택지: (A) 로그아웃만 + 문구로 "계정은 남는다" 명시(본 설계안), (B) '가입 취소하고 계정 삭제' 를 추가로 노출.** (B)는 삭제 RPC 를 이 화면에서 호출해야 하므로 별도 설계가 필요하다.

**② 확인 다이얼로그 문구 톤.** 위 설계는 `'로그아웃할까요?' / '로그아웃' / '계속 작성'` 을 제안했다. 형제 화면 `signup.tsx:258-263` 은 `'가입을 중단하시겠어요?' / '중단하고 나가기' / '계속 진행'` 을 쓴다. **문구를 signup 과 통일할지, 이 화면은 계정이 이미 존재한다는 사실을 반영해 다르게 갈지** 결정이 필요하다(계정이 존재하므로 '가입 중단'은 사실과 다르다는 것이 본 조사의 판단).


## `B-2` — '이전' 버튼은 4단계 위저드의 잔해 — SignupStepProfile 은 공유 컴포넌트가 아니라 profile-setup 전용이다

**주장 판정**: 부분사실 · **심사**: CONFIRMED · **설계 실현성**: 실행가능 · **난이도**: S→S · **마이그레이션**: 불필요

### 근거 (실측)
원 주장의 전제 "같은 컴포넌트를 두 곳이 쓴다"는 **현재 코드에서 거짓**이다. 버튼이 죽었다는 부분만 사실이다.

**① 소비처는 하나뿐.** 레포 전체 `SignupStepProfile` grep(node_modules 제외) 결과 8건이고, 실제 렌더 소비처는 단 하나다:
- `app/(app)/profile-setup.tsx:14` (import), `:112` (렌더) ← **유일한 소비처**
- `src/components/auth/index.ts:21`, `src/components/auth/signup/index.ts:10` ← 배럴 re-export(소비 아님)
- `src/components/auth/signup/SignupStepProfile.tsx:25,43` ← 정의부
- `app/(app)/settings/profile.tsx:90` ← **주석뿐**: `/** 닉네임 blur 시 중복 검사 (SignupStepProfile 패턴 재사용) */` — 패턴을 베낀 것이지 컴포넌트를 쓰는 게 아니다

**② 가입 위저드는 이 컴포넌트를 더 이상 쓰지 않는다.** `src/components/auth/signup/SignupForm.tsx:24-26` 의 import 는 정확히
```tsx
import { SignupStepAccount } from './SignupStepAccount';
import { SignupStepIdentity } from './SignupStepIdentity';
import { SignupStepTerms } from './SignupStepTerms';
```
셋뿐이다. `SignupStepProfile` 은 없다. `SignupForm.tsx:403-420` 의 렌더 스위치도 Terms/Account/Identity 만 분기한다.

**③ 버튼은 실제로 죽어 있다.** `SignupStepProfile.tsx:423-425`
```tsx
<Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
  이전
</Button>
```
의 `onBack` 은 `profile-setup.tsx:113` 에서 `handleBack`(=토스트 1줄) 으로만 주입된다.

**④ 반복 탭하면 아예 아무 일도 안 일어난다.** `src/stores/toastStore.ts:56-61` 의 `addToast` 는 `const isDuplicate = get().toasts.some((t) => t.message === toast.message && t.type === toast.type); if (isDuplicate) return;` 로 같은 메시지·타입을 억제한다. 즉 **첫 탭 후 토스트가 사라지기 전까지 두 번째 탭은 시각 피드백이 0** 이다 — 사용자에게는 완전히 고장난 버튼으로 읽힌다.

### 근본 원인
**리팩터링 잔해가 확정이다.** `git show 1d7b2a950^:uniqn-mobile/src/components/auth/signup/SignupForm.tsx` 에
```tsx
case 4: // 프로필 (최종 제출)
  return (
    <SignupStepProfile
      onNext={handleProfileSubmit}
      onBack={handleProfileBack}
      initialData={formData.profile}
      isLoading={isLoading}
    />
  );
```
가 있었다. 4단계 위저드 안에서 `onBack` = "3단계(본인인증)로 돌아가기"였고 `이전` 라벨은 정확했다.

커밋 `1d7b2a950`("회원가입 4단계→3단계 축소 및 프로필 분리", 14파일 변경)이 이 스텝을 `app/(app)/profile-setup.tsx` 로 승격시키면서 **prop 계약(`onBack: () => void` 필수)과 버튼 JSX 는 손대지 않고** 새 화면에서 토스트로만 채웠다. 같은 커밋의 `git show 1d7b2a950:…/profile-setup.tsx` 에 이미 `toast.info(...)` 가 들어 있다.

이후 `SignupStepProfile.tsx` 를 만진 커밋 6개(`c75d78add` knip triage, `c9aa0c837` PortOne 차단 해소, `98b748df9` 닉네임 중복 검사, 그 외 색/폰트 마이그레이션)는 모두 다른 목적이라 이 잔해를 건드리지 않았다. **knip triage(`c75d78add`)조차 못 잡았다** — 컴포넌트도 prop 도 '사용 중'이라 정적 분석에는 살아 있는 코드로 보인다.

### 인과사슬
원인 → 경로 → 증상.

[원인] 위저드 전용 prop `onBack` 이 단독 화면으로 이사하면서 의미를 잃었다.
→ [경로1] `SignupStepProfileProps.onBack: () => void`(SignupStepProfile.tsx:27)이 **필수(non-optional)** 라 profile-setup 은 무언가를 반드시 넘겨야 했다. 넘길 게 없어 토스트를 넣었다.
→ [경로2] `SignupStepProfile.tsx:423-425` 가 조건 없이 3번째 버튼을 렌더한다. 폼 맨 아래, `가입 완료` / `나중에 입력하기` 바로 밑이다.
→ [증상] 사용자가 폼 하단에서 볼 수 있는 버튼 3개 중 **하나는 앞으로 가고, 하나는 필수만 채우고 앞으로 가고, 나머지 하나는 아무 데도 안 간다.** 이탈 의사를 표현할 유일한 자리에 놓인 버튼이 토스트만 뱉으므로, 사용자는 "버튼이 고장났다"가 아니라 **"나갈 수 없다"**로 학습한다 — B-1 의 감옥 체감을 만드는 UI 표면이 바로 이 버튼이다.
→ [증상 심화] 토스트 중복 억제(toastStore.ts:56-61)로 두 번째 탭부터는 무반응. 사용자는 앱이 멈췄다고 판단한다.

### 파급 범위
**극히 좁다 — 파일 2개, 소비처 1개.**

- `src/components/auth/signup/SignupStepProfile.tsx` 를 바꿔도 영향받는 렌더 소비처는 `app/(app)/profile-setup.tsx` 하나다(위 claimEvidence ①에서 grep 으로 확정).
- 가입 위저드(`SignupForm.tsx`) 는 이 컴포넌트를 import 하지 않으므로 **가입 플로우에 영향 0**. 원 주장이 걱정한 "가입 플로우 회귀"는 발생할 수 없다.
- 배럴 export 2곳(`src/components/auth/index.ts:21`, `src/components/auth/signup/index.ts:10`)은 유지된다. prop 을 optional 로 바꾸거나 라벨만 바꾸는 것은 export 형상을 바꾸지 않으므로 **knip 래칫(2189) 무영향**.
- 테스트: `src/components/auth/signup/__tests__/` 디렉터리가 존재하지만 `SignupStepProfile` 전용 테스트 파일은 grep 상 없다. `e2e/` 에도 `'나중에 입력하기'`·`'이전'`·`'프로필 설정'` 문자열이 0건.

⚠️ 한 가지만 주의: CLAUDE.md 의 "eslint 사각지대" 경고대로 `e2e/` 는 `npm run quality` 범위 밖이다. 라벨 문자열을 바꾸면 `e2e/` 를 **별도 Grep** 해야 하는데, 위에서 이미 0건임을 확인했다.

### 기각한 경쟁 가설
경쟁 가설 4개 중 3개 기각.

**(a) 기각 — "가입 위저드가 여전히 이 컴포넌트를 쓰므로 건드리면 회귀한다"(원 주장의 전제)**
`SignupForm.tsx:24-26` import 3개에 없고, `:403-420` 렌더 스위치에도 없다. `git show 1d7b2a950^` 로 **이전에는 있었고 그 커밋에서 제거됐음**까지 확인했다. 원 주장은 과거 코드 기준이거나 배럴 export 를 소비로 오독한 것이다. (메모리에 기록된 `SettlementCard` vs `GroupedSettlementCard` 오판과 정확히 같은 종류의 함정 — 이름이 `Signup*` 이라 가입에서 쓸 것 같지만 실제 렌더 소비처를 grep 해야 안다.)

**(b) 기각 — "의도적으로 남긴 안내용 버튼이다"**
의도라면 `disabled` 이거나 안내 텍스트여야 한다. 실제로는 `variant="ghost"` 의 정상 활성 버튼(`:423-425`)이고 라벨이 `이전` 이라 **네비게이션을 약속한다**. 게다가 `toastStore` 중복 억제로 두 번째 탭이 무반응이 되므로 안내 목적조차 달성하지 못한다. 의도적 안내라면 폼 하단이 아니라 헤더 근처가 자리다.

**(c) 기각 — "버튼만 지우면 끝난다"**
지우면 안 된다. 폼 길이가 문제다 — `SignupStepProfile.tsx:196-427` 은 성별 섹션(조건부)+닉네임+지역+경력+이력+기타사항+안내박스+버튼 3개다. `profile-setup.tsx:90-96` 의 `KeyboardAwareScrollView` 로 스크롤되므로 **하단에 도달한 사용자에게 헤더는 화면 밖**이다. 버튼만 제거하면 "포기 지점에 출구가 없다"는 B-1 증상이 그대로 남는다. 따라서 **제거가 아니라 재배선**이 옳다.

**(d) 채택 — "prop 이 필수라 억지로 채웠다"**
`onBack: () => void`(SignupStepProfile.tsx:27) 가 optional 이 아니라는 점이 토스트 스텁을 강제했다. 이것이 잔해가 6개 커밋을 살아남은 기계적 이유다.

### 수정 설계
**채택안: 버튼을 지우지 말고 B-1 의 `handleExit` 으로 재배선한다.** 진입점 2개(헤더+하단), 핸들러 1개.

**① `src/components/auth/signup/SignupStepProfile.tsx:423-425` — 라벨 교체**
```tsx
// 2026-08-02: 4단계 위저드의 '이전'(=본인인증 단계로 복귀) 잔해였다.
// 위저드에서 분리된 뒤(1d7b2a950) 이 컴포넌트의 유일한 소비처는
// app/(app)/profile-setup.tsx 이고, 거기서 뒤로 갈 곳은 로그아웃뿐이다.
<Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
  로그아웃
</Button>
```
prop 이름 `onBack` 도 `onExit` 으로 rename 하는 편이 정확하다(소비처가 1곳이라 안전). rename 시 바꿀 지점은 정확히 4곳: `:27`(타입), `:44`(구조분해), `:423`(사용), 그리고 `profile-setup.tsx:113`.

**② `app/(app)/profile-setup.tsx:112-117` — 배선**
```tsx
<SignupStepProfile
  onNext={handleSubmit}
  onExit={handleExit}      // B-1 에서 신설한 confirmAction+signOut 핸들러
  isLoading={isLoading}
  requireGender={requireGender}
/>
```
그리고 죽은 `handleBack`(83-86줄)과 `toast.info` 호출을 **삭제**한다. `toast` 는 `handleSubmit` 이 여전히 쓰므로(`:48, :69, :75`) import 는 유지.

**③ 검증(red-green)**: `SignupStepProfile` 전용 테스트가 없으므로 `src/components/auth/signup/__tests__/SignupStepProfile.exit.test.tsx` 를 신설한다. `onExit` mock 을 주입하고 `getByText('로그아웃')` 을 press → mock 이 1회 호출되는지. **red 확인 절차**: 배선을 되돌려(`onExit={() => {}}`) 실패하는지 먼저 본다. 메모리의 교훈("순수 헬퍼만 보는 테스트는 CRITICAL 이 살아 있어도 green")대로 **컴포넌트 레벨 테스트여야** 배선 누락을 잡는다.

---
**대안(더 작은 diff, 비추천)**: 버튼을 조건부 렌더로 바꾸고(`{onBack && <Button …>}`) profile-setup 이 `onBack` 을 안 넘겨 버튼을 없앤다. diff 는 작지만 (c)에서 기각한 대로 스크롤 하단 출구가 사라진다. 헤더 출구만으로 충분하다고 제품이 판단하면 이 안을 쓴다.

### 리스크
**깨뜨릴 수 있는 것이 사실상 없다 — 근거를 댄다.**

- **가입 플로우 회귀 위험 0**: `SignupForm.tsx` 가 이 컴포넌트를 import 하지 않음을 grep 으로 확정(claimEvidence ②). 원 주장이 우려한 유일한 위험이 코드상 성립하지 않는다.
- **타입 안전망 있음**: `onBack` → `onExit` rename 은 prop 이 **필수**라 `tsc --noEmit` 이 누락된 소비처를 전수 지목한다(메모리 교훈: "필수 필드로 추가하면 tsc 가 누락 생성지점 전수 지목"). optional 로 바꾸면 이 안전망이 사라지므로 **rename 하는 동안은 필수를 유지**할 것.
- **E2E red 위험 0**: `e2e/` 에 `'이전'`·`'나중에 입력하기'`·`'프로필 설정'`·`profile-setup` 문자열 0건 확인. (CLAUDE.md 가 경고하는 "상수·문구 변경 시 e2e 별도 Grep" 을 실제로 수행한 결과다.)
- **knip 래칫 무영향**: 배럴 export 형상을 바꾸지 않는다.
- **잔여 위험 1개**: 라벨이 `이전`(중립) → `로그아웃`(파괴적)으로 바뀌므로 **오탭 시 파장이 커진다.** B-1 의 `confirmAction`(destructive: true, cancelText '계속 작성')이 이를 흡수한다 — 확인 다이얼로그 없이 배선하면 안 된다.

### 선행 의존성
**B-1 에 선행 의존한다.** 이 항목의 채택안은 B-1 이 신설하는 `handleExit`(confirmAction + signOut + resetAuth + replace)에 연결하는 것이 전부다. B-1 없이 라벨만 `로그아웃` 으로 바꾸면 **토스트를 뱉는 '로그아웃' 버튼**이라는 더 나쁜 상태가 된다.

따라서 **B-1 과 같은 커밋에서 처리**한다. 두 항목이 같은 파일 2개를 만지므로 분리 커밋은 충돌만 만든다.

### 🔍 검증 — 놓친 제약
① 분석의 'e2e 에 이전 0건 확인' 은 허위다 — e2e/helpers/assertion-helpers.ts:31 에 PREVIOUS: '이전' 상수, e2e/pages/auth/signup.page.ts:122-123 에 getByRole('button',{name:/이전/}) backButton(:141 에서 클릭 사용)이 실재한다. 다만 둘 다 가입 위저드 page object 전용이고 SignupStepProfile 은 위저드에서 렌더되지 않으므로(SignupForm import 3종 재확인) 라벨 변경의 E2E 파급은 실제로 0 — 결론은 유지되나 '실제 grep 을 수행했다'는 근거 서술은 정정해야 한다. ② 신설 테스트는 SignupStepProfile 이 @/services/auth 의 checkNicknameExists 를 모듈 스코프 import 하므로 mock 필수 — 선례 템플릿은 app/(auth)/__tests__/signup-back.test.tsx (render/fireEvent + expo-router mock 패턴 실재 확인, 인프라 실증). ③ SignupStepProfileProps 인터페이스는 비export(:25 export 키워드 없음) — rename 의 타입 파급이 정확히 4곳 + tsc 전수 지목 주장은 성립.

### 🔧 검증 — 설계 보정
사소한 인용 오차 2건: onBack 구조분해는 :44 가 아니라 :45, repo-wide grep 은 8건이 아니라 10줄(profile-setup 주석 :36/:111 과 정의부 :49 포함) — 소비처 1곳 판정은 불변. e2e 근거는 '0건'이 아니라 '가입 위저드 전용 2건 실재, profile-setup 무관이라 무영향'으로 고쳐 쓸 것. 채택안(재배선+rename+컴포넌트 red-green 테스트)은 그대로 실행 가능하며, B-1 과 같은 커밋 처리·조건부 렌더 대안 비추천 판단에도 동의한다.

### 검증 메모
핵심 주장 전수 일치: SignupForm.tsx:24-26 import 3종에 SignupStepProfile 없음, 렌더 스위치에도 없음, :423-425 버튼 실재, toastStore.ts:55-60 중복 억제로 2번째 탭 무반응, git 으로 1d7b2a950 직전 SignupForm:279 에 SignupStepProfile 렌더 존재 확인. knip 이 못 잡는 이유(컴포넌트·prop 모두 '사용 중')도 타당. B-1 선행 의존(단독 라벨 변경 시 '토스트 뱉는 로그아웃 버튼') 판단 동의.

### 🙋 사람이 결정할 것
**prop 을 `onBack` 그대로 둘 것인가, `onExit` 으로 rename 할 것인가?**

- rename 찬성: 이름이 동작과 어긋나면 다음 리팩터가 또 잔해를 만든다(이번이 그 결과다). 소비처 1곳이라 비용은 tsc 가 지목하는 4줄뿐.
- rename 반대: 컴포넌트 이름이 여전히 `SignupStepProfile` 이라 절반만 정직해진다. 근본 해결은 **컴포넌트 자체를 `src/components/auth/signup/` 에서 `src/components/profile/` 로 옮기고 `ProfileSetupForm` 으로 rename** 하는 것인데, 이는 배럴 2개(`src/components/auth/index.ts:21`, `signup/index.ts:10`)를 건드려 knip 래칫에 걸릴 수 있다.

**제품/기술 오너 결정 사항: 이번 PR 범위를 (A) 배선만 (B) prop rename 포함 (C) 컴포넌트 이사까지 중 어디로 그을 것인가.** 조사자 권고는 (B) — (C)는 별도 리팩터 PR.


## `B-3` — useAuthGuard 의 profile-setup 게이트가 (ops) 그룹 전체를 건너뛴다 — 탈출구는 아니지만 게이트 구멍

**주장 판정**: 부분사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→M · **마이그레이션**: 불필요

### 근거 (실측)
원 주장 3번("딥링크·웹 URL 직접 진입 중 빠져나갈 구멍이 있는지")에 대한 답이다. **구멍은 있고, 로그아웃은 없다.**

**① `(ops)` 는 가드의 라우트 테이블에 없다.** `src/hooks/useAuthGuard.ts:30`
```ts
type RouteGroup = '(auth)' | '(app)' | '(employer)' | '(admin)' | '(public)';
```
`:40-59` 의 `ROUTE_CONFIGS` 키도 같은 5개다. `'(ops)'` 는 없다.

**② 그래서 routeGroup 이 null 이 되고 조기 반환한다.** `:71-79`
```ts
function extractRouteGroup(segments: string[]): RouteGroup | null {
  const firstSegment = segments[0] as RouteGroup | undefined;
  if (firstSegment && firstSegment in ROUTE_CONFIGS) return firstSegment;
  return null;
}
```
`:237-294` 의 null 분기는 (a) 루트 경로 (b) 공개 jobs 별칭 두 경우만 처리하고 나머지는 `return;`(293줄) 이다. **profile-setup 리다이렉트(`:341-352`)까지 도달하지 못한다.**

**③ `(ops)` 자체 레이아웃은 인증만 본다.** `app/(ops)/_layout.tsx:29-41`
```tsx
if (isLoading || (isAuthenticated && !profile)) return <Loading variant="layout" />;
if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
return <OpsStack />;
```
`profileCompleted` 를 읽지 않는다. 파일 상단 주석도 "게이트: authenticated 만 (역할 체크 없음 — 데이터 접근은 RLS 가 owner/workspace 로 통제)" 라고 명시.

**④ 실제 도달 가능한 화면이 있다.** `app/(ops)/` 구성: `_layout.tsx`, `tournaments/index.tsx`, `tournaments/new.tsx`, `tournaments/[id].tsx`.

**⑤ 그런데 거기엔 로그아웃이 없다.** `app/` 전체 `signOut` grep 결과 `(ops)` 하위 파일은 **0건**.

### 근본 원인
**설계 누락(그룹 추가 시 게이트 테이블 미갱신)이다.**

`(ops)` 는 나중에 생긴 그룹이다 — `uniqn-mobile/docs/superpowers/plans/2026-06-27-tournament-ops-slice-1c.md:104` 가 "anon 렌더 검증(**useAuthGuard routeGroup=null 통과**)"이라고 적고 있다. 즉 **routeGroup=null 로 빠지는 것을 인지하고 그 위에 설계했다** — `(public)/monitor/[token]`·`(public)/live/[claim_token]` 을 익명 접근시키기 위한 의도적 트레이드오프였다.

문제는 그 트레이드오프가 `(ops)` 에도 그대로 적용됐다는 점이다. `(ops)` 는 익명 접근 대상이 아니라 "인증만 요구, 역할 무관"(CLAUDE.md 라우트 게이트 표)이다. `ROUTE_CONFIGS` 에 `'(ops)': { requiredAuth: true }` 한 줄을 넣었으면 `:341-352` 의 profile-setup 게이트를 자연히 탔을 텐데, 그 대신 **레이아웃 파일에 자체 게이트를 손으로 다시 구현**(`(ops)/_layout.tsx:29-41`)했고 그 복제본에 profileCompleted 축이 빠졌다.

메모리에 반복 기록된 함정과 같은 형태다 — **판정이 여러 곳에 복제되면 한 곳만 갱신된다.**

### 인과사슬
[원인] `(ops)` 그룹 신설 시 `ROUTE_CONFIGS`(useAuthGuard.ts:40-59)에 항목을 추가하지 않고 `(ops)/_layout.tsx` 에 게이트를 재구현했다.
→ [경로1] `extractRouteGroup`(:71-79)이 null 반환 → `:237-294` 의 null 분기 → `:293` `return;` 으로 조기 종료.
→ [경로2] `(ops)/_layout.tsx:33-41` 의 자체 게이트는 `isAuthenticated` 와 `profile` 존재만 본다. `profile.profileCompleted` 는 읽지 않는다.
→ [증상A] profileCompleted=false 인 사용자가 `/(ops)/tournaments` 딥링크(웹은 그룹 소거로 `/tournaments`)로 들어가면 **profile-setup 으로 튕기지 않고 그 화면을 실제로 본다.** 대회 목록/생성/상세가 렌더된다.
→ [증상B] 하지만 거기서 로그아웃할 수 없다(signOut 0건). 그리고 그 화면에서 `(app)` 쪽 링크를 누르는 순간 `:341-352` 가 발동해 profile-setup 으로 되돌아온다. **즉 감옥의 옆방이지 문이 아니다** — B-1 의 판정은 이 발견으로 뒤집히지 않는다.
→ [증상C, 별개 축] 반대 방향 위험: 미완성 프로필(닉네임 NULL)로 대회를 생성하면 `(ops)` 데이터에 닉네임 없는 owner 가 생긴다. 서버는 RLS 로 owner/workspace 만 통제하므로 이를 막지 않는다. 실제 파장은 UI 표시(닉네임 공백) 수준일 가능성이 높으나 **본 조사 범위에서 (ops) 화면의 닉네임 의존도까지는 실측하지 않았다** — 아래 openQuestion 참조.

### 파급 범위
**게이트 축 변경이라 넓다 — B-1/B-2 와 반드시 분리해야 한다.**

- `src/hooks/useAuthGuard.ts` 의 `RouteGroup` 타입(:30)과 `ROUTE_CONFIGS`(:40-59)를 만지면 **모든 라우트의 판정이 재계산**된다. `(ops)` 를 추가하는 순간 `:354-367`(requiredAuth), `:369-383`(requiredRole) 분기도 `(ops)` 에 적용되기 시작한다.
- `src/hooks/__tests__/useAuthGuard.test.ts` 는 21개 케이스를 잠그고 있다(`renderHook(() => useAuthGuard())` 호출 21회). `(ops)` 항목 추가가 기존 케이스를 깨지는 않지만 **신규 케이스를 반드시 추가**해야 회귀를 막는다.
- `app/(ops)/tournaments/__tests__/` 에 화면 테스트 4개(`OpsTournamentCreateScreen`, `OpsTournamentDetailScreen`, `OpsTournamentDetailScreenFab`, `OpsTournamentListScreen`)가 존재한다 — 게이트가 바뀌면 이 스위트를 재실행해야 한다.
- **메모리 경고 대상**: MEMORY.md 에 `ops_hub_enabled` **OFF 회귀 상태** 기록이 있다. `(app)/(tabs)/profile.tsx:79` 의 `useOpsHubEnabled()` 로 진입 표면이 플래그 게이트돼 있으므로, 현재 프로덕션에서 이 경로를 밟는 사용자 수는 사실상 0에 가깝다 → **실사용 심각도는 낮다.** 그러나 플래그를 켜면 살아난다.
- `(public)/monitor/[token]`·`(public)/live/[claim_token]` 은 **의도적으로** 게이트 밖이어야 한다(익명 접근). `(ops)` 만 추가하고 `(public)` 의 현재 동작은 건드리지 말 것.

### 기각한 경쟁 가설
경쟁 가설 4개 중 3개 기각.

**(a) 기각 — "이게 B-1 의 탈출구다"**
탈출하려면 로그아웃이 필요한데 `app/(ops)/` 하위 4개 파일에 `signOut` 이 0건이다. `(ops)` 화면에서 다른 곳으로 이동하는 순간 `useAuthGuard.ts:341-352` 가 profile-setup 으로 되돌린다. **옆방이지 문이 아니다.**

**(b) 기각 — "의도적 설계다"**
`(public)` 이 게이트 밖인 것은 의도가 명시돼 있다(익명 모니터/라이브 토큰 URL, plans 문서 :104). 그러나 `(ops)` 는 CLAUDE.md 라우트 게이트 표에 "**(ops)→역할 무관·인증만**"이라고 적혀 있다 — **인증은 요구한다**는 뜻이고, 인증 요구 그룹이 profile 완성 게이트만 건너뛸 이유가 없다. `(ops)/_layout.tsx` 가 자체 게이트를 구현한 것 자체가 "게이트가 필요하다"는 인식의 증거이고, 거기서 profileCompleted 축만 빠진 것이다.

**(c) 기각 — "레이아웃 게이트가 이미 막고 있다"**
`(ops)/_layout.tsx:33-41` 을 정독했다. 조건은 `isLoading || (isAuthenticated && !profile)` → Loading, `!isAuthenticated` → Redirect, 그 외 → 통과. **`profile.profileCompleted` 를 참조하는 코드가 없다.** 오히려 `(isAuthenticated && !profile)` 가드는 profile 이 **로드되기만 하면** 통과시키므로, profileCompleted=false 프로필도 정상 통과다.

**(d) 채택 — "게이트 판정이 두 곳에 복제됐고 한쪽만 갱신됐다"**
`useAuthGuard`(중앙) 과 `(ops)/_layout.tsx`(로컬) 두 곳에 게이트가 있다. 중앙에는 profileCompleted 축이 있고 로컬에는 없다. 이것이 구멍의 기계적 원인이다.

### 수정 설계
**두 가지 선택지가 있고, 안전한 쪽은 ②다.**

---
**① 중앙 테이블에 편입 (근본적, 파장 큼)**
`src/hooks/useAuthGuard.ts:30` 과 `:40-59` 를 고친다:
```ts
type RouteGroup = '(auth)' | '(app)' | '(employer)' | '(admin)' | '(public)' | '(ops)';

const ROUTE_CONFIGS: Record<RouteGroup, RouteConfig> = {
  …,
  // (ops): 역할 무관·인증만. 데이터 접근은 RLS 가 owner/workspace 로 통제.
  // requiredRole 을 두지 않으므로 :369-383 의 역할 분기는 통과한다.
  '(ops)': { requiredAuth: true },
};
```
이러면 `:341-352` 의 profile-setup 게이트를 자동으로 타고, `(ops)/_layout.tsx:33-41` 의 로컬 게이트는 중복이 되지만 **제거하지 말 것**(레이아웃 마운트 시점이 가드 effect 보다 빠를 수 있어 깜빡임 방어로 유효).

**② 로컬 게이트에 축 추가 (좁고 안전)**
`app/(ops)/_layout.tsx` 의 `OpsLayout` 만 고친다:
```tsx
import { AUTH_ENTRY_ROUTES, getAuthenticatedEntryRoute } from '@/shared/navigation/authRedirect';

// … isAuthenticated 체크 뒤에
const entryRoute = getAuthenticatedEntryRoute({
  socialProvider: profile?.socialProvider ?? null,
  phoneVerified: profile?.phoneVerified ?? null,
  profileCompleted: profile?.profileCompleted ?? null,
  identityVerified: profile?.identityVerified ?? null,
});
if (entryRoute !== AUTH_ENTRY_ROUTES.appTabs) {
  return <Redirect href={entryRoute} />;
}
```
`getAuthenticatedEntryRoute` 를 재사용하므로 **판정 SSOT 를 복제하지 않는다.** 같은 패턴이 이미 `app/(app)/_layout.tsx:32-39` 에 있다(`shouldInitializeNotifications` 계산). profile-setup 뿐 아니라 미완성 소셜가입·본인인증 재인증까지 한 번에 막힌다.

---
**검증**
- ①을 택하면 `src/hooks/__tests__/useAuthGuard.test.ts` 에 케이스 2개 추가: `mockSegments = ['(ops)','tournaments']` + `profileCompleted: false` → `mockReplace` 가 `'/(app)/profile-setup?redirect=%2F(ops)%2Ftournaments'` 로... **주의**: `normalizePostAuthRedirect`(authRedirect.ts:14) 의 `ALLOWED_POST_AUTH_REDIRECT_PREFIXES` 는 `['/(app)','/(employer)','/(admin)']` 이라 `/(ops)` 를 **거부한다** → redirect 없이 `'/(app)/profile-setup'` 이 기대값이다. 이 비대칭을 그대로 둘지도 결정 사항.
- ②를 택하면 `app/(ops)/tournaments/__tests__/OpsTournamentListScreen.test.tsx` 계열 4개를 재실행해 레이아웃 리다이렉트가 스크린 테스트를 깨지 않는지 확인.

### 리스크
**①을 택하면 위험이 실질적이다.**
- `ROUTE_CONFIGS` 에 `(ops)` 가 들어오는 순간 `:354-367`(미인증 → 로그인 replace)과 `:369-383`(역할 부족 → replace)이 `(ops)` 에도 적용된다. `(ops)/_layout.tsx` 의 `<Redirect href="/(auth)/login" />` 와 **이중 리다이렉트**가 되어 경합할 수 있다.
- `normalizePostAuthRedirect` 가 `/(ops)` 를 허용 목록에 두지 않아(authRedirect.ts:14) redirect 보존이 안 된다 → 프로필 완성 후 대회 화면으로 못 돌아온다. 허용 목록에 `/(ops)` 를 추가하면 `authRedirect.test.ts` 가 영향받는다.

**②를 택하면 위험이 낮다.**
- 파일 1개(`app/(ops)/_layout.tsx`)만 바뀐다. `useAuthGuard.ts` 무영향 → 21개 케이스 전부 무영향.
- `getAuthenticatedEntryRoute` 를 재사용하므로 판정 복제가 생기지 않는다.
- 잔여 위험: `(ops)` 화면을 정상적으로 쓰던 profileCompleted=true 사용자에게는 `entryRoute === appTabs` 라 아무 변화가 없다(분기 자체가 통과). 회귀 표면이 미완성 프로필 사용자로 한정된다.

**공통 완화 요인**: `ops_hub_enabled` 플래그가 OFF 회귀 상태(MEMORY.md)라 현재 진입 표면이 거의 없다 → **배포 리스크는 낮고, 긴급도도 낮다.**

### 선행 의존성
**B-1·B-2 와 반드시 분리한 별도 PR 로 처리한다.** 근거는 blastRadius — 이 항목은 게이트 축을 만지고, B-1/B-2 는 화면 2개만 만진다. 섞으면 B-1 의 "useAuthGuard 무영향" 보증이 사라져 리뷰·롤백 단위가 커진다.

선행 결정 1건: 아래 openQuestion 의 ①(어느 안을 택할지)이 정해져야 착수 가능하다.

순서 권고: **B-1+B-2 먼저 머지 → B-3 후속.** B-1 이 출구를 만들어 사용자 피해를 끊는 것이 먼저고, B-3 은 플래그 OFF 상태라 급하지 않다.

### 🔍 검증 — 놓친 제약
① 완화 논리의 사실 오류: ops_hub_enabled 플래그는 (ops) 라우트를 게이트하지 않는다 — app/(ops) 전체에 useOpsHubEnabled 0건(있는 건 ops_hub_entered 계측뿐, tournaments/index.tsx:5 주석은 '전 회원 개방(D11)' 명시). 플래그 OFF 는 (tabs)/profile.tsx:79 의 진입 버튼만 숨기고, 웹 /tournaments URL 직접 진입은 지금도 열려 있다. '플래그를 켜면 살아난다'는 과소 서술 — 이미 살아 있고 노출 표면만 없다(심각도 낮음 결론 자체는 유지). ② 부수 축: 미완성 프로필 사용자의 URL 진입이 ops_hub_entered 퍼널 계측을 오염시킨다(OpsTournamentListScreen 마운트 시 1회 발화 — 테스트 :230-237 로 확인). ③ ② 안의 '4개 스크린 테스트 재실행' 은 사실상 무영향 확인용 — 4개 테스트 모두 _layout/OpsLayout 을 마운트하지 않음을 grep 으로 확인했다(레이아웃 변경이 스크린 테스트를 깰 경로 없음). ④ e2e 에 (ops)/tournaments 참조 0건 재확인 — E2E 파급 없음. ⑤ 마이그 불필요 판단 정확.

### 🔧 검증 — 설계 보정
② 안(로컬 게이트에 getAuthenticatedEntryRoute 재사용) 채택 권고에 동의 — API 전제 전부 실측 확인: AUTH_ENTRY_ROUTES/getAuthenticatedEntryRoute export(authRedirect.ts:3-10/:92), 동일 패턴 선례 (app)/_layout.tsx:32-39, profile 필드명 4종 일치. 보정 2건: (1) 완화 근거 서술을 '플래그 OFF 라 진입 표면 없음'→'라우트는 무게이트·URL 로 이미 도달 가능하나 URL 인지 표면이 없어 실트래픽 근사 0'으로 교체. (2) ② 적용 시 (ops)/_layout 의 기존 (isAuthenticated && !profile)→Loading 가드 뒤에 배치해야 profile null 역참조가 없다(현행 :33 가드가 이미 보장 — 순서만 지키면 됨). ① 안의 위험 서술(이중 리다이렉트 경합·normalizePostAuthRedirect 가 /(ops) 거부(:14 실측)·authRedirect.test 파급)은 전부 실측과 일치하므로 ① 선택 시 재설계 수준 검토 필요하다는 판단 유지.

### 검증 메모
인용 전수 일치: RouteGroup(:30)·ROUTE_CONFIGS(:40-59)·extractRouteGroup(:71-79)·null 분기 :293 return·(ops)/_layout.tsx:33-41 에 profileCompleted 미참조·(ops) 4파일에 signOut 0건·plans 문서 2026-06-27-tournament-ops-slice-1c.md 의 'anon 렌더 검증(useAuthGuard routeGroup=null 통과)' 문구 실재·useAuthGuard.test renderHook 21회. '옆방이지 문이 아니다'(B-1 감옥 판정 불변) 논증과 B-1/B-2 와 별도 PR 분리·순서(B-1+B-2 선행) 권고에 동의. 선행 결정(①/② 택일)이 미결이라 착수 게이트라는 판단도 유지.

### 🙋 사람이 결정할 것
제품/기술 오너 결정 3건.

**① 수정 범위: ①안(중앙 `ROUTE_CONFIGS` 편입) vs ②안(`(ops)/_layout.tsx` 로컬 보강)?**
조사자 권고는 ②안 — 파장이 파일 1개로 갇히고 판정 SSOT(`getAuthenticatedEntryRoute`)를 재사용한다. ①안은 `normalizePostAuthRedirect` 허용 목록까지 연쇄로 건드린다.

**② `/(ops)` 를 `ALLOWED_POST_AUTH_REDIRECT_PREFIXES`(authRedirect.ts:14)에 넣을 것인가?**
넣지 않으면 프로필 완성 후 원래 보려던 대회 화면으로 못 돌아간다(홈으로 착지). 넣으면 `(ops)` 딥링크가 post-auth redirect 로 허용되므로 보안 표면이 한 칸 넓어진다. **현재 3개 prefix 만 허용하는 것이 의도인지, 단순 누락인지 확인이 필요하다.**

**③ 미완성 프로필(닉네임 NULL) 사용자가 (ops) 대회를 생성한 기존 데이터가 있는가?**
본 조사는 코드만 봤고 prod 데이터를 조회하지 않았다. `(ops)` 화면들이 owner 닉네임을 어떻게 표시하는지, NULL 닉네임 owner 가 실제로 존재하는지는 **미실측**이다. 게이트를 닫기 전에 `SELECT count(*) FROM tournaments t JOIN users u ON u.id = t.owner_id WHERE u.profile_completed = false` 류로 확인할지 결정 필요.



---

# C-되돌릴수없는문


## `fixed-posting-no-unconfirm` — 고정(상시) 공고에서 확정 해제 불가 — 리팩터링 잔해로 남은 반쪽 게이트

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 실행가능 · **난이도**: S→S · **마이그레이션**: 불필요

### 근거 (실측)
직접 읽고 확인한 지점 5곳.

① `uniqn-mobile/src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:115-119`
```
const canShowConfirmedActions =
  showActions &&
  !isFixedMode &&                                   // ← 117행
  applicant.status === STATUS.APPLICATION.CONFIRMED &&
  Boolean(onCancelConfirmation);
const canShowActions = showActions && applicant.status === STATUS.APPLICATION.APPLIED;  // 120행 — 여기엔 게이트가 없다
```
120행(확정/거절)에는 `!isFixedMode` 가 없고 117행(확정 해제)에만 남아 있다. 렌더는 204-208행에서 `canShowConfirmedActions` 로 `ConfirmedActions` 를 감싼다.

② `ConfirmedActions.tsx:26-41` — 유일한 '확정 해제' 버튼(accessibilityLabel='확정 해제'). 다른 렌더 소비처 없음(grep `onCancelConfirmation` 전수: ApplicantCard·ConfirmedActions·ApplicantList·applicants.tsx 4파일뿐).

③ `app/(employer)/my-postings/[id]/index.tsx:275` `const isFixed = posting.schedule.kind === 'fixed'` → 525-538('취소 요청 관리')·540-553('스태프 관리/정산')·555-568('공고 수정')이 전부 `{!isFixed && (...)}`. 612-622에서 고정용 '공고 수정' 만 따로 되살린다.

④ 딥링크 우회도 막혀 있다. `settlements.tsx:152-158` 이 `!isCanonicalDatedPosting(posting)` 이면 ErrorState('고정공고는 1차 범위에서 정산과 근무 운영을 지원하지 않습니다.'), `cancellation-requests.tsx:150-162` 도 동형('…취소 요청 관리를 지원하지 않습니다.').

⑤ 반면 `app/(employer)/my-postings/[id]/applicants.tsx` 자체는 fixed 게이트가 **없다**(33·36행은 QR 버튼 은닉용 `isFixed` 뿐). 121-134행 `handleCancelConfirmation` 은 confirmAction 후 `cancelConfirmationAsync` 를 그대로 호출하고 255행에서 카드에 넘긴다. 즉 화면·핸들러·서비스·RPC 는 전부 살아 있는데 **버튼 렌더 조건 한 줄**이 죽인다.

### 근본 원인
리팩터링 잔해다(미완성 아님·의도적 제약 아님). git 로 3단계를 재구성했다.

- `88b2f0a41`(2026-01-09, ApplicantCard 확정이력 연결): `canShowConfirmedActions` 최초 도입 시 **isFixedMode 게이트가 없었다**(diff 실물: `const canShowConfirmedActions = showActions && applicant.status === 'confirmed' && (onCancelConfirmation || onConvertToStaff);`).
- `35163c374`(2026-03-22, 'V3 캐노니컬 워크플로우 통합 정비'): 고정 공고를 통째로 막는 웨이브에서 **두 게이트에 동시에** `!isFixedMode` 를 추가(diff 35·41-42행).
- `ca0c3f581`(2026-04-05, '고정공고 지원 범위 확장'): 같은 파일에서 `canShowActions` 의 `!isFixedMode` **만** 제거하고 `canShowConfirmedActions` 는 건드리지 않았다(diff 전량이 3줄, -2/+1).

즉 '고정공고 지원 범위 확장' 웨이브가 확정(입구)은 열고 확정 해제(출구)를 닫아 둔 채 끝났다. 같은 커밋이 열어 준 확정 기능 때문에 **고정 공고에 확정 스태프가 생길 수 있게 됐고**, 그 순간부터 되돌릴 수 없는 문이 됐다.

### 인과사슬
사장이 고정 공고에 지원자를 확정한다(`canShowActions` 가 fixed 를 허용 — ApplicantCard.tsx:120) → `confirm_application` 이 좌석을 채우고 work_log 를 1행 INSERT 한다(고정은 `dates:['FIXED_SCHEDULE']` 한 원소, 근거=`app/(employer)/my-postings/[id]/_layout.tsx:30-36` 주석 + `20260718000000_seat_basis_filled_total_positions.sql:243` `v_is_fixed := (v_job.schedule->>'kind') = 'fixed'`) → 사람을 잘못 골랐음을 알아도 ApplicantCard.tsx:117 이 `ConfirmedActions` 를 렌더하지 않는다 → 우회로 3개가 전부 막힘: (a) 스태프 관리/정산 카드 `index.tsx:540`, 직접 진입해도 `settlements.tsx:152` ErrorState (b) 취소 요청 관리 `index.tsx:525` + `cancellation-requests.tsx:150` (c) 근무표 그리드 '빼기'(`gridWriteService.deleteSlot` → `cancelConfirmedStaffConfirmation`)는 `get_venue_day_slots` 가 `AND wl.date = p_date`(baseline:3141) 로 날짜 일치를 요구하는데 고정 work_log 의 date 는 문자열 'FIXED_SCHEDULE' 이라 어떤 날짜 셀에도 안 뜬다 → 좌석이 영구 점유되어 `filled_positions` 가 줄지 않고, 그 자리를 다른 사람에게 줄 수 없다. 스태프 쪽 탈출구도 없다: `ApplicationRepository.ts:366-370` 이 `jobData.schedule.kind === 'fixed'` 면 '고정공고는 1차 범위에서 취소 요청을 지원하지 않습니다.' 로 BusinessError 를 던진다. **양쪽 다 못 푸는 데드락**이다.

### 파급 범위
고정(상시) 공고 전체 — 홀덤펍 사장의 주 사용 형태다(CLAUDE.md 타깃 정의: '홀덤펍 사장=상시 단발 알바'). 닿는 화면: `app/(employer)/my-postings/[id]/applicants.tsx`(유일한 진입점), `ApplicantList.tsx:221`(prop 전달), `ConfirmedActions.tsx`. 서버 쪽은 이미 전부 열려 있어 파급이 없다 — `cancel_application_atomically`(현행 정의 `supabase/migrations/20260727180000_cancel_rpc_rebase_on_seat_basis.sql`)에는 fixed 분기가 **한 줄도 없다**. 역할: employer/admin 만(스태프 화면 무영향). 잠금 테스트 없음 — `src/components/employer/applicants/__tests__/` 8개 파일 중 `isFixed|fixed` 를 언급하는 파일 0건, `e2e/` 에도 '확정 해제' 문자열 0건.

### 기각한 경쟁 가설
(a) **데이터 모델상 확정 해제가 불가능하다** — 기각. `20260727180000_cancel_rpc_rebase_on_seat_basis.sql` 전문을 읽었다. 분기 축은 `p_actor_type`(staff_initiates/employer_initiates/staff_approves_cancel_request)과 `applications.status` 뿐, `schedule->>'kind'` 를 보는 곳이 없다. 좌석 반납은 `DELETE FROM work_logs WHERE application_id = ... AND status = 'scheduled'` — 고정 work_log 도 status 는 'scheduled' 이므로 정상 삭제된다. 유일한 차단 가드 `IF EXISTS (... status IN ('checked_in','checked_out')) → staff_already_checked_in` 도 고정에서는 발화 불가다: 체크인 진입점 3곳이 전부 fixed 를 막는다(QR=`index.tsx:311`+`_layout.tsx:70-74` 은닉 / 스태프관리=`settlements.tsx:152` ErrorState / 그리드=`wl.date = p_date` 불일치). 즉 고정 work_log 는 영원히 'scheduled' 다.

(b) **다른 경로로 이미 제공 중이다** — 기각. `cancelConfirmedStaffConfirmation`(`src/services/work/confirmedStaffService.ts:155-190`)이 두 번째 employer_initiates 경로이지만, 그 호출자는 `useConfirmedStaff.ts:174`(→ StaffManagementTab, settlements 화면 안) 와 `gridWriteService.deleteSlot`(근무표 그리드) 둘뿐이고 위 (a) 에서 보인 대로 둘 다 고정 공고를 못 본다.

(c) **고정 공고에는 applications 레코드가 없어서 해제할 대상이 없다** — 기각. `ca0c3f581` 이 `canShowActions` 를 열어 고정 공고 확정을 허용했고, `confirm_application` 은 `v_is_fixed` 분기로 `NEGOTIABLE` 슬롯키까지 계산해 정상 확정한다(20260718000000:266-274). `requestCancellationWithTransaction` 이 fixed 를 명시 거부하는 것 자체가 '고정 공고에 confirmed 지원서가 존재한다'는 전제를 증명한다.

(d) **QR·정산과 같은 work_log 수명 문제라 의도적으로 함께 막았다** — 부분 기각. `_layout.tsx:30-36` 이 설명하는 수명 문제는 '행이 checked_out 으로 고정돼 D+1 부터 스캔이 영구 실패한다'는 **출퇴근 축** 문제다. 확정 해제는 그 행을 지우는 방향이라 문제를 만들지 않고 오히려 정리한다. 무엇보다 `35163c374` 는 확정·해제를 **같은 커밋에서 한꺼번에** 막았고 `ca0c3f581` 이 한쪽만 풀었으므로, 남은 쪽이 별도 근거로 유지된 흔적이 없다.

### 수정 설계
1) `uniqn-mobile/src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:117` 의 `!isFixedMode &&` 한 줄을 제거한다. `canShowConfirmedActions = showActions && applicant.status === STATUS.APPLICATION.CONFIRMED && Boolean(onCancelConfirmation)`.

2) 같은 파일 181-187행 `{!isFixedMode && !canShowActions && (<AssignmentReadOnly …/>)}` 도 함께 본다. 고정 확정 카드는 지금 배정 요약이 통째로 안 보여, 해제 버튼만 붙이면 '무엇을 해제하는지' 없이 버튼만 뜬다. 고정은 148-165행의 `FixedScheduleDisplay` 블록이 이미 근무 조건을 보여주므로 **추가 변경 없이도 최소 정보는 있다** — 이 항목은 유지하고 별도 판단으로 넘긴다(범위 밖 리팩터 금지).

3) 회귀 테스트 신설: `src/components/employer/applicants/__tests__/ApplicantCard.fixedUnconfirm.test.tsx`. `buildPostingFacts` 가 `workflow.isFixed=true` 를 내도록 고정 공고 fixture 를 주고 status='confirmed' + onCancelConfirmation 지정 → `getByLabelText('확정 해제')` 가 존재할 것. red-green 확인: 117행을 되살리면 반드시 실패해야 한다(순수 헬퍼가 아니라 **컴포넌트 렌더**로 검증 — 메모리 기록된 '순수 헬퍼 테스트만으론 린치핀이 안 지켜진다' 전례).

4) 서비스·RPC 는 손대지 않는다. `applicants.tsx:121-134` → `cancelConfirmationAsync` → `applicationHistoryService.cancelConfirmation(…, 'employer_initiates')` → `executeCancelConfirmation`(`ApplicationRepositoryTransactions.ts:233-283`) → `cancel_application_atomically` 경로가 그대로 동작한다.

### 리스크
① 해제 성공 시 RPC 가 `job_postings` 를 closed→active 로 되살릴 수 있다(마이그 파일 내 `UPDATE job_postings SET status='active' … AND status='closed' AND closed_reason NOT IN ('expired','expired_by_work_date')`). 고정 공고가 수동 마감된 상태였다면 다시 지원 가능해진다 — 이건 dated 공고와 동일한 기존 동작이라 새 위험은 아니지만, 고정 공고에서 처음 발생하는 전이다.
② 해제 후 status 가 'applied' 로 복귀하며 `original_application->'assignments'` 로 배정이 복원된다. 고정의 assignments 는 `date:'FIXED_SCHEDULE'` 형태라 `AssignmentReadOnly` 가 숨겨진 지금은 화면에 안 보이지만 재확정 자체는 정상 동작한다.
③ 깨지지 않는 것: e2e·유닛 어디에도 '고정에서 확정 해제 버튼이 없어야 한다'를 잠근 단언이 없음을 grep 으로 확인했다(`e2e/` 에 '확정 해제' 0건, applicants `__tests__` 8파일에 fixed 0건).

### 선행 의존성
없음. 서버 RPC·서비스·핸들러가 모두 선재하므로 단독 머지 가능하다. 단, 같은 화면군의 고정 공고 정책을 손보는 다른 작업(QR work_log 수명 재설계)과 파일이 겹치지 않는지만 확인하면 된다 — 이 수정은 `ApplicantCard.tsx` 한 파일이다.

### 🔍 검증 — 놓친 제약
isFixedMode 는 ApplicantList 가 prop 으로 넘기는 게 아니라 카드 내부에서 applicant.jobPosting 으로 파생된다(ApplicantCard.tsx:42, jobPosting 은 buildApplicantListWithStats 가 전 행에 부착 — ApplicationRepositoryHelpers.ts:241 실측). 따라서 회귀 테스트 fixture 는 postingType prop 이 아니라 applicant.jobPosting 에 고정 공고를 실어야 실경로를 재현한다. 그 외 차단 제약 없음 — cancel_application_atomically 에 fixed 분기 0건, work_logs.date 는 text 라 'FIXED_SCHEDULE' 저장 실물 확인(baseline:3863), checked_in 가드 발화 불가(QR 3경로 차단 실측), e2e '확정 해제' 0건·__tests__ fixed 0건, employer_initiates 배선(applicants.tsx:121→useCancelConfirmation→applicationHistoryService→executeCancelConfirmation→RPC) 전 계층 생존 확인.

### 🔧 검증 — 설계 보정
인용 드리프트 3건 정정: ① ConfirmedActions 실경로는 ApplicantCard/components/ConfirmedActions.tsx(26-41행 내용은 정확). ② 88b2f0a41 당시 파일은 옛 경로 src/components/employer/ApplicantCard.tsx(+143행에서 게이트 없이 도입 — 주장 실질 유효). ③ 'ApplicantList.tsx:221 prop 전달'의 221행은 onCancelConfirmation 전달이지 isFixedMode 가 아니다. onCancelConfirmation grep 전수도 4파일이 아니라 5파일(types.ts 포함, 렌더 소비처 아님이라 결론 불변). git 3단 재구성(35163c374 양쪽 추가→ca0c3f581 한쪽만 제거)은 diff 실물로 확인 — '리팩터링 잔해' 판정 타당.

### 검증 메모
5개 근거 지점·기각가설 4종·인과사슬 전부 실측 재현됨. 117행 한 줄 제거 + 컴포넌트 렌더 테스트로 충분하고 서버는 무변경. 리스크 ①(closed→active 부활, 마이그 150-154행)도 실물 확인 — dated 와 동일한 기존 동작이라는 평가에 동의.

### 🙋 사람이 결정할 것
고정 공고의 '스태프 관리/정산'(`settlements.tsx:152`)과 '취소 요청 관리'(`cancellation-requests.tsx:150`)는 이번 범위에서 계속 막아 둘 것인가? 확정 해제만 열면 사장은 '해제는 되는데 스태프 목록은 못 본다'는 비대칭을 겪는다. 확정 해제 단독 오픈(최소 수술) vs 고정 공고 관리 3종 동시 오픈(work_log 수명 재설계 선행 필요) 중 제품 결정이 필요하다.


## `cancel-request-no-withdraw` — 구직자가 취소 요청을 철회할 수 없음 — 상태 전이표에 철회 간선 자체가 없다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: L→L · **마이그레이션**: 필요

### 근거 (실측)
철회 경로가 UI·훅·서비스·리포지토리·RPC 5계층 어디에도 없음을 각각 확인했다.

① UI(스태프) — `src/components/schedule/tabs/WorkTab.tsx:166-190`. `hasPendingCancellation` 이면 warning 블록을 띄우는데 내용은 배지 + '검토 결과가 나오기 전까지 현재 일정 상태가 유지됩니다.' + `Linking.openURL('tel:…')` 전화 버튼뿐. 주석 174-175행이 스스로 인정한다: '검토 중에는 남는 액션이 신고 뿐이라 막다른 길이었다. 급하면 직접 연락할 경로를 남긴다'.
② UI(모달) — `src/components/schedule/ScheduleDetailModal.tsx:535-551`. '취소 요청' 버튼은 `schedule.type === CONFIRMED && onRequestCancellation && schedule.applicationId && !hasPendingCancellation` 일 때만. 즉 요청을 넣는 순간 그 버튼이 사라지고 그 자리에 아무것도 오지 않는다. 520-533행의 '지원 취소' 버튼도 같은 `!hasPendingCancellation` 가드.
③ 화면 — `app/(app)/(tabs)/schedule.tsx` 는 `requestCancellation`/`cancelApplication` 두 mutation 만 구독한다(233행). `app/(app)/applications/[id]/cancel.tsx` 는 24행짜리 Redirect 래퍼로, schedule 탭 `?cancelApplicationId=` 로 넘길 뿐이다.
④ 서비스/리포지토리 — `src/repositories/interfaces/IApplicationRepository.ts` 의 취소 관련 메서드는 `cancelWithTransaction`·`requestCancellationWithTransaction`·`reviewCancellationWithTransaction`·`cancelConfirmationTransaction` 4종. 철회 없음.
⑤ RPC — `supabase/migrations/20260727180000_cancel_rpc_rebase_on_seat_basis.sql` 의 `p_actor_type` 는 `staff_initiates | employer_initiates | staff_approves_cancel_request` 3종이며 그 외는 `invalid_actor_type` 반환. `CancelActorType`(IApplicationRepository.ts:85)도 2종뿐.

결정적 증거 — `ApplicationRepositoryTransactions.ts:400-403` 주석이 **존재하지 않는 기능을 전제**하고 있다: '스태프가 그사이 스스로 취소를 철회했거나 다른 관리자가 먼저 처리했으면 아무것도 안 바뀐 채 함수가 void 로 끝나고…'. 설계 의도에는 있었으나 구현되지 않았다는 직접 증거다.

### 근본 원인
설계 누락이다. 취소 라이프사이클을 **구인자 심사 중심**으로만 모델링했고(승인/거절 2간선), 요청자 본인의 되돌리기 간선을 넣지 않았다. 근거 3가지: (1) `cancellation_request` jsonb 의 status 값 집합이 `CANCELLATION_REQUEST_STATUS_VALUES`(src/constants/statusValues.ts:131)로 pending/approved/rejected 만 — withdrawn 개념이 애초에 타입에 없다. (2) 리뷰 RPC/함수는 `reviewCancellationWithTransaction` 하나로 승인·거절을 다 받는 대칭 설계인데 그 대칭이 '구인자' 축에서만 성립한다. (3) `executeRejectCancellation` 주석이 철회를 가정하는 것으로 보아 인지는 했으나 범위에서 빠졌다. '의도적 제약'으로 볼 근거는 찾지 못했다 — 고정 공고처럼 '1차 범위에서 지원하지 않습니다' 같은 명시 문구가 이 축에는 한 건도 없다.

### 인과사슬
스태프가 확정 근무의 취소를 요청한다 → `requestCancellation`(applicationService.ts:208-282) → `requestCancellationWithTransaction`(ApplicationRepository.ts:344-413)이 `applications.status = 'cancellation_pending'` + `cancellation_request = {requestedAt, reason, status:'pending'}` 로 UPDATE(394-403행, CAS 가드 `.eq('status', CONFIRMED)`) → AFTER UPDATE 트리거 `tr_notify_cancellation_request`(baseline:12275) → `fn_notify_cancellation_request`(baseline:2199-2245)가 `NEW.status='cancellation_pending' AND OLD.status<>'cancellation_pending'` 조건으로 구인자·워크스페이스 멤버·협업자 전원에게 'cancellation_requested' 알림 발송 → 사정이 바뀌어 근무하겠다고 마음을 돌린다 → **화면에는 전화 버튼 하나뿐**(WorkTab.tsx:176-188) → 구인자가 거절해 주기를 기다리는 것 외에 방법이 없다 → 구인자가 승인하면 `cancel_application_atomically(staff_approves_cancel_request)` 가 status='cancelled' 로 종결하고 좌석을 반납한다. 여기서 결함이 굳는다: `applications_delete_own`(baseline:13261)은 applied|cancelled 만 DELETE 를 허용하므로 cancellation_pending 상태에서는 자기 지원서를 지울 수도 없다. 사용자가 되돌릴 수 있는 유일한 상태는 **상대방의 행동에 의존**한다.

### 파급 범위
스태프(구직자) 전원 × 확정된 모든 dated 공고. 고정 공고는 애초에 요청 자체가 막혀 있어(ApplicationRepository.ts:366-370) 영향 없음. 닿는 코드: `WorkTab.tsx`·`ScheduleDetailModal.tsx`·`ScheduleCard.tsx:159,359`·`GroupedScheduleCard.tsx:136,314`(전부 '취소 요청 검토 중' 표기), 구인자 쪽 `cancellation-requests.tsx` 목록(pending 만 노출 — `useApplicantManagement`), `src/schemas/application.schema.ts`(cancellationRequest discriminated union), 좌석 회계 `fn_update_job_posting_stats`(baseline:2722-2723 — `v_filled_statuses` 에 cancellation_pending 포함). e2e 는 `e2e/tests/p0-critical/cancellation-lifecycle.spec.ts` 가 시나리오 2로 승인 경로를 직접 RPC 호출로 검증 중이라, 상태 전이를 추가하면 이 스펙의 시드(`cancellation_request` 리터럴 124-130행)를 함께 봐야 한다.

### 기각한 경쟁 가설
(a) **철회를 허용하면 좌석 불변식이 깨진다(구인자가 이미 대체 인력을 확정했으면?)** — 기각. 취소 요청은 좌석을 반납하지 않는다. `requestCancellationWithTransaction`(ApplicationRepository.ts:394-403)은 `applications` 한 행만 UPDATE 하고 `work_logs` 를 건드리지 않는다. 좌석 반납은 승인 시 `cancel_application_atomically` 의 `DELETE FROM work_logs … status='scheduled'` 에서만 일어난다. 게다가 `fn_update_job_posting_stats`(baseline:2723)의 `v_filled_statuses` 는 `('confirmed','cancellation_pending','completed')` 로 **pending 도 채운 자리로 센다**. 따라서 pending 동안 대체 인력이 그 좌석에 확정될 수 없고, 철회는 아무 좌석 회계도 바꾸지 않는다.
(b) **다른 경로로 이미 제공 중(지원 취소 버튼으로 대체 가능)** — 기각. `ScheduleDetailModal.tsx:520-533` 의 '지원 취소'도 `!hasPendingCancellation` 게이트가 걸려 있고, 그 뒤 `cancelWithTransaction`(ApplicationRepository.ts:329-334)은 status 를 'cancelled' 로 밀어 근무를 잃는다 — 철회의 반대 결과다.
(c) **RLS 로 막혀 있어 클라이언트가 못 되돌린다(보안 제약)** — 기각. `app_update`(baseline:13246)는 `USING (applicant_id = auth.uid() OR …)` 만 있고 **WITH CHECK 가 없다**. `applications` 에 상태전이 검증 트리거도 없다(트리거 6종 전수 확인: notify_insert/notify_update/updated_at/xss_check/tr_notify_cancellation_request/tr_update_job_posting_stats). 즉 기술적으로는 이미 클라이언트가 되돌릴 수 있는 상태다 — 막고 있는 건 코드가 없다는 사실뿐이다. (역으로 이건 별개 보안 관찰 사항이다.)
(d) **알림 계약이 철회를 못 표현한다** — 기각. `notification_type` 에 새 값을 추가할 필요가 없다. 구인자에게 보낼 철회 알림은 기존 `cancellation_requested` 와 구분되어야 하나, `fn_notify_cancellation_request` 는 `OLD.status<>'cancellation_pending'` 조건이라 철회(pending→confirmed)에서 **발화하지 않는다**. 즉 트리거를 고칠 필요 없이 새 RPC 안에서 명시 INSERT 하면 된다.

### 수정 설계
**① 마이그레이션 신설** `uniqn-mobile/supabase/migrations/<ts>_withdraw_cancellation_request.sql`
```
CREATE OR REPLACE FUNCTION public.withdraw_cancellation_request(p_application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $$ …
```
- 호출자 바인딩: `auth.uid() = v_application.applicant_id` 아니면 `{'success':false,'error':'unauthorized'}`.
- 상태 전제: `status='cancellation_pending'` AND `cancellation_request->>'status'='pending'` 아니면 `invalid_status_for_withdrawal` / `cancellation_request_not_pending`. 이미 confirmed 면 `{'success':true,'idempotent':true}`(RPC 3종의 멱등 문형 그대로).
- `SELECT … FOR UPDATE` 로 잠근 뒤 `UPDATE applications SET status='confirmed', cancellation_request = cancellation_request || jsonb_build_object('status','withdrawn','withdrawnAt', v_now) WHERE id = p_application_id`. **키는 camelCase** — snake_case 로 쓰면 클라 Zod 파싱이 깨져 지원서가 목록에서 통째로 사라진다(W1-1 실사고, 20260727100000 주석).
- 구인자·워크스페이스 멤버·협업자에게 알림 INSERT. `fn_notify_cancellation_request`(baseline:2211-2242)의 수신자 UNION 블록을 그대로 복제하고 type 만 신설값으로. 실패는 `EXCEPTION WHEN OTHERS THEN RAISE WARNING`(cancel RPC 와 동형)로 감싼다.
- `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated, service_role;` + `COMMENT ON FUNCTION`.

**② 타입/스키마 SSOT** — `src/constants/statusValues.ts` 의 `CANCELLATION_REQUEST_STATUS_VALUES` 에 `'withdrawn'` 추가, `src/schemas/application.schema.ts` 의 cancellationRequest discriminated union 에 withdrawn 변형 추가. 이걸 빼면 철회된 지원서가 파싱 실패로 목록에서 증발한다.

**③ 계층 배선** — `IApplicationRepository.withdrawCancellationWithTransaction(applicationId, applicantId)` 선언 → `ApplicationRepositoryTransactions.ts` 에 `executeWithdrawCancellation` 신설(`supabase.rpc('withdraw_cancellation_request', …)`, 에러코드→한글 매핑은 기존 `mapCancelErrorToMessage`(287행) 문형 복제) → `applicationService.withdrawCancellationRequest(applicationId, applicantId)`(트레이스·trackEvent 포함, `requestCancellation` 208-282행 문형) → `useApplications.ts` 에 `withdrawCancellationMutation` 추가(`requireOnlineForMutation` 필수) → `src/lib/invalidationStrategy.ts` 의 `InvalidationEvent` 에 `'application.withdrawCancellation'` 추가 + 매핑 `['applications.mine','applicantManagement.byJobPosting']`(169행 옆).

**④ 부수효과 정리** — `reviewCancellationRequest`(applicationService.ts:302-)가 하는 대타 게시글 archive 를 철회에도 동일 적용(non-blocking, logger.warn). 안 하면 근무를 계속하는데 '대타 구해요' 글이 게시판에 남는다.

**⑤ UI** — `WorkTab.tsx:166-190` 블록에 `Button variant='outline'` '취소 요청 철회' 추가, `confirmAction({title:'취소 요청 철회', message:'취소 요청을 물리고 이 근무를 그대로 진행할까요?', confirmText:'철회하기'})` 경유(Alert.alert 금지). `ScheduleDetailModal.tsx` 액션 행에도 `hasPendingCancellation && onWithdrawCancellation` 조건으로 동일 버튼. 성공 시 `toast.success('취소 요청을 철회했어요')`.

**⑥ 테스트** — 리포지토리 계약 테스트(RPC 인자·에러 매핑), 스키마 파싱 테스트(withdrawn 이 discriminated union 을 통과하는지 — `src/schemas/__tests__/application.cancellationKeys.test.ts` 옆), 컴포넌트 렌더 테스트(pending 일 때 철회 버튼 존재). `supabase/tests/` 에 pgTAP 로 상태 전이·비인가 거부 추가(`cancel_restores_original_assignments.test.sql` 문형).

### DB 변경
새 SECURITY DEFINER RPC `public.withdraw_cancellation_request(uuid)` 1종 신설(파리티 함수 수 +1). 테이블·컬럼·enum(`application_status`) 변경 **없음** — 철회는 기존 `confirmation`↔`cancellation_pending` 사이의 역방향 전이일 뿐이고, withdrawn 은 `applications.cancellation_request` jsonb 안의 문자열이라 DB enum 이 아니다. RLS 정책 변경 없음(SECDEF 함수가 권한을 자체 판정). 알림 트리거 `fn_notify_cancellation_request` 는 `OLD.status<>'cancellation_pending'` 조건 덕에 철회에서 미발화하므로 수정 불필요 — 대신 RPC 안에서 명시 INSERT 한다. 하드닝 필수: `SET search_path TO 'public','pg_temp'`(pg_temp 누락은 20260727180000 이 복구한 회귀 그대로다), `REVOKE FROM PUBLIC, anon`.

### 리스크
① **Zod 계약 파손이 가장 큰 위험**이다. `cancellation_request.status` 에 새 값을 넣고 클라 스키마를 안 고치면 지원서 전체가 파싱 실패로 목록에서 사라진다(20260727100000 이 camelCase 로 겪은 것과 동일 클래스). 스키마 → RPC 순서로 배포하거나 한 PR 로 묶어야 한다.
② `e2e/tests/p0-critical/cancellation-lifecycle.spec.ts` 는 `cancellation_request` 를 리터럴로 시드한다(124-130행). status 축이 늘면 이 시드와 단언을 함께 봐야 한다 — `e2e/` 는 `npm run quality` 범위 밖이라 CI 에서만 드러난다(PR#353 전례).
③ 경합: 구인자가 승인/거절을 먼저 처리했으면 RPC 가 `invalid_status_for_withdrawal` 을 반환한다. 이때 '이미 처리되었습니다. 새로고침해 주세요' 로 안내해야지 실패 토스트만 띄우면 사용자가 상태를 오해한다.
④ 좌석 회계는 건드리지 않으므로 `filled_positions`·`capacity_full` 트리거에 영향 없음을 위에서 확인했다.

### 선행 의존성
없음(선행 작업 불요). 단 C1(고정 공고 확정 해제)과는 무관하다 — 고정 공고는 취소 요청 자체가 `ApplicationRepository.ts:366-370` 에서 거부되므로 이 RPC 의 대상이 아니다. 배포 순서만 지키면 된다: 클라 스키마(withdrawn 수용) → 마이그 → UI.

### 🔍 검증 — 놓친 제약
① 신설 알림 type 의 클라이언트 등록이 설계에 없다 — navigateNotification 착지 매핑·카테고리 분류에 새 type 을 안 넣으면 굵은 링크 폴백으로 떨어진다(메모리 '알림 착지 3종' 실사고 재발 클래스). RPC INSERT 에 category 'application' 명시도 필요(fn_notify_cancellation_request 문형엔 있는데 설계 요약엔 빠짐 — 20260711030000:38-40 실측). ② applicationService.substitute.test.ts 가 대타 게시글 archive 분기를 regression lock 하고 있다(applicationService.ts:297·339 주석이 명시) — 수정설계 ④(철회 시 archive)를 추가하면 이 테스트 갱신이 강제된다. ③ notifications.type 은 text 라 DB enum 변경 불요(baseline:10070 실측 — 분석의 (d) 주장 정확). ④ withdraw 후 재요청은 ApplicationRepository.ts:378 의 PENDING 체크만 통과하면 자동 허용 — 의도된 동작인지 명시 결정 필요.

### 🔧 검증 — 설계 보정
결정적 주석(400-402행)·RPC actor 3종·app_update WITH CHECK 부재(13246)·applications_delete_own 상태 제한(13261)·v_filled_statuses(2723)·e2e 시드 camelCase 리터럴 — 전부 실물 확인. 추가 확인 하나가 설계를 강화한다: notify_on_application_update 전문을 읽은 결과 withdraw 전이(status cancellation_pending→confirmed + cancel_status pending→withdrawn)는 6개 분기 어디에도 안 걸리고 catch-all 이 없다 — 즉 중복 알림 위험 0 이 실측으로 보장되므로 RPC 내 명시 INSERT 설계가 안전하다. statusValues.ts:131 인용은 STATUS 맵 항목이고 실정의는 107-110행(pending/approved/rejected — 실질 동일).

### 검증 메모
5계층 부재 전수 실측 일치. '설계 의도에는 있었으나 미구현' 판정의 결정적 증거(거절 경로 주석)도 실물 그대로다. Zod 계약 파손을 1순위 리스크로 꼽은 것, camelCase 키 강제, 트리거 미발화 활용 — 전부 타당. L 유지(RPC+스키마+5계층+테스트+e2e 시드 검토).

### 🙋 사람이 결정할 것
① 철회에 횟수 제한을 둘 것인가? 지금 설계로는 요청→철회→요청을 무한 반복할 수 있고 매번 구인자에게 알림이 간다(알림 스팸). 1회 제한 또는 쿨다운이 필요한지 제품 결정.
② 구인자가 이미 '검토 중' 화면을 열고 있을 때 철회되면 승인 버튼이 CAS 로 0행을 만나 실패한다 — 실시간 갱신을 붙일지, 실패 문구('스태프가 요청을 철회했습니다')로 처리할지.
③ 철회 알림의 type 값(`cancellation_withdrawn` 신설 vs 기존 재사용)과 딥링크 착지점 — `NotificationRouteMap` 에 매핑을 추가할지.


## `venue-no-delete` — 지점 삭제 불가 — 지점은 job_postings 컨테이너 행이고, 소프트 아카이브 축이 없다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: L→L · **마이그레이션**: 필요

### 근거 (실측)
① `src/components/workSchedule/VenueSettingsSheet.tsx` 전문(351행)을 읽었다. 존재하는 파괴적 액션은 **단가 행 삭제 하나뿐**: 146-158행 `confirmDelete` → `save(e.role, e.customRole, null)`, 렌더는 257-267행 TrashIcon. 지점 자체를 지우는 버튼·핸들러·문구가 없다. 편집 가능한 것은 97-120행 `saveProfile`(지점명·장소·연락처)뿐.
② 훅 배럴 `src/hooks/workSchedule/index.ts` — `useUpdateVenueContainer`(10행)·`useCreateVenueContainer`(13행)만 있고 delete/archive 훅 없음.
③ 리포지토리 `src/repositories/supabase/JobPostingRepositoryVenue.ts` — `getVenueContainers`(49-64)·`getVenueContainerById`(67-80)·`getOrCreateVenueContainer`·`updateVenueContainer` 뿐. 삭제 메서드 없음.
④ 서버 — `supabase/migrations/20260731120000_venue_profile_rpcs.sql` 이 신설한 것은 `update_venue_container`·`get_my_venue_contexts` 2종. `supabase/migrations/` 전체에서 `delete_venue`/`archive_venue` 정의 0건.
⑤ 지점의 실체: `job_postings` 테이블의 `status='container'` 행이다(baseline:2971-2999 `get_or_create_venue_container` 의 INSERT). 고유 인덱스 `uniq_venue_container ON job_postings (workspace_id, lower(title), (schedule->>'kind')) WHERE status='container'`(baseline:11967) 때문에 **같은 이름으로 다시 만들 수도 없다** — 오타 지점 'ㄱㅏㅇ남점' 이 목록에 영구히 남는다.

### 근본 원인
설계 누락 + 스키마 축 부재의 결합이다. 근거: (1) 시트 파일 헤더 주석(1-16행)이 v1 범위 컷 이력을 상세히 적으면서 '의도적으로 넣지 않은 것 두 가지'로 기본 근무시간·주소 자유텍스트만 꼽는다 — 삭제는 아예 논의 대상에 없었다. (2) `job_postings` 에는 소프트 삭제 축이 없다. `archived_at`/`deleted_at`/`is_archived` 컬럼을 baseline 전문에서 grep 했으나 job_postings 에는 0건이고, `workspaces.archived_at`(baseline:1609)만 존재한다. (3) 지점 개념이 나중에 `job_postings` 위에 얹혀 만들어졌다 — `posting_status` enum 에 'container' 를 추가하고 `venue_id` 를 자기참조 FK 로 붙인 형태(baseline:12783 `job_postings_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.job_postings(id)`)라, 공고의 수명주기(마감·만료)를 그대로 물려받았고 '지점을 접는다'는 별도 수명 개념이 들어올 자리가 없었다.

### 인과사슬
사장이 근무표 첫 진입 시 지점이 0개면 `useEnsureDefaultVenue`(39-45행)가 `{닉네임}의 지점` 을 자동 생성한다 → 또는 `VenueCreateSheet` 로 손수 만든다(오타 포함) → 지점은 `job_postings(status='container', venue_id=self)` 1행이 된다(baseline:2996-2999) → 이 지점에 인원을 배치하면 `work_logs.job_posting_id = 컨테이너 id` 행이 쌓이고(`get_venue_day_slots` 의 `is_container` 판정 baseline:3131), 이 지점에 연결된 공고들은 `job_postings.venue_id = 컨테이너 id` 로 묶인다 → 문 닫거나 오타를 발견해도 `VenueSettingsSheet` 에는 이름 수정만 있다 → 이름을 고쳐도 `uniq_venue_container` 때문에 다른 지점과 이름이 겹치면 23505 로 실패한다 → 목록(`VenueSelector.tsx:130`)에 영구 노출된다. 하드 DELETE 를 시도해도: RLS 는 통과할 수 있으나(`jp_delete_workspace_owner`, baseline:13613, 워크스페이스 owner 또는 admin) `work_logs_job_posting_id_fkey`(baseline:13063, ON DELETE 절 없음=NO ACTION)와 `job_postings_venue_id_fkey`(baseline:12783, 동일)가 23503 으로 막는다. 즉 **근무 이력이 1건이라도 있으면 물리적으로 못 지우고, 0건이면 지울 수 있는데 그 경로가 앱에 없다.**

### 파급 범위
근무표를 쓰는 employer 전원. 닿는 읽기 경로 전수(grep 결과): `JobPostingRepositoryVenue.getVenueContainers`(목록·`.eq('status','container')` 만 필터), `VenueSelector.tsx:125-130`(지점 칩), `useEnsureDefaultVenue`(0개 판정), `get_venue_day_slots`/`get_venue_grid_summary`(baseline:3134,3184 — `venue_span_posting_ids` 경유), `venue_span_posting_ids`(baseline:9617-9623 `venue_id = p_venue OR id = p_venue`), `set_venue_role_salary`·`my_venue_role_salaries_rpc`·`get_my_venue_contexts`(단가·스태프 표시), `settlementVenueQuery.ts`·`WorkLogRepositoryVenue.ts`(정산 스팬). job_postings 를 참조하는 FK 는 10개(applications·board_memberships·board_posts.linked_job_posting_id·event_qr_codes·job_posting_collaborators(CASCADE)·job_postings.venue_id·ops_tournaments(SET NULL)·reports·reviews·work_logs) — 이 중 CASCADE/SET NULL 이 아닌 8개가 하드 삭제를 막는다.

### 기각한 경쟁 가설
(a) **하드 삭제가 이미 가능한데 UI 만 없다** — 부분 기각. RLS `jp_delete_workspace_owner`(baseline:13613)는 컨테이너를 제외하지 않는다(RESTRICTIVE 컨테이너 정책은 INSERT/UPDATE 2종뿐 — baseline:13599 `jp_container_no_direct_insert`, 13606 `jp_container_no_direct_update`, DELETE 대응물 없음). 따라서 배치 이력이 0건인 갓 만든 지점은 워크스페이스 owner 가 PostgREST DELETE 로 실제 지울 수 있다. 하지만 이력이 생기는 순간 FK RESTRICT 로 영구 불가가 되므로, '삭제 UI 를 붙이면 된다'는 결론은 틀렸다 — 사용자가 가장 지우고 싶은 건 이력이 있는 폐업 지점이다.
(b) **다른 경로(워크스페이스 아카이브)로 이미 제공 중** — 기각. `archive_workspace`(baseline:979 `UPDATE workspaces SET archived_at = now()`)는 워크스페이스 단위이고 `app/(employer)/workspace/archived.tsx` 는 워크스페이스 목록을 복원한다. 지점은 워크스페이스 **안**의 개체라 입도가 다르다. 워크스페이스를 접으면 그 안의 모든 지점·공고·정산이 함께 사라진다.
(c) **의도적 제약(정산·평판 무결성 보호)** — 부분 채택하되 '삭제 불가'의 근거로는 기각. 과거 근무 이력을 보존해야 한다는 제약은 실재한다(FK 가 그걸 강제한다). 그러나 그 제약이 요구하는 것은 '행을 지우지 마라'이지 '목록에서 숨기지도 마라'가 아니다. 같은 레포가 `workspaces.archived_at`(baseline:1637 주석: '소프트 삭제 마커. NULL=활성. 값 있으면 switcher/list/cap 에서 제외. owner 가 복원 가능')로 정확히 이 구분을 이미 구현해 두었다.
(d) **`status` 를 container 가 아닌 값으로 바꿔 숨기면 된다** — 기각. `uniq_venue_container` 부분 인덱스(baseline:11967)와 `venue_span_posting_ids`·`get_venue_day_slots`·`set_venue_role_salary`(baseline:3111,3171,9081 전부 `status='container'` 를 요구)가 status 를 정체성으로 쓰므로, status 를 바꾸면 지점이 아니라 **깨진 공고**가 된다. 게다가 `jp_container_no_direct_update` RESTRICTIVE 정책이 컨테이너 UPDATE 자체를 직접 경로에서 막는다.

### 수정 설계
소프트 아카이브로 간다. `workspaces.archived_at` 선례를 그대로 이식한다.

**① 마이그레이션** `uniqn-mobile/supabase/migrations/<ts>_venue_container_archive.sql`
- `ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS archived_at timestamptz;` + `COMMENT ON COLUMN` (workspaces:1637 문형). 부분 인덱스 `CREATE INDEX idx_job_postings_container_active ON job_postings (workspace_id) WHERE status='container' AND archived_at IS NULL;`
- `CREATE OR REPLACE FUNCTION public.archive_venue_container(p_container_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'` — 권한 게이트는 `update_venue_container`(20260731120000)의 4단 게이트를 **그대로 복제**한다(`COALESCE(owner_id = caller, false) OR is_workspace_member(ws,caller) OR is_posting_collaborator(id,caller) OR is_admin()`; bare `owner_id = caller` 금지 — owner_id NULL 시 fail-open 사고 [HIGH-1]).
- 아카이브 전제조건(fail-closed): `EXISTS (SELECT 1 FROM work_logs wl WHERE wl.job_posting_id IN (SELECT venue_span_posting_ids(p_container_id)) AND wl.date >= to_char(now() AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD') AND wl.status NOT IN ('cancelled','no_show'))` 이면 `{'success':false,'error':'future_work_logs_exist','count':n}` 반환. **과거 이력은 막지 않는다** — 그게 아카이브의 존재 이유다.
- `UPDATE job_postings SET archived_at = now(), updated_at = now() WHERE id = p_container_id AND status='container' AND archived_at IS NULL`. 멱등(이미 아카이브면 `{'success':true,'idempotent':true}`).
- 짝 함수 `restore_venue_container(p_container_id uuid)` — `archived_at = NULL`. `restore_workspace`(baseline:8789) 문형.
- `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated, service_role;`

**② 읽기 경로 차단** — `src/domains/workSchedule/venueContainer.ts:120-121` 의 `VENUE_CONTAINER_COLUMNS` 에 `archived_at` 추가(이 상수는 SSOT 라 안 넣으면 저장돼도 안 읽힌다 — 파일 주석 115-118행이 경고하는 #194 클래스), `VenueContainer` 인터페이스에 `archivedAt?: string | null`, `parseVenueContainer` 매핑 추가. `JobPostingRepositoryVenue.getVenueContainers`(53-58행 쿼리)에 `.is('archived_at', null)` 추가. `getVenueContainerById` 는 **필터하지 않는다**(아카이브된 지점의 과거 정산을 열 수 있어야 하므로).

**③ 자동 재생성 차단(필수)** — `src/hooks/workSchedule/useEnsureDefaultVenue.ts:39-45` 의 발사 조건에 `hasArchivedVenue === false` 를 추가한다. 지금 그대로면 마지막 지점을 아카이브한 직후 다음 마운트에서 `{닉네임}의 지점` 이 되살아나 사용자가 '지워지지 않는다'고 느낀다. 호출부(work-schedule 화면)가 아카이브 포함 카운트를 알아야 하므로 `getVenueContainers` 에 `{ includeArchived }` 옵션을 두거나 별도 `hasAnyVenue` 카운트 쿼리를 쓴다.

**④ UI** — `VenueSettingsSheet.tsx` 하단(346행 '역할 추가' 버튼 아래)에 구분선 + `Button variant='outline'` '이 지점 보관하기'. `confirmAction({title:'지점 보관', message:`'${container.name}' 을 목록에서 숨길까요? 지난 근무·정산 기록은 그대로 남고, 언제든 되돌릴 수 있어요.`, confirmText:'보관하기', destructive:true})`. 실패 시 서버 한글 사유 노출(saveProfile 113-118행의 `isAppError(err) && err.userMessage` 패턴 재사용). 복원 진입점은 `VenueSelector` 하단 '보관된 지점' 링크 또는 근무표 설정 — `app/(employer)/workspace/archived.tsx`(63-73행 카드 + 복원 버튼) 문형 복제.

**⑤ 훅/서비스** — `useArchiveVenueContainer`/`useRestoreVenueContainer`(`useUpdateVenueContainer.ts` 문형), 서비스는 `gridWriteService` 에 `archiveVenueContainer`/`restoreVenueContainer` 위임 함수(Hook→Service→Repository 준수).

**⑥ 테스트** — `VenueSettingsSheet.test.tsx` 에 보관 버튼 렌더·confirm 게이트, 리포지토리 쿼리 테스트(`.is('archived_at', null)` 호출 단언), `useEnsureDefaultVenue` 재생성 차단 테스트, pgTAP 로 미래 work_logs 존재 시 거부·비인가 거부.

### DB 변경
① `job_postings.archived_at timestamptz` 컬럼 신설 + 부분 인덱스 1개. nullable 이므로 기존 행 무영향, `VENUE_CONTAINER_COLUMNS`(SSOT)와 `src/types/supabase.ts` 재생성 필요(supabase-patterns §9 4단계 준수). ② SECDEF RPC 2종 신설 `archive_venue_container(uuid)`·`restore_venue_container(uuid)` → 파리티 함수 수 +2. ③ RLS 정책 변경 없음 — 컨테이너 직접 UPDATE 는 `jp_container_no_direct_update`(RESTRICTIVE)가 막으므로 반드시 SECDEF RPC 경유여야 한다. ④ 트리거 영향: 컨테이너 UPDATE 로 발화 가능한 것은 `job_posting_notify_update`(수신자=활성 지원자, 컨테이너 대상 applications 0건)와 `fn_recalc_total_and_capacity`(컨테이너 명시 분기로 즉시 반환) — 20260731120000 주석이 실측한 그대로다. 트리거 중복 검사(`node scripts/graph-db-deps.mjs triggers`)는 새 트리거를 안 만들므로 불요. ⑤ 하드닝: `SET search_path TO 'public','pg_temp'`, `REVOKE FROM PUBLIC, anon`.

### 리스크
① **자동 재생성 루프**가 최대 위험이다. `useEnsureDefaultVenue` 가드를 빼먹으면 '보관했는데 다시 생긴다' → 사용자는 버그로 인식한다. 이 가드는 수정의 일부이지 후속이 아니다.
② 아카이브된 지점을 참조하는 기존 화면이 조용히 빈 목록을 낸다: `settlementVenueQuery.ts`·`WorkLogRepositoryVenue.venueSpan`·`get_my_venue_contexts`(스태프가 보는 지점명). 스태프 쪽은 **절대 필터하면 안 된다** — 지난 근무의 지점명이 '이벤트'로 퇴행한다(20260731120000 이 고친 바로 그 증상). 필터는 `getVenueContainers`(사장 목록) 한 곳에만 건다.
③ `uniq_venue_container` 부분 인덱스가 `WHERE status='container'` 라 아카이브해도 이름을 점유한다. 같은 이름으로 새 지점을 만들면 `ON CONFLICT … DO NOTHING` 이 아카이브된 행을 반환한다(baseline:2980-2992) → 사용자는 '보관한 지점이 되살아났다'고 본다. 인덱스 조건에 `AND archived_at IS NULL` 을 추가하거나 get-or-create 에서 아카이브 행을 자동 복원할지 결정해야 한다. **이 항목은 마이그레이션에 반드시 포함되어야 한다.**
④ `job_postings` 는 큰 테이블이다. ADD COLUMN(nullable, DEFAULT 없음)은 PG11+ 에서 즉시 완료되므로 락 위험 낮음. 인덱스는 `CREATE INDEX`(CONCURRENTLY 불가 — 마이그 트랜잭션 안) 이므로 컨테이너 행 수가 적어 문제없다.

### 선행 의존성
③번 위험(uniq_venue_container 재사용 충돌)의 처리 방침이 마이그레이션 설계에 선행해야 한다 — 인덱스 조건 변경 vs get-or-create 자동 복원 중 택일. 그 외 선행 작업 없음. 메모리 기재 '주소 검색 1단계 B1'(`project_address_search_phase1`)이 `location` jsonb 축을 건드리므로 `VenueSettingsSheet` 파일 충돌 가능성이 있다 — 머지 순서 확인 필요.

### 🔍 검증 — 놓친 제약
① 리스크 ③은 '택일'이 아니라 강결합이다: uniq_venue_container 술어를 AND archived_at IS NULL 로 바꾸면 get_or_create_venue_container 의 ON CONFLICT (…) WHERE status='container' 절(baseline:2980)이 인덱스 술어와 불일치해 유니크 인퍼런스 실패(42P10)로 지점 생성 전체가 즉사한다. 인덱스 변경을 고르면 get_or_create 재정의가 강제 동반되고, 그 CREATE OR REPLACE 는 proconfig(SET search_path) 통째 교체 함정(S3 실사고 — pg_proc.proconfig 실측 후 베이스 확정 필수). get-or-create 자동 복원 쪽이 마이그 반경이 훨씬 작다. ② '선행: B1 머지 순서 확인'은 stale — B1 은 PR#391 로 이미 머지됐고 VenueSettingsSheet 최종 커밋은 #370 이라 충돌 없음. 대신 파일 헤더(14-15행)가 주소검색 2단계에서 이 시트에 주소 컴포넌트를 얹을 것을 예고하므로 후속 웨이브와의 조정 필요성은 방향만 바뀌어 유효. ③ SECDEF RPC 2종 신설 = 주간 파리티 감시(함수 수) 항목 갱신 대상.

### 🔧 검증 — 설계 보정
전 인용 실측 일치: 시트 350행·파괴 액션은 단가 삭제 하나(147-158행), 훅 배럴 delete 부재, uniq_venue_container(11967)·jp_delete_workspace_owner(13613, 컨테이너 미제외)·jp_container RESTRICTIVE 2종(DELETE 대응물 없음)·FK ON DELETE 절 없음(12783·13063)·get_or_create fallback SELECT 가 아카이브 행을 반환(2984-2992)·workspaces.archived_at 선례(1637 주석 원문 일치)·update_venue_container 4단 게이트(20260731120000:105-108 COALESCE 포함). 수정설계의 핵심 판단(스태프 읽기 경로는 절대 필터 금지, useEnsureDefaultVenue 가드는 수정의 일부)도 실측과 부합 — useEnsureDefaultVenue 의 발사 가드는 세션 내 ref 뿐이라 재시작 시 재생성이 실제로 일어난다(39-45행).

### 검증 메모
기각가설 4종 전부 타당 — 특히 (a)의 '이력 0 지점은 지금도 PostgREST DELETE 가능' 관찰이 정확하다(RESTRICTIVE 정책에 DELETE 대응물이 없음을 실측). 선행 결정(인덱스 vs 자동 복원)을 correction ① 의 강결합 인지 위에서 다시 내려야 한다.

### 🙋 사람이 결정할 것
① 근무 이력이 0건인 지점은 **하드 삭제**를 허용할 것인가(오타 지점 즉시 제거), 아니면 전부 아카이브로 통일할 것인가? 하드 삭제를 허용하면 '보관'과 '삭제' 두 버튼이 생겨 UI 가 복잡해지고, 통일하면 오타 지점이 보관함에 영구히 쌓인다.
② 아카이브된 지점의 과거 정산·근무 이력을 사장이 어디서 보는가? 정산 화면이 지점 목록에서 그 지점을 못 찾으면 과거 정산이 사실상 소실된다 — 정산 조회에는 아카이브를 포함할지 결정 필요.
③ 미래 배치가 남아 있을 때 '보관 불가'로 거부할지, '남은 배치 N건을 함께 취소하고 보관' 옵션을 줄지.


## `notification-delete-no-confirm` — 알림 개별 삭제가 확인도 되돌리기도 없는 하드 DELETE — 게다가 옵티미스틱 제거는 온라인에서 죽은 코드다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→M · **마이그레이션**: 불필요

### 근거 (실측)
① 확인 없음 — `app/(app)/notifications.tsx:93-99`
```
const handleDelete = useCallback((notificationId: string) => {
  deleteNotification(notificationId);   // 확인·되돌리기 없음
}, [deleteNotification]);
```
같은 파일 106-118행 `handleDeleteAll` 은 `confirmAction({title:'알림 모두 삭제', message:'모든 알림이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.', destructive:true})` 로 게이트가 있다. 주장대로 **개별만 무방비**다.
② 휴지통 버튼 — `src/components/notifications/NotificationItem.tsx:119-129`, `showDelete && onDelete` 일 때 `absolute right-2 top-3` 에 TrashIcon. `notifications.tsx:214` 가 `showDelete={true}` 로 상시 노출. 본문 Pressable(69-117행)과 우상단 8px hitSlop 버튼이 인접해 오탭 위험이 실재한다.
③ 하드 DELETE — `src/repositories/supabase/NotificationRepository.ts:352-393` `async delete()`: 선조회로 `wasUnread` 를 얻은 뒤 `supabase.from(TABLES.NOTIFICATIONS).delete().eq('id', notificationId)`. `notifications` 테이블에 `deleted_at`/`dismissed` 축 없음. 서비스(`notificationReadStateService.ts:206-219`)는 `wasUnread` 면 미읽음 카운터를 감소시킨다. **복구 수단 0.**
④ 되돌리기 선례는 이미 있다 — `src/hooks/useTemplateManager.ts:31` `const UNDO_DELAY_MS = 5000;`, 213-302행 전문이 옵티미스틱 제거 → 5초 Undo 토스트 → 타이머 만료 시 실제 DELETE → '되돌리기' 탭 시 `clearTimeout` + 원래 인덱스 복원. `toastStore.ts:23` 이 `action?: { label, onPress }` 를 지원한다. `.claude/rules/impeccable-design.md §12` 는 'Undo > Confirm' 을 명시한다.

### 근본 원인
미완성이다. 개별 삭제는 초기부터 있었고, '모두 삭제'가 나중에 붙으면서 그쪽에만 확인 게이트가 들어갔다(테스트 파일 `app/(app)/__tests__/NotificationsScreen.test.tsx:5` 주석이 '모두 삭제(확인 게이트)·알림 설정 진입 버튼 검증'이라고 스코프를 밝힌다 — 85-102행이 전체 삭제 게이트만 잠근다). 개별 삭제는 '옵티미스틱 업데이트를 넣었으니 충분하다'고 판단된 흔적이 있다(`useNotifications.ts:345` 주석 'Optimistic Update: 서버 응답 전에 UI 즉시 업데이트'). 그런데 그 옵티미스틱이 실제로는 동작하지 않는다 — 아래 인과사슬 참조. 즉 '되돌릴 필요가 없을 만큼 즉각적이다'라는 전제가 코드 수준에서 이미 거짓이었다.

### 인과사슬
사용자가 알림 항목의 우상단 휴지통을 오탭한다(NotificationItem.tsx:120) → `handleDelete`(notifications.tsx:94) → `useDeleteNotification.mutate`(useNotifications.ts:334-385) → `onMutate` 가 `removeNotification(id)` 로 **notificationStore 에서만** 제거한다(354행) → **그런데 화면은 스토어를 안 본다**: `useNotificationList` 의 반환값 `effectiveNotifications`(useNotifications.ts:218-224)는 `if (isOffline && cachedNotifications.length>0) return cachedNotifications; return query.data ?? cachedNotifications;` 이고, 온라인에서는 `query.data`(TanStack 캐시)가 이긴다. `useGroupedNotifications`(684-693행)가 그 값을 그대로 그룹핑해 리스트에 넘긴다 → 따라서 항목은 **화면에 그대로 남아 있다가**, `mutationFn` 의 서버 DELETE 가 끝나고 `onSuccess` 의 `invalidateQueries(notificationKeys.all)` 로 재조회가 완료된 뒤에야 사라진다 → 같은 이유로 `onError` 의 롤백(`setNotifications(previousNotifications)`, 370행)도 화면에 아무 영향이 없다 → 그 사이 서버 행은 이미 하드 DELETE 되어 제목·본문·`data`(applicationId·jobPostingId·확정 내용·근무 날짜)가 영구 소실된다 → 사용자는 '무엇을 지웠는지' 확인할 방법이 없다. `notifications` 는 푸시 페이로드의 유일한 영속 사본이므로(딥링크 `data` 포함) 근무 확정·시각 변경 같은 계약성 통지가 통째로 날아간다.

### 파급 범위
전 사용자(스태프·사장·admin 공통 화면). 닿는 코드: `app/(app)/notifications.tsx`, `src/components/notifications/NotificationItem.tsx`·`NotificationList.tsx`, `src/hooks/useNotifications.ts`(useDeleteNotification·useNotificationList·useGroupedNotifications), `src/stores/notificationStore.ts`(removeNotification 368-386·addNotification 295-315·미읽음 카운터 증감), `src/services/notifications/internal/notificationReadStateService.ts:206-219`(카운터 감소), `NotificationRepository.delete`. **부수 발견**: 같은 `effectiveNotifications` 구조 때문에 `useDeleteAllNotifications`(394-442)의 `clearNotifications()` 낙관 갱신도 온라인에서 화면에 반영되지 않는다 — 같은 클래스의 두 번째 사례다. e2e 에는 알림 삭제 커버리지가 없다(grep `notifications-delete-all` in `e2e/` → 0건).

### 기각한 경쟁 가설
(a) **소프트 삭제(read/dismissed 플래그)라 복구 가능하다** — 기각. `NotificationRepository` 의 4개 삭제 메서드(`delete` 352·`deleteMany` 395·`deleteOlderThan` 437·`deleteAllByRecipient` 469) 전부 `supabase.from(...).delete()` 물리 삭제다. `notifications` 테이블에 소프트 삭제 컬럼이 없고, `is_read` 는 읽음 축이지 삭제 축이 아니다.
(b) **되돌리기 패턴이 이 레포에 없어서 확인 다이얼로그가 유일한 선택지다** — 기각. `useTemplateManager.ts:213-302` 가 완성된 Undo 구현이고 `toastStore` 가 `action` 을 지원한다. 테스트도 있다(`src/__tests__/hooks/useTemplateManager.delete.test.tsx` — '되돌리기 시 DELETE 를 취소하고 복원한다', 연속 삭제 경쟁까지 잠금).
(c) **옵티미스틱 업데이트가 이미 즉시 피드백을 준다** — 기각. 위 인과사슬에서 코드로 반증했다: 리스트 소스가 `query.data` 라 스토어 변경이 화면에 닿지 않는다. `shouldApplyOptimisticUpdate()`(remoteMutationGuard.ts:43-45)는 `isNetworkAvailableForMutation()` 을 그대로 반환하므로 온라인에서 true 다 — 즉 코드는 실행되지만 효과가 없다.
(d) **확인 다이얼로그가 정답이다** — 기각(설계 판단). impeccable §12 는 '확인 다이얼로그는 사용자가 무의식적으로 통과한다. 가능하면 UI 즉시 제거 + 토스트 되돌리기'를 명시하고, 계정 삭제·결제·일괄 작업에만 다이얼로그를 쓰라고 한다. 알림 개별 삭제는 고빈도·저위험 반복 작업이라 매번 다이얼로그가 뜨면 목록 정리가 사실상 불가능해진다. **'모두 삭제'는 일괄 작업이므로 현행 다이얼로그 유지가 맞다** — 두 액션의 처리가 달라야 한다는 것이 결론이지 불일치가 아니다.

### 수정 설계
`useDeleteNotification`(src/hooks/useNotifications.ts:334-385)을 `useTemplateManager` 문형으로 재작성한다. useMutation 을 버리고 지연 커밋 방식으로 바꾼다.

1) **상수 승격** — `useTemplateManager.ts:31` 의 `const UNDO_DELAY_MS = 5000` 을 `src/constants/undo.ts` 로 옮겨 SSOT 화하고 양쪽이 import 한다(로컬 복제 금지 — 메모리 기재 `SHEET_DISMISS_ANIMATION_MS` 교훈).

2) **훅 재작성** (`useNotifications.ts`)
```
const listKey = notificationKeys.list({});           // notifications.tsx 는 filter 없이 쓴다
const pendingDeletesRef = useRef<Map<string,{timer; commit:()=>void}>>(new Map());
// 언마운트 flush — useTemplateManager.ts:138-147 그대로
```
- 삭제 시: `queryClient.getQueryData<NotificationData[]>(listKey)` 로 현재 목록과 **원래 인덱스**를 잡고, `setQueryData(listKey, list.filter(n=>n.id!==id))` 로 즉시 제거한다(이게 핵심 — 스토어만 건드리면 화면이 안 바뀐다). 동시에 `removeNotification(id)` 로 스토어·미읽음 카운터도 맞춘다.
- `restore()`: `setQueryData` 로 **원래 인덱스에 splice 재삽입**(전체 스냅샷 덮어쓰기 금지 — 연속 삭제 경쟁 방지, useTemplateManager.ts:231-241 근거) + `addNotification(deleted)` 로 스토어 복원(카운터 재증가).
- `commit()`: 1회 가드(`committed` 플래그) → `pendingDeletesRef.delete(id)` → `deleteNotificationService(id)` → 성공 시 `invalidateQueries(notificationKeys.all)`, 실패 시 `restore()` + 에러 토스트.
- `setTimeout(commit, UNDO_DELAY_MS)` + `addToast({type:'success', message:'알림을 삭제했어요', duration: UNDO_DELAY_MS, action:{label:'되돌리기', onPress:()=>{clearTimeout; pendingDeletesRef.delete; restore();}}})`.
- 오프라인: `requireOnlineForMutation` 을 **commit 시점**으로 옮긴다(지금은 mutationFn 최상단 341행). 오프라인에서 5초 대기 후 실패하면 restore 가 돌아 자연스럽다.

3) **실시간 되살아남 차단(필수)** — `useNotificationList` 의 realtime 구독(129-147행)이 어떤 알림 변경에나 `invalidateQueries(notificationKeys.all)` 를 쏜다. 5초 창 안에 새 알림이 오면 재조회가 삭제 대기 항목을 되살린다. `pendingDeletesRef` 의 id 집합을 훅 밖으로 노출하고 `useGroupedNotifications` 의 `groupedNotifications` 계산(699-705행) 직전에 `rawNotifications.filter(n => !pendingIds.has(n.id))` 를 끼운다. 가장 단순한 배선은 pending id 집합을 `notificationStore` 에 두는 것이다(이미 스토어가 목록·카운터의 주인).

4) **'모두 삭제'는 그대로 둔다** — 일괄 파괴 작업이라 confirmAction 유지가 맞다(notifications.tsx:106-118). 단 `useDeleteAllNotifications` 의 `clearNotifications()` 낙관 갱신도 같은 이유로 화면에 안 닿으므로, `setQueryData(listKey, [])` 를 함께 호출해 즉시 반영시킨다(1줄).

5) **테스트** — `src/hooks/__tests__/useNotifications.undo.test.ts` 신설. `useTemplateManager.delete.test.tsx` 의 `findUndo` 헬퍼 문형 복제: (a) 삭제 직후 서비스가 호출되지 않고 목록에서 사라진다 (b) 되돌리기 시 `deleteNotificationService` 가 **한 번도** 호출되지 않고 원래 인덱스에 복원된다 (c) 5초 경과 후 정확히 1회 호출된다(fake timers) (d) 연속 2건 삭제 후 첫 건만 되돌리면 둘째는 그대로 삭제된다. red-green 확인 필수.

### 리스크
① **언마운트 flush 누락**이 가장 흔한 함정이다. 5초 창 안에 화면을 벗어나면 타이머가 죽어 알림이 영영 안 지워지고, 다음 진입에 되살아난 것처럼 보인다. `useTemplateManager.ts:138-147` 의 cleanup(남은 pending 을 즉시 commit)을 반드시 이식한다.
② **실시간 invalidate 경합** — 위 fixDesign 3) 을 빼면 새 알림 1건이 도착하는 순간 삭제 대기 항목이 화면에 되살아난다. 알림 화면은 realtime 구독이 상시 붙어 있어 재현 확률이 높다.
③ **미읽음 카운터 이중 감소** — 서버 커밋 시 `decrementUnreadCounterWithRetry(1)`(notificationReadStateService.ts:210)가 돌고, 낙관 제거 시 `removeNotification` 도 `decrementUnreadCounts` 를 태운다(notificationStore.ts:374-379). 지금 코드도 같은 구조이므로 새 위험은 아니나, restore 경로에서 `addNotification` 이 `incrementUnreadCounts` 로 되돌리는지 확인해야 한다(notificationStore.ts:300-305 — isRead=false 일 때만 증가하므로 대칭이다).
④ 깨질 수 있는 기존 테스트: `app/(app)/__tests__/NotificationsScreen.test.tsx` 는 `useDeleteNotification: () => ({ deleteNotification: jest.fn() })` 로 훅을 통째 모킹(54행)하므로 반환 형태(`deleteNotification` 키)만 유지하면 통과한다. `src/__tests__/hooks/useNotifications.test.ts`·`useNotifications.deleteAll.test.ts` 는 재확인 필요.

### 선행 의존성
없음. 서버·DB 변경이 전혀 없고 선례 구현(useTemplateManager)과 토스트 action 지원이 모두 선재한다. 다만 fixDesign 3)(pending id 를 렌더에서 제외)이 `notificationStore` 를 건드리므로, 알림 스토어를 만지는 다른 작업과 파일 충돌만 확인하면 된다.

### 🔍 검증 — 놓친 제약
① notificationStore 는 MMKV persist 스토어다(partialize 549행) — 설계가 권한 'pending id 를 스토어에 두는 배선'을 그대로 하면 partialize 제외를 빠뜨렸을 때 재시작 후 알림이 영구 은닉된다. 제외를 설계 명세에 못박아야 한다. ② 목록 소스가 이원적이다: fetchNextPage 는 스토어에만 append(208행) 하므로 2페이지 이후 항목은 setQueryData(listKey) 만으론 안 지워진다 — 스토어·캐시 양쪽 제거는 설계에 있으나, restore 의 '원래 인덱스 splice' 는 캐시 쪽만 성립하고 스토어 addNotification 은 무조건 prepend(300행) 라 페이지 경계 항목은 복원 위치가 어긋난다(기능 무해, 명시 필요). ③ 5초 창 내 오프라인 전환 시 commit 의 deleteNotificationService 가 NetworkError 로 실패→restore 발동 — '되살아난' 데 대한 안내 문구가 없으면 사용자가 버그로 인식한다.

### 🔧 검증 — 설계 보정
인용 오류 1건: src/__tests__/hooks/useNotifications.deleteAll.test.ts 는 존재하지 않는다(useNotifications.test.ts 만 실재 — 디렉토리 전수 확인). 핵심 주장은 전부 실측 재현: effectiveNotifications 가 온라인에서 query.data 를 채택(219-224행), onMutate 는 스토어만 제거(354행), showDelete 상시(214행), 삭제 4종 전부 물리 DELETE, shouldApplyOptimisticUpdate=온라인 true(43-45행), Undo 선례 완비(UNDO_DELAY_MS 31행·언마운트 flush 138-147행·toast action 23행), 실시간 invalidate 되살아남 경로(137행), deleteAll 낙관 갱신도 동일 클래스라는 부수 발견, 미읽음 카운터 대칭(incrementUnreadCounts/decrementUnreadCounts) — 전부 일치. 화면 테스트 목 형태 유지 조건(deleteNotification 키)도 실물 확인(테스트 54행 부근).

### 검증 메모
'옵티미스틱이 온라인에서 죽은 코드' 라는 반직관적 주장을 코드로 반증까지 해 둔 부분이 실제 코드와 정확히 일치한다. 기각가설 (d)의 'Undo>Confirm, 모두 삭제는 다이얼로그 유지' 판단은 impeccable §12 원문과 부합. M 유지 — 실시간 경합·persist·이원 소스까지 감안하면 S 로 낙관할 수 없다.

### 🙋 사람이 결정할 것
① Undo 창 길이 5초가 이 맥락에 맞는가? 템플릿 삭제와 달리 알림은 스크롤하며 연속으로 지우는 패턴이라 여러 건이 동시에 대기할 수 있다 — 토스트를 건별로 쌓을지, '3건 삭제 · 되돌리기' 로 합칠지 제품 결정이 필요하다.
② 별개 결함으로 분리해 다룰지: `effectiveNotifications = query.data ?? cachedNotifications` 구조 때문에 알림 화면의 **모든** 낙관 갱신(삭제·전체삭제·읽음)이 온라인에서 무력하다. 이번 수정은 삭제 축만 고친다 — 읽음 축(`useMarkAsRead` 의 `markAsReadLocal`)도 같은 문제인지 별도 확인이 필요하다.



---

# D-회색버튼


## `apply-submit-disabled-silent` — D1. 구직자 지원 폼 '지원하기' 버튼이 4가지 이유 중 무엇 때문에 회색인지 말하지 않는다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: S→M · **마이그레이션**: 불필요

### 근거 (실측)
`uniqn-mobile/src/components/jobs/ApplicationForm.tsx:161-185` 의 `canSubmit` 이 진실원이고, 같은 파일 `:246-250` 이 `footer = <Button onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} fullWidth>지원하기</Button>` 로 **사유 없이** 비활성만 건다. 비활성 조건 전수(내가 읽은 그대로):
(1) `:162` `isSubmitting` — 이건 `loading` prop 이 스피너로 이미 말한다(무해).
(2) `:166` `assignmentsForSubmit.length === 0` — 날짜·역할 미선택.
(3) `:170` `hasPreQuestions && findUnansweredRequired(preQuestionAnswers).length > 0` — 필수 사전질문 미답변(`src/types/preQuestion.ts:95-97` = `a.required && !a.answer.trim()`).
(4) `:174` `!provisionConsentAgreed` — 제3자 제공 동의 체크박스(`:356-385`, `testID="provision-consent-checkbox"`) 미체크.
버튼 자체는 `src/components/ui/Button.tsx:221-235` 에서 `disabled` 를 그대로 Pressable 에 넘기므로 **탭 이벤트조차 발생하지 않는다** — 탭해서 토스트가 뜨는 우회로도 없다. 화면 어디에도 이 4개를 설명하는 문구가 없다(같은 파일 전체 Read 로 확인).

### 근본 원인
설계 누락 + 하네스 패턴 확산 미완. 이 레포에는 **이미 정착한 '게이트 사유 힌트' 관용구**가 있다 — `src/components/employer/order-sheet/sheets/PlaceSheet.tsx:132-136` 이 원조이고(PR #257), `WorkConditionSheet.tsx:79-84` 가 코드 주석에 `힌트 패턴은 PlaceSheet 를 따랐다`(:78)라고 명시하며 복제했다(PR #360). `ApplicationForm` 은 그보다 오래된 화면이라 관용구가 생기기 전에 굳었고, 이후 아무도 역이식하지 않았다.
여기에 더해 **자기 안에 있던 사유 표시 장치가 스스로 죽었다**: `:187-198` `handleSubmit` 은 `if (!canSubmit) return;` 로 시작한 뒤 그 아래에서 `setErrorQuestionIds(unanswered)` 를 호출하는데, `canSubmit` 은 미답변 필수질문이 있으면 이미 false 다(:170). 즉 `setErrorQuestionIds` 는 **도달 불가능**하고, `errorQuestionIds` 는 영원히 `[]` 다. 리팩터링 잔해다(비활성 게이트를 나중에 추가하면서 앞서 있던 인라인 에러 경로를 덮었다).

### 인과사슬
사용자가 지원 시트를 연다 → 시트는 fullHeight(`:260`)라 스크롤이 길다(공고요약 → 날짜·역할 → 사전질문 → 자기소개 200자 → **동의 체크박스** → 안내문) → 동의 체크박스는 자기소개 아래(`:356`)에 있어 첫 화면에 안 보인다 → sticky footer 의 '지원하기'만 계속 회색으로 보인다 → `Button.tsx:225` 의 `disabled` 때문에 탭해도 `onPress` 가 안 불려 **아무 피드백도 없다** → 사용자는 앱이 고장났다고 판단하고 이탈한다.
필수 사전질문 경로는 더 나쁘다: `PreQuestionForm.tsx:179-183` 에 `필수 질문입니다. 답변을 입력해주세요.` 라는 **정확히 맞는 문구가 이미 구현돼 있고** `:120-121` 의 `borderColor = hasError ? 'border-error-500 …'` 로 빨간 테두리까지 그린다. 그런데 `hasError = errorQuestionIds.includes(question.id)`(`PreQuestionForm.tsx:271`)이고 `errorQuestionIds` 는 위 인과로 항상 빈 배열이므로, **이 UI 는 앱 수명 내내 한 번도 렌더된 적이 없다.** 사유를 말할 코드를 이미 짜 놓고, 그 코드에 도달하지 못하게 게이트를 앞에 세운 것이다.

### 파급 범위
`ApplicationForm` 소비처는 `app/(app)/jobs/[id]/apply.tsx:360` **단 한 곳**(grep `<ApplicationForm` 전수). 구직자(staff) 전원의 유일한 지원 경로라 사용자 영향은 앱 최대폭이다.
부수 파급 2건: (a) `PreQuestionForm` 의 `errorQuestionIds`/`hasError`/에러 Text/빨간 테두리 4개 심볼이 死코드로 확정된다 — 살리든 지우든 결정이 필요하다. (b) `ApplicationForm.tsx:296-302` 의 `FixedRoleSelector` 분기도 **도달 불가**다: `apply.tsx:346-354` 가 `isFixed` 면 `FixedPostingState` 로 조기 반환하고, `ApplicationForm` 의 `isFixedMode` 는 `postingFacts.workflow.isFixed`(`src/domains/job-posting/selectors.ts:14` = `posting.schedule.kind === 'fixed'`)로 **같은 식**이다. 따라서 사유 문구는 dated 분기만 쓰면 된다(고정공고 '역할 미선택' 문구는 불필요).

### 기각한 경쟁 가설
(a) 기각 — 'useSubmitGate 가 사유를 이미 계산 중인데 안 쓴다': **거짓**이다. `src/hooks/useSubmitGate.ts` 전체를 읽었고 반환값은 `{ submit, isSubmitting }` 둘뿐(:6-14)이며 주석(:34-49)이 명시하듯 이 훅의 책임은 '결과 보기 전 성공 선언 차단'(중복제출 ref 가드 + mutateAsync await)이지 폼 검증이 아니다. 게다가 grep 결과 이 훅의 소비처 5곳(`useStaffSettlementsHandlers`·`CancellationRequestCard`·`cancellation-requests.tsx`·`applicants.tsx`·`employer.tsx`)에 **apply 경로가 아예 없다**.
(b) 기각 — '다른 경로로 이미 안내 중': `AssignmentSelector.tsx:236` 의 `원하는 시간과 역할을 선택해 주세요` 는 선택 위젯의 상시 안내문이지 게이트 사유가 아니다(선택을 마쳐도 사라지지 않고, 동의·사전질문은 언급 없음). `:387-395` 의 안내 박스도 '지원 후 절차' 설명이다.
(c) 기각 — '의도적 제약(보안/개인정보)': 동의 체크박스 자체는 개보법 §17 준수로 정당하다. 그러나 '동의가 필수'라는 사실을 **말하지 않는 것**이 요구사항일 수는 없다 — 같은 PR 계열이 만든 `PlaceSheet`/`WorkConditionSheet` 는 동일 성격의 필수 게이트에 문구를 붙였다.
(d) 부분 채택 — '리팩터링 잔해': `setErrorQuestionIds` 死코드가 이 가설의 직접 증거다.

### 수정 설계
**[공통 패턴 D0 — 4곳 전부 이것 하나만 쓴다]**
1. 신규 프리미티브 `uniqn-mobile/src/components/ui/GateHint.tsx` + `src/components/ui/index.ts` 배럴 등록. 시그니처: `GateHint({ reason, align = 'center', className, testID })`. `reason` 이 `undefined`/빈 문자열이면 `null` 반환. 렌더는 레포 기존 관용구를 그대로 승격: `<Text className={`text-xs text-content-muted font-sans ${align === 'center' ? 'text-center' : ''}`}>` (`content-muted` 는 `global.css:9/19` 에 라이트·다크 CSS 변수가 양쪽 정의돼 있어 `dark:` 짝이 불필요 — 기존 259 사용처 중 119곳이 이미 dark 없이 쓴다).
2. **드리프트 구조적 차단**: 각 화면은 `const blockReason = resolveXxxBlockReason(...)` 를 먼저 구하고 `disabled={blockReason !== undefined}` 로 **게이트를 사유에서 파생**시킨다. 불리언 게이트와 문구를 따로 두면 `WorkConditionSheet.tsx:56-57` 이 경고한 그 드리프트(`같은 식이어야 한다`)가 4곳에서 재발한다.
3. 스크린리더: 비활성 컨트롤에 `accessibilityHint={blockReason}` 을 함께 넘긴다(`ReportModal.tsx:304-306` 선례). `Button.tsx:224` 이 `{...props}` 를 먼저 펴고 뒤에서 role/label/state 만 덮으므로 `accessibilityHint` 는 그대로 통과한다. `accessibilityLiveRegion` 은 Android 전용이라 쓰지 않는다.
4. 문구 규칙: **한 번에 한 사유**, 화면에서 사용자가 마주치는 순서(위→아래)로 첫 번째 것만. 어미는 기존 관용구 그대로 `…하면 …할 수 있어요`.

**[D1 적용]**
- 신규 순수 함수 `uniqn-mobile/src/domains/application/applyGate.ts` → `resolveApplySubmitBlockReason({ hasAssignments, hasPreQuestions, unansweredRequiredCount, provisionConsentAgreed }): string | undefined`. 반환 순서: 미선택 → `'날짜와 역할을 선택하면 지원할 수 있어요'` / 필수질문 미답변 → `'필수 질문 N개에 답하면 지원할 수 있어요'` / 미동의 → `'개인정보 제공에 동의하면 지원할 수 있어요'`. `src/domains/application/index.ts` 배럴에 export 추가.
- `ApplicationForm.tsx`: `canSubmit`(:161-185)을 삭제하고 `const submitBlockReason = useMemo(() => resolveApplySubmitBlockReason({...}), [...])` 로 대체, `const canSubmit = !isSubmitting && submitBlockReason === undefined`. footer(:246-250)를 `<View className="gap-2"><GateHint reason={isSubmitting ? undefined : submitBlockReason} /><Button … disabled={!canSubmit} accessibilityHint={submitBlockReason} /></View>` 로 교체(PlaceSheet 형태 그대로).
- 死코드 처리: `handleSubmit`(:187-198)의 `if (hasPreQuestions) { … setErrorQuestionIds … }` 블록을 제거하고, `errorQuestionIds` state(:116)는 **살린다** — 대신 `submitBlockReason` 이 사전질문 사유일 때 `errorQuestionIds` 를 `findUnansweredRequired(preQuestionAnswers)` 로 채우는 `useMemo` 파생값으로 바꿔 `PreQuestionForm.tsx:179-183` 의 빨간 테두리+문구를 **처음으로 살아 있게** 만든다(사용자가 어느 질문인지 바로 찾는다).

### 리스크
① `src/components/jobs/__tests__/ApplicationForm.test.tsx:56-77` 의 `SheetModal` jest mock 이 `children` 만 렌더하고 **`footer` 를 렌더하지 않는다** — 힌트도 '지원하기' 버튼도 이 테스트에서는 보이지 않는다. 힌트 테스트를 쓰려면 mock 에 `{footer}` 를 추가해야 하고(`ScheduleSlotsSheet.test.tsx:12-24` 의 mock 이 이미 `{footer}` 를 렌더하니 그걸 베낀다), 안 고치면 '테스트 green 인데 화면엔 없음'이 된다. ② `errorQuestionIds` 를 파생값으로 바꾸면 사용자가 입력 중에도 빨간 테두리가 즉시 뜬다 — 입력 전부터 붉은 폼은 공격적이다. 완화: '한 번이라도 제출 시도했는가' 플래그는 이제 없으므로, 사전질문 사유는 힌트 문구만 쓰고 인라인 에러는 별도 결정으로 미룰 수 있다(openQuestion 참조). ③ 사유 문자열은 `e2e/` 밖이라 quality 게이트 영향 없음(grep 확인: apply 관련 e2e 에 '지원하기' 라벨 단언은 있으나 힌트 추가로 깨지지 않음).

### 선행 의존성
공통 프리미티브 `GateHint` 신설(D0)이 선행. D2·D3·D4 와 문구 어미·색 토큰을 공유해야 하므로 4건은 한 PR 로 묶는 편이 안전하다.

### 🔍 검증 — 놓친 제약
① nativewind-patterns §3(모든 색상 클래스에 dark: 쌍 강제)와 GateHint 의 'content-muted 는 dark 불필요' 설계가 형식상 충돌 — 기존 관용구(PlaceSheet.tsx:133)가 이미 dark 없이 쓰고 실측 259처 중 141처만 dark 짝이라 실질 무해하나, 코드리뷰 게이트에 걸리지 않게 GateHint 에 근거 주석 필수. ② GateHint 를 '@/components/ui' 배럴 경유로 소비하면 리프 UI 배럴 순환참조 함정(hooks 배럴 3회 재발 이력)과 같은 클래스 위험 — ApplicationForm 이 Button/SheetModal 을 직접 경로로 import 하는 관례대로 직접 경로 권장. ③ e2e 는 실측 결과 '지원하기'를 role=button name 으로 잡아(job-detail.page.ts:22 등) 힌트 Text 와 비충돌 — 분석의 grep 주장 사실 확인. RLS/RPC/마이그/플래그 전부 무관 확인.

### 🔧 검증 — 설계 보정
수정설계 중 死코드 처리안(errorQuestionIds 를 useMemo 파생값으로 채워 PreQuestionForm 에러 UI 를 '살리는' 안)은 폐기해야 한다: 답변 초기값이 전부 '' 이므로 시트를 여는 순간부터 모든 필수 질문이 빨간 테두리+'필수 질문입니다' 에러로 시작한다 — 입력 전 비난 UX 로, 분석 스스로 리스크②에서 지적한 문제가 '완화 가능'이 아니라 기본 동작이다. 기본 PR 은 GateHint 문구('필수 질문 N개…')까지만 하고, 死코드는 handleSubmit 블록+state+prop 체인+PreQuestionForm 에러 UI 를 함께 제거하거나 '터치 후 표시' 트리거를 별도 설계로 미룰 것. 사실관계 보정 2건: (a) '화면 어디에도 이 4개를 설명하는 문구가 없다'는 과장 — 동의 체크박스의 [필수] 마커(ApplicationForm.tsx:377)와 PreQuestionForm 헤더의 '필수 N/M' 카운터(:246-250)·'* 표시는 필수 항목입니다'(:254-257)가 존재한다. 정확한 결함 서술은 '게이트와 사유의 연결 부재'다. (b) 기각가설(b)의 ':387-395 안내 박스'는 AssignmentSelector 가 아니라 ApplicationForm.tsx:387-395 이고(AssignmentSelector/AssignmentSelector.tsx 는 280줄), 경로도 서브디렉토리다.

### 검증 메모
핵심 인용 전수 일치: canSubmit(:161-185)·footer(:246-250)·setErrorQuestionIds 도달불가(:187-198, canSubmit 이 :170 에서 선차단)·PreQuestionForm 에러 UI 미렌더(:271→항상 [])·FixedRoleSelector 도달불가(apply.tsx:346-354 조기반환, 동일 술어 selectors.ts:14)·소비처 단일(apply.tsx:360)·테스트 mock footer 미렌더(:57-78) 전부 실측 재현. Button 은 PressableProps 확장(:24)이라 accessibilityHint 통과 확인(:224 spread 후 hint 미덮어씀). S→M 상향 근거: GateHint 프리미티브 신설 + SheetModal mock footer 수정 + 컴포넌트 테스트 red-green(메모리 교훈: 순수 헬퍼 테스트만으론 린치핀이 안 지켜진다) + 死코드 범위 결정까지 한 PR.

### 🙋 사람이 결정할 것
사전질문 미답변 사유일 때 (a) 힌트 한 줄만 쓸지, (b) 죽어 있던 `PreQuestionForm` 인라인 빨간 테두리까지 되살릴지. (b)는 '어느 질문인지'를 알려주는 유일한 수단이지만, 제출 시도 없이도 붉은 폼이 되는 트레이드오프가 있다. 제품 오너 결정 필요.


## `applicant-confirm-disabled-silent` — D2. 구인자 지원자 카드 '0개 확정' — 라벨이 사유가 아니라 결과를 잘못 말하고, 선행 조건도 전체선택 수단도 없다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→M · **마이그레이션**: 불필요

### 근거 (실측)
라벨 생성 지점은 `uniqn-mobile/src/components/employer/applicants/ApplicantCard/components/AppliedActions.tsx:47-51`:
```
const confirmButtonText = isFixedMode ? '역할 확정'
  : totalCount > 0 && selectedCount < totalCount ? `${selectedCount}개 확정` : '확정';
```
비활성 조건은 바로 위 `:44` `const isConfirmDisabled = !isFixedMode && totalCount > 0 && selectedCount === 0;` 하나뿐이다. `selectedCount` 의 출처는 `ApplicantCard/useAssignmentSelection.ts:101` `useState<Set<string>>(new Set())` → **초기값 0건**, `:160` `selectedCount = selectedKeys.size`.
'날짜 체크박스를 골라야 한다'는 안내 문구는 **없다**. 가장 가까운 것은 `components/GroupedAssignmentSelector.tsx:126-131` 의 헤더 `선택된 일정` + `{selectedCount}/{totalCount}개 선택` — 숫자 카운터일 뿐 지시문이 아니고, 확정 버튼이 그 카운터 때문에 잠겼다는 연결을 전혀 하지 않는다.
전체 선택 수단: 카드 안에는 **없다**. `GroupedAssignmentSelector` 는 다중일 그룹에만 그룹 체크박스를 주고(`:213-217` `onToggleGroup`), 단일일 그룹은 개별 행 Pressable 이다(`:155-158`). 훅이 `allAssignmentKeys` 와 `clearSelection` 을 export 하지만(`useAssignmentSelection.ts:304/311`) `ApplicantCard.tsx:60-73` 의 구조분해에 **둘 다 빠져 있다** — 미소비 export 다.

### 근본 원인
의도적 트레이드오프(게이트) + 라벨 설계 실패의 합성이다. 게이트 자체는 정당하다: `ApplicantCard.tsx:97-105` `handleConfirm` 은 선택이 0건이면 `onConfirm?.(applicant)` 를 인자 없이 부르고, 그 값은 `src/repositories/supabase/ApplicationRepositoryTransactions.ts:73` 에서 `selectedAssignments ?? applicationData.assignments ?? []` 로 폴백돼 **지원자가 신청한 전 일정을 확정**한다. 즉 게이트를 풀면 '0개 확정'이라고 쓰인 버튼이 전건을 확정하는 정반대 동작이 된다. `supabase/migrations/20260727150000_restore_original_assignments_on_cancel.sql:3-8` 이 이 구조를 명시한다(`부분 확정이 UI 의 기본 경로다(초기 선택 0건, 1건 이상 선택해야 확정 버튼 활성, 버튼 라벨도 'N개 확정')`).
결함은 게이트가 아니라 **표현**이다: 0을 '아직 못 고름'이 아니라 '0개를 확정함'이라는 수량으로 렌더해, 라벨이 사유를 말하기는커녕 **틀린 결과를 약속**한다. 그리고 이 파일은 마지막으로 손댄 게 PR #231(knip triage)·#185(디자인 루프)라 PlaceSheet 관용구(#257) 이전이다 — 확산 미도달.

### 인과사슬
사장이 지원자 카드를 편다 → `ApplicantCard.tsx:167-179` 가 `GroupedAssignmentSelector` 를 렌더하고 체크박스는 전부 해제 상태 → 사장은 '지원 내역 표시'로 읽지 '내가 골라야 하는 입력'으로 읽지 않는다(체크박스 위 라벨이 `선택된 일정`이라 이미 선택된 것처럼 들린다) → 하단 `AppliedActions` 의 버튼이 `0개 확정`이라고 적힌 채 회색 → 사장은 '확정할 게 0개'라고 해석하고 **지원자가 일정을 안 냈다고 오해**하거나 앱 버그로 판단 → 탭해도 `Pressable disabled`(`AppliedActions.tsx:86`)라 무반응 → 옆의 '거절'만 활성이라 최악의 경우 거절로 흐른다.
한편 사장이 우연히 1건만 체크하고 확정하면 `ConfirmModal.tsx:242-249` 가 `선택하지 않은 N개 일정은 확정에서 제외돼요` 경고를 띄운다 — 즉 **하류에는 이미 부분확정 경고가 있는데, 상류에서 '왜 잠겼나'만 침묵한다.** 안전장치의 순서가 뒤집혀 있다.

### 파급 범위
`AppliedActions` 소비처는 `ApplicantCard.tsx:211-217` 한 곳, `ApplicantCard` 소비처는 `ApplicantList.tsx:209`(선택모드, `showActions={false}` 라 `AppliedActions` 미렌더)와 `:217-223`(정상 경로) 두 곳. 화면은 `app/(employer)/my-postings/[id]/applicants.tsx:247` 하나. 즉 구인자의 **유일한 지원자 승인 경로**다.
같은 결함 클래스가 같은 폴더에 하나 더 있다: `ApplicantBulkActions.tsx:39` `const disabled = selectedCount === 0 || isBulkConfirming;` → `:70-89` 회색 '일괄 확정' 역시 사유 없음. 일괄 모드는 '전체 선택' 버튼(`:44-65`)이 있어 탈출구가 있지만 문구는 없다.
E2E 결합: `e2e/tests/p1-important/employer-applicants.spec.ts:230` 이 `page.getByRole('button', { name: /\d+개 확정/ })` 로 **accessibilityLabel 정규식**을 건다(`AppliedActions.tsx:88` `accessibilityLabel={confirmButtonText}`). 라벨 문구를 바꾸면 이 로케이터가 죽는다 — `eslint.config.js` ignores 때문에 `npm run quality` 는 못 잡는다(CLAUDE.md 사각지대 경고 그대로).

### 기각한 경쟁 가설
(a) 기각 — '진짜 미구현이라 게이트만 풀면 된다': 위 rootCause 의 `ApplicationRepositoryTransactions.ts:73` 폴백 때문에 게이트를 풀면 '0개 확정' 버튼이 전건 확정을 실행한다. 게이트는 유지해야 한다.
(b) 기각 — '다른 경로로 이미 안내 중': `GroupedAssignmentSelector.tsx:129-131` 의 `0/3개 선택` 카운터가 유일한 후보인데, 이는 상태 표시이고 버튼 잠김과의 인과를 말하지 않는다. `ConfirmModal` 경고(:242-249)는 게이트를 **통과한 뒤에만** 뜬다.
(c) 부분 채택 — '의도적 제약': 게이트는 의도적이다(마이그레이션 주석이 문서화). 그러나 '0개 확정' 이라는 **라벨**이 의도적일 수는 없다 — 같은 파일 `:51` 이 `selectedCount === totalCount` 일 때는 '확정'으로 바꾸는 걸 보면 라벨은 '몇 개를 확정할지'를 알리려던 것이지 '왜 못 누르는지'를 알리려던 게 아니다.
(d) 부분 채택 — '리팩터링 잔해': `useAssignmentSelection` 이 `allAssignmentKeys`·`clearSelection` 을 export 하는데 `ApplicantCard` 가 둘 다 안 받는다 — 카드 레벨 전체선택이 설계됐다가 배선되지 않은 흔적이다.

### 수정 설계
**공통 패턴 D0(GateHint + 사유 파생 게이트 + accessibilityHint)을 그대로 적용.**
1. `uniqn-mobile/src/components/employer/applicants/ApplicantCard/utils.ts` 에 순수 함수 추가:
`export function resolveConfirmBlockReason({ isFixedMode, totalCount, selectedCount }: { isFixedMode: boolean; totalCount: number; selectedCount: number }): string | undefined` — dated 이고 `totalCount > 0 && selectedCount === 0` 일 때만 `'확정할 일정을 1개 이상 선택하면 확정할 수 있어요'` 반환, 그 외 `undefined`.
2. `AppliedActions.tsx`: `isConfirmDisabled`(:44)를 삭제하고 `const blockReason = resolveConfirmBlockReason({ isFixedMode, totalCount, selectedCount }); const isConfirmDisabled = blockReason !== undefined;` 로 파생. 반환 트리(:67-100) 최상단을 `<View className="mt-3 pt-3 border-t …">` 로 감싸고 그 안에 `<GateHint reason={blockReason} align="left" className="mb-2" />` + 기존 `flex-row` 버튼 행. 확정 Pressable 에 `accessibilityHint={blockReason ?? '지원자를 확정합니다'}`(:89 의 정적 hint 를 조건부로).
3. **라벨 수정(별건이지만 같은 결함)**: `confirmButtonText`(:47-51)의 `selectedCount === 0` 케이스를 `'확정'` 으로 되돌린다 — '0개 확정'이라는 거짓 약속을 없앤다. e2e 정규식은 `/\d+개 확정|확정/` 으로 함께 갱신(`e2e/tests/p1-important/employer-applicants.spec.ts:230`). ⚠️ **e2e 는 quality 범위 밖이므로 이 grep 을 반드시 수행**.
4. **탈출구 제공(권장, 같은 PR)**: `ApplicantCard.tsx:60-73` 구조분해에 `allAssignmentKeys` 를 추가하고 `useAssignmentSelection` 에 `selectAll()` 을 신설(내부에서 `setSelectedKeys(new Set(allAssignmentKeys))` — 단, `toggleAssignment` 의 '같은 날짜는 하나만'(:180-189) 규칙과 충돌하므로 **날짜별 첫 항목만** 담아야 한다), `GroupedAssignmentSelector` 헤더(:125-132) 우측에 '전체 선택' Pressable 추가. 이게 없으면 힌트가 '고르세요'라고만 하고 다중 그룹 사장은 여전히 손으로 N번 탭한다.
5. 같은 폴더 `ApplicantBulkActions.tsx:39-89` 에도 동일 패턴으로 `'확정할 지원자를 선택하면 일괄 확정할 수 있어요'` 를 붙여 폴더 내 일관성 확보.

### 리스크
① **FlashList 높이**: 카드에 힌트 한 줄(약 16px)이 늘어난다. `ApplicantList.tsx:322` `estimatedItemSize={180}` 는 추정치라 크래시하지 않지만 스크롤 점프가 커질 수 있다 — 힌트는 `selectedCount === 0` 일 때만 뜨므로 리스트 전체가 아니라 미선택 카드만 늘어난다. 값 재측정 권장. ② **e2e 로케이터**: 위 3번을 하면 `employer-applicants.spec.ts:230` 이 깨진다. 다만 그 단언은 `expectAnyVisible([...])` 의 5개 후보 중 하나라 다른 후보로 통과해 **조용히 커버리지만 잃을 수 있다** — 정규식을 반드시 함께 고칠 것. ③ 4번(전체 선택)은 `toggleAssignment` 의 날짜 배타 규칙을 깨기 쉽다. `useAssignmentSelection` 에는 아직 테스트가 없고(`ApplicantCard/__tests__/` 에 `utils.test.ts` 만 존재) 도메인 쪽 `src/domains/application/__tests__/selectionCore.test.ts` 는 별개 모듈(`src/utils/assignment/selectionCore.ts`)을 본다 — selectAll 을 넣는다면 훅 테스트 신설이 필수다.

### 선행 의존성
공통 프리미티브 `GateHint`(D0). 3번(라벨 변경)은 e2e 갱신과 원자적으로 묶여야 한다. 4번(전체 선택)은 제품 결정(openQuestion) 선행.

### 🔍 검증 — 놓친 제약
① e2e 사각지대는 실재하나 방향이 다르다: employer-applicants.spec.ts:227-236 은 expectAnyVisible 5후보이고 :233 에 getByText('확정',{exact:true}) 후보가 이미 있어 라벨을 '확정'으로 바꿔도 단언은 깨지지 않고 조용히 통과한다 — '깨진다'가 아니라 '조용한 커버리지 상실'이 정확하며, 그래서 정규식 갱신은 여전히 필수지만 CI red 가 알려주지 않으므로 사람이 챙겨야 한다(quality 범위 밖 실측 확인). ② 라벨 변경은 accessibilityLabel(:88)도 함께 바꾼다 — 스크린리더 사용자 문구 계약 동시 변경. ③ ApplicationRepositoryTransactions.ts:75-79 에 0건 ValidationError 가 있지만 전건 폴백(:73)이 먼저 평가되므로 게이트 해제 시 서버가 막아주지 않는다 — 분석의 (a) 기각 근거 재확인, 게이트 유지 필수. 마이그 실경로는 uniqn-mobile/supabase/migrations/(분석 표기에 접두사 누락).

### 🔧 검증 — 설계 보정
4번(전체 선택)은 '권장·같은 PR'에서 제외하고 별도 결정으로 격상해야 한다: 같은 날짜에 역할·시간대가 다른 복수 지원이 있으면 '날짜별 첫 항목만 담기'는 사장이 고른 적 없는 역할을 정렬 순서(그룹 시작일 정렬, useAssignmentSelection.ts:147)에 따라 임의 배정하는 것이다 — 구현 리스크가 아니라 제품 의미론 결함이고, 훅 테스트도 전무하다(__tests__ 에 utils.test.ts 만 존재, selectionCore.test.ts 는 별개 모듈 실측 확인). 1·2·3·5번만 한 PR 로 내되 3번은 e2e 정규식 갱신과 원자적으로. 추가 보정: ApplicantBulkActions 힌트(5번)는 일괄 모드 진입 직후 기본 상태가 0선택이라 상시등이 된다 — 바로 옆에 '전체' 버튼(:44-65)이 이미 탈출구이므로 힌트 생략 또는 최소화 검토. 미세 오차: estimatedItemSize={180} 은 :322 가 아니라 :323.

### 검증 메모
핵심 인용 전수 일치: isConfirmDisabled(:44)·confirmButtonText(:47-51)·Pressable disabled(:86)·accessibilityLabel(:88)·초기 선택 0건(useAssignmentSelection.ts:101)·allAssignmentKeys/clearSelection 미소비(ApplicantCard.tsx:60-73 구조분해 부재, 반환 :304/:311)·무인자 폴백(handleConfirm :97-105 → Transactions :73)·마이그 주석(:3-8 원문 일치)·ConfirmModal 경고(:244-249)·소비처 사슬(ApplicantList :209/:217-223 → applicants.tsx:247) 전부 실측 재현. '게이트는 정당하나 라벨이 틀린 결과를 약속한다'는 판정 구조도 코드와 부합. M 유지 타당(4번 제외 기준으로도 e2e 동시 갱신+FlashList 재측정 포함).

### 🙋 사람이 결정할 것
두 가지. ① '0개 확정' 라벨을 '확정'으로 되돌릴지, 아니면 라벨은 그대로 두고 힌트만 추가할지 — 전자가 정직하지만 e2e 갱신을 동반한다. ② 카드 레벨 '전체 선택'을 이번에 넣을지. 넣으면 사장이 한 탭으로 전건 확정하게 되는데, 이는 `ConfirmModal.tsx:41` 주석이 우려한 '의도를 모른 채 축소 확정' 의 반대 극단(의도를 모른 채 전건 확정)을 만들 수 있다. 제품 오너 결정 필요.


## `schedule-sheet-confirm-disabled-silent` — D3. 공고 작성 시간·역할 시트 '확인' — 형제 시트 2개는 이미 사유를 말하는데 이 시트만 침묵한다

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 실행가능 · **난이도**: S→M · **마이그레이션**: 불필요

### 근거 (실측)
`uniqn-mobile/src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx:124-134` 의 footer 는 사유 없는 맨 버튼이다:
```
footer={ <Button onPress={() => { onConfirm(slots); onClose(); }} disabled={!areSlotsComplete(slots)}>확인</Button> }
```
비활성 조건 전수는 `src/components/employer/order-sheet/orderRowMeta.ts:75-90` 의 SSOT 3술어:
- `:89-90` `areSlotsComplete = slots.length > 0 && slots.every(isSlotComplete)`
- `:82` `isSlotComplete = isSlotTimeSet(s) && slotHasRoles(s)`
- `:75-76` `isSlotTimeSet = s.isTimeToBeAnnounced === true || START_TIME_RE.test(s.startTime)`
- `:79` `slotHasRoles = s.roles.length > 0`
즉 (1) 슬롯 0개 (2) 어떤 슬롯의 출근시간 미확정(HH:MM 도 '미정'도 아님) (3) 어떤 슬롯의 역할 0개 — 셋 중 하나라도면 잠긴다.
시트 내부에 **에러/사유 표시 자리는 없다**(파일 전체 185줄 Read). 가장 근접한 신호는 `sheets/SlotCard.tsx:35-42` 접힘 요약의 `--:--` 와 `역할 미설정` 인데, **펼친 카드에는 안 나온다**(`:85-118` 펼침 분기에는 `출근 --:--`만 있고 역할 미설정 문구 없음). 슬롯이 1개일 때는 항상 펼침이라(`:75` `expandedId` 초기값=firstIncomplete) 이 신호를 아예 못 본다.
**결정적 대조군**: 같은 폴더 `PlaceSheet.tsx:129-154` 와 `WorkConditionSheet.tsx:73-98` 은 정확히 같은 자리에 `<View className="gap-2">{confirmDisabled ? <Text className="text-center text-xs text-content-muted font-sans">…확인할 수 있어요</Text> : null}<Button disabled={confirmDisabled}>확인</Button></View>` 를 갖는다.

### 근본 원인
패턴 확산 미완(backport 누락)이다. `git log -S` 로 확인한 타임라인: 힌트 관용구는 **PR #257**(`fabbe3087`, PlaceSheet)에서 태어났고 → **#360**(`7995e56b4`, WorkConditionSheet)이 복제하며 코드에 `힌트 패턴은 PlaceSheet 를 따랐다`(`WorkConditionSheet.tsx:78`)라고 못박았고 → **#374**(`a06f53110`, `workSchedule/EditSlotSheet.tsx:387-392`)까지 퍼졌다. `ScheduleSlotsSheet` 는 **#303/#307/#308**(`bbd2cc062`/`8d703956a`/`426cee659`) 산물로 #360 보다 **앞선다**. 게다가 #307 의 제목이 `연쇄 데드엔드 2건 — 무효 슬롯 확정 근원 차단` 인데, 그 '근원 차단'의 구현이 바로 이 `disabled={!areSlotsComplete(slots)}` 다 — **차단은 했고 설명은 안 했다.** 이후 아무도 역이식하지 않았다.
미완성이 아니라 순서 문제라는 증거가 하나 더 있다: `orderRowMeta.ts:62-67` 주석이 '세 소비처에서 드리프트하지 않도록' 술어를 3분할해 두었다 — 사유 문구를 만들 재료(`isSlotTimeSet` / `slotHasRoles` 분리)가 **이미 준비돼 있는데 쓰이지 않고 있다.**

### 인과사슬
사장이 주문서에서 '시간' 또는 '역할' 행을 탭한다 → `OrderSheetScreen.tsx:1101` 이 `ScheduleSlotsSheet` 를 연다 → 슬롯 카드가 펼쳐지고 `출근 19:00`(기본 시드, `ScheduleSlotsSheet.tsx:54` `DEFAULT_START`)은 이미 채워져 보인다 → 사장은 시간이 정해졌다고 믿고 역할 칩을 안 건드린 채 '확인'을 누르려 한다 → `slotHasRoles` 가 false 라 버튼 회색, 무반응 → **시간은 채워져 보이는데 왜 잠겼는지 단서가 0** 이다(역할 편집기 `RoleCountEditor` 는 카드 하단에 있고 '0개'라는 명시적 표시가 없다).
더 나쁜 변형: `addSlot`(`:98-107`)로 시간대를 추가하면 새 슬롯은 `startTime: ''` 이라 **시각도 역할도 미정**인데 화면엔 `출근 --:--` 만 뜬다. 그 상태로 확인을 못 누르면, `OrderSheetScreen` 의 연쇄 입력(`nextUnsetRowAfter`, `orderRowMeta.ts:605-623`)이 같은 시트를 다시 여는 고리 위험이 있는데 — 이 고리는 `coveredKeys` 가드(:599-603 주석)로 이미 한 번 사고가 나서 막은 자리다. 즉 이 시트의 침묵은 **이미 한 번 데드엔드를 만든 이력이 있는 지점**이다.

### 파급 범위
`ScheduleSlotsSheet` 소비처는 `OrderSheetScreen.tsx:1101` 한 곳이고, 그 화면은 구인자 공고 작성/수정의 **유일한 입구**다(`mode==='edit'` 포함).
같은 폴더에서 **같은 결함이 4곳 더 있다**(grep `disabled=` on `sheets/*.tsx` 전수):
- `TitleSheet.tsx:47` `disabled={trimmed.length === 0}` — 힌트 없음
- `ContactSheet.tsx:77` `disabled={resolved.length === 0}` — 힌트 없음
- `RolesSheet.tsx:36` `disabled={roles.length === 0}` — 힌트 없음(고정공고 역할 시트)
- `SalarySheet.tsx:188` `disabled={confirmDisabled}` — 힌트 없음(단 `:328-333` 에 역할 0개용 빈상태 문구는 있음)
- `RoleCountEditor.tsx:178` `disabled={customName.trim().length === 0}` — 커스텀 역할 이름
힌트 보유는 `PlaceSheet`·`WorkConditionSheet` 2곳뿐 → **7곳 중 2곳만 적용된 부분 롤아웃**이다.
인접 도메인에도 1건: `src/components/workSchedule/AddSlotSheet.tsx:366` `disabled={!canSubmit}`(5조건 게이트, `:225-231`) 는 힌트 없음인데 그 형제 `EditSlotSheet.tsx:387-392` 는 있다.

### 기각한 경쟁 가설
(a) 기각 — '다른 경로로 이미 안내 중': `SlotCard` 접힘 요약(`:35-42`)의 `역할 미설정`이 후보였으나, 펼친 카드에는 렌더되지 않고(`:85-118`) 슬롯 1개면 항상 펼침이라(`ScheduleSlotsSheet.tsx:75`) 정확히 가장 흔한 케이스에서 안 보인다. `OrderSheetScreen` 의 행 배지(`errorMessageForRow`, `orderRowMeta.ts:181-288`)도 후보였으나 그건 **RHF zod 에러**용이고 시트 안에서는 렌더되지 않는다(시트는 로컬 state 로만 돈다 — `ScheduleSlotsSheet.tsx:55` `useState<Slots>(seed)`).
(b) 기각 — '의도적 제약': #307 이 막은 건 '무효 슬롯이 확정되어 급여 시트가 데드엔드가 되는 것'(`orderRowMeta.ts:81` 주석)이지 '사유를 숨기는 것'이 아니다. 같은 사람이 #360 에서 형제 시트에 문구를 붙였다.
(c) 기각 — '토스트로 대체 가능(버튼 활성화 + 눌렀을 때 검증)': 레포에 그 패턴도 있다(`ReportModal.tsx:233-238`, `VenueSettingsSheet.tsx:101`, `VenueDayPanel.tsx:257`, `useBulkShare.ts:52`). 그러나 여기서 채택하면 #307 이 닫은 '무효 확정 근원 차단'을 다시 여는 것이므로 **회귀**다. 게이트는 유지하고 문구만 붙이는 게 유일하게 정합적이다.
(d) 기각 — '진짜 미구현': 재료(`isSlotTimeSet`/`slotHasRoles` 분리 술어)와 관용구(PlaceSheet)가 둘 다 이미 있으므로 미구현이 아니라 미연결이다.

### 수정 설계
**공통 패턴 D0 적용 — 이 건은 형제 시트 코드를 그대로 복제하면 되므로 가장 값싸다.**
1. `uniqn-mobile/src/components/employer/order-sheet/orderRowMeta.ts` 에 **기존 3술어 위에** 사유 해석기를 추가(같은 파일에 두어야 `orderRowMeta.ts:62-67` 이 지키려는 SSOT 가 유지된다):
```ts
/** 슬롯 확정을 막는 첫 사유 — areSlotsComplete 와 같은 술어에서 파생한다(드리프트 차단). */
export function resolveSlotsBlockReason(slots: readonly SlotCompletable[]): string | undefined {
  if (slots.length === 0) return '시간대를 1개 이상 추가하면 확인할 수 있어요';
  if (!slots.every(isSlotTimeSet)) return '출근 시간을 고르거나 ‘미정’을 선택하면 확인할 수 있어요';
  if (!slots.every(slotHasRoles)) return '역할을 1개 이상 추가하면 확인할 수 있어요';
  return undefined;
}
```
(문구 어미는 `WorkConditionSheet.tsx:82` 와 동일 계열, '미정' 표기는 `SlotCard.tsx:32` 의 라벨과 일치)
2. `ScheduleSlotsSheet.tsx:124-134` footer 를 `PlaceSheet.tsx:129-154` 형태로 교체:
```tsx
const blockReason = resolveSlotsBlockReason(slots);
…
footer={
  <View className="gap-2">
    <GateHint reason={blockReason} />
    <Button onPress={…} disabled={blockReason !== undefined} accessibilityHint={blockReason}>확인</Button>
  </View>
}
```
`areSlotsComplete` 호출은 제거하고 **게이트를 사유에서 파생**시킨다(`areSlotsComplete` 자체는 `getRowState` 등 다른 소비처가 있으니 남긴다).
3. **동일 PR 에서 형제 4곳 역이식**(같은 폴더에 두 관용구가 공존하는 상태를 끝낸다): `TitleSheet.tsx:47` → `'공고 제목을 입력하면 확인할 수 있어요'`, `ContactSheet.tsx:77` → `'연락처를 입력하면 확인할 수 있어요'`, `RolesSheet.tsx:36` → `'역할을 1개 이상 추가하면 확인할 수 있어요'`, `SalarySheet.tsx:188` → `SalarySheet` 의 `confirmDisabled` 파생 사유. 인접 `workSchedule/AddSlotSheet.tsx:366` 도 `EditSlotSheet.tsx:387-392` 와 짝을 맞춘다.

### 리스크
① `src/components/employer/order-sheet/sheets/__tests__/ScheduleSlotsSheet.test.tsx:12-24` 의 SheetModal mock 은 이미 `{footer}` 를 렌더하므로 **테스트가 힌트를 볼 수 있다** — D1 과 달리 mock 수정이 불필요하다(이 mock 을 D1 의 본보기로 쓸 것). ② `OrderSheetScreen.chain.test.tsx:422` 가 `역할 0개 확정은 근원 차단 — 확인이 잠긴 급여 시트로 이송되는 데드엔드가 성립하지 않는다` 를 검증한다. 게이트 표현을 `!areSlotsComplete(slots)` → `blockReason !== undefined` 로 바꾸면 **같은 술어에서 파생**하므로 논리적으로 동치지만, 이 테스트를 반드시 재실행해 red-green 을 확인할 것. ③ 3번(형제 4곳)까지 하면 diff 가 6파일로 커진다 — 리뷰 부담을 줄이려면 ScheduleSlotsSheet 만 먼저 내고 나머지를 후속 커밋으로 쪼갤 수 있다(다만 폴더 내 두 관용구 공존 상태가 길어진다). ④ e2e 영향 없음: `e2e/` 에서 주문서 확인 버튼을 텍스트 '확인'으로 잡는데 힌트는 별개 Text 라 충돌하지 않는다(grep 확인).

### 선행 의존성
공통 프리미티브 `GateHint`(D0). `resolveSlotsBlockReason` 은 `orderRowMeta.ts` 의 기존 술어에 의존하므로 그 파일이 SSOT 로 남아야 한다.

### 🔍 검증 — 놓친 제약
① resolveSlotsBlockReason 의 첫 분기(슬롯 0개)는 이 시트에서 도달 불가다 — seed 가 항상 1개 이상(:54)이고 removeSlot 은 removable=slots.length>1 에서만 노출(SlotCard :22-23, ScheduleSlotsSheet :165)이라 0개가 될 수 없다. areSlotsComplete 의 길이 가드(:86-88 진공 참 방어)와 같은 방어적 성격으로 유지하되 죽은 분기임을 주석으로 남길 것. ② SalarySheet 역이식은 문구가 미정의다 — confirmDisabled 가 협의/0원/역할0 복합 조건이라 단일 문구로 안 끝날 수 있고(:328-333 에 역할 0개 빈상태 문구 별도 존재), 이 건만 사전 설계가 필요하다. ③ OrderSheetScreen.chain.test.tsx:422 재실행 필수(분석 지적 타당, 테스트 실존 확인). e2e '확인' 텍스트 비충돌·마이그/RLS/플래그 무관 확인.

### 🔧 검증 — 설계 보정
사실 오류 1건: 인과사슬의 '더 나쁜 변형'에서 addSlot(:98-107)으로 만든 새 슬롯은 '시각도 역할도 미정'이 아니다 — roles 는 첫 슬롯에서 깊은복사로 시드된다(`roles: (prev[0]?.roles ?? []).map((r) => ({...r}))`, :103). 새 슬롯은 시간만 미정이며, 역할까지 0개인 건 첫 슬롯 역할이 0개일 때뿐이다. 수정설계의 사유 우선순위에는 영향 없으나(시간 사유가 정확히 노출됨) 시나리오 서술은 정정 필요. 계보 오차 1건: ScheduleSlotsSheet 생성은 #285(1a3948680) 이고 #303/#307/#308 은 후속 수정이다(git log 실측) — '#360 보다 앞선다'는 결론 자체는 유지. 범위 보정: 3번(형제 4곳+AddSlotSheet 역이식)까지 같은 PR 이면 6파일+로 분석 스스로 인정한 규모라 난이도는 S 가 아니라 M — ScheduleSlotsSheet 단독 최소 범위일 때만 S 다.

### 검증 메모
핵심 인용 전수 일치: footer(:124-134)·SSOT 3술어(orderRowMeta :75-90)·드리프트 방지 주석(:62-67)·SlotCard 펼침 분기의 역할 미설정 문구 부재(:85-118)·expandedId 초기값(:75)·대조군 PlaceSheet(:129-154)/WorkConditionSheet(:73-98, :78 'PlaceSheet 를 따랐다' 주석)·형제 5곳 disabled 전수(TitleSheet:47/ContactSheet:77/RolesSheet:36/SalarySheet:188/RoleCountEditor:178 grep 정확 일치)·AddSlotSheet(:225-231, :366)·EditSlotSheet(:387-392)·coveredKeys 가드(:598-619)·chain.test:422·테스트 mock footer 렌더(:12-24) 전부 실측 재현. 게이트 동치성도 검증: resolveSlotsBlockReason===undefined ⟺ areSlotsComplete (∀에 대한 논리곱 분배로 동치). 형제 시트 복제 기반이라 설계 자체는 그대로 실행 가능.

### 🙋 사람이 결정할 것
형제 시트 4곳(Title·Contact·Roles·Salary)과 `AddSlotSheet` 를 이 PR 에 포함할지, 후속으로 뺄지. 포함하면 '한 폴더 두 관용구' 문제가 끝나지만 diff 가 6→8파일이 된다.


## `biometric-switch-disabled-silent` — D4. 설정 Face ID 스위치 — 비활성 조건은 3개(1개 아님)이고, 넷째 조건은 아예 행을 숨긴다. 훅 안의 안내 토스트는 사실상 도달 불가

**주장 판정**: 부분사실 · **심사**: CONFIRMED · **설계 실현성**: 실행가능 · **난이도**: S→S · **마이그레이션**: 불필요

### 근거 (실측)
'회색이고 이유를 안 말한다'는 사실이나 '조건이 `!autoLoginEnabled` 하나뿐'은 **거짓**이다. `uniqn-mobile/app/(app)/settings/index.tsx:179-187`:
```
<Switch value={isBiometricEnabled} onValueChange={handleBiometricToggle}
  disabled={isBiometricLoading || isBiometricAuthenticating || !autoLoginEnabled} … />
```
비활성 조건은 **3개**다: 로딩(`useBiometricAuth.ts:394` `isStatusLoading || isEnabledLoading`), 인증 진행 중(`:111` `isAuthenticating`), 자동로그인 OFF.
**넷째 축은 disabled 가 아니라 가시성**이다: `settings/index.tsx:172` `{isBiometricAvailable && ( … )}` 로 감싸여 있고 `isAvailable` 은 `src/services/auth/biometricService.ts:178` `hasHardware && isEnrolled` 다. 즉 기기 미지원·미등록은 **회색 스위치가 아니라 행 자체가 사라진다**(사유 없는 침묵이라는 점은 더 나쁘다).
바로 위 행에는 **이 화면 안에 이미 힌트 관용구가 있다**: `:169-171`
```
<Text className="ml-[34px] mt-1 text-xs text-content-muted font-sans">{AUTO_LOGIN_HELPER_TEXT}</Text>
```
(`src/hooks/useAutoLogin.ts:33` `'끄면 다음 실행부터 다시 로그인해야 합니다.'`). Face ID 행에는 없다.
**死코드 판정**: `src/hooks/useBiometricAuth.ts:184-189` 의 `if (!autoLoginEnabled) { toast.error('자동 로그인을 켜야 생체 인증을 사용할 수 있습니다'); return; }` 는 `setEnabled` 안에 있고, `setEnabled` 의 UI 소비처는 grep 상 `settings/index.tsx:69`(→`handleBiometricToggle`:91-94) **단 하나**이며 그 Switch 는 `!autoLoginEnabled` 일 때 disabled 라 `onValueChange` 가 발화하지 않는다. 같은 문구가 `:242-246` `loginWithBiometric` 에도 있는데, 그쪽 진입점 `app/(auth)/login.tsx:218` 도 `shouldShowBiometric = loginAutoLoginEnabled && isBiometricEnabled && isBiometricAvailable` 로 이미 막는다.

### 근본 원인
'가드는 두 겹, 안내는 0겹'의 전형이다. 훅 안에 **정확히 맞는 사유 문구를 이미 써 두고**(`useBiometricAuth.ts:187`) UI 에서 그 문구에 도달할 수 없게 disabled 로 앞을 막았다 — D1 의 `setErrorQuestionIds` 와 **같은 결함 클래스**다. 방어를 두 곳에 깐 것 자체는 옳지만(훅은 다른 호출자로부터 자신을 지켜야 한다), UI 쪽 게이트가 '왜'를 승계하지 않았다.
엄밀히 말해 완전 死코드는 아니다: `useAutoLogin.ts:87` 이 `autoLoginEnabled` 를 **`true` 로 초기화**하고 `:88` `isLoading=true` 인데, Switch 의 disabled 식에 `isAutoLoginLoading` 이 **빠져 있다**(`settings/index.tsx:182-184`). 생체 쿼리 2개가 스토리지 읽기보다 먼저 resolve 되고 저장값이 OFF 이면, 짧은 창 동안 스위치가 활성이고 토글 시 토스트가 실제로 뜬다. 즉 '레이스에서만 도달'이라 사용자에겐 무작위 토스트로 보인다.

### 인과사슬
사용자가 보안 강화를 위해 자동 로그인을 끈다(`settings/index.tsx:161` → `useAutoLogin.applyAutoLoginPreference`) → `useAutoLogin.ts:43-46` 이 **생체 인증도 함께 끈다**(`setBiometricEnabled(false)`) → 화면이 갱신되며 Face ID 스위치가 OFF + 회색이 된다 → 사용자는 '왜 Face ID 가 꺼지고 만질 수도 없지?' 라고 묻는데 화면에는 답이 없다 → 바로 위 자동로그인 행에는 `끄면 다음 실행부터 다시 로그인해야 합니다.` 라는 **다른** 문구만 있어 인과를 짐작할 단서가 없다 → 사용자는 앱 결함으로 신고하거나 자동로그인을 다시 켜는 시행착오를 한다.
별도 경로: 기기에 생체가 미등록이면 행 자체가 없어(`:172`) '이 앱은 Face ID 를 지원 안 하나?'로 오인한다 — 실제로는 iOS 설정에서 Face ID 를 등록하면 나타난다.

### 파급 범위
`useBiometricAuth()` 소비처는 3곳: `app/(app)/settings/index.tsx:71`(토글), `app/(auth)/login.tsx:50`(로그인 버튼), `src/components/auth/BiometricButton.tsx:60`(타입명·status 만 사용). 이 결함은 settings 한 곳에 국한된다.
연쇄 파급: 자동로그인 OFF → 생체 강제 해제는 `useAutoLogin.ts:43-46` 의 부수효과라, 사유 문구를 안 붙이면 **로그인 화면에서도** 생체 버튼이 조용히 사라진다(`login.tsx:218`). 두 화면이 같은 원인으로 동시에 침묵한다.
E2E: `e2e/tests/p2-standard/settings.spec.ts:37` 이 `autoLoginHelperText` 가시성을 단언하고 `e2e/pages/app/settings/settings.page.ts:35` 가 `getByText('끄면 다음 실행부터 다시 로그인해야 합니다.').last()` 로 잡는다. 웹에는 생체 하드웨어가 없어 `isAvailable=false` → Face ID 행 자체가 렌더되지 않으므로 **웹 E2E 로는 이 수정을 검증할 수 없다**(실기기 QA 필요).

### 기각한 경쟁 가설
(a) 기각 — '조건이 하나뿐': 위 증거대로 3개 + 가시성 게이트 1개다.
(b) 부분 채택 — '다른 경로로 이미 제공 중': `useBiometricAuth.ts:187` 에 문구가 존재는 한다. 그러나 UI 게이트가 앞을 막아 정상 경로에서는 도달하지 않는다(레이스에서만). '있는데 안 보이는' 상태다.
(c) 기각 — '의도적 제약이라 설명 불필요': `useAutoLogin.ts:45` 가 `logger.info('자동 로그인 해제로 생체 인증을 함께 비활성화했습니다')` 로 **개발자에게는 이유를 남긴다**. 사용자에게만 안 남긴 것이므로 의도가 아니라 누락이다.
(d) 기각 — '사유별로 다른 문구가 필요하다(3조건 각각)': 실제로는 로딩·인증중은 **일시 상태**라 문구가 오히려 소음이다(로딩은 수백 ms, 인증중은 OS 프롬프트가 이미 떠 있다). 문구가 필요한 건 `!autoLoginEnabled` **하나**뿐이다 — 이 점에서는 원 주장의 직관이 맞았다.

### 수정 설계
**공통 패턴 D0 적용 — 이 화면은 힌트 관용구가 바로 위 줄(`settings/index.tsx:169-171`)에 이미 있으므로 그대로 승계한다.**
1. `uniqn-mobile/src/hooks/useBiometricAuth.ts` 에 문구를 상수로 승격(현재 `:187`·`:244` 두 곳에 리터럴 중복):
```ts
export const BIOMETRIC_REQUIRES_AUTO_LOGIN_TEXT = '자동 로그인을 켜야 생체 인증을 사용할 수 있어요';
```
토스트 두 곳(`:187`, `:244`)도 이 상수를 쓰게 바꾼다(어미를 `…있습니다` → `…있어요` 로 통일 — 레포의 힌트 관용구 어미와 맞춘다). `src/hooks/index.ts` 배럴에 export 추가(`AUTO_LOGIN_HELPER_TEXT` 가 이미 그렇게 나가고 있다 — `settings/index.tsx:21`).
2. `app/(app)/settings/index.tsx`: Face ID 블록(`:172-191`)을 이렇게 바꾼다.
```tsx
const biometricBlockReason = !autoLoginEnabled ? BIOMETRIC_REQUIRES_AUTO_LOGIN_TEXT : undefined;
…
<SettingItem … rightElement={
  <Switch value={isBiometricEnabled} onValueChange={handleBiometricToggle}
    disabled={isBiometricLoading || isAutoLoginLoading || isBiometricAuthenticating || biometricBlockReason !== undefined}
    accessibilityHint={biometricBlockReason} … />
} />
<GateHint reason={biometricBlockReason} align="left" className="ml-[34px] mt-1" />
```
⚠️ `isAutoLoginLoading` 을 **disabled 식에 추가**하는 것이 rootCause 의 레이스(무작위 토스트)를 닫는 근본 수정이다 — 현재 `:60` 에서 구조분해만 해 놓고 이 식에서 빠져 있다.
3. (권장) 가시성 침묵도 함께 해소: `:172` 의 `{isBiometricAvailable && …}` 를 `{status !== null && …}` 으로 바꾸고, `!isBiometricAvailable` 이면 disabled 스위치 + `GateHint` 로 `status.isHardwareAvailable ? '기기 설정에서 생체 인증을 등록하면 사용할 수 있어요' : '이 기기는 생체 인증을 지원하지 않아요'` 를 보인다. 문구 분기는 `biometricService.ts:31-39` 의 `isHardwareAvailable`/`isEnrolled` 로 이미 구분 가능하다.

### 리스크
① 3번(가시성 해소)을 하면 **웹에서 새 행이 생긴다** — 웹은 `checkBiometricStatus` 가 `biometricService.ts:118-123` 에서 하드웨어 없음으로 떨어지므로 '이 기기는 생체 인증을 지원하지 않아요' 행이 상시 노출된다. 웹 사용자에게 무의미한 행이라 `Platform.OS !== 'web'` 가드가 필요하고, `e2e/tests/p2-standard/settings.spec.ts` 의 '계정 설정 항목이 표시된다'(:35-40) 스냅샷 성격 단언에 항목이 하나 늘어난다 — **e2e 는 quality 범위 밖이므로 별도 grep 필수**. ② 토스트 문구 어미를 바꾸면 `src/__tests__/hooks/useAutoLogin.test.ts` 는 영향 없으나(생체 토스트를 단언하지 않음) 혹시 있을 스냅샷을 확인할 것. ③ `isAutoLoginLoading` 추가는 초기 로딩 중 스위치가 잠깐 더 회색으로 남는 것 외에 회귀 없음 — 오히려 현재의 레이스 토스트를 없앤다. ④ 실기기 검증 필수: 웹 E2E 로는 Face ID 행이 렌더되지 않아 이 수정 전체가 **관찰 불가**다.

### 선행 의존성
공통 프리미티브 `GateHint`(D0). 3번(가시성)은 제품 결정 선행.

### 🔍 검증 — 놓친 제약
① setEnabled 의 가드(:185)는 React state 가 아니라 checkAutoLoginEnabled() 로 스토리지를 직접 읽는다 — 분석이 이 구분을 명시하지 않았지만 레이스 시 토스트가 실제로 뜬다는 결론은 오히려 이 구조 때문에 정확히 성립하고, 수정 후에도 훅 내 가드는 스토리지 기준으로 남겨야 다른 호출자를 방어한다(제안 1번이 이미 그렇게 설계됨). ② e2e settings.spec.ts:34-38 은 특정 항목의 존재 단언이라 3번으로 행이 추가돼도 깨지지 않는다 — 리스크①의 '단언에 항목이 늘어난다'는 과장이나 Platform.OS 웹 가드 필요 지적은 타당. ③ 문구 어미 변경(있습니다→있어요)은 e2e/src 테스트 어디에도 해당 문구 단언 0건(grep 실측)이라 안전. ④ hooks 배럴 export 는 AUTO_LOGIN_HELPER_TEXT 선례(:21 import 동작 확인)가 있고, 리프 UI 배럴 금지 함정은 app/ 라우트 화면이라 비해당. 웹 E2E 관찰 불가(실기기 QA 필수)는 분석 지적 그대로.

### 🔧 검증 — 설계 보정
보정 없음에 가깝다 — 원 주장('조건 1개')을 3조건+가시성 1축으로 정정한 분석의 재판정이 실측과 완전히 일치한다: disabled 식 3조건(settings :182-184), 가시성 게이트(:172), isAvailable=hasHardware&&isEnrolled(biometricService :178), 웹 분기(:117-124), 레이스 성립 요건(useAutoLogin :87 init true + :88 isLoading + Switch 식에 isAutoLoginLoading 부재), setEnabled UI 소비처 단일성(login.tsx:43-50 구조분해에 setEnabled 없음 grep 확인), 토스트 리터럴 중복(:187/:244), 자동로그인 OFF 부수효과(useAutoLogin :43-46), login 게이트(:218). 유일한 미세 지적: 'settings/index.tsx:161 → applyAutoLoginPreference' 는 :161(onValueChange)→handleAutoLoginToggle(:80-88)→setAutoLoginEnabled(:111-121)→applyAutoLoginPreference(:35) 의 축약 표기다. 1·2번은 그대로 실행 가능하고 isAutoLoginLoading 추가가 레이스를 닫는다는 판단도 옳다. 3번(가시성 해소)은 분석대로 제품 결정 선행 — 웹 가드 포함해 분리.

### 검증 메모
부분사실 판정 자체가 정확했다: 원 주장 반박(조건 1개 아님)과 '문구가 필요한 건 !autoLoginEnabled 하나뿐'이라는 재수렴 모두 코드와 부합. D1 과 같은 결함 클래스(사유 문구를 이미 써 두고 UI 게이트가 앞을 막음)라는 판정도 :187 실물로 확인. 4건 중 가장 검증이 깨끗했고 수정 범위도 최소(파일 2개+배럴)라 S 유지.

### 🙋 사람이 결정할 것
기기 미지원·미등록일 때 (a) 지금처럼 행을 숨길지, (b) 사유를 붙인 비활성 행으로 보일지. (b)가 정직하지만 웹에서는 항상 '지원 안 함' 행이 뜨므로 `Platform` 가드와 문구를 제품 오너가 정해야 한다. 또한 자동로그인을 끌 때 `useAutoLogin.ts:43-46` 이 생체를 강제 해제한다는 사실을 **끄기 직전 confirmAction 으로 미리 알릴지** 여부도 결정 필요(현재는 사후 침묵).



---

# E-지점축


## `venue-chip-unselected-silently-unlinked` — 공고 작성에서 지점 미선택이 조용히 통과 — 근무표·지점정산에서 영구 실종(등록 후 붙일 UI 도 없음)

**주장 판정**: 부분사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→M · **마이그레이션**: 불필요

### 근거 (실측)
인용된 4개 지점 모두 실재 확인(라인 갱신). ① app/(employer)/my-postings/create.tsx:65 `const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined);` — 기본 선택 없음. :66 `shouldShowVenueChips(venues.length, venueId)`, :236-242 칩 렌더. ② src/utils/order-sheet/venueSelection.ts:14-19 `venueCount >= 2 && !routeVenueId`, :30-38 `applySelectedVenue` 는 `if (selectedVenueId) {...} return input;` — 미선택이면 input 무변경. 같은 파일 :28 주석이 그 결과를 명시한다: '미선택(2개+인데 안 고름) → input 그대로 → B4가 다중 지점이라 미연결(venue_id 없음, 허용)'. ③ src/services/jobs/jobManagementService.ts:102-128 `resolveDefaultVenueId` — venues.length===1 이면 자동 연결, ===0 이면 `getOrCreateVenueContainer` 로 생성 후 연결, :119 `// 지점 2개 이상 → 자동 연결하지 않는다(폼 선택칩=B5). resolvedVenueId 미지정 유지.` ④ 제출 게이트 src/components/employer/order-sheet/OrderSheetScreen.tsx:726-747 `handleSubmitPress` 는 `firstUnsetRow`/`errorRowTargets` 만 보고 venue 축이 없다(스키마 src/schemas/orderSheet.schema.ts:200 `venueId: z.string().uuid().optional()` — optional 이라 zod 도 안 막는다).

'부분사실' 로 낮춘 이유는 주장의 결론절 하나에 반례가 있기 때문이다(더 나쁜 쪽으로). create.tsx:101-133 의 프리셋 '마지막 공고'는 `draftToValues(buildJobPostingDraft(lastPosting))`(:105)로 만들어지는데, `jobPostingToDraft` 는 venueId 를 그대로 싣고(src/utils/job-posting/draftAdapter.ts:527 `...(hasVenueIdField(posting) ? { venueId: posting.venueId } : {})`), `draftToValues` 도 싣는다(src/utils/order-sheet/mappers.ts:313, :407). 프리셋 적용은 `form.reset(v, {keepDefaultValues:true})`(OrderSheetScreen.tsx:569/571)라 venueId 가 폼 값으로 들어가고, `valuesToCreateInput`→`valuesToDraft`(mappers.ts:161)가 그대로 내보낸다. 그리고 `applySelectedVenue(input, undefined)` 는 그 값을 지우지 않는다. 즉 프리셋을 쓴 경우엔 **칩이 '아무것도 선택 안 됨'인데 직전 공고의 지점에 조용히 붙는다**.

### 근본 원인
설계 공백(미완성)이다 — '의도적 안전장치'가 아니다. 근거는 원죄 설계 스펙 자체다. `git show 1ed70f9f9:docs/superpowers/specs/2026-07-18-grid-auto-sync-design.md` §2 D1 은 '비-대회 + 지점 1개 → 무프롬프트 자동 연결 / 지점 2개+ → 공고 작성 폼에 지점 선택 칩 노출 / 대회 → 연결 안 함' 세 갈래만 정하고 **미선택 시 동작을 정하지 않았다**. 같은 문서 §1 은 '진짜 병목은 연결이다 … SQL을 아무리 정교하게 짜도 일반 공고는 스팬에 안 잡혀 파생값이 0. 연결 정책이 선결 조건'이라고 못박았는데, 미선택 통과가 정확히 그 병목을 다중 지점 사장에게 되살려 놓았다. 즉 결정된 갈래가 아니라 **결정되지 않은 네 번째 갈래가 기본값으로 흘러내린 것**이다.

책임 위임 사슬도 끊겨 있다: 서버(`resolveDefaultVenueId`)는 '폼 선택칩=B5 담당'이라며 폼에 넘기고, 폼(`applySelectedVenue`)은 '사용자가 안 골랐으니 허용'이라며 사용자에게 넘기고, 사용자에게는 무엇을 잃는지 알려주는 문구가 한 글자도 없다(VenueSelectChips.tsx:32 라벨은 '지점 선택' 뿐, 캡션·필수 표시·기본 선택 전부 없음). 각 층이 자기 몫을 다음 층에 넘겨 아무도 안 잡는 전형적 공백이다.

### 인과사슬
칩 미선택 → `applySelectedVenue` 통과(venueSelection.ts:36-37) → `createJobPosting(input, …, activeWorkspace?.id)`(src/hooks/useJobManagement.ts:119-124) → `resolveDefaultVenueId` 가 `venues.length>=2` 라 no-op(jobManagementService.ts:110-119) → `createWithTransaction({...input, venueId: undefined})` → `serializeJobPostingV3` 가 `input.venueId`·`current?.venueId` 둘 다 undefined 라 키 자체를 생략(src/domains/job-posting/serialization.ts:360-364) → DB `job_postings.venue_id = NULL`.

여기서부터 실종이 시작된다. `venue_span_posting_ids(p_venue)` 는 `WHERE p_venue IS NOT NULL AND (venue_id = p_venue OR id = p_venue)`(supabase/migrations/20260710000002_baseline_schema_from_prod.sql:9617-9623)이므로 venue_id NULL 공고는 어느 지점 스팬에도 안 들어간다. 그 결과:
1) 근무표 월 요약 `get_venue_grid_summary`(supabase/migrations/20260718100000_grid_auto_sync_required_count.sql) — span CTE 가 `jp.id IN (SELECT venue_span_posting_ids(p_venue)) AND jp.workspace_id = v_ws` 라, headcount(배치 인원)·job_count(그날 공고 수)·required_count(공고 requirements 날짜별 Σ 좌석)가 **전부 0 기여**. 사장 눈에는 '그날 아무도 안 뽑았다'로 보인다.
2) 하루 슬롯 상세 `get_venue_day_slots`(archive/20260630010000_weekly_grid_read_rpcs.sql:101) — 같은 스팬 조건. 그 공고로 확정된 스태프가 근무표 하루 패널에 **한 명도 안 뜬다**.
3) 지점 정산 — `getByVenueSpanInRange`(src/repositories/supabase/WorkLogRepositoryVenue.ts:43-72)가 `venue_span_posting_ids` RPC 결과로 `work_logs.job_posting_id` 를 `.in()` 필터하므로, 그 공고의 근무 기록이 app/(employer)/venue-settlements.tsx 목록에서 **통째로 빠진다**. 월 합계·미정산 건수·'미정산 전체 정산'(venue-settlements.tsx:154-169) 대상에서 누락 → 사장이 그 달 지급액을 과소 집계한다.
4) 지점 역할별 단가표는 애초에 컨테이너 직속 행(jobPostingId===venueId)에만 적용되므로(src/services/work/settlement/settlementVenueQuery.ts:95-127) 단가표 자체를 잃는 건 아니다 — 잃는 건 '지점 정산 화면에 등장할 자격'이다.

인과사슬의 끝: 공고 자체는 정상 동작한다(지원·확정·QR·공고별 정산 app/(employer)/my-postings/[id]/settlements.tsx 전부 job_posting_id 축). 그래서 **에러도 빈 화면도 없다** — 사장은 공고 화면에서는 다 보이는데 근무표·지점 정산에서만 안 보이는 상태를, 결함이 아니라 '근무표가 원래 그런가 보다'로 해석하게 된다. 이것이 증상이 원인과 닮지 않은 지점이다.

그리고 되돌릴 방법이 없다: `VenueSelectChips` 소비처는 create.tsx:31/237 단 하나이고(Grep 전수), app/(employer)/my-postings/[id]/edit.tsx 에는 'venueId' 문자열이 **0건**이다. 근무표 화면(app/(employer)/work-schedule.tsx)에도 기존 공고를 지점에 붙이는 진입점이 없다(그 파일의 '공고' 언급 4건은 전부 주석·뱃지 범례). 즉 등록 순간에 놓치면 **영구 미연결**이다.

### 파급 범위
실제로 grep 해 확인한 범위:
· 근무표 그리드 전 표면 — `get_venue_grid_summary`(월 요약 셀: 배치/공고/필요 뱃지) · `get_venue_day_slots`(하루 패널 스태프 목록). 소비처 src/repositories/supabase/WorkScheduleRepository.ts, app/(employer)/work-schedule.tsx, src/components/workSchedule/VenueDayPanel.tsx·VenueDayDetail.tsx.
· 지점 정산 전 표면 — src/repositories/supabase/WorkLogRepositoryVenue.ts:33-94 → src/services/work/settlement/settlementVenueQuery.ts:80-151 → app/(employer)/venue-settlements.tsx(목록·월 합계·미정산 건수·일괄 정산·폴백 배지).
· 영향 받지 않는 곳(중요) — 공고별 정산 app/(employer)/my-postings/[id]/settlements.tsx, 지원자 관리, QR 출퇴근, 스케줄 탭(구직자)은 전부 job_posting_id/staff_id 축이라 무영향. 금전이 사라지는 게 아니라 **집계 표면에서만 사라진다**.
· 역할 축 — UserRole 무관. employer 만 보는 표면이다. 구직자에게는 완전 무영향.
· 데이터 축 — `job_postings.venue_id`(FK job_postings(id), idx_job_postings_venue_id, baseline:388/11470/12783). 값이 NULL 로 남을 뿐 무결성 위반은 없다.
· 다중 지점 employer 만 노출된다. 지점 1곳/0곳 사장은 서버가 자동 연결하므로 이 경로에 진입조차 안 한다(jobManagementService.ts:110-118 + src/services/jobs/__tests__/jobManagementService.venueAutolink.test.ts:163-184 가 계약으로 고정).
· 추가 노출 경로 하나 더: `useVenueContainers(activeWorkspace?.id)`(src/hooks/workSchedule/useVenueContainers.ts:24 `enabled: featureEnabled && !!workspaceId`)가 activeWorkspace 미해소 시 disabled → venues=[] → 칩 **미노출** → 그런데 서비스는 default 워크스페이스로 폴백해 지점 2개+ 판정을 내리므로 역시 미연결. 이 경우 사장은 칩을 본 적조차 없다.

### 기각한 경쟁 가설
(b) '다른 경로로 이미 제공 중' — 기각. `VenueSelectChips` 전수 Grep 결과 렌더 소비처는 create.tsx:237 **한 곳**뿐(나머지 매치는 테스트·주석). edit.tsx 에 venueId 0건. work-schedule.tsx 에 공고 연결 UI 없음. 즉 등록 후 지점을 붙이는 사용자 경로가 앱 전체에 존재하지 않는다.

(c) '의도적 안전장치 — 잘못된 지점에 붙느니 안 붙는 게 낫다' — 부분 채택 후 기각. 자동 연결을 피한 것은 의도가 맞다(설계 D1 이 명시). 그러나 '미선택 제출을 허용한다'는 결정은 스펙 어디에도 없고, 같은 스펙 §1 이 '연결이 선결 조건'이라 못박았으므로 미선택 통과는 설계 의도와 **정반대 결과**다. 안전장치라면 최소한 사용자에게 트레이드오프를 고지해야 하는데 문구가 0건이다. 안전장치가 아니라 공백.

(d) '리팩터링 잔해' — 기각. `git log -L 102,128:…/jobManagementService.ts` 결과 해당 블록은 21f6356a0(#274, 2026-07-19)에서 **신규 도입**되어 지금까지 무수정. 칩도 5f132d9a8 에서 신규. 옛 구조의 잔해가 아니라 처음부터 이 형태다.

(e) '서버 어딘가에 폴백/보정이 있다' — 기각. `venue_id` 를 쓰는 마이그레이션은 5개 파일뿐이고(get_or_create_venue_container 의 `SET venue_id = id` 자기참조, venue_span_posting_ids, 인덱스, FK, 워크스페이스 가드) 사후 보정 UPDATE 는 없다. outbox 로 도는 `sync_schedule_board` 도 venue_id 를 만지지 않는다.

(f) '대회 공고라서 일부러 뺀 것' — 기각. 대회 배제는 #274 에서 **반전**됐다(venueSelection.ts:24-27 주석 + venueAutolink.test.ts:198-228 이 '대회도 동일 자동 연결'을 고정). 지금 미연결의 원인은 postingType 이 아니라 지점 수다.

### 수정 설계
세 갈래로 나눈다. ①②는 같은 PR, ③은 선택.

① 등록 시 침묵 제거 — app/(employer)/my-postings/create.tsx
· 기본 선택 시딩: `selectedVenueId` 를 `useState(undefined)` 대신, 프리셋/그리드 프리필이 이미 실어 온 venueId 와 **같은 값**으로 시작시킨다. 구체적으로 `lastPosting?.venueId` 가 `venues` 안에 존재할 때만 초기값으로 쓰는 `useEffect`(1회 가드, `venuesQuery.isSuccess && selectedVenueId === undefined` 조건)를 둔다. 이유는 편의가 아니라 **표시 정합**이다 — 현재는 프리셋이 venueId 를 싣는데 칩은 미선택으로 보이는 desync 가 있다.
· 제출 게이트: `handleOrderSheetSubmit`(create.tsx:151) 의 본문을 `submitWith(finalInput: CreateJobPostingInput)` 로 추출하고, 진입부에서 `if (showVenueChips && !finalInput.venueId) { confirmAction({ title: '지점 없이 등록할까요?', message: '지점을 고르지 않으면 이 공고는 어느 지점 근무표에도 잡히지 않아요. 등록 후 공고 수정에서 지점을 지정할 수 있어요.', confirmText: '지점 없이 등록', onConfirm: () => void submitWith(finalInput) }); return; }`. `confirmAction` 은 콜백형이므로(app/(employer)/venue-settlements.tsx:140-149 선례) async 흐름을 쪼개야 한다 — `Alert.alert` 직접 호출 금지 규칙 준수.
· 칩 캡션: `VenueSelectChipsProps` 에 `caption?: string` 추가, create.tsx 에서 '고른 지점의 근무표·정산에 이 공고 인원이 잡혀요' 전달. VenueSelectChips.tsx:32 의 '지점 선택' 아래 `text-xs text-content-muted` 한 줄(다크모드 토큰 그대로).

② 사후 교정 경로 신설 — app/(employer)/my-postings/[id]/edit.tsx
영속 배선은 **이미 전부 존재한다**(신규 배관 불필요, 실측): `draftToUpdateJobPostingInput`(src/utils/job-posting/draftAdapter.ts:407-425)이 `hasVenueIdField(draft)` 일 때 `venueId` 를 patch 에 싣고 → `mergeJobPostingInput`(serialization.ts:436-444)이 patch 를 스프레드하며(`toCreateJobPostingInput` 는 venueId 를 안 실으므로 patch 가 유일 소스) → `serializeJobPostingV3`(serialization.ts:360-364)이 `input.venueId` 우선으로 문서에 기록 → `updateWithTransaction`(src/repositories/supabase/JobPostingRepository.ts:756-790)이 그대로 UPDATE. 편집 폼도 `draftToValues` 로 venueId 를 왕복시킨다.
따라서 필요한 건 UI 뿐이다: edit.tsx 에 `useActiveWorkspace`+`useVenueContainers` 를 추가하고, `selectedVenueId` 를 `existingJob?.venueId` 로 초기화, `StackHeader` 아래 `VenueSelectChips` 렌더(create.tsx:236-242 와 동형), `handleSubmit`(edit.tsx:87)에서 `const input = applySelectedVenueToUpdate(valuesToUpdateInput(values), selectedVenueId)`.
· `src/utils/order-sheet/venueSelection.ts` 에 `applySelectedVenueToUpdate(input: UpdateJobPostingInput, selectedVenueId?: string): UpdateJobPostingInput` 신설(기존 `applySelectedVenue` 와 동형, 타입만 다름). 기존 함수에 제네릭을 얹지 말 것 — create/update 시맨틱이 다르다(update 는 키 생략=현행 유지).
· 지점 이동 경고: 이미 확정 인원이 있는 공고의 지점을 바꾸면 근무표·지점 정산 귀속이 통째로 옮겨간다. `confirmAction({ title: '지점을 바꿀까요?', message: '이 공고의 근무 기록이 새 지점의 근무표와 정산으로 옮겨져요. 이미 지급 완료된 금액은 그대로예요.' })` 를 `selectedVenueId !== existingJob.venueId` 일 때만.

③ (선택) 서버 신뢰 경계 — src/services/jobs/jobManagementService.ts
현재 `resolveDefaultVenueId` 는 `input.venueId` 가 있으면 **검증 없이 통과**시킨다(:106-107). 클라가 임의 UUID 를 보내도 그대로 기록된다. `if (input.venueId)` 분기에서 `getVenueContainers(workspaceId)` 결과에 포함되는지 확인하고, 아니면 `PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, { userMessage: '선택한 지점에 공고를 등록할 권한이 없어요.' })` 로 fail-closed. 같은 파일 `resolveWorkspaceId`(:68-84)가 이미 같은 패턴을 쓰고 있으므로 형태가 일관된다. 단 라운드트립 1회가 늘고, 그리드 프리필(route venueId) 경로도 이 검증을 타게 되니 그 회귀 테스트를 함께 갱신할 것.

### 리스크
· ①의 confirmAction 게이트는 **웹에서 반드시 실기 확인**해야 한다. 프로젝트 규칙상 `Alert.alert` 직접 호출은 웹 no-op 이라 금지이고 `confirmAction` 을 써야 하는데, 콜백형이라 제출 흐름을 쪼개면서 `markClean()`/`setIsDirty(false)` 타이밍(create.tsx:158-161 의 '같은 틱 stale 가드' 주석)이 어긋나면 저장 성공 후에도 이탈 경고가 뜬다. 추출한 `submitWith` 안에 그 순서를 통째로 옮겨야 한다.
· ①의 기본 선택 시딩은 '조용히 잘못된 지점에 붙는다'는 원래 우려를 되살릴 수 있다. 그래서 **칩 UI 에 그 선택이 보이는 상태에서만** 시딩한다(현재 프리셋 경로는 보이지도 않는 채 붙고 있으니 순개선). `venues.some(v => v.id === lastVenueId)` 가드가 빠지면 삭제된 지점 id 가 선택돼 FK 위반 대신 조용한 미표시가 된다.
· ②의 지점 변경은 **이미 지급 완료된 근무의 월별 지점 정산 소속을 바꾼다**. `payroll_amount` 는 동결이라 금액은 안 변하지만, A지점 7월 정산에 잡혔던 행이 B지점 7월로 옮겨간다. 회계상 혼란 소지 — 그래서 확인 다이얼로그를 필수로 둔다. 되돌리기는 다시 칩을 바꾸면 되므로 편도 문은 아니다.
· ②는 낙관적 잠금(`useOptimisticLockBaseline`, edit.tsx:81-85)과 `assertConfirmedRolesSurvive`(JobPostingRepository.ts:768) 경로를 그대로 탄다 — venue 축은 그 가드들이 보지 않으므로 새 충돌은 없다.
· 파급이 없다고 단정할 수 없는 유일한 축: `enqueueScheduleBoardSync(jobPostingId,'update',…)`(jobManagementService.ts:197)로 outbox 가 도는데, `sync_schedule_board` 가 venue_id 를 읽지 않음은 마이그 grep 으로 확인했다(venue_id 언급 5파일에 sync 계열 없음). 따라서 outbox 재동기화가 지점 변경을 되돌리지는 않는다.
· 테스트: `src/utils/order-sheet/__tests__/venueSelection.test.ts`(기존)에 update 변형 추가, `app/(employer)/my-postings/__tests__/CreateJobPostingScreen.test.tsx`(기존, 5f132d9a8 에서 칩 케이스 10줄 추가됨)에 '미선택 제출 시 confirmAction 호출' red-green. 순수 헬퍼만 테스트하면 게이트가 살아 있어도 green 이 된다는 선례(S5 CRITICAL)를 반복하지 말 것 — 화면 렌더 테스트로 잡아야 한다.

### 선행 의존성
②(편집 화면 칩)는 ①과 독립적으로 배포 가능하지만, ① 의 확인 문구가 '등록 후 공고 수정에서 지점을 지정할 수 있어요'라고 약속하므로 **② 가 없는 상태로 ① 만 내보내면 거짓 안내가 된다**. 둘을 같은 PR 로 묶거나, ② 가 늦어지면 ① 의 문구에서 그 문장을 빼야 한다. ③ 은 완전 독립.

### 🔍 검증 — 놓친 제약
① 근무표·지점정산 표면은 weekly_grid_enabled 플래그 뒤다(src/config/featureFlags.ts:21 빌드 폴백 true + 원격 app_config 오버라이드, work-schedule.tsx 헤더 주석 'OFF면 Redirect') — 칩과 제안된 확인 문구('근무표에 안 잡혀요')는 플래그 미게이트라 OFF 워크스페이스에도 노출된다. 분석이 이 축을 전혀 언급하지 않았다. ② VenueSelectChips 는 선택 해제가 불가능하다(재탭도 onSelect(id), 토글오프 없음 — src/components/employer/order-sheet/VenueSelectChips.tsx:25,43) → 수정설계 ①의 '기본 선택 시딩'과 '미선택 확인 게이트'가 상호 배타다: 시딩되는 순간 !finalInput.venueId 게이트는 영원히 사문화된다. 같은 이유로 ②의 편집 칩에서도 '연결 제거' UX 가 불가하다(update 는 키 생략=현행 유지, venueId:null 시맨틱이 직렬화 계약에 없음 — serialization.ts:360-364 는 undefined 체크만). ③ 템플릿 프리셋도 venueId 를 운반할 수 있다(templateToValues→templateToDraft, src/types/jobTemplate.ts:176; 단 extractTemplateData 가 venueId 를 안 실어 그리드 주입 이력 템플릿 한정의 좁은 엣지) — 반례를 '마지막 공고' 프리셋으로만 한정한 것은 과소. ④ e2e/ 4개 스펙이 공고 등록 플로우를 실주행하며(employer-posting-crud.spec.ts 는 lastPosting 프리셋까지 조작) 확인 다이얼로그는 시드 워크스페이스 지점이 2개+면 e2e 를 깬다. e2e 에 'venue' 문자열은 0건이라 지점 시드는 아마 1개(자동생성)지만 quality 범위 밖이므로 시드 지점 수 실측이 선행돼야 한다. ⑤ ③의 검증은 클라이언트뿐 — FK 는 job_postings(id) 존재만, UPDATE RLS 는 행 소유만 검사하므로 타 워크스페이스 venue UUID 를 DB 는 여전히 안 막는다(create 경로도 동일하게 열려 있어 회귀는 아니나 '신뢰 경계'라는 이름값을 못 한다). ⑥ RPC 불필요 판단은 타당 — venue_id 는 문서 직렬화가 단일 UPDATE 로 싣는 일반 컬럼(JobPostingRepository.ts:786-794, toSnakeCase 로 문서 전체 기록)이라 다중 쓰기가 아니다.

### 🔧 검증 — 설계 보정
①의 시딩 방식을 교체하라. 'lastPosting?.venueId 를 마운트 시 useEffect 로 시딩'은 표시 정합이 아니라 동작 변화다 — desync 는 프리셋을 '적용'해야 생기는데(폼 venueId 의 유일 공급원이 handleApplyPreset 의 form.reset, OrderSheetScreen.tsx:569/571; 일반 생성 initialValues 는 venueId 키 부재 — mappers.ts:503), 마운트 시딩은 프리셋을 안 쓴 순수 신규 작성까지 마지막 지점에 붙인다(현재는 미연결이 계약). 게다가 칩 토글오프가 없어 시딩 후 게이트가 죽는다. 올바른 최소 수정: create.tsx 프리셋 조립(:111-116 및 템플릿 루프 :120-131)에서 scheduleGroups dates 를 비우는 것과 같은 자리에서 venueId 를 함께 제거해 이 화면의 venue 소스를 칩 하나로 만든다. 그러면 반례(칩 미선택인데 직전 지점에 조용히 연결)가 원천 소멸하고 확인 게이트가 전 케이스를 커버하며 useEffect·가드도 불필요해진다. '기본 선택' 을 제품으로 원하면 재탭 토글오프 또는 '지점 없이' 칩 추가가 선행 조건. ②는 실행가능을 재확인했다 — edit.tsx 는 이미 valuesToUpdateInput(mappers.ts:531-533)→draftToUpdateJobPostingInput(draftAdapter.ts:407-425 venueIdPatch)→mergeJobPostingInput(patch 스프레드)→serializeJobPostingV3:360-364→updateWithTransaction 문서 전체 UPDATE 로 venueId 를 왕복시키고 있어(edit.tsx 에 'venueId' 0건인데도) UI 만 얹으면 된다는 주장이 정확하다. 단 applySelectedVenueToUpdate 는 '변경' 만 담당하고 '연결 해제' 는 불가함을 문서화할 것. ①의 확인 문구는 weekly_grid_enabled OFF 워크스페이스 노출 여부를 결정하고 가라(칩 노출 조건에 플래그를 얹거나 문구에서 근무표 언급을 일반화).

### 검증 메모
판정 '부분사실'과 프리셋 반례 포함 전 인용 실증(라인 정확, OrderSheetScreen 제출 게이트만 726-747→실제 727-749 미세 드리프트). 인과사슬(applySelectedVenue 통과→resolveDefaultVenueId no-op→serializeJobPostingV3 키 생략→venue_id NULL→venue_span_posting_ids 스팬 탈락, baseline.sql:9613-9624)과 파급 3표면·기각가설 5건 모두 코드와 일치. 반례는 오히려 과소평가 — 템플릿 프리셋 엣지가 추가로 존재. 수정설계는 ②③ 실행가능하나 ①의 시딩·게이트 상호충돌(칩 토글오프 부재)로 그대로는 못 나간다.

### 🙋 사람이 결정할 것
제품 오너 결정 2건. (1) 다중 지점 사장에게 지점을 **필수**로 만들 것인가, 아니면 '지점 없음'을 정식 선택지로 인정할 것인가. 필수라면 확인 다이얼로그 대신 제출 차단 + 칩 필수 표시가 맞고, 정식 선택지라면 칩 줄에 '지점 없음' 칩을 명시적으로 하나 더 두는 편이 침묵보다 낫다(현재는 '고르지 않음'이 UI 에 존재하지 않는 상태다). (2) 이미 venue_id NULL 로 쌓인 기존 공고를 소급 연결할 것인가 — 데이터 마이그레이션으로 자동 추정(예: location 일치)하는 것은 오연결 위험이 크므로 권하지 않고, ② 의 편집 UI 로 사장이 직접 고치게 하는 안을 기본으로 본다.


## `venue-settlement-detail-amount-mismatch` — 지점 정산 상세 모달이 금액을 독자 재계산 — 카드·저장값과 어긋남(모달이 유일하게 다른 계산기)

**주장 판정**: 사실 · **심사**: CONFIRMED · **설계 실현성**: 실행가능 · **난이도**: S→S · **마이그레이션**: 불필요

### 근거 (실측)
① app/(employer)/venue-settlements.tsx:395-401 — `<SettlementDetailModal visible={detailVisible} onClose={…} workLog={detailWorkLog} salaryInfo={detailWorkLog?.salaryInfo ?? { type: 'hourly', amount: 0 }} onRevertSettlement={handleOpenRevert} />`. `allowances`/`taxSettings` prop 이 **없다**(둘 다 optional — src/components/employer/settlement/SettlementDetailModal/types.ts:18-20).
② src/components/employer/settlement/SettlementDetailModal/SettlementDetailModal.tsx:105-109 — `const settlement = useMemo(() => workLog ? calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings) : null, [...])`. :111 `getAllowanceItems(allowances)`. :190-196 `hasValidTimes && settlement && <SettlementAmountSection … />`.
③ src/domains/settlement/helpers.ts:167-204 — `effectiveAllowances = workLog.customAllowances || allowances`(undefined 이면 수당 0), `effectiveTaxSettings = workLog.customTaxSettings || taxSettings || DEFAULT_TAX_SETTINGS`. `DEFAULT_TAX_SETTINGS = { type: 'none', value: 0 }`(src/utils/settlement/tax.ts:21-24)이고 `calculateTaxAmountByItems` 는 `type==='none'` 이면 즉시 0 반환(:37-38). → 수당 0 · 세금 0 확정.
④ 표시 지점: src/components/employer/settlement/SettlementDetailModal/SettlementAmountSection.tsx:75-81(수당 줄은 `allowancePay > 0` 에서만), :95-101(세금 줄은 `taxAmount > 0` 에서만), :105-111 '총 정산 금액' = `taxAmount > 0 ? afterTaxPay : totalPay`. 셋 다 조건이 무너져 **줄 자체가 사라지고 총액은 세전 기본급만** 남는다.
⑤ 반면 카드: venue-settlements.tsx:243-253 `<SettlementCard … calculatedAmount={item.calculatedAmount} />`, SettlementCard.tsx:92-97 `displayAmount = shouldUseFrozenPayrollAmount(...) ? workLog.payrollAmount : (calculatedAmount ?? …)`. 그 `calculatedAmount` 는 src/services/work/settlement/settlementVenueQuery.ts:44-59 에서 `getEffectiveAllowances`/`getEffectiveTaxSettings` 로 해소한 컨텍스트로 `SettlementCalculator.calculate` 를 돌린 `afterTaxPay` 다.

### 근본 원인
한 숫자에 계산기가 둘이고, 모달 쪽이 **컨텍스트 없이도 계산을 거부하지 않는다**는 게 근본이다.

· 계산기 A(정본): `resolveEffectiveSalaryWithSource` + `getEffectiveAllowances` + `getEffectiveTaxSettings` + `SettlementCalculator.calculate`. 읽기(settlementVenueQuery.ts:39-53)와 **쓰기**(src/repositories/supabase/SettlementRepository.ts:836-865 `calculateSettlementAmount`)가 같은 조합을 쓴다. 쓰기는 이 값으로 호출자가 넘긴 amount 를 덮어써 `payroll_amount` 에 기록한다(SettlementRepository.ts:300-319).
· 계산기 B: `calculateSettlementFromWorkLog`(helpers.ts:167). 인자를 안 주면 조용히 0·none 으로 떨어진다.

모달이 B 를 쓰는 것 자체는 원래 공고 정산 화면 전용이었기 때문이다 — 그쪽은 src/features/employer/settlements/SettlementModals.tsx:116-128 에서 `getEffectiveSalaryInfoFromRoles`/`getEffectiveAllowances`/`getEffectiveTaxSettings` 세 개를 **전부** 넘겨 계약을 채운다. 지점 정산 화면은 나중에(#387 `97bf7e85c` 정산 배선, #388 `0ec9abc2c` 취소 진입점) 같은 모달을 재사용하면서 `salaryInfo` 하나만 채웠다. 즉 '컴포넌트를 재사용하면서 계약의 일부만 이행'한 미완성이고, prop 이 optional 이라 tsc 가 침묵했다. 같은 화면에서 **카드는 이미 이 함정을 한 번 겪고 고쳤다** — venue-settlements.tsx:240-242 주석이 'SETTLE-8: 예전엔 salaryInfo 만 넘겨 카드가 수당·세금 없이 다시 계산했고, 그래서 같은 근무가 서비스 값과 다른 금액으로 보였다'라고 명시한다. 카드만 고치고 **바로 옆 모달을 안 고친 것**이 이 결함의 정확한 정체다.

### 인과사슬
지점 정산 목록 진입 → `getVenueSettlementWorkLogs`(settlementVenueQuery.ts:80) → 공고 스팬 행은 `getPostingSettlementContext(posting)`(src/domains/job-posting/core.ts:301-308: `allowances: posting.compensation.allowances`, `taxSettings: posting.compensation.taxSettings`)로 해소 → `toSettlementWorkLog` 가 그 컨텍스트로 `afterTaxPay` 를 만들어 `calculatedAmount` 에 싣고 **allowances/taxSettings 는 버린다**(settlementVenueQuery.ts:44-45 에서 계산에만 쓰고 반환 객체 :55-62 에 안 담김; `SettlementWorkLog` 타입에도 필드가 없다 — src/services/work/settlement/types.ts:36-44) → 카드는 `calculatedAmount` 로 정확히 표시 → 사용자가 카드 탭 → 모달은 `salaryInfo` 만 받아 계산기 B 로 **재계산** → 수당 0·세금 0 → 총액이 카드와 다르게 표시.

갈리는 정확한 조건(끝까지 좁힘):
· **컨테이너 직속 행(jobPostingId === venueId)에서는 갈리지 않는다 — 증명 가능하게 동일하다.** `buildVenueContainerContext`(src/domains/settlement/venueSettlementContext.ts:41-50)가 `allowances: undefined, taxSettings: undefined` 를 명시하고, 서비스 쪽 `getEffectiveAllowances(wl, undefined)` → `wl.customAllowances || {}`, `getEffectiveTaxSettings(wl, undefined)` → `wl.customTaxSettings || DEFAULT_TAX_SETTINGS`. 모달 쪽은 `wl.customAllowances || undefined`, `wl.customTaxSettings || DEFAULT_TAX_SETTINGS`. `calculateAllowances({})` 와 `calculateAllowances(undefined)` 는 둘 다 0 이므로 결과가 같다.
· **갈리는 건 공고 스팬 행 + (공고 compensation.allowances 에 0 초과 항목이 있거나 compensation.taxSettings.type !== 'none') + 그 work_log 에 대응하는 custom 오버라이드 부재**, 이 세 조건이 동시에 성립할 때다. 수당만 있으면 상세가 카드보다 **적게**, 세금만 있으면 상세가 카드보다 **많게** 나온다(세금 공제가 빠지므로).

추가로 발견한 두 번째 발산 축(주장에 없던 것, 두 화면 모두 해당): **지급 완료 행에서 카드는 동결값, 모달은 재계산**이다. SettlementCard.tsx:92-97 은 `shouldUseFrozenPayrollAmount(payrollStatus===COMPLETED, workLog.payrollAmount)` 로 `payroll_amount` 를 그대로 쓰는데, 모달에는 그런 분기가 아예 없다(SettlementDetailModal.tsx 전체에 `payrollAmount` 참조 0건 — `SettlementCompletedBanner` 는 `payrollDate` 만 받는다). 즉 확정 이후 공고 급여·수당·세금 설정이 바뀌면 **공고 정산 화면에서도** 카드(동결 지급액)와 상세(현재 설정 기준 재계산)가 갈린다. 지급 완료 취소(SETTLE-3) 진입점이 이 모달 안에 있으므로(SettlementDetailModal.tsx:256-271), 사장이 '실제 지급액'을 확인하러 연 화면이 지급액이 아닌 값을 보여주는 상태다.

### 파급 범위
· `SettlementDetailModal` 렌더 소비처는 2곳(Grep 전수): app/(employer)/venue-settlements.tsx:395(지점 정산) · src/features/employer/settlements/SettlementModals.tsx:110(공고 정산 app/(employer)/my-postings/[id]/settlements.tsx). 나머지 매치는 배럴(src/components/employer/index.ts)·타입·테스트·훅 주석.
· 수당/세금 축의 결함은 **지점 정산 화면 단독**. 공고 정산 화면은 SettlementModals.tsx:121-128 에서 온전히 넘긴다.
· 동결 금액 축의 결함은 **두 화면 모두**. 즉 이쪽이 파급이 더 넓다.
· 같은 파일의 형제 모달 `SettlementEditModal`(src/components/employer/settlement/SettlementEditModal.tsx:146-150)도 같은 계산기 B 를 쓰지만, 유일 소비처인 SettlementModals.tsx:171-189 가 allowances/taxSettings 를 넘기므로 현재는 정상. 지점 정산 화면이 나중에 금액 수정을 붙이면 같은 함정을 반복한다(현재 venue-settlements.tsx 는 `onEditAmount` 를 안 넘긴다 — 그래서 이 화면에는 custom* 를 만들 진입점 자체가 없다).
· 금전 영향 방향: 저장값(`payroll_amount`)은 정본 계산기 A 로 기록되므로 **잘못된 금액이 지급 기록에 남지는 않는다**. 손상되는 건 사장의 판단 근거다 — 상세를 보고 '카드가 틀렸나' 싶어 정산을 미루거나, 반대로 상세 금액을 믿고 앱 밖에서 그 금액을 이체할 수 있다(문구가 '실제 이체는 앱 밖에서 진행해요' — SettlementModals.tsx:163-164).
· 역할 축: employer 전용 화면. 구직자 표면 무영향. 스태프가 보는 정산 금액은 별도 경로(src/components/schedule/tabs/SettlementTab.tsx:135)라 이 결함과 무관.
· DB 무영향.

### 기각한 경쟁 가설
(a) '카드가 틀리고 모달이 맞다' — 기각. 쓰기 경로 `SettlementRepository.calculateSettlementAmount`(SettlementRepository.ts:836-865)가 읽기와 **완전히 같은 헬퍼 조합**(status==='container' 이면 `buildVenueContainerContext`, 아니면 `getPostingSettlementContext` → `getEffectiveSalaryInfoFromRoles`/`getEffectiveAllowances`/`getEffectiveTaxSettings` → `SettlementCalculator.calculate`)을 쓰고, 그 결과로 호출자 amount 를 덮어써 `payroll_amount` 에 기록한다(:300-319 'Individual settlement amount mismatch detected, using canonical amount'). 따라서 카드 금액 = 실제 저장·지급 기록 금액. 정본은 서비스 쪽이며 모달이 유일한 이단이다.

(b) '세금은 어차피 기본이 none 이라 차이 없다' — 기각(단, 범위는 좁아진다). 서비스 쪽도 컨텍스트가 비면 `DEFAULT_TAX_SETTINGS`(none)로 떨어지므로 컨테이너 직속 행은 두 경로가 동일하다. 그러나 공고에 `compensation.taxSettings` 가 설정돼 있으면(설정 UI 가 실재한다 — SettlementModals.tsx:192-199 `SettlementSettingsModal`, 저장은 `updateJobPostingSettlementSettings` src/services/jobs/jobManagementService.ts:319-340) 서비스는 그 값을, 모달은 none 을 쓴다. '차이 없음'은 컨테이너 직속 행에 한정된 참이다.

(c) 'work_log 의 custom* 오버라이드가 있어서 실제로는 일치한다' — 기각. `customAllowances`/`customTaxSettings` 는 금액 수정 모달(`SettlementEditModal`)이 만드는데, 지점 정산 화면은 `onEditAmount` 를 상세 모달에 넘기지 않는다(venue-settlements.tsx:395-401 — `onEditTime`·`onEditAmount`·`onSettle` 모두 미전달). 이 화면에서 생성될 수 없으므로 일반해가 아니다. 공고 정산 화면에서 만들어진 행이면 우연히 일치할 수는 있다.

(d) '모달이 금액 섹션을 아예 안 그려서 비교 대상이 없다' — 기각. 게이트는 `hasValidTimes && settlement`(SettlementDetailModal.tsx:190) 하나뿐이고, 정산 대상 행은 정의상 checkIn/checkOut 이 모두 있다(venue-settlements.tsx:117-127 의 `settleableWorkLogs` 필터가 `!!wl.checkInTime && !!wl.checkOutTime` 을 요구). 정산할 수 있는 행은 전부 금액 섹션을 그린다.

(e) '최근 커밋 bc295df49(#393)가 이 부분을 건드려 이미 손댔다' — 기각. `git show --stat bc295df49` 의 변경 파일은 4개(GroupedSettlementCard.tsx · SettlementList.tsx · GroupedSettlementCard.selection.test.tsx · settlementGrouping.ts)로 venue-settlements.tsx 도 SettlementDetailModal 도 포함되지 않는다. `git log -- venue-settlements.tsx` 상 최종 변경은 0ec9abc2c(#388, 취소 진입점 추가)이며 그때도 `salaryInfo` 만 넘기는 형태를 그대로 뒀다.

### 수정 설계
정본 판단: **금액 계산의 SSOT 는 서비스/리포지토리 해소 경로**(`resolveEffectiveSalaryWithSource`+`getEffectiveAllowances`+`getEffectiveTaxSettings`+`SettlementCalculator.calculate`)다. 근거는 취향이 아니라 구조다 — 쓰기(`SettlementRepository.calculateSettlementAmount`)가 이미 그 경로를 쓰고 그 값이 `payroll_amount` 로 굳는다. 읽기 표면이 그와 다른 계산을 하면 '화면과 지급 기록이 다르다'가 되고, 그건 이 코드베이스가 `venueSettlementContext.ts:10-16` 에서 이미 한 번 겪고 '읽기·쓰기가 같은 함수를 통과하게 만든다. 한쪽만 고치면 다음에 또 갈라진다'고 못박은 실패다. 따라서 **모달은 계산기가 아니라 표시기가 되어야 한다.**

1단계 — 해소된 컨텍스트를 행에 실어 보낸다(즉시 봉합, 계산기 변경 0)
· src/services/work/settlement/types.ts:36-44 `SettlementWorkLog` 에 `allowances?: UtilityAllowances; taxSettings?: UtilityTaxSettings;` 추가. 주석에 '계산에 실제 사용된 컨텍스트(상세 모달 표시용) — venue 경로가 채운다'로 기존 `salaryInfo` 주석과 같은 톤 유지.
· src/services/work/settlement/settlementVenueQuery.ts:33-63 `toSettlementWorkLog` — 이미 :44-45 에서 계산한 `allowances`/`taxSettings` 를 반환 객체(:55-62)에 함께 싣는다. 새 계산 없음, 버리던 값을 안 버리는 것뿐이다.
· app/(employer)/venue-settlements.tsx:395-401 — `allowances={detailWorkLog?.allowances}` `taxSettings={detailWorkLog?.taxSettings}` 추가. 이걸로 공고 정산 화면(SettlementModals.tsx:121-128)과 **계약이 동일**해진다.

2단계 — 모달에서 총액 재계산을 걷어낸다(구조 교정, 두 화면 공통 결함까지 닫음)
· src/components/employer/settlement/SettlementDetailModal/types.ts `SettlementDetailModalProps` 에 `calculatedAmount?: number` 추가. 주석은 `SettlementCardProps.calculatedAmount`(SettlementCard.tsx:44-49, SETTLE-8)의 문구를 그대로 따른다 — 같은 계약을 두 번 설명하지 않게.
· SettlementDetailModal.tsx — `shouldUseFrozenPayrollAmount`(@/utils/settlementGrouping)를 import 하고 `const displayTotal = shouldUseFrozenPayrollAmount(payrollStatus === STATUS.PAYROLL.COMPLETED, workLog.payrollAmount) ? workLog.payrollAmount : (calculatedAmount ?? (settlement.taxAmount > 0 ? settlement.afterTaxPay : settlement.totalPay));` 를 계산해 `SettlementAmountSection` 에 넘긴다. 내역 줄(기본급·수당·세금)은 기존 `settlement` 로 계속 그린다 — 컨텍스트가 온전해진 1단계 이후에는 내역 합이 총액과 맞는다.
· SettlementAmountSection.tsx:20-34 에 `totalOverride?: number` 추가, :105-111 의 value 를 `formatCurrency(totalOverride ?? (settlement.taxAmount > 0 ? settlement.afterTaxPay : settlement.totalPay))` 로.
· 소비처 2곳 모두 넘긴다: venue-settlements.tsx 는 `calculatedAmount={detailWorkLog?.calculatedAmount}`, SettlementModals.tsx:110-134 는 `modals.selectedWorkLogForDetail` 에 canonical 금액이 없으므로 우선 생략하고 **동결 축만 이득을 본다**(완료 행 = payrollAmount 표시).

왜 '모달이 아무것도 계산하지 않게' 까지 가지 않는가: 내역 줄(시급 × 근무시간, 수당, 세금 공제)은 표시 목적으로 분해값이 필요한데 서비스는 `afterTaxPay` 스칼라만 싣는다. 분해값을 전부 실어 보내려면 `SettlementWorkLog` 가 `SettlementBreakdown`(SettlementCalculator.ts:46-52)을 통째로 들어야 하고 그건 이 결함을 고치는 데 필요한 범위를 넘는다. **총액만 정본에 종속시키고 내역은 로컬 분해**가 최소 침습이다.

### 리스크
· 1단계 적용 후 지점 정산 상세에 **수당 배지와 '세금 공제' 줄이 새로 등장한다**(SettlementAmountSection.tsx:84-92, :95-101). 의도된 변화이지만 스크린샷 기반 회귀 테스트가 있다면 갱신 필요. 컨테이너 직속 행은 `buildVenueContainerContext` 가 둘 다 undefined 라 **화면이 전혀 안 바뀐다**(위 인과사슬에서 증명) — 회귀 위험이 그만큼 좁다.
· 2단계의 `totalOverride` 는 내역 합과 총액이 어긋나 보일 수 있는 새 상태를 만든다: 완료 행에서 동결 `payrollAmount` 를 총액에 쓰는데 내역은 현재 설정 기준이라, 공고 설정이 바뀐 뒤 열면 '기본급+수당-세금 ≠ 총액'이 된다. 이건 **사실을 드러내는 것**이지 새 결함이 아니다(지금은 지급액을 아예 안 보여준다). 다만 UX 상 완료 행에는 '확정 당시 지급액이에요' 한 줄 캡션을 `SettlementCompletedBanner` 근처에 두는 편이 정직하다 — 이건 제품 판단.
· `SettlementDetailModal` 은 배럴(src/components/employer/index.ts)로 재export 되지만 렌더 소비처는 2곳뿐이라 파급이 닫혀 있다(Grep 전수 확인).
· 테스트: app/(employer)/__tests__/venue-settlements.test.tsx 는 현재 `SettlementCard` 를 목으로 대체하고 상세 모달은 실제 렌더한다(:37-45 주석 — useUserProfile 만 목). 따라서 '수당 있는 공고 스팬 행 → 카드 금액 == 상세 총액' red-green 을 이 스위트에 넣을 수 있다. **순수 헬퍼 테스트로 대체하지 말 것** — 이 결함은 헬퍼가 아니라 prop 전달 누락이라 헬퍼 테스트는 전부 green 인 채로 통과한다(#387 에서 같은 방식으로 CRITICAL 이 살아남은 선례).
· `npm run quality` 로 tsc 확인 필요: `SettlementWorkLog` 에 optional 필드 추가라 기존 생성지점이 깨지지는 않는다. 반대로 **필수로 추가하면 tsc 가 누락 생성지점을 전수 지목**하므로(#388 교훈) 안전을 원하면 `toSettlementWorkLog` 반환 타입만 필수로 좁히는 방법도 있다.

### 선행 의존성
1단계는 독립. 2단계는 1단계 없이 넣으면 지점 정산에서 총액만 맞고 내역 줄이 여전히 비어(수당·세금 줄 없음) '총액 20만원인데 내역은 15만원'이 되어 더 혼란스럽다 — **반드시 1단계를 먼저 또는 동시에** 적용할 것. SettlementModals.tsx(공고 정산) 쪽 `calculatedAmount` 배선은 그 화면이 canonical 금액을 계산하지 않으므로 지금은 불가 — 동결 축 이득만 먼저 취하고, 필요하면 별도 작업으로 공고 정산 경로에도 서비스 canonical 을 도입한다.

### 🔍 검증 — 놓친 제약
① 1단계 후 컨테이너 직속 행의 allowances 는 undefined 가 아니라 빈 객체 {} 로 실린다 — getEffectiveAllowances(src/domains/settlement/helpers.ts:300-308)가 defaultAllowances||{} 를 반환하므로. 모달 계산 결과는 동일(calculateAllowances({})==0)하나 getAllowanceItems({}) 가 빈 배열을 반환하는지, '수당 없음' 판정을 키 개수로 하는 코드가 새로 생기지 않는지 확인할 것('화면이 전혀 안 바뀐다' 증명은 이 전제 위에서만 성립). ② 제안된 red-green 은 app/(employer)/__tests__/venue-settlements.test.tsx 에서 가능함을 실측 확인(useUserProfile 목 + 상세 모달 실렌더 구조 일치)했으나, SettlementCard 는 onPress 만 발화 가능한 최소 목이라 '카드 금액==모달 총액' 단언에는 카드 목이 금액을 노출하도록 목 보강이 필요하다. ③ 2단계의 calculatedAmount 를 공고 정산(SettlementModals) 쪽에 생략하는 판단은 그룹 모드 때문에라도 옳다 — 그 화면은 useSettlementDateNavigation 이 모달 내부에서 workLog 를 날짜 네비게이션으로 교체하므로 최초 행 기준 calculatedAmount 가 고정 전달되면 오히려 새 mismatch 를 만든다(venue 화면은 groupedSettlement 미전달이라 무관). ④ 마이그·RLS·RPC 전부 무관(읽기 표시만), e2e 에 venue/정산 상세 참조 0건 — 게이트 파급 없음, 확인 완료. ⑤ SettlementWorkLog optional 필드 추가는 tsc 파급 0 이 맞다(src/services/work/settlement/types.ts:36-44 실측; 필수 승격 대안은 #388 교훈과 일관).

### 🔧 검증 — 설계 보정
실질 보정 없음 — 설계 그대로 실행 가능하다. 정본 판단(쓰기 SettlementRepository.calculateSettlementAmount:836-865 가 읽기 settlementVenueQuery 와 동일 헬퍼 조합으로 canonical 을 만들어 호출자 amount 를 덮어쓰고 payroll_amount 로 굳힘 — :301-322 실측)과 두 번째 발산 축(모달 전문에 payrollAmount 참조 0건 vs 카드 shouldUseFrozenPayrollAmount:92-98, settlementGrouping.ts:55 실재)까지 전부 코드와 일치. 미세 제안 둘: (a) 1단계에서 venue-settlements.tsx 전달 시 detailWorkLog?.allowances 가 {} 인 컨테이너 행과 undefined 폴백({ type:'hourly', amount:0 } salaryInfo 폴백처럼)의 구분을 주석으로 남겨라 — 다음 소비자가 '빈 객체=공고 수당 없음'과 '미해소'를 혼동하는 게 이 결함의 재발 형태다. (b) 2단계 totalOverride 도입 시 SettlementAmountSection 의 기존 식(taxAmount>0 ? afterTaxPay : totalPay)을 fallback 으로 유지하는 제안이 맞고, 완료 행 '확정 당시 지급액이에요' 캡션은 SettlementRevertModal 이 이미 payrollAmount 를 보여주는 것(venue-settlements.tsx:408)과 문구 톤을 맞출 것.

### 검증 메모
판정 '사실' 전 구간 실증: venue-settlements.tsx:395-401 이 salaryInfo 만 전달(allowances/taxSettings prop 부재), 모달은 helpers.ts:180-182 폴백으로 수당0·세금none 확정, SettlementAmountSection 은 조건부 줄 소멸+세전 총액(:75-81,:95-101,:105-111). 갈리는 조건의 3중 한정(공고 스팬 행+공고 수당/세금 설정+custom 부재)과 컨테이너 직속 행 동일성 증명, 기각가설 5건(특히 카드=정본 논거, bc295df49 무접촉) 모두 정확. 소비처 2곳 전수도 재확인. 난이도 S 유지 타당 — 1단계는 버리던 값 싣기, 2단계 포함해도 렌더 테스트가 최대 비용.

### 🙋 사람이 결정할 것
제품 오너 결정 1건: 지급 완료된 근무의 상세 화면에서 총액을 (A) 확정 당시 동결 지급액으로 볼 것인가, (B) 현재 설정 기준 재계산으로 볼 것인가. 카드는 이미 (A)를 택했고(SettlementCard.tsx:88-91 주석 'SETTLE-5: 완료 시점에 확정·지급된 금액은 이후 공고 급여가 바뀌어도 불변') 저장값도 (A)이므로 일관성상 (A)를 권하지만, 상세가 '지급 완료 취소'의 진입점이기도 해서 취소 후 재정산될 금액((B))을 함께 보고 싶다는 요구가 나올 수 있다. 둘 다 보여주려면 '지급액 / 현재 기준 재계산액' 두 줄이 필요하다.



---

# F-판단정보


## `applicant-reputation-invisible` — 지원자 평판이 구인자에게 안 보임 — 원인은 '렌더 미구현'이 아니라 users RLS 가 조용히 0행을 주는 것(프로필 블록 전체가 동반 실종)

**주장 판정**: 부분사실 · **심사**: PARTIAL · **설계 실현성**: 수정필요 · **난이도**: L→L · **마이그레이션**: 필요

### 근거 (실측)
주장의 결론(구인자 화면에 평점·근무횟수·노쇼가 안 보인다)은 사실이지만, 근거("src/components/employer/ 전역 평점 렌더 0건")는 거짓이다. 렌더 코드는 이미 있다.

[렌더는 존재]
- uniqn-mobile/src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:134-135 — `bubbleScore={userProfile?.bubbleScore?.score}` `reviewCount={userProfile?.bubbleScore?.totalReviewCount}` 를 CardHeader 에 전달.
- uniqn-mobile/src/components/employer/applicants/ApplicantCard/components/CardHeader.tsx:16,92-99 — `BubbleScoreBadge` 렌더 + `리뷰 {reviewCount}건` 텍스트. 가드는 `typeof bubbleScore === 'number'`.
- uniqn-mobile/src/components/employer/applicants/ApplicantProfileHeader.tsx:10,73-75 · ApplicantProfileModal.tsx:52 — 프로필 모달 헤더에도 동일 배지.

[데이터 경로가 RLS 로 끊겨 있다 — 여기가 진짜 원인]
- ApplicantCard.tsx:75-81 → uniqn-mobile/src/hooks/useUserProfile.ts:39-44 → src/services/auth/userProfileService.ts:5-7 → uniqn-mobile/src/repositories/supabase/UserRepository.ts:68-99 `getById`.
- UserRepository.ts:36-37 `USER_COLUMNS` 에 `bubble_score` 가 포함돼 있고, :72-76 은 `supabase.from('users').select(USER_COLUMNS).eq('id', userId).maybeSingle()` 로 **users 테이블을 직접** 친다.
- 배치 프리페치도 같다: src/hooks/useApplicantProfiles.ts:47-52 → UserRepository.ts:101-118 `getByIdBatch` = `.from('users').select(USER_COLUMNS).in('id', uniqueIds)`.
- uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql:14037 `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`
- 같은 파일 :14043 — `CREATE POLICY users_select ON public.users FOR SELECT USING (((SELECT auth.uid()) = id) OR ((SELECT public.get_my_role()) = 'admin'))`. **SELECT 정책은 이것 하나뿐**이다(전 마이그레이션 grep: `grep -rn "POLICY.*ON public.users" supabase/migrations/*.sql` → users_select · users_update 2건만).
- get_my_role() 정의(baseline, `CREATE FUNCTION public.get_my_role()`)는 `auth.jwt()->'app_metadata'->>'role'` 을 그대로 반환 — employer 는 'employer'.
→ 구인자가 지원자 uid 로 조회하면 RLS 가 행을 걸러 `data=null`, `error=null`. UserRepository.ts:83-85 는 `if (!data) return null` 로 조용히 null 반환. 에러도 로그도 없다.

[집계는 이미 DB 에 캐시돼 있다]
- baseline :10645 — `bubble_score jsonb DEFAULT '{"score": 50, "neutralCount": 0, "negativeCount": 0, "positiveCount": 0, "totalReviewCount": 0}'` 컬럼이 public.users 에 있다.
- baseline :1571-1584 — `create_review` RPC 가 리뷰 INSERT 직후 피평가자 `users.bubble_score` 를 원자 갱신(clamp 0..100, positive/neutral/negativeCount 증분, lastUpdatedAt). 즉 평균 별점 성격의 집계는 **이미 실시간 캐시**다. 새로 계산할 필요가 없다.

[reviews 원문도 못 읽는다]
- baseline :13977 `ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;` · :13970 `CREATE POLICY rev_select ... USING ((reviewer_id = auth.uid()) OR (reviewee_id = auth.uid()) OR (get_my_role() = 'admin'))`.
→ 다른 공고에서 남겨진 리뷰는 구인자에게 원천 차단. reviews 테이블 정의는 :10549-10567(work_log_id, reviewer_type, sentiment, tags, comment, bubble_score_change, created_at).

[노쇼도 교차 공고로는 못 센다]
- baseline :14082 work_logs RLS ON · :14057 `wl_select ... USING ((staff_id = auth.uid()) OR (owner_id = auth.uid()) OR (job_posting_id IN (내 workspace/협업 공고)))`.
- work_logs 컬럼(baseline :3875 부근) 에 `no_show_at jsonb` · `no_show_reason text` 존재, status enum 에 no_show 존재. 하지만 **내 공고 밖 행은 SELECT 자체가 안 된다.**

[리뷰 수집 회로는 실제로 살아 있다 — 주장 그대로 사실]
- baseline :2528 `fn_send_review_reminders()` (주석: '퇴근 5일 후 미작성 리뷰 리마인더'), 20260710000003_baseline_platform_glue.sql:189 에서 cron 등록.
- baseline :5298,:5322 — `notify_on_work_log_checkinout_update` 가 퇴근 시 스태프·구인자 양쪽에 `review_request` 알림 INSERT.

[결정적 방증: 읽기 경로가 애초에 만들어진 적 없다]
- src/lib/queryClient.ts:531 `queryKeys.reviews.bubbleScore(userId)` 가 정의돼 있는데, 소비처를 전수 grep 하면 src/lib/invalidationStrategy.ts:119,411,555-557 **무효화 쪽 4곳뿐**이다. 이 키로 등록되는 useQuery 가 0개 — 아무도 쓰지 않는 캐시를 무효화하고 있다.
- src/components/employer/applicants/__tests__/ 8개 파일 어디에도 bubbleScore/BubbleScoreBadge 단언이 없다(grep 0건). 배지가 안 그려져도 red 가 안 난다.

### 근본 원인
설계 누락(리뷰 도메인의 '읽기 권한 모델'이 처음부터 없었음) + 그 위에 얹힌 미완성 UI.

근거 1 — 쓰기·알림·집계는 완성됐는데 읽기만 없다: create_review(집계 원자 갱신) · fn_send_review_reminders(크론) · review_request 트리거 · BubbleScoreBadge 컴포넌트 · CardHeader/ProfileHeader 배선까지 전부 있다. 없는 건 **'남의 평판을 읽는 권한 있는 경로'** 하나뿐이다.
근거 2 — 잔해가 아니라 미완성이다: queryKeys.reviews.bubbleScore 가 invalidationStrategy 에만 등록돼 있다(src/lib/invalidationStrategy.ts:555-557). 리팩터링으로 지워진 흔적이라면 무효화 쪽도 같이 지워졌을 것이다. '쓸 예정이었던 키'가 무효화만 먼저 배선된 형태다.
근거 3 — 의도적 보안 트레이드오프가 아니다: 만약 '평판은 비공개' 결정이었다면 CardHeader.tsx:92-99 의 배지·`리뷰 N건` 문구가 코드에 남아 있을 이유가 없다. 반대로 users_select 를 넓히지 않은 것은 개인정보 보호로 **합리적**이다 — 즉 두 결정이 각자는 맞고 서로 만난 적이 없다.

덧붙여 이 결함은 fail-silent 구조라 발견이 늦었다: UserRepository.ts:83-85 가 `data=null` 을 정상 경로로 처리하고, 모든 표시 필드에 fallback(applicant.applicantName/applicantPhone 등)이 깔려 있어 '이름·전화는 나오는데 평판만 없다'로 보인다. 실제로는 users 행 전체가 0행이다.

### 인과사슬
구인자가 지원자 관리 화면 진입
→ app/(employer)/my-postings/[id]/applicants.tsx:247 `<ApplicantList applicants={...}>`
→ src/components/employer/applicants/ApplicantList.tsx:95 `useApplicantProfiles({ applicantIds })`
→ src/hooks/useApplicantProfiles.ts:49 `userRepository.getByIdBatch(normalizedApplicantIds)`
→ src/repositories/supabase/UserRepository.ts:111-114 `.from('users').select(USER_COLUMNS).in('id', uniqueIds)`
→ PostgreSQL: `users_select` (baseline :14043) 가 `auth.uid() = id OR admin` 로 필터 → **employer 에게는 0행, error 없음**
→ UserRepository.ts:120 부근에서 빈 Map 반환 → useApplicantProfiles.ts:55-61 의 `queryClient.setQueryData(queryKeys.user.profile(id), profile)` 루프가 한 번도 안 돈다
→ 개별 카드의 src/hooks/useUserProfile.ts:39-44 가 캐시 미스 → getUserProfile → 같은 RLS → null
→ ApplicantCard.tsx:134 `userProfile?.bubbleScore?.score` = undefined
→ CardHeader.tsx:92 `typeof bubbleScore === 'number'` = false → **배지 렌더 스킵**
→ 증상 A: 지원자 카드에 평점·리뷰 건수가 영구히 안 보인다.

같은 null 이 옆으로도 번진다(주장에 없던 부분):
→ ApplicantProfileModal.tsx:55 `<ApplicantProfileContent userProfile={userProfile}>` → ApplicantProfileContent.tsx:21 `<ProfileInfoSection userProfile={userProfile} />` → src/components/employer/applicants/ProfileInfoSections.tsx:76-79 `if (!userProfile) return null`
→ 증상 B: **'프로필 정보' 블록 전체(성별·생년월일·활동 지역·경력 연차·경력 상세·자기소개)가 통째로 사라진다.** 지원자 프로필 모달이 사실상 '지원 메시지 + 사전질문 답변 + 전화/이메일(applications 비정규화 fallback)'만 남는다.
→ 증상 C: 확정 스태프 쪽도 동일 — src/components/employer/applicants/StaffProfileModal.tsx:34(useUserProfile), :152-153(ProfileInfoSection/ContactInfoSection).

대칭 방향도 죽어 있다:
→ src/components/jobs/JobDetail.tsx:80 `useUserProfile({ ... })` 로 공고 소유자 프로필 조회 → 구직자에게도 users_select 는 자기 자신만 허용 → :290 `detail.ownerName || ownerProfile?.bubbleScore` 조건에서 뒤 항은 항상 false, :297-299 `BubbleScoreBadge` 도달 불가
→ 증상 D: **구직자도 구인처 평점을 볼 수 없다.** 즉 '상호 평가'의 표시 계층이 양방향 모두 도달 불가 코드다.

인과사슬의 종점: 증상을 지우려고 배지 자리에 '평점 없음'을 그리면 결함이 남는다. 결함은 '권한 있는 집계 읽기 경로의 부재'이며, 그것을 만들지 않는 한 어떤 UI 변경도 화면을 채울 수 없다.

### 파급 범위
실제로 grep 해서 확인한 범위.

[BubbleScoreBadge 소비처 전수 — grep "BubbleScoreBadge" src/ app/]
- 도달 불가(RLS 로 데이터 없음) 2곳: src/components/employer/applicants/ApplicantCard/components/CardHeader.tsx:93 · src/components/employer/applicants/ApplicantProfileHeader.tsx:74 · src/components/jobs/JobDetail.tsx:298(구직자→구인처, 대칭 결함).
- 정상 동작 3곳: app/(app)/(tabs)/profile.tsx:169(본인, auth.uid()=id 통과) · app/(app)/reviews/history.tsx:237(본인) · app/(admin)/users/index.tsx:137(admin, get_my_role()='admin' 통과, AdminRepository 경유).
→ 즉 배지 컴포넌트 자체는 멀쩡하고, **'남'을 볼 때만** 죽는다. 이게 결함이 오래 안 보인 이유다.

[useUserProfile 로 남의 프로필을 읽는 화면 = 전부 동일 증상]
- src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:75 — 카드 헤더 배지 + ContactInfo phone(fallback 있어 전화만 살아남음, ApplicantCard.tsx:190).
- src/components/employer/applicants/ApplicantProfileModal.tsx:52 + ApplicantProfileContent.tsx:21 → ProfileInfoSections.tsx:76-79 조기 null.
- src/components/employer/applicants/StaffProfileModal.tsx:34,152-153 — 확정 스태프 프로필.
- src/components/jobs/JobDetail.tsx:80 — 구직자가 보는 공고 상세의 구인처 정보.

[역할별 영향]
- employer: 지원자 판단 근거(평점·리뷰수·경력·자기소개·지역) 0. 노쇼 이력은 자기 공고 안에서만.
- staff: 구인처 평점 0(JobDetail). 본인 평판은 정상(profile/reviews history).
- admin: 영향 없음(app/(admin)/users/index.tsx 정상).

[캐시·무효화]
- src/lib/invalidationStrategy.ts:411,555-557 이 `queryKeys.reviews.bubbleScore(revieweeId)` 를 무효화하는데 이 키로 등록된 쿼리가 0개 → 무해하지만 죽은 배선. 수정 시 신설 훅을 이 키에 태우면 무효화가 자동으로 살아난다(설계 이득).

[테스트 커버리지 구멍]
- src/components/employer/applicants/__tests__/ 8개 파일 어디에도 bubbleScore 단언 없음. ProfileModal.integration.test.tsx 는 존재하나 프로필 소스를 목킹하므로 RLS 공백을 못 잡는다 → **유닛 테스트만으로는 이 수정의 red-green 이 성립하지 않는다.**

[DB 파급]
- 새 SECDEF 함수 1개 추가 시 파리티 함수 수(현재 184/111 기준선)가 +1 된다. 주간 파리티 감시가 diff 를 잡으므로 마이그 적용과 기준선 갱신을 같이 해야 한다.

### 기각한 경쟁 가설
가설 A — '진짜로 렌더가 없다(주장 그대로)': **기각.** grep "bubbleScore" src/components/employer 가 ApplicantCard.tsx:134-135, CardHeader.tsx:40-42/58-59/92-99, ApplicantProfileHeader.tsx:20/42/73-75, ApplicantProfileModal.tsx:52 를 반환한다. 배지·`리뷰 N건` 문구까지 완성돼 있다. 원 주장의 '렌더 0건'은 사실이 아니다.

가설 B — '다른 경로로 이미 제공 중(RPC·뷰·비정규화 컬럼)': **기각.** ① `grep -rn "applicant_profiles|get_applicant|public_profile|profiles_for|staff_profile" supabase/migrations/*.sql` → 0건. ② applications 테이블 컬럼 전수(baseline `CREATE TABLE public.applications`)에 평판 관련 컬럼 없음 — applicant_name/phone/email/nickname/photo_url 까지만 비정규화. ③ work_logs 도 staff_name/nickname/photo_url 만 비정규화. ④ 유일한 SECDEF 사용자 조회 RPC 인 search_users_by_nickname(20260718120000_nickname_search_rpcs.sql:18)의 반환은 `(id, name, nickname, photo_url, photo_url_blurhash, region)` — **bubble_score 없음**. 대체 경로가 없다.

가설 C — '의도적 프라이버시 제약(플래그·정책)': **부분 기각.** users_select 를 자기·admin 으로 좁힌 것은 의도적이고 타당하다. 그러나 '평판은 노출 안 한다'가 결정이었다면 배지 렌더·`리뷰 N건` 카피·queryKeys.reviews.bubbleScore 무효화 배선이 남을 이유가 없다. 또한 플래그로 가린 흔적도 없다(feature flag grep 무관). 결론: 보안 결정은 의도적, 평판 미노출은 의도가 아니라 미완성.

가설 D — '리팩터링 잔해(예전엔 보였는데 RLS 강화로 끊김)': **기각.** users RLS 를 좁힌 마이그가 따로 없다. 정책은 20260710000002 baseline(prod 덤프)부터 지금까지 동일하고, archive/20260414015346_optimize_rls_auth_uid_wrapping.sql 이 손댄 건 reviews 뿐이며 users_select 를 넓혔다 좁힌 이력이 없다. 애초에 넓었던 적이 없다.

가설 E — 'RLS 는 통과하는데 파싱에서 죽는다(parseUserDocument 실패)': **기각.** UserRepository.ts:87-93 은 파싱 실패 시 `logger.warn('사용자 문서 파싱 실패')` 를 남기고 null 을 반환한다. 파싱 실패라면 로그가 남고, 무엇보다 :83-85 의 `if (!data) return null` 이 **파싱 이전에** 먼저 걸린다. 0행이 파싱 단계에 도달할 수 없다.

가설 F — 'employer 의 JWT app_metadata.role 이 admin 이라 통과한다': **기각.** get_my_role() 은 `auth.jwt()->'app_metadata'->>'role'` 을 그대로 반환하고, baseline 트리거 on_public_user_created_sync_role/on_public_user_role_changed 가 public.users.role 을 그대로 app_metadata 로 동기화한다. employer 는 'employer'.

### 수정 설계
3층으로 나눈다. DB(권한 있는 집계 노출) → Repository/Hook → 표시.

[1) 새 마이그레이션] uniqn-mobile/supabase/migrations/<YYYYMMDDHHMMSS>_applicant_reputation_summary_rpc.sql
`CREATE OR REPLACE FUNCTION public.get_applicant_reputation_summary(p_user_ids uuid[])`
  `RETURNS TABLE(user_id uuid, score numeric, total_review_count integer, positive_count integer, negative_count integer, no_show_count integer, completed_work_count integer)`
  `LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '', pg_temp`
하드닝 템플릿은 **20260718120000_nickname_search_rpcs.sql:17-72 를 그대로 베낀다**(같은 파일의 search_users_by_nickname 이 이 레포의 SECDEF 규약 레퍼런스):
  - `REVOKE ALL ON FUNCTION ... FROM PUBLIC; REVOKE ALL ... FROM anon; GRANT EXECUTE ... TO authenticated;`
  - 본문 첫 줄 `v_caller := (SELECT auth.uid()); IF v_caller IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다'; END IF;` (NULL fail-open 차단)
  - 호출자 역할 게이트: `EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller AND u.role IN ('employer','admin') AND u.is_active)` 아니면 예외.
  - **관계 게이트(열거 방지 — 닉네임 검색에는 없던 추가 방어)**: p_user_ids 를 그대로 믿지 말고, 호출자가 관리하는 공고와 실제로 엮인 사용자만 남긴다.
    `WITH my_postings AS (SELECT jp.id FROM public.job_postings jp WHERE jp.owner_id = v_caller OR public.is_workspace_member(jp.workspace_id, v_caller) OR public.is_posting_collaborator(jp.id, v_caller) OR public.is_admin()), allowed AS (SELECT DISTINCT a.applicant_id AS uid FROM public.applications a JOIN my_postings m ON m.id = a.job_posting_id UNION SELECT DISTINCT wl.staff_id FROM public.work_logs wl JOIN my_postings m ON m.id = wl.job_posting_id)` → 최종 SELECT 는 `WHERE u.id = ANY(p_user_ids) AND u.id IN (SELECT uid FROM allowed)`.
    (is_workspace_member / is_posting_collaborator / is_admin 는 add_direct_staff(baseline :676-684)가 이미 쓰는 기존 헬퍼다 — 신설 금지.)
  - 집계 소스: `u.bubble_score` jsonb 에서 `(u.bubble_score->>'score')::numeric`, `->>'totalReviewCount'`, `->>'positiveCount'`, `->>'negativeCount'`. **reviews 원문은 반환하지 않는다**(블라인드 규칙 보호 — 아래 참조).
  - no_show_count: `(SELECT count(*) FROM public.work_logs w WHERE w.staff_id = u.id AND w.status = 'no_show')` — 교차 공고 전체. completed_work_count: `w.status IN ('checked_out','completed')` (src/types/review.ts:247 REVIEWABLE_STATUSES 와 같은 축).
  - **최소 표본 억제**: `CASE WHEN total_review_count < v_min_sample THEN NULL ELSE score END`. v_min_sample 은 상수 3 으로 시작(openQuestion 참조).
  - `COMMENT ON FUNCTION ... IS '지원자 평판 요약(집계만, 리뷰 원문·작성자 없음). 호출자=공고 관리 권한자로 제한, 대상=그 공고에 지원/배치된 사용자로 제한.'`

[2) Repository] uniqn-mobile/src/repositories/interfaces/IReviewRepository.ts 에 `getReputationSummaries(userIds: string[]): Promise<Map<string, ReputationSummary>>` 추가, 구현은 uniqn-mobile/src/repositories/supabase/ReviewRepository.ts 의 `SupabaseReviewRepository` 에 메서드 추가 — 기존 `runRpc` 헬퍼(@/utils/supabase) 사용, `toCamelCase` 로 행 변환. 타입 `ReputationSummary` 는 uniqn-mobile/src/types/review.ts 에 `BubbleScore` 옆에 신설(score: number | null, totalReviewCount, positiveCount, negativeCount, noShowCount, completedWorkCount).

[3) Hook] uniqn-mobile/src/hooks/useApplicantReputation.ts 신설 — src/hooks/useApplicantProfiles.ts:32-63 의 배치 프리페치 패턴을 그대로 복제(정규화·정렬·useQuery·개별 캐시 분배). queryKey 는 **이미 있는** `queryKeys.reviews.bubbleScore(userId)`(src/lib/queryClient.ts:531)를 개별 캐시 키로 쓰고, 배치 키로 `queryKeys.reviews.reputationBatch(userIds)` 를 src/lib/queryClient.ts:526-535 에 추가한다. 이러면 src/lib/invalidationStrategy.ts:555-557 의 죽은 무효화가 자동으로 살아난다.

[4) 표시 배선]
- src/components/employer/applicants/ApplicantList.tsx:95 `useApplicantProfiles` 호출 바로 아래에 `useApplicantReputation({ applicantIds })` 추가.
- src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:134-135 의 `userProfile?.bubbleScore?.*` 를 새 훅 결과로 교체(도달 불가 코드 제거).
- CardHeader.tsx:39-42 props 에 `noShowCount?: number` 추가, :92-99 옆에 노쇼 배지(0 이면 미노출, `dark:` 필수).
- ApplicantProfileModal.tsx:52 / ApplicantProfileHeader.tsx:20,73-75 도 동일 소스로 교체.
- src/components/jobs/JobDetail.tsx:80,297-299(구인처 평점, 대칭 결함)는 **별도 RPC**가 필요하다 — 게이트가 반대(지원자가 공고 소유자를 본다). 같은 PR 에 넣지 말고 `get_posting_owner_reputation(p_job_posting_id uuid)` 로 분리(dependencies 참조).

[5) 테스트]
- pgTAP: uniqn-mobile/supabase/tests/applicant_reputation_summary.test.sql 신설. 기존 supabase/tests/jpc_work_logs_rls.test.sql 의 JWT 주입 헬퍼 패턴을 따를 것(직접 GUC set 금지 — wiki sources/jpc-rls-stale-guc). 케이스: ①구인자가 자기 공고 지원자 조회 성공 ②남의 공고 지원자 uid 를 섞어 넣으면 그 행만 누락 ③staff 역할 호출 시 PERMISSION_DENIED ④anon EXECUTE 거부 ⑤표본 미달 시 score NULL.
- 컴포넌트: src/components/employer/applicants/__tests__/ApplicantCard.reputation.test.tsx 신설 — **순수 헬퍼가 아니라 CardHeader 렌더까지** 단언해야 한다(현재 8개 테스트가 배지를 전혀 안 보므로 red-green 이 성립하지 않는다).

### DB 변경
신규 마이그레이션 1개. 신설 대상: SECURITY DEFINER 함수 `public.get_applicant_reputation_summary(uuid[])`.
- 읽는 테이블: public.users(bubble_score, is_active, status, role) · public.work_logs(staff_id, status, job_posting_id) · public.applications(applicant_id, job_posting_id) · public.job_postings(owner_id, workspace_id).
- RLS 는 손대지 않는다. users_select(baseline :14043) · rev_select(:13970) · wl_select(:14057) 전부 현행 유지 — RLS 를 넓히는 대신 SECDEF 로 '집계만' 뚫는다.
- 하드닝 필수 4종(wiki decisions/secdef-hardening): `SET search_path = '', pg_temp` / `REVOKE ALL FROM PUBLIC, anon` / `GRANT EXECUTE TO authenticated` / `auth.uid() IS NULL` 예외.
- 트리거 신설 없음 → scripts/graph-db-deps.mjs triggers 중복 검사 대상 아님. 다만 supabase-patterns §10 관례상 PR 전 1회 실행 권장.
- 적용은 mcp__supabase__apply_migration 경유(db push 금지). 기존 마이그 파일 수정 금지.
- 파리티: 함수 수가 +1 되므로 prod 적용 후 파리티 기준선 갱신 필요.

### 리스크
1) 개인정보 노출 확대가 가장 큰 위험이다. 지금은 users 행이 통째로 안 보이는 상태라 '실수로 더 열 여지'가 0인데, SECDEF 로 창을 내는 순간 반환 필드 하나하나가 결정 사항이 된다. 완화: 함수 반환 컬럼을 집계 6개로 못 박고 리뷰 원문(comment)·태그·작성자 id 는 절대 넣지 않는다. reviews 테이블을 조인하지 않는 것으로 구조적으로 보장한다(bubble_score jsonb 만 읽으면 조인 자체가 불필요).

2) 블라인드 상호공개 규칙과의 충돌 — 다만 **새로 생기는 위반이 아니다.** baseline :1571-1584 의 create_review 가 리뷰 INSERT 즉시 피평가자 bubble_score 를 갱신하고, 피평가자 본인은 app/(app)/reviews/history.tsx:237(총 N건 + 긍정/보통/부정 개수)과 app/(app)/(tabs)/profile.tsx:169 에서 그 값을 실시간으로 본다. 즉 **상대 리뷰를 안 썼어도 자기 점수 변화로 상대 감정을 추론할 수 있는 누수는 이미 존재**한다(src/repositories/supabase/ReviewRepository.ts:118-127 의 canViewOpponent 게이트는 리뷰 '원문'만 막는다). 구인자에게 집계를 열어도 이 누수의 **관측자만 늘 뿐 종류는 같다.** 진짜 새 위험은 표본이 작을 때다: 어떤 스태프의 totalReviewCount 가 1이고 그 리뷰를 내가 썼다면, 내가 보는 점수는 내 리뷰다(무해). 반대로 내가 안 썼는데 count 가 1이면 '다른 구인자가 부정 평가했다'가 특정된다. 완화 = 최소 표본 억제(N<3 이면 score NULL, '평가 데이터 부족' 표시). 이건 코드가 아니라 제품 결정이라 openQuestion 으로 올린다.

3) 사용자 열거(enumeration). p_user_ids 를 검증 없이 받으면 구인자가 임의 uuid 로 남의 평판을 긁는다. 완화 = 위 관계 게이트(applications ∪ work_logs ∩ 내 공고). 20260719061931_nickname_search_rate_limit.sql:73 이 `check_user_rate_limit(uid, 'search_users_by_nickname', 20, 60)` 로 이미 레이트리밋 헬퍼를 갖고 있으므로, 필요하면 동일 헬퍼를 재사용한다(신규 구현 금지).

4) 노쇼 카운트의 공정성 위험. no_show 는 구인자가 일방적으로 찍을 수 있고(src/hooks/useConfirmedStaff.ts:190-222 markAsNoShow), 취소 경로(cancelNoShow, ConfirmedStaffRepository.ts:508-530)도 구인자 손에 있다. 이의제기 절차 없이 교차 공고로 합산해 노출하면 한 구인자의 오기입이 그 스태프의 전 취업을 막는다. 완화 = 원시 카운트 대신 최근 N개월 창 + '취소된 노쇼 제외' + 구간 표기(0 / 1 / 2+). 역시 제품 결정.

5) 성능. no_show_count 는 work_logs 전역 스캔이다. work_logs 에 (staff_id, status) 복합 인덱스가 있는지 확인이 필요하다 — baseline 인덱스 목록에 staff_id 단독은 있으나 status 결합은 미확인. 지원자 20명 배치면 20회 count 이므로, 없으면 부분 인덱스 `CREATE INDEX ... ON work_logs (staff_id) WHERE status = 'no_show'` 를 같은 마이그에 넣는다.

6) 깨질 수 있는 기존 동작은 사실상 없다. 교체 대상 코드(ApplicantCard.tsx:134-135 등)는 현재 **항상 undefined 인 도달 불가 분기**라, 여기서 값이 들어오기 시작해도 회귀할 기존 화면이 없다. 유일한 레이아웃 영향은 카드 헤더 한 줄이 길어지는 것(CardHeader.tsx:85-100 의 flex-row gap-2) — 긴 닉네임 + 배지 + '리뷰 N건' + 상태 Badge 가 좁은 폰(375pt)에서 겹칠 수 있다. 실기기/좁은 폭 확인 필요.

### 선행 의존성
1) **제품 오너 결정 3건이 코드보다 먼저다**(openQuestion). 최소 표본 임계값·노쇼 노출 형식·이의제기 절차가 정해지기 전에 마이그레이션을 쓰면 반환 스키마를 다시 고치게 된다.
2) JobDetail.tsx:297-299 의 대칭 결함(구직자→구인처 평점)은 게이트 방향이 반대라 별도 RPC(`get_posting_owner_reputation`)가 필요하다. 같은 PR 에 묶지 말 것 — 권한 모델이 다르고(대상=공고 소유자, 호출자=아무 인증 사용자), 리뷰 대상도 employer 라 노쇼 축이 무의미하다. 단, **타입(ReputationSummary)과 훅 패턴은 이 작업에서 먼저 확정**되어야 뒤따르는 PR 이 재발명하지 않는다.
3) prod 마이그 적용 후 파리티 기준선 갱신(함수 수 +1). 주간 파리티 감시가 red 를 낸다.
4) work_logs 인덱스 확인이 함수 작성보다 먼저다(위험 5).
5) 관계 게이트가 쓰는 is_workspace_member / is_posting_collaborator / is_admin 헬퍼가 현행 prod 에 존재함을 list_migrations/pg_proc 로 실측 확인(add_direct_staff 가 쓰고 있으므로 존재 가능성은 높지만 시그니처 확인 필요).

### 🔍 검증 — 놓친 제약
① JobDetail.tsx:69 에 `canReadOwnerProfile = useAuthStore(s => s.isAdmin || s.isEmployer)` 클라 게이트가 이미 존재한다 — 분석이 완전히 놓친 변수. 구직자(staff)에게는 RLS 가 0행을 주는 게 아니라 useUserProfile 의 enabled=false 로 쿼리 자체가 발화하지 않는다(:80-83). 즉 누군가 이미 읽기 권한 모델을 인지하고 방어했던 흔적이라, '두 결정이 만난 적 없다'는 서사가 부분적으로 약화된다. ② 후속 get_posting_owner_reputation RPC 작업 시 이 게이트를 재배선해야 한다 — 현재 admin 열람·employer 자기공고 열람(auth.uid()=id 통과)은 배지가 실제로 그려지는 살아있는 경로라 덮어쓰면 회귀다. ③ '죽은 무효화가 자동으로 살아난다'는 과장 — invalidationStrategy:555-557 은 리뷰를 작성한 사용자의 클라이언트에서만 발화하므로, 다른 기기의 구인자 화면 신선도는 여전히 staleTime 의존(이득은 실재하나 실시간 아님). ④ e2e 파급 없음 실측 — review-system.spec 은 구직자 작성 흐름만 단언, 구인자 배지 단언 0건. ⑤ 화면 플래그 없음, 타입 파급 없음(전부 additive optional). ⑥ RLS 확인 완료 — users_select(baseline :14043)가 활성 마이그의 유일한 SELECT 정책이고 후속 마이그 재정의 없음(archive 제외 grep 0건), SECDEF 로 뚫는 설계가 유일한 경로 맞음. 다중 쓰기 아님(읽기 전용 RPC)이라 RPC 규약 위반 없음.

### 🔧 검증 — 설계 보정
1) 수정설계의 관계 게이트 헬퍼는 전부 실재 확인 — is_admin()(baseline :3508)·is_posting_collaborator(p_posting_id,p_user_id)(:3578)·is_workspace_member(_workspace_id,_user_id)(:3635). 단 is_workspace_member 는 언더스코어 파라미터명이니 위치 인자로 호출할 것. 2) 위험 5(인덱스)는 하향 보정 — idx_wl_staff_date(staff_id, date DESC) 복합 인덱스가 이미 있어(baseline :11869) staff_id prefix 스캔으로 no_show count 를 감당한다. 부분 인덱스는 필수 아닌 선택. 3) completed_work_count 축 검증 완료 — REVIEWABLE_STATUSES(review.ts:247)={'checked_out','completed'} 이고 work_log_status enum 에 두 값 실재(baseline :3900 CHECK 제약에서 확인). 4) 라인 드리프트 2건 — ApplicantProfileModal 의 useUserProfile 은 :24, ApplicantProfileContent 는 :55(분석의 :52 아님) · UserRepository 의 null 반환은 :82-84(분석의 :83-85). 실질 무해. 5) 파급 절의 '도달 불가 2곳'에 JobDetail.tsx:298 을 넣은 것은 오류 — 그 지점은 admin 과 employer 자기공고 열람에서 도달 가능하며, 분석 자신이 기각한 '렌더 0건' 주장과 같은 유형의 과장이다. 증상 D 의 최종 상태(구직자가 구인처 평점 못 봄)는 맞지만 원인은 RLS 가 아니라 클라 게이트.

### 검증 메모
핵심 인과사슬은 전량 실측 일치: 렌더 존재(ApplicantCard:134-135·CardHeader:92-99·ApplicantProfileHeader:73-75), USER_COLUMNS 에 bubble_score 포함(:37) + users 직접 select(:72-76), users_select self/admin 한정, bubble_score jsonb 캐시 + create_review 원자 갱신, rev_select/wl_select 차단, queryKeys.reviews.bubbleScore 소비처=무효화 4곳뿐(useQuery 0개 grep 재확인), search_users_by_nickname 반환에 bubble_score 없음, applicants __tests__ 에 bubbleScore 단언 0건, ProfileInfoSection :77-79 조기 null. 하드닝 템플릿(20260718120000)·runRpc·IReviewRepository·pgTAP 컨벤션(supabase/tests/) 전부 실재해 3층 설계는 레포 규약 정합. PARTIAL 사유는 증상 D 메커니즘 오류 단 하나 — 나머지는 CONFIRMED 수준. 난이도 L 유지(마이그+pgTAP+제품 결정 3건+파리티 갱신+UI 3면).

### 🙋 사람이 결정할 것
제품 오너가 정해야 할 것 — 코드 작업 착수 전 3건 모두 필요.

Q1. **어디까지 노출하나.** 후보: (a) 버블 점수만 (b) 점수 + 총 리뷰 건수 (c) + 긍정/부정 건수 (d) + 교차 공고 노쇼 횟수 (e) + 완료 근무 횟수. 현재 코드가 이미 그리려던 것은 (b)다(CardHeader.tsx:95-99 `리뷰 N건`). 노쇼(d)는 채용 거절 사유로 직결되므로 별도 결단.

Q2. **최소 표본 임계값 N.** 리뷰 1건짜리 스태프의 점수를 보여주면 (i) 통계적으로 무의미하고 (ii) 그 1건을 쓴 구인자가 사실상 특정된다(블라인드 규칙 우회). N=3 을 제안하지만 초기 사용자가 적은 서비스에서는 '거의 모두 점수 없음'이 되어 기능이 죽는다. N 값과, N 미달일 때 무엇을 그릴지(빈칸 / '신규' 배지 / '평가 3건부터 표시')를 정해야 한다.

Q3. **노쇼 이력의 공정성 장치.** 노쇼는 구인자 단독 판정이고 이의제기 절차가 코드에 없다. (i) 노출 기간 창(최근 3개월? 6개월? 전체?) (ii) 원시 횟수 vs 구간(0/1/2+) (iii) 스태프가 자기 노쇼 이력을 보고 이의를 제기할 경로를 먼저 만들 것인가. 개인정보보호법상 '평가·신용 정보'에 준하는 취급이 필요한지 법무 확인도 함께.

Q4(부수). 대칭 노출을 할 것인가 — 구직자에게 구인처 평점을 보여주는 JobDetail.tsx:297-299 를 살릴지. 살린다면 '상호 평가'라는 서비스 서사가 완성되지만, 구인처 평점이 낮게 노출되면 공고 지원율에 직접 영향을 준다.


## `role-level-fill-invisible` — 역할별 인원 미달이 안 보임 — 데이터·RPC·순수함수는 다 있고, 지원자 화면만 합계 스트립으로 남아 있다

**주장 판정**: 부분사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→M · **마이그레이션**: 불필요

### 근거 (실측)
주장은 '지원자 화면'에 한정하면 정확하고, 앱 전체로 확대하면 틀리다.

[주장대로: 지원자 화면은 합계뿐]
- uniqn-mobile/app/(employer)/my-postings/[id]/applicants.tsx:230-245 — 정원 현황 스트립이 `확정 {managementView.filledPositions} / 정원 {managementView.totalPositions}명` 단 한 줄. 역할 축·날짜 축 모두 없다.
- 같은 파일 :39-50 — 이 스트립의 소스는 `buildPostingFacts(job)` → `projectPostingSurface(..., {surface:'manage'})` 뿐이고, **추가 fetch 를 하지 않는다**(:39 주석이 "추가 fetch 없음"이라고 명시). 즉 이 화면은 work_logs 기반 실카운트를 아예 안 가져온다.

[주장과 다름 ①: 역할별 실카운트 데이터는 이미 있다]
- DB: uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql:3022 `get_posting_filled_counts(p_job_posting_ids uuid[])` → `RETURNS TABLE(job_posting_id, work_date, time_slot, role_key, confirmed_count)`, SECURITY DEFINER, `SET search_path TO 'public','pg_temp'`, authenticated/anon 에 GRANT(:14669-14675).
- 본체는 같은 파일 :3022 가 래핑하는 `count_posting_confirmed_by_slot`(정의 위치 baseline, 주석 :1416 부근 "공고별 (date,time_slot,role) 활성 확정 수 집계(카운트만 반환, PII 없음)"). 본문: `FROM work_logs wl WHERE job_posting_id = ANY(...) AND wl.status NOT IN ('cancelled','no_show') GROUP BY job_posting_id, date, _posting_slot_key(time_slot), _posting_role_key(role, custom_role)`.
→ **날짜 × 시간슬롯 × 역할 3축이 이미 서버에서 나온다.** 새 RPC 가 필요 없다.
- 클라 수신: uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:618-658 `getPostingFilledCounts` — 행을 `${jobPostingId}__${date}__${slotKey}__${roleKey}` 맵으로 접는다(:650, 키 조립은 src/repositories/supabase/JobPostingRepositoryHelpers.ts:201 `buildSlotRoleKey`).
- 훅: uniqn-mobile/src/hooks/usePostingFilledCounts.ts:9-18(배치 조회, staleTime 30초) + :21-34 `extractPostingFilledSubmap`(공고별 서브맵 `date__slot__role`).

[주장과 다름 ②: 역할별 표시가 이미 다른 화면에 있다]
- uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx:166-169 이 `usePostingFilledCounts([postingId])` + `extractPostingFilledSubmap` 을 호출하고, :399 에서 `<PostingScheduleContent showFilledCount filledCounts={filledCounts} />` 로 넘긴다.
- uniqn-mobile/src/components/jobs/shared/PostingScheduleContent.tsx:243-276 `RoleBadge`/`formatRoleLine` 이 `${role.label} ${role.count}명 (${role.filled}/${role.count})` 을 그리고, `role.isFilled` 면 취소선 + 회색 배경. 날짜 섹션마다(:100-167), 슬롯마다(:125-163), 역할마다(:155-158) 전개된다.
→ **공고 관리 허브(index.tsx)의 '근무 일정' 섹션에는 이미 `딜러 5명 (3/5)` 형태로 날짜×슬롯×역할 충원이 보인다.** 원 주장의 '알 수 없다'는 지원자 화면 한정.
- 같은 표시가 구직자 쪽에도 있다: src/components/jobs/JobDetail.tsx:86,187 · 지원 폼 src/components/jobs/AssignmentSelector/AssignmentSelector.tsx:59-77 + RoleCheckbox.tsx:26,52 (`{filledCount}/{requiredCount}`).

[주장과 다름 ③: 역할별 잔여를 계산하는 순수함수도 이미 있다]
- uniqn-mobile/src/domains/job-posting/selectors.ts:59-81 `aggregateRoleFilledFromSubmap(submap)` — `date__slot__role` 서브맵을 역할키별 합으로 접는다(날짜·슬롯 축 소거).
- 같은 파일 :96-133 `selectPostingRoleAvailability(posting, { filledByRole })` — 주입 시 `remaining = max(0, count - filled)`, `isAvailable`, `filledCount`, `remainingCount` 를 낸다. bare other 의 DB 키('other:') 정규화까지 :105-107 에 처리돼 있다.
- 실사용: uniqn-mobile/app/(employer)/my-postings/[id]/settlements.tsx:102-109 → src/features/employer/settlements/SettlementModals.tsx:40 → src/components/employer/applicants/RoleChangeModal.tsx:159-186(마감 역할 비활성).

[함정: managementView 에 딸려 오는 roleAvailability 는 죽은 카운터다]
- src/domains/job-posting/projections.ts:91 이 `roleAvailability: facts.roleAvailability` 를 detail/management 뷰모델에 그대로 실어 보낸다. 즉 applicants.tsx 의 `managementView.roleAvailability` 는 **이미 손에 있다.**
- 그러나 src/domains/job-posting/facts.ts:60-84 는 `getPostingRoleStats(posting)` 의 `role.filled` 를 그대로 쓰는데, src/domains/job-posting/core.ts:74-76(`toRoleRequirement` → `filled: 0`)과 :138-140(누적 시에도 `filled: 0`)이 **항상 0을 강제**한다(SP3 주석: '충원은 표시 시점 hydrate 가 덮어씀').
→ 그대로 그리면 모든 역할이 `0/N`, `remaining = count` 로 나온다. **이 값을 쓰면 조용히 거짓말한다.**

[정원 축의 정의]
- src/domains/job-posting/stats.ts:37-52 `calculateTotalPositionsFromSchedule` — 좌석 기준(모든 날짜 × 슬롯 × 역할의 count 총합), DB 트리거 `_total_positions_from_schedule` 과 동치라고 주석이 명시. 즉 `totalPositions = Σ(역할별 required)` 가 성립하므로, 역할별 합이 스트립의 정원과 어긋나지 않는다.

### 근본 원인
의도적 트레이드오프의 잔재 + 화면 하나의 배선 누락. '개념 부재'가 아니다.

근거 1 — SP3(schedule counter unification)가 schedule 파생 filled 를 **의도적으로 폐기**했다. core.ts:74-76 · :94-95 · :138-140 · :237 · :297 에 같은 주석('SP3: schedule role.filled(dead counter) 제거 — 충원은 표시 시점 hydrate 가 덮어씀')이 5곳 반복된다. stats.ts:13-15 도 같은 취지. 즉 '역할별 충원은 표시 시점에 hydrate 로 주입한다'가 확정된 설계다.
근거 2 — 그 hydrate 배선이 **소비처마다 손으로** 되어 있다. index.tsx:166-169 / settlements.tsx:102-109 / JobDetail.tsx:86 / AssignmentSelector.tsx:59-77 네 곳이 각각 usePostingFilledCounts 를 부른다. 공통 훅이나 컨텍스트가 없으므로, 새 화면은 **부르는 걸 잊으면 조용히 0/N 이 된다.** applicants.tsx 가 정확히 그 케이스다.
근거 3 — applicants.tsx:39 의 주석 "관리 허브(index.tsx)의 '배정 현황' 계산과 동일 소스(job) 재사용, 추가 fetch 없음"이 결정적이다. 작성자는 index.tsx 와 같은 소스를 쓴다고 믿었지만, index.tsx 는 job 외에 filledCounts 를 **한 번 더** 가져온다. 절반만 베낀 것이다.
근거 4 — 날짜×역할 교차 요약이 없는 건 미완성이 아니라 애초에 만든 적이 없다. `aggregateRoleFilledFromSubmap`(selectors.ts:59-81)은 날짜 축을 **버린다**. 날짜를 보존하는 소비처는 PostingScheduleContent 하나뿐인데, 그건 '요약'이 아니라 전체 전개다.

### 인과사슬
구인자가 7일 대회 공고의 지원자 관리 진입
→ app/(employer)/my-postings/[id]/applicants.tsx:40-50 이 `job` 하나로 `buildPostingFacts` → `projectPostingSurface(surface:'manage')` 실행
→ src/domains/job-posting/projections.ts:96-108 `projectManagement` → :86-87 `totalPositions: facts.stats.totalPositions, filledPositions: facts.stats.filledPositions`
→ src/domains/job-posting/facts.ts:87 `resolveFilledPositions(posting)` = **job_postings.filled_positions 컬럼(사람 단위 스칼라)**. baseline 의 confirm_application 주석이 'filled_positions += 1 (사람 단위)'라고 명시 → 역할·날짜 정보가 원리적으로 들어 있지 않다
→ applicants.tsx:234-243 이 그 스칼라 둘을 그린다 → 증상: `확정 12 / 정원 20명`
→ 구인자는 딜러가 찼는지 플로어가 비었는지 알 수 없다. 대회 D-3 에 플로어 5자리가 빈 채로 마감 임박해도 화면은 동일하게 `12/20`.

여기서 갈라지는 두 번째 사슬(더 위험):
→ managementView 에는 `roleAvailability`(projections.ts:91)가 이미 실려 있다
→ 다음 사람이 "어? 역할별 데이터 있네" 하고 `managementView.roleAvailability.items` 를 그대로 렌더
→ src/domains/job-posting/facts.ts:61-75 가 `getPostingRoleStats` 의 filled 를 쓰고, core.ts:139 이 그 값을 `filled: 0` 으로 고정
→ 화면에 `딜러 0/12`, `플로어 0/8` — **확정이 12명인데 전부 0으로 표시**. 에러 없음, 타입 통과, 테스트 없음
→ 증상: 정보 부재가 오정보로 악화된다.

세 번째 사슬(수정 시 반드시 처리해야 하는 것):
→ baseline :719 `IF v_capacity > 0 AND v_existing + v_rec.requested > v_capacity THEN RAISE ...` — add_direct_staff 의 정원 가드는 `v_capacity > 0` 일 때만 작동한다
→ 공고 스케줄에 없는 (날짜, 슬롯, 역할) 조합으로 직접 추가하면 v_capacity=0 → 가드 통과 → work_logs 생성
→ get_posting_filled_counts 는 그 행도 센다(baseline count_posting_confirmed_by_slot 은 work_logs 전수)
→ 서브맵에 requirements 에 대응이 없는 키가 섞인다
→ 순진하게 `required - filled` 만 하면 그 확정 인원이 **어느 역할에도 안 잡히고 사라진다** → 부족 수치가 과대 계상
→ 증상: '플로어 5명 부족'이라고 떴는데 실제로는 3명이 이미 배치돼 있다.

### 파급 범위
[읽는 쪽 — 이 개념을 이미 소비하는 화면 4곳, 전부 같은 서브맵]
- app/(employer)/my-postings/[id]/index.tsx:166-169,399 (구인자 관리 허브 근무 일정)
- app/(employer)/my-postings/[id]/settlements.tsx:102-109 → RoleChangeModal.tsx:159-186 (역할 변경 시 마감 역할 비활성)
- src/components/jobs/JobDetail.tsx:86,187 (구직자 공고 상세)
- src/components/jobs/AssignmentSelector/AssignmentSelector.tsx:59-77, RoleCheckbox.tsx:26,52 (구직자 지원 폼)
→ 신설 요약이 이들과 다른 수치를 내면 즉시 모순으로 보인다. 반드시 같은 서브맵·같은 키 규칙을 쓸 것.

[키 규칙 SSOT — 새로 만들면 안 되는 것]
- src/domains/schedule/postingHydrateKeys.ts — `slotHydrateKey(slot)`(TBA/시작시각→'미정' 폴백, range 문자열에서 시작시각 추출) · `roleHydrateKey(role)`(other 는 custom 유무 무관 `other:` 접두). 파일 헤더가 "서버 `_posting_slot_key`/`_posting_role_key` 정합 규칙의 단일 소스"라고 못 박고 있다.
- 서버 쪽 대응: baseline `_posting_slot_key`(NULL/공백/'미정' → '미정', 아니면 `[-~]` 앞부분 btrim) · `_posting_role_key`.
- 이 규칙을 새로 구현하면 bare other 미스매치가 재발한다 — uniqn-mobile/.claude/agent-memory/code-reviewer/pitfall_role_key_two_lineages_bare_other.md 에 2026-07-14 동일 사고 기록이 있다.

[근무표(work-schedule) 쪽 — 중복 개념 주의]
- supabase/migrations/20260727120000_work_schedule_soft_cancel_and_required_status_filter.sql:139-220 `get_venue_grid_summary` → `RETURNS TABLE(d text, headcount integer, job_count integer, required_count integer)`. :180 `SUM(GREATEST(COALESCE((r->>'count')::int, (r->>'headcount')::int, 0), 0))` = **날짜별 Σ 좌석수. 역할 축이 없다.**
- 클라: src/repositories/supabase/WorkScheduleRepository.ts:48 → src/domains/workSchedule/buildGridCells.ts:13-22(GridSummaryRow), :35-43 `effectiveTarget = max(수동 softTarget, requiredCount)`.
→ 근무표의 '필요인원'은 **지점×날짜** 축이고, 지금 만들 것은 **공고×날짜×역할** 축이다. 다른 개념이므로 합치면 안 되고, 같은 이름을 쓰면 안 된다.

[재사용할 어휘 — 이건 이미 있다]
- src/types/unified/role.ts:33-49 `RoleInfo { roleId, displayName, customName?, requiredCount, filledCount }`. AssignmentSelector/RoleCheckbox 가 이 셰이프로 `{filledCount}/{requiredCount}` 를 그린다. 새 필드명(`needed`, `shortage` 등)을 발명하지 말고 이 어휘를 확장할 것.

[정원 정의의 정합]
- src/domains/job-posting/stats.ts:37-52 `calculateTotalPositionsFromSchedule` = Σ(date × slot × role).count, DB `_total_positions_from_schedule` 트리거와 동치(주석 명시). → 역할별 required 의 합 = 스트립의 `정원 20명`. 두 숫자가 어긋나면 버그 신호로 쓸 수 있다.

[테스트]
- src/domains/job-posting/__tests__/roleAvailability.hydrate.test.ts 가 aggregateRoleFilledFromSubmap · selectPostingRoleAvailability hydrate 분기를 이미 커버(:68-103, :107-178). 신설 요약함수 테스트는 이 파일 옆에 두면 컨벤션이 맞는다.
- 정원 상수·문구를 바꾸면 e2e/ 는 quality 범위 밖이므로 별도 grep 필요(CLAUDE.md 경고).

### 기각한 경쟁 가설
가설 A — '역할별 데이터가 아예 없다(합계만 존재)': **기각.** baseline :3022 `get_posting_filled_counts` 가 `(job_posting_id, work_date, time_slot, role_key, confirmed_count)` 5열을 반환하고, 클라 src/hooks/usePostingFilledCounts.ts:21-34 가 `date__slot__role` 서브맵까지 만든다. 3축 데이터가 이미 흐르고 있다.

가설 B — '순수 계산 로직이 없다': **기각.** src/domains/job-posting/selectors.ts:59-81(aggregateRoleFilledFromSubmap) + :96-133(selectPostingRoleAvailability with filledByRole) 이 역할별 filled/remaining/isAvailable 을 이미 낸다. 테스트도 __tests__/roleAvailability.hydrate.test.ts 에 있다. 없는 건 **날짜 축을 보존한 요약**뿐이다.

가설 C — '앱 어디에도 역할별 표시가 없다(원 주장)': **기각.** app/(employer)/my-postings/[id]/index.tsx:399 → PostingScheduleContent.tsx:272-276 `formatRoleLine` 이 `딜러 5명 (3/5)` 를 그린다. 관리 허브에는 있다. 원 주장은 화면을 특정하지 않아 과장됐다.

가설 D — 'managementView.roleAvailability 를 그리기만 하면 끝난다(저비용 수정)': **기각 — 그리고 이게 가장 위험한 오답이다.** projections.ts:91 이 roleAvailability 를 실어 보내지만, facts.ts:61-75 → core.ts:74-76/:138-140 이 `filled: 0` 을 강제한다. 그리면 확정 12명인 공고가 전 역할 `0/N` 으로 표시된다. tsc·eslint·기존 테스트 모두 통과하므로 리뷰에서도 안 걸린다.

가설 E — '근무표의 required_count 를 재사용하면 된다': **기각.** 20260727120000_...sql:180 의 required_count 는 `SUM(...(r->>'count')...)` 를 **날짜 단위로만** 집계하고 role_key 로 GROUP BY 하지 않는다(RETURNS TABLE 에 role 컬럼 자체가 없다). 축이 다르고, 대상도 '지점 스팬 공고 전체'라 단일 공고 화면에 못 쓴다.

가설 F — '서버에 새 RPC(역할별 부족 반환)를 만들어야 한다': **기각.** get_posting_filled_counts 가 이미 필요한 원자 데이터를 전부 준다. 정원(required)은 공고 스케줄에 있고 클라가 이미 갖고 있다(job). 서버 왕복을 늘릴 이유가 없고, 새 SECDEF 는 파리티 부담만 늘린다.

가설 G — '지원자 화면에서 usePostingFilledCounts 를 안 부르는 건 성능 때문': **기각.** 같은 훅을 형제 화면 index.tsx:166 과 settlements.tsx:102 가 부르고, staleTime 30초 + 배치 키 캐시(usePostingFilledCounts.ts:11-13)라 탭 이동 시 대부분 캐시 히트다. applicants.tsx:39 주석은 성능이 아니라 "동일 소스 재사용"을 이유로 든다 — 절반만 베낀 결과다.

### 수정 설계
DB 변경 0. 순수함수 1개 + 컴포넌트 1개 + 배선 3줄.

[1) 순수함수 신설] uniqn-mobile/src/domains/job-posting/selectors.ts 에 `aggregateRoleFilledFromSubmap` 바로 아래(현재 :81 뒤)에 추가:
```
export interface RoleShortfallEntry { roleKey: string; roleLabel: string; requiredCount: number; filledCount: number; shortfall: number; }
export interface DateShortfallEntry { date: string; roles: RoleShortfallEntry[]; shortfall: number; }
export interface PostingShortfallSummary { byRole: RoleShortfallEntry[]; byDate: DateShortfallEntry[]; totalShortfall: number; unplannedFilled: RoleShortfallEntry[]; }
export function summarizePostingShortfall(posting: JobPosting, submap: Map<string, number> | undefined): PostingShortfallSummary
```
구현 규칙:
- 키 조립은 **반드시** `slotHydrateKey`/`roleHydrateKey`(src/domains/schedule/postingHydrateKeys.ts)를 import 해 쓴다. 새 키 함수 금지(pitfall_role_key_two_lineages_bare_other).
- required 순회: `posting.schedule.requirements` → `requirement.date`(dated) / fixed 는 date 축 없음 → `requirement.timeSlots` → `slot.roles`. 각 (date, slotKey, roleKey) 의 `Math.max(0, role.count ?? 0)` 를 required 로 누적. 이 순회 규칙은 stats.ts:37-52 `calculateTotalPositionsFromSchedule` 과 동일해야 `Σ byRole.requiredCount === posting.totalPositions` 가 성립한다(테스트로 고정).
- filled 조회: `submap.get(`${date}__${slotKey}__${roleKey}`)` — 미적중은 0(기존 postingSurfaceModel.ts:466-468 의 `hydrated ?? role.filled ?? 0` 계보와 동일).
- **정원 외 확정 처리**: 순회 후 submap 에 남아 있는(= requirements 에 대응이 없는) 키들을 `unplannedFilled` 로 모은다. required=0, shortfall=0, filled=n. 이걸 안 하면 add_direct_staff 의 v_capacity=0 경로(baseline :719)로 들어온 인원이 증발해 부족 수치가 과대 계상된다.
- fixed 공고(`posting.schedule.kind === 'fixed'`)는 date 축이 없으므로 `byDate` 를 빈 배열로 반환하고 `byRole` 만 채운다. 호출부는 byDate.length===0 이면 날짜 상세를 숨긴다.
- 불변성: 새 객체만 생성, posting/submap 미변경.
- roleLabel 은 `getRoleDisplayName(role.role, role.customRole)`(@/types/unified) 재사용 — selectors.ts:114 가 이미 쓰는 것.
- src/domains/job-posting/index.ts 배럴에 export 추가(:1-39 형식 따를 것).

[2) 표시 컴포넌트 신설] uniqn-mobile/src/components/employer/applicants/RoleFillSummary.tsx
- props: `{ summary: PostingShortfallSummary; totalPositions: number; filledPositions: number }`
- 접힌 상태(기본): 상단에 기존 `확정 N / 정원 M명` 유지 + 그 아래 역할 칩 한 줄 — `딜러 12/12` `플로어 3/8` . 부족(shortfall>0)인 칩만 강조(`text-warning-600 dark:text-warning-400`), 채워진 칩은 `text-content-muted dark:text-secondary-400`. 취소선/회색 규칙은 PostingScheduleContent.tsx:252-265 RoleBadge 와 시각적으로 일치시킬 것.
- 펼침(`Pressable`, min-h-44, `accessibilityRole="button"`, `accessibilityState={{ expanded }}`): `summary.byDate.filter(d => d.shortfall > 0)` 만 날짜순으로 나열 — `8/12(수) 플로어 2명 부족` 형태. **부족이 없는 날은 그리지 않는다**(7일 대회에서 벽이 되는 것을 막는 핵심 결정).
- `unplannedFilled.length > 0` 이면 하단에 `정원 외 배치 N명` 한 줄(index.tsx 로 유도하지 말고 사실만 표기).
- 접근성: 칩을 `Pressable` 안에 넣지 말 것 — RN Pressable 이 자식 Text 를 삼켜 스크린리더에 0으로 읽힌다(S4 실사고). 칩 컨테이너 View 에 `accessibilityLabel` 을 직접 준다.
- 다크모드 `dark:` 전 클래스 필수.

[3) 배선] uniqn-mobile/app/(employer)/my-postings/[id]/applicants.tsx
- import 추가: `import { extractPostingFilledSubmap, usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';` + `summarizePostingShortfall` (@/domains/job-posting)
- :50 아래에 index.tsx:166-169 과 **동일한 3줄** 추가:
  `const { data: filledAll } = usePostingFilledCounts(jobPostingId ? [jobPostingId] : []);`
  `const filledSubmap = useMemo(() => extractPostingFilledSubmap(filledAll, jobPostingId || ''), [filledAll, jobPostingId]);`
  `const shortfall = useMemo(() => (job ? summarizePostingShortfall(job, filledSubmap) : null), [job, filledSubmap]);`
- :231-245 의 스트립 JSX 를 `<RoleFillSummary ... />` 로 교체(합계 줄은 컴포넌트 내부로 이동해 회귀 0).
- :39-40 의 주석 "추가 fetch 없음"을 사실에 맞게 수정 — 이 주석이 다음 사람을 또 속인다.

[4) 죽은 카운터 방어] src/domains/job-posting/projections.ts:91 의 `roleAvailability: facts.roleAvailability` 위에 경고 주석 추가: "⚠️ 이 roleAvailability.filled 는 항상 0이다(core.ts:139 SP3 dead counter). 실충원이 필요하면 usePostingFilledCounts + summarizePostingShortfall 을 쓸 것." — 가설 D 재발 방지. (타입으로 막는 게 더 확실하나 소비처 4곳 파급이 커서 이번 범위 밖.)

[5) 테스트]
- src/domains/job-posting/__tests__/shortfallSummary.test.ts 신설(roleAvailability.hydrate.test.ts 옆). 케이스: ①역할별 합계 ②날짜별 부족만 필터 ③bare other(`other:`) 키 매칭 ④TBA 슬롯('미정') 매칭 ⑤requirements 에 없는 키 → unplannedFilled ⑥`Σ byRole.requiredCount === calculateTotalPositionsFromSchedule(schedule)` 불변식 ⑦fixed 공고는 byDate 빈 배열.
- src/components/employer/applicants/__tests__/RoleFillSummary.test.tsx — **컴포넌트 렌더까지** 단언(순수 헬퍼만 보는 테스트는 배선 누락을 못 잡는다. F1 과 같은 교훈).

### 리스크
1) **키 미스매치가 조용한 오표시를 만든다.** slotHydrateKey/roleHydrateKey 를 안 쓰고 손으로 키를 조립하면 bare other(`other` vs `other:`)와 TBA 슬롯('' vs '미정')에서 미적중 → filled=0 → '전부 부족'으로 표시된다. 2026-07-14 에 같은 사고가 났고 기록이 uniqn-mobile/.claude/agent-memory/code-reviewer/pitfall_role_key_two_lineages_bare_other.md 에 남아 있다. 완화 = postingHydrateKeys.ts import 강제 + 테스트 케이스 ③④.

2) **정원 외 확정 인원 증발.** baseline :719 `IF v_capacity > 0 AND ...` 때문에 스케줄에 없는 (날짜,슬롯,역할) 조합의 work_log 가 생성될 수 있고, count_posting_confirmed_by_slot 은 그걸 센다. unplannedFilled 처리를 빼면 부족 수치가 과대 계상돼 구인자가 있지도 않은 결원을 메우려 든다. 완화 = fixDesign [1] 의 unplannedFilled + 테스트 ⑤.

3) **fixed 공고에서 날짜 축이 없다.** posting.schedule.kind==='fixed' 면 requirements[0].date 가 null 이고, add_direct_staff(baseline :711-716)는 fixed 슬롯 키를 'NEGOTIABLE' 로 조회하는데 기존 행 카운트는 `_posting_slot_key(wl.time_slot)` 로 한다 — 서버 안에서도 축이 어긋나 있다. 완화 = fixed 는 byDate 를 비우고 byRole 만 낸다(위 설계). 서버의 NEGOTIABLE 불일치는 이 작업 범위 밖이지만 **별도 이슈로 올려야 한다**(고정 공고에서 부족 수치가 틀릴 소지).

4) **기존 화면과의 수치 모순.** index.tsx:399 의 PostingScheduleContent 는 그룹 날짜 범위에서 filled 를 `max(일별)`로 접는다(postingSurfaceModel.ts:340-349, 주석: 'max 가 유일하게 정직한 분자'). 새 요약이 `sum(일별)` 을 쓰면 같은 공고에 두 숫자가 뜬다. 완화 = 요약은 **좌석 총계(Σ)** 축임을 UI 문구로 명시(`총 20자리 중 12자리 확정`)하고, index.tsx 의 하루 기준 표시와 의미가 다름을 주석에 남긴다. 또는 byDate 상세만 보여주고 byRole 합계는 좌석 기준임을 라벨에 박는다.

5) **레이아웃.** 역할이 5~6종이면 칩 한 줄이 넘친다. `flex-wrap` + 375pt 확인 필요. 스트립이 두 줄이 되면 그 아래 FilterTabs(ApplicantList.tsx:268-272)와 합쳐 헤더가 화면의 1/3을 먹는다.

6) **회귀 위험은 낮다.** 교체 대상 applicants.tsx:231-245 는 표시 전용이고, 새로 부르는 usePostingFilledCounts 는 실패 시 빈 Map 을 반환하도록 이미 설계돼 있다(JobPostingRepository.ts:637-641,653-656 — 에러/예외 모두 빈 맵 + Sentry 보고). 즉 RPC 가 죽어도 화면은 지금과 같은 합계 스트립으로 열화될 뿐 깨지지 않는다. 단 그때 '부족 0'으로 보이는 fail-open 이 되므로, submap 이 undefined 면 역할 칩 자체를 숨기고 합계만 그릴 것(빈 맵과 미로딩을 구분).

### 선행 의존성
1) src/domains/schedule/postingHydrateKeys.ts 의 `slotHydrateKey`/`roleHydrateKey` 가 선행 의존이다. 이 파일이 서버 `_posting_slot_key`/`_posting_role_key` 와 정합인지 먼저 확인(src/domains/schedule/__tests__/postingHydrateKeys.test.ts 통과 여부).
2) **설계 결정 1건이 코드보다 먼저**(openQuestion): 요약을 좌석(Σ) 축으로 낼지 하루(max) 축으로 낼지. index.tsx 가 하루 축을 쓰므로 이걸 안 정하면 두 화면이 다른 숫자를 낸다.
3) DB·RPC 의존 없음. get_posting_filled_counts 는 이미 prod 에 있고(baseline 포함) authenticated GRANT 도 있다.
4) F1(applicant-reputation-invisible)과 파일 충돌 없음 — F1 은 ApplicantCard/CardHeader/ProfileInfoSections, F2 는 applicants.tsx + selectors.ts + 신규 컴포넌트. 다만 둘 다 `app/(employer)/my-postings/[id]/applicants.tsx` 를 건드릴 수 있으므로(F1 은 ApplicantList props 경유라 실제로는 안 건드림) 병렬 진행 시 이 파일을 F2 소유로 고정할 것.
5) 고정 공고의 서버 슬롯키 불일치(NEGOTIABLE vs _posting_slot_key, baseline :711-716)는 별도 이슈로 분리 — 이 작업의 선행은 아니지만, 미해결로 두면 fixed 공고의 부족 수치를 신뢰할 수 없다.

### 🔍 검증 — 놓친 제약
① 신선도 배선은 공짜로 얻는다(분석 미언급 이득) — 확정/취소 뮤테이션이 이미 POSTING_FILLED_COUNTS_QUERY_KEY 를 무효화한다(queryClient.ts:751·useConfirmedStaff.ts:149,179·invalidationStrategy.ts:572 'postingFilledCounts.all'). 지원자 화면에서 확정 직후 신설 요약이 추가 배선 없이 갱신된다. ② e2e 실측 — '정원' 문구를 단언하는 유일한 스펙 employer-posting-capacity-recovery.spec.ts:174-181 은 my-postings 목록 카드의 '정원 마감' 라벨이라 applicants 스트립 교체와 무관. 단 스트립 문구('확정 N / 정원 M명')를 컴포넌트 내부로 옮길 때 문구를 바꾸면 e2e 는 quality 밖이므로 별도 grep 재확인 습관은 유지. ③ 화면 플래그 없음, DB 변경 0 확인(count_posting_confirmed_by_slot 후속 재정의 grep 0건 — baseline 판이 현행이고 소프트취소 필터 NOT IN ('cancelled','no_show') 내장). ④ 타입 파급 없음 — 신설 export 전부 additive, 기존 계약(리네임 금지 대상) 미접촉.

### 🔧 검증 — 설계 보정
수정설계에 구체 결함 1건: fixed 공고 분기가 문면대로 구현되면 오표시를 만든다. 서버 count_posting_confirmed_by_slot 은 fixed 공고의 work_logs 도 실제 date 와 _posting_slot_key(wl.time_slot) 로 키를 만든다(전수 GROUP BY). 반면 fixed 의 requirements 엔 date 가 없고 add_direct_staff 는 슬롯 조회를 'NEGOTIABLE' 로 하는 축 어긋남(baseline :711-716 확인)까지 있어, 설계의 (date,slotKey,roleKey) 순회로는 fixed 공고 submap 키가 전량 미적중 → filled 전부가 unplannedFilled 로 흘러 '전 역할 0/N + 정원 외 배치 N명'이라는 새 오표시가 생긴다. 보정: fixed 분기는 byRole filled 를 aggregateRoleFilledFromSubmap(selectors.ts:59-81, 날짜·슬롯 축 소거)로 집계하고 unplannedFilled 판정은 dated 공고에만 적용한다고 명시할 것. 테스트 케이스 ⑦을 'byDate 빈 배열' 확인에서 'fixed byRole filled 정확성 + unplannedFilled 미발생'까지 확장. 그 외 설계 전제는 전부 실측 통과 — postingHydrateKeys 의 slotHydrateKey/roleHydrateKey SSOT 실재(bare other 'other:' 접두 :68-75), usePostingFilledCounts 모듈에서 두 함수 모두 export, 배럴 src/domains/job-posting/index.ts 실재.

### 검증 메모
인용 전수 검증 통과: applicants.tsx:39 '추가 fetch 없음' 주석·:230-245 스칼라 스트립, get_posting_filled_counts(baseline :3022 부근, 5열 SECDEF 래퍼), index.tsx:166-170 hydrate 3줄, PostingScheduleContent:243-276 formatRoleLine '(3/5)'+취소선, SP3 dead counter 사슬(core.ts:74-76·:138-140 filled:0 강제 → facts.ts:61-75 → projections.ts:91 passthrough — 가설 D '그리면 전 역할 0/N' 위험 실재 확인), selectPostingRoleAvailability 의 filledByRole 주입 분기(:96-133), stats.ts:37-52 좌석 기준, add_direct_staff 'IF v_capacity > 0' fail-open, get_venue_grid_summary required_count 날짜 축 한정(20260727120000:175-185), postingSurfaceModel 'max 가 유일하게 정직한 분자' 주석(:330-331). Σ(좌석) vs max(하루) 축 결정이 코드보다 선행이라는 분석 판단에 동의 — index.tsx 와 두 숫자가 뜨는 모순은 실제 위험. 난이도 M 유지(순수함수 엣지 케이스가 많지만 DB 0·회귀면 좁음).

### 🙋 사람이 결정할 것
Q1(필수, 설계). **요약의 분모/분자를 어느 축으로 정의하나.** 후보 (a) 좌석 총계 Σ(날짜×슬롯×역할) — stats.ts:37-52 `calculateTotalPositionsFromSchedule` 및 applicants.tsx 의 `정원 20명` 과 일치, (b) 하루 기준 max — index.tsx:399 가 그리는 PostingScheduleContent 의 그룹 섹션 규칙(postingSurfaceModel.ts:331-349)과 일치. 둘은 7일 대회에서 크게 갈린다(딜러 3명×7일 = (a)21 vs (b)3). **같은 앱 안에 두 축이 공존 중이므로 어느 쪽을 지원자 화면의 정본으로 할지 사람이 정해야 한다.** 정하지 않으면 화면 두 개가 서로 다른 숫자를 말한다.

Q2(필수, UX). **날짜 축을 어디까지 보여주나.** 7일 대회에서 (i) 부족한 날짜만 목록(제안) (ii) 전 날짜 그리드 (iii) 요약만, 상세는 관리 허브로 유도. (i)을 제안하는 이유는 '딜러 3일차만 미달'이 정확히 (i)이 답하는 질문이기 때문이지만, '오늘/내일 우선' 같은 시간 가중을 넣을지는 제품 판단이다.

Q3(선택). **부족을 액션과 연결할 것인가.** 부족 칩을 눌렀을 때 (i) 아무 동작 없음 (ii) 해당 역할로 지원자 목록 필터 (iii) 스태프 직접 추가 모달로 이동. (ii)는 ApplicantList.tsx:57-62 의 FILTER_OPTIONS 가 현재 상태(전체/신규/확정/거절) 축이라 역할 축 필터를 새로 만들어야 한다 — 범위가 커지므로 1차에서는 (i)을 권한다.



---

# G-재사용


## `preset-no-delete-rename` — 프리셋(템플릿) 삭제·이름 변경 불가 — 삭제 API 는 살아 있는데 UI 진입점만 S4 리팩터링에서 증발했다

**주장 판정**: 부분사실 · **심사**: CONFIRMED · **설계 실현성**: 수정필요 · **난이도**: M→M · **마이그레이션**: 불필요

### 근거 (실측)
증상은 전부 재현됨. 그러나 '서버 함수부터 없다'는 거짓이다.

① 캐러셀에 삭제·이름변경 제스처 0건 — `src/components/employer/order-sheet/PresetCarousel.tsx:69-99`. 카드 Pressable 은 `onPress={() => onSelect(p)}` 하나뿐이고(`:72`), `onLongPress`·스와이프·편집모드가 없다. props 도 `presets/onSelect/onSavePress/isLoading` 4개뿐(`:24-30`).

② 삭제 파이프라인은 **전 계층 완비**: 훅 `src/hooks/useTemplateManager.ts:217-302` `handleDeleteTemplate`(옵티미스틱+5초 Undo 토스트+언마운트 flush) → 서비스 `src/services/jobs/templateService.ts:83-96` → 리포 `src/repositories/supabase/TemplateRepository.ts:159-199`(`.eq('id').eq('user_id')` 후 affected-rows 0 이면 NOT_FOUND/PERMISSION 분기). 이 세션에서 `npx jest src/__tests__/hooks/useTemplateManager.delete.test.tsx` 실행 → **4/4 pass**(타이머 커밋·되돌리기·언마운트 flush·연속삭제 격리).

③ 이름 변경도 **서버까지 완비**: `templateService.ts:105-127` `updateTemplate` + `TemplateRepository.ts:201-264`(name/description/template_data 부분 갱신, 본인 확인 동일). 다만 **소비처 0** — grep 결과 정의·배럴(`src/services/jobs/index.ts:63`)·자체 테스트뿐, 훅에도 래퍼가 없다.

④ RLS 는 이미 열려 있다 — `supabase/migrations/20260710000002_baseline_schema_from_prod.sql:14000-14024` 에 `templates_delete_own`·`templates_update_own`(둘 다 `user_id = (SELECT auth.uid())`) 존재.

⑤ 중복 이름 차단 실재 — `useTemplateManager.ts:174-184`, trim+소문자 비교로 걸리면 토스트만 띄우고 **모달을 닫지 않는다**(사용자가 새 이름을 지어낼 때까지 갇힘).

⑥ 진입점은 캐러셀뿐 — `find app -name "*.tsx" | grep -i 'templ|preset'` 0건(템플릿 관리 화면 없음). `handleDeleteTemplate` grep 소비처는 훅+테스트뿐.

### 근본 원인
**리팩터링 잔해(기능 후퇴)**. 삭제 UI 는 과거에 실재했다 — `git log -S"handleDeleteTemplate"` 로 `app/(employer)/my-postings/create.tsx` 에서 `<LoadTemplateModal ... onDeleteTemplate={templateManager.handleDeleteTemplate} isDeletingTemplate={...}/>` 가 렌더되던 블록을 확인했고, 그 블록은 `29dd21125`(refactor(jobs): create 사문 레거시 분기 제거 — 주문서 단일 경로 확정, S4)에서 제거됐다. 컴포넌트 파일 `src/components/employer/job-form/modals/LoadTemplateModal.tsx` 자체는 `e349c67e4`(레거시 섹션 폼 체인 일괄 은퇴, S4) 에서 삭제됐다 — 그 파일에는 행별 삭제 Pressable(`accessibilityLabel="템플릿 삭제"`)과 손상 템플릿 안내('삭제 후 새로 저장해 주세요')까지 있었다. 즉 주문서 캐러셀(#246)이 '불러오기 모달'을 대체하면서 **적용 기능만 옮기고 관리 기능은 옮기지 않았다.** 훅은 그대로 남아 삭제 API 가 고아가 됐고, 같은 커밋에서 `isLoadTemplateModalOpen`·`openLoadTemplateModal`·`handleLoadTemplate`·`isLoadingTemplate`(`useTemplateManager.ts:122,159-165,204-211,323`)도 함께 고아가 됐다. `isDeletingTemplate: false`(`:326`)는 지금 **하드코딩 상수**다.

### 인과사슬
사장이 주문서에서 '＋ 저장'으로 '테스트' 프리셋을 만든다 → `handleSaveTemplate`(`useTemplateManager.ts:167-202`)가 `saveTemplate` 로 INSERT → 캐러셀(`create.tsx:120-131`)이 `templateManager.templates` 를 순회해 카드를 그린다 → **지우려 해도 카드에 달린 핸들러는 `onSelect` 하나뿐**(`PresetCarousel.tsx:72`)이라 어떤 제스처로도 삭제에 도달하지 못한다 → 같은 이름으로 다시 저장하려 하면 `useTemplateManager.ts:175-184` 의 중복 검사가 `'같은 이름의 템플릿이 이미 있습니다.'` 토스트를 띄우고 `return` — `closeTemplateModal()`(`:192`)에 도달하지 못해 모달이 열린 채 남는다 → 사장은 '테스트2' 를 만든다 → 캐러셀 카드가 하나 더 는다.

증폭 요인 두 가지를 실측했다. (1) **개수 상한이 없다** — `grep MAX_TEMPLATE` 0건, DDL(`baseline:9996-10006`)에 CHECK 없음, 서비스/리포에도 카운트 게이트 없음. (2) **정렬은 `created_at desc` 고정**(`TemplateRepository.ts:59`)이라 오래된 쓰레기가 뒤로 밀릴 뿐 사라지지 않는다. 게다가 `usage_count` 는 영원히 0 이다 — 증가 경로가 `loadTemplate`(`TemplateRepository.ts:135-147`, `increment_template_usage` RPC)뿐인데 그 함수를 호출하는 `useLoadTemplate`(`useTemplateManager.ts:85-105`)이 S4 이후 소비처 0 이고, 캐러셀은 `templateToValues(t)`(`create.tsx:126`)로 **DB 를 거치지 않고** 적용한다. 따라서 '자주 쓰는 순 정렬'로 완화하는 길도 데이터가 없어 막혀 있다.

### 파급 범위
**캐러셀 유일 소비처 = `app/(employer)/my-postings/create.tsx`.** `OrderSheetScreen.tsx:777` 이 `presets !== undefined` 로 게이트해 edit 모드에는 캐러셀이 아예 없다(`edit.tsx:177-186` presets 미전달).

같은 훅을 쓰는 화면은 3개(`create.tsx:81`, `edit.tsx:52`, `create-success.tsx:39`)지만 목록 UI 가 있는 건 create 뿐 → 삭제 UI 추가는 create 한 화면에만 영향. 다만 캐시 키(`queryKeys.templates.all`)가 공유라 삭제 후 무효화는 세 화면 모두에 반영된다.

테스트 표면: `order-sheet-preset-*` testID 소비 파일 6개(`PresetCarousel.test.tsx`, `OrderSheetScreen.{presets,chain,salarySync,silentLoss,scheduleGroups}.test.tsx`) — 전부 **testID 기반**이고 인덱스/자식수 단언이 없어 카드 1개 추가는 안전. `e2e/` 에서 `order-sheet-preset` grep **0건** → CLAUDE.md 의 'e2e 는 quality 범위 밖' 함정에 걸리지 않는다(확인함).

DB: 무영향(테이블·RLS·트리거 모두 기존). `job_posting_templates` 관련 트리거는 `templates_updated_at`(baseline:12240) 하나뿐이라 UPDATE 시 `updated_at` 만 갱신된다.

보안 표면 1건: `job_posting_templates` 는 XSS 트리거 대상이 **아니다**(baseline 의 `*_xss_check` 트리거 목록 8개에 없음: announcements/applications/board_comments/board_posts/inquiries/job_postings/reports/users). 클라에도 zod 없음(`TemplateModal.tsx` 는 `maxLength` 만). 다행히 RLS 가 select-own 이라 노출 반경은 본인뿐이지만, 이름 변경 기능을 추가하면 같은 무검증 경로가 하나 더 생긴다.

### 기각한 경쟁 가설
**(A) '서버 함수부터 없어서 못 지운다'** — 기각. 삭제는 `TemplateRepository.ts:159-199` + RLS `templates_delete_own`(baseline:14003)로 완비, 이 세션 테스트 4/4 pass. 이름 변경도 `updateTemplate`(`templateService.ts:105` / `TemplateRepository.ts:201`) + RLS `templates_update_own`(baseline:14024)로 완비. 없는 건 UI 와 훅 래퍼뿐이다.

**(B) '다른 화면(설정·마이페이지)에 템플릿 관리가 이미 있다'** — 기각. `find app -name "*.tsx"` 에서 template/preset 라우트 0건, `handleDeleteTemplate` 소비처 grep 은 훅 정의와 테스트뿐. `openLoadTemplateModal` 도 훅 내부 자기참조만 남았다.

**(C) '의도적 제약 — 삭제하면 이미 발행된 공고가 깨진다'** — 기각. 템플릿과 공고는 **참조 관계가 없다**. `templateToValues`(`mappers.ts:411-418`)가 값을 복사할 뿐이고, `job_postings` 에 template FK 도, `job_posting_templates` 를 참조하는 FK 도 없다(baseline:12766 의 FK 는 `user_id → users(id)` 하나). 게다가 삭제 UI 는 과거에 실제로 존재했다 — 보안·정합성 판단이었다면 RLS 부터 막혔을 것이다.

**(D) '개수 상한이 있어 오래된 것이 자동 정리된다'** — 기각. 클라 상한 grep 0건, DDL CHECK 없음, `getTemplates`(`TemplateRepository.ts:51-73`)에 `.limit()` 없음. 무한 누적이 구조적으로 가능하다.

**(E) 'usage_count 기반 정렬로 이미 완화되고 있다'** — 기각. 정렬은 `created_at desc` 고정(`:59`)이고 `usage_count` 증가 경로(`increment_template_usage`)는 소비처 0 인 `loadTemplate` 뿐이라 전 레코드가 0 이다.

### 수정 설계
**1) 스키마 SSOT 신설 — `src/types/jobTemplate.ts`**
`export const templateNameSchema = z.string().trim().min(2, '템플릿 이름은 2자 이상 입력해주세요').max(50).refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })` 추가(`xssValidation` 은 `@/utils/security:236`). 저장·이름변경 **양쪽**이 이걸 소비한다 — 지금 저장 경로가 무검증이라 이름변경만 검증하면 축이 갈린다.

**2) 훅 — `src/hooks/useTemplateManager.ts`**
- 내부 뮤테이션 `useRenameTemplate()` 추가: `mutationFn: ({templateId, name}) => { requireAuth(user?.uid,'useTemplateManager'); return updateTemplate(templateId, { name }, user.uid); }`(`@/services/jobs/templateService` 의 기존 export 를 그대로 import). `onSuccess` 에서 `queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })` + `addToast({type:'success', message:'이름을 바꿨어요'})`, `onError` 는 `extractErrorMessage` 패턴 계승(`:72-78` 동형).
- 공개 `handleRenameTemplate(templateId: string, nextName: string): Promise<boolean>` — ① `templateNameSchema.safeParse` ② 중복 검사는 `handleSaveTemplate` 과 **같은 비교식**을 쓰되 `t.id !== templateId` 로 자기 자신 제외 ③ `await renameMutation.mutateAsync(...)`.
- 중복 비교를 `handleSaveTemplate`(`:175-178`)과 공유하도록 `findDuplicateName(templates, name, excludeId?)` 지역 헬퍼로 추출(복제 금지 — 이 레포에서 '같은 판정 복제 후 한쪽만 수정'이 반복 사고였다).
- `isDeletingTemplate: false`(`:326`) 하드코딩 제거 → `pendingDeletesRef.current.size > 0` 은 렌더 트리거가 없으므로 **prop 자체를 삭제**하고 소비처(신설 시트)는 Undo 토스트로 대체.
- ⚠️ 죽은 로드 모달 5종은 **이번 PR 에서 건드리지 않는다** — 지우면 `loadTemplate`/`increment_template_usage` 도 함께 죽어 usage_count 부활 경로가 사라진다. 사유를 주석으로 남긴다.

**3) 시트 신설 — `src/components/employer/order-sheet/TemplatePresetManageSheet.tsx`**
`SheetModal`(`@/components/ui:63`) 기반. props `{ visible, onClose, templates, onRename(id, name): Promise<boolean>, onDelete(id, name): Promise<boolean> }`.
행 구조는 `src/components/ops/BlindPresetSheet.tsx:61-95` 를 그대로 따른다 — **적용/삭제 Pressable 을 중첩하지 말고 형제로 배치**(그 파일 61-63 주석: 웹에서 `<button>` in `<button>` 하이드레이션 에러). 각 행 = [이름 Text 또는 편집중이면 TextInput] · [이름변경/저장] · [삭제], 터치타깃 44px, `dark:` 쌍 필수.
- 이름변경: 인라인 TextInput(입력 다이얼로그 유틸이 없다 — `BlindPresetSheet.tsx:6` 주석과 동일 제약) + '저장' 탭 → `onRename` → true 면 편집 종료.
- 삭제: `confirmAction` 을 쓰지 **않는다**. 훅이 이미 5초 Undo 토스트를 제공하므로 impeccable §12(Undo > Confirm)를 따른다. `onDelete` 만 호출.

**4) 캐러셀 — `PresetCarousel.tsx`**
`onManagePress?: () => void` prop 추가. `'＋ 저장'` 카드(`:90-98`) 옆에 `onManagePress !== undefined` 일 때만 '관리' 카드 렌더 — `testID="order-sheet-preset-manage"`, `accessibilityRole="button"`, `accessibilityLabel="프리셋 관리"`, `min-h-[44px]`. **롱프레스를 주 진입점으로 삼지 말 것** — 스크린리더에 대응물이 없고 가로 ScrollView 와 제스처가 겹친다(impeccable §29·§30). 롱프레스는 보조 가속기로만 선택 추가.

**5) 배선 — `OrderSheetScreen.tsx` + `create.tsx`**
- `OrderSheetScreen` props 에 `onManagePresets?: () => void` 추가하고 `PresetCarousel`(`:778-783`)에 pass-through. 기존 `presets !== undefined` 게이트 유지.
- `create.tsx`: `const [isManageOpen, setIsManageOpen] = useState(false)`; `onManagePresets={templateManager.templates.length > 0 ? () => setIsManageOpen(true) : undefined}`. 시트는 `TemplateModal` 과 **동시 오픈 금지**(중첩 RN Modal #244) — `{isManageOpen && !templateManager.isTemplateModalOpen ? <TemplatePresetManageSheet .../> : null}`.

**6) 중복 이름 정책(사용자 결정 필요, openQuestion 참조)** — '덮어쓸까요?' 로 바꾼다면 `handleSaveTemplate` 의 `return`(`:183`) 자리에서 `confirmActionAsync({title:'같은 이름이 있어요', message:`'${trimmedName}' 프리셋을 덮어쓸까요?`, confirmText:'덮어쓰기'})` → true 면 `updateTemplate(duplicate.id, { name, description, draft }, uid)` 로 분기. 단일 행 UPDATE 라 RPC 불필요.

**7) 테스트**
- `PresetCarousel.test.tsx` +2: `onManagePress` 미전달 시 관리 카드 없음 / 전달 시 탭하면 호출.
- 신규 `TemplatePresetManageSheet.test.tsx`: 이름 편집→저장이 `onRename(id, 새이름)` 호출, 삭제 탭이 `onDelete(id, 이름)` 호출.
- 신규 `src/__tests__/hooks/useTemplateManager.rename.test.tsx`: ① 자기 자신 이름 유지 시 중복 차단 안 됨 ② 다른 템플릿과 같은 이름은 차단 ③ `<script>` 이름 거부 ④ 성공 시 `updateTemplate` 인자·invalidate 검증.

### 리스크
**① Undo 창과 화면 이탈이 충돌한다.** 삭제 커밋 타이머는 `create.tsx` 의 `useTemplateManager` 인스턴스에 매달려 있고, 언마운트 시 `pending.forEach(commit)`(`useTemplateManager.ts:138-147`)로 **즉시 확정**된다. 시트에서 지운 직후 사장이 뒤로가기를 누르면 '되돌리기' 토스트가 화면에 떠 있어도 되돌릴 수 없다. 기존 동작이지만 시트가 생기면 '연달아 여러 개 정리'가 흔해져 노출이 커진다 — 시트를 닫아도 create 화면에 머무는 한 타이머는 유효하다는 점을 문구로 알리거나, 시트 안에 취소선 표시로 대기 상태를 보이게 할 것.

**② 이름 변경은 낙관적 잠금이 없다.** `updateTemplate` 은 `expectedUpdatedAt` 을 받지 않는다(`TemplateRepository.ts:201-264`). 템플릿은 owner-only 라 동시 편집자가 원리상 없지만, 두 기기 동시 사용 시 마지막 쓰기가 이긴다. 공고 편집(`useOptimisticLockBaseline`)과 축이 다르다는 점만 인지.

**③ XSS 무검증 표면을 넓힌다.** 위 fixDesign 1)의 스키마를 **저장 경로에도 동시 적용**하지 않으면 이름변경만 막고 저장은 뚫린 비대칭이 생긴다. 반대로 저장에도 적용하면 기존에 저장된 이상한 이름을 가진 레코드가 rename 시에만 거부되는 상황이 생길 수 있다(읽기는 계속 허용되므로 기능 중단은 아님).

**④ 캐러셀 폭 증가.** 카드가 하나 더 늘어 소형폰(375pt)에서 '＋ 저장'이 접힌다. `templates.length > 0` 조건부라 신규 사장에게는 무영향이지만 375pt 실기기 확인 필요(impeccable v3 게이트).

**깨지지 않는다고 판단한 것**: 6개 테스트 파일의 `order-sheet-preset-*` 단언은 전부 testID 기반이라 카드 추가에 무관하고, `e2e/` 에는 프리셋 testID 소비가 0건이다(둘 다 grep 실측).

### 선행 의존성
없음(서버·RLS·마이그레이션 모두 기존). 단 **파일 충돌 주의** — `app/(employer)/my-postings/create.tsx` 를 G2 와 동시에 건드린다(G1 은 렌더 트리 하단·상태 추가, G2 는 `initialValues` useMemo). 같은 PR 로 묶거나 G2 → G1 순으로 진행할 것.

### 🔍 검증 — 놓친 제약
① [치명] Undo 토스트가 RN Modal 뒤에 숨는다 — SheetModal 은 RNModal 기반(src/components/ui/SheetModal.tsx:13)이고 ToastManager 는 루트에만 렌더(app/_layout.tsx:208). 네이티브에서 관리 시트가 열린 동안 삭제 Undo 토스트는 보이지도 눌리지도 않아, 설계가 명시한 'confirmAction 금지+Undo 의존'은 편도 삭제가 된다. 설계가 행 구조 참조로 지목한 BlindPresetSheet 자체가 정확히 이 이유로 시트 내부 삭제에 confirmAction(네이티브 Alert 는 Modal 위에 뜬다)을 쓴다(BlindPresetSheet.tsx:107-115). 웹은 WebSheetModal(비 RNModal)이라 증상이 갈린다 — 양 플랫폼 실측 필요. ② job_posting_templates 에 (user_id,name) UNIQUE 제약이 없다(baseline DDL 실측) — 중복 이름 방어는 클라 검사뿐이라 두 기기 동시 저장·삭제 Undo 경합 시 중복 이름 공존 가능. rename 중복검사도 같은 한계. ③ RLS·RPC·e2e·플래그는 문제없음을 실측으로 재확인(단일 행 UPDATE/DELETE, templates_update_own/delete_own 실재, e2e 프리셋 testID 0건). ④ 인용 경로 `edit.tsx` 는 실제 `app/(employer)/my-postings/[id]/edit.tsx` — 라인은 정확, 경로 표기만 축약.

### 🔧 검증 — 설계 보정
삭제 상호작용 한 축만 교체하면 나머지 설계는 그대로 실행 가능. (a) 시트 내부 삭제는 BlindPresetSheet 동형 confirmAction 으로 하거나, (b) Undo 를 고집하려면 risk ①에 '검토'로 적힌 시트 내 인라인 대기 상태(취소선+행 내 되돌리기 버튼)를 필수로 격상해 토스트 의존을 제거할 것 — impeccable §12(Undo>Confirm)는 토스트가 보일 때만 성립한다. (c) 또는 삭제 즉시 시트를 닫아 루트 토스트가 보이게. 부가 2건: `{isManageOpen && !isTemplateModalOpen}` 게이트는 사실상 死조건이다 — TemplateModal 은 캐러셀 '＋저장'에서만 열리고 관리 시트가 열려 있으면 캐러셀을 탭할 수 없다. 놔둬도 무해하나 근거 주석은 정정할 것. templateNameSchema 위치는 types 파일보다 schemas/ 계층이 레포 관례에 맞다(차단 사유 아님). 중복 이름 근본 방어가 필요하면 후속으로 (user_id, lower(name)) 부분 UNIQUE 인덱스 마이그를 검토(이번 PR 범위 밖).

### 검증 메모
사실관계 전량 재현: 삭제 테스트 이 세션 독립 재실행 4/4 pass(13.0s), RLS 4정책·DDL 무상한·XSS 트리거 8종 목록·커밋 2건·고아 API 5종·e2e 0건·테스트 6파일 testID 기반 전부 실측 일치. 기각가설 A~E 의 기각 근거도 전부 유효. 수정설계는 골격이 견고하나 핵심 상호작용(시트 내 Undo 삭제)이 RN Modal 레이어링에 막혀 그대로는 출하 불가 — 삭제 UX 한 축 교체 후 실행 가능. 난이도 M 유지(신규 시트+훅 뮤테이션+배선+테스트 4벌, 마이그 0).

### 🙋 사람이 결정할 것
① **중복 이름을 차단 유지할 것인가, '덮어쓸까요?' 로 바꿀 것인가.** 덮어쓰기로 바꾸면 사장이 같은 이름을 계속 재사용하며 최신 구성으로 갱신하는 흐름이 생기고 이름 변경 수요 자체가 줄어든다. 다만 실수로 다른 프리셋을 덮어쓸 위험이 생긴다(되돌리기 없음 — Undo 를 붙이려면 이전 template_data 스냅샷 보관이 필요).
② **프리셋 개수 상한을 둘 것인가.** 현재 무제한이며 캐러셀은 가로 스크롤이라 20개가 넘으면 탐색이 무너진다. 상한(예: 20)을 둘지, 아니면 상한 없이 '관리' 시트로만 감당할지.
③ **usage_count 를 되살릴 것인가.** 살리려면 캐러셀 적용 시점(`create.tsx:126` 또는 `OrderSheetScreen.handleApplyPreset`)에서 `increment_template_usage` 를 호출해야 하고, 그래야 향후 '자주 쓰는 순' 정렬이 가능해진다. 살리지 않을 거면 `loadTemplate`·`useLoadTemplate`·RPC 를 명시적으로 은퇴시키는 편이 낫다.


## `posting-no-duplicate` — 공고 복제 불가 — 복제 버튼은 실제로 없고, 우회로는 4단계짜리 비발견적 경로다

**주장 판정**: 부분사실 · **심사**: PARTIAL · **설계 실현성**: 수정필요 · **난이도**: S→M · **마이그레이션**: 불필요

### 근거 (실측)
핵심 사실은 전부 재현됨. 다만 '처음부터 다시 입력해야 한다'는 과장이다.

① **복제 진입점 0건** — `grep -rn '복제|duplicate'` 결과 공고 도메인 히트 0(대회 운영 `ops_duplicate_tournament` 만 별개 도메인). 공고 상세 관리 카드 목록(`app/(employer)/my-postings/[id]/index.tsx:511-609`)은 지원자관리·취소요청·정산·수정·라이브운영·공유관리 6종뿐이고, 목록 카드 footer(`src/components/employer/posting/JobPostingCard.tsx:123-212`)는 공유·QR·마감/재오픈뿐이다.

② **'마지막 공고' 프리셋은 정확히 1건** — `create.tsx:88-97`. `useMyJobPostings()` 결과를 `reduce` 로 `toDate(createdAt).getTime()` 최댓값 1건만 고른다. 그 1건을 `draftToValues(buildJobPostingDraft(lastPosting))` 로 변환하고 `scheduleGroups[].dates` 를 비운다(`:113`).

③ **재사용 수단은 2개뿐** — `presets` 배열(`:101-133`) = ['마지막 공고' 1건] + [저장된 템플릿 전체]. 그 외 경로 없음.

④ **그러나 우회로가 실존한다**: 옛 공고 상세 → '공고 수정'(`[id]/index.tsx:554-568`) → 주문서 하단 ghost 버튼 '템플릿 저장'(`OrderSheetScreen.tsx:933-946`, `mode === 'edit' && onSaveTemplate !== undefined` 조건) → `edit.tsx:184` 가 `onSaveTemplate` 를 배선하고 있음을 확인 → 저장 후 create 에서 프리셋으로 적용. 4단계이고 '수정' 화면에서 저장 없이 빠져나와야 해 발견 가능성이 낮다.

⑤ **옛 공고는 목록에 남아 있다** — 만료는 삭제가 아니라 `status='closed' + closed_reason='expired'|'expired_by_work_date'`(`supabase/migrations/20260727000000_posting_auto_close_gaps.sql:332,379`)이고, `getMyJobPostings`(`src/services/jobs/jobService.ts:240-250`)가 active+capacity_full+closed 3버킷을 concat 한다. 즉 지난달 공고의 **상세 화면 진입은 가능하다** — 복제 진입점만 없다.

⑥ 착수점 힌트 정정: '최근 공고 조회'는 `src/hooks/job-posting/` 이 아니라 `src/hooks/useJobManagement.ts:76-87` 의 `useMyJobPostings` 다(그 디렉토리에는 collaborators·shared 훅 2개뿐).

### 근본 원인
**미완성(설계상 인지된 미구현)**. 의도적 제약이 아니다 — `docs/analysis/2026-07-10-ux-flow-review.md:170` 이 이미 '**공고 복제/재게시** — 상세에 "복제해서 새 공고", 만료 fixed 에 "동일 조건 재게시" 원클릭'을 권고했고 그 뒤 3주간 미착수다. 주문서 개편(#246 PresetCarousel, #261 S4 단일경로)이 재사용 축을 '프리셋'으로 정리하면서 **'마지막 1건'이라는 임의의 상한**을 도입했고(create.tsx:89-97 의 `reduce` 최댓값 1건), '임의 과거 공고'는 축에서 빠진 채 남았다. 변환 함수는 전부 갖춰져 있다 — `buildJobPostingDraft`(`src/utils/job-posting/submission.ts:6-8`)와 `draftToValues`(`src/utils/order-sheet/mappers.ts:254-409`)를 edit 화면과 프리셋 경로가 이미 쓰고 있다. **부족한 건 진입점과 값 전달 배선뿐이다.**

### 인과사슬
사장이 지난달 대회 공고와 같은 조건으로 하나 더 내려 한다 → 공고 목록에서 그 공고를 찾는다(closed 버킷에 남아 있음) → 카드를 탭해 상세로 간다 → 관리 카드 6종 어디에도 '이 공고로 새로 만들기'가 없다(`[id]/index.tsx:511-609`) → 뒤로 나와 '＋ 공고 등록'(`employer.tsx:324`)을 누른다 → 캐러셀에는 '마지막 공고' 1건이 뜨는데 그건 **지난주에 낸 다른 공고**다(`create.tsx:92-96` 이 `createdAt` 최댓값을 고르므로) → 원하는 공고를 되살릴 수단이 없다 → 제목·장소·연락처·역할·인원·급여·수당·모집조건·사전질문을 시트 8개를 오가며 다시 입력한다.

실제 탈출구는 존재하나 인지 불가다: 상세 → '공고 수정' 진입(사장 입장에선 **이미 끝난 공고를 수정한다는 게 이상하다**) → 주문서 하단 좌측 ghost '템플릿 저장'(`OrderSheetScreen.tsx:936-946`) → 이름 입력 → 수정 화면을 **저장하지 않고** 이탈(여기서 `useUnsavedChangesGuard` 가 '변경사항 저장 안 됨' 경고를 띄울 수 있어 더 불안하다) → create 진입 → 캐러셀에서 그 템플릿 탭. 4단계 + 역직관 2회.

### 파급 범위
**진입점을 어디에 두느냐가 반경을 결정한다.**
- 목록 카드(`JobPostingCard.tsx`)에 넣으면 **관리자 화면까지 샌다** — 이 컴포넌트는 `app/(app)/(tabs)/employer.tsx:478` 와 `app/(admin)/postings/index.tsx` 두 곳에서 렌더된다(grep 실측). 관리자 공고 목록에 사장용 '복제'가 나타난다. → **상세 화면에 둘 것.**
- 상세(`[id]/index.tsx`)는 employer 전용 라우트라 반경이 닫힌다.

변경 파일: `app/(employer)/my-postings/[id]/index.tsx`(ActionCard 1개) · `app/(employer)/my-postings/create.tsx`(`initialValues` 분기) · 신규 모듈캐시 1파일. `OrderSheetScreen`·`mappers.ts`·`draftAdapter.ts` 는 **무변경**(기존 함수 재사용).

런타임 파급:
- **대회 복제** → 새 공고는 `tournamentConfig = {approvalStatus:'pending', submittedAt: now}`(`JobPostingRepository.ts:718-720`)로 생성 → 관리자 승인 큐에 1건 증가, 완료 화면은 '승인 후 게시' 문구 분기(`create.tsx:168-170`).
- **venueId 승계** → `jobPostingToDraft`(`draftAdapter.ts:527`) → `draftToValues`(`mappers.ts:407`) → `valuesToCreateInput` → 새 공고가 원본과 같은 지점에 붙는다 → `useCreateJobPosting` 의 `queryKeys.workSchedule.all` 무효화(`useJobManagement.ts:135-137`)로 근무표 셀 뱃지가 갱신된다.
- **고정(fixed) 공고 복제** → `fixedConfig` 가 `buildFixedConfig(now)`(`serialization.ts:400-403`)로 새로 계산돼 만료일이 오늘부터 재시작. 의도대로다.

DB: 무영향. e2e: 복제 관련 testID 0건이라 신규 추가만.

### 기각한 경쟁 가설
**(A) '다른 경로로 이미 제공 중이라 미구현이 아니다'** — **부분 채택**(그래서 claimStatus=부분사실). edit 모드 '템플릿 저장' 우회로가 `OrderSheetScreen.tsx:933-946` + `edit.tsx:184` 로 실재함을 코드로 확인했다. 다만 4단계·역직관이라 '복제 기능이 있다'고 볼 수는 없다.

**(B) '의도적 제약 — 복제하면 지원자·확정자·통계가 딸려간다'** — 기각. `jobPostingToDraft`(`draftAdapter.ts:521-550`)가 만드는 `JobPostingDraft` 타입에는 id·status·stats·filledPositions·viewCount·ownerId·workspaceId 가 **애초에 없다**. 그리고 `createWithTransaction`(`JobPostingRepository.ts:713-731`)이 `id=generateUUID()`, `viewCount:0`, `filledPositions:0`, `stats=createInitialPostingStats(input.schedule)`, `status=STATUS.JOB_POSTING.ACTIVE`, `createdAt/updatedAt=now` 를 새로 만든다. 구조적으로 딸려갈 수 없다.

**(C) '복제 헬퍼가 이미 있으니 배선만 하면 된다 — `toCreateJobPostingInput`'** — 기각(**함정**). `src/domains/job-posting/serialization.ts:419-434` 에 존재하지만 소비처는 `mergeJobPostingInput`(수정 merge base) 하나뿐이고, `schedule: posting.schedule` 를 **pass-through** 한다(`:427`). 이걸 복제에 쓰면 지난달 날짜와 옛 slot/role uuid 가 그대로 실려 **과거 날짜로 공개 발행**된다. 복제는 반드시 draft→values 왕복을 타야 한다 — `toFormTimeSlots`(`mappers.ts:233-243`)가 id 를 벗기고 `toPostingTimeSlots`(`mappers.ts:59-61`)가 `generateId()` 로 재발급하기 때문이다.

**(D) '지난달 공고는 만료돼 목록에서 사라지니 복제 대상이 아예 없다'** — 기각. 만료는 `status='closed'`(`20260727000000_posting_auto_close_gaps.sql:332,379`)이고 `getMyJobPostings`(`jobService.ts:244-249`)가 closed 버킷을 포함한다. 상세 진입 가능.

**(E) '공유/QR 토큰을 지워야 해서 위험하다'** — 기각. 토큰이 **존재하지 않는다**. `job_postings` DDL(baseline:353-390)에 share/qr 컬럼이 없고, 공유는 `useShare` 가 `posting.id` 로 딥링크를 만든다. 비울 대상 자체가 없다.

**(F) '복제와 템플릿은 기능이 겹치니 하나만 있으면 된다'** — 기각. 4가지 근거: ① 수명이 다르다 — 공고는 확정자 없으면 삭제 가능(`[id]/index.tsx:690-720`)이라 지우는 순간 재사용 자산이 증발하지만 템플릿은 남는다. ② 진입 맥락이 다르다 — 복제는 '그 공고를 보고 있을 때', 템플릿은 '새로 쓰기 시작할 때'. ③ 템플릿만 남기면 현재의 4단계 우회가 유일한 길로 고착된다. ④ 복제만 남기면 캐러셀·create-success 저장 제안(`create-success.tsx:98-115`)·edit 템플릿 저장 3개 진입점이 죽는다. **결론: 복제는 템플릿의 대체가 아니라 템플릿 생성 비용을 0 으로 만드는 별도 진입점.** 중복감을 줄이려면 복제로 만든 공고의 완료 화면에서 기존 '프리셋으로 저장' 제안을 그대로 재사용하면 된다.

### 수정 설계
**1) 값 전달 — `src/utils/order-sheet/pendingDuplicate.ts` 신설**
`src/utils/order-sheet/lastSubmitted.ts` 와 **동형**으로 작성(모듈 레벨 변수 + getter/setter/clear, `export let` 직접 노출 금지 — 그 파일 8-9행 주석의 Metro/CommonJS live-binding 함정 계승). 담는 값은 `JobPostingDraft`(변환은 소비처에서 `draftToValues` 하나로 통일).
```ts
let pendingDuplicateDraft: JobPostingDraft | null = null;
export function setPendingDuplicateDraft(d: JobPostingDraft | null): void
export function getPendingDuplicateDraft(): JobPostingDraft | null
export function clearPendingDuplicateDraft(): void
```
라우트 파라미터로 넘기지 않는 이유: draft 가 크고(`lastSubmitted.ts:5-6` 과 동일 사유), 상세 화면이 이미 `useJobDetail` 로 완전한 posting 을 들고 있어 재조회가 불필요하다.

**2) 진입점 — `app/(employer)/my-postings/[id]/index.tsx`**
'공유 관리' ActionCard 다음(약 601-607행)에 추가:
```tsx
<ActionCard
  icon={<CopyIcon size={24} color={SECONDARY_PALETTE[500]} />}
  title="이 공고로 새로 만들기"
  description="같은 조건으로 새 공고를 씁니다. 날짜만 다시 고르면 돼요."
  onPress={handleDuplicate}
  testID="job-posting-duplicate"
/>
```
핸들러:
```ts
const handleDuplicate = useCallback(() => {
  if (!posting) return;
  try { setPendingDuplicateDraft(buildJobPostingDraft(posting)); }
  catch (error) {
    logger.error('공고 복제 하이드레이션 실패', toError(error), { jobPostingId: posting.id });
    showAlert('복제할 수 없어요', '이 공고는 형식이 달라 복제할 수 없습니다. 새 공고로 작성해주세요.');
    return;
  }
  router.push('/(employer)/my-postings/create');
}, [posting, router]);
```
`!isFixed` 게이트는 **걸지 않는다** — `draftToValues` 가 fixed 를 S2 이후 정상 복원한다(`mappers.ts:257-315`, `create.tsx:117` 주석). `CopyIcon` 이 `@/components/icons` 에 없으면 배럴에 Lucide `Copy` 를 추가(직접 import 는 ESLint 차단).

**3) 소비 — `app/(employer)/my-postings/create.tsx`**
`create-success.tsx:43-47` 의 snapshot-and-clear 패턴을 그대로:
```ts
const [duplicateDraft] = useState(() => {
  const d = getPendingDuplicateDraft();
  clearPendingDuplicateDraft();
  return d;
});
```
기존 `initialValues` useMemo(`:70-76`)를 확장:
```ts
const initialValues = useMemo<OrderSheetFormValues>(() => {
  if (duplicateDraft) {
    try {
      const v = draftToValues(duplicateDraft);
      return {
        ...v,
        // 복제는 날짜를 계승하지 않는다 — 'last' 프리셋(:113)·templateToValues(mappers:416)와 동일 규칙
        scheduleGroups: (v.scheduleGroups ?? []).map((g) => ({ ...g, dates: [] })),
        contactPhone: v.contactPhone || (profile?.phone ?? ''),
      };
    } catch (error) {
      logger.error('공고 복제 복원 실패', toError(error));
    }
  }
  return { ...gridParamsToValues({ venueId, date: prefillDate, count: prefillCount }), contactPhone: profile?.phone ?? '' };
}, [duplicateDraft, venueId, prefillDate, prefillCount, profile?.phone]);
```
마운트 1회 안내 토스트(`edit.tsx:57-65` 의 `notifiedRef` 가드 패턴): `'{제목} 구성을 가져왔어요. 날짜를 골라주세요.'`

**4) 비워야 할 필드 — 전수 판정(주석으로 코드에 고정할 것)**
- **손으로 비운다(1개)**: `scheduleGroups[].dates`. 이것만이 유일하게 클라가 책임진다. 안 비우면 지난달 날짜로 공개 발행된다.
- **왕복이 자동으로 벗긴다**: `timeSlots[].id`·`roles[].id`(`toFormTimeSlots` mappers:233-243 이 제거 → `toPostingTimeSlots` mappers:59-61 이 `generateId()` 재발급), `roles[].filled`(draftAdapter:513 주석 — SP3 dead counter 미복사).
- **draft 타입에 애초에 없다**: id·status·ownerId·ownerName·workspaceId·workDate/workDates·lastWorkDate·roleKeys·totalPositions·filledPositions·viewCount·stats·closedAt·closedReason·rejectionReason·createdAt·updatedAt·schemaVersion·ogImageUrl·ogImageUrlBlurhash·fixedConfig·tournamentConfig·urgentConfig (`draftAdapter.ts:521-550` 반환 객체 전수 확인).
- **서버가 새로 만든다**: `JobPostingRepository.createWithTransaction:713-731` — id=신규 UUID, status=ACTIVE, viewCount=0, filledPositions=0, stats=초기값, createdAt/updatedAt=now, tournament=`{pending, submittedAt:now}`, fixed=`buildFixedConfig(now)`.
- **존재하지 않아 비울 것이 없다**: 공유 토큰·QR 토큰(테이블에 컬럼 없음, 공유는 posting.id 딥링크).
- **계승하되 재확인 필요**: `venueId`(원본 지점 승계 — risk 참조), `title`(**'(사본)' 접미를 붙이지 말 것 권장** — 제목 상한 `MAX_POSTING_TITLE_LENGTH` 에 걸릴 수 있고, 어차피 사장이 시트에서 고친다).
- **조용히 유실되는 것 1개(수용)**: `timeSlots[].tentativeDescription` — `toFormTimeSlots`(mappers:233-243)가 복원하지 않는다. 'last' 프리셋·템플릿 경로도 동일하게 잃고 있어 신규 회귀는 아니다.

**5) 테스트**
- `app/(employer)/my-postings/__tests__/CreateJobPostingScreen.duplicate.test.tsx` 신규: 모듈 캐시에 draft 를 넣고 마운트 → 제목·역할·급여·모집조건 복원 + **날짜 0개** 단언 / 캐시가 비었을 때 기존 빈 폼 무회귀.
- `app/(employer)/my-postings/[id]/__tests__/` 에 ActionCard 탭 → `setPendingDuplicateDraft` 호출 + `router.push('/(employer)/my-postings/create')` 단언.
- `src/utils/order-sheet/__tests__/pendingDuplicate.test.ts`: set→get→clear 1회성 계약.

### 리스크
**① 모듈 캐시는 딥링크·리로드에 비어 있다.** create 화면을 URL 직접 진입하면 `getPendingDuplicateDraft()` 가 null → 일반 생성으로 조용히 폴백한다. 이건 안전한 실패지만, '복제를 눌렀는데 빈 폼'이 되는 경로가 하나 생긴다(웹에서 새로고침). 완화: 상세에서 `router.push` 직전에만 세팅하므로 실사용 경로에서는 항상 채워진다. 필요하면 후속으로 `?duplicateFrom=<id>` 파라미터 + `useJobDetail` 폴백을 얹을 수 있다(그땐 edit.tsx:128-143 식 로딩 게이트 필요).

**② venueId 승계가 조용한 오배치를 만들 수 있다.** 다중 지점 사장이 A 지점 공고를 복제해 B 지점에 내려는 경우, 칩(`VenueSelectChips`)에서 B 를 고르지 않으면 `applySelectedVenue`(`src/utils/order-sheet/venueSelection.ts:34-37`)가 원본 `venueId` 를 그대로 통과시켜 A 지점 근무표에 붙는다. 게다가 `shouldShowVenueChips(venues.length, routeVenueId)` 는 **폼 값이 아니라 라우트 파라미터**를 본다(`:18`)므로 복제 진입 시 칩이 뜨긴 하지만 **아무것도 선택되지 않은 상태**로 보인다 — 사장은 '지점을 안 골랐다'고 오해할 수 있다. 완화안: 복제 진입 시 `selectedVenueId` 초기값을 `duplicateDraft.venueId` 로 채워 칩이 원본 지점을 선택 상태로 보여주게 할 것.

**③ 대회 복제는 승인 큐를 늘린다.** 복제본은 `pending` 으로 생성돼 관리자 승인이 필요하다. 사장 기대('바로 게시')와 어긋날 수 있으나 신규 대회 생성과 동일한 규칙이므로 문구(`create.tsx:168-170` 기존 분기)로 충분히 전달된다.

**④ 확정자가 있는 원본을 복제해도 안전하다** — 위 rejectedHypotheses (B) 근거. 다만 사장이 '지원자도 딸려온다'고 오해하지 않도록 ActionCard description 에 '지원자·확정 인원은 복사되지 않아요'를 넣을지 검토.

**깨지지 않는다고 판단한 것**: `OrderSheetScreen`·`mappers.ts`·`draftAdapter.ts`·`serialization.ts` 무변경. `create.tsx` 의 그리드 프리필 경로(venueId/date/count 파라미터)는 `duplicateDraft === null` 일 때 기존 식이 그대로 실행돼 무회귀(위 3)의 return 문 확인).

### 선행 의존성
없음(마이그레이션·RPC·RLS 무변경). 단 **파일 충돌 주의** — `app/(employer)/my-postings/create.tsx` 를 G1 과 공유한다(G2 는 `initialValues` useMemo `:70-76`, G1 은 상태·렌더 하단). 같은 PR 로 묶거나 G2 를 먼저 넣고 G1 을 리베이스할 것. `CopyIcon` 이 `@/components/icons` 배럴에 없다면 아이콘 추가가 선행된다(Lucide 직접 import 는 ESLint 차단).

### 🔍 검증 — 놓친 제약
① [사실 오류] "JobPostingCard 가 app/(admin)/postings/index.tsx 에서도 렌더된다(grep 실측)"는 거짓 — 그 파일의 히트는 `import type { JobPostingCard } from '@/types'`(:32) 동명 타입이고 `<JobPostingCard` 렌더 0건. 컴포넌트 렌더 소비처는 employer.tsx(:478) 하나뿐(+테스트). 이 레포의 SettlementCard 오판과 동일 유형(이름 닮은 grep 히트를 렌더 소비처로 오독). '상세에 둘 것' 결론 자체는 UX 근거로 여전히 타당하나 근거 문장은 교체 필요. ② venueId 조용한 오배치는 실측으로 리스크 승격 — applySelectedVenue(:30-38)는 미선택 시 input 을 그대로 통과시키고 draftToValues(:407)→valuesToDraft(:161) 경유로 원본 venueId 가 살아서 실린다. shouldShowVenueChips(:15-19)는 라우트 파라미터만 보므로 칩은 뜨되 미선택 상태 — risk ②의 완화안(selectedVenueId 초기값 채우기)은 선택이 아니라 본설계 필수. 단 venues 목록에 원본 venueId 가 없을 수 있어(지점 삭제) 존재 검증 후 채울 것. ③ CopyIcon 은 이미 배럴에 있다(src/components/icons/index.tsx:185) — 선행 항목 소멸. ④ 복제 생성은 기존 useCreateJobPosting 단일 경로 재사용이라 RPC/RLS 신규 표면 0 — 재확인. 단 workspaceId 는 복제자의 activeWorkspace 로 붙으므로(useJobManagement) 협업자가 남의 공고 상세에서 복제하면 자기 워크스페이스 소유 신규 공고가 된다 — 의미상 허용 가능하나 인지할 것. ⑤ e2e 복제 testID 0건 실측 — 신규 추가만, quality 사각지대 비해당. ⑥ 인용 경로 `edit.tsx` 는 실제 `[id]/edit.tsx`.

### 🔧 검증 — 설계 보정
설계 골격(모듈캐시 동형·날짜만 손으로 비움·왕복 id 재발급·서버 신규 생성 필드 전수표)은 전 항목 실측 일치라 그대로 쓴다. 보정 3건: (1) 파급 문단의 admin 렌더 주장 삭제, 상세 배치 근거를 '복제는 그 공고를 보고 있을 때의 행동 + employer 전용 라우트'로 교체. (2) risk ② 완화안을 본설계로 승격 — 복제 진입 시 `setSelectedVenueId(venues.some(v=>v.id===duplicateDraft.venueId) ? duplicateDraft.venueId : undefined)` 로 칩 선택 상태를 원본과 동기화(존재 검증 포함), 이 동작의 테스트 1건 추가. (3) 선행 문단에서 CopyIcon 추가 항목 제거. 부가: 확정자 오해 방지용 description 문구('지원자·확정 인원은 복사되지 않아요')는 넣는 쪽을 권장 — 기각가설 B 가 구조적으로 보장하므로 문구만으로 충분.

### 검증 메모
핵심 주장(진입점 0·마지막 공고 1건·4단계 우회로 실재·closed 잔존·기각가설 B/C/F 근거 라인)은 전부 실측 재현. toCreateJobPostingInput 함정(schedule pass-through)·createWithTransaction 신규 생성 필드도 코드로 확인. 그러나 파급 판단 1건(admin 렌더)이 타입/컴포넌트 동명 오독으로 거짓이라 PARTIAL. 난이도 S 는 낙관 — 신규 유틸 1+상세 1+create 1+테스트 3(+venue 동기화 테스트)=6파일로 HARD-GATE(3+ 파일 설계 선행) 대상이고 venue 완화까지 본설계에 들어오므로 M 이 정직하다. G1 과 create.tsx 충돌 경고는 타당(G2 선행 후 G1 리베이스 권장).

### 🙋 사람이 결정할 것
① **복제 시 지점(venueId)을 계승할 것인가, 매번 다시 고르게 할 것인가.** 계승(권장)이면 위 risk ②의 칩 초기값 채우기가 함께 필요하다. 비우면 다중 지점 사장이 매번 고르는 대신 오배치가 사라진다.
② **제목에 '(사본)' 을 붙일 것인가.** 붙이면 목록에서 구분이 쉽지만 상한 초과 위험과 '고쳐야 할 문자열'이 하나 늘어난다. 안 붙이면 같은 제목의 공고가 둘이 되어 지원자 혼동 가능.
③ **복제 진입점을 상세에만 둘 것인가, 목록 카드에도 둘 것인가.** 카드에 두면 `app/(admin)/postings/index.tsx` 까지 번지므로(blastRadius 참조) 카드에 두려면 `JobPostingCard` 에 employer 전용 플래그 prop 을 신설해야 한다 — 그만한 값이 있는지 판단 필요.
