# 죽은 회로 정리 — 원래 의도 추적 · 코드 흐름 · 제거/완성 판정 (2026-08-02)

> 지시: "필요없는 건 삭제하고 원래 의도를 파악하고 실제 코드 흐름도 분석" — 기본값을 **제거**로 두고, '완성'은 타깃 사용자 근거가 있을 때만.
> 방법: 6묶음 병렬 추적(opus/xhigh — git log/blame·설계문서로 도입 의도 → 끊긴 커밋 특정 → 살아있는 흐름 도식 → 죽은 심볼 열거 → 판정 → 삭제 목록) → 묶음별 삭제 안전성 검증(fable/xhigh — DB저장 문자열·EF·e2e·배럴·딥링크 파서·동적 키 재수색).
> 기준 커밋 `75d4b3fe4`. 이 문서 작성 시점 코드 변경 0건.


**판정 집계: 제거 15 · 완성 9 · 유지 6 — 총 30건**


| ID | 대상 | 판정 | 죽음 재판정 | 심사 |
|---|---|---|---|---|
| `A1` | uniqn-mobile/src/stores/bookmarkStore.ts (전체 189줄)  | **제거** | 확인 | 동의 |
| `A2` | uniqn-mobile/src/hooks/useBookmarks.ts:109,124,143,149 — tra | **제거** | 확인 | 동의 |
| `A3` | MMKV 키 `bookmark-storage` (bookmarkStore.ts:132 에서 명명) — 이미  | **유지** | 확인 | 동의 |
| `B-1` | uniqn-mobile/src/services/admin/reportService.ts:105-113 get | **제거** | 확인 | 조건부 |
| `B-2` | (스코프 밖 추가 발견) uniqn-mobile/src/services/admin/reportService. | **제거** | 확인 | 동의 |
| `B-3` | uniqn-mobile/src/types/notification.ts:94(값) | **완성** | 확인 | 동의 |
| `B-4` | uniqn-mobile/src/types/report.ts:281-282 Report.evidenceUrls | **제거** | 확인 | 동의 |
| `B-5` | uniqn-mobile/src/types/report.ts:206 ReportStatus  | **유지** | 살아있음 | 동의 |
| `C1` | uniqn-mobile/src/types/notification.ts:368-373 (Notification | **제거** | 확인 | 동의 |
| `C2` | uniqn-mobile/src/types/notification.ts:61-62 (선언)  | **제거** | 확인 | 동의 |
| `C3` | uniqn-mobile/supabase/migrations/20260727000000_posting_auto | **완성** | 확인 | 동의 |
| `D1` | uniqn-mobile/src/hooks/useNotifications.ts:334-385 `useDelet | **완성** | 일부생존 | 동의 |
| `D2` | uniqn-mobile/src/hooks/useNotifications.ts:394-442 `useDelet | **완성** | 일부생존 | 동의 |
| `D3` | uniqn-mobile/src/hooks/useNotifications.ts:253-282 `useMarkA | **유지** | 살아있음 | 동의 |
| `D4` | uniqn-mobile/src/services/offline/remoteMutationGuard.ts:43- | **유지** | 살아있음 | 동의 |
| `D5` | uniqn-mobile/src/stores/notificationStore.ts — `removeNotifi | **유지** | 살아있음 | 동의 |
| `D6` | uniqn-mobile/src/stores/notificationStore.ts 의 소비처 0 공개 표면 — | **제거** | 확인 | 동의 |
| `D7` | uniqn-mobile/src/hooks/useNotifications.ts:197-216 `fetchNex | **완성** | 일부생존 | 동의 |
| `D8` | 이중 소스 구조 자체 — uniqn-mobile/src/hooks/useNotifications.ts:152 | **완성** | 살아있음 | 동의 |
| `E1` | uniqn-mobile/app/(app)/profile-setup.tsx:84-86 handleBack  | **완성** | 살아있음 | 동의 |
| `E2` | src/components/jobs/ApplicationForm.tsx:116 errorQuestionIds | **제거** | 확인 | 동의 |
| `E3` | src/hooks/useBiometricAuth.ts:184-189 setEnabled 내 autoLogin | **유지** | 살아있음 | 동의 |
| `E4` | src/services/auth/loginAttemptService.ts:98-111 getRemaining | **완성** | 확인 | 동의 |
| `F1-a` | src/hooks/useTemplateManager.ts:85-105 useLoadTemplate  | **제거** | 확인 | 동의 |
| `F1-b` | src/hooks/useTemplateManager.ts:31 UNDO_DELAY_MS  | **완성** | 확인 | 동의 |
| `F2` | src/lib/queryClient.ts:531 queryKeys.reviews.bubbleScore  | **제거** | 확인 | 동의 |
| `F3-a` | src/lib/queryClient.ts — :214 user.current  | **제거** | 확인 | 동의 |
| `F3-b` | src/lib/queryClient.ts:724-772 invalidateQueries 객체의 죽은 멤버 1 | **제거** | 확인 | 동의 |
| `F3-c` | src/shared/id/IdNormalizer.ts:96-114 normalizeUserId  | **제거** | 확인 | 동의 |
| `F3-d` | src/utils/job-posting/dateUtils.ts:15-30 하위호환 재수출 블록 11종(gro | **제거** | 일부생존 | 조건부 |


---

# A-북마크


## `A1` — 판정: **제거**

**대상 심볼**

uniqn-mobile/src/stores/bookmarkStore.ts (전체 189줄) · uniqn-mobile/src/hooks/useBookmarks.ts (전체 177줄) · uniqn-mobile/src/components/jobs/JobCard.tsx:3,6,8,36,38,48-63,104-133,160 (하트 UI) · uniqn-mobile/src/stores/index.ts:61-72 (배럴) · uniqn-mobile/src/hooks/index.ts:79 (배럴) · uniqn-mobile/src/stores/__tests__/bookmarkStore.test.ts (366줄/26테스트) · uniqn-mobile/src/components/jobs/__tests__/JobCard.test.tsx:10-18,202,309-368

### 원래 의도 (왜 만들었나)
도입 커밋 `98764f049` (2026-01-26, `feat(mobile): 사용자 편의 기능 추가`, Co-Authored-By Claude Opus 4.5) — 35파일 2921줄 벌크 커밋의 한 항목이다. 커밋 본문 첫 줄이 "북마크: JobCard 북마크 기능, bookmarkStore, useBookmarks 훅"으로, 생체인증·공유·캐시·자동로그인과 함께 한 번에 투하됐다. **제품 근거는 근거 없음** — 이 기능을 왜 만드는지 설명한 설계문서·스펙·결정문은 없다. `docs/superpowers/specs/` 는 존재하지 않고, `docs/decisions/` 도 없다. 유일한 사전 언급은 `docs/archive/firebase-legacy/2026-04/06-firebase.md:442,826,2095` 인데 이건 도입 **이후** 작성된 아카이브 문서의 현황 나열("bookmarkStore | 북마크 저장/삭제 | MMKV")이지 설계 근거가 아니다. 저자 의도의 유일한 1차 증거는 `useBookmarks.ts:7` 의 `@todo 북마크 목록 화면 구현 필요 (프로필 탭 또는 설정에서 "내 북마크" 페이지 추가)` 한 줄뿐이다. 즉 "목록 화면을 만들 생각이었다"는 것만 알 수 있고, **왜 이 도메인에 북마크가 필요한지는 아무도 쓴 적이 없다.**

### 흐름이 끊긴 시점
끊긴 게 아니라 **애초에 안 이어졌다**. `git log --all -S"bookmark" -- uniqn-mobile/app` 이 0 커밋 — 화면이 있다가 지워진 잔해가 아니다(대소문자 무시 pickaxe 로도 동일, 선행 감사 `docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:95` 에서 재검증됨). 도입 커밋 `98764f049` 시점에 이미 스토어·훅·아이콘·토스트·퍼널·테스트 26개까지 전부 깔렸고 **마지막 한 칸(목록 화면 + 진입점)만 비어 있었다**. 그 상태로 6개월 이상(2026-01-26 → 2026-08-02) 방치됐다. 그 사이 `docs/analysis/2026-07-27-posting-domain-audit.md:575` 가 STAFF-6 으로 한 번 잡아냈으나 "신규 기능이라 결함 목록과 분리"(:353) 되어 백로그 M8/M11 로 밀렸고, 아무도 착수하지 않았다.

### 지금 살아 있는 코드 흐름
공고 카드 하트 탭 → JobCard.tsx:57 handleBookmarkClick → JobCard.tsx:48 handleBookmarkPress → useBookmarks.ts:132 toggleBookmark → bookmarkStore.ts:109 toggleBookmark → bookmarkStore.ts:73 addBookmark → zustand persist(bookmarkStore.ts:131-136, name:'bookmark-storage', createJSONStorage(() => mmkvStorage)) → 기기 로컬 MMKV 에 {id,title,location,workDate,bookmarkedAt} 스냅샷 적재. 동시에 useBookmarks.ts:145-149 가 addToast('북마크에 추가되었습니다') + trackEvent('bookmark_added'). 렌더 소비처는 JobCard.tsx:36 `const { isBookmarked, toggleBookmark } = useBookmarks()` → :38 `bookmarked` → :104-133 bookmarkButton(HeartFilledIcon/HeartOutlineIcon) 단 하나. JobCard 자체의 렌더 경로는 JobList.tsx:7,54 → 구직자 공고 목록. **이 배열을 읽는 코드는 같은 카드의 isBookmarked(하트 채움) 하나뿐이라 회로가 자기 자신으로 닫힌다** — 쓰기만 있고 바깥으로 나가는 읽기가 0이다.

### 죽은 부분
훅이 반환하는 8개 API(useBookmarks.ts:166-175) 중 **6개가 소비처 0**이다. Grep 도구로 레포 전수 확인: (1) `bookmarks` — JobCard 미사용, 소비처 0. (2) `bookmarkCount` — 소비처 0. (3) `recentBookmarks`(useBookmarks.ts:84-87, 최근 10개 정렬 메모) — 소비처 0. (4) `addBookmark`(:102-112) — 소비처 0(UI 유일 경로는 toggleBookmark). (5) `removeBookmark`(:117-127) — 소비처 0. (6) `clearBookmarks`(:158-164) — 소비처 0. 살아 있는 건 `isBookmarked`·`toggleBookmark` 2개뿐(JobCard.tsx:36). 스토어 쪽도 대응해서 죽는다: `selectBookmarks`·`selectBookmarkCount`·`selectAddBookmark`·`selectRemoveBookmark`·`selectClearAllBookmarks`(bookmarkStore.ts:154,159,174,179,184)는 useBookmarks 를 거쳐서만 소비되므로 훅이 죽으면 전부 죽는다. `clearAllBookmarks`(:122-125)는 bookmarkStore.test.ts:33 의 테스트 리셋 용도로만 실행된다. `_hasHydrated`/`setHasHydrated`(:34,127-129)는 **어떤 화면도 읽지 않는다** — 하이드레이션 게이트가 소비될 목록 화면이 없기 때문이다. `MAX_BOOKMARKS=100` 무음 축출(:83-92)은 logger.warn 만 남기고 사용자에게 아무것도 알리지 않는데, 목록 화면이 없어 **무엇이 사라졌는지 확인할 방법 자체가 원리적으로 없다**.

### 판정 근거
**제품 관점 — 이 도메인에 북마크는 맞지 않는다.** 타깃은 홀덤펍 사장의 상시 단발 알바(오늘·내일 자리)와 대회사 D-7~D-day 집중 인력이다. 북마크의 가치는 "지금 담아 두고 나중에 행동한다"인데, 단발 공고는 그 "나중"이 오기 전에 마감·충원된다. 저장 목록은 빠르게 죽은 공고의 무덤이 된다. 코드가 이걸 증명한다 — 저장 스냅샷(bookmarkStore.ts:17-28)에 **status 가 없어서** 목록을 열어도 아직 열려 있는지 알 수 없고, RLS(`job_postings_select_all`·`jp_select_public_search`)가 cancelled 를 숨기므로 취소 공고는 재조회에서 **그냥 사라진다**. 즉 완성해도 사용자가 보는 건 "내가 담은 것 중 일부가 이유 없이 없어진 목록"이다. 이 도메인에서 지속 의도를 표현하는 올바른 원시형은 저장이 아니라 **즉시 지원**(공고가 짧으므로)이거나 **조건 알림/필터 저장**이며, 후자의 인프라는 이미 있다(`jobFilterStore.ts`, `notificationStore.ts`, `usePushNotificationSetup.ts`). 북마크는 그 사이에서 아무 자리도 차지하지 못한다. **기대 불일치** — MMKV 기기 로컬(bookmarkStore.ts:133)이라 기기 교체·앱 재설치·웹↔앱 사이에 승계되지 않는다. '저장한 공고'라는 라벨이 약속하는 것과 정면으로 어긋난다. **수요 증거가 0이다** — 유일하게 완성 쪽을 지지하던 논거인 퍼널 계측이 실제로는 아무 데도 안 간다(A2 참조). 6개월간 아무도 이 기능을 쓰는지 측정한 적이 없고 측정할 수도 없었다. **비용** — 완성하려면 신규 화면 + 신규 훅 + 진입점 + `_hasHydrated` 게이트 + 무음 축출 고지 + 누락 id 처리 + Undo 토스트로 4~5파일 M난이도, 게다가 "로컬이냐 서버 승격이냐"라는 미결 제품 결정이 남아 승격 시 마이그레이션·RLS·기존 로컬 데이터 이관까지 뒤따른다. **지금 사용자를 속이고 있다** — 하트를 누르면 '북마크에 추가되었습니다' 토스트가 뜨는데 갈 곳이 없다. 선행 감사도 같은 결론을 적었다: "그때까지는 하트 버튼을 숨기는 편이 사용자를 덜 속인다"(`docs/analysis/2026-08-02-employer-seeker-ux-friction-audit.md:393`). 거짓말하는 어포던스를 없애는 것은 기능 상실이 아니라 UX 개선이다. 사용자 지시가 '필요 없는 건 지운다'이므로 하트 UI까지 함께 제거한다.

### 삭제 목록·순서
【1단계 — 소비처 먼저 끊기】 `uniqn-mobile/src/components/jobs/JobCard.tsx`: :3 `import { STATUS_COLORS } from '@/constants/colors';` 줄 삭제(JobCard 내 STATUS_COLORS 사용처는 :114,:128 하트 색뿐임을 Grep 확인). :6 을 `import { ShareIcon } from '@/components/icons';` 로 축소(HeartFilledIcon·HeartOutlineIcon 만 제거 — **아이콘 정의 자체는 삭제 금지**, 아래 breakage 참조). :8 `import { useBookmarks } from '@/hooks/useBookmarks';` 삭제. :36 `const { isBookmarked, toggleBookmark } = useBookmarks();` 삭제. :38 `const bookmarked = isBookmarked(job.id);` 삭제. :48-55 `handleBookmarkPress` 전체 삭제. :57-63 `handleBookmarkClick` 전체 삭제. :104-133 `const bookmarkButton = ...` 전체 삭제. :160 `{bookmarkButton}` 삭제 — :158-161 래퍼가 `<View className="flex-row items-center gap-1">{shareButton}</View>` 로 자식 1개만 남으므로 래퍼 View 를 걷어내고 `{shareButton}` 만 두는 편이 깔끔하다(선택). `useCallback`·`GestureResponderEvent`(:1-2)는 handleSharePress 가 계속 쓰므로 **유지**.
【2단계 — 테스트 정리】 `uniqn-mobile/src/components/jobs/__tests__/JobCard.test.tsx`: :10-11 `mockToggleBookmark`·`mockIsBookmarked` 선언 삭제, :13-18 `jest.mock('@/hooks/useBookmarks', ...)` 블록 삭제, :202 beforeEach 안 `mockIsBookmarked.mockReturnValue(false);` 삭제, :309-368 `it('keeps the canonical workDate when bookmarking a focused grouped card')` 테스트 전체 삭제(하트 버튼이 사라지면 :358 `getAllByRole('button')[1]` 이 undefined 가 되어 반드시 깨진다).
【3단계 — 배럴 export 제거】 `uniqn-mobile/src/hooks/index.ts:79` 한 줄 삭제: `export { useBookmarks, type BookmarkJobParams, type UseBookmarksReturn } from './useBookmarks';`. `uniqn-mobile/src/stores/index.ts:61-72` 블록 삭제: `// Bookmark Store` 주석 + `export { useBookmarkStore, selectBookmarkCount, selectBookmarks, selectIsBookmarked, selectToggleBookmark, selectAddBookmark, selectRemoveBookmark, selectClearAllBookmarks } from './bookmarkStore';` + `export type { BookmarkedJob } from './bookmarkStore';`.
【4단계 — 파일 삭제】 `uniqn-mobile/src/hooks/useBookmarks.ts` 전체(177줄, `BookmarkJobParams`·`UseBookmarksReturn` 타입 포함). `uniqn-mobile/src/stores/bookmarkStore.ts` 전체(189줄, `BookmarkedJob`·`BookmarkState`·`BookmarkActions`·`BookmarkStore` 타입, `MAX_BOOKMARKS` 상수, selector 7종 포함). `uniqn-mobile/src/stores/__tests__/bookmarkStore.test.ts` 전체(366줄/26테스트).
【삭제 순서 엄수】 1→2→검증(`npx jest src/components/jobs/__tests__/JobCard.test.tsx`)→3→4→검증(`npx tsc --noEmit`)→`npm run quality`. 배럴을 먼저 지우면 tsc 가 JobCard 미정리분을 가려버리므로 **반드시 소비처(JobCard)를 먼저** 끊는다.
【삭제 대상 아님 — 명시적 제외】 쿼리키 0건(TanStack 미사용 회로), 마이그레이션 0건, 상수 파일 0건.

### 깨지는 것
**깨지는 것(실측)**: 테스트 42개가 현재 통과한다(방금 실행: `npx jest src/stores/__tests__/bookmarkStore.test.ts src/components/jobs/__tests__/JobCard.test.tsx` → `Test Suites: 2 passed, Tests: 42 passed`). 이 중 27개가 직접 영향 — bookmarkStore.test.ts 26개(파일째 삭제) + JobCard.test.tsx 의 `keeps the canonical workDate when bookmarking a focused grouped card` 1개(:309-368, 삭제). 나머지 JobCard 테스트 15개는 mock 제거만으로 통과해야 한다. ⚠️ 삭제되는 그 1개 테스트는 "focused grouped card 에서 canonical workDate 를 유지한다"는 도메인 불변식을 검증하는데, 북마크가 그 불변식의 **유일한 관찰 창**이었다 — 회로가 사라지면 감시 대상도 함께 사라지므로 대체 테스트는 불필요하다(`shareJobById` 는 id 만 넘기므로 workDate 무관, JobCard.tsx:66-72 확인).
**배럴 re-export 2곳**: `src/hooks/index.ts:79`, `src/stores/index.ts:61-72`. 둘 다 이 회로 외 소비처 0.
**타입**: `BookmarkedJob`·`BookmarkJobParams`·`UseBookmarksReturn` — 외부 소비처 0(Grep 전수 확인).
**깨지지 않는 것(확인 완료)**: DB·마이그레이션 0건(`supabase/migrations/` 전체에서 bookmark|saved_posting|favorite 0건, 테이블·RPC·컬럼 없음). `e2e/` 0건(Grep 도구 확인 — CLAUDE.md 가 경고하는 quality 사각지대인데 여기엔 히트가 없다). Edge Function(`supabase/functions/`) 0건. 딥링크 URL 파서 0건. 알림 type·link 문자열 0건. `app/` 트리 히트는 `app/(employer)/my-postings/create-success.tsx:14,101` 의 `BookmarkOutlineIcon` **장식용 1건뿐이며 기능 무관**(⚠️ Bash grep 이 이 검색에서 조용히 0건을 냈다 — 알려진 레포 함정. Grep 도구로 교차확인함).
🚨 **삭제 금지 — 아이콘 정의**: `src/components/icons/index.tsx:276-277,313` 의 `HeartIcon`·`HeartFilledIcon`·`HeartOutlineIcon`(=HeartIcon 별칭)은 **게시판 좋아요가 쓴다** — `src/components/board/BoardPostCard.tsx:6,77`, `src/features/board/postDetail/PostHeader.tsx:4,125`. 아이콘 스냅샷 테스트 3건(`icons/__tests__/index.test.tsx:81-88,122,127` + `.snap:7313,7403,7483`)도 있다. JobCard 의 import 만 걷어내고 **icons/index.tsx 는 절대 손대지 말 것**. 같은 이유로 `BookmarkOutlineIcon`/`BookmarkFilledIcon`/`BookmarkIcon`(icons/index.tsx:279-284)도 유지 — 이름만 닮았을 뿐 북마크 회로와 무관하고 create-success 화면이 쓴다.
⚠️ **knip 주의**: 이 회로 제거 후 knip 이 Heart/Bookmark 아이콘류를 미사용으로 올릴 수 있으나 위 실사용처가 있으므로 **knip 결과만으로 추가 삭제 금지**(레포 이력상 knip false positive 상습). 래칫 수치도 27개 테스트 삭제로 움직인다.

### 검증 명령
```
npx jest src/components/jobs/__tests__/JobCard.test.tsx  (가장 좁은 검증 — 하트 제거 후 나머지 15테스트 green 확인) → npx tsc --noEmit  (배럴·타입 잔존 참조 전수 적발) → npm run quality  (최종)
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음. 레포 전체 rg -il bookmark(docs·snap 제외) 11개 파일이 조사 목록과 완전 일치 — 숨은 소비처 0을 이 세션에서 재실측했다. ① DB 저장 문자열: supabase/ 전체(마이그+EF) 0건, 알림 type·link·app_config 에 bookmark 계열 없음 ② Edge Function 0건 ③ e2e/ 0건 ④ 배럴 체인: @/hooks:79·@/stores:61-72 두 곳뿐이고 배럴 경유 소비처도 JobCard·테스트 2개가 전부(selector 7종 전수 grep) ⑤ 딥링크 파서 0건 ⑥ 테스트 픽스처·목: jest.setup.js 0건, src/__tests__/mocks/ 0건, JobCard.test.tsx 의 목이 유일 ⑦ 동적 키 접근: 'bookmark' 포함 문자열 리터럴이 위 파일들 밖에 존재하지 않음. Cloudflare functions/ 0건, wiki·scripts 0건. create-success.tsx 의 BookmarkOutlineIcon 은 :101 프리셋 안내 장식용으로 기능 무관 확인. 단서: 하트 UI 자체는 동작하는 살아있는 코드다 — '죽었다'의 정확한 의미는 '자기폐회로(쓰기만 있고 바깥으로 나가는 읽기 0)'이며 이는 조사가 이미 명시했고 실측으로 재확인됨. 훅 API 8개 중 6개·selector 5종·_hasHydrated 는 문자 그대로 소비처 0.

### ⚖️ 검증 — 판정 심사 (동의)
사용자 가시 UI(하트) 제거라 엄격 심사했으나 제거가 맞다. 근거 실측: 토스트가 약속하는 '북마크 목록'으로 가는 화면·진입점이 앱 어디에도 없고(app/ 트리 0건), 스냅샷에 status 부재·MMKV 기기 로컬이라 완성해도 기대 불일치가 남으며, 선행 감사 2건이 이미 '하트 숨김이 사용자를 덜 속인다'고 권고했다. 완성론의 유일 논거였던 퍼널 계측은 A2 실측으로 기각됐다. 조건 아닌 권고 2건: (1) 릴리즈 노트/CHANGELOG 에 하트 제거를 한 줄 명시 — 기존에 하트를 눌러온 사용자에겐 상태가 조용히 사라지는 것으로 보이므로 회귀 문의 대비 (2) 커밋 메시지에 '기능 상실이 아니라 기만적 어포던스 제거'임을 남겨 후속 세션의 복원 시도를 막을 것.

### 🛡️ 검증 — 삭제 안전성
삭제 목록 안전 — 전 항목 줄번호를 파일 직접 Read 로 대조해 일치 확인. 특히 정확했던 부분: STATUS_COLORS 는 JobCard 내 :114/:128 하트 색 전용이라 import 제거 안전(:3), HIT_SLOP(:96)·Platform(:82)·GestureResponderEvent(:67)·useCallback 은 shareButton 이 계속 소비하므로 유지 지시 정확. 아이콘 삭제 금지 지시도 정확 — HeartIcon 은 BoardPostCard.tsx:6,77·PostHeader.tsx:4,125 실사용, HeartFilledIcon/HeartOutlineIcon 은 제거 후 앱 소비처 0 이 되지만 아이콘 스냅샷 테스트 3건이 소비하므로 icons/index.tsx 불가침이 맞다(knip 이 올려도 삭제 금지 — false positive 상습 이력과 일치, knip 설정에 bookmark 항목 0건도 확인). JobCard.test.tsx 에서 role 쿼리(getAllByRole)는 삭제 대상 :309-368 테스트뿐이라 남는 15개는 mock 제거만으로 통과 구조. 현재 42개 green 을 이 세션에서 재실행으로 확인(2 suites, 42 passed). 삭제 순서(소비처→테스트→배럴→파일, 단계별 검증)도 타당 — 배럴 선삭제 시 tsc 가림 지적이 정확하다. 빠뜨린 것 없음. 보완 권고 1건: 4단계 후 검증에 npx jest src/components/icons 를 추가해 아이콘 스냅샷 무변경(icons/index.tsx 불건드림)의 기계 증거를 남길 것. mmkv 의존성 걱정 불요 — mmkvStorage 소비처 19개 잔존 + knip ignoreDependencies 에 react-native-mmkv 등록됨.

### 🙋 사람이 결정할 것
하트 UI 제거는 **사용자에게 보이던 컨트롤이 사라지는 변경**이다(구직자 공고 목록 JobList → JobCard 우하단). 기능 자체가 미완성이라 상실되는 실효는 0이지만, 이미 하트를 눌러 본 사용자에게는 "있던 버튼이 없어졌다"로 읽힌다. 제품 오너가 (a) 조용히 제거 (b) 릴리스 노트에 한 줄 고지 중 택할 것. 권고는 (a) — 애초에 목록 화면이 없어 사용자가 '내 북마크'를 인지한 적이 없다.


## `A2` — 판정: **제거**

**대상 심볼**

uniqn-mobile/src/hooks/useBookmarks.ts:109,124,143,149 — trackEvent('bookmark_added'|'bookmark_removed', { job_id })

### 원래 의도 (왜 만들었나)
근거 없음. A1 과 같은 벌크 커밋 `98764f049` 에 함께 들어왔고, 이 계측을 무엇에 쓸 것인지 적은 문서·주석·이슈가 없다. 선행 감사(`docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:53`)는 이 계측의 존재를 "측정할 화면이 뒤따를 것을 전제한 설계다"라며 **완성 의도의 근거로 제시했으나, 아래 실측이 그 추론을 무너뜨린다.**

### 흐름이 끊긴 시점
계측 자체가 한 번도 이어진 적이 없다. 더 중요하게는 **발신 레일이 나중에 끊겼다** — `analyticsService.ts:155-158` 의 `initializeAnalytics` 가 지금 `logger.info('Analytics: 로깅 모드 (Firebase 제거됨)')` 만 하고, `trackEvent`(:178-208)는 `__DEV__` 일 때 `logger.debug` 한 줄을 남기는 것이 전부다. 즉 **프로덕션에서는 문자 그대로 아무 일도 하지 않는다.** Firebase Analytics 제거는 북마크 도입(2026-01-26) 이후에 일어난 별개 사건이라, 이 계측은 만들어질 때 잠깐 살아 있었다가 조용히 무의미해졌다.

### 지금 살아 있는 코드 흐름
useBookmarks.ts:132 toggleBookmark → :143 또는 :149 trackEvent('bookmark_removed'|'bookmark_added', { job_id }) → services/observability/index.ts:8 re-export → analyticsService.ts:178 trackEvent → :182 isAnalyticsEnabled 확인 → :191-193 cleanParams 정제 → :196-201 `if (__DEV__) logger.debug(...)` → **끝. 여기서 흐름이 종료된다.** 영속 레일과는 연결되지 않는다: 실제 DB 싱크는 `analyticsService.ts:413-419 trackOpsFunnel` 이 `:418 analyticsEventRepository.insert(event, props)` 로 `AnalyticsEventRepository.ts:27 supabase.from('analytics_events').insert(...)` 를 호출하는 경로인데, **useBookmarks 는 trackOpsFunnel 을 부르지 않는다**(trackEvent 만 부른다).

### 죽은 부분
`bookmark_added`·`bookmark_removed` 두 이벤트가 통째로 죽었다. 증거 셋. (1) **화이트리스트에 없다** — 영속 테이블 `analytics_events` 와 1:1 대응하는 `OpsFunnelEvent` 유니온(`src/repositories/supabase/AnalyticsEventRepository.ts:8-14`)은 `ops_hub_impression`·`ops_hub_entered`·`ops_tournament_created`·`ops_public_view_opened`·`ops_claim_converted`·`ops_limit_reached` **6개뿐**이고 bookmark 계열은 없다. 파일 주석(:5)이 "analytics_events 테이블 화이트리스트와 1:1"이라고 못박는다. (2) **표준 이벤트 목록에도 없다** — `analyticsService.ts:34-75` 의 `AnalyticsEvent` 유니온에 login·job_view·job_apply·check_in 등 30여 개가 열거돼 있는데 bookmark 계열은 없다. 그런데도 타입이 통과하는 이유는 :74-75 의 `// 커스텀` + `| string` 이 유니온을 통째로 `string` 으로 붕괴시키기 때문이다 — **타입 시스템이 이 오타/미등록을 원리적으로 잡지 못한다.** (3) **레포 전수 grep 결과 문자열 `bookmark_added`/`bookmark_removed` 는 useBookmarks.ts 4곳에만 존재**하고, 대시보드·SQL·Edge Function·e2e 어디에도 소비처가 0이다(Grep 도구로 레포 루트 전체 확인).

### 판정 근거
**퍼널이 실제 대시보드에서 쓰이는지 확인 시도한 결과 — 쓰이지 않으며, 쓰일 수 없었다.** 발신부터가 프로덕션 no-op 이고(`analyticsService.ts:196` 의 `__DEV__` 가드), 영속 레일의 화이트리스트에 등록되지 않았고(`AnalyticsEventRepository.ts:8-14`), 표준 이벤트 목록에도 없다(`analyticsService.ts:34-75`). 따라서 "계측이 심어져 있으니 완성이 의도됐고 수요가 측정될 것"이라는 논거는 **사실로 기각된다**. 오히려 반대 결론이 나온다 — 6개월 동안 이 기능의 사용량을 아무도 알 수 없었고 알려고 한 흔적도 없다. 수요 증거 0인 기능을 완성하는 것은 투기다. A1 과 함께 죽으므로 별도 삭제 작업은 없고, **이 항목의 값어치는 '완성' 판정의 유일한 논거를 무력화하는 반증 기록에 있다.**

### 삭제 목록·순서
별도 삭제 작업 없음 — 네 줄 전부 `useBookmarks.ts` 안에 있으므로 A1 4단계에서 파일과 함께 사라진다. 추가로 손댈 곳: **없다.** `AnalyticsEvent` 유니온(analyticsService.ts:34-75)에는 bookmark 항목이 애초에 없으므로 지울 것이 없고, `OpsFunnelEvent`(AnalyticsEventRepository.ts:8-14)에도 없다. `analytics_events` 테이블·마이그레이션(`supabase/migrations/20260717090500_ops_s1_funnel_events.sql`)은 ops 퍼널 전용이므로 **건드리지 말 것**.

### 깨지는 것
없음. 이 두 이벤트를 읽는 코드·SQL·대시보드가 0건이다(Grep 도구 레포 전수). `analytics_events` 테이블에 bookmark 행이 쌓인 적도 없다 — 삽입 경로가 `trackOpsFunnel` 하나뿐인데 북마크는 그 경로를 타지 않는다. 따라서 데이터 정리(백필/삭제) 도 불필요하다.
⚠️ 부수 발견(이번 묶음 범위 밖, 별건 보고 권장): `analyticsService.ts:74-75` 의 `| string` 이 `AnalyticsEvent` 유니온 전체를 무력화한다. `trackEvent('오타난_이벤트명')` 이 tsc·eslint 를 그대로 통과한다. 이번 북마크 계측이 미등록 상태로 6개월 살아남은 구조적 원인이며, 같은 방식으로 죽어 있는 다른 이벤트가 더 있을 수 있다.

### 검증 명령
```
npx tsc --noEmit  (A1 파일 삭제 후 잔존 참조 확인 — 이 항목 단독 검증 명령은 없다. 사실 확인은 Grep 으로 `bookmark_added|bookmark_removed` 가 0건이 되는지 본다)
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음. bookmark_added/bookmark_removed 문자열은 useBookmarks.ts 4곳(+docs)에만 존재함을 레포 전수 재실측. 발신 레일 사망도 실측 확인: trackEvent(analyticsService.ts:178-208)는 __DEV__ 가드(:196) 안 logger.debug 가 전부라 프로덕션 no-op, initializeAnalytics(:152-161)는 'Firebase 제거됨' 로깅 모드. 영속 경로는 trackOpsFunnel(:413-418)→analyticsEventRepository.insert 뿐이고 그 소비처는 ops 훅 4개(useOpsMutations·useOpsClaimToken·useOpsHubImpressionOnce·useOpsHubEnteredOnce)로 useBookmarks 는 안 탄다. OpsFunnelEvent 화이트리스트 6종(AnalyticsEventRepository.ts:8-14)에 bookmark 없음, AnalyticsEvent 유니온(:34-75)에도 없으며 :74-75 의 '| string' 이 유니온을 string 으로 붕괴시켜 tsc 가 못 잡는 구조까지 실측 일치. SQL·대시보드·EF·e2e 소비처 0.

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의 — A1 4단계에 포섭되므로 별도 작업 0 이 맞고, AnalyticsEvent 유니온·OpsFunnelEvent·analytics_events 마이그(ops 전용)를 건드리지 말라는 제외 지시도 정확하다. 이 항목의 실질 가치인 '완성론 반증'도 성립 — 계측이 프로덕션에서 문자 그대로 아무 데도 안 가므로 6개월간 수요 측정이 원리적으로 불가능했다. 부수 발견('| string' 붕괴)은 실측 확인됨 — 별건 보고 권장에 동의하며, 이번 PR 범위에 넣지 말 것(범위 확장 금지).

### 🛡️ 검증 — 삭제 안전성
안전 — 지울 것이 애초에 없음을 확인(유니온에 bookmark 미등록, 테이블·마이그는 ops 퍼널 전용이라 불가침). analytics_events 에 bookmark 행이 쌓였을 가능성도 구조적으로 0(삽입 경로가 trackOpsFunnel 단일, 북마크는 미경유) — 데이터 백필/정리 불필요 판단 타당. 깨질 것 없음.

### 🙋 사람이 결정할 것
`AnalyticsEvent` 의 `| string` 탈출구(analyticsService.ts:74-75)를 닫을 것인가. 닫으면 미등록 이벤트가 tsc 에서 잡히지만, 현재 `| string` 에 기대어 발화 중인 다른 커스텀 이벤트가 있는지 먼저 전수조사가 필요하다. 이번 묶음의 결정 사항은 아니고 별도 티켓 권장.


## `A3` — 판정: **유지**

**대상 심볼**

MMKV 키 `bookmark-storage` (bookmarkStore.ts:132 에서 명명) — 이미 사용자 기기에 적재된 북마크 데이터

### 원래 의도 (왜 만들었나)
zustand `persist` 미들웨어의 기본 동작(bookmarkStore.ts:131-136)으로 자동 생성된 키다. 별도 설계 의도 문서는 근거 없음. 주목할 점은 이 키가 **프로젝트의 중앙 키 레지스트리에 등록조차 되지 않았다**는 것이다 — `src/lib/mmkvStorage.ts` 의 `STORAGE_KEYS` 를 grep 하면 BOOKMARK 항목이 0건이고, 스토어가 raw 문자열 `'bookmark-storage'` 를 직접 박아 넣었다.

### 흐름이 끊긴 시점
해당 없음 — 이 항목은 코드가 아니라 **이미 사용자 기기에 남아 있는 데이터**에 대한 처리 판정이다. A1 이 실행되면 이 키를 읽고 쓰는 코드가 전부 사라지므로 데이터가 고아가 된다.

### 지금 살아 있는 코드 흐름
현재: bookmarkStore.ts:133 `createJSONStorage(() => mmkvStorage)` → src/lib/mmkvStorage.ts 의 MMKV 인스턴스 → 키 `bookmark-storage` 에 `{state:{bookmarks:[...]},version:0}` JSON. 앱 내 '캐시 삭제' 경로와의 관계를 실측함: `src/services/cacheService.ts:43-49` 의 `CACHE_KEYS_TO_CLEAR` 는 `JOB_POSTINGS_CACHE`·`SCHEDULES_CACHE`·`SEARCH_HISTORY`·`RECENT_JOBS`·`FORM_DRAFT` 5개뿐이고, :52-59 의 `PROTECTED_KEYS` 는 AUTH·THEME·NOTIFICATIONS 등 6개다. **`bookmark-storage` 는 양쪽 어디에도 없다** → 사용자가 설정에서 '캐시 삭제'(useClearCache)를 눌러도 북마크 데이터는 지워지지 않고, 앱 삭제 전까지 기기에 남는다.

### 죽은 부분
A1 실행 직후 이 키 전체가 고아 데이터가 된다. 읽는 코드 0, 쓰는 코드 0. 크기는 최대 100건 × 스냅샷 5필드({id,title,location,workDate,bookmarkedAt}) 로 수 KB 수준이다.

### 판정 근거
**지우기 위해 코드를 새로 쓰는 것은 자충수다.** 고아 MMKV 키를 정리하려면 앱 시작 시 `storage.delete('bookmark-storage')` 를 한 번 실행하는 마이그레이션 코드를 추가해야 하는데, 그러면 (a) 기능을 삭제하는 PR 이 오히려 코드를 늘리고 (b) 그 정리 코드 자체가 언제 제거해도 되는지 아무도 모르는 새로운 영구 잔해가 된다(모든 기존 사용자가 앱을 한 번 열었는지 알 방법이 없으므로 사실상 영구 존치). 반면 방치 비용은 사실상 0이다 — 수 KB, 읽는 코드 없음, 사용자에게 안 보임, 앱 삭제·기기 교체 시 자연 소멸. 애초에 MMKV 로컬 저장이라 기기 교체로 사라진다는 점이 A1 의 제거 논거 중 하나였는데, 같은 성질이 여기서는 자연 정리 메커니즘으로 작동한다. **지금 그대로 두는 것이 맞다.**

### 깨지는 것
없음 — 아무것도 하지 않는 판정이다. ⚠️ 단, A1 실행 시 **`cacheService.ts` 나 `mmkvStorage.ts` 를 '정리하는 김에' 건드리지 말 것**. `STORAGE_KEYS` 에 BOOKMARK 항목이 없으므로 지울 것도 없고, `CACHE_KEYS_TO_CLEAR`/`PROTECTED_KEYS` 배열도 북마크와 무관하다. 이 두 파일은 A1 삭제 목록에 포함되지 않는다.

### 검증 명령
```
검증 대상 코드 변경이 없음 — 확인만 한다면 A1 적용 후 `npx tsc --noEmit` 가 mmkvStorage/cacheService 에 아무 영향 없이 통과하는지 보면 충분하다.
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음. 'bookmark-storage' 문자열은 bookmarkStore.ts:132 와 아카이브 문서에만 존재(레포 전수 재실측). A1 실행 후 이 키를 읽고 쓰는 코드가 0 이 됨을 확인. 앱 내 정리 경로와의 무관계도 실측: clearAllCache(cacheService.ts:94-154)는 storage.clearAll() 이 아니라 열거된 키만 removeStorageItem 하는 구조라(:124-146) bookmark-storage 는 '캐시 삭제'로도 안 지워지고, CACHE_KEYS_TO_CLEAR 5종(:43-49)·PROTECTED_KEYS 6종(:52-59)·mmkvStorage 의 STORAGE_KEYS 어디에도 BOOKMARK 항목이 없다.

### ⚖️ 검증 — 판정 심사 (동의)
유지(=아무것도 안 함) 동의. 정리 마이그레이션 코드를 추가하면 삭제 PR 이 코드를 늘리고 그 코드 자체가 제거 시점을 알 수 없는 영구 잔해가 된다는 논리가 타당하다. 방치 비용은 최대 100건×5필드 수 KB·읽는 코드 0·사용자 비가시·앱 삭제 시 자연 소멸로 사실상 0. 보완 권고 1건(코드 아님): 훗날 '저장/찜' 기능을 서버 승격형으로 재도입할 경우 구버전 사용자 기기에 이 고아 키가 남아 있다는 사실을 프로젝트 메모리 토픽 파일에 한 줄 기록해 둘 것 — 같은 키 이름 재사용 시 구 스키마 JSON 이 하이드레이션을 오염시킬 수 있다(zustand persist version:0 스냅샷). 새 키 이름을 쓰면 원천 차단된다.

### 🛡️ 검증 — 삭제 안전성
안전 — 삭제 목록이 비어 있는 판정이며 그것이 맞다. cacheService.ts·mmkvStorage.ts 를 '정리하는 김에' 건드리지 말라는 경고 유효: 두 파일에 bookmark 관련 코드가 실제로 0줄이라 손댈 것 자체가 없고, 잘못 손대면 다른 스토어 19개 소비처(authStore·themeStore·jobFilterStore 등 실측)의 공유 인프라를 흔든다.

### 🙋 사람이 결정할 것
고아 키를 굳이 정리할 것인가. 권고는 '하지 않는다'(위 근거). 만약 제품 오너가 개인정보·저장공간 관점에서 정리를 원하면, 별도 정리 코드를 추가하는 대신 **`cacheService.ts:43-49` 의 `CACHE_KEYS_TO_CLEAR` 에 `'bookmark-storage'` 를 한 줄 추가**해 기존 '캐시 삭제' 버튼에 얹는 방법이 가장 싸다(신규 실행 경로 0, 사용자가 누를 때만 동작). 단 이 경우 `STORAGE_KEYS` 에 키를 정식 등록하는 편이 규약에 맞다.



---

# B-신고회로


## `B-1` — 판정: **제거**

**대상 심볼**

uniqn-mobile/src/services/admin/reportService.ts:105-113 getMyReports() · :201 reportService.getMyReports · uniqn-mobile/src/services/index.ts:36 배럴 re-export · uniqn-mobile/src/lib/queryClient.ts:407 queryKeys.reports.myReports() · uniqn-mobile/src/repositories/supabase/ReportRepository.ts:91-93 getByReporterId · uniqn-mobile/src/repositories/interfaces/IReportRepository.ts:115-121 getByReporterId

### 원래 의도 (왜 만들었나)
근거 없음(설계문서 0건) — 다만 도입 경위는 특정됨. `git log -S"getMyReports" -- uniqn-mobile/`  = 2커밋: `1f5bc44cc feat(mobile): 확정 스태프 관리 및 정산 기능 구현`(2026-01-12) 이 reportService·queryClient 에 동시 신설, `8f5650e80 test: 테스트 커버리지 30% 달성` 이 테스트만 추가. 커밋 메시지 어디에도 '내 신고 내역'이 없고, `docs/superpowers/`·`docs/decisions/`·`wiki/` 에 신고 조회 화면 설계 문서 0건. 실제 성격은 Repository 대칭성 채우기 — `IReportRepository.ts:100-135` 이 getByJobPostingId / getByTargetId / getByReporterId / getCountsByTargetId 를 한 벌로 선언하고 구현은 `ReportRepository.ts:84-92` 에서 `queryReports(컬럼, 값, 로그문구)` 한 줄씩으로 찍어냈다. 소비 계획이 있었다는 증거는 없다.

### 흐름이 끊긴 시점
끊긴 게 아니라 **애초에 안 이어졌다**. `git log --all -S"getMyReports" -- uniqn-mobile/app uniqn-mobile/src/hooks` = 0커밋 — 화면·훅이 붙었다 떨어진 이력이 없다. 전체 레포 소비처 grep 결과는 정의(reportService.ts:108) · 서비스객체(:201) · 배럴(services/index.ts:36) · 테스트(reportService.test.ts:12,297-314) 4곳뿐이고 `app/`·`src/hooks/`·`e2e/` 0건.

### 지금 살아 있는 코드 흐름
신고 생성만 살아 있다: schedule.tsx:1195 <ReportModal> → ReportModal.tsx:226 handleSubmit → useOwnerReport.ts:74 submit → reportService.ts:40 createReport → ReportRepository.ts:192 runRpc('create_report') → reports INSERT → 트리거 report_notify_insert(baseline:12212) → notify_on_report_insert(baseline:5079-5133) → notifications INSERT **WHERE u.role='admin'**(baseline:5124-5125). 신고자 쪽은 useOwnerReport.ts:78 토스트 '신고가 접수되었습니다.' 로 끝. 관리자 조회는 별도 경로: useAdminReports.ts:49 getAllReports / :66 getReportById → app/(admin)/reports/. **getMyReports 는 이 두 흐름 어디에도 없다.**

### 죽은 부분
① `getMyReports()`(reportService.ts:108) — 화면·훅 소비 0. ② `queryKeys.reports.myReports()`(queryClient.ts:407) — `queryKeys.reports.` 전수 grep 3건이 전부 useAdminReports.ts:48(`.all`)·:65(`.detail`)·:95(`.all`) 로, myReports 는 정의 1줄 외 소비 0. ③ `reportRepository.getByReporterId`(ReportRepository.ts:91) 와 인터페이스 선언(IReportRepository.ts:121) — 유일 호출자가 getMyReports.

### 판정 근거
제품: '내 신고 내역' 전용 화면은 이 앱 타깃에 불필요하다. 신고자가 알고 싶은 것은 목록이 아니라 **결과 한 줄**이고, 그건 B-3 의 알림 하나로 전달된다(마이그 1개). 화면을 만들면 훅+화면+카드 분리+진입점 배지에 더해 딥링크 라우트 신설 체인 5파일(types union·RouteRegistry·RouteMapper·파서·테스트)이 따라오고, 무엇보다 **미결 프라이버시 결정**이 앞을 막는다 — `rep_select`(baseline:13943)가 신고자에게 행 전체를 주고 `ReportRepository.ts:40-41 TABLE_COLUMNS` 에 `reviewer_id,reviewer_notes,severity` 가 들어 있어, 화면을 만드는 순간 관리자 내부 메모와 내부 트리아지 등급을 렌더할지 말지를 결정해야 한다. 비용: 삭제는 6파일·마이그 0. 완성은 10+파일·마이그 0~1·사람 결정 1건. 사용자 지시('필요 없는 건 지운다')와 '결과 통지는 알림으로 충분'이라는 대안 존재를 합치면 제거가 맞다.

### 삭제 목록·순서
삭제 순서(소비처 → 정의 → 인터페이스, tsc 가 매 단계 red 없이 통과):
1) uniqn-mobile/src/services/admin/__tests__/reportService.test.ts — :12 import 목록의 `getMyReports,` · :53 `getByReporterId: jest.fn(),` · :297-315 `// getMyReports` 주석 + `describe('getMyReports', ...)` 블록 전체
2) uniqn-mobile/src/services/index.ts:36 `getMyReports,`
3) uniqn-mobile/src/lib/queryClient.ts:407 `myReports: () => [...queryKeys.reports.all, 'myReports'] as const,`
4) uniqn-mobile/src/services/admin/reportService.ts:104-113 (JSDoc `/** 내가 신고한 목록 조회 */` 포함 함수 전체) · :201 `getMyReports,`
5) uniqn-mobile/src/repositories/supabase/ReportRepository.ts:91-93 `getByReporterId`
6) uniqn-mobile/src/repositories/interfaces/IReportRepository.ts:115-121 (JSDoc 4줄 + 시그니처)
※ `queryKeys.reports.all`·`.detail` 은 useAdminReports 가 쓰므로 **남긴다**. `requireCurrentUser` import 는 reportService.ts:40 createReport 가 계속 쓰므로 **남긴다**(tsc 로 확인).

### 깨지는 것
실제 확인한 것만: ① `src/services/admin/__tests__/reportService.test.ts` — import·mock·describe 3곳 동시 삭제 필요(안 지우면 jest red). ② 배럴 `src/services/index.ts` 는 37개 파일이 `from '@/services'` 로 import 하지만 `getMyReports` 를 named import 하는 파일은 0건(전수 grep) — 안전. ③ e2e: `e2e/` 전체에 `getMyReports|myReports` 0건. ④ DB·RLS 무영향(읽기 함수 삭제일 뿐, `rep_select` 정책·`reports` 테이블 불변). ⑤ knip 은 이 건에 관여 안 함(빌드설정·peer 네이티브 오탐 범주 아님) — 판정 근거는 grep + tsc.

### 검증 명령
```
cd uniqn-mobile && npx tsc --noEmit && npx jest src/services/admin/__tests__/reportService.test.ts src/lib/__tests__/queryClient.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
코드 소비처 없음 — 실측: e2e/ 전체 grep 0건, supabase/functions/ 0건, `import * as ... from '@/services'` 와일드카드 0건, 문자열 키 동적 접근 0건, queryKeys.reports.* 소비는 useAdminReports 의 .all/.detail 3곳뿐(실측). 단 **비코드 참조 2건**: 미추적(untracked) 자매 분석 문서 docs/analysis/2026-08-02-ux-friction-selected-deepdive.md 와 2026-08-02-employer-seeker-ux-friction-audit.md 가 getMyReports 를 인용하며 완성을 제안 — 런타임 소비는 아니므로 죽음 판정은 유지

### ⚖️ 검증 — 판정 심사 (조건부)
죽음 판정과 삭제 안전성은 전부 재확인됐으나, 같은 날 같은 워크플로우의 자매 분석(2026-08-02-ux-friction-selected-deepdive.md §report-status-untrackable, CONFIRMED 판정)이 정반대 처방을 설계 수준까지 완비해 제안한다 — useMyReports 훅 + app/(app)/support/my-reports 화면 + 진입점 배지 + 알림 착지를 화면으로 교체. 두 레인이 제품 방향에서 정면 충돌하므로 삭제 실행 전 사용자(제품 오너)가 화면 신설안 기각을 명시해야 한다. 삭제안의 비용 논거(딥링크 체인 5파일 + reviewer_notes/severity 프라이버시 미결 결정)는 deepdive 자신의 검증 절에서도 실측 확인돼 논거로서 타당하고, '결과 통지=B-3 알림 1개' 대안도 성립한다. 단 전제 조건: B-3 완성이 같은 웨이브로 착지해야 한다 — B-3 없이 B-1 만 지우면 FAQ(inquiry.ts:326)의 '앱 내 알림 안내' 약속 불이행이 그대로인 채 조회 수단 후보까지 사라진다

### 🛡️ 검증 — 삭제 안전성
삭제 목록 6단계는 정확 — 줄 범위 실측 일치(reportService.ts:105-113·:201, IReportRepository.ts:116-121, ReportRepository.ts:91-93, queryClient.ts:407, services/index.ts:36, 테스트 :12/:53/:297~315). 유지 판단도 전부 실측 검증: requireCurrentUser 는 createReport:41 이 사용, queryKeys.reports.all/.detail 은 useAdminReports 3곳이 사용, src/lib/__tests__/ 에 reports 단언 0건(invalidateQueries 무관), 배럴 named import 0건. knip 오탐 범주(빌드설정·peer 네이티브) 비해당, MMKV persist 스토어 무관. 부수 효과: 미추적 분석 문서 2건의 참조가 stale 해지나 문서는 스냅샷이라 차단 아님


## `B-2` — 판정: **제거**

**대상 심볼**

(스코프 밖 추가 발견) uniqn-mobile/src/services/admin/reportService.ts:89-102 getReportsByJobPosting·getReportsByStaff · :162-173 getReportCountByStaff · uniqn-mobile/src/lib/queryClient.ts:403-405 queryKeys.reports.byJobPosting·byStaff · :733 invalidateQueries.reports · uniqn-mobile/src/repositories/supabase/ReportRepository.ts:83-89 getByJobPostingId·getByTargetId · :131- getCountsByTargetId · :270- private queryReports

### 원래 의도 (왜 만들었나)
B-1 과 같은 커밋 계열의 Repository 대칭성 산물. `IReportRepository.ts:100-135` 이 4형제를 한 벌로 선언하고 `ReportRepository.ts:84-92` 가 `queryReports` 로 세 줄 찍어낸 구조. 설계문서 근거 없음.

### 흐름이 끊긴 시점
애초에 안 이어졌다. 소비처 전수 grep 결과 `getReportsByJobPosting`·`getReportsByStaff`·`getReportCountByStaff` 는 정의·서비스객체·배럴·테스트 4곳뿐이고 `app/`·`src/hooks/`·`src/components/`·`e2e/` 0건. `queryKeys.reports.byJobPosting`·`byStaff` 도 정의 1줄 외 0건. `invalidateQueries.reports`(queryClient.ts:733)도 0건 — useAdminReports.ts:95 는 `queryClient.invalidateQueries({queryKey: queryKeys.reports.all})` 를 직접 호출한다.

### 지금 살아 있는 코드 흐름
살아 있는 신고 읽기 경로는 관리자 축 하나뿐: app/(admin)/reports/index.tsx → useAdminReports.ts:48-49 useQuery(queryKeys.reports.all,'admin') → reportService.ts:186 getAllReports → ReportRepository.ts:95 getAll → paginatedQuery('reports'). 상세는 app/(admin)/reports/[id].tsx → useAdminReports.ts:65-66 queryKeys.reports.detail → reportService.ts:118 getReportById → ReportRepository.ts:~70 getById. 처리는 reportService.ts:132 reviewReport → ReportRepository.ts:231 reviewWithTransaction → runRpc('review_report')(baseline:8807-8850).

### 죽은 부분
① `getReportsByJobPosting`(reportService.ts:92) ② `getReportsByStaff`(:100) ③ `getReportCountByStaff`(:165) ④ `reportRepository.getByJobPostingId`(ReportRepository.ts:83) ⑤ `.getByTargetId`(:87) ⑥ `.getCountsByTargetId`(:131) ⑦ `queryKeys.reports.byJobPosting`(queryClient.ts:403-404) ⑧ `.byStaff`(:405) ⑨ `invalidateQueries.reports`(:733) ⑩ B-1 의 3형제까지 지우면 `private queryReports`(ReportRepository.ts:270-293) 도 호출자 0 (현 호출자는 :84,:88,:92 뿐). ⑪ 딸린 인터페이스 선언 `IReportRepository.ts:102-114,129-135` 와 `ReportCounts` 타입(소비처 재확인 필요).

### 판정 근거
제품: '이 공고의 신고 목록'·'이 스태프의 신고 횟수'는 관리자 콘솔이 이미 `getAllReports` 필터(status/severity/reporterType)로 커버한다. 스태프 상세에 신고 횟수 배지를 다는 기능은 **타깃 사용자에게 위험한 방향**이다 — 사장이 스태프의 누적 신고 수를 보는 순간 미검증 신고가 사실상 블랙리스트로 작동하고, 신고 상태 4종(pending 포함) 중 어느 것을 셀지도 정의된 바 없다. 비용: 삭제 3파일 추가(B-1 과 같은 파일들), 마이그 0. B-1 과 **같은 PR 로 묶어야** 한다 — 따로 하면 `queryReports` 헬퍼가 어느 쪽에서도 안 지워지고 남는다.

### 삭제 목록·순서
B-1 삭제 후 이어서(같은 PR):
1) uniqn-mobile/src/services/admin/__tests__/reportService.test.ts — :10,:11,:15 import · :51,:52,:56 mock(`getByJobPostingId`,`getByTargetId`,`getCountsByTargetId`) · :254-292 describe 2블록 · :399-434 describe 1블록
2) uniqn-mobile/src/services/index.ts:34,35,39 (`getReportsByJobPosting,`·`getReportsByStaff,`·`getReportCountByStaff,`)
3) uniqn-mobile/src/lib/queryClient.ts:403-405(byJobPosting·byStaff) · :733(`reports: () => queryClient.invalidateQueries(...)`)
4) uniqn-mobile/src/services/admin/reportService.ts:89-102(JSDoc 포함 2함수) · :160-173(getReportCountByStaff + 섹션 주석) · :199,:200,:204 (reportService 객체 3줄)
5) uniqn-mobile/src/repositories/supabase/ReportRepository.ts:83-89(2메서드) · :131- getCountsByTargetId 전체 · :270-293 private queryReports(마지막에 — 위 3개와 B-1 을 다 지운 뒤 호출자 0 확인하고)
6) uniqn-mobile/src/repositories/interfaces/IReportRepository.ts:102-114 · :129-135 · `ReportCounts` 타입은 다른 소비처 grep 후 판단
7) uniqn-mobile/src/repositories/index.ts:266 JSDoc 예시 `reportRepository.getByJobPostingId(jobPostingId)` 문구 정정

### 깨지는 것
① `queryClient.ts:733 invalidateQueries.reports` 삭제 시 `src/lib/__tests__/queryClient.test.ts` 확인 필요(해당 키 단언 여부). ② `ReportCounts` 는 `IReportRepository.ts` 에서 export 되므로 배럴 재수출 여부를 grep 후 삭제. ③ `getAllReports`/`getReportById`/`reviewReport`/`createReport` 와 `queryKeys.reports.all`/`.detail` 은 관리자 화면 라이브 — **절대 건드리지 말 것**. ④ e2e `e2e/tests/p0-critical/admin-report-resolution.spec.ts` 는 adminClient 로 supabase 를 직접 때리므로(:111-128) 서비스 삭제와 무관 — 단, `e2e/pages/admin/reports.page.ts` 는 관리자 화면 셀렉터라 무영향. ⑤ `paginatedQuery` 는 다른 리포지토리도 쓰므로 남긴다.

### 검증 명령
```
cd uniqn-mobile && npx tsc --noEmit && npx jest src/services/admin/__tests__/reportService.test.ts src/lib/__tests__/queryClient.test.ts && npx eslint src/services/admin/reportService.ts src/repositories/supabase/ReportRepository.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — getReportsByJobPosting·getReportsByStaff·getReportCountByStaff·getByTargetId·getCountsByTargetId·queryKeys.reports.byJobPosting/byStaff·invalidateQueries.reports 전부 정의·배럴·테스트 외 소비 0 실측(e2e 0, EF 0, 동적 접근 0). ⚠️ 주의: 동명 메서드 getByJobPostingId 가 ApplicationRepository:152·ConfirmedStaffRepository:281·WorkLogRepository:180 에 **살아서** 존재한다(settlementQuery.ts:60,153·confirmedStaffService.ts:88 등이 소비) — 삭제는 반드시 Report 계열 파일 스코프로만, grep 일괄 치환 금지

### 🛡️ 검증 — 삭제 안전성
빠진 것 2건 발견: ① `src/repositories/index.ts:85` 의 ReportCounts 배럴 재수출, ② `src/repositories/interfaces/index.ts:62` 의 ReportCounts 재수출 — ReportCounts 소비처 전수 실측 결과(정의 IReportRepository.ts:71 + import ReportRepository.ts:29 + 배럴 2곳뿐, reportService.ts:165 는 인라인 리터럴이라 타입명 미사용) getCountsByTargetId 계열 삭제 후 소비 0 이므로 타입을 지워야 하고, 그때 이 배럴 2줄을 같이 안 지우면 tsc red. ReportRepository.ts:29 의 import 도 고아가 된다(eslint 지목). 나머지는 안전 실측: private queryReports 호출자는 :84/:88/:92 뿐(B-1 포함 전부 삭제 후 0 확인), invalidateQueries.reports 는 소비 0 + 테스트 단언 0, useAdminReports.ts:95 는 .all 직접 호출이라 무영향, getAllReports/getReportById/reviewReport/createReport 라이브 유지 확인, e2e 는 adminClient 직접 호출이라 서비스 삭제 무관. B-1 과 같은 PR 묶음 필수라는 판단에 동의(queryReports 잔존 방지)

### 🙋 사람이 결정할 것
B-1 과 한 PR 로 묶을 것인가(권장) — 따로 하면 `queryReports` 헬퍼가 고아로 남는다.


## `B-3` — 판정: **완성**

**대상 심볼**

uniqn-mobile/src/types/notification.ts:94(값)·:217(카테고리 ADMIN)·:295(priority normal)·:477(라벨) · uniqn-mobile/src/constants/notificationTemplates.ts:290-295 · uniqn-mobile/src/components/notifications/NotificationIcon.tsx:89 · uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts:97 · uniqn-mobile/supabase/functions/send-push-notification/typeCategoryMap.ts:56

### 원래 의도 (왜 만들었나)
**Firebase 시절에도 발신자는 없었다** — 이게 이번 조사의 핵심 반전이다. `docs/archive/planning/2026-04/SUPABASE-migration-analysis.md:320-341` 의 Firebase 함수 이전 매핑표에 `onReportCreated`(→notify_on_report_insert)만 있고 검토완료 함수가 **없다**. `git show 1faf775bb --stat | grep -i report` = `functions/src/notifications/onReportCreated.ts | 149 -` **단 1개** — 삭제된 Firebase 함수 트리에 onReportReviewed/onReportResolved 파일이 존재한 적이 없다. 즉 `notify_on_report_insert` 의 COMMENT(baseline:5141 '(Firebase onReportCreated 대체)')가 짝을 못 찾는 이유는 이식 누락이 아니라 **원본이 없었기 때문**이다. 타입 도입 커밋은 `20fc40d4b feat(mobile): Phase 3 P1 인앱 알림 시스템 구현`(2025-12-20, notification.ts) — 알림 타입 카탈로그를 한 번에 선언하면서 들어왔다. 당시 착지는 관리자 화면이었다(`docs/archive/firebase-legacy/2026-04/06-firebase.md:11897` `report_resolved: (d) => '/(app)/support/reports/${d.reportId}'` 와 :17995 `report_resolved: → admin/report` 가 문서 안에서도 서로 모순).

### 흐름이 끊긴 시점
끊긴 게 아니라 **한 번도 이어진 적 없다**. `reports` 테이블 트리거는 3개뿐(baseline:12212 report_notify_insert AFTER INSERT · :12219 reports_updated_at · :12226 reports_xss_check) — UPDATE 알림 트리거 0. `review_report` RPC 본문(baseline:8807-8850)은 권한검사 → 상태검증 → `UPDATE public.reports SET status/reviewer_id/reviewer_notes/reviewed_at` 이 전부로 notifications INSERT 가 없다. 마이그레이션 전체 `report_resolved` grep 0건. 클라 쪽 notifications INSERT 경로도 0(`createNotification` 전수 grep 결과 FCM 수신 변환 `createNotificationFromFCM` 과 스키마·템플릿 유틸뿐).

### 지금 살아 있는 코드 흐름
발신: (없음). 수신측만 완전 배선: NotificationRepository.ts:65 `row.type as NotificationData['type']` → :71 getNotificationCategory(notification.ts:516) → NotificationIcon.tsx:141-143 `typeIcons[type] || BellIcon` → 목록 렌더는 DB 의 title/body 직접 표시. 탭 시 deepLinkNavigationExecutor.ts:165 `NOTIFICATION_ROUTE_MAP[type]` → NotificationRouteMap.ts:97 `() => ({name:'notifications'})` → :177 `mappedRoute ?? {name:'notifications'}`. 푸시는 EF typeCategoryMap.ts:56 `report_resolved:'admin'`. **수신 회로는 100% 완성 상태로 손님을 기다리고 있다.**

### 죽은 부분
발신자가 0이므로 수신측 6개 지점 전부가 도달 불가: notification.ts:94/217/295/477 · notificationTemplates.ts:290-295(`link: () => '/notifications'`) · NotificationIcon.tsx:89(ShieldCheckIcon) · NotificationRouteMap.ts:97 · EF typeCategoryMap.ts:56. 추가로 `notificationTemplates.ts:290-295` 는 발신자가 생겨도 안 쓰인다 — 서버 트리거가 title/body 를 직접 쓰기 때문(createNotificationMessage 는 FCM 수신 변환 전용).

### 판정 근거
제품: **앱이 문서로 약속한 것이다.** `src/types/inquiry.ts:326` FAQ '신고는 어떻게 처리되나요?' 답변에 "처리 결과는 앱 내 알림으로 안내드립니다"가 명시돼 있다. 기능 누락이 아니라 불이행이다. 그리고 대체 채널이 없다 — 관리자가 개별 연락하는 절차·기록이 코드에 0건이고, `(admin)` 라우트는 role 게이트라 신고자는 결과를 볼 수 없다. 타깃 관점: 홀덤펍 사장이 올린 노쇼 신고, 구직 스태프가 올린 임금체불/허위공고 신고는 둘 다 실질 피해가 걸린 건이다. '접수했다'만 말하고 침묵하면 신고 자체가 죽고(재신고 안 함) 관리자 콘솔은 빈 채로 유지된다. 비용이 결정타다: **수신 회로가 이미 100% 배선돼 있어 완성 비용 = 마이그레이션 1개 + 파리티 카운트 1줄. 클라이언트 파일 0개.** 화면(B-1)을 안 만들어도 회로가 닫힌다 — 알림 본문이 곧 결과이고, 착지는 이미 라우트맵이 `{name:'notifications'}` 로 정의해둔 알림 목록(사용자가 이미 서 있는 곳)이다. 지우는 비용(7파일 + FAQ 문구 수정 + 드리프트 가드 동시 수정)이 만드는 비용보다 크다.

### 완성 비용
**2파일, 클라이언트 변경 0.**
1) 신규 `uniqn-mobile/supabase/migrations/<ts>_notify_reporter_on_report_review.sql`:
   - `CREATE FUNCTION public.notify_on_report_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'`
   - 조건: `OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('resolved','dismissed') AND NEW.reporter_id IS NOT NULL` — **reporter_id 는 nullable(baseline:10512)** 이고 notifications.recipient_id 는 NOT NULL 이라 이 가드가 없으면 INSERT 가 터진다
   - `INSERT INTO public.notifications(recipient_id,type,title,body,link,data,priority) VALUES (NEW.reporter_id,'report_resolved','신고 처리 완료', format('''%s'' 관련 신고가 %s되었습니다.', COALESCE(NULLIF(NEW.job_posting_title,''),'해당 공고'), CASE NEW.status WHEN 'resolved' THEN '처리' ELSE '기각' END), '/notifications', jsonb_build_object('reportId',NEW.id,'reportStatus',NEW.status),'normal')` — **`reviewer_notes` 는 절대 싣지 않는다**(관리자 내부 메모)
   - `EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; RETURN NEW;` — baseline:5129 와 동일 패턴(알림 실패가 신고 처리를 막지 않게)
   - `CREATE TRIGGER report_notify_review AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_review();`
   - `REVOKE EXECUTE ON FUNCTION public.notify_on_report_review() FROM PUBLIC, anon, authenticated;` — `20260731090000_revoke_public_execute_trigger_functions.sql` 규율
2) `uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql` — :91 `PARITY_EXPECT_FUNCS=184` → 185, :111-112 단언·문구 갱신
※ `link` 를 '/notifications' 로 두면 딥링크 체인 신설이 불필요하다: REPORT_RESOLVED 는 `ROUTE_MAP_PRIORITY_TYPES`(deepLinkNavigationExecutor.ts:148-152)에 없어 link 우선이지만, 파싱에 성공하든 실패하든(:176-177 `mappedRoute ?? {name:'notifications'}`) 착지가 같다. RouteRegistry.ts:11 에 `notifications: '/(app)/notifications'` 존재 확인함.

### 깨지는 것
실측 확인: ① `supabase/tests/parity_baseline_guard.test.sql:91,111-112` 함수 수 184 단언 → 185 필수(안 고치면 db-tests red). ② `e2e/tests/p0-critical/admin-report-resolution.spec.ts` 가 실제 알림 행을 만들게 된다 — 해당 스펙에 알림 단언이 없어 red 는 아니지만(`grep 알림` 1건은 :39 온보딩 스킵), `cleanupTestReport`(:139-146)가 job_posting/reports 만 지우므로 notifications 잔존 → 시드 정리에 추가 검토. ③ 클라 5곳·EF 1곳은 **무변경**이므로 드리프트 가드 `src/services/notifications/internal/__tests__/typeCategoryMapDrift.test.ts` 는 그대로 통과. ④ notifications.type 은 CHECK 제약 없는 자유 text(baseline:10067-10081) — 'report_resolved' INSERT 안전. ⑤ 인앱 카테고리 탭(NotificationCategoryTabs.tsx:32-51 = 전체/지원/출퇴근/정산/공고/시스템)에 admin 탭이 없어 이 알림은 '전체' 탭에서만 보인다 — INQUIRY_ANSWERED 가 같은 상태로 이미 운영 중이라 차단 아님. ⑥ `supabase-patterns §10` 중복 트리거 검사: report_notify_insert 는 AFTER INSERT, 신설은 AFTER UPDATE 로 이벤트가 달라 중복 아님 — 그래도 `node scripts/graph-db-deps.mjs triggers` 로 실측할 것.

### 검증 명령
```
cd uniqn-mobile && npm run db:reset && npx supabase test db (파리티 가드 185 확인) — 이어서 로컬에서 reports 1행 INSERT 후 status='resolved' UPDATE → SELECT type,recipient_id,link FROM notifications WHERE type='report_resolved' 가 1행. 클라 회귀는 npx jest src/shared/deeplink/__tests__/NotificationRouteMap.test.ts src/services/notifications/internal/__tests__/typeCategoryMapDrift.test.ts (무변경이므로 green 유지 확인용)
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
발신자 0 재확인 — reports 트리거는 baseline 3개뿐(INSERT 알림·updated_at·xss_check, AFTER UPDATE 알림 없음), review_report RPC 본문에 notifications INSERT 없음, 이후 마이그레이션에서 review_report 를 건드린 건 20260711100000 의 ALTER SET search_path 하드닝뿐(재정의 아님), report_resolved 를 INSERT 하는 SQL 0건. 수신측 추가 소비처 1건 발견: `src/shared/deeplink/__tests__/NotificationRouteMap.test.ts:158` 이 REPORT_RESOLVED 라우트를 단언 — 완성 시 무변경이라 지지 증거일 뿐. 혼동 주의: notification.ts:218 의 NEW_REPORT 는 발신자가 살아 있다(notify_on_report_insert, admin 전용) — 같이 건드리지 말 것

### 🛡️ 검증 — 삭제 안전성
완성 작업의 안전수칙(삭제 0건이므로 이 축으로 심사): ① 파리티 184→185 필수 — parity_baseline_guard.test.sql:91 `PARITY_EXPECT_FUNCS=184`·:111-112 단언 실측. ② 신설 트리거 함수 search_path 에 **pg_temp 포함 필수** — 같은 가드 파일이 pg_temp 누락 함수 0 을 강제(deepdive 실측 :134-144). 기존 notify_on_report_insert 의 baseline 정의는 'public','extensions' 뿐이므로 baseline 을 베끼면 안 되고 pg_proc.proconfig 실측이 베이스(S3 함정 동형). ③ REVOKE EXECUTE FROM PUBLIC/anon/authenticated (20260731090000 규율). ④ `NEW.reporter_id IS NOT NULL` 가드 필수 — reporter_id 는 nullable, notifications.recipient_id NOT NULL 위반 방지. ⑤ review_report RPC 본문 수정 금지, 트리거 분리(기존 마이그 수정 금지 규율 합치). ⑥ e2e cleanupTestReport(:139-146)는 reports·job_postings 만 삭제 실측 — 알림 행 잔존, 시드 정리 추가 검토 타당. ⑦ 트리거 중복은 이벤트 상이(INSERT vs UPDATE)로 §10 비해당이나 graph-db-deps.mjs triggers 실측 권고 유지. 자매 deepdive 가 동일 처방의 마이그 설계 전문을 이미 작성해 둠 — 재사용 가능. 착지는 B-1 제거 시 notifications 목록 유지(클라 0파일), 화면 신설 시에만 딥링크 체인 5파일 확장

### 🙋 사람이 결정할 것
① **제거 대안을 택할 것인가.** 이 항목만은 반대 판정이 가능하다 — '신고는 드물고 관리자가 개별 연락한다'로 갈 거면 삭제 목록은: notification.ts:94,217,295,477 / notificationTemplates.ts:290-295 / NotificationIcon.tsx:89 / NotificationRouteMap.ts:97 / NotificationRouteMap.test.ts:157-161 / EF typeCategoryMap.ts:56 **동시**(드리프트 가드가 강제) + **`src/types/inquiry.ts:326` FAQ 문구에서 "처리 결과는 앱 내 알림으로 안내드립니다" 삭제**(약속을 지울 것). 이 경우 마이그 0, 7파일. 단 개별 연락 절차를 사람이 실제로 만들어야 한다. ② 알림 카테고리를 ADMIN(현재, notification.ts:217·EF:56) 그대로 둘지 SYSTEM 으로 옮길지 — 옮기면 드리프트 가드가 양쪽 동시 수정을 강제한다. INQUIRY_ANSWERED 선례가 ADMIN 유지라 그대로 두는 쪽 권장. ③ **DB 잔존 확인 방법**(제거 택할 때만 필요, 직접 조회 안 함): `mcp__supabase__execute_sql` 로 prod(`ygfxukhktpqymahfrvbz`)에 `SELECT count(*), min(created_at), max(created_at) FROM public.notifications WHERE type = 'report_resolved';` 또는 Supabase Studio SQL Editor. 정적으로는 0 이 거의 확정 — 생산자 SQL 0건 + 클라 INSERT 경로 0건 + Firebase 시절 onReportReviewed 부재. 게다가 **잔존해도 런타임 안전**이다: 읽기 경로가 `row.type as ...` 캐스팅이라 Zod 검증을 안 타고(parseNotificationDocument 는 런타임 소비처 0 — 테스트·주석뿐), NotificationIcon.tsx:143 `typeIcons[type] || BellIcon`·:142 `categoryColors[category] || SYSTEM`·deepLinkNavigationExecutor.ts:177 `?? {name:'notifications'}` 로 전부 폴백된다.


## `B-4` — 판정: **제거**

**대상 심볼**

uniqn-mobile/src/types/report.ts:281-282 Report.evidenceUrls · :318-319 CreateReportInput.evidenceUrls · uniqn-mobile/src/schemas/report.schema.ts:131-140(createReportInputSchema) · :184(reportDocumentSchema) · uniqn-mobile/src/repositories/supabase/ReportRepository.ts:41(TABLE_COLUMNS 의 evidence_urls) · :202(p_evidence_urls) · uniqn-mobile/app/(admin)/reports/[id].tsx:196-211(렌더 블록)

### 원래 의도 (왜 만들었나)
근거 없음(설계문서 0건). DB 우선 설계의 잔향이다 — `supabase/migrations/archive/20260409000000_base_schema.sql:328` 과 `docs/superpowers/plans/2026-04-10-phase1a-schema-rls.md:670` 에 `evidence_urls TEXT[]` 컬럼이 먼저 있었고, Firebase 시절 `docs/archive/firebase-legacy/2026-04/firestore.rules:2744` 도 `evidenceUrls is list` 를 검증했다. TS 필드는 그 컬럼을 그대로 타입에 옮긴 것. `git log -S"evidenceUrls" -- src/ app/` = 6커밋(1f5bc44cc 최초 → e8694edb4/b69f6aae8 Repository 이관 → 94e5443ed Firebase 제거)인데 전부 배관 이동이고, **`git log -S"evidenceUrls:" -- src/components/ app/` = 0커밋** — 값을 채우는 코드가 쓰인 적이 없다.

### 흐름이 끊긴 시점
애초에 안 이어졌다. 유일한 신고 생성 UI 인 `ReportModal.tsx:242-256 handleSubmit` 이 만드는 `CreateReportInput` 에 evidenceUrls 키가 없다(type/reporterType/targetId/targetName/jobPostingId/jobPostingTitle/workLogId/workDate/description 뿐). 첨부 UI 도 없다 — 입력부는 유형 선택 + 텍스트 설명 두 개뿐(:388-403).

### 지금 살아 있는 코드 흐름
쓰기: ReportModal.tsx:242 input(evidenceUrls 없음) → useOwnerReport.ts:77 createReport → reportService.ts:47 createReportInputSchema.safeParse(optional 이라 통과) → ReportRepository.ts:202 `p_evidence_urls: input.evidenceUrls ?? []` → **항상 `[]`** → create_report RPC(baseline:1483,1499) `COALESCE(p_evidence_urls, ARRAY[]::text[])` → reports.evidence_urls = '{}'. 읽기: ReportRepository.ts:41 TABLE_COLUMNS 에 evidence_urls 포함 → rowToReport toCamelCase → app/(admin)/reports/[id].tsx:196 `{report.evidenceUrls && report.evidenceUrls.length > 0 && (...)}` → **length 가 언제나 0 이라 블록이 절대 렌더되지 않는다.**

### 죽은 부분
① `Report.evidenceUrls`(report.ts:282) — 값이 항상 빈 배열. ② `CreateReportInput.evidenceUrls`(report.ts:319) — 생성지점 0. ③ `createReportInputSchema.evidenceUrls`(report.schema.ts:131-140, url()+isSafeUrl()+max(5) 검증) — 검증할 값이 도달하지 않음. ④ `reportDocumentSchema.evidenceUrls`(report.schema.ts:184). ⑤ `app/(admin)/reports/[id].tsx:196-211` 첨부 자료 렌더 블록 — 도달 불가 분기. ⑥ `ReportRepository.ts:41` TABLE_COLUMNS 의 `evidence_urls` — 빈 배열만 실어 나름.

### 판정 근거
제품: **증빙 첨부 경로는 이미 다른 곳에 살아 있다.** 1:1 문의가 첨부를 완전 지원한다 — `src/types/inquiry.ts:62-93`(InquiryAttachment, MIME 허용목록, 제약 상수) → `src/services/inquiryService.ts:224 attachFilesToInquiry` → `src/hooks/useInquiry.ts:247` → **화면 `app/(app)/support/create-inquiry.tsx:29,57`** 에서 실사용, 열람은 `src/components/support/InquiryAttachmentGallery.tsx` 서명 URL 경유. 신고에 별도 업로드 파이프라인(스토리지 버킷·RLS·서명 URL·용량 제한)을 복제할 이유가 없다. 그리고 실사용 형태와도 안 맞는다 — 홀덤펍 사장의 지각/노쇼/근무태만 신고는 본인 관찰이 증거이고 사진이 없다. 임금체불·허위공고처럼 증빙이 필요한 건은 이미 1:1 문의 쪽이 맞는 창구다. 비용: 삭제 5파일·마이그 0(**DB 컬럼 `evidence_urls` 와 create_report RPC 시그니처는 그대로 둔다** — 컬럼 DROP 은 pg_proc.prosrc 의존성 실측이 필요한 별건이고 얻는 게 없다). 남겨두면 타입이 거짓말을 한다('증거 자료 URL 목록'인데 영원히 빈 배열)+관리자 화면에 죽은 분기가 남는다.

### 삭제 목록·순서
삭제 순서(tsc 가 각 단계 안내):
1) uniqn-mobile/app/(admin)/reports/[id].tsx:195-211 — `{/* 증거 자료 */}` 주석 포함 블록 전체
2) uniqn-mobile/src/schemas/report.schema.ts:131-140 `evidenceUrls: z.array(...).max(5).optional(),` (createReportInputSchema) · :184 `evidenceUrls: z.array(z.string()).optional(),` (reportDocumentSchema)
3) uniqn-mobile/src/types/report.ts:281-282 (`/** 증거 자료 URL 목록 */` + 필드) · :318-319 (CreateReportInput 의 동일 2줄)
4) uniqn-mobile/src/repositories/supabase/ReportRepository.ts:202 `p_evidence_urls: input.evidenceUrls ?? [],` → **`p_evidence_urls: [],` 로 교체(삭제 아님)** — create_report(baseline:1432)의 `p_evidence_urls text[]` 는 DEFAULT 가 없는 필수 파라미터라 빼면 RPC 가 터진다
5) uniqn-mobile/src/repositories/supabase/ReportRepository.ts:41 TABLE_COLUMNS 에서 `evidence_urls,` 제거
6) `src/schemas/report.schema.ts` 상단의 `isSafeUrl` import 가 고아가 되는지 확인 후 정리(eslint 가 지목)
※ 남기는 것: DB 컬럼 `public.reports.evidence_urls`(baseline:10521), `create_report` RPC 시그니처, `src/types/supabase.ts:1880,1902,1924,2653`(자동생성 파일 — 손대지 말 것), `src/utils/__tests__/supabase.test.ts:28-29,292-295`(toCamelCase 케이스 변환 테스트로 신고 도메인과 무관).

### 깨지는 것
실측 확인: ① `e2e/tests/p0-critical/admin-report-resolution.spec.ts:123` 은 `evidence_urls: []` 를 **supabase 컬럼에 직접** INSERT 한다 — TS 타입 삭제와 무관(컬럼 유지하므로 무영향). ② `src/utils/__tests__/supabase.test.ts:28-29,292-295` 는 `toCamelCase({evidence_urls:['a','b']})` 를 검증하는 **범용 변환 테스트**라 신고 타입과 독립 — 건드리지 말 것(이름 닮았다고 같은 것 아님). ③ `src/types/supabase.ts` 는 Supabase 자동생성 — 컬럼 유지하므로 재생성해도 동일. ④ `src/components/employer/__tests__/ReportModal.test.tsx` 는 evidenceUrls 를 단언하지 않음(handleSubmit payload 에 원래 없음). ⑤ 마이그레이션·RLS·RPC 무변경 → 파리티 184/111 불변.

### 검증 명령
```
cd uniqn-mobile && npx tsc --noEmit && npx jest src/services/admin/__tests__/reportService.test.ts src/components/employer/__tests__/ReportModal.test.tsx src/utils/__tests__/supabase.test.ts && npx eslint src/schemas/report.schema.ts "app/(admin)/reports/[id].tsx"
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — 쓰기: ReportModal 에 evidenceUrls 키 0건(전수 grep 실측) → 항상 []. 읽기: [id].tsx:196 length 게이트라 도달 불가. e2e:123 은 컬럼 직접 INSERT(컬럼 유지라 무영향), supabase.test.ts:28-29/292-295 는 범용 toCamelCase 케이스 테스트(신고 도메인 무관 — '건드리지 말 것' 판단 동의). 추가 발견: `reportDocumentSchema` 와 `parseReportDocuments`/`parseReportDocument`(report.schema.ts:171-214) + schemas/index.ts:288-290 재수출은 **통째로 소비 0** — 읽기 경로는 rowToReport=toCamelCase 직행이라 이 스키마를 아예 안 탄다. 목록은 :184 한 줄만 지우지만 사실 스키마·파서 전체가 죽은 코드다(같은 PR 에 포함하거나 별도 기록 권장)

### 🛡️ 검증 — 삭제 안전성
안전 — 핵심 함정 2건 정면 검증: ① createReportInputSchema 는 z.object 기본(strip) 모드고 `.strict()` 아님 → evidenceUrls 필드 제거 후에도 파싱 실패 없음, S5 '컨테이너 공고 null 증발' 형 함정 비해당(파일 전문 실독). reportDocumentSchema 도 소비 0 이라 파싱 회귀 원천 불가. ② p_evidence_urls 는 baseline:1432 실측상 DEFAULT 없는 필수 파라미터(뒤의 p_work_log_id/p_work_date 만 DEFAULT) → '삭제 아닌 [] 고정 교체' 판단 정확. DB 컬럼·RPC 시그니처 유지 결정도 옳다 — 컬럼 DROP 은 pg_proc.prosrc 의존성 실측이 필요한 별건(프로젝트 메모리 규칙 합치). isSafeUrl 고아 import 는 eslint 가 지목(xssValidation 은 잔존 사용). src/types/supabase.ts 자동생성 불변 유지 동의. 파리티 184/111 불변 동의. knip 오탐·MMKV persist 비해당


## `B-5` — 판정: **유지**

**대상 심볼**

uniqn-mobile/src/types/report.ts:206 ReportStatus · :211-216 REPORT_STATUS_LABELS(검토 대기/검토 중/처리 완료/기각) · :221-238 REPORT_STATUS_COLORS · :177-198 REPORT_SEVERITY_COLORS

### 원래 의도 (왜 만들었나)
신고 처리 상태의 표시 SSOT. DB `chk_report_status` CHECK(baseline:10528)이 `pending|reviewed|resolved|dismissed` 4종을 강제하고, `review_report` RPC(baseline:8822)가 `reviewed|resolved|dismissed` 전이를 허용한다 — 타입은 DB 계약의 클라이언트 사본이다.

### 흐름이 끊긴 시점
해당 없음 — 끊긴 적 없다.

### 지금 살아 있는 코드 흐름
관리자 목록: app/(admin)/reports/index.tsx → src/components/admin/ReportCard.tsx:83-84 REPORT_STATUS_COLORS/REPORT_SEVERITY_COLORS → :97 accessibilityLabel → :114 배지 텍스트. 관리자 상세: app/(admin)/reports/[id].tsx:103-104 → :118 상단 배지 → :235 처리 폼 현재상태. 신고 모달: src/components/employer/ReportModal.tsx:70,143 REPORT_SEVERITY_COLORS(유형 선택 시 심각도 칩). 상태 값 자체는 useAdminReports.ts:66 → reportService.ts:132 reviewReport → review_report RPC 로 왕복한다.

### 죽은 부분
없음. 4개 라벨 전부 도달 가능하다 — `pending` 은 create_report 기본값(reports.status DEFAULT 'pending', baseline:10522), `reviewed|resolved|dismissed` 는 review_report RPC 가 허용하는 전이(baseline:8822)이고 관리자 상세 화면의 처리 폼이 셋 다 제출할 수 있다.

### 판정 근거
과제 브리프의 '관리자 화면만 소비'는 **죽었다는 뜻이 아니라 살아 있는 소비처가 하나라는 뜻**이다. `src/components/admin/ReportCard.tsx` 와 `app/(admin)/reports/[id].tsx` 두 파일 6곳이 실제로 렌더한다(위 인용). 관리자 콘솔은 이 앱의 정상 운영 축이고 신고 트리아지는 거기서만 일어난다. 지울 근거가 없고, B-3 을 완성하면 알림 본문의 '처리/기각' 문구가 이 4상태와 짝을 이룬다. 손대지 말 것.

### 깨지는 것
해당 없음 — 변경 없음. (참고: 만약 라벨 문구를 바꾼다면 `e2e/` 는 `npm run quality` 범위 밖이므로 `e2e/pages/admin/reports.page.ts` 와 admin-report-resolution.spec.ts 를 별도 Grep 해야 한다. PR#353 실사고 규칙.)

### 검증 명령
```
변경 없음 — 회귀 확인이 필요하면 cd uniqn-mobile && npx jest src/components/admin
```

### 🔍 검증 — 놓친 소비처 재수색 (살아있음)
살아있는 소비처가 관리자 밖에도 있음을 실측 확인 — REPORT_SEVERITY_COLORS 는 구인자 대면 ReportModal.tsx:70,143(신고 유형 선택 칩)이 렌더하고, ReportStatus 타입은 statusValues.ts:76·reportStatusUnionSchema(report.schema.ts:68)·IReportRepository.ts:43 필터까지 소비한다. REPORT_STATUS_LABELS/COLORS 는 ReportCard.tsx:83-114·[id].tsx:103-235 6곳 렌더 실측 일치. 4상태 도달 가능성도 DB 계약으로 재확인 — review_report COMMENT(baseline:8860)가 'pending/reviewed → reviewed/resolved/dismissed 전이 허용'을 명시

### 🛡️ 검증 — 삭제 안전성
변경 없음 — 손대지 말 것 판단 유지. B-1 을 제거하고 B-3 착지를 알림 목록으로 갈 경우에도 이 라벨들은 관리자 콘솔·신고 모달이 계속 소비하므로 고아가 되지 않는다. 라벨 문구 변경 시 e2e/ 별도 Grep 규칙(PR#353) 리마인드 타당 — e2e/pages/admin/reports.page.ts 존재 확인



---

# C-알림설계잔해


## `C1` — 판정: **제거**

**대상 심볼**

uniqn-mobile/src/types/notification.ts:368-373 (NotificationSettings.quietHours) · :547-551 (createDefaultNotificationSettings 기본값 22:00~08:00) · uniqn-mobile/src/schemas/notification.schema.ts:108-114 (updateNotificationSettingsSchema.quietHours) · :251-257 (notificationSettingsDocumentSchema.quietHours) · uniqn-mobile/src/schemas/user.schema.ts:117-138 (notificationSettingsSchema 전체, quietHours=:129-135) · uniqn-mobile/src/repositories/supabase/NotificationRepository.ts:55 (NOTIFICATION_SETTINGS_COLUMNS 의 quiet_hours) · DB notification_settings.quiet_hours jsonb (baseline:10040)

### 원래 의도 (왜 만들었나)
Firebase 시절 **실제로 동작하던 완성 회로**였다. 근거 2건 실측: ① 발신 게이트 — `git show 1faf775bb` 삭제분에 `isQuietHoursActive(quietHours)` 본문이 통째로 있다(KST UTC+9 보정, 자정 넘김 처리, `URGENT_NOTIFICATION_TYPES` 예외로 긴급 알림은 관통, 차단 시 `{allowed:false, reason:'quiet_hours'}`). ② UI — `git show 9fe2fe622` 삭제분에 `handleQuietHoursToggle` + '방해 금지 시간' 라벨 + `{start} - {end}` 표시 + Switch 가 있다. 즉 '설정 UI → 저장 → 발송 직전 게이트' 3단이 한때 다 있었다. 설계문서는 별도로 없고(`docs/` grep 히트는 firebase-legacy 아카이브와 사후 감사문서뿐), 구현 자체가 의도의 증거다.

### 흐름이 끊긴 시점
**두 번 끊겼고, 둘 다 명시적 삭제였다.** ① 발신측: `1faf775bb chore: Firebase Cloud Functions 완전 제거 + Supabase 백엔드 100% 이전 (#36)` — `isQuietHoursActive` 와 호출부가 함께 삭제됐고, 대체재인 Supabase EF `send-push-notification` 은 **처음부터** quiet_hours 를 읽지 않는다(`index.ts:102` select 목록 = `user_id, enabled, push_enabled, categories`). ② UI: `9fe2fe622 chore: 로컬 클러터 정리 + 데드코드 제거 (#182, 06-19)` — 커밋 메시지가 "데드코드: 미연결 NotificationSettings.tsx(347줄) 삭제"라고 자인한다. 즉 UI 는 Supabase 이전 이후 이미 어느 화면에도 안 붙어 있었고, 그 상태로 발견돼 삭제됐다. 현재 화면 `app/(app)/settings/notifications.tsx` 는 그 뒤 새로 쓰인 것으로 quietHours 를 애초에 다루지 않는다.

### 지금 살아 있는 코드 흐름
쓰기: app/(app)/settings/notifications.tsx:75 handlePushToggle → :78-82 saveSettings({...notificationSettings, pushEnabled}) → src/hooks/useNotifications.ts:483 useSaveNotificationSettings → NotificationRepository.ts:542 saveSettings → :544 toSnakeCase(settings) → :550-557 upsert(onConflict:'user_id') → notification_settings.quiet_hours. (같은 경로를 :87 handleCategoryToggle 도 탄다.)
읽기: NotificationRepository.ts:505 getSettings → :55 NOTIFICATION_SETTINGS_COLUMNS 에 quiet_hours 포함 → :524 toCamelCase → :525 parseNotificationSettingsDocument → notification.schema.ts:246-268 (.passthrough(), :284 `as NotificationSettings` 캐스트) → useNotifications.ts:469 setSettings → stores/notificationStore.ts:465.
값의 출처: 행이 없으면 NotificationRepository.ts:521,528 이 createDefaultNotificationSettings() 를 반환 → types/notification.ts:547-551 의 {enabled:false,start:'22:00',end:'08:00'} 주입 → 사용자가 '푸시 알림' 토글을 **한 번만 눌러도** 이 기본값이 DB 에 기록된다.
소비: **없다.** 발송 EF supabase/functions/send-push-notification/index.ts:101-116 은 enabled/push_enabled 만, :127-137 은 categories 만 본다. quiet_hours 참조 0건.

### 죽은 부분
소비처 grep 결과 기준 심볼별: ① `NotificationSettings.quietHours`(types/notification.ts:368-373) — 판정·분기 소비처 0(Grep 도구 전수: 히트는 타입 선언·스키마 2곳·기본값·테스트 픽스처뿐). ② `createDefaultNotificationSettings()` 의 quietHours 기본값(:547-551) — 이 함수 자체는 살아 있다(NotificationRepository:521,528 · notificationStore:129)지만 quietHours 키만 아무도 안 읽는다. ③ `updateNotificationSettingsSchema`(notification.schema.ts:104-115) — 스키마 **전체**가 배럴 재수출(schemas/index.ts:203)과 자기 테스트 외 소비 0. ④ `notificationSettingsSchema`+`NotificationSettingsData`(user.schema.ts:117-138) — Grep 전수 결과 소비처가 배럴(index.ts:181,191) **단 하나**, 실사용 0인 완전 고아 스키마. ⑤ EF 는 quiet_hours 를 select 조차 안 함 → 저장은 되지만 발송 판정에 원리적으로 도달 불가.

### 판정 근거
**제품**: 이 앱의 타깃이 새벽 근무자라는 사실이 방해금지의 근거가 아니라 오히려 **반증**이다. 이 앱 알림의 다수(출근 리마인더 CHECKIN_REMINDER, 확정 APPLICATION_CONFIRMED, 노쇼 NO_SHOW_ALERT, 시각 변경 SCHEDULE_CHANGE, 정산 SETTLEMENT_COMPLETED)가 심야~새벽에 나가야 하는 **운영 알림**이다. 기본값 22:00~08:00 을 켜면 정확히 근무 시간대의 알림이 죽는다. Firebase 구현이 `URGENT_NOTIFICATION_TYPES` 예외 목록으로 이를 우회했는데, 그 목록 자체가 알림 타입 추가마다 갱신해야 하는 부채이고 한 줄 누락이 '출근 알림이 안 왔다'는 **조용한 사고**가 된다 — 이 레포가 반복해 데인 판정 복제 패턴이다(#388 이 같은 판정 4곳 복제로 회귀 생산). 게다가 iOS 집중 모드·Android 수면 모드가 OS 레벨로 이미 존재하고, 앱은 카테고리 6종 토글을 이미 갖췄다(notifications.tsx:28-35). 앱 자체 방해금지를 두는 순간 **진실원이 둘**이 되어 '왜 알림이 안 오지'의 원인 후보만 늘어난다.
**비용**: 완성하려면 EF 발송 게이트 + URGENT 예외 목록 SSOT(TS·SQL·EF 3곳 중 어디에 둘지) + 시간대 결정(KST 하드코딩 vs 기기 TZ — 대회 원정은 국내뿐이라 KST 로 퉁칠 수 있지만 명시 결정 필요) + 시간 피커 2개 UI + 보류된 알림 처리 정책(인앱만 적재? 해제 시 재발송?) 가 필요하다 — 최소 5파일 + EF 배포. 제거는 필드 6곳 + 테스트 4블록이고 마이그레이션 0건이다. 지금 이 값은 **아무도 안 읽는데 사용자가 토글 누를 때마다 DB 에 쓰인다** — 순수 부채다.

### 삭제 목록·순서
삭제 순서(위→아래, 각 단계 tsc 통과 확인):
1. uniqn-mobile/src/repositories/supabase/NotificationRepository.ts:55 — `NOTIFICATION_SETTINGS_COLUMNS` 에서 `quiet_hours,` 제거. **이 단계가 회로 절단의 핵심**: 스키마가 `.passthrough()`(notification.schema.ts:268)라 select 에 남아 있는 한 타입에서 지워도 런타임에서 키가 통과해 `toSnakeCase` 로 되돌아 쓰인다. 이 줄을 먼저 지워야 진짜로 끊긴다.
2. uniqn-mobile/src/schemas/notification.schema.ts:251-257 — `notificationSettingsDocumentSchema` 의 quietHours 블록
3. uniqn-mobile/src/schemas/notification.schema.ts:108-114 — `updateNotificationSettingsSchema` 의 quietHours 블록
4. uniqn-mobile/src/schemas/user.schema.ts:129-135 — quietHours 블록. (선택 확장: :117-138 `notificationSettingsSchema` + `NotificationSettingsData` 전체 삭제 + 배럴 uniqn-mobile/src/schemas/index.ts:181,191 의 두 export 제거 — 소비처 0 실측)
5. uniqn-mobile/src/types/notification.ts:547-551 — 기본값 quietHours 블록
6. uniqn-mobile/src/types/notification.ts:368-373 — `NotificationSettings.quietHours` 필드(주석 :368 포함)
7. 테스트: uniqn-mobile/src/schemas/__tests__/notification.schema.test.ts:296-305 · :307-316 · :318-326 · :642-648 (it 블록 4개 통째) / uniqn-mobile/src/services/notifications/__tests__/notificationService.test.ts:118 (픽스처 1줄)
8. **선택(권장하지 않음)** DB 컬럼 `notification_settings.quiet_hours` DROP — 아래 breakage 의 배포 순서 위험 참조. 남겨도 1번 이후로는 읽히지도 쓰이지도 않는다.
※ uniqn-mobile/src/types/supabase.ts:1147,1158,1169 는 생성 파일 — 손으로 고치지 말고 8번을 할 때만 `generate_typescript_types` 로 재생성.

### 깨지는 것
· 테스트 4블록이 red → 같은 커밋에서 삭제(위 7번). notificationService.test.ts:118 픽스처는 타입 제거로 tsc 가 먼저 지목한다.
· 배럴: uniqn-mobile/src/schemas/index.ts:181,191 — user.schema 쪽을 통째 지울 때만 건드린다.
· **e2e**: Grep 도구로 uniqn-mobile/e2e/ 전수 검색 → quietHours 0건 확인(quality 범위 밖이라 별도 검색함).
· **Zod passthrough 함정**: notification.schema.ts:268 `.passthrough()` + :284 `as NotificationSettings` 캐스트 때문에, 삭제 1번(select 목록)을 빼먹고 타입만 지우면 **에러 없이** quietHours 가 계속 read→write 왕복한다. tsc 는 이 누락을 잡지 못한다.
· **컬럼 DROP 시 배포 순서 위험(8번을 할 경우)**: 마이그레이션이 앱 업데이트보다 먼저 prod 에 닿으면, 구 클라이언트의 getSettings 가 여전히 `quiet_hours` 를 select 해 `column does not exist` 로 실패하고 **알림 설정 화면 전체가 깨진다**. 반드시 코드 배포(OTA+네이티브 롤아웃) 완료 후 DROP. 이 순서 부담이 8번을 권장하지 않는 이유다.
· 컬럼을 남기면 기존 행의 quiet_hours 값은 방치될 뿐 데이터 손실 0, 파리티(184/111) 무영향, 마이그 0건.

### 검증 명령
```
npx tsc --noEmit && npx jest src/schemas/__tests__/notification.schema.test.ts src/services/notifications/__tests__/notificationService.test.ts src/repositories/supabase/__tests__/NotificationRepository.saveSettings.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
판정을 바꾸는 소비처는 없음(실측): ① EF send-push-notification 은 index.ts:102 에서 user_id/enabled/push_enabled/categories 만 select — quiet_hours 참조 0 ② SQL 함수·트리거 중 quiet_hours 리더 0(supabase/ 전수 대소문자무시 grep — baseline:10040 컬럼 정의 + archive 주석 2건뿐) ③ e2e/ 0건 ④ scripts/ 0건 ⑤ app/ 트리 'quiet' 대소문자무시 0건(Bash grep 함정 회피해 Grep 도구 사용) ⑥ NotificationRepository.saveSettings.test.ts 도 quiet_hours 미참조 — 숨은 테스트 파손 없음. 단 조사가 놓친 '의도 표식' 2건: (a) EF index.ts:93 주석 "(방해금지 시간대는 후속 PR)" — 현행 코드에 남은 명시적 완성 계획. 필드를 지우면 이 주석이 stale 약속이 되므로 같은 커밋에서 주석 정리 필수 (b) docs/planning/2026-07-11-ux-m-batch-handoff-prompt.md:79-80 이 quietHours 섹션을 스펙으로 기재 — stale 계획 문서, 차단 아님.

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. 제품 논거(운영 알림 앱에서 방해금지=역기능, URGENT 예외목록=판정 복제 부채, OS 집중모드와 진실원 이중화) 타당하고, 기본값이 enabled:false 라 Firebase 시절에도 UI 로 켜지 않는 한 실동작한 적이 없다 — 사용자 가시 UI 회귀 아님(UI 는 #182 에서 이미 삭제됨, 실측 근거 인용 정확). 단 EF 주석의 '후속 PR' 계획을 의식적으로 뒤집는 결정임을 커밋 메시지에 명시할 것.

### 🛡️ 검증 — 삭제 안전성
삭제 순서·목록 대체로 정확, 실측 검증 결과: ① passthrough 함정 주장 사실(notification.schema.ts:268 .passthrough() + :284 캐스트, saveSettings 는 :544 toSnakeCase 전량 왕복) — select 목록(:55) 선삭제가 진짜 절단점 맞음. 단 행 없는 신규 유저는 기본값(:547-551) 경유로도 quiet_hours 가 쓰이므로 1번과 5번은 반드시 같은 커밋 ② 테스트 4블록 줄범위 전부 정확(296-305/307-316/318-326/642-648 실측 일치). 642-648 은 passthrough 때문에 삭제 후에도 green 일 수 있으나 위생상 삭제 타당 ③ 배럴 181/191 실측 일치, user.schema notificationSettingsSchema+NotificationSettingsData 는 배럴 외 소비 0 실측 — 선택 확장 안전 ④ 추가 필수: EF index.ts:93 주석의 '방해금지 시간대는 후속 PR' 문구 제거 ⑤ DB 컬럼 유지(8번 비권장) 동의 — 구 클라 select 목록에 quiet_hours 가 박혀 있어 DROP 선행 시 설정 화면 전면 파손 위험 실재, 남겨도 마이그 0·파리티 무영향 ⑥ types/supabase.ts 생성파일 불가침 동의 ⑦ MMKV persist 파편: quietHours 는 optional 필드라 기기에 남은 캐시 객체가 여분 키를 갖더라도 아무도 안 읽어 shape 드리프트 사고 없음 ⑧ knip false positive 대상(babel/expo-modules-core/mmkv/nitro) 무접촉. 검증 게이트: quality 만으론 부족 — jest(npm test)까지 실행할 것.

### 🙋 사람이 결정할 것
① DB 컬럼 `notification_settings.quiet_hours` 를 실제로 DROP 할지(배포 순서 부담을 감수할 가치가 있는가) — 기본 권고는 남기고 코드만 절단. ② '방해금지가 정말 필요 없나'는 최종적으로 제품 결정이다. 제거하면서 대체 안내(알림 설정 화면에 'iOS 집중 모드 / Android 수면 모드로 시간대를 조절할 수 있어요' 한 줄 + 시스템 설정 딥링크 — 이미 handleOpenSettings 가 :66-72 에 있다)를 넣을지 여부.


## `C2` — 판정: **제거**

**대상 심볼**

uniqn-mobile/src/types/notification.ts:61-62 (선언) · :196 (TYPE_TO_CATEGORY) · :274 (DEFAULT_PRIORITY) · :456 (LABELS '정산 요청') · uniqn-mobile/src/constants/notificationTemplates.ts:177-182 (템플릿) · uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts:63-66 (라우팅) · :158 (isEmployerOnlyNotification) · uniqn-mobile/src/components/notifications/NotificationIcon.tsx:70 (BanknotesIcon) · uniqn-mobile/supabase/functions/send-push-notification/typeCategoryMap.ts:35

### 원래 의도 (왜 만들었나)
**설계 근거는 '열거' 뿐이다.** 실측 3건: ① `git show 673a2f39c:specs/react-native-app/10-notifications.md:91` — 최초 RN 스펙의 알림 타입 enum 안에 `SETTLEMENT_REQUESTED = 'settlement_requested', // 정산 요청 (구인자에게)` 한 줄. 같은 블록에 지금은 존재하지 않는 `JOB_CLOSING_SOON`·`NEW_JOB_IN_AREA`·`CHIPS_PURCHASED`·`LOW_CHIPS_WARNING`·`CHIPS_REFUNDED` 가 나란히 있다 — **구현 계획이 아니라 브레인스토밍 목록**이었다는 증거다. ② `docs/archive/planning/2026-04/BUSINESS_PLAN_2025.md:443` — 알림 카테고리 표의 '정산 | 정산 완료, 정산 요청' 한 칸. ③ Firebase 시절 `functions/src/utils/notificationUtils.ts:72,241,282` 에도 타입 union + category/priority 맵에만 존재. 사용자 시나리오·화면 설계·정책(쿨다운·남용 방지) 문서는 `docs/`·`docs/superpowers/specs/`·`wiki/` 전수 grep 결과 **근거 없음**. 즉 '정산 완료가 있으니 정산 요청도 있겠지'라는 **대칭적 상상**이 스펙에 적혔고 완료 쪽만 구현됐다.

### 흐름이 끊긴 시점
**끊긴 게 아니라 애초에 안 이어졌다.** `git log --all --oneline -S"settlement_requested"` 전 이력(16커밋)과 `-S"SETTLEMENT_REQUESTED"`(16커밋)를 전수 확인한 결과, 프로듀서(알림 INSERT / addDoc / createNotification 호출)가 등장한 커밋이 **0건**이다. 모든 히트가 타입 선언·category/priority 맵·라우트 맵·아이콘·템플릿·테스트·문서다. Firebase 시절에도 마찬가지 — `git show 1faf775bb --stat` 에 `onSettlementCompleted.ts(79줄)`·`onNegativeSettlement.ts(124줄)` 는 있지만 `onSettlementRequested.ts` 는 **존재하지 않는다**.

### 지금 살아 있는 코드 흐름
**발신 경로 0.** 살아 있는 건 수신 인프라뿐이며, 그 인프라는 다른 타입들 덕분에 살아 있는 것이다:
src/types/notification.ts:62 선언 → :196 category=SETTLEMENT → :274 priority='normal' → :456 라벨 '정산 요청'
→ src/constants/notificationTemplates.ts:177-182 템플릿(body: `${d.staffName}님이 정산을 요청했습니다.`) — 단 `NotificationTemplates` 의 실소비는 :412 `createNotificationMessage` 이고 그 호출부는 src/services/work/shiftReminderScheduler.ts:16 **로컬 예약 알림 1곳뿐**. 서버 알림 문구는 100% SQL 소관이라 이 템플릿은 이 타입에 대해선 영원히 안 불린다.
→ src/shared/deeplink/NotificationRouteMap.ts:63-66 → `{name:'employer/settlement', params:{jobId}}` — 이 라우트 이름 자체는 실재한다(src/services/observability/internal/deepLinkRouteParser.ts:150,169,179 · deepLinkRouteSerializer.ts:73-74). 착지 계약은 유효하나 착지할 알림이 생기지 않는다.
→ src/components/notifications/NotificationIcon.tsx:70 BanknotesIcon
→ supabase/functions/send-push-notification/typeCategoryMap.ts:35 카테고리 매핑
실제 렌더는 src/components/notifications/NotificationItem.tsx:101-105 가 DB 행의 body 를 그대로 그린다 — 즉 템플릿조차 우회된다.

### 죽은 부분
위 9개 심볼 전부가 죽었다. 근거는 '소비처 grep'이 아니라 **생산처 grep 0건**이다: `settlement_requested` 를 INSERT 하는 트리거·RPC·EF·클라 코드가 `uniqn-mobile/supabase/` 전체와 `src/`·`app/` 전체에서 0건. 추가로 회로가 원리적으로 막혀 있다 — ① 유일한 클라 INSERT 경로인 `NotificationRepository.ts:98 createNotification` 은 소비처가 **0**이다(grep 전수, 테스트조차 없음). ② 그 메서드는 설사 호출해도 실패한다: `notifications` 테이블의 RLS 정책은 baseline:13679(DELETE)·13686(SELECT)·13693(UPDATE) 셋뿐 **INSERT 정책이 없고**, `20260712010100_applications_trigger_parity_and_write_grant_hardening.sql:94` 가 남아 있던 `notifications_insert_service` 정책마저 DROP 했으며 :113-115 가 anon 의 INSERT 권한을 REVOKE 했다. 즉 authenticated 클라이언트의 알림 INSERT 는 RLS 로 차단된다.

### 판정 근거
**제품**: '정산해주세요'를 **구직자가 사장에게 누르는 독촉 버튼**은 이 앱에서 잘못된 해법이다. ① 홀덤펍 단발 알바의 정산 지연은 대개 사장이 **잊어서**지 거부해서가 아니다. 잊은 사람에게 필요한 건 상대의 독촉이 아니라 자기 화면의 리마인더다. 게다가 독촉은 을이 갑에게 눌러야 하는 버튼이라 실제로는 눌리지 않는다 — 다음 일자리를 받아야 하는 관계에서 '재촉했다'는 기록이 남는 걸 감수할 스태프는 드물다. 즉 배선해도 사용률이 낮을 구조다. ② 대회사 D-7 집중 시즌엔 한 대회에 수십 명이 확정된다. 정산이 하루 늦으면 사장 한 명에게 **수십 건의 동일 알림**이 쏟아진다. 쿨다운·중복제거를 붙여도 N:1 스팸이라는 근본 형태는 안 바뀐다. ③ '정산 지연·오류에 이의를 제기할 경로'라는 진짜 니즈는 이미 다른 표면이 담당한다 — 구인자 신고(app/(app)/(tabs)/schedule.tsx:766 useOwnerReport)와 1:1 문의(app/(app)/support/)가 살아 있다.
→ 더 나은 해법은 **구인자 쪽 자동 미정산 리마인더**(근무 종료 후 N일 경과한 미정산 work_log 를 크론이 집계해 사장에게 **묶음 1건**)다. 그런데 그건 발신 주체(시스템)·수신 문구·묶음 단위가 모두 달라 이 타입을 재활용할 게 아니라 새 타입(예: `settlement_overdue_reminder`)을 만들어야 한다 — 현재 미정산 리마인더 크론은 존재하지 않는다(migrations grep 0건). **즉 이 타입은 대체 설계에서도 안 쓰인다.**
**비용**: 완성하려면 RLS 때문에 클라 INSERT 가 불가하므로 SECURITY DEFINER RPC 신설(요청자가 해당 work_log 의 스태프인지 + 정산 대기 상태인지 검증) + 쿨다운 저장소(컬럼 또는 테이블) + SettlementTab UI + 낙관적 갱신 + 테스트 = 마이그 1~2건 + 파일 5개 이상. 제거는 9곳의 한 줄씩 + 테스트 3블록, **마이그레이션 0건**이다.

### 삭제 목록·순서
삭제 순서 — `NotificationType` 이 const object 이고 `Record<NotificationType, T>` 맵이 5개(types:196·274·432, NotificationRouteMap:20, NotificationIcon:33) 라 **선언을 먼저 지우면 tsc 가 누락 지점을 전수 지목**한다. 그 성질을 체크리스트로 쓴다:
1. uniqn-mobile/src/types/notification.ts:61-62 — `SETTLEMENT_REQUESTED: 'settlement_requested',` + 위 주석 `/** 정산 요청 (구인자에게) */`
2. `npx tsc --noEmit` 실행 → 아래 4곳이 에러로 뜬다. 순서대로 처리:
   - uniqn-mobile/src/types/notification.ts:196 (NOTIFICATION_TYPE_TO_CATEGORY)
   - uniqn-mobile/src/types/notification.ts:274 (NOTIFICATION_DEFAULT_PRIORITY)
   - uniqn-mobile/src/types/notification.ts:456 (NOTIFICATION_TYPE_LABELS '정산 요청')
   - uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts:63-66 (라우트 엔트리 3줄)
   - uniqn-mobile/src/components/notifications/NotificationIcon.tsx:70
   - uniqn-mobile/src/constants/notificationTemplates.ts:177-182 (템플릿 블록 6줄 + 위 주석)
3. tsc 가 못 잡는 것들 — **수동 제거 필수**:
   - uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts:158 — `isEmployerOnlyNotification` 의 배열 원소(단순 배열이라 타입 에러 안 남)
   - uniqn-mobile/supabase/functions/send-push-notification/typeCategoryMap.ts:35 — **EF 는 eslint·tsc·prettier 전부 건너뛴다**(CLAUDE.md 예외 등록)
4. 테스트:
   - uniqn-mobile/src/shared/deeplink/__tests__/NotificationRouteMap.test.ts:73-76 (라우팅 단언 it 블록)
   - uniqn-mobile/src/shared/deeplink/__tests__/NotificationRouteMap.test.ts:241 (isEmployerOnly 단언 1줄)
   - uniqn-mobile/src/constants/__tests__/notificationTemplates.test.ts:266-269 (body 생성 it 블록)
※ **DB 마이그레이션 불필요** — `notifications.type` 은 enum 이 아니라 `text NOT NULL`(baseline:10070)이고 type 에 CHECK 제약도 없다(:10080 은 priority 전용). 지울 DB 객체가 없다.
※ 쿼리키·상수·배럴 추가 정리 없음 — 이 타입 전용 쿼리키/상수는 존재하지 않는다(grep 확인).

### 깨지는 것
· tsc 가 잡아주는 것: `Record<NotificationType, T>` 맵 5개(exhaustive). 선언 삭제 후 `npx tsc --noEmit` 이 체크리스트 역할을 한다.
· **tsc 가 못 잡는 것 2곳** — ① `NotificationRouteMap.ts:158` 은 `NotificationType[]` 배열이라 원소가 사라져도 타입 에러가 없다. ② `supabase/functions/send-push-notification/typeCategoryMap.ts:35` 는 `eslint.config.js:301-302` ignores 로 lint·tsc·prettier 전부 우회된다 — 이 레포가 반복해 데인 사각지대다.
· 테스트 3블록 red → 같은 커밋에서 삭제.
· **e2e**: uniqn-mobile/e2e/ 를 Grep 도구로 전수 검색 → `settlement_requested`·`SETTLEMENT_REQUESTED` 0건 확인(quality 범위 밖이라 별도 확인).
· **DB 에 저장된 문자열**: `notifications.type` 은 text 라 과거 행이 있으면 라벨/아이콘 조회가 undefined 가 될 수 있다. 다만 프로듀서가 역사상 0건이므로 `type='settlement_requested'` 행은 존재할 수 없다 — 삭제 전 `SELECT count(*) FROM notifications WHERE type='settlement_requested'` 1회 실측을 권장(0 확인용).
· 딥링크 URL 파서(`deepLinkRouteParser.ts:150,169,179`)의 `employer/settlement` 라우트는 **건드리지 않는다** — 이 알림 타입 전용이 아니라 `/employer/settlement/:jobId` URL 을 직접 여는 일반 경로다. 함께 지우면 딥링크가 깨진다.

### 검증 명령
```
npx tsc --noEmit && npx jest src/shared/deeplink src/constants/__tests__/notificationTemplates.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음(실측): ① 프로듀서 0 재확인 — 현행 트리 전수 grep 에서 settlement_requested INSERT 는 migrations·EF·src·app 0건, 유일 클라 경로 NotificationRepository.createNotification(:99) 은 호출처 0(인터페이스 선언 + 동명이인 테스트 헬퍼뿐) ② RLS 차단 주장 사실 — 20260712010100:94 가 notifications_insert_service DROP, :116-118 이 anon 쓰기 REVOKE ③ e2e/ 0건 ④ scripts/·레포 루트 0건 ⑤ GROUPABLE_NOTIFICATION_TYPES(:569) 미포함 ⑥ 딥링크 파서의 employer/settlement 는 일반 URL 경로 실증(deepLinkRouteParser.ts:149-150·168-169·178-179) — 보존 대상 판단 정확 ⑦ DB 저장 행: 서브에이전트 MCP 금지로 prod count 실측 불가 — 프로듀서 역사상 0(git -S 전수) 근거로 행 부재가 원리적이나, 삭제 커밋 전 count 쿼리 1회를 게이트로 유지할 것(콘솔 수동 INSERT 만이 유일한 반례 경로).

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. 을→갑 독촉 버튼의 사용률 구조·대회 시즌 N:1 스팸·신고/문의 대체 표면 실재(schedule.tsx useOwnerReport·support/) 논거 타당하고, 대체 설계(미정산 크론 리마인더)도 새 타입이 필요해 이 타입은 어느 미래에도 재활용 불가라는 판단에 동의.

### 🛡️ 검증 — 삭제 안전성
교정 3건: ① 🚨 NotificationRouteMap.test.ts:73-76 은 'it 블록 통째'가 아니다 — 블록은 :69-76 이고 :70-72 에 살아있는 NEW_APPLICATION 폴백 단언이 함께 있다. 통째 삭제하면 살아있는 타입의 커버리지가 소실되므로 :73-75 단언 3줄만 제거할 것 ② notificationTemplates.test.ts 블록 범위는 266-269 가 아니라 266-275(전체 it 블록) — tsc 가 :267 을 지목하므로 실무상 자연 교정되나 목록 수치는 부정확 ③ 'EF 사본은 아무도 못 잡는다'는 과장 — typeCategoryMapDrift.test.ts:15 가 TYPE_CATEGORY_MAP 을 SSOT 와 toEqual 양방향 비교해 typeCategoryMap.ts:35 누락 시 jest red(테스트 자체는 동적 비교라 수정 불요). 단 npm run quality 는 jest 를 안 돌리므로 npm test 실행이 검증 게이트. 추가 관찰: NotificationType 이 const object 라 키 삭제 시 :158 배열 원소도 property access TS2339 로 tsc 가 잡는다 — '수동 제거 필수 2곳' 중 ①은 실제로는 tsc 커버, 진짜 tsc 밖은 EF 문자열 리터럴뿐이고 그건 위 드리프트 가드가 커버. 부수효과 1건: notificationTypeSchema(z.enum(NOTIFICATION_TYPES), schema.ts:26)가 좁아져 만일 과거 행이 있으면 parseNotificationDocuments(:213-216)가 조용히 목록에서 드랍 — crash 없음, count=0 사전확인으로 봉합. DB 마이그 불필요 판단 정확(type 은 text·CHECK 없음). Record 맵 5개는 tsc 전수 지목 확인.

### 🙋 사람이 결정할 것
정산 지연·금액 오류에 대한 구직자 이의 경로를 앞으로 어떻게 할지 — (a) 지금처럼 신고(useOwnerReport)·1:1 문의로 두기, (b) 구인자 대상 **자동 미정산 리마인더** 신설(새 타입 `settlement_overdue_reminder` + 크론, 현재 그런 크론은 없음). 이 결정은 SETTLEMENT_REQUESTED 제거와 **독립**이다 — 어느 쪽을 고르든 이 타입은 쓰이지 않는다.


## `C3` — 판정: **완성**

**대상 심볼**

uniqn-mobile/supabase/migrations/20260727000000_posting_auto_close_gaps.sql:500 (`'changedFields', array_to_string(v_changed_fields, ', ')`) — 담고 있는 함수는 :413-524 `public.notify_on_job_posting_update()`, 트리거는 baseline:12149 `job_posting_notify_update`. 관련: :489-494 무정보 body · :496 priority='normal' 고정 · uniqn-mobile/src/types/notification.ts:278 `JOB_UPDATED: 'low'`(DB 와 표기 드리프트)

### 원래 의도 (왜 만들었나)
Firebase 시절 `functions/src/notifications/onJobPostingUpdated.ts`(71줄, `1faf775bb` 에서 삭제)의 payload 를 Supabase 트리거로 그대로 이식한 것. 최초 등장은 `uniqn-mobile/supabase/migrations/archive/20260417030000_job_posting_notifications.sql:34,74`. **클라가 이걸 읽겠다는 의도는 근거 없음** — `git log --all -S"changedFields" -- uniqn-mobile/src uniqn-mobile/app` 이 **0 커밋**이다(실측). 즉 소비 코드가 있었다가 사라진 게 아니라, 커밋으로 표현된 적이 한 번도 없다. 설계문서도 `docs/`·`docs/superpowers/specs/`·`wiki/` 전수 grep 에서 사후 감사문서 2건 외 0건.

### 흐름이 끊긴 시점
**끊긴 게 아니라 애초에 안 이어졌고, 더 결정적으로 알림 자체가 한 번도 나간 적이 없다.** `20260727000000_posting_auto_close_gaps.sql:395-403` 주석이 자인한다: `v_changed_fields := v_changed_fields || 'title'` 에서 PostgreSQL 이 `anyarray || anyarray` 오버로드를 골라 미지정 리터럴 'title' 을 배열 리터럴로 파싱하려 들어 `malformed array literal: "title"` 로 **항상** 실패했고, `EXCEPTION WHEN OTHERS`(:522-524)가 이를 WARNING 으로 삼켜 조용히 사라졌다 — prod job_updated 누적 **0건**(2026-07-27 실측, pgTAP 로그 전 스위트에 WARNING 이 찍히고 있었다). 07-27 에 `array_append`(:459-482)로 복구됐다. 따라서 payload 를 렌더하지 않은 건 게으름이 아니라 **렌더할 데이터가 존재한 적이 없어 문제가 관측 불가능했기 때문**이다.

### 지금 살아 있는 코드 흐름
사장이 공고 수정 저장 → job_postings UPDATE → 트리거 job_posting_notify_update(uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql:12149) → notify_on_job_posting_update()(20260727000000_posting_auto_close_gaps.sql:413) → status 전이가 cancelled/closed 가 아니므로 ELSE 분기(:457) 진입 → :459-482 가 8필드(title/location/workDate/workDates/schedule/compensation/roleCatalog/postingType)를 `IS DISTINCT FROM` 비교해 **영어 camelCase** 를 array_append 로 적립(status 는 :483 주석대로 의도적 제외 — capacity_full 자동 전이 알림 폭탄 방지) → :489-494 body = `'○○ 공고' 공고가 수정되었습니다. 변경 내용을 확인하세요.` (**무엇이 바뀌었는지 한 글자도 없다**) → :496 priority='normal' 고정 → :497-503 data = jsonb_build_object(..., 'changedFields', array_to_string(v_changed_fields, ', '), ...) → :505-519 applications.status IN ('confirmed','applied','cancellation_pending') 지원자 **전원**에게 INSERT
→ 푸시: uniqn-mobile/supabase/functions/send-push-notification/index.ts:55 가 data 를 select 하지만 :167 `body: notification.body` 로 **body 만** 트레이에 실린다(:161 은 priority==='high' 만 승격)
→ 인앱: uniqn-mobile/src/components/notifications/NotificationItem.tsx:101-105 `<Text numberOfLines={2}>{notification.body}</Text>` — **body 만** 렌더, data 를 읽는 코드 없음

### 죽은 부분
죽은 건 `data.changedFields` 키 **하나**다(20260727000000:500). 소비처를 Grep 도구로 전수 검색한 결과(Bash grep 이 app/ 트리에서 조용히 0건을 내는 함정을 피해 Grep 도구 사용) 히트가 **SQL 3파일뿐** — 현행 트리거(20260727000000:500), baseline:5037(구 정의), archive/20260417030000. `uniqn-mobile/src/`·`app/`·`e2e/` **0건**. 반면 같은 함수의 나머지(취소 :431-443 · 마감 :444-456 분기, 8필드 비교 로직, 수신자 SELECT)는 전부 살아 있고 정확하다 — `v_changed_fields` 는 **이미 올바르게 계산되고 있으며 전달 경로에서만 폐기된다**.

### 판정 근거
여기서만 기본값(제거)을 뒤집는다. 이유는 취향이 아니라 **비용 구조**다.
**제거가 엄격히 열등하다**: PL/pgSQL 은 부분 수정이 불가능하므로 `changedFields` 키 한 줄을 빼려면 `CREATE OR REPLACE FUNCTION notify_on_job_posting_update()` 로 **취소·마감·수정 3분기를 통째 재정의**하는 마이그레이션이 필요하다. 그런데 그 **같은 마이그레이션 한 개**로 한글 라벨을 body 에 넣을 수 있다. 즉 제거는 '동일한 비용·동일한 리스크(아래 breakage 의 조용한 실패)를 치르고 얻는 게 알림 행당 40바이트'이고, 완성은 '동일한 비용·동일한 리스크로 실제 문제를 해결'한다. 리스크가 같은데 산출물이 한쪽만 있으면 선택지가 아니다.
**제품**: 확정된 스태프에게 급여·근무시간 변경은 '갈 것인가'를 뒤집는 정보다. 홀덤펍 단발 알바는 일당 하나로 지원을 결정하고, 대회사는 D-7 안에서 일정·인원을 자주 조정한다. 지금 문구로는 **사장이 오타를 고친 건지 일당을 깎은 건지 구분할 수 없고**, 공고에는 변경 이력이 남지 않으므로(job_postings 에 이력 컬럼 없음 — `modification_history` 는 work_logs 전용) 상세로 들어가도 **이전 값과의 대조가 원리적으로 불가능**하다. 출근일 분쟁의 씨앗이고, 수신자 폭이 지원자 전원이라 파급도 넓다.
**레포 계약과도 일치**: 같은 레포의 다른 트리거들이 SQL 안에서 한글 문장을 조립한다 — `notify_on_report_insert`(baseline:5087-5101)의 12분기 `v_type_label`, `20260731140000_notify_on_time_slot_change.sql` 의 `v_time_change_parts`. '**SQL 이 사람이 읽을 문장을 만든다**'가 확립된 계약이다. 반대로 클라에서 렌더하면 인앱 목록만 고쳐지고 **푸시 트레이는 여전히 무정보로 남으며**(EF 가 body 를 그대로 보냄), 한글 라벨 맵이 SQL·TS 양쪽에 복제돼 이 레포가 반복해 데인 판정 복제 패턴이 된다.

### 완성 비용
신규 마이그레이션 **1개** + TS **1줄**. 파일 2개, 함수 수 불변(파리티 184/111 무영향).
· `uniqn-mobile/supabase/migrations/<ts>_job_updated_notification_detail.sql`:
  ① `CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()` — **DROP 금지**(`20260731090000_revoke_public_execute_trigger_functions.sql:43` 의 PUBLIC EXECUTE 회수가 기본 GRANT 로 되살아난다).
  ② 헤더 `RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions','pg_temp'` 를 20260727000000:414-418 에서 **그대로 복사**(proconfig 는 CREATE OR REPLACE 의 SET 절로 통째 교체된다).
  ③ 취소(:431-443)·마감(:444-456) 분기는 **한 글자도 바꾸지 않고** 옮겨 적는다.
  ④ DECLARE 에 `v_changed_labels text[] := ARRAY[]::text[];` 추가, ELSE 분기의 각 IF 에서 영어 키와 한글 라벨을 **병행 적립**. 매핑: title→제목 / location→근무 장소 / workDate·workDates→근무일 / schedule→근무 시간 / compensation→급여 / roleCatalog→모집 직무·급여 / postingType→공고 유형. 중복은 `IF NOT ('근무일' = ANY(v_changed_labels)) THEN` 가드로 제거(`array_agg(DISTINCT …)` 는 정렬 부작용으로 라벨이 가나다순이 되어 중요도 순서가 깨진다). 적립 순서는 **중요도순(급여·근무일·근무 시간 먼저)** — NotificationItem.tsx:101 이 `numberOfLines={2}` 로 자른다.
  ⑤ body 교체: `format('''%s'' 공고의 %s이(가) 변경되었습니다. 확인해 주세요.', COALESCE(NEW.title,'공고'), array_to_string(v_changed_labels,'·'))`.
  ⑥ data 는 **하위호환** — 기존 `changedFields`(영어) 키를 그대로 두고 `changedFieldLabels`(한글)를 추가. 기존 키를 바꾸면 이미 쌓인 알림 행과 계약이 갈라진다.
  ⑦ 한글이 SQL 파일에 들어가므로 **Edit/python 으로 작성**(PS5 Set-Content 금지 — 07-24 인코딩 사고).
· `uniqn-mobile/src/types/notification.ts:278` `[NotificationType.JOB_UPDATED]: 'low'` → `'normal'` (DB 가 쓰는 값과 표기 일치). ⚠️ **이 상수는 죽지 않았다** — `NotificationRepository.ts:77,109` 와 `src/utils/notificationGrouping.ts:139` 가 실소비한다. 다만 용도가 그룹 정렬 폴백뿐이라 low→normal 의 행동 변화는 0.
· 선택(별도 판단): priority 승격 `v_notif_priority := CASE WHEN v_changed_fields && ARRAY['compensation','roleCatalog','schedule','workDate','workDates'] THEN 'high' ELSE 'normal' END` — EF index.ts:161 이 'high' 만 Expo 우선순위로 올린다. 아래 openQuestion 참조.

### 깨지는 것
· 🚨 **가장 큰 위험은 조용한 실패다.** 이 함수는 `job_cancelled`(:431-443)·`job_closed`(:444-456) 도 담당하는데 통째 재정의라 오타 하나로 **취소·마감 알림까지 죽고**, `EXCEPTION WHEN OTHERS`(:522-524)가 이를 WARNING 으로만 남긴다. 07-27 사고가 정확히 이 형태였다(누적 0건인데 아무도 몰랐다). **정적 파싱으로는 원리적으로 못 잡는다** — 재정의 후 3분기를 각각 실제 UPDATE 로 관측하는 것이 유일한 방어다.
· `SET search_path TO 'public','extensions','pg_temp'` 누락 시 `uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql:136-145` red.
· `DROP FUNCTION` 사용 시 `20260731090000_revoke_public_execute_trigger_functions.sql:43` 의 EXECUTE 회수 무효화. `CREATE OR REPLACE` 는 ACL 을 보존하지만 적용 후 `pg_proc` ACL 재조회 1회 권장.
· `location` 은 jsonb 통째 비교(:462)라 **하위 키가 하나만 늘어도 '근무 장소 변경'으로 잡힌다** → 향후 주소 작업(감사 후속 M9 주소 소거·B2)이 기존 job_postings 행을 백필하면 전 공고 지원자에게 오탐 알림이 대량 발사된다. 그때 `ALTER TABLE public.job_postings DISABLE TRIGGER job_posting_notify_update` → 백필 → ENABLE 장치가 필요하다. **B1(PR #391)은 마이그 0건이라 지금은 무관**(실측).
· 라벨 중복 제거를 빠뜨리면 workDate+workDates 동시 변경 시 '근무일·근무일'이 사용자에게 노출된다 — 두 컬럼은 함께 갱신되는 경우가 흔하다.
· 클라 파급 사실상 0: `changedFields` 소비처 0(src·app·e2e 전수), TS 변경 1줄. 트리거 정의·테이블·RLS 무변경.
· 트리거 중복 없음 확인 필요(같은 테이블·타이밍·이벤트).

### 검증 명령
```
node scripts/graph-db-deps.mjs triggers   # 적용 전 job_postings AFTER UPDATE 중복 확인 (레포 루트에서) → npm run db:reset 후 로컬에서 ① compensation 만 UPDATE ② status→cancelled ③ status→closed 3경로 실행하고 `SELECT type,title,body,priority,data FROM notifications ORDER BY created_at DESC LIMIT 5` 로 실측 → npx tsc --noEmit
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
data.changedFields 키의 리더는 0 재확인(Grep 도구 전수: SQL 3파일 — 현행 20260727000000:500·baseline:5037·archive:116 뿐, src/app/e2e/scripts 0건). 뉘앙스 2건 보강: ① v_changed_fields 배열 자체는 죽지 않았다 — :485 의 array_length 게이트가 '변경 0이면 알림 자체를 안 낸다'는 살아있는 판정에 쓰인다. 죽은 건 :500 의 직렬화 출력뿐(조사 결론과 일치) ② EF 는 body 만 트레이에 싣지만 buildMessage(:168-173)가 notification.data 를 푸시 페이로드에 spread 하므로 changedFields 는 기기까지 배달은 된다 — 다만 클라에서 읽는 코드 0(JOB_UPDATED 라우트는 jobPostingId 만, 렌더는 NotificationItem:101-106 body 전용). '전달 경로에서 폐기' 판정 유효.

### ⚖️ 검증 — 판정 심사 (동의)
완성 동의 — 단 실행 조건 2개. 비용 구조 논증은 실측으로 성립(PL/pgSQL 부분수정 불가, 키 한 줄 빼기도 :413-526 3분기 통째 재정의 필요 — 제거는 동비용·동리스크에 산출물만 없음). 레포 계약(notify_on_report_insert 12분기 v_type_label, 20260731140000 시각변경 알림)과도 일치. 조건: ① 완성은 죽은코드 정리 웨이브에 섞지 말고 별도 기능 PR 로 — 07-27 사고와 동형의 조용한 실패 리스크(EXCEPTION WHEN OTHERS :522-524 가 3분기 전체를 삼킴)를 정리 커밋에 얹으면 회귀 원인 추적이 흐려진다. 정리 웨이브 관점에선 '유지(현상 무변경)'가 무해한 차선임을 명시해 둔다 ② 재정의 후 취소·마감·수정 3분기를 실제 UPDATE 로 각각 관측하는 게이트는 타협 불가(정적 파싱 원리적 무력 주장 동의).

### 🛡️ 검증 — 삭제 안전성
삭제 목록 공란이 맞다(완성 판정이므로). 지우면 안 되는 것: 8필드 IS DISTINCT FROM 비교(:459-482)·:485 게이트·취소(:431-443)/마감(:444-456) 분기·status 의도적 제외(:483, capacity_full 폭탄 방지). 완성 시 주의 실측 보강: ① SET search_path TO 'public','extensions','pg_temp' 는 현행 정의 :417 에 존재 — 새 정의가 반드시 복사(누락 시 parity_baseline_guard red 주장 타당) ② CREATE OR REPLACE 로 ACL 보존(20260731090000 EXECUTE 회수 무효화 방지) 동의 ③ 트리거 중복: scripts/graph-db-deps.mjs triggers 직접 실행 결과 job_postings AFTER UPDATE 에 notify 계열 3개(owner_expired/update/tournament_approval) — 수신자·관심사가 달라 중복 아님으로 보이나 완성 PR 에서 최종 human review 필요(0건 아님을 확인함) ④ location jsonb 통째 비교(:462)의 주소 백필 오탐 경고와 DISABLE TRIGGER 장치 동의, B1(#391) 마이그 0건 무관 실측 신뢰 ⑤ workDate/workDates 라벨 중복 제거 동의 ⑥ 선택: TS NOTIFICATION_DEFAULT_PRIORITY 의 JOB_UPDATED 'low'(:278) vs SQL 'normal'(:496) 드리프트를 완성 PR 에서 한 방향으로 정렬 권장 ⑦ 마이그는 MCP apply_migration 경유(프로젝트 규칙), 기존 마이그 파일 수정 금지 — 새 타임스탬프 마이그로.

### 🙋 사람이 결정할 것
① **급여·근무시간이 바뀌었을 때 확정자에게 '확인만' 시킬 것인가, 재동의/취소 경로를 함께 열 것인가.** 선례가 있다 — `20260731140000_notify_on_time_slot_change.sql` 은 출근 시각 변경 알림에 `applicationId` 를 실어 스케줄 상세 모달의 '취소 요청' 버튼까지 정밀 착지시키고, 그 파일 주석이 "무음 변경 금지의 짝은 거부할 수 있는 경로다"라고 원칙을 명시한다. 공고 급여 변경은 출근 시각 변경보다 파급이 크다. 적용한다면 현재 `SELECT DISTINCT a.applicant_id`(:511)를 행별 applicationId 도 뽑도록 바꿔야 한다(추가 작업 S). ② **priority 승격 여부** — 급여·직무·일정·근무일 5축만 'high' 로 올릴지. 대상이 지원자 전원이고 대회사 D-7 시즌엔 조정이 잦아 알림 피로 위험이 있다.



---

# D-낙관갱신死코드


## `D1` — 판정: **완성**

**대상 심볼**

uniqn-mobile/src/hooks/useNotifications.ts:334-385 `useDeleteNotification` — 스토어 구조분해 336행, `onMutate` 346-357행(`shouldApplyOptimisticUpdate` 게이트 347, 스냅샷 351, `removeNotification(id)` 354), `onError` 롤백 365-377행(`setNotifications(context.previousNotifications)` 370)

### 원래 의도 (왜 만들었나)
**설계 근거 없음.** 도입 커밋은 `7189755f9`(2026-01-06) "fix(mobile): TypeScript 및 ESLint 에러 수정" — 커밋 본문 8개 항목(ApplicationForm 인수·ApplicantCard hooks 위치·ValidationError·타입 추가…) 어디에도 낙관 갱신 언급이 없다. 무관한 정리 커밋에 끼어 들어왔다. `docs/superpowers/specs/`·`docs/superpowers/plans/`·`docs/decisions/`·`wiki/` 전수 grep 결과 알림 낙관 갱신을 다룬 설계문서 0건. 의도의 유일한 1차 증거는 코드 주석 `// Optimistic Update: 서버 응답 전에 UI 즉시 업데이트`(345행) 한 줄뿐. 사후 해석은 `docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:1062` — "개별 삭제는 '옵티미스틱을 넣었으니 확인 게이트가 불필요하다'고 판단된 흔적".

### 흐름이 끊긴 시점
**끊긴 적이 없다 — 애초에 안 이어졌다. 이것이 이 묶음의 결론이다.** 파일 최초 커밋 `20fc40d4b`(2025-12-20, feat(mobile): Phase 3 P1 인앱 알림 시스템 구현) 시점에 `useNotificationList` 반환값은 **이미** `notifications: query.data ?? []`(그 리비전 131행)였고, 그때 `removeNotification` 은 `onSuccess` 에 있었다(정상 동작). 한 달 뒤 `7189755f9` 가 `onSuccess`→`onMutate` 로 끌어올리며 **사산**시켰다(`git show 7189755f9` diff 실측). `effectiveNotifications` 는 그보다 **더 나중**인 `4425aa31f`(2026-02-01, refactor: 알림 시스템 통합 및 설정 화면 개선)에 들어왔고, 하는 일은 오프라인 폴백을 덧댄 것뿐이다 — 회로를 끊은 범인이 아니다. → **"예전엔 리스트 소스가 스토어였는데 나중에 query.data 로 바뀐 것인가?" 답: 아니다. 스토어가 온라인 렌더 소스였던 적은 단 한 순간도 없다.**

### 지금 살아 있는 코드 흐름
온라인: NotificationItem.tsx:120 삭제 Pressable → notifications.tsx:94 `handleDelete` → useNotifications.ts:334 `useDeleteNotification.mutate` → **[분기A 화면]** useNotifications.ts:219-224 `effectiveNotifications` = `query.data`(온라인 승자) → :699-705 `groupNotificationsWithCategoryFilter` → notifications.tsx:202 `NotificationList data=` → **행 그대로 남음** / **[분기B 카운터]** onMutate:354 `removeNotification` → notificationStore.ts:368-386 → :375 `decrementUnreadCounts` → `unreadCount`·`unreadByCategory` 즉시 감소 → TabHeader.tsx:27 배지 + notifications.tsx:73→197 카테고리탭 **즉시 감소** / **[분기C 서버]** mutationFn:342 → notificationReadStateService.ts:206 `deleteNotification` → `NotificationRepository.delete` 하드 DELETE → :210 `decrementUnreadCounterWithRetry(1)` → onSuccess:359 `invalidateQueries(['notifications'])` → 재조회 완료 후에야 행 소멸 → useNotifications.ts:152-156 effect 가 `setNotifications(query.data)` 로 스토어 덮어씀.\n오프라인: mutationFn:341 `requireOnlineForMutation` 이 NetworkError throw → onMutate 도 게이트 347 에서 조기 반환 → 뮤테이션 자체가 성립 안 함.

### 죽은 부분
**완전 死코드가 아니라 반쪽만 죽어서 화면 불일치를 만든다** — 이게 순수 死코드보다 나쁘다.\n• `removeNotification(id)`(354) 의 **목록 축 = 死**. 온라인 렌더가 `query.data` 라 스토어 변경이 리스트에 도달하지 않는다(219-224 실측).\n• 같은 호출의 **카운터 축 = 生**. `decrementUnreadCounts`(store 375)가 배지·카테고리탭을 즉시 줄인다. 소비처 grep 확인: TabHeader.tsx:27(`useUnreadCount`), notifications.tsx:73(`state.unreadByCategory`)→197.\n→ 사용자 체감: **휴지통을 누르면 '정산' 탭 숫자만 3→2로 줄고, 정작 그 알림 행은 화면에 그대로 있다가 몇 백 ms 뒤 사라진다.**\n• `previousNotifications` 스냅샷(351)+`onError` 롤백 `setNotifications`(370) 의 **목록 축 = 死**(같은 이유). 카운터 축만 복원.\n• `shouldApplyOptimisticUpdate()` 게이트(347) 는 이 훅에서는 **항상 true**(오프라인이면 mutationFn 이 먼저 throw 하므로) — 이 훅 한정 무의미 분기.

### 판정 근거
**제품 근거**: 알림 행은 푸시 페이로드의 **유일한 영속 사본**이다(`notification.data` 에 applicationId·jobPostingId·확정 근무 날짜가 들어 있고 딥링크가 이걸 읽는다 — useDeepLink.ts:196-199). 삭제는 확인 다이얼로그도 되돌리기도 없는 하드 DELETE 다(notificationReadStateService.ts:206-219). 타깃 사용자는 지하 홀덤펍·대회장의 열악한 회선에서 이걸 누른다. 지금은 눌러도 행이 안 사라지므로 **다시 누른다** — 두 번째 DELETE 는 이미 없는 행이라 조용히 통과하고 성공 토스트만 한 번 더 뜬다. 즉 지금 상태가 실제 오조작을 유도한다.\n**제거를 기각한 이유**: 낙관 체인을 통째로 지우면 카운터 축의 즉시 피드백까지 사라져, 파괴적·비가역 액션에 대해 서버 왕복 1회(체감 300~800ms, 3G 에선 그 이상) 동안 **피드백이 0** 이 된다. 그리고 `docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:1080-1095` 가 이미 확정한 되돌리기(Undo) 설계는 **렌더 소스를 패치할 수 있어야** 성립한다 — 제거하면 그 설계의 전제를 없앤다.\n**비용 근거**: 발명이 아니라 복붙이다. 같은 레포에 올바른 배선이 **두 곳** 선재한다 — useJobManagement.ts:194-209(`cancelQueries`→`getQueryData`→`setQueryData(filter)`), useApplications.ts:194-215. 둘 다 같은 `shouldApplyOptimisticUpdate()` 게이트를 쓴다. 리스트 쿼리키도 단순하다: `useGroupedNotifications`→`useNotificationList({enabled})` 는 filter 를 안 넘기므로 키가 `['notifications','list',{}]` 로 고정(useNotifications.ts:101, queryClient.ts:265-271).

### 완성 비용
파일 1개(`src/hooks/useNotifications.ts`) 약 15줄 교체 + 테스트 1파일 보강. 마이그레이션 0건. 구체: onMutate 를 `await queryClient.cancelQueries({queryKey: notificationKeys.list({})})` → `getQueryData<NotificationData[]>` → `setQueryData(키, prev.filter(n=>n.id!==id))` 로 바꾸고, 기존 `removeNotification(id)` 는 **카운터 축 유지 목적으로 남긴다**. onError 롤백은 `setQueryData(키, previous)` + 기존 `setNotifications` 병행. 주의: `useNotificationList` 는 filter 인자를 받을 수 있으므로(83-101행) 쿼리키를 훅 안에서 상수로 박지 말고 `notificationKeys.lists()` prefix 로 `setQueriesData` 를 쓰는 편이 안전하다.

### 깨지는 것
• `src/__tests__/hooks/useNotifications.test.ts` — **안 깨진다**. 스토어 목이 `removeNotification: mockRemoveNotification`(103·118행)로 배선돼 있으나 **단언이 0건**(grep `mockRemoveNotification` → 98·103·118행 정의/배선만). 삭제 실패 테스트(641-659)는 에러 토스트만 단언한다.\n• 배럴 `src/hooks/index.ts:63` 은 훅 이름만 재export — 반환 시그니처(`deleteNotification`/`isDeleting`/`error`) 유지하면 무해.\n• 화면 테스트 `app/(app)/__tests__/NotificationsScreen.test.tsx:54` 는 `useDeleteNotification: () => ({ deleteNotification: jest.fn() })` 로 목킹 — 키 이름 유지 필요.\n• `e2e/` — **커버리지 0**. `e2e/pages/app/notifications.page.ts` 전문 확인 결과 삭제 관련 locator·메서드가 없다(header/markAllRead/카테고리탭/빈상태/에러상태만). `e2e/tests/p2-standard/notifications.spec.ts` 도 삭제 시나리오 없음.\n• DB·Edge Function·딥링크 파서 — 무관(클라 캐시 전용 변경).\n• 베이스라인 실측: `npx jest src/hooks/__tests__/useNotifications.deleteAll.test.ts src/__tests__/hooks/useNotifications.test.ts` → **2 suites / 45 tests 전부 통과**(11.1s).

### 검증 명령
```
npx jest src/__tests__/hooks/useNotifications.test.ts "app/(app)/__tests__/NotificationsScreen.test.tsx" && npx tsc --noEmit
```

### 🔍 검증 — 놓친 소비처 재수색 (일부생존)
없음(신규). 실측 확인: e2e/pages/app/notifications.page.ts 에 delete 계열 locator 0건·e2e 전체에 notifications-delete 참조 0건, supabase/functions 0건, 동적 문자열 키 접근 0건, 배럴 src/hooks/index.ts:63 은 훅 이름 재export 뿐(반환 키 유지 시 무해), NotificationItem.tsx:119-124 삭제 Pressable→notifications.tsx:94 handleDelete 배선 실재, 카운터 축 소비처 TabHeader.tsx:27·notifications.tsx:73→197 실재. useNotifications.test.ts 의 mockRemoveNotification 은 98·103·113·118행 정의/배선만으로 단언 0건 확인(보고서는 113행 누락, 무해). 베이스라인 '2 suites/45 tests 통과' 직접 재현 완료(10.6s).

### ⚖️ 검증 — 판정 심사 (동의)
완성(제거 기각)에 동의 — 낙관 갱신 주석의 약속(345행)과 렌더 소스(query.data, 219-224행 실측)의 괴리, 하드 DELETE(notificationReadStateService.ts:206-219 실측)의 비가역성, git 실측(7189755f9 가 onSuccess→onMutate 이동, 최초 리비전 반환값 query.data??[] 모두 diff 로 확인) 전부 사실. 단 두 가지 교정: ① '게이트 347 은 이 훅 한정 항상 true' 는 기전 오류 — TanStack Query 는 onMutate 가 mutationFn 보다 먼저 실행되므로 오프라인 탭도 onMutate 에 도달하고, 게이트(shouldApplyOptimisticUpdate=isNetworkAvailableForMutation 실측)가 오프라인 카운터 선반영을 막는 실역할을 한다. 완성 시 이 게이트를 '무의미'라며 제거하면 오프라인 배지 깜빡임 회귀. ② '복붙이면 끝(비용 0)'은 낙관 — fetchNextPage 가 스토어에만 append(208행) 하므로 2페이지 이후 항목은 setQueryData(list 키)만으론 못 지운다(deepdive 문서 검증②도 동일 지적). D7·D8 방향과 같은 PR 계획 안에서 설계해야 한다. '최초엔 onSuccess 라 정상 동작'도 반은 관대한 서술 — 목록 축은 태어날 때부터 렌더에 안 닿았고, onSuccess 배치는 단지 무해했을 뿐이다(카운터 선반영+invalidate 가 실동작).

### 🛡️ 검증 — 삭제 안전성
삭제 목록 공란(완성 판정)이라 직접 위험 없음. 깨질것 목록 검증: NotificationsScreen.test.tsx:54 목 키(deleteNotification) 실재, e2e 커버리지 0 실측 일치, DB/EF/딥링크 무관 동의(딥링크는 useDeepLink.ts:196-197 이 notification.data·link 를 읽는 소비자일 뿐 훅 내부와 무결합). 주의 추가: 완성 구현이 requireOnlineForMutation 위치나 shouldApplyOptimisticUpdate 사용을 바꾸면 useNotifications.deleteAll.test.ts:85 목과 useJobManagement.test.ts:104 목이 아니라 알림 쪽 테스트만 갱신 범위인지 재확인할 것.

### 🙋 사람이 결정할 것
되돌리기(Undo)까지 이번에 붙일 것인가, 아니면 낙관 배선만 먼저 고칠 것인가. deepdive 문서는 5초 Undo 창을 제안하지만(1080-1095행) 알림은 스크롤하며 연속으로 지우는 패턴이라 토스트를 건별로 쌓을지 '3건 삭제 · 되돌리기'로 합칠지가 제품 결정이다. 또 Undo 를 넣으면 realtime invalidate(137행)가 삭제 대기 항목을 되살리는 경합을 별도로 막아야 한다.


## `D2` — 판정: **완성**

**대상 심볼**

uniqn-mobile/src/hooks/useNotifications.ts:394-442 `useDeleteAllNotifications` — 스토어 구조분해 397행, `onMutate` 407-414행(게이트 408, 스냅샷 411, `clearNotifications()` 412), `onError` 롤백 422-434행(`setNotifications` 427)

### 원래 의도 (왜 만들었나)
도입 커밋 `b02d02be5`(2026-07-25) "fix(notifications): 중복 알림 트리거 정리 + 알림설정 화면 분리 + 모두삭제 (#328)". `git show` diff 로 확인한 결과 **D1 의 죽은 패턴을 그대로 복제**했다 — 주석까지 같은 어투(`// Optimistic Update: 서버 응답 전에 목록·카운터 즉시 초기화`, 406행). #328 에는 이 훅에 대한 설계문서가 없다(`docs/` 전수 grep 0건). 다만 이쪽은 테스트를 함께 넣었다(`src/hooks/__tests__/useNotifications.deleteAll.test.ts`, 5건) — 즉 **작성자는 낙관 갱신이 동작한다고 믿었고 테스트도 그렇게 믿게 썼다**(스토어 목의 `clearNotifications` 호출만 단언, 렌더 소스는 안 봄).

### 흐름이 끊긴 시점
태어날 때부터 안 이어졌다(2026-07-25). 도입 시점에 이미 `effectiveNotifications`(2026-02-01 도입)가 온라인에서 `query.data` 를 채택하고 있었다. `git log -S"previousNotifications" -- src/hooks/useNotifications.ts` 결과 3커밋(b02d02be5 / 0bfbbf6ad / 7189755f9) 중 이게 가장 나중 — **이미 죽어 있던 패턴을 6개월 뒤 복제한 것**이다.

### 지금 살아 있는 코드 흐름
notifications.tsx:107-118 `handleDeleteAll` → `confirmAction`(파괴적 확인 다이얼로그 — 개별 삭제와 달리 여기엔 있다) → :115 `deleteAllNotifications()` → useNotifications.ts:400 → **[화면]** effectiveNotifications=query.data → 리스트 **20개 그대로 남음** / **[카운터]** onMutate:412 `clearNotifications()` → notificationStore.ts:388-396 → `unreadCount:0`·`unreadByCategory` 전부 0 → TabHeader.tsx:27 배지 **즉시 0** + notifications.tsx:197 카테고리탭 **즉시 전부 0** / **[서버]** mutationFn:404 → notificationReadStateService.ts:236-243 `deleteAllNotifications` → `deleteAllByRecipient` → :241 `resetUnreadCounterWithRetry([], userId)` → onSuccess:416 invalidate → 재조회 후 목록 비워짐.

### 죽은 부분
D1 과 **완전히 같은 클래스**다.\n• `clearNotifications()`(412) 의 **목록 축 = 死**, **카운터 축 = 生**. → 체감: "모두 삭제"를 누르면 **모든 카테고리 탭 숫자가 즉시 0 이 되는데 알림 20개는 여전히 화면에 꽉 차 있다.** D1 보다 시각적으로 더 이상하다(0 옆에 20개가 보임).\n• `previousNotifications`(411) + `onError` 롤백 `setNotifications`(427) 의 목록 축 = 死.\n• `shouldApplyOptimisticUpdate()` 게이트(408) = D1 과 동일하게 이 훅 한정 항상 true.

### 판정 근거
**제품 근거**: '모두 삭제'는 확인 다이얼로그를 거친 명시적 일괄 파괴 액션이다(impeccable §12 기준으로 다이얼로그가 맞는 자리 — deepdive:1074 도 같은 판정). 사용자는 "삭제됩니다"를 확인하고 눌렀는데 목록이 그대로면 **실패했다고 읽는다**. 게다가 지금은 카운터만 0 이 되어 "숫자는 0인데 목록은 20개"라는, 어느 쪽도 못 믿을 상태를 만든다.\n**제거 기각**: 카운터 즉시 0 은 유일하게 남은 피드백이라 이것까지 지우면 무피드백이 된다. 그리고 D1 과 같은 파일·같은 패턴이므로 **한쪽만 고치면 이름 닮은 두 훅의 동작이 갈린다** — 이 레포가 실제로 당한 실패(SettlementCard vs GroupedSettlementCard, `isSettlableWorkLogStatus` 소비처 2곳 누락)의 재판이다. D1 과 반드시 같은 PR 에서 함께 처리한다.\n**비용**: D1 배선의 특수 케이스(`setQueryData(키, [])`)라 추가 설계 0.

### 완성 비용
같은 파일 약 8줄. onMutate 에 `cancelQueries` + `getQueryData` 백업 + `setQueriesData({queryKey: notificationKeys.lists()}, [])`, onError 에 `setQueryData(키, previous)` 추가. `clearNotifications()` 는 카운터 축 유지 목적으로 존치. 마이그 0건.

### 깨지는 것
🚨 **여기서 실제로 깨진다.** `uniqn-mobile/src/hooks/__tests__/useNotifications.deleteAll.test.ts` (5 tests) 중 3건이 낙관 체인을 직접 단언한다 — :164 `onMutate는 목록 스냅샷을 남기고 스토어를 즉시 초기화한다`(`expect(mockClearNotifications).toHaveBeenCalledTimes(1)`), :174 `낙관적 업데이트 비활성 시 onMutate는 스토어를 건드리지 않는다`, :185 `onError는 스냅샷으로 롤백하고 에러 토스트를 띄운다`(`expect(mockSetNotifications).toHaveBeenCalledWith(previous)`). 배선을 setQueryData 로 옮기면 이 3건을 갱신해야 한다.\n⚠️ **선행 감사문서 정정**: `docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:1112` 는 "인용 오류 1건: src/__tests__/hooks/useNotifications.deleteAll.test.ts 는 존재하지 않는다(디렉토리 전수 확인)"라고 적었으나 **오판**이다 — 파일은 `src/hooks/__tests__/useNotifications.deleteAll.test.ts`(디렉토리가 다름)에 실재하며 낙관 체인을 단언하는 5개 테스트를 품고 있다. 그 문서를 근거로 "테스트 파급 없음"이라 판단하면 CI red 가 난다.\n• `app/(app)/__tests__/NotificationsScreen.test.tsx:55-57` — `useDeleteAllNotifications` 를 `{deleteAllNotifications, isDeletingAll}` 로 목킹, 키 유지 필요.\n• e2e 0건, DB/EF 무관.

### 검증 명령
```
npx jest src/hooks/__tests__/useNotifications.deleteAll.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (일부생존)
없음(신규). notifications.tsx:107-118 confirmAction 경유 배선·testID notifications-delete-all 실재하나 e2e 전체 grep 에서 참조 0건 확인. 카운터 축(clearNotifications→unreadCount 0→TabHeader:27·카테고리탭 197) 생존 확인. deepdive 문서 1112행 부근의 '테스트 파일 부재' 기재가 오판이라는 보고서 정정을 실측으로 재확인 — src/hooks/__tests__/useNotifications.deleteAll.test.ts 는 실재하며 방금 실행에서 통과했다(45 tests 베이스라인에 포함).

### ⚖️ 검증 — 판정 심사 (동의)
완성 + D1 과 동일 PR 처리에 동의. 확인 다이얼로그를 거친 일괄 파괴 후 '숫자 0 인데 목록 20개' 불일치는 코드 실측과 정합(clearNotifications 는 store:388-396, 렌더는 query.data). 같은 파일의 이름 닮은 두 훅이 갈리면 안 된다는 근거도 이 레포 실사고 이력과 부합. 단 D1 과 동일한 교정 적용: 게이트 408 은 '항상 true 무의미'가 아니라 오프라인 onMutate 선실행을 막는 생존 분기다 — 완성안에서 유지하거나 의도적으로 대체 설계할 것.

### 🛡️ 검증 — 삭제 안전성
🚨 테스트 파급 주장 정밀 검증 완료 — useNotifications.deleteAll.test.ts 의 단언 실제 위치는 167행(clearNotifications 1회)·177행(비활성 시 미호출)·189행(setNotifications 롤백)으로 보고서의 테스트명 라인(164·174·185)과 정합. 배선을 setQueryData 로 옮기면 이 3건 갱신 필수라는 판단 동의. NotificationsScreen.test.tsx 실제 목은 55-58행({deleteAllNotifications, isDeletingAll}) — 키 유지 필요 동의. 특히 177행 테스트(낙관 비활성 시 스토어 불변)는 게이트 존치의 회귀 방지 장치이므로 완성 시 삭제하지 말고 setQueryData 기준으로 이식할 것.


## `D3` — 판정: **유지**

**대상 심볼**

uniqn-mobile/src/hooks/useNotifications.ts:253-282 `useMarkAsRead`(`markAsReadLocal` 255·265행) · :291-325 `useMarkAllAsRead`(`markAllAsReadLocal` 294·304행) · notificationStore.ts:402-425 `markAsRead` / :427-441 `markAllAsRead`

### 원래 의도 (왜 만들었나)
최초 커밋 `20fc40d4b`(2025-12-20) 부터 지금까지 **구조가 바뀐 적 없다**. 처음부터 `onSuccess` 에 스토어 로컬 반영을 두는 설계였고 그대로다. 별도 설계문서는 없으나 의도가 코드에서 자명하다 — 서버 응답 성공 후 배지·카테고리 카운터를 refetch 완료 전에 미리 맞춘다.

### 흐름이 끊긴 시점
해당 없음 — 끊긴 적도, 안 이어진 적도 없다. **낙관 갱신이 아니다.** `onMutate` 가 아니라 `onSuccess`(264·303행)이므로 애초에 '서버 응답 전 선반영' 이라는 주장을 하지 않는다.

### 지금 살아 있는 코드 흐름
경로1(그룹 읽음): notifications.tsx:53 `markGroupAsRead` → useNotifications.ts:713-721 → :718 `markAsRead(id)` → :258 mutation → mutationFn:260-262 `requireOnlineForMutation`+`markAsReadService` → notificationReadStateService.ts:179-189 → `NotificationRepository.markAsRead` → onSuccess:265 `markAsReadLocal` → notificationStore.ts:402-425 → `decrementUnreadCounts`(412) → **TabHeader.tsx:27 배지 + notifications.tsx:73→197 카테고리탭 즉시 갱신 = 生** / 동시에 :266 invalidate → 재조회 → 리스트 행의 읽음 스타일 갱신.\n경로2(항목 탭): NotificationItem Pressable → notifications.tsx:86-91 → useDeepLink.ts:170-205 `handleNotificationPress` → :180 **서비스 `markAsRead` 직접 호출**(훅 아님, useDeepLink.ts:25 import) → 스토어도 쿼리캐시도 안 건드림 → useNotifications.ts:129-149 realtime 구독이 invalidate 를 쏴서 자가치유.

### 죽은 부분
**없다. 읽음 축은 같은 문제가 아니다** — 요청받은 필수 확인 결과다.\n근거: (1) `markAsReadLocal`(265)·`markAllAsReadLocal`(304)은 `onMutate` 가 아니라 `onSuccess` 에 있어 '낙관' 이 아니다. (2) 이들이 바꾸는 `unreadCount`/`unreadByCategory` 는 **실렌더 소비처가 있다** — TabHeader.tsx:27, notifications.tsx:73·197. (3) 리스트 행의 읽음 스타일은 `query.data` 에서 오지만, 같은 콜백의 invalidate(266·305)가 재조회를 걸므로 **의도된 지연**이지 死코드가 아니다.\n단, 같은 이원 구조의 잔여 증상은 있다: 성공 직후 **배지는 이미 줄었는데 리스트 행은 아직 미읽음 스타일**인 창이 존재한다(refetch 왕복 동안). 그리고 경로2(딥링크 탭)는 스토어를 아예 안 건드려 realtime 이 늦으면 배지가 더 오래 남는다.

### 판정 근거
제거할 死코드가 없고, 완성할 끊긴 회로도 없다. 배지·카테고리 카운터라는 실제 소비처를 향해 회로가 닫혀 있다. 리스트 행 스타일의 refetch 지연은 '읽음' 이 **비파괴·되돌릴 수 있는** 액션이라 사용자 위험이 없다(삭제와 결정적으로 다른 점). 여기에 setQueryData 를 더하는 것은 순수 추가 복잡도이고, 타깃 사용자에게 주는 이득이 '읽음 표시가 0.3초 빨리 회색이 된다' 뿐이다 — 근거로 부족하다.

### 깨지는 것
변경 없음. 참고로 `src/__tests__/hooks/useNotifications.test.ts:519` 가 `expect(mockMarkAsReadLocal).toHaveBeenCalledWith('notif-1')` 로 이 배선을 잠그고 있다 — 누군가 '일관성' 명목으로 D1·D2 와 함께 이쪽 `markAsReadLocal` 을 걷어내면 이 테스트가 red 로 잡는다.

### 검증 명령
```
npx jest src/__tests__/hooks/useNotifications.test.ts -t "useMarkAsRead"
```

### 🔍 검증 — 놓친 소비처 재수색 (살아있음)
없음. 경로1(markAsReadLocal onSuccess:265→store 402-425→decrementUnreadCounts:412→TabHeader:27·탭 197)·경로2(useDeepLink.ts:180 서비스 직접 호출, 스토어/캐시 무접촉) 모두 실측 일치. realtime 콜백이 invalidate 만 한다는 주장도 useNotifications.ts:136-142 로 확인. 테스트 잠금 주장 검증: useNotifications.test.ts:519 의 expect(mockMarkAsReadLocal).toHaveBeenCalledWith('notif-1') 실재(주의 — 내 1차 grep 은 대소문자 불일치로 놓쳤다. 목 이름이 mockMarkAsReadLocal 이라 markAsReadLocal 소문자 패턴이 미스매치. 이 파일을 나중에 감사할 때 같은 함정 주의).

### ⚖️ 검증 — 판정 심사 (동의)
유지 동의. onSuccess 배치는 낙관 갱신이 아니고, 카운터 축에 실렌더 소비처가 있으며, 읽음은 비파괴·가역이라 삭제와 위험 등급이 다르다는 논거 모두 타당. '일관성 명목의 동반 제거'를 :519 테스트가 red 로 잡는다는 방어선도 실재 확인.

### 🛡️ 검증 — 삭제 안전성
변경 없음 — 안전. 단 D6 이 selectMarkAsRead/selectMarkAllAsRead(646-647)·useNotificationReadActions(664-667)를 지울 때 이 훅들이 쓰는 것은 셀렉터가 아니라 useNotificationStore() 전체 구독(255·294행 실측)이므로 D3 경로는 무영향 — 교차 확인 완료.


## `D4` — 판정: **유지**

**대상 심볼**

uniqn-mobile/src/services/offline/remoteMutationGuard.ts:43-45 `shouldApplyOptimisticUpdate`

### 원래 의도 (왜 만들었나)
오프라인 뮤테이션 가드 세트의 일부. `git log -S` 로 6커밋 추적 — 최초는 `0bfbbf6ad`/`cfcc11a45`(2026-03-21), 이후 `bf03eec12`(#71) → `69c5184ee`(#158 지갑) → `967e9f5e2`(#196 지갑 제거) → `b02d02be5`(#328). 의도: 오프라인이면 낙관 갱신을 건너뛰어, 어차피 실패할 뮤테이션이 UI 를 흔들지 않게 한다.

### 흐름이 끊긴 시점
해당 없음 — 살아 있다.

### 지금 살아 있는 코드 흐름
useApplications.ts:195(지원 취소 onMutate) → 통과 시 :199 `cancelQueries` → :204 `getQueryData` → :206-214 `setQueryData(내 지원목록)` + :218-221 `setQueriesData(스케줄 캐시)` → 화면 즉시 반영 (**올바른 배선의 실례**)\nuseApplications.ts:280(두 번째 뮤테이션 onMutate)\nuseJobManagement.ts:194(공고 삭제 onMutate) → :198 `cancelQueries` → :199 `getQueryData` → :201-207 `setQueryData(내 공고목록, filter)` → onError 롤백 :224-229 (**두 번째 실례**)\nuseNotifications.ts:347·408 → (D1·D2 — 여기서만 스토어로 새어나가 死)

### 죽은 부분
**없다.** 헬퍼 자체는 3개 살아 있는 소비처를 가진다(useApplications 2, useJobManagement 1). 죽은 것은 헬퍼가 아니라 **알림 훅 2곳에서 게이트 뒤에 붙은 대상**이다.\n다만 알림 훅 한정으로 게이트가 **무의미**하다: 두 훅 모두 `mutationFn` 첫 줄이 `requireOnlineForMutation`(341·403)이라 오프라인이면 뮤테이션이 성립하지 않는다 → `shouldApplyOptimisticUpdate()` 는 이 두 훅에서 사실상 상수 true. (useApplications·useJobManagement 도 같은 구조이므로 이 관찰은 헬퍼 전반의 설계 질문이지 알림 고유 결함은 아니다.)

### 판정 근거
**절대 삭제 금지.** 소비처 3곳이 실제 화면 반영 경로에 배선돼 있고(useApplications.ts:206·218, useJobManagement.ts:201), 그 두 곳이 D1·D2 완성 시 복사할 정답 원본이다. 지우면 지원 취소·공고 삭제의 낙관 갱신이 함께 무너진다.

### 깨지는 것
`src/__tests__/hooks/useJobManagement.test.ts:104·536-539` 가 이 헬퍼를 목킹하고 `mockReturnValueOnce(true)` 로 `cancelQueries` 게이팅을 단언한다. `src/hooks/__tests__/useNotifications.deleteAll.test.ts:85` 도 목킹. 시그니처 변경 시 두 파일 동시 갱신 필요.

### 검증 명령
```
npx jest src/__tests__/hooks/useJobManagement.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (살아있음)
없음. 소비처 전수 실측: useApplications.ts:13·195·280, useJobManagement.ts:28·194, useNotifications.ts:36·347·408 + 목 2파일(useJobManagement.test.ts:104·536-539, useNotifications.deleteAll.test.ts:85). e2e·EF·동적 키 0건.

### ⚖️ 검증 — 판정 심사 (동의)
유지(절대 삭제 금지) 동의 — 올바른 배선 원본 2곳의 게이트라는 논거 실측 정합. 단 보고서의 부속 관찰 '이 게이트는 requireOnlineForMutation 구조상 사실상 상수 true(헬퍼 전반의 설계 질문)'는 기각한다: TanStack Query 실행 순서는 onMutate→mutationFn 이므로 오프라인 뮤테이션도 게이트에 실제로 걸리며(shouldApplyOptimisticUpdate=isNetworkAvailableForMutation, remoteMutationGuard.ts:43-45 실측), 게이트는 어차피 실패할 뮤테이션의 낙관 선반영·롤백 깜빡임을 막는 살아 있는 분기다. useApplications·useJobManagement 에서도 동일 — '설계 질문'이 아니라 의도대로 동작 중.

### 🛡️ 검증 — 삭제 안전성
삭제 없음 — 안전. 시그니처 변경 시 목 2파일 동시 갱신 필요 주장 실측 동의. 이 파일은 D 묶음 어느 완성안에서도 건드릴 이유가 없다.

### 🙋 사람이 결정할 것
알림 훅 2곳에서 `requireOnlineForMutation` 과 `shouldApplyOptimisticUpdate` 가 중복 판정이 되는데, 게이트를 남길지(다른 훅과의 형태 통일) 뺄지(정직) — 취향 문제라 사람 결정. 기능 영향 0.


## `D5` — 판정: **유지**

**대상 심볼**

uniqn-mobile/src/stores/notificationStore.ts — `removeNotification`(78·368-386) · `addNotification`(74·295-315) · `clearNotifications`(78·388-396) · 내부 헬퍼 `incrementUnreadCounts`(183-204) / `decrementUnreadCounts`(211-232)

### 원래 의도 (왜 만들었나)
최초 커밋 `20fc40d4b`(2025-12-20) 동시 도입. 증분 카운터 헬퍼는 `7a997de72`(2026-02-02, refactor(mobile): 코드 통합 및 성능 최적화)에서 O(n) 전체 재계산을 O(1) 로 바꾼 것 — 주석 179-182·206-210행이 그 의도를 명시.

### 흐름이 끊긴 시점
해당 없음.

### 지금 살아 있는 코드 흐름
`addNotification` → **usePushNotificationSetup.ts:158 `useNotificationStore.getState().addNotification(notificationData)`** (푸시 수신 시 목록·카운터에 즉시 반영) → store:302 `incrementUnreadCounts` → 배지 증가. **살아 있다.**\n`incrementUnreadCounts` ← addNotification(302)·updateNotification(351) 소비. `decrementUnreadCounts` ← updateNotification(346)·removeNotification(375)·markAsRead(412) 소비. 둘 다 모듈 내부 함수(export 아님).\n`removeNotification` ← useNotifications.ts:354 **단 하나**(D1). `clearNotifications` ← useNotifications.ts:412 **단 하나**(D2).\n(참고: `src/utils/supabase.ts:454` 의 `addNotification` 언급은 realtime 사용 예시를 적은 **JSDoc 주석**이지 실제 호출이 아니다 — 오탐 주의.)

### 죽은 부분
**없다 — 이 묶음은 지우면 안 된다.** 요청받은 확인("실시간 구독·푸시 수신에서도 쓰이는지") 결과:\n• `addNotification` = **푸시 수신 경로에서 실사용**(usePushNotificationSetup.ts:158). 삭제 시 포그라운드 푸시가 배지·목록에 안 잡힌다.\n• `incrementUnreadCounts`/`decrementUnreadCounts` = 모듈 내부 5곳이 소비. 삭제 불가.\n• `removeNotification`/`clearNotifications` = 소비처가 D1·D2 뿐이지만, **D1·D2 를 '완성'으로 판정했고 완성안이 이들을 카운터 축으로 계속 쓰므로 존치**. (만약 D1·D2 를 '제거'로 뒤집는다면 이 둘도 고아가 되어 함께 삭제 대상이 된다 — 판정 연동됨.)

### 판정 근거
실시간/푸시 경로에 소비처가 실재하므로 삭제하면 기능이 죽는다. `removeNotification`·`clearNotifications` 는 D1·D2 완성안의 카운터 축 구성요소로 계속 필요하다. 다만 realtime 구독 쪽은 확인 결과 **콜백이 invalidate 만 한다**(useNotifications.ts:136-142) — 스토어를 안 건드린다. 즉 '실시간 구독도 쓴다'는 가정은 실측상 **거짓**이었고, 실사용은 푸시 수신 한 곳이다.

### 깨지는 것
`src/stores/__tests__/notificationStore.test.ts` 가 이 액션들을 광범위하게 단언한다(addNotification 176-214, removeNotification·clearNotifications 등). 변경 없으므로 파급 0.

### 검증 명령
```
npx jest src/stores/__tests__/notificationStore.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (살아있음)
보고서 목록에 더해 스토어 소비처 1곳 추가 발견 — pushNotificationHandlers.ts:21·137 이 useNotificationStore.getState().settings 를 읽는다(포그라운드 표시 게이트). 삭제 대상 심볼과는 무관하지만 '스토어 소비처 전수' 목록에는 빠져 있었다. addNotification=usePushNotificationSetup.ts:158 실사용, increment/decrementUnreadCounts 내부 5소비처, removeNotification/clearNotifications 소비처가 D1·D2 뿐, supabase.ts:454 는 JSDoc 예시(오탐), realtime 콜백은 invalidate 전용 — 전부 실측 재확인.

### ⚖️ 검증 — 판정 심사 (동의)
유지 동의. '실시간 구독도 스토어를 쓴다'는 통념을 실측으로 기각하고 실사용을 푸시 수신 한 곳으로 특정한 것도 정확. D1·D2 판정과의 연동(제거로 뒤집히면 removeNotification/clearNotifications 고아화) 명시도 적절. 참고: D6 이 updateNotification 을 지워도 increment(302)/decrement(375·412) 소비처가 남아 내부 헬퍼는 안전 — 교차 확인 완료.

### 🛡️ 검증 — 삭제 안전성
삭제 없음 — 안전. notificationStore.test.ts 가 add/remove/clear 를 광범위 단언하나 변경이 없어 파급 0 이라는 판단 동의.


## `D6` — 판정: **제거**

**대상 심볼**

uniqn-mobile/src/stores/notificationStore.ts 의 소비처 0 공개 표면 — 셀렉터 `selectNotifications`(606) `selectHasMore`(608) `selectFilter`(610) `selectUnreadByCategory`(611) `selectSetNotifications`(641) `selectAddNotification`(642) `selectAddNotifications`(643) `selectRemoveNotification`(644) `selectSetHasMore`(645) `selectMarkAsRead`(646) `selectMarkAllAsRead`(647) / 유틸훅 `useNotifications`(625) `useNotificationSettings`(630) `useUnreadByCategory`(635) `useNotificationListActions`(655-659) `useNotificationReadActions`(664-667) / 액션 `updateNotification`(76·331-366) `markCategoryAsRead`(83·443-458) `decrementUnreadCount`(101-102·520-526) `getFilteredNotifications`(105·532-535) `setFilter`(94·496-498) `clearFilter`(95·500-502) `setLastFetchedAt`(99·512-514) / 상태 `filter`(61·130) / 헬퍼 `applyFilter`(237-271) + 배럴 재export `src/stores/index.ts:49·51·52·53·55·57`

### 원래 의도 (왜 만들었나)
대부분 최초 커밋 `20fc40d4b`(2025-12-20) 의 "완비된 스토어 API" 관성. `useNotificationListActions`/`useNotificationReadActions` 는 `7a997de72`(2026-02-02, 성능 최적화)에서 '전체 store 구독 대신 액션만 구독하여 리렌더링 최소화' 목적으로 신설(주석 651-653행)됐으나 **아무도 옮겨 타지 않았다** — 정작 `useNotifications.ts:91-95·255·294·336·397` 은 전부 `useNotificationStore()` 전체 구독을 그대로 쓴다. 설계문서 근거 없음.

### 흐름이 끊긴 시점
이어진 적이 없다. `grep` 결과 이 심볼 전부가 **`notificationStore.ts` 본체 + `stores/index.ts` 배럴 + 자기 테스트** 3파일 안에서만 등장한다(Grep 도구 files_with_matches → 정확히 3파일). app/·src/ 어디에서도 `from '@/stores'` 로 알림 심볼을 가져가는 곳이 없다(배럴 소비처 전수 확인: useThemeStore·useAuthStore·useToastStore 뿐).

### 지금 살아 있는 코드 흐름
흐름 없음. 대조군으로 **같은 파일에서 살아 있는 것**: `selectUnreadCount`(607) ← `useUnreadCount`(620) ← **TabHeader.tsx:27** / `selectSettings`(609) ← `useNotificationSettings`(630) ← 소비처 0(따라서 630 을 지우면 609 도 죽음) / `setUnreadCount`(516-518) ← appInitializeSession.ts:429, useNotificationSyncOnForeground.ts:91·141·168·182 / `setNeedsServerSync`(537-539)·`needsServerSync`·`lastCounterLocalUpdate` ← useNotificationSyncOnForeground.ts:132·177·183 + onRehydrateStorage:593 — **전부 生, 삭제 금지**.

### 죽은 부분
위 symbol 목록 전부. 각각 grep 결과 소비처가 본체·배럴·자기 테스트 3곳뿐이다. 특히 주의할 오탐 회피: `useNotifications` 라는 이름이 훅 파일 `@/hooks/useNotifications` 와 충돌하지만, **스토어의 `useNotifications`(625행)를 import 하는 곳은 0** 이다(`from '@/stores'` 전수 grep + `selectNotifications` 파일목록 3건으로 교차확인).

### 판정 근거
**타깃 사용자에게 아무 것도 주지 않는다** — 렌더되지도, 호출되지도 않는 API 표면이다. 스토어 파일이 670줄로 커진 주 원인이고(전역 coding-style 800줄 상한에 근접), 무엇보다 **다음 사람이 '스토어가 목록의 주인'이라고 오해하게 만드는 미끼**다 — D1·D2·D7 이 정확히 그 오해의 산물이다. 유지 비용은 0 처럼 보이지만 실제로는 6개월 동안 死코드 3건을 낳았다. 제거가 기본값이고, 이 항목엔 반박 근거가 없다.

### 삭제 목록·순서
삭제 순서(역방향 의존부터):\n1) `src/stores/index.ts` 재export 라인 49(`useUnreadCount` 는 **남긴다**)·51(`useNotificationSettings`)·52(`useUnreadByCategory`)·53(`selectNotifications`)·55(`selectUnreadCount` 는 **남긴다**)·57(`selectFilter`) — 실제 삭제 대상만 골라낼 것. `selectHasMore`(55 인근) 포함.\n2) `src/stores/__tests__/notificationStore.test.ts` — import 10-14행 중 죽는 심볼, `describe('markCategoryAsRead')` 524-561, `describe('getFilteredNotifications')` 643-705, `decrementUnreadCount` 747·759·771 블록, `updateNotification` 270·289·305·319 블록, 셀렉터 단언 818·834·848·851-853.\n3) `src/stores/notificationStore.ts` 본체 — 유틸훅 625·630·635, `useNotificationListActions` 655-659, `useNotificationReadActions` 664-667, 셀렉터 606·608·610·611·641·642·643·644·645·646·647, 액션 구현 331-366(`updateNotification`)·443-458(`markCategoryAsRead`)·496-502(`setFilter`/`clearFilter`)·512-514(`setLastFetchedAt`)·520-526(`decrementUnreadCount`)·532-535(`getFilteredNotifications`), 인터페이스 선언 76·83·94·95·99·101-102·105, 상태 `filter` 61·130, 헬퍼 `applyFilter` 237-271, 타입 import `NotificationFilter`(22행) — `filter` 제거 시 미사용.\n⚠️ **남길 것(오삭 방지)**: `selectUnreadCount`(607)·`selectSettings`(609, `useNotificationSettings` 도 지운다면 함께 제거)·`useUnreadCount`(620)·`setUnreadCount`(516)·`setNeedsServerSync`(537)·`setHasMore`(508)·`hasMore`·`lastFetchedAt`·`lastCounterLocalUpdate`·`unreadByCategory`·`reset`(541, 소비처 미확인이라 이번 범위 제외).

### 깨지는 것
• 배럴 `src/stores/index.ts` 를 통한 외부 소비 = 0 (전수 grep 확인).\n• `src/stores/__tests__/notificationStore.test.ts` — 다수 블록 동반 삭제 필요(위 목록).\n• `e2e/` — 스토어 심볼 직접 참조 없음(`e2e/factories/notification.factory.ts` 는 DB 시드 전용).\n• `npx knip` 는 이 심볼들을 unused export 로 이미 잡고 있을 가능성이 높으나 **knip 단독으로 판정하지 않았다** — 위 판정은 전부 Grep 도구 실측 기반이다(babel/expo-modules-core 류 false positive 함정 회피).\n• 삭제 후 knip 래칫(2189)이 내려가므로 베이스라인 조정이 필요할 수 있다.

### 검증 명령
```
npx tsc --noEmit && npx jest src/stores/__tests__/notificationStore.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — 7개 축 전수 실측: ① 열거된 심볼 전체 alternation grep = 정확히 3파일(스토어 본체·배럴·자기 테스트) ② '@/stores' 배럴 import 전수 = useThemeStore/useAuthStore/useToastStore 뿐(알림 심볼 0) ③ '@/stores/notificationStore' 직접 import 6파일은 useNotificationStore·useUnreadCount 만 사용 ④ e2e 0건(factory 는 DB 시드) ⑤ supabase/functions 0건 ⑥ 동적 문자열 키 접근(getState()[..], ['removeNotification'] 류) 0건 ⑦ 스토어판 useNotifications(625)·useNotificationSettings(630)·useUnreadByCategory(635) 이름충돌 교차검증 — 외부 소비 0(화면은 @/hooks/useNotifications 직접 import, notifications.tsx:24-31 실측).

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의 — '스토어가 목록의 주인이라는 오해를 만드는 미끼'라는 논거는 D1·D2·D7 의 발생 이력과 정합하고, 반박 근거를 찾지 못했다. UI 회귀 없음(렌더·호출 0 인 API 표면).

### 🛡️ 검증 — 삭제 안전성
🚨 삭제 목록에 교정 4건 필요. ① 배럴 실측 라인 불일치: stores/index.ts 실제 삭제 대상은 50(useNotifications — 보고서 누락, 본체 625 를 지우면서 이 재export 를 남기면 tsc 에러)·51(useNotificationSettings)·52(useUnreadByCategory)·53(selectNotifications)·55(selectHasMore)·57(selectFilter)·58(selectUnreadByCategory — 누락)·조건부 56(selectSettings, useNotificationSettings 동반 삭제 시). 유지 = 48(useNotificationStore)·49(useUnreadCount)·54(selectUnreadCount — 보고서가 '55'로 오기했다, 55는 selectHasMore). ② 테스트 삭제 목록 누락 2블록: describe('Filter') 615-644행(setFilter/clearFilter 단언 — 액션 삭제 시 red)·'should set lastFetchedAt' 723-731행(setLastFetchedAt 삭제 시 red). ③ describe 라인 소폭 오프셋(markCategoryAsRead 실제 527행 시작, getFilteredNotifications 646행) — jest 는 라인 무관이라 무해하나 목록 갱신 권장. ④ MMKV 안전성 실측: partialize(549-556)는 settings/lastFetchedAt/unreadCount/cachedNotifications 만 저장하고 filter 는 비영속 — filter 축 삭제는 기존 설치본 복원에 무영향. cacheService.ts:57 이 notification-storage 를 정리 보호 키로 유지 중이라 충돌 없음. knip 비의존·Grep 실측 판정은 적절(babel/expo-modules-core 함정은 의존성 삭제가 아니라 무관). 남길 것 목록(selectUnreadCount·useUnreadCount·setUnreadCount·setNeedsServerSync·setHasMore·hasMore·lastFetchedAt·lastCounterLocalUpdate·unreadByCategory·settings·setSettings)은 소비처 실측과 전부 일치.

### 🙋 사람이 결정할 것
이 정리를 D1·D2 와 같은 PR 에 넣을지 분리할지. **분리 권장** — D1·D2 는 행동 변경(리뷰 필요), D6 는 순수 삭제(diff 가 크지만 위험 낮음)라 섞으면 리뷰 신호가 묻힌다. 또 `reset()`(541행)은 소비처 grep 이 다른 스토어/폼의 동명 함수와 섞여 판정을 못 냈다 — 별도 확인 후 결정.


## `D7` — 판정: **완성**

**대상 심볼**

uniqn-mobile/src/hooks/useNotifications.ts:197-216 `fetchNextPage` (특히 :208 `addNotifications(result.notifications)`) + :219-224 `effectiveNotifications` + notificationStore.ts:317-329 `addNotifications`

### 원래 의도 (왜 만들었나)
최초 커밋 `20fc40d4b`(2025-12-20)에 무한스크롤 설계가 함께 들어왔다. 화면 주석이 목적을 명시: notifications.tsx:6-10 "NotificationList 컴포넌트 활용(FlashList 기반) / 무한 스크롤 지원", :200 "알림 목록 (무한스크롤 + 그룹핑 + 삭제)". 설계문서는 없음.

### 흐름이 끊긴 시점
D1 과 동일하게 **애초에 안 이어졌다**. 최초 커밋 시점부터 반환값이 `query.data ?? []` 였는데 다음 페이지는 스토어에만 쌓았다. 즉 온라인 무한스크롤은 태어날 때부터 무효였다.

### 지금 살아 있는 코드 흐름
NotificationList.tsx:186 `onEndReached={handleEndReached}` → :96-99 `if (hasMore && !isFetchingNextPage && onLoadMore) onLoadMore()` → notifications.tsx:81-83 `handleLoadMore` → useNotifications.ts:197 `fetchNextPage` → :198 오프라인이면 조기 반환 → :202-206 `fetchNotifications({lastDoc})` (PAGE_SIZE=20, notificationReadStateService.ts:15) → **:208 `addNotifications` 로 스토어에만 append** → :210 `setHasMore` → **끝. `query.data` 는 그대로 20건이므로 :219-224 가 반환하는 목록도 20건 — 화면에 아무 것도 추가되지 않는다.** 이후 realtime invalidate(137행)나 refetch 가 오면 :152-156 effect 가 `setNotifications(query.data)` 로 스토어를 다시 20건으로 잘라낸다.

### 죽은 부분
• `addNotifications(result.notifications)`(208) 의 **화면 축 = 死**. 스토어에만 남고 온라인 렌더는 `query.data`.\n• `setLastDoc`(209)·`setHasMore`(210)·`isFetchingNextPage` 상태(199·214)는 살아 있으나(스피너 표시 NotificationList.tsx:199) **결과가 없는 스피너**를 돌린다.\n• 오프라인 경로로도 살아나지 않는다: :198 이 `isOffline` 이면 조기 반환하므로 오프라인에선 fetchNextPage 자체가 안 돈다.\n→ 실사용 결함: **미읽음/전체 알림이 21건 이상인 사용자는 온라인에서 21번째 이후 알림을 영원히 볼 수 없다.** 스크롤 끝에서 스피너만 반복된다.

### 판정 근거
**제품 근거가 D1·D2 보다 강하다.** 대회사 운영팀은 D-7~D-day 에 확정·시각변경·출퇴근 알림이 수십 건씩 쌓이는 게 정상 부하다(이 앱의 핵심 시나리오). 그런데 21번째부터 접근 불가다. 게다가 알림은 딥링크 페이로드의 유일한 사본이라 '못 본다 = 그 근무 건으로 못 들어간다'가 된다. 이건 '있으면 좋은 것'이 아니라 **광고된 기능(화면 주석·UI 스피너·`hasMore` 배선이 모두 존재)이 조용히 작동하지 않는 것**이다.\n제거 대안('무한스크롤을 빼고 20건만 보여준다')은 타깃 사용자의 실제 부하와 충돌하므로 기각.

### 완성 비용
두 선택지.\n(A) **최소 배선**: `fetchNextPage` 안에서 `queryClient.setQueryData(notificationKeys.list(filter ?? {}), (prev=[]) => [...prev, ...result.notifications])` 를 `addNotifications` 와 함께 호출. 파일 1개 3~5줄. 단 refetch 가 오면 페이지가 1로 리셋되는 기존 성질은 남는다.\n(B) **정공법**: `useQuery`→`useInfiniteQuery` 전환(`getNextPageParam` = `result.lastDoc`). 파일 1개 약 40줄 재작성 + `hasMore`/`isFetchingNextPage`/`fetchNextPage` 를 쿼리 반환값으로 대체, 스토어의 `hasMore`(232행)·`addNotifications` 호출 제거. D8(이중 소스 해소)과 동일 작업이라 **B 를 권장**. 마이그레이션 0건.\n선행 조건: D1·D2 를 setQueryData 로 배선한 뒤여야 낙관 갱신이 페이지 2 항목에도 걸린다(deepdive:1109 ②가 지적한 페이지 경계 문제).

### 깨지는 것
• `src/__tests__/hooks/useNotifications.test.ts:380-478` 이 `useNotificationList` 반환 구조·오프라인 분기·`fetchNextPage` 존재를 단언한다. (B) 로 가면 이 블록 다수 갱신 필요.\n• `NotificationList.tsx:29-32·49-52·96-99·186-199` 의 props 계약(`hasMore`/`isFetchingNextPage`/`onLoadMore`)은 유지 가능 — 컴포넌트 변경 불필요.\n• `notifications.tsx:49-51·205-207` prop 전달 유지.\n• `e2e/tests/p2-standard/notifications.spec.ts` — 무한스크롤 시나리오 없음(page object 에 스크롤 헬퍼 부재).\n• DB/RPC/EF 무관.

### 검증 명령
```
npx jest src/__tests__/hooks/useNotifications.test.ts -t "useNotificationList" && npx tsc --noEmit
```

### 🔍 검증 — 놓친 소비처 재수색 (일부생존)
보고서가 놓친 생존 경로 1건 — fetchNextPage 가 스토어에 append 한 2페이지+ 항목은 온라인 렌더에는 죽었지만, 사용자가 온라인에서 페이지네이션 후 오프라인 전환하면 effectiveNotifications 의 오프라인 분기(219-222행: isOffline && cachedNotifications.length>0 → cachedNotifications 반환)로 화면에 도달한다. 즉 addNotifications(208) 는 완전 死가 아니라 우연히 오프라인 캐시 축을 부풀리는 부수 생존이 있다(다음 refetch 의 152-156 effect 가 20건으로 잘라낼 때까지). 또한 addNotifications 액션 자체는 syncMissedNotifications 경로(useNotifications.ts:175)의 별도 실소비가 있다 — 삭제 후보로 오인 금지. 그 외 NotificationList.tsx 29-32·49-52·96-99·186·199 배선, notifications.tsx:81-83, PAGE_SIZE 기반 '21번째 이후 접근 불가' 결함 모두 실측 일치. 최초 커밋 리비전에서 query.data??[] 반환 + 스토어 append 를 git show 로 직접 확인 — '태어날 때부터 무효' 주장 정확.

### ⚖️ 검증 — 판정 심사 (동의)
완성 동의 — 화면 주석·스피너·hasMore 배선이 전부 존재하는 '광고된 기능'이 조용히 죽어 있고, 대회사 D-7 부하 시나리오와 알림=딥링크 유일 사본 논거가 강하다. 제거 대안 기각도 타당. 보정 2건: ① 위 오프라인 부수 생존 때문에 완성안이 페이지네이션을 쿼리캐시로 옮길 때 오프라인 스냅샷 축(스토어 최근 50건)에 2페이지+ 를 계속 실어줄지 명시적으로 결정해야 한다(안 하면 오프라인에서 보이던 항목이 조용히 줄어드는 미세 회귀). ② 깨질것에 '(B) 로 가면'이라는 미정의 선택지 참조가 있다 — 완성안 A/B 가 본문에 정의돼 있지 않으므로 실행 PR 전에 옵션을 명문화할 것.

### 🛡️ 검증 — 삭제 안전성
삭제 없음. 깨질것 검증: useNotifications.test.ts 380-478 블록이 반환 구조·오프라인 분기를 단언한다는 주장과 NotificationList props 계약 유지 가능 판단 실측 동의. e2e 무한스크롤 시나리오 부재 확인. DB/RPC/EF 무관 동의.

### 🙋 사람이 결정할 것
(A) 최소 배선이냐 (B) `useInfiniteQuery` 전환이냐 — B 가 옳지만 훅 반환 계약이 바뀌어 테스트 갱신 폭이 커진다. 이번 웨이브 예산에 따른 사람 결정. 또한 무한스크롤이 6개월간 죽어 있었는데 사용자 신고가 없었다면 알림 21건 이상 사용자가 실제로 존재하는지 prod 실측(`select count(*) from notifications group by recipient_id` 분포)으로 우선순위를 정하는 게 정직하다.


## `D8` — 판정: **완성**

**대상 심볼**

이중 소스 구조 자체 — uniqn-mobile/src/hooks/useNotifications.ts:152-156(`setNotifications(query.data)` 동기화 effect) · :219-224(`effectiveNotifications`) · :232(`hasMore` 를 스토어에서 읽음) vs uniqn-mobile/src/stores/notificationStore.ts:277-600(persist 스토어) · :549-556(partialize)

### 원래 의도 (왜 만들었나)
스토어 파일 헤더가 분담을 명시한다(notificationStore.ts:11-14): "React Query: 서버 데이터 캐싱·로딩·에러 / Zustand: 오프라인 캐시·설정·필터·실시간 카운터". v1.2.0 changelog(7-9행)는 "React Query와 중복되는 isLoading 상태 제거"라며 **이미 한 번 중복을 걷어낸 이력**이 있다 — 즉 이원화가 문제라는 인식은 있었고, 목록 축만 안 걷어냈다.

### 흐름이 끊긴 시점
경계가 무너진 지점은 셋: (1) `4425aa31f`(2026-02-01) `effectiveNotifications` 가 오프라인 캐시를 렌더 경로에 끌어들이며 '스토어도 렌더 소스일 수 있다'는 착시를 만듦, (2) 최초부터 `fetchNextPage` 가 페이지네이션을 스토어에 둠(D7), (3) `7189755f9`(2026-01-06)·`b02d02be5`(2026-07-25)가 낙관 갱신을 스토어에 둠(D1·D2).

### 지금 살아 있는 코드 흐름
쓰기 경합 실측 — `unreadCount` 한 값에 **네 명의 주인**이 있다:\n① useNotifications.ts:154 `setNotifications(query.data)` → notificationStore.ts:289 `calculateUnreadCount(notifications)` — **최대 20건 기준으로 재계산**(PAGE_SIZE=20)\n② useNotificationSyncOnForeground.ts:91·141·168·182 `setUnreadCount(count)` — 서버 카운터(`getUnreadCount` → `getUnreadCounterFromCache` → RPC)\n③ appInitializeSession.ts:429 `setUnreadCount(unreadCount)` — 앱 시작 시 서버값\n④ usePushNotificationSetup.ts:158 `addNotification` → store:302 `incrementUnreadCounts` — +1\n소비: TabHeader.tsx:27 배지 / notifications.tsx:73→197 카테고리탭.\n→ **실피해: 미읽음이 21건 이상인 사용자가 알림 화면을 열면 ①이 ②③을 덮어써 배지가 20 이하로 잘린다.** (store:569-584 의 persist 보존 로직은 앱 재시작 시점에만 작동하고 이 경합을 막지 못한다.)

### 죽은 부분
구조 자체는 死가 아니지만 **경계가 없어서 死코드를 계속 생산한다** — D1·D2·D7 이 전부 이 한 가지 원인의 세 증상이다. 스토어가 실제로 **대체 불가능한** 역할은 둘뿐이다:\n(a) **MMKV persist 오프라인 스냅샷**(partialize 549-556, 최근 50건) — TanStack persister 가 이 레포에 도입돼 있지 않으므로 대체제 없음. 소비: :220-222 오프라인 렌더, :171 `syncMissedNotifications` 중복 제거용 id 목록.\n(b) **화면과 무관한 배지 카운터** — 앱 재시작 직후(:552 persist unreadCount)와 포그라운드 복귀(useNotificationSyncOnForeground), 푸시 수신(usePushNotificationSetup:158). 쿼리 캐시는 알림 화면이 마운트돼야 존재하므로 대체 불가.\n반대로 스토어가 **가져선 안 되는** 역할: 목록 페이지네이션의 진실원(D7 원인), 낙관 갱신 대상(D1·D2 원인), 그리고 `setNotifications` 가 페이지 데이터로 카운터를 재계산하는 것(위 ①).

### 판정 근거
**통일 가능하다. 다만 '스토어를 지우고 쿼리캐시로 일원화'가 아니라 '역할을 잘라내는' 형태다** — 요청받은 판단의 결론이다.\n근거: (a)(b) 두 역할은 쿼리 캐시가 원리적으로 못 한다(persist 미도입 + 화면 언마운트 시 소멸). 반면 목록·페이지네이션·낙관 갱신은 쿼리 캐시가 더 잘한다. 그러므로 정답은 **단일 소스 두 개를 각자의 축에 두는 것**: 목록 축 = TanStack 캐시 단독, 오프라인 스냅샷·배지 축 = 스토어 단독, 그리고 둘 사이 흐름은 **한 방향**(쿼리→스토어 스냅샷 기록)만 허용.\n**이게 D1·D2·D7 개별 수정보다 더 큰 문제인가?** 그렇다 — 개별 수정은 증상 제거이고, 경계를 못 박지 않으면 다음 사람이 같은 실수를 네 번째로 한다(실제로 D2 가 D1 의 죽은 패턴을 6개월 뒤 복제했다). 다만 **선후는 개별 수정이 먼저**다: D1·D2 의 setQueryData 배선이 곧 이 경계의 첫 시행이기 때문이다.

### 완성 비용
3단계, 파일 3개, 마이그레이션 0건.\n1) D1·D2 완성(useNotifications.ts, 약 23줄) — 낙관 갱신 대상을 쿼리 캐시로.\n2) D7 (B)안 `useInfiniteQuery` 전환(useNotifications.ts, 약 40줄) — 페이지네이션 진실원을 쿼리 캐시로. 스토어의 `hasMore`(:232 소비, store:508-510)는 이때 제거 가능.\n3) 카운터 축 분리(notificationStore.ts, 약 10줄) — `setNotifications` 에서 `unreadCount`/`unreadByCategory` 재계산을 떼어내고(`setNotifications` 는 스냅샷 저장 전용으로 축소), 카운터는 서버값(`setUnreadCount`)과 증분(`add/removeNotification`)만 쓰게 한다. 이렇게 하면 위 ①의 20건 절단 버그가 사라진다.\n+ 스토어 헤더 주석(11-14행)에 "목록의 진실원은 TanStack 캐시. 스토어는 오프라인 스냅샷과 배지 카운터만"을 명문화하고 `.claude/rules/` 에 승격 검토.

### 깨지는 것
• `src/__tests__/hooks/useNotifications.test.ts` 의 `useNotificationList` 블록(313-478) 다수 — 특히 380-400(오프라인 캐시 반환)·453-478.\n• `src/stores/__tests__/notificationStore.test.ts` 의 `setNotifications` 카운터 재계산 단언(85-121·415·493) — 3)단계에서 의미가 바뀐다.\n• `src/__tests__/hooks/useAppInitialize.test.ts:80` 이 `setUnreadCount` 목킹 — 시그니처 유지 필요.\n• `src/hooks/useNotificationSyncOnForeground.ts:132` 이 `lastCounterLocalUpdate` 로 race 를 막는다 — 3)단계에서 이 방어의 전제가 바뀌므로 함께 검토(제거하면 realtime 중간값이 낙관값을 덮는 기존 버그가 재발).\n• `partialize`(549-556)는 **건드리지 말 것** — MMKV 키 `notification-storage` 의 저장 형태를 바꾸면 기존 설치본 복원이 깨진다(onRehydrateStorage 558-597 이 `cachedNotifications` 키를 기대).\n• DB·RPC·EF·딥링크 파서 무관.

### 검증 명령
```
npx jest src/__tests__/hooks/useNotifications.test.ts src/stores/__tests__/notificationStore.test.ts src/hooks/__tests__/useNotifications.deleteAll.test.ts && npx tsc --noEmit
```

### 🔍 검증 — 놓친 소비처 재수색 (살아있음)
unreadCount 4주인(①useNotifications.ts:154→store:289 재계산 ②useNotificationSyncOnForeground:91·141·168·182 ③appInitializeSession:429 — 동적 import 경유라 정적 grep 이 놓치기 쉬운 형태, 실측 확인 ④usePushNotificationSetup:158) 전부 실재. 추가 소비처 2곳: pushNotificationHandlers.ts:137(settings 축)과 cacheService.ts:57(notification-storage 를 캐시 정리 보호 키로 등록 — partialize 계약의 또 다른 이해관계자, 보고서 미기재). TanStack persister 미도입 주장 grep 실측 확인(persistQueryClient 0건) — '(a) 오프라인 스냅샷 대체제 없음' 성립.

### ⚖️ 검증 — 판정 심사 (동의)
완성(스토어 폐기가 아닌 역할 절단: 목록 축=쿼리캐시 단독, 배지·오프라인 스냅샷=스토어 단독, 흐름은 쿼리→스토어 단방향) 동의 — (a)(b) 두 역할의 대체 불가 논거가 실측과 일치하고, D2 가 D1 의 죽은 패턴을 6개월 뒤 복제한 실사고가 '경계 부재=재생산' 주장을 입증한다. 선후(개별 수정 D1·D2 먼저, 경계는 그 시행) 동의. 보정 1건: '①이 ②③을 덮어써 배지가 20 이하로 잘린다'는 실피해는 실재하나 상시 아님 — setNotifications 는 lastCounterLocalUpdate 를 갱신하지 않으므로(store:286-293 실측) 그레이스 창에 안 걸린 realtime unreadCount 구독(:127-141)이 서버값으로 재교정할 수 있다. 즉 '결함 창'이지 영구 고착이 아니다 — 심각도 서술만 한 단계 낮출 것, 구조 진단은 유효.

### 🛡️ 검증 — 삭제 안전성
삭제 없음. 'partialize(549-556) 불변 유지' 경고에 강하게 동의하며 근거 보강: cacheService.ts:57 의 보호 키 목록과 onRehydrateStorage(558-597)의 cachedNotifications 키 기대가 이미 이 형태에 결합돼 있다. useAppInitialize.test.ts:79-80 의 setUnreadCount 목 시그니처 유지, useNotificationSyncOnForeground:132 의 lastCounterLocalUpdate 방어 전제 재검토(제거 시 기존 race 재발) 항목도 실측과 정합. 3단계(카운터 재계산 의미 변경) 착수 시 notificationStore.test.ts 의 setNotifications 카운터 단언(79-121 등)이 red 가 되는 것은 의도된 red 이므로 테스트를 먼저 새 계약으로 고쳐 쓸 것(red-green).

### 🙋 사람이 결정할 것
① 3)단계(카운터 축 분리)는 배지 정확도를 바꾸는 변경이라 별도 결정이 필요하다 — 지금은 알림 화면을 열면 배지가 20으로 잘리는데, 이걸 '버그'로 볼지 '페이지 기준 표시'로 볼지 제품 판단. 실측 우선순위 근거로 prod 미읽음 분포를 볼 것.\n② TanStack persister 도입으로 스토어의 오프라인 역할까지 흡수할지 — 흡수하면 notificationStore 를 배지 카운터 전용으로 축소할 수 있으나 새 의존성 도입이라 `/oss-vet` 선행 대상. 이번 범위 밖으로 두는 것을 권장.



---

# E-도달불가코드


## `E1` — 판정: **완성**

**대상 심볼**

uniqn-mobile/app/(app)/profile-setup.tsx:84-86 handleBack · :114 onBack={handleBack} · uniqn-mobile/src/components/auth/signup/SignupStepProfile.tsx:27 onBack prop 선언 · :45 구조분해 · :423-425 <Button onPress={onBack} variant="ghost">이전</Button>

### 원래 의도 (왜 만들었나)
도입 커밋은 단 하나 — `git log --diff-filter=A -- 'uniqn-mobile/app/(app)/profile-setup.tsx'` → 1d7b2a950 (2026-03-08) "refactor(mobile,functions): 회원가입 4단계→3단계 축소 및 프로필 분리". 커밋 메시지: "고아 계정 문제 해결을 위해 … 기존 Step 4(프로필)를 제거하고 Step 3(본인인증) 완료 시 즉시 계정을 생성 … 프로필은 가입 후 앱 첫 진입 시 별도 화면에서 입력". 리팩터 직전 코드(`git show 1d7b2a950 -- .../SignupForm.tsx` 의 삭제 라인)에 `case 4: // 프로필 (최종 제출) → <SignupStepProfile onNext={handleProfileSubmit} onBack={handleProfileBack} …>` 가 실재했다 — 위저드 안에서 onBack 은 '3단계(본인인증)로 돌아가기'라는 명확한 의미였다. 주석 근거: profile-setup.tsx:83 `// 뒤로가기 방지 (프로필 완성 필수)` — 차단 의도는 명시적. 설계문서 근거 실재: docs/analysis/2026-08-02-ux-friction-selected-deepdive.md B-1(:269)·B-2(:501) 오늘자 CONFIRMED, docs/analysis/2026-07-10-ux-flow-review.md:54, docs/analysis/2026-07-24-benchmark-ux-audit.md:59(QW8).

### 흐름이 끊긴 시점
흐름이 끊긴 게 아니라 **승격 시점에 옮겨 붙이지 않았다**. 같은 커밋 1d7b2a950 의 `git show 1d7b2a950:.../profile-setup.tsx` 에 이미 `toast.info('프로필을 완성해야 서비스를 이용할 수 있습니다.')` 가 그대로 들어 있다 — 즉 위저드 복귀 의미는 그 커밋에서 사라졌고, 대체 출구는 처음부터 존재한 적이 없다. 이후 SignupStepProfile.tsx 를 만진 커밋들(knip triage 포함)은 모두 다른 목적이라 이 잔해를 건드리지 않았다.

### 지금 살아 있는 코드 흐름
SignupStepProfile.tsx:423 <Button onPress={onBack}>이전</Button> → profile-setup.tsx:114 onBack={handleBack} → profile-setup.tsx:84-86 handleBack → toastStore.ts:55 addToast → 끝. 네비게이션 호출 0줄. 재탭 시 toastStore.ts:56-61 `isDuplicate` 억제로 두 번째 탭부터는 시각 피드백조차 0. 대조군(정상 회로): app/(auth)/signup.tsx:249-296 handleBack → confirmAction → signOut() → router.replace('/(auth)/login').

### 죽은 부분
handleBack 자체는 실행된다(토스트는 뜬다) — 죽은 것은 **이탈 회로 전체**다. 심볼·경로 단위 실측: ① profile-setup.tsx 전체(1-122줄)에 `signOut` import·호출 0건, import 는 `{ completeProfile, checkNicknameExists, getUserProfile }`(:15)뿐. ② 헤더 없음 — app/(app)/_layout.tsx:119 `headerShown: false`, :128-133 은 profile-setup 에 `gestureEnabled: false` 만 추가(iOS 엣지 스와이프도 차단). ③ Android 하드웨어 백 인터셉트 없음 — `BackHandler` grep 결과 앱 화면 사용처는 app/(auth)/signup.tsx:304, AddStaffModal.tsx:123, TimeWheelPicker.tsx:645 셋뿐. ④ 로그아웃 보유 3화면 전부 도달 불가 — app/(app)/(tabs)/profile.tsx:94, app/(app)/settings/index.tsx:111, app/(app)/settings/delete-account.tsx:98,188 이 모두 (app) 그룹이라 useAuthGuard.ts:341-352 `if (isAuthenticated && authenticatedEntryRoute.includes('/profile-setup') && !isOnProfileSetup) → replace` 에 걸린다. ⑤ (auth)/login 으로 우회해도 useAuthGuard.ts:298-310 이 되돌린다(예외는 `/signup` && isOnSignup 뿐).

### 판정 근거
제거(버튼째)는 트랩을 **조용하게 만들 뿐 없애지 못한다** — 지금은 그나마 토스트가 '여긴 못 나간다'는 신호라도 준다. 그리고 이 화면은 예외 경로가 아니라 신규 가입자 100% 의 필수 통과 지점임을 실측했다: handle_new_user(20260719233000_team_terminology_unification.sql:30-74)는 profile_completed 를 명시하지 않아 DEFAULT false(20260710000002_baseline_schema_from_prod.sql:10647)로 굳고, Edge Function 은 `profile_completed: Boolean(trimmedNickname)`(supabase/functions/verify-and-save-portone-profile/index.ts:281)인데 **현행 3단계 가입은 닉네임을 아예 보내지 않는다**(SignupForm.tsx 전체 nickname grep 0건). 즉 홀덤펍 사장이든 대회 운영팀이든 구직 스태프든 가입 직후 전원이 여기 갇히고, 계정을 잘못 만든 걸 이 화면에서 깨달아도 로그아웃·계정전환·탈퇴가 전부 막혀 앱 삭제 외에 방법이 없다. 인력 매칭 앱의 획득 퍼널 **마지막 한 칸**에서 이탈구가 0인 건 '있으면 좋은 기능' 부재가 아니라 결함이다. 결정적으로, 같은 상황(활성 세션 + 미완성 프로필)의 형제 화면 signup.tsx:249-296 이 이미 confirmAction→signOut→replace 출구를 갖고 주석(:254-256)으로 '명시적 signOut 필요' 이유까지 적어 놨다 — 프로젝트 의도가 '출구 없음'이 아님이 코드로 증명되고, 완성 비용은 신규 설계가 아니라 패턴 복제다.

### 완성 비용
파일 2개, 마이그레이션 불필요. ① app/(app)/profile-setup.tsx — handleBack(:84-86)을 handleExit 로 교체: `if (isLoading) return;`(completeProfile 과 signOut 의 race 차단, signup.tsx:252 선례) + confirmAction({title:'로그아웃할까요?', message:'프로필을 완성해야 서비스를 이용할 수 있어요. 계정은 그대로 남아 있고, 다시 로그인하면 이 화면부터 이어집니다.', confirmText:'로그아웃', cancelText:'계속 작성', destructive:true, onConfirm: async()=>{ try{ await signOut(); } catch(e){ logger.warn(…) } finally { router.replace('/(auth)/login') } }}). import 에 signOut(이미 @/services/auth 를 쓰고 있어 한 줄 추가) + confirmAction(@/utils/confirmAction) 추가. authStore.reset 별도 호출은 불필요 — authCoreService.ts:415-429 의 signOut 이 세션·생체자격증명·userSessionStorage 를 정리하고 useAuthGuard 가 로그인으로 보낸다(signup.tsx 선례와 동일). ② SignupStepProfile.tsx — :423-425 버튼 라벨 '이전'→'로그아웃'(impeccable §11 구체 동사), prop 명 onBack→onExit 정정(:27, :45, :423). 소비처가 1곳뿐이라 안전.

### 깨지는 것
실측 확인 — SignupStepProfile 렌더 소비처는 profile-setup.tsx:112 **단 하나**(grep 8건 중 나머지는 배럴 re-export src/components/auth/signup/index.ts:10 · src/components/auth/index.ts:21, 정의부, 그리고 app/(app)/settings/profile.tsx:90 의 **주석 문자열**뿐). SignupForm.tsx:24-26 은 Account/Identity/Terms 3개만 import 하므로 위저드는 더 이상 이 컴포넌트를 쓰지 않는다. __tests__/ 에 SignupStepProfile 전용 테스트 없음(SignupForm.test.tsx 만 존재). e2e/ 에 profile-setup 문자열 0건. ⚠️ 라벨 '이전' 변경 시 **e2e 별도 Grep 필수**(quality 범위 밖) — e2e/helpers/assertion-helpers.ts:31 `PREVIOUS: '이전'` 과 e2e/pages/auth/signup.page.ts:123 `getByRole('button', { name: /이전/ })` 가 실재한다. 현재는 signup 위저드의 Account/Identity 버튼(SignupStepAccount.tsx:174 / SignupStepIdentity.tsx:140)을 잡으므로 무영향이지만 반드시 대조할 것. useAuthGuard.ts 를 건드리지 않으므로 src/hooks/__tests__/useAuthGuard.test.ts(:116, :300 이 profile-setup 리다이렉트를 잠금)와 authRedirect.test.ts 는 무영향.

### 검증 명령
```
cd uniqn-mobile && npx tsc --noEmit && npx jest src/hooks/__tests__/useAuthGuard.test.ts src/components/auth && grep -rn "이전" e2e/
```

### 🔍 검증 — 놓친 소비처 재수색 (살아있음)
grep 사각 전수 실측 — ① e2e/: 'profile-setup'·'SignupStepProfile'·'프로필을 완성' 0건(대조군 '이전' 이 assertion-helpers.ts:31·signup.page.ts:123 에 히트해 공허한 0 아님을 확인) ② supabase/: 'profile-setup' 은 20260718120000_nickname_search_rpcs.sql:5 주석 1건뿐 — DB 저장 link·딥링크 세그먼트 아님 ③ 배럴 2곳(auth/index.ts:21·signup/index.ts:10)은 re-export 만, 렌더 소비처는 profile-setup.tsx:112 단일, settings/profile.tsx:90 은 주석 문자열 ④ BackHandler 앱 사용처는 signup.tsx:304·AddStaffModal:123·TimeWheelPicker:645 뿐 — profile-setup 인터셉트 없음 확인 ⑤ useAuthGuard.ts:341-352(프로필 미완성 강제 복귀)·:298-310((auth) 그룹 차단, 예외는 signup 뿐) 실재 확인 ⑥ '전원 통과' 전제 실측: 20260719233000 마이그의 handle_new_user 에 profile_completed 0건(DEFAULT false 성립) + EF index.ts:281 Boolean(trimmedNickname) + SignupForm.tsx nickname 0건.

### ⚖️ 검증 — 판정 심사 (동의)
'완성' 판정 동의. 단 재판정은 '죽은 코드'가 아니라 '살아있는 막다른 회로'다 — handleBack→toast 체인은 신규 가입자 전원에게 실행된다(조사서 스스로 인정). 버튼 제거는 UI 회귀 + 트랩을 무언화할 뿐이라 제거 반대 논거 타당. 완성 근거인 형제 회로 signup.tsx:249-296(confirmAction→signOut→router.replace, :254-256 '명시적 signOut 필요' 주석 포함)을 직접 읽어 실재 확인 — 패턴 복제로 완성 가능하다는 주장 성립.

### 🛡️ 검증 — 삭제 안전성
삭제 목록 공란(완성 판정)이라 파괴 위험 0. 깨질것 검증: '이전' 라벨 관련 e2e 상수(assertion-helpers.ts:31 PREVIOUS)·셀렉터(signup.page.ts:123 /이전/) 실재 확인 — 현재는 signup 위저드만 잡지만 완성 작업에서 profile-setup 에 e2e 를 추가하면 getByRole('이전').first() 가 오매칭할 수 있으니 testID 권장. useAuthGuard.ts 무변경이면 useAuthGuard.test.ts 잠금 무영향 주장도 타당. 완성 시 (app)/_layout.tsx:128-133 gestureEnabled:false 와 useAuthGuard 리다이렉트는 유지해야 함(출구는 signOut 경유만).

### 🙋 사람이 결정할 것
확인 다이얼로그 문구를 '로그아웃'으로 할지 '가입 중단'으로 할지 — 계정은 이미 EF upsert 로 생성돼 있으므로(index.ts:281) '중단'은 사실이 아니다. 또 profile_completed=false 로 방치되는 계정을 일정 기간 후 정리할지 여부는 제품 결정. (별건이나 인접: useAuthGuard.ts:40-59 ROUTE_CONFIGS 에 '(ops)' 가 없어 /(ops)/tournaments 는 이 게이트를 통과한다 — 탈출구는 아니지만 가드 구멍, deepdive B-3.)


## `E2` — 판정: **제거**

**대상 심볼**

src/components/jobs/ApplicationForm.tsx:116 errorQuestionIds state · :192-198 handleSubmit 내 미도달 블록 · :215 resetForm 의 setErrorQuestionIds([]) · :321 prop 전달 · src/components/jobs/PreQuestionForm.tsx:28 errorQuestionIds prop 선언 · :36 hasError · :103 파라미터 · :119-121 borderColor 에러 분기 · :145·:160 borderColor 소비 · :179-183 '필수 질문입니다' Text · :217 기본값 · :271 hasError 계산

### 원래 의도 (왜 만들었나)
PreQuestionForm 과 errorQuestionIds prop 은 55a6063a6(2026-01-02, "feat(mobile): Assignment v2.0 및 지원자 이력 관리 기능 구현")에서 신설. 그 시점 ApplicationForm 은 사전질문을 쓰지 않았다 — `git show 55a6063a6:.../ApplicationForm.tsx` 의 handleSubmit 은 `if (!selectedRole) return; onSubmit(...)` 두 줄뿐. ApplicationForm 에 배선된 건 7189755f9(2026-01-06, "fix(mobile): TypeScript 및 ESLint 에러 수정"). **설계 근거는 근거 없음** — docs/superpowers/specs/·docs/decisions/·wiki/ 어디에도 errorQuestionIds 언급 0건이고(grep 결과 유일한 문서 히트는 오늘자 사후 감사 docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:1142-1180 D1), 코드 주석·@todo 도 없다. 즉 '미답변 필수질문을 붉게 표시한다'는 의도는 컴포넌트 API 형태로만 남아 있고 문서로 뒷받침된 적이 없다.

### 흐름이 끊긴 시점
**끊긴 적이 없다 — 태어날 때부터 도달 불가였다.** `git show 7189755f9:.../ApplicationForm.tsx` 에서 canSubmit(:109-119)의 `const unanswered = findUnansweredRequired(preQuestionAnswers); if (unanswered.length > 0) return false;` 와 handleSubmit(:138-139)의 `if (!canSubmit) return;`, 그리고 그 아래 :144-147 `setErrorQuestionIds(unanswered)` 가 **전부 같은 커밋 안에 동시에** 존재한다. 따라서 errorQuestionIds 는 앱 수명 내내 단 한 번도 비어있지 않은 적이 없다. (deepdive D1 의 "비활성 게이트를 나중에 추가하면서 앞서 있던 인라인 에러 경로를 덮었다"는 서술은 커밋 실측과 어긋난다 — 정정 필요.)

### 지금 살아 있는 코드 흐름
살아 있는 게이트: ApplicationForm.tsx:247 <Button onPress={handleSubmit} disabled={!canSubmit}> → :161-185 canSubmit useMemo → :170 `hasPreQuestions && findUnansweredRequired(preQuestionAnswers).length > 0 → return false` → 버튼 회색, 탭 자체가 안 먹음. 살아 있는 답변 흐름: PreQuestionForm.tsx:265-272 QuestionItem → :107/:114 onAnswerChange → :220-226 handleAnswerChange → src/types/preQuestion.ts:107 updateAnswer → ApplicationForm.tsx:319 setPreQuestionAnswers. 죽은 에러 흐름: ApplicationForm.tsx:116 useState([]) → :215 resetForm 에서 [] 로만 재설정 → :321 errorQuestionIds={errorQuestionIds} → PreQuestionForm.tsx:271 hasError={[].includes(id)} = 영구 false.

### 죽은 부분
① ApplicationForm.tsx:192-198 블록 전체 — 상위 :188-190 `if (!canSubmit) return;` 과 :170 의 동일 술어(findUnansweredRequired)로 **논리적 도달 불가**. setErrorQuestionIds 의 유일한 비어있지-않은 호출 지점이다. ② :116 errorQuestionIds state — 존재하지만 값이 상수 []. 유일한 다른 setter 는 :215 setErrorQuestionIds([]). ③ PreQuestionForm 의 hasError 파생 전체 — :271 이 항상 false 이므로 :119-121 borderColor 의 `'border-error-500 dark:border-error-400'` 분기와 :179-183 `필수 질문입니다. 답변을 입력해주세요.` Text 는 **앱 수명 내내 한 번도 렌더된 적이 없다**. ④ 테스트 소비처 0 — src/components/jobs/__tests__/ApplicationForm.test.tsx:43-44 가 `jest.mock('../PreQuestionForm', () => ({ PreQuestionForm: () => …}))` 로 컴포넌트를 통째로 대체해 prop 을 검증조차 안 한다. ⑤ e2e/ 에 '사전질문'·'필수 질문입니다' 문자열 0건(grep 실측).

### 판정 근거
**살리는 안이 검증에서 무너진다.** src/types/preQuestion.ts:70-77 initializePreQuestionAnswers 가 모든 답변을 `answer: ''` 로 초기화함을 직접 읽어 확인했다. 따라서 errorQuestionIds 를 findUnansweredRequired 파생값(useMemo)으로 바꾸면 **시트를 여는 순간 모든 필수 질문이 빨간 테두리 + '필수 질문입니다'로 시작한다** — 아무것도 안 한 사용자를 먼저 비난하는 UX 로, .claude/rules/impeccable-design.md §10(에러는 '어떻게 고칠지'를 줄 것)과 §14 안티패턴에 정면 위배이고 지원 전환율을 깎는다. 이를 피하려면 touchedQuestionIds 같은 **신규 상태**를 도입해야 하는데 그건 스캐폴딩 완성이 아니라 새 기능 설계다. 한편 타깃 사용자(구직 스태프)의 실제 고통은 '어느 질문이 빨간가'가 아니라 '지원하기 버튼이 왜 회색인지 모른다'이고, 그건 별개 메커니즘(감사 D1 의 GateHint 사유 문구)이 해결하며 이 죽은 체인을 전혀 필요로 하지 않는다. 남겨두는 비용도 실재한다 — 오늘자 감사가 이 체인 하나를 규명하는 데 한 절을 썼고, 코드를 읽는 사람은 '미답변 질문이 붉게 표시된다'고 계속 오독한다.

### 삭제 목록·순서
삭제 순서는 하위(PreQuestionForm)→상위(ApplicationForm), 각 단계 후 tsc. ① PreQuestionForm.tsx: :179-183 에러 Text 블록 삭제 → :119-121 borderColor 의 hasError 삼항 제거하고 `'border-secondary-200 dark:border-surface-overlay'` 로 고정(:145·:160 두 소비처는 그대로 문자열 참조) → :36 `hasError?: boolean`(QuestionItemProps) 삭제 → :103 hasError 파라미터 삭제 → :271 `hasError={errorQuestionIds.includes(question.id)}` 삭제 → :217 `errorQuestionIds = []` 기본값 삭제 → :28 `errorQuestionIds?: string[]`(PreQuestionFormProps) 삭제. ② ApplicationForm.tsx: :321 `errorQuestionIds={errorQuestionIds}` 삭제 → :192-198 미도달 블록 전체 삭제(handleSubmit 은 `if (!canSubmit) return;` 다음 바로 onSubmit 호출) → :215 `setErrorQuestionIds([]);` 삭제 → :116 `const [errorQuestionIds, setErrorQuestionIds] = useState<string[]>([]);` 삭제. ③ **삭제 금지 목록**: :209 useCallback deps 의 hasPreQuestions(:203 에서 여전히 쓰임), findUnansweredRequired import(:7, :170 canSubmit 이 계속 사용), PreQuestionForm 컴포넌트 자체, src/components/jobs/index.ts:44 배럴 export, PreQuestion/PreQuestionAnswer 타입, src/schemas/preQuestion.schema.ts:51 PreQuestionFormData(이름만 닮은 **다른 심볼** — zod 타입). ④ 삭제할 테스트·쿼리키·상수 없음(errorQuestionIds 단언 0건).

### 깨지는 것
PreQuestionForm 렌더 소비처는 ApplicationForm.tsx:316 **단 하나**(grep 전수: 정의부, src/components/jobs/index.ts:44 배럴 re-export, ApplicationForm import/렌더, 테스트 mock, 그리고 src/schemas/index.ts:126 의 PreQuestionFormData 라는 무관한 동명이의 심볼). ⚠️ 이름 닮음 함정 회피 확인 — 공고 **작성** 쪽 사전질문 UI 는 src/components/employer/order-sheet/sheets/PreQuestionsSheet.tsx 라는 완전히 다른 파일이고 자체 테스트(__tests__/PreQuestionsSheet.test.tsx)도 따로 있다. 절대 같이 건드리지 말 것. findUnansweredRequired 는 canSubmit 이 계속 쓰므로 삭제하면 tsc 가 아니라 **런타임 게이트가 열린다** — 삭제 금지. DB·알림 type·딥링크·Edge Function 과 무관(순수 로컬 폼 상태). e2e/ 0건. ApplicationForm.test.tsx 는 PreQuestionForm 을 mock 하므로 무영향. 별건 주의: PreQuestionForm.tsx:186-189 의 '1000자' 카운터가 실제 maxLength 를 안 거는 결함(posting-domain-audit STAFF-15)은 이 작업 범위 밖.

### 검증 명령
```
cd uniqn-mobile && npx tsc --noEmit && npx jest src/components/jobs
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — ① errorQuestionIds 출현 전수 5곳(ApplicationForm:116·321, PreQuestionForm:28·217·271) 전부 죽은 체인 내부, setErrorQuestionIds 3곳(:116·:195·:215)도 전수 커버 ② e2e/: 'errorQuestionIds'·'필수 질문입니다'·'사전질문'·'preQuestion' 0건 ③ supabase/functions/ 0건 ④ 동적 키 접근·DB 저장 값 무관(순수 로컬 useState, MMKV persist 아님 — 기기 잔존 데이터 없음) ⑤ ApplicationForm.test.tsx:43-44 가 PreQuestionForm 통mock 확인 ⑥ 미도달 논증 직접 재검증: handleSubmit(:187-209) deps 에 canSubmit·preQuestionAnswers 동시 포함이라 stale closure 불가, :188 게이트와 :193 이 같은 렌더의 같은 preQuestionAnswers 로 같은 술어(findUnansweredRequired)를 평가 → :192-198 논리적 미도달 확정 ⑦ initializePreQuestionAnswers(types/preQuestion.ts:70-77)가 answer:'' 초기화 실측 — '살리면 첫 렌더부터 전량 빨간 테두리' 논거 성립.

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. 파생값 전환안은 impeccable-design §10·§14 위배가 맞고, touched 상태 도입은 신규 기능 설계라는 판단도 타당. 사소한 정정: 조사서의 updateAnswer 경유 서술은 PreQuestionForm 이 '@/domains/application'(:12)에서 import 하는 재수출 경로다(types/preQuestion.ts:107 원본 실재, 비물질적).

### 🛡️ 검증 — 삭제 안전성
목록은 완전(빠뜨린 심볼 없음 — 타입·배럴·테스트·상수 추가 삭제분 0, 삭제 금지 목록의 findUnansweredRequired 는 canSubmit:170 이 계속 사용함을 실측, PreQuestionsSheet 별개 파일 확인, PreQuestionFormData 는 zod 동명이의 별개 심볼 확인). 결함 1건: '하위→상위, 각 단계 후 tsc' 순서는 step ①(PreQuestionForm:28 prop 선언 삭제) 직후 ApplicationForm:321 이 미지의 prop 을 전달해 tsc red 가 된다 — ApplicationForm:321 제거를 먼저 하거나(상위→하위) 두 파일을 한 번에 지우고 tsc 1회로 검증할 것. borderColor 고정 시 :145·:160 템플릿 리터럴 소비 확인 완료. knip false positive 이력(babel·expo-modules-core·mmkv/nitro)과 무관.

### 🙋 사람이 결정할 것
이 제거와 짝을 이루는 D1 GateHint(버튼 비활성 사유 문구) PR 이 '필수 질문 N개가 남았어요'까지만 말할지, **어느 질문인지**까지 지목할지. 후자를 원하면 '터치 후 표시'(touchedQuestionIds 또는 onBlur 트리거)를 신규 설계로 별도 착수해야 한다 — 그때는 지금 지운 4개 심볼을 되살리는 게 아니라 새로 짜는 편이 맞다. 참고로 ApplicationForm.test.tsx:43-77 의 SheetModal mock 이 footer 를 렌더하지 않으므로, GateHint 를 footer 근처에 두면 '테스트 green 인데 화면엔 없음'이 된다(ScheduleSlotsSheet.test.tsx 의 mock 이 {footer} 를 렌더하니 그걸 베낄 것).


## `E3` — 판정: **유지**

**대상 심볼**

src/hooks/useBiometricAuth.ts:184-189 setEnabled 내 autoLogin 가드 + toast · :242-246 loginWithBiometric 내 동일 가드(리터럴 중복) · app/(app)/settings/index.tsx:182-184 Switch disabled 식 · :60 isAutoLoginLoading(구조분해만 하고 미사용)

### 원래 의도 (왜 만들었나)
훅 가드와 UI disabled 식이 **같은 커밋** 0bfbbf6ad(2026-03-21, "refactor(repo): 인증 초기화와 공고 근무 로직 정리")에서 함께 들어왔다 — `git log -S"자동 로그인을 켜야 생체 인증을 사용할 수 있습니다"` 와 `git log -S"isBiometricLoading || isBiometricAuthenticating || !autoLoginEnabled"` 가 둘 다 이 커밋 단일. 의도는 불변식 방어다: useAutoLogin.ts:43-46 이 자동 로그인 해제 시 setBiometricEnabled(false) 로 생체 인증을 강제 해제하므로(:45 logger.info '자동 로그인 해제로 생체 인증을 함께 비활성화했습니다'), 반대 방향(자동로그인 OFF 인데 생체 ON)을 훅과 UI 양쪽에서 막는다. 코드 주석으로 적힌 근거는 없음. 설계문서: docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:1339 D4(오늘자 CONFIRMED).

### 흐름이 끊긴 시점
끊긴 게 아니다 — 2겹 방어가 **의도대로 동작 중**이고, UI 겹이 훅 겹의 '사유 문구'를 승계하지 않았을 뿐이다. 그리고 완전 死코드도 아니다: useAutoLogin.ts:87 이 autoLoginEnabled 를 `true` 로 낙관 초기화하고 :88 isLoading=true 인데, settings/index.tsx:182-184 disabled 식에 isAutoLoginLoading 이 **빠져 있다**(:60 에서 구조분해는 해 놨다). 저장값이 OFF 인 사용자에게 생체 status 쿼리가 스토리지 읽기보다 먼저 resolve 되면 짧은 창 동안 스위치가 활성이고, 토글 시 토스트가 실제로 뜬다.

### 지금 살아 있는 코드 흐름
settings/index.tsx:181 onValueChange={handleBiometricToggle} → :91-94 handleBiometricToggle → useBiometricAuth.ts:182 setEnabled → :185 `await checkAutoLoginEnabled()` (**React state 가 아니라 useAutoLogin.ts:147-154 경유 settingsStorage 직접 읽기**) → :186-189 false 면 useToastStore.error + return / true 면 :192 setIsAuthenticating → :194 authenticateWithBiometric → :206 enableMutation.mutateAsync → :140-153 supabase.auth.getSession → saveBiometricCredentials → :156 setBiometricEnabled → :160 invalidateQueries. UI 게이트(다른 축): settings/index.tsx:182-184 disabled = isBiometricLoading(useBiometricAuth.ts:394) || isBiometricAuthenticating(:111) || !autoLoginEnabled(React state).

### 죽은 부분
정상 경로에서만 도달 불가한 부분 = :186-189 의 toast + return(그리고 쌍둥이 :242-246). 근거는 소비처 grep 전수: setEnabled 의 UI 소비처는 app/(app)/settings/index.tsx:69(→:93) **단 하나** — app/(auth)/login.tsx:43-50 의 useBiometricAuth 구조분해에 setEnabled 가 **없음을 직접 읽어 확인**(isEnabled/isAvailable/isAuthenticating/biometricTypeName/loginWithBiometric/updateCredentials 6개만), src/components/auth/BiometricButton.tsx:60 은 biometricTypeName·status 만 사용. 그 유일한 소비처의 Switch 가 !autoLoginEnabled 일 때 disabled 라 onValueChange 가 발화하지 않는다. :242-246 loginWithBiometric 의 동일 가드도 진입점 login.tsx:218 `loginAutoLoginEnabled && isBiometricEnabled && isBiometricAvailable` 가 앞서 막는다. **다른 호출자는 오늘 0개다.**

### 판정 근거
가드를 지우면 조용한 상태 오염이 생긴다. UI 겹과 훅 겹은 같은 값을 두 번 보는 게 아니라 **서로 다른 진실원**을 본다 — UI 는 React state(useAutoLogin.ts:87 낙관 초기값 true), 훅은 secureStorage(checkAutoLoginEnabled()). 바로 이 차이가 레이스 창을 만들고, 그 창에서 가드가 없으면 자동 로그인이 OFF 인데 생체 인증이 켜지고 refresh token 이 저장된다(useBiometricAuth.ts:153 saveBiometricCredentials). 그런데 login.tsx:218 이 loginAutoLoginEnabled && isBiometricEnabled 로 버튼을 숨기므로 **'켜져 있는데 쓸 수 없는' 유령 상태**가 남고, 사용자는 설정에선 ON 인데 로그인 화면엔 지문 버튼이 없는 모순을 본다. 즉 이 가드는 UI 중복이 아니라 저장소 축의 불변식 방어이고, 인증 자격증명이 걸린 만큼 fail-safe 쪽이 옳다. '다른 호출자가 오늘 없다'는 사실은 삭제 근거가 못 된다 — 삭제 시 사라지는 건 가상의 미래 방어가 아니라 **현재 실재하는 레이스 방어**다. 그리고 필요한 건 제거도 완성(GateHint)도 아니라 레이스를 닫는 1줄이다: 방어의 임무는 안내가 아니라 방어이고, 안내는 별도 UI 결정이다.

### 완성 비용
제거·완성 판정이 아니므로 필수 비용 0. 다만 근본 수정 1줄을 권한다 — app/(app)/settings/index.tsx:182-184 disabled 식에 `isAutoLoginLoading` 추가(:60 에서 이미 구조분해만 해 두고 미사용). 파일 1개, 마이그레이션 불필요, 회귀 없음(초기 로딩 중 스위치가 잠깐 더 회색으로 남는 것뿐이고 그게 정확한 동작). 이걸 넣으면 토스트는 정상·비정상 경로 모두에서 도달 불가가 되며 그 상태가 옳다. 사용자에게 사유를 보이는 GateHint 는 D4 의 별도 제안이고 이 판정의 필수 비용에 포함하지 않는다 — 자동 로그인을 끄는 행위는 드물고, 문구가 정말 필요한 지점은 '끈 뒤 회색이 된 스위치'가 아니라 '끄기 직전'이기 때문이다(openQuestion 참조).

### 깨지는 것
e2e/tests/p2-standard/settings.spec.ts:37 + e2e/pages/app/settings/settings.page.ts:35 는 AUTO_LOGIN_HELPER_TEXT('끄면 다음 실행부터 다시 로그인해야 합니다.') 가시성만 단언하므로 disabled 식 변경은 무영향. ⚠️ **웹 E2E 로는 이 영역을 관찰할 수 없다** — biometricService.ts:178 `isAvailable = hasHardware && isEnrolled` 가 웹에서 false 이고 settings/index.tsx:172 `{isBiometricAvailable && (…)}` 가 Face ID 행 자체를 렌더하지 않는다. 실기기 QA 필수. app/(app)/settings/__tests__/settings.collab-removed.test.tsx:90-96 이 useBiometricAuth 를 mock 하며 `setEnabled: jest.fn()` 를 포함하므로 **훅 반환 시그니처를 바꾸면 여기가 깨진다** — 현 판정(유지)은 시그니처 무변경이라 안전. 토스트 문구 리터럴은 src/·e2e/ 어디에도 단언 0건이라 문구 변경도 안전. useBiometricAuth 소비처 3곳(settings/index.tsx:71, login.tsx:50, BiometricButton.tsx:60) 전부 확인 완료.

### 검증 명령
```
cd uniqn-mobile && npx tsc --noEmit && npx jest "app/(app)/settings" src/__tests__/hooks/useAutoLogin.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (살아있음)
없음(가드 자체가 레이스 창에서 도달 가능) — ① setEnabled UI 소비처 settings/index.tsx:69 단일 확인(login.tsx:43-50 구조분해 6종에 setEnabled 부재 직접 확인, BiometricButton.tsx:60 은 biometricTypeName·status 만; sentryService 등의 동명 setEnabled 는 별개 심볼) ② loginWithBiometric 호출자 login.tsx:138 단일(:218 shouldShowBiometric 게이트 실재 확인) ③ 레이스 구조 실측: useAutoLogin.ts:87 낙관 초기값 true + 훅 가드는 checkAutoLoginEnabled()(저장소 축), UI disabled 는 React state 축 — 서로 다른 진실원 주장 성립 ④ useAutoLogin.ts:43-46 역방향 강제 해제 실재 ⑤ e2e settings.spec 은 AUTO_LOGIN_HELPER_TEXT 만 단언, 웹은 :172 게이트로 생체 행 미렌더 — 관찰 불가 주장 타당.

### ⚖️ 검증 — 판정 심사 (동의)
유지 동의(fail-safe 가드 + 자격증명 저장 축). 단 조사서 오기 1건 정정: ':60 isAutoLoginLoading 구조분해만 하고 미사용'은 틀렸다 — :162 자동 로그인 스위치 disabled 에서 실사용 중이다. 빠진 곳은 생체 스위치 :182-184 뿐. 따라서 '레이스 닫는 1줄'은 :182-184 disabled 식에 isAutoLoginLoading 추가이며, 이 수정은 훅 시그니처 무변경이라 테스트 안전.

### 🛡️ 검증 — 삭제 안전성
삭제 없음(유지)이라 파괴 위험 0. 훅 반환 시그니처를 만질 경우 깨지는 mock 은 조사서가 든 settings.collab-removed.test.tsx:96 외에 login.test.tsx:67-72 도 있다(useBiometricAuth 통mock) — 두 곳 모두 확인. 가드 문구 리터럴('자동 로그인을 켜야...')은 :187·:244 두 곳 중복이므로 향후 문구 변경 시 둘 다 고칠 것(상수화 여지). e2e·src 문구 단언 0건 확인.

### 🙋 사람이 결정할 것
① 자동 로그인을 끌 때 생체 인증도 함께 해제된다는 사실(useAutoLogin.ts:43-46)을 **끄기 직전 confirmAction 으로 미리 알릴지** — 현재는 사후 침묵이고 AUTO_LOGIN_HELPER_TEXT(:33)에 생체 언급이 없다. 이쪽이 회색 스위치에 사유를 붙이는 것보다 실효가 크다. ② 기기 미지원·미등록 시 행을 숨길지(현행 :172) 사유 붙인 비활성 행으로 보일지 — 후자면 웹에 '이 기기는 생체 인증을 지원하지 않아요' 행이 상시 뜨므로 Platform.OS 가드가 필요하고 e2e settings.spec.ts 항목 수가 변한다. 둘 다 제품 오너 결정.


## `E4` — 판정: **완성**

**대상 심볼**

src/services/auth/loginAttemptService.ts:98-111 getRemainingLoginAttempts (상수 :18 MAX_LOGIN_ATTEMPTS 는 형제 함수와 공유)

### 원래 의도 (왜 만들었나)
최초 작성은 fa1d2fb83(2025-12-24, "feat(mobile): FCM 푸시 알림 및 세션 보안 강화")에서 sessionService 내부 메서드로. 현재 파일로 분리된 건 4bd56c4f3(2026-05-14, "refactor(auth): 세션 비활성 타임아웃 제거 + Supabase auto-refresh 위임 (#96)"). **분리 근거 설계문서가 실재한다** — uniqn-mobile/docs/superpowers/plans/2026-04-25-session-keep-alive.md:88 이 이 함수를 '브루트포스 방어, 별개 관심사'로 분류하고 :210 이 "checkLoginAttempts, incrementLoginAttempts, resetLoginAttempts, getRemainingLoginAttempts … 를 **그대로 복사**"라고 지시한다. 즉 이관 계획은 명시적이었고 **UI 배선 계획은 애초에 없었다**. 파일 헤더 주석(:6-9)에 정책(5회/15분)만 있고, 남은 횟수를 사용자에게 보여준다는 의도를 적은 주석·@todo·spec 은 어디에도 없음 — 그 부분은 **근거 없음**. 사후 감사 2건: docs/analysis/2026-08-02-employer-seeker-ux-friction-audit.md:352 login-lockout-no-warning(오늘자 CONFIRMED, 수정 S)이 '레포 전체 grep 결과 UI 호출 0건'을 이미 기록했고, docs/analysis/2026-07-16-full-codebase-cleanup-analysis.md:110 은 이 서비스의 fail-open 을 '기기 로컬 UX 보조 통제라 결함 아님'으로 판정했다.

### 흐름이 끊긴 시점
흐름이 끊긴 게 아니라 **애초에 이어진 적이 없다.** `git log -S"getRemainingLoginAttempts" -- uniqn-mobile/` 결과 5개 커밋(fa1d2fb83 최초작성 · 3bed204ea 테스트추가 · 8b9fbdd8d observability 도메인분리 · 0bfbbf6ad 인증정리 · 4bd56c4f3 파일분리)이 전부 이동·리팩터링·테스트이고, 훅이나 화면에서 이 심볼을 호출하는 커밋은 이력 전체에 0건이다.

### 지금 살아 있는 코드 흐름
살아 있는 형제 3개는 완전히 배선돼 있다 — app/(auth)/login.tsx:157 `await login(data)` → authCoreService.ts:77 checkLoginAttempts(data.email) → loginAttemptService.ts:31 getItem → :36-41 잠금 중이면 AuthError(AUTH_RATE_LIMITED, '로그인 시도 횟수를 초과했습니다. N분 후에 다시 시도해 주세요.') / :44-46 만료면 deleteItem. 성공 시 authCoreService.ts:121 resetLoginAttempts → :91 deleteItem. 실패 시 authCoreService.ts:134-143 catch → `await incrementLoginAttempts(data.email)` → loginAttemptService.ts:66-75 newCount 계산 + setItem(`login_attempts_{email}`) → :147 `throw handleServiceError(...)` → login.tsx:160-168 catch → addToast(extractErrorMessage(error, '로그인에 실패했습니다.')). **getRemainingLoginAttempts 는 이 흐름 어디에도 등장하지 않는다.**

### 죽은 부분
getRemainingLoginAttempts(:98-111) 단일 심볼. 소비처 grep 전수(레포 루트, node_modules 제외): 정의 1건 + src/services/auth/__tests__/loginAttemptService.test.ts:5(import), :127, :136, :145(단언 3건) + 설계문서 언급 3건(2026-04-25-session-keep-alive.md:88, :210, :306) + docs/analysis 2건 = **런타임 소비처 0**. 배럴 미노출도 확인: src/services/auth/index.ts 에 loginAttempt/LoginAttempt/Remaining 문자열 0건(형제 3개조차 배럴이 아니라 authCoreService.ts:36-39 가 상대경로로 직접 import 한다). e2e/ 0건. DB·알림 type·딥링크·Edge Function 과 무관 — 순수 로컬 secureStorage 읽기라 grep 사각지대가 없다.

### 판정 근거
제거하면 지워지는 건 14줄인데, 잃는 건 CONFIRMED 결함의 **유일한 데이터 원천**이다. 현재 동작은 실측상 이렇다: 4번 틀리는 동안 login.tsx:164-167 이 매번 똑같은 문구만 띄우고, 5번째에 **사전 경고 0 상태로** 15분 잠금이 걸린다(loginAttemptService.ts:18-19, :67, :71). 이 앱의 타깃은 시간이 곧 손해인 사용자다 — 대회 D-day 아침에 인력을 급히 올려야 하는 대회사 운영팀, 근무 시작 직전 출근을 찍어야 하는 스태프, 오늘 밤 사람을 구해야 하는 홀덤펍 사장. 게다가 소셜·이메일 로그인이 섞여 있어 '어느 걸로 가입했더라'로 몇 번 틀리는 건 흔하다(같은 감사의 identity-duplicate-deadend 가 같은 혼동을 별건으로 CONFIRMED 보고). '앞으로 2번 더 틀리면 15분간 로그인할 수 없어요 + 비밀번호 찾기'는 장식이 아니라 **잠금 자체를 회피시키는 개입**이고, 15분을 통째로 날리는 실패를 없앤다. 회로가 반만 만들어진 전형이다 — 카운터는 이미 쓰이고 읽히는데 사람에게 보여주는 마지막 한 칸만 비었고, 실측 배선 비용이 파일 1~2개다.

### 완성 비용
파일 1~2개, 마이그레이션·DB 변경 없음. **최소안**: app/(auth)/login.tsx:160-168 catch 에서 `getRemainingLoginAttempts(data.email)` 를 호출해 잔여 ≤2 일 때 경고 토스트를 덧붙이고 '비밀번호 찾기' 액션을 단다. 호출 순서는 안전함을 확인했다 — authCoreService.ts:143 이 `await incrementLoginAttempts(data.email)` 를 **완료한 뒤** :147 에서 throw 하므로 catch 시점 저장값은 이미 증가 반영 상태다. import 는 배럴 미노출이라 `@/services/auth/loginAttemptService` 직접 경로. ⚠️ authCoreService.ts:135-138 skipIncrement 가 AUTH_RATE_LIMITED·AUTH_USER_NOT_FOUND 를 증가에서 제외하므로 그 두 코드에서는 경고를 띄우지 말 것(이미 잠금 문구가 나갔거나 계정이 없다). **권장안**: 잔여 수를 handleServiceError 의 metadata 에 실어 보내 Presentation 이 서비스 함수를 직접 호출하지 않게 한다 — 파일 2개(authCoreService.ts + login.tsx), CLAUDE.md 의 Presentation→Hooks→Service 레이어 규약에 더 부합하고 checkLoginAttempts 가 이미 metadata:{remainingMinutes}(loginAttemptService.ts:40)를 쓰는 선례와 일관된다.

### 깨지는 것
삭제가 아니므로 파괴 없음. 기존 테스트 src/services/auth/__tests__/loginAttemptService.test.ts:124-146(3케이스: 기록없음→5, count=2→3, count=10→0)이 이미 함수 계약을 잠그고 있어 그대로 재사용 가능. ⚠️ **권장안(서비스 레이어 호출)을 택하면** src/services/auth/__tests__/authService.test.ts:87-89 의 loginAttemptService mock 에 getRemainingLoginAttempts 가 **없다** — `getRemainingLoginAttempts: jest.fn(async () => 5)` 를 추가하지 않으면 실제 secureStorage 를 타서 스위트가 깨진다. 배럴에 새로 export 할 필요 없음(형제 3개도 상대경로 직접 import). ⚠️ e2e/ 에 로그인 실패 토스트 문구 단언이 있는지 **별도 Grep 필수** — eslint.config.js ignores 에 e2e/ 가 있어 npm run quality 가 못 잡는다(PR#353 실사고 선례). DB·마이그레이션·RLS·알림 계약 무영향.

### 검증 명령
```
cd uniqn-mobile && npx jest src/services/auth/__tests__/loginAttemptService.test.ts src/services/auth/__tests__/authService.test.ts && npx tsc --noEmit
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
런타임 소비처 0 실측 — ① 배럴 src/services/auth/index.ts 전문 Read: loginAttempt 계열 export 0건(형제 3개 포함) ② authCoreService.ts:35-39 가 './loginAttemptService' 상대 import 로 형제 3개만 가져옴을 직접 확인 ③ e2e/ 'loginAttempt·남은 횟수·시도 횟수' 0건 ④ supabase/functions/ 0건 ⑤ 동적 키 접근 없음(순수 secureStorage) ⑥ 테스트 import 는 loginAttemptService.test.ts 전용(3단언). 추가 발견: e2e assertion-helpers.ts:73 에 LOGIN_FAILED('로그인에 실패했습니다') 상수가 정의돼 있으나 소비처 0건이라 현 시점 문구 변경도 e2e 를 깨지 않는다. e2e-user-journeys.spec.ts:258-259 가 오답 로그인 1회를 실수행하지만 토스트 단언은 없음(새 컨텍스트라 잠금 누적 위험도 없음).

### ⚖️ 검증 — 판정 심사 (동의)
완성 동의(CONFIRMED 감사가 유일 데이터 원천 주장 타당, 14줄 함수는 테스트로 계약 잠김). 단 '깨질것'의 mock 지침이 이중으로 부정확해 정정 필수: (1) authService.test.ts:86-90 의 mock 대상은 loginAttemptService 가 아니라 옛 경로 '@/services/observability/sessionService' 다 — 현행 sessionService.ts 엔 loginAttempt 코드가 0건이라 이 mock 은 죽은 잔재이고, loginAttemptService 는 이 스위트에서 mock 없이 실물이 돈다. (2) '실제 secureStorage 를 타서 스위트가 깨진다'도 부정확 — secureStorage mock(:99-103)엔 getItem 자체가 없어 실물 함수의 try/catch fail-open 이 조용히 삼키고(getRemainingLoginAttempts 는 catch 시 MAX=5 반환) green 으로 통과한다. 깨지는 게 아니라 단언 없이 조용히 오값을 주는 더 나쁜 형태다. 배선 시 정답은 jest.mock('../loginAttemptService') 신설(죽은 sessionService mock 정리 겸) 또는 secureStorage mock 에 getItem/setItem/deleteItem 확장.

### 🛡️ 검증 — 삭제 안전성
삭제 없음(완성)이라 파괴 위험 0. MAX_LOGIN_ATTEMPTS(:18)는 비노출 상수지만 함수가 이미 캡슐화하므로 export 불필요 — 배선 측에서 '5' 를 하드코딩하지 말 것. 로그인 실패 토스트 문구를 바꾸는 배선이라면 e2e LOGIN_FAILED 상수(:73)가 현재 미소비임을 확인했으나, 배선 PR 에서 e2e 별도 Grep 재확인 관례(PR#353 선례)는 유지할 것. DB·마이그·RLS·알림 계약 무영향 확인.

### 🙋 사람이 결정할 것
① 몇 회째부터 경고할지 — 3회째(잔여 2) 권장이나 제품 결정. ② 경고 토스트에서 '비밀번호 찾기'로 바로 보낼지(감사 제안) 여부. ③ 잔여 횟수 노출이 정보 노출로 문제되는가 — 판단 재료: 이 카운터는 서버가 아니라 기기 로컬 secureStorage(loginAttemptService.ts:14 getItem/setItem, 키 `login_attempts_{email}`)라 재설치로 초기화되며, 이미 '기기 로컬 UX 보조 통제라 결함 아님' 판정이 있다(docs/analysis/2026-07-16-full-codebase-cleanup-analysis.md:110). 다만 Supabase Auth 서버측 rate limit 이 별도로 걸려 있는지는 이번 조사 범위 밖이라 확인 필요.



---

# F-리팩터고아


## `F1-a` — 판정: **제거**

**대상 심볼**

src/hooks/useTemplateManager.ts:85-105 useLoadTemplate · :122 isLoadTemplateModalOpen · :159-161 openLoadTemplateModal · :163-165 closeLoadTemplateModal · :204-211 handleLoadTemplate · :307 templatesError · :319-323 반환 멤버 5종 · src/services/jobs/templateService.ts:62-72 loadTemplate · src/services/jobs/index.ts:61 배럴 · src/repositories/interfaces/ITemplateRepository.ts:60 · src/repositories/supabase/TemplateRepository.ts:120-157 · src/hooks/index.ts:104 useTemplates 배럴 export

### 원래 의도 (왜 만들었나)
근거 있음. b758546b6(2026-01-11 feat(mobile): 지원자 프로필 연동 및 공고 템플릿 기능 추가)에서 도입, d3544ba6e(2026-04-18 fix(template): 공고 템플릿 기능 전면 수정)로 보강. 의도는 '저장된 템플릿 목록을 모달로 띄우고 하나를 골라 서버에서 다시 읽어 폼에 채운다'. 설계 근거는 docs/superpowers/plans/2026-07-17-order-sheet-s4-legacy-retirement.md:31 — 'LoadTemplateModal 전용 멤버(open/close/isLoadTemplateModalOpen·handleLoadTemplate 등)는 고아화되지만 export 아님(knip 무영향)·삭제 UI 복귀 여지 — PR 본문에 고아 멤버 후속 관찰 명기'. 즉 S4 당시 이미 고아화를 인지하고 의도적으로 미룬 것이지 모르고 남긴 게 아니다.

### 흐름이 끊긴 시점
2026-07-17 29dd21125 (refactor(jobs): create 사문 레거시 분기 제거 — 주문서 단일 경로 확정(S4)). git show 로 실측: create.tsx 에서 `import { LoadTemplateModal }`, `handleLoadTemplateFromModal`(:95-97 templateManager.handleLoadTemplate 호출), `onLoadTemplate={templateManager.openLoadTemplateModal}`(:228), `visible={templateManager.isLoadTemplateModalOpen}`(:258-261) 이 한 커밋에서 통째로 삭제됐다. 이어 e349c67e4 가 LoadTemplateModal.tsx(260줄) 파일 자체를 은퇴시켰다.

### 지금 살아 있는 코드 흐름
살아 있는 템플릿 회로는 '읽기=목록, 쓰기=저장' 두 갈래뿐이다.
[읽기] create.tsx:87 useTemplateManager() → useTemplateManager.ts:126 useTemplates() → :39-44 useQuery(queryKeys.templates.list) → services/jobs/templateService getTemplates → TemplateRepository → Supabase. 목록은 create.tsx:120 `for (const t of templateManager.templates)` → :122 templateToValues(t) → utils/order-sheet/mappers.ts:412 draftToValues(templateToDraft(template)) 로 **이미 전체 데이터를 들고 폼에 꽂힌다**. 서버 재조회가 없다.
[쓰기] PresetCarousel.tsx:91 '＋ 저장' onSavePress → create.tsx:142 templateManager.openTemplateModal() → :256-265 TemplateModal 렌더 → :148 templateManager.handleSaveTemplate(draft) → useTemplateManager.ts:186 saveMutation → templateService.saveTemplate → TemplateRepository → Supabase.
동일 배선이 edit.tsx:119-197, create-success.tsx:66-170 에도 있다(templateManager. 접근 전수 grep 결과 소비 멤버는 templates·templatesLoading·isTemplateModalOpen·templateName·templateDescription·setTemplateName·setTemplateDescription·openTemplateModal·closeTemplateModal·handleSaveTemplate·isSavingTemplate 11종뿐).

### 죽은 부분
심볼별 소비처 grep 결과(정의 파일 제외):
① isLoadTemplateModalOpen / openLoadTemplateModal / closeLoadTemplateModal / handleLoadTemplate / isLoadingTemplate — `templateManager.` 접근 전수 grep(src·app·e2e)에서 0건. 훅 내부 자기참조만 남았다(closeLoadTemplateModal 은 handleLoadTemplate 이, handleLoadTemplate 은 아무도 부르지 않는다).
② useLoadTemplate(:85-105) — handleLoadTemplate 전용. 연쇄 사망.
③ templateService.loadTemplate(:62-72) — 소비처는 useLoadTemplate(:89) 과 templateService.test.ts:179-236 뿐. 프로덕션 0.
④ ITemplateRepository.loadTemplate(:60) + TemplateRepository.loadTemplate(:120-157) — 위 서비스 함수 외 호출 0.
⑤ templatesError(:307) — 반환만 하고 읽는 곳 0건(전 레포 grep 1건 = 정의).
⑥ hooks/index.ts:104 의 `useTemplates` 배럴 export — 배럴 경유 import 0건. 실소비는 useTemplateManager.ts:126 내부 호출 + 테스트가 직접 경로(@/hooks/useTemplateManager)로 import.
⚠️ templateToDraft 는 **죽지 않았다** — mappers.ts:412 가 라이브로 쓴다. 같이 지우면 프리셋이 통째로 깨진다.

### 판정 근거
제품: 이 경로가 하던 일을 프리셋 캐러셀이 더 낫게 대체했다. 옛 흐름은 '불러오기 버튼 → 모달 → 목록 → 선택 → 서버 재조회 → 폼 주입'(5단계 + 네트워크 왕복 1회), 지금은 '캐러셀 칩 탭 → 즉시 적용'(1단계, 왕복 0회). 목록 쿼리가 이미 templateData 전체를 실어 오므로 loadTemplate 왕복은 원리적으로 잉여다. 단발 알바 공고를 하루에 여러 건 내는 홀덤펍 사장에게 탭 수가 줄어든 건 순이득이고, 되돌릴 이유가 없다. 비용: 유지하면 훅 반환 API 가 실제보다 8개 넓어 보여 다음 사람이 '불러오기 모달이 어딘가 있나' 를 매번 다시 조사한다(실제로 이번 세션에도 그랬다). 삭제 비용은 tsc 가 전량 지목해 주므로 낮다. F1-b(삭제/이름변경 UI 완성)를 나중에 하더라도 loadTemplate 은 필요 없다 — 관리 시트는 목록 데이터로 충분하다.

### 삭제 목록·순서
삭제 순서(위→아래, 각 단계마다 npx tsc --noEmit):
1) src/hooks/useTemplateManager.ts — :319-323 반환 블록 5줄(isLoadTemplateModalOpen·openLoadTemplateModal·closeLoadTemplateModal·handleLoadTemplate·isLoadingTemplate) + :307 templatesError 삭제
2) 같은 파일 :204-211 handleLoadTemplate, :163-165 closeLoadTemplateModal, :159-161 openLoadTemplateModal, :122 isLoadTemplateModalOpen useState, :128 loadMutation, :85-105 useLoadTemplate 함수 전체 삭제
3) 같은 파일 import 정리 — :12 loadTemplate, :18 templateToDraft(이 파일에선 handleLoadTemplate 전용이었으므로 제거. **mappers.ts 의 import 는 건드리지 말 것**), :22 JobPostingTemplate 타입은 handleDeleteTemplate 이 계속 쓰므로 유지
4) src/services/jobs/templateService.ts:62-72 loadTemplate 함수 삭제
5) src/services/jobs/index.ts:61 배럴 export 라인 삭제
6) src/repositories/supabase/TemplateRepository.ts:120-157 loadTemplate 메서드 삭제
7) src/repositories/interfaces/ITemplateRepository.ts:60 시그니처 삭제
8) src/services/jobs/__tests__/templateService.test.ts — :19 import 목록에서 loadTemplate 제거, :31 mockRepo.loadTemplate 제거, :176-236 describe('loadTemplate') 블록 전체 삭제
9) src/__tests__/hooks/useTemplateManager.test.ts:12 `loadTemplate: jest.fn()` 모킹 라인 삭제
10) src/hooks/index.ts:104 → `export { useTemplateManager } from './useTemplateManager';` 로 축소(useTemplates 만 제거)
⚠️ 남길 것: templateToDraft(types/jobTemplate.ts:150) · deleteTemplate 전 경로 · updateTemplate 전 경로 — 뒤 둘은 F1-b 소관

### 깨지는 것
실측 확인:
- e2e/ — `grep -rn 'preset|template' e2e -i` 결과 1건뿐이고 그건 `seedFixedJobPosting('crud-fixed-preset-skip')` 문자열(무관). 템플릿 E2E 커버리지 0 → 파급 없음.
- 테스트 — 위 8·9 단계 2개 파일만. src/__tests__/hooks/useTemplateManager.delete.test.tsx 는 삭제 경로만 보므로 무영향.
- 배럴 — src/hooks/index.ts:104(useTemplates), src/services/jobs/index.ts:61(loadTemplate) 2곳. src/utils/job-posting/index.ts 는 **존재하지 않음**(확인함).
- 타입 — ITemplateRepository 인터페이스 메서드 제거 시 SupabaseTemplateRepository 구현이 남으면 tsc 는 통과(초과 멤버 허용)하므로 **구현부를 먼저 지워야** 진짜로 지워진다. 순서 6→7 을 지킬 것.
- DB/마이그레이션 — 없음. job_posting_templates 테이블·RLS 무변경.
- 알림 type·딥링크 — 템플릿은 알림·딥링크 세그먼트를 갖지 않음(grep 0건).

### 검증 명령
```
npx tsc --noEmit && npx jest src/services/jobs/__tests__/templateService.test.ts src/__tests__/hooks/useTemplateManager.test.ts src/__tests__/hooks/useTemplateManager.delete.test.tsx
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — 단, 검증 방법상 중대 함정을 발견·우회했다: rg/Grep 을 uniqn-mobile 루트 기준으로 걸면 T-HOLDEM/.gitignore:14 `lib/` + :15 `!uniqn-mobile/src/lib/` 재포함 부정 패턴을 rg 가 처리하지 못해 src/lib/ 12개 파일이 통째로 조용히 누락된다(실측: 루트 걷기 2301개 중 'lib' 경로 0개, rg --files src=find 1552개 일치). 전 grep 을 src·app·e2e·functions·supabase 명시 경로로 재실행: ① 죽은 멤버 5종+templatesError 소비 0 재확인(handleDeleteTemplate 만 delete.test.tsx 5곳=F1-b 소관) ② e2e 'template' 0건, 'preset' 1건은 seedFixedJobPosting 문자열로 무관 ③ Edge Function 0건 ④ 배럴: hooks/index.ts:104 useTemplates 경유 import 0건(테스트는 직접 경로 import 실측) ⑤ DB 문자열·딥링크·app_config 무관 ⑥ templateToDraft 는 mappers.ts:412 라이브 재확인.

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. 프리셋 캐러셀이 목록 쿼리의 전체 templateData 로 즉시 적용하므로 loadTemplate 서버 재조회는 원리적으로 잉여라는 분석이 실코드와 일치(create.tsx→templateToValues→draftToValues 경로 실측).

### 🛡️ 검증 — 삭제 안전성
삭제 목록은 대체로 안전하나 4가지 보정 필요. ① [누락] TemplateRepository.loadTemplate(:135-147)이 RPC `increment_template_usage` 의 유일한 클라 호출자다 — 삭제 시 DB 함수와 usage_count 갱신 경로가 서버 쪽에서 고아화된다(이미 07-17부터 사실상 죽은 경로라 행동 변화 0). DB 함수·usage_count 컬럼은 절대 이 PR 에서 건드리지 말 것(usage_count 는 saveTemplate 삽입·TABLE_COLUMNS 조회에 여전히 등장). PR 본문에 서버 고아화 사실만 명기. ② [누락] repositories/index.ts:422 JSDoc 예시가 templateRepository.loadTemplate 을 언급 — stale 주석 정리 권장(비파괴). ③ [순서 보정] '6(구현)→7(인터페이스)' 순서로 하면 6 단계에서 `implements ITemplateRepository` 계약 위반으로 tsc 가 중간 red 가 난다 — 6·7 은 한 단계로 묶어 삭제. '인터페이스만 지우면 구현이 조용히 남는다'는 취지 자체는 옳다. ④ [라인 드리프트] templateService.ts loadTemplate 실제 범위는 JSDoc 포함 :55-75(보고서 :62-72) — 심볼 기준으로 삭제할 것. templateService.ts 의 import 는 삭제 후에도 전부 필요(isAppError=delete/update, JobPostingTemplate=getTemplates)해 정리 불요. knip false positive 계열(babel·expo-modules-core·mmkv/nitro)과 무관, TanStack 캐시 영속화 부재 실측(persistQueryClient 0건)으로 기기 잔존 데이터 영향 없음.


## `F1-b` — 판정: **완성**

**대상 심볼**

src/hooks/useTemplateManager.ts:31 UNDO_DELAY_MS · :132-147 pendingDeletesRef + 언마운트 flush · :217-302 handleDeleteTemplate · :326 isDeletingTemplate · src/services/jobs/templateService.ts:83-95 deleteTemplate · :105-120 updateTemplate · src/repositories/supabase/TemplateRepository.ts:159-199 deleteTemplate · :201-230 updateTemplate · src/__tests__/hooks/useTemplateManager.delete.test.tsx

### 원래 의도 (왜 만들었나)
근거 있음, 그리고 **원래 화면이 있었다**. b758546b6(2026-01-11)에서 도입, d3544ba6e(2026-04-18 fix(template): 공고 템플릿 기능 전면 수정 — description 컬럼 + edit 통합 + UX 폴리시), f95dc6cbc(#193 fix(template): 고정공고 템플릿 불러오기 복구 + 삭제 타이머 누수/경쟁 + 저장 안내 정확화)로 두 차례 결함 수정을 거친 성숙한 구현이다. 설계 근거는 .claude/rules/impeccable-design.md §12 'Undo > Confirm'. 소비 UI 도 실재했다 — `git show e349c67e4^:.../LoadTemplateModal.tsx` 에 :6 TrashIcon import, :17 `onDeleteTemplate: (id, name) => Promise<boolean>`, :102-104 accessibilityLabel='템플릿 삭제' + TrashIcon 렌더, :223-224 `logger.info('템플릿 삭제 요청') / await onDeleteTemplate(id, name)` 가 있다.

### 흐름이 끊긴 시점
2026-07-17 29dd21125. git show 로 `- onDeleteTemplate={templateManager.handleDeleteTemplate}` (create.tsx:265) 삭제를 실측했다. **이건 '애초에 안 이어진 것'이 아니라 이어져 있던 회로가 끊긴 것**이다 — S4 는 레거시 폼 체인을 은퇴시키면서 그 안에 얹혀 있던 삭제 어포던스를 함께 잃었고, 주문서 쪽에 대체 진입점을 만들지 않았다. S4 계획서(docs/superpowers/plans/2026-07-17-order-sheet-s4-legacy-retirement.md:31)가 '삭제 UI 복귀 여지'라고 스스로 예고했으나 후속이 없었다.

### 지금 살아 있는 코드 흐름
삭제 회로는 **테스트에서만 살아 있다**:
src/__tests__/hooks/useTemplateManager.delete.test.tsx:104 result.current.handleDeleteTemplate('a','A') → useTemplateManager.ts:244-247 queryClient.setQueryData(옵티미스틱 제거) → :274 setTimeout(commit, UNDO_DELAY_MS) → :257 deleteTemplate(templateId,userId) → templateService.ts:85 templateRepository.deleteTemplate → TemplateRepository.ts:159 → Supabase.
앱 쪽 진입점 실측: PresetCarousel.tsx:69-92 의 프리셋 카드는 onPress 가 곧바로 `onSelect(p)`(적용) 하나뿐이고 롱프레스·컨텍스트 메뉴·아이콘 버튼이 없다. `find app -name '*.tsx'` 에 template/preset 라우트 0건 — 별도 관리 화면도 없다. 즉 사장이 프리셋을 지울 수 있는 픽셀이 앱 전체에 0개다.

### 죽은 부분
① handleDeleteTemplate(:217-302, 86줄) — `templateManager.` 접근 grep 전수에서 앱 코드 0건, 소비처는 delete.test.tsx 5곳뿐.
② isDeletingTemplate(:326) — `false` 하드코딩된 채 반환. 소비처 0. (pendingDeletesRef.size 는 렌더 트리거가 없어 애초에 상태로 쓸 수 없는 값이다.)
③ UNDO_DELAY_MS(:31) · pendingDeletesRef(:132-147) — handleDeleteTemplate 전용, 연쇄 고아.
④ templateService.deleteTemplate(:83-95) + TemplateRepository.deleteTemplate(:159-199) — 위 훅 외 호출 0.
⑤ updateTemplate(templateService.ts:105-120 · TemplateRepository.ts:201-230 · ITemplateRepository.ts:83 · services/jobs/index.ts:63) — **훅조차 안 부른다.** 소비처는 templateService.test.ts:289-360 뿐. 이름 변경 API 는 서비스·리포지토리까지 완성돼 있는데 훅 레이어가 통째로 비어 있다.

### 판정 근거
제품: 이건 '있으면 좋은 기능'이 아니라 **되찾아야 할 회귀**다. 프리셋은 쓸수록 쌓이는 구조인데(create.tsx:120 이 저장 템플릿을 전부 캐러셀에 나열) 지울 방법이 없으면 잘못 저장한 '테스트' 프리셋이 영구히 캐러셀 앞자리를 차지한다. 게다가 useTemplateManager.ts:174-184 의 중복 이름 차단이 덮어쓰기 없이 토스트만 띄우고 **모달을 닫지도 않아서**, 사장은 같은 구성을 다시 저장하려 할 때마다 새 이름을 지어내야 한다 — 삭제가 없으니 이름 공간이 단조 증가한다. 1차 감사(docs/analysis/2026-08-02-employer-seeker-ux-friction-audit.md:110-113)가 `template-cannot-delete-or-rename` 을 CONFIRMED·수정 M 으로 판정했고, 심층 분석(2026-08-02-ux-friction-selected-deepdive.md `preset-no-delete-rename` 부분사실·CONFIRMED·수정필요·M→M·마이그 불필요)도 같은 결론이다.
비용: 지금 지우면 86줄의 Undo 구현(옵티미스틱 제거 → 5초 토스트 → 원래 인덱스 splice 복원 → 언마운트 flush → 연속 삭제 경쟁 잠금)을 버리는데, 이건 #193 에서 타이머 누수와 경쟁 조건을 실제로 고쳐 얻은 코드이고 5케이스 테스트가 붙어 있다. 재작성 비용 >> UI 부착 비용. 결정적으로 이 구현은 **다른 작업의 참조 원본**이기도 하다 — deepdive:1077-1100 이 `useDeleteNotification` 을 'useTemplateManager 문형'으로 재작성하라며 :138-147 언마운트 flush 와 :231-241 splice 복원을 그대로 이식하라고 지시한다. 지우면 그 설계의 근거 코드가 사라진다.
반대 논거(기본값=제거)를 기각하는 이유: '기본값 제거'는 만들다 만 스캐폴딩에 적용되는 규칙인데, 이건 만들다 만 게 아니라 **완성돼 돌던 것이 리팩터링 부수효과로 끊긴 것**이다. 사용자가 쓰던 기능을 조용히 잃은 상태를 '필요 없는 것'으로 분류할 수 없다.

### 완성 비용
3파일 신설·수정, 마이그레이션 불필요, 서버 무변경.
1) 신설 src/components/employer/order-sheet/PresetManageSheet.tsx (~120줄) — 프리셋 1건의 이름 변경 입력 + 삭제 버튼. 기존 시트 관례(PlaceSheet/ScheduleSlotsSheet) 따르고 dark: 필수, 확인은 confirmAction 대신 **삭제는 곧바로 실행 + Undo 토스트**(이미 handleDeleteTemplate 이 그렇게 동작).
2) 수정 PresetCarousel.tsx:69-92 — Pressable 에 onLongPress 추가(`onManage?.(p)`). ⚠️ 메모리 기재 함정: RN Pressable 은 자식 텍스트를 스크린리더에서 삼키므로 accessibilityActions 로 '관리' 액션을 별도 노출할 것. p.id === 'last'(마지막 공고 프리셋)는 템플릿이 아니므로 관리 대상에서 제외.
3) 수정 create.tsx — PresetManageSheet 렌더 + templateManager.handleDeleteTemplate / (신설)handleRenameTemplate 배선. edit.tsx·create-success.tsx 는 캐러셀이 없으므로 무변경.
4) 수정 useTemplateManager.ts — useRenameTemplate 내부 뮤테이션 추가(mutationFn 은 기존 templateService.updateTemplate 을 그대로 import). onSuccess 에서 queryKeys.templates.all invalidate. **자기 자신 이름 유지 시 중복 차단 예외** 처리 필요(:174-184 로직 재사용 시 자기 id 제외). 이름에 xssValidation refine 적용(전역 보안 규칙).
5) :326 isDeletingTemplate 는 `false` 하드코딩이라 무의미 — prop 자체를 제거하고 시트는 Undo 토스트로 피드백한다.
6) 신설 테스트 — 헬퍼만 보는 유닛은 불충분(메모리 기재 S5 교훈). PresetCarousel 롱프레스 → 시트 오픈 → 삭제 호출까지 **컴포넌트 테스트로 red-green** 을 만들 것.
덤: 중복 이름 차단(:174-184)을 '덮어쓸까요?' 로 바꾸는 건 별건으로 분리 권장(이름 변경이 들어가면 차단의 압박이 크게 줄어든다).

### 깨지는 것
- e2e/ — 템플릿 시나리오 0건(실측). 신규 testID 추가만 하면 되고 기존 스펙 파급 없음.
- 테스트 — delete.test.tsx 는 그대로 통과해야 한다(훅 시그니처 불변). isDeletingTemplate 제거는 소비처가 0이라 무해.
- 타입 — updateTemplate 배선 시 CreateTemplateInput 이 아니라 부분 갱신 타입이 필요. ITemplateRepository.ts:83 시그니처 확인 후 재사용할 것(이미 존재).
- DB — job_posting_templates DELETE/UPDATE RLS 가 owner 기준으로 이미 있어야 한다. deleteTemplate 이 userId 를 넘기는 형태(TemplateRepository.ts:159)이므로 서버 정책 확인만 하고 마이그는 만들지 말 것.
- NativeWind — 신설 시트에 존재하지 않는 토큰을 쓰면 tsc·eslint·prettier 아무도 안 잡는다(메모리 기재 B1 함정). tailwind.config 실재 토큰만 사용.

### 검증 명령
```
npx jest src/__tests__/hooks/useTemplateManager.delete.test.tsx src/components/employer/order-sheet/__tests__ && npx tsc --noEmit
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — 완전 걷기 재실측: handleDeleteTemplate 앱 소비 0(delete.test.tsx 5곳뿐), isDeletingTemplate 소비 0(:326 `false` 하드코딩 실측), updateTemplate 은 훅 레이어 호출 0(templateService.test.ts 만). PresetCarousel.tsx 실측: onPress→onSelect(:72)·onSavePress(:91)뿐, 롱프레스·삭제 어포던스 0. app/ 에 template/preset 라우트 0건(rg --files 확인). '앱 전체에 삭제 픽셀 0개' 주장 정확.

### ⚖️ 검증 — 판정 심사 (동의)
완성 판정 동의. 이것은 스캐폴딩이 아니라 29dd21125 에서 끊긴 회귀라는 논거를 수용한다 — 결정적으로 서버 준비가 이미 끝나 있다: baseline 에 `templates_delete_own`·`templates_update_own` RLS(owner 기준)를 실측 확인했고(마이그 불필요 주장 검증됨), 중복 이름 차단(:174-184)이 모달을 닫지 않고 토스트만 띄우는 것도 실코드로 확인 — 삭제 부재가 이름 공간 단조 증가를 만든다는 제품 논거가 성립한다. Undo 구현(:217-302)은 옵티미스틱 제거·splice 위치 복원·언마운트 flush·커밋 1회 잠금까지 갖춘 성숙 코드로 재작성 비용 > UI 부착 비용 판단에 동의.

### 🛡️ 검증 — 삭제 안전성
삭제 목록이 빈 것이 적절하다(지우지 말 것). 완성 작업 시 주의 3건: ① isDeletingTemplate 은 `false` 하드코딩이므로 UI 배선 시 이 값을 신뢰하면 안 된다 — 제거하거나 실값(pendingDeletesRef 는 렌더 트리거가 없어 상태로 못 쓴다는 보고서 분석이 정확)으로 재설계. ② updateTemplate 부분 갱신 타입은 ITemplateRepository.ts:82-91 에 이미 `Partial<Pick<...,'name'|'description'> & {draft?, formData?}>` 로 존재 — 재사용 가능 확인. ③ F1-a 를 먼저 적용해도 F1-b 유지 대상(deleteTemplate·updateTemplate 전 경로·delete.test.tsx·UNDO_DELAY_MS·pendingDeletesRef)과 충돌 없음 교차 확인 — 단 F1-a 3단계에서 JobPostingTemplate import(:22)는 handleDeleteTemplate 이 계속 쓰므로 유지하라는 지시가 정확하다.

### 🙋 사람이 결정할 것
제품 오너 결정 2건. ① 관리 진입점을 프리셋 카드 **롱프레스**로 할지 '＋ 저장' 옆 **관리 버튼**으로 할지 — 롱프레스는 발견 가능성이 낮고(사장이 모른다), 버튼은 캐러셀 폭을 먹는다. ② 이름 변경까지 이번에 넣을지, 삭제만 먼저 넣을지 — 삭제만이면 중복 이름 차단의 압박이 남는다(같은 이름 재저장 불가는 그대로). 개인적 권고는 '롱프레스 + 삭제·이름변경 동시'인데, 이건 사용자 결정 사항이다.


## `F2` — 판정: **제거**

**대상 심볼**

src/lib/queryClient.ts:531 queryKeys.reviews.bubbleScore · src/lib/invalidationStrategy.ts:119 InvalidationTarget 유니온 멤버 'reviews.bubbleScore' · :411 'review.create' 이벤트 타깃 목록 항목 · :555-557 switch case

### 원래 의도 (왜 만들었나)
근거 있음. b56a11a07 (feat(mobile): 버블(Bubble) 상호 평가 시스템 구현) 에서 도입. 설계 문서는 docs/archive/specs/2026-06/2026-06-24-review-feature-recovery-design.md — create_review RPC 가 리뷰 INSERT 와 동시에 피평가자 users.bubble_score(jsonb) 를 원자 갱신하도록 설계됐고, 클라 쪽에는 '남의 버블 점수를 읽는 쿼리'가 있을 것을 전제로 무효화 키를 먼저 깔았다. 다만 **읽기 훅을 만든 커밋은 존재하지 않는다** — `git log -S` 로 이 키를 쓰는 useQuery 를 찾을 수 없다.

### 흐름이 끊긴 시점
끊긴 게 아니라 **애초에 안 이어졌다.** 무효화 쪽(invalidationStrategy.ts) 배선만 먼저 들어가고 소비 쪽 useQuery 가 한 번도 작성된 적이 없다. docs/analysis/2026-08-02-ux-friction-selected-deepdive.md:1650 이 같은 판정을 내린다 — '리팩터링으로 지워진 흔적이라면 무효화 쪽도 같이 지워졌을 것이다. 쓸 예정이었던 키가 무효화만 먼저 배선된 형태다.'

### 지금 살아 있는 코드 흐름
평판 회로에서 실제로 도는 것:
[쓰기] useReviews.ts:98 invalidateRelated('review.create', {...}) → invalidationStrategy.ts:405-412 타깃 5종 조회 → :545-557 resolveQueryKey → queryClient.invalidateQueries. 이 중 실효가 있는 건 reviews.byWorkLog·reviews.myGiven·reviews.pending·user.profile 4종.
[표시] ApplicantCard.tsx:134-135 `bubbleScore={userProfile?.bubbleScore?.score}` → CardHeader.tsx:92-99 BubbleScoreBadge. 데이터 소스는 useUserProfile → UserRepository.getById 의 users 직접 조회이고 **queryKeys.reviews.bubbleScore 를 경유하지 않는다**.
즉 bubbleScore 키에 등록된 useQuery 는 0개 — 아무도 읽지 않는 캐시를 review.create 마다 무효화하고 있다.

### 죽은 부분
queryKeys.reviews.bubbleScore(:531) — `queryKeys.reviews` 전수 grep 결과 소비처는 useReviews.ts 의 byWorkLog(:30)·myReceived(:41)·myGiven(:58,:357)·pending(:283,:308,:342) 뿐. bubbleScore 를 queryKey 로 등록하는 useQuery 0개. 참조는 invalidationStrategy.ts 4곳(타입 유니온 :119 · 이벤트 목록 :411 · switch :555-557)뿐이고 이들은 전부 '무효화하는 쪽'이다. 별칭 함정 재확인 완료 — `= queryKeys.` 별칭은 레포 전체에 useNotifications.ts:57 하나뿐이고 reviews 와 무관하다.

### 판정 근거
제품: 지원자 평판 노출 자체는 타깃 사용자에게 의미가 있다(단발 알바를 뽑는 홀덤펍 사장에게 노쇼 이력은 핵심 판단 정보). 그러나 **이 쿼리키는 그 기능이 아니다.** deepdive `applicant-reputation-invisible` 실측에 따르면 진짜 병목은 users_select RLS 가 남의 행에 0행을 주는 것이고(baseline:14043 — `(auth.uid()=id) OR (get_my_role()='admin')` 단 하나의 SELECT 정책), 해법은 SECURITY DEFINER RPC 신설 + 마이그레이션(난이도 L·마이그 필요)이다. 그 작업이 승인되면 새 훅과 새 키를 어차피 새로 쓰게 된다.
비용: 유지 비용은 6줄 + '무효화가 배선돼 있으니 어딘가 읽고 있겠지'라는 오독 유발. 삭제 비용은 6줄, 재추가 비용도 6줄로 대칭이다. 대칭이면 사용자 지시('필요 없는 건 지운다')가 타이브레이커다.
주의해서 남기는 논거도 인정한다 — deepdive:1699 는 '수정 시 신설 훅을 이 키에 태우면 무효화가 자동으로 살아난다(설계 이득)'고 본다. 하지만 그 이득은 6줄을 다시 쓰는 것과 같은 크기이고, 그 사이 기간 내내 거짓 신호를 준다. 지우고, 평판 RPC 를 만들 때 함께 되살리는 편이 정직하다.

### 삭제 목록·순서
삭제 순서:
1) src/lib/invalidationStrategy.ts:411 — 'review.create' 배열에서 `'reviews.bubbleScore',` 한 줄 제거 (user.profile 은 **반드시 유지** — bubble_score 가 users 행에 비정규화돼 있어 실제 갱신은 이쪽으로 전파된다)
2) 같은 파일 :555-557 — `case 'reviews.bubbleScore':` ~ `: queryKeys.reviews.all;` 3줄 제거
3) 같은 파일 :119 — InvalidationTarget 유니온에서 `| 'reviews.bubbleScore'` 제거
4) src/lib/queryClient.ts:531 — `bubbleScore: (userId: string) => [...queryKeys.reviews.all, 'bubbleScore', userId] as const,` 1줄 제거
(1→2→3 순서를 지키면 각 단계에서 tsc 가 남은 참조를 지목한다. 3 을 먼저 지우면 유니온 좁힘 때문에 1·2 가 동시에 에러로 뜬다 — 그것도 안전하지만 diff 가 지저분하다.)

### 깨지는 것
- 타입 — InvalidationTarget 유니온 축소는 tsc 가 전 참조를 지목한다(:411, :555-557). 놓칠 수 없다.
- 테스트 — src/lib/__tests__/invalidationStrategy.test.ts 가 'review.create' 타깃 개수/목록을 단언하는지 삭제 전 확인 필요. 단언한다면 기대값 5→4 로 갱신.
- e2e/ — 무효화 키는 E2E 관측 대상이 아님(grep 0건).
- DB — 무변경. create_review RPC·users.bubble_score 컬럼·fn_send_review_reminders 크론 전부 그대로다. **서버 쪽은 아무것도 건드리지 않는다.**
- 알림 — review_request 알림 트리거(baseline:5298,:5322)와 무관.

### 검증 명령
```
npx tsc --noEmit && npx jest src/lib/__tests__/invalidationStrategy.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — src/lib 누락 함정을 우회한 완전 걷기로 재실측: queryKeys.reviews.bubbleScore 를 queryKey 로 등록하는 useQuery 0개. 유일 의심 경로였던 useBubbleScore(useReviews.ts:112-115)는 authStore profile 직독으로 쿼리키 비경유 실측. 별칭은 레포 전체에 notificationKeys 1곳뿐(reviews 무관), 구조분해 0곳. 참조 4곳(invalidationStrategy :119/:411/:555-557) 전부 무효화 쪽 확인. DB 의 bubble_score 는 create_review RPC 가 갱신하는 users 컬럼으로 클라 쿼리키와 무관 — 서버 무변경 주장 정확.

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. 'user.profile 유지' 지시의 기전을 보정해 둔다: review.create 컨텍스트는 {workLogId, revieweeId}이고 resolveQueryKey 의 'user.profile' 케이스(:541-542)는 context.userId 를 요구하므로 실제로는 user.all 로 폴백된다 — 리뷰이 프로필 무효화는 프리픽스 매칭으로 여전히 동작하니 유지 지시 자체는 옳지만, '정밀 전파'가 아니라 '광역 폴백'이라는 점을 알고 지울 것.

### 🛡️ 검증 — 삭제 안전성
삭제 4단계 안전 확인. 보완 2건: ① 보고서가 '확인 필요'라 미룬 invalidationStrategy.test.ts 를 내가 실측했다 — 'review.create' 를 단언하는 테스트 없음(applicant.reviewCancellation·applicant.confirm·jobPosting.update 만) → 기대값 갱신 불필요 확정. 단 [누락] 같은 테스트 :66 의 jest.mock 팩토리에 `bubbleScore: (revieweeId)=>...` 목 라인이 있다 — 방치해도 통과하지만 존재하지 않는 키를 목킹하는 오독 유발원이므로 함께 제거 권장. ② [누락] invalidationStrategy.ts:404 JSDoc `- 피평가자 버블 점수` 라인도 :411 과 함께 제거. 1→2→3 순서 논리(단계별 tsc 지목)는 타당.

### 🙋 사람이 결정할 것
'지원자 평판 노출'(deepdive `applicant-reputation-invisible`, 난이도 L·마이그 필요)을 착수할지 여부는 별건 결정이다. 착수한다면 이 4줄은 새 훅과 함께 되살아난다 — 그때 키 이름을 bubbleScore 로 할지 reputation 으로 할지는 RPC 반환 형상(점수만? 노쇼 횟수까지?)이 정해진 뒤 결정하는 게 맞다.


## `F3-a` — 판정: **제거**

**대상 심볼**

src/lib/queryClient.ts — :214 user.current · :235 applications.lists · :236-237 applications.list · :267 notifications.lists · :279-281 settings 그룹 전체(all·user·notification) · :334 templates.detail · :373-374 settlement.calculation · :387 confirmedStaff.detail · :388-389 confirmedStaff.grouped · :393-397 eventQR 그룹 전체(all·current·history) · :403-404 reports.byJobPosting · :405 reports.byStaff · :407 reports.myReports · :451 announcements.unreadCount · :532-533 reviews.eligibility

### 원래 의도 (왜 만들었나)
근거 부분적. 대부분 7c5aeebd2(2025-12-17 feat(mobile): Phase 1 프로젝트 기반 구축 완료)에서 '중앙 쿼리키 레지스트리'를 한꺼번에 선언하며 만들어졌다 — 파일 헤더 주석 :205-207 '모든 Query Key를 중앙에서 관리 / 일관된 키 패턴으로 캐시 무효화 용이'. 즉 개별 키마다 소비처를 두고 만든 게 아니라 **있을 법한 키를 미리 깐 것**이다. settings 그룹은 230db7d88(2026-01-31 refactor(mobile): 타입/데이터/UI 통합 개선)에서 한 번 손댄 이력이 있고, eventQR 그룹은 1f5bc44cc(feat(mobile): 확정 스태프 관리 및 정산 기능 구현), reviews.eligibility 는 b56a11a07(버블 상호 평가 시스템) 소속이다. 개별 키의 설계 근거 문서는 찾지 못했다 — docs/superpowers/specs·docs/analysis·wiki 어디에도 이 키들을 지목한 서술이 없다.

### 흐름이 끊긴 시점
대부분 **애초에 안 이어졌다.** `git log -S` 로 각 키의 소비처 커밋을 찾으면 0건이다(선언 커밋만 나온다). 예외 성격이 있는 건 notifications.lists — 형제인 notifications.list 는 useNotifications.ts:101 이 별칭 경유로 쓰고 있어 lists 만 남은 잉여다. eventQR 그룹은 queryClient.ts:732 invalidateQueries.eventQR() 이 유일하게 참조하는데 그 헬퍼 자체가 죽어 있어(F3-b) 자기순환이다.

### 지금 살아 있는 코드 흐름
살아 있는 쿼리키는 정상적으로 이 파일을 경유한다. 예: useNotifications.ts:57 `const notificationKeys = queryKeys.notifications` → :101 notificationKeys.list(filter ?? {}) → :111 useQuery({queryKey}) → notificationRepository. useAdminReports.ts:65 queryKeys.reports.detail(reportId) → useQuery. useSettlement.ts:64 queryKeys.settlement.byJobPosting → useQuery. 위 고아 16개는 이런 화살표가 하나도 그려지지 않는다.

### 죽은 부분
검증 방법: queryClient.ts 의 키 팩토리 163개를 전부 뽑아 `queryKeys.<group>.<name>` 문자열로 src·app·e2e·supabase 전수 대조했고, **별칭 우회를 별도로 잡았다**(`= queryKeys\.[a-zA-Z]*;` grep → useNotifications.ts:57 단 1곳, `} = queryKeys` 구조분해 → 0곳). 그 결과 소비 0인 팩토리 16개(F2 의 bubbleScore 제외):
user.current(0) · applications.lists(0) · applications.list(0) · notifications.lists(0) · settings.all/user/notification(0·0·0) · templates.detail(0) · settlement.calculation(0) · confirmedStaff.detail(0) · confirmedStaff.grouped(0) · eventQR.current(0) · eventQR.history(0) · reports.byJobPosting(0) · reports.byStaff(0) · reports.myReports(0) · announcements.unreadCount(0) · reviews.eligibility(0).
eventQR.all 은 queryClient.ts:732 내부 1건뿐이고 그 호출자가 없다 → 그룹 전체 사망.
settings.all 은 settings.user/notification 내부 참조뿐 → 그룹 전체 사망.
⚠️ 라이브로 재판정한 것: notifications.list · notifications.settings — 문자열 grep 으로는 0건이지만 별칭(notificationKeys)으로 8회 소비된다. **이 둘은 절대 지우지 말 것.**

### 판정 근거
제품: 쿼리키는 사용자가 보는 기능이 아니므로 제품 논거는 '이 키가 가리키는 기능이 존재하는가'로 환원된다. settings 그룹 — 앱 설정은 authStore·notificationStore·MMKV 로 관리되고 TanStack Query 를 안 쓴다(설정 화면 어디에도 useQuery 없음). eventQR 그룹 — 현장 QR 은 useQRCode.ts → processQRCheckIn 뮤테이션 단발이고 캐시할 상태가 없다(QR 문자열은 buildVenueQRString 이 즉석 생성). reports.byJobPosting/byStaff/myReports — 신고 조회는 관리자 전용(useAdminReports)이고 구인자·구직자용 신고 목록 화면이 없다. 즉 어느 것도 '만들다 만 기능의 예약석'이 아니라 **있을 법해서 미리 깐 자리**다.
비용: 유지 비용이 낮아 보이지만 실제로는 높다 — 이 파일은 캐시 무효화 설계의 진실원인데, 실제로는 아무도 안 쓰는 키가 16개 섞여 있으면 '이 도메인은 캐시 전략이 서 있다'는 착시를 준다. 실제로 이번 세션에서 eventQR.all 을 무효화하는 헬퍼(:732)가 있어서 QR 캐시가 관리되는 줄 알았다가 호출자 0건임을 확인해야 했다. 삭제 비용은 tsc 가 전부 잡아 주므로 사실상 0.
반대 논거: '나중에 쓸 수도' — 기각. 키 팩토리 1줄은 필요할 때 1줄 쓰면 된다. 미리 깔아 둔 자리가 실제로 쓰인 비율이 이 파일에서 90%(147/163) 인데 나머지 10%가 6~7개월간 안 쓰였다.

### 삭제 목록·순서
⚠️ **선행 조건: F3-b 를 먼저 적용할 것.** queryClient.ts:732 invalidateQueries.eventQR 이 queryKeys.eventQR.all 을 참조하므로 순서를 뒤집으면 tsc 가 깨진다.
삭제 목록(전부 src/lib/queryClient.ts):
1) :214 `current: () => [...queryKeys.user.all, 'current'] as const,`
2) :235 `lists: () => [...queryKeys.applications.all, 'list'] as const,`
3) :236-237 `list: (filters: Record<string, unknown>) => [...queryKeys.applications.all, 'list', filters] as const,`
4) :267 `lists: () => [...queryKeys.notifications.all, 'list'] as const,` — **:269 list 와 :274 settings 는 남길 것**(별칭 소비 실측됨)
5) :278-282 settings 그룹 블록 전체(`settings: { all, user, notification }`) + 위 주석 `// 설정`
6) :334 `detail: (id: string) => [...queryKeys.templates.all, 'detail', id] as const,`
7) :373-374 `calculation: (workLogId: string) => ...`
8) :387 confirmedStaff.detail · :388-389 confirmedStaff.grouped
9) :392-398 eventQR 그룹 블록 전체 + 위 주석 `// 이벤트 QR (구인자 - 현장 출퇴근)`
10) :403-404 reports.byJobPosting · :405 reports.byStaff · :407 reports.myReports — **:406 detail 과 :401 all 은 유지**(useAdminReports.ts:48,65,95 라이브)
11) :451 announcements.unreadCount
12) :532-533 reviews.eligibility
각 단계 후 npx tsc --noEmit. 총 16개 팩토리 + 그룹 주석 2줄.

### 깨지는 것
- 별칭 — useNotifications.ts:57 이 유일한 별칭 사이트. `notificationKeys.` 멤버 사용은 all(5회)·list(1회)·settings(7회) 세 개뿐이고 셋 다 유지 대상이다. lists 만 지운다.
- 테스트 — src/lib/__tests__/queryClient.test.ts 가 존재한다(:41 invalidateQueries.staffManagement 단언 확인). 이 파일이 삭제 대상 키를 단언하는지 삭제 전 확인 필요. src/__tests__/hooks/useTemplateManager.delete.test.tsx:13 은 queryKeys.templates.list 를 쓰므로 무영향.
- 배럴 — src/lib/index.ts 가 queryKeys 객체를 통째로 re-export 하므로 개별 키 삭제는 배럴 무변경.
- e2e/ — 쿼리키는 E2E 관측 대상 아님.
- DB·알림·딥링크 — 무관.
- 타입 — `as const` 튜플이라 삭제 시 소비처가 있으면 tsc 가 즉시 에러. 조용히 통과할 경로가 없다.

### 검증 명령
```
npx tsc --noEmit && npx jest src/lib/__tests__/queryClient.test.ts src/lib/__tests__/invalidationStrategy.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — 이 묶음이 src/lib 누락 함정의 최대 위험 지대였다(정의 파일 자체가 src/lib/queryClient.ts). 완전 걷기로 3중 재검증: ① 16개 팩토리 각각 `queryKeys.<group>.<name>` 정규 접근 0건(대조군 reports.detail·settlement.byJobPosting 은 정상 검출되어 grep 유효성 입증) ② 별칭 전수: `= queryKeys` 는 notificationKeys 1곳뿐이고 멤버 사용은 all(5)·list(1)·settings(7) — 보고서 수치와 정확 일치, lists 는 0 ③ 문자열 리터럴 우회(`['settings'`·`['eventQR'`·'eligibility' 등) 정의·테스트목 외 0건 ④ invalidationStrategy 타깃 문자열 전수 대조 — 16개 키 중 어느 것도 InvalidationTarget/resolveQueryKey 에 없음(삭제 목록이 invalidationStrategy 를 안 건드려도 완전함을 확정) ⑤ eventQR.all 유일 참조=자기 파일 :732(F3-b 소관) 확인.

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. '유지 대상' 지정도 전수 실측으로 뒷받침된다: reports.all(:48,:95)·reports.detail(:65)=useAdminReports 라이브, notifications.list/settings=별칭 8회 라이브, templates.list/all·user.all/profile/profileBatch·applications.all/mine/detail·confirmedStaff.byDate/byJobPosting·settlement.byJobPosting/summary/all/byVenue 전부 라이브 확인.

### 🛡️ 검증 — 삭제 안전성
안전 확정 3건 + 주의 1건. ① 보고서가 '확인 필요'라 미룬 queryClient.test.ts 를 실측 — invalidateQueries.staffManagement(:41)만 단언, 삭제 대상 키 단언 0건 → 갱신 불필요 확정. ② TanStack 캐시 영속화 배선 부재 실측(persistQueryClient/PersistQueryClientProvider/persister 0건) → 기기 MMKV 잔존 캐시 영향 원천 없음. ③ src/lib/index.ts 는 객체 통째 re-export 라 배럴 무변경 확인. ④ [순서] F3-b 선행 필수 재확인 — :732 invalidateQueries.eventQR 이 queryKeys.eventQR.all 참조. 4번 항목의 ':269 list 와 :274 settings 유지' 지시가 정확함을 별칭 실측으로 재보증. knip 이력의 빌드 설정·peer 네이티브와 무관한 순수 TS 소스.


## `F3-b` — 판정: **제거**

**대상 심볼**

src/lib/queryClient.ts:724-772 invalidateQueries 객체의 죽은 멤버 11종 — applications · schedules · workLogs · notifications · confirmedStaff · eventQR · reports · settlement · tournaments · reviews · all

### 원래 의도 (왜 만들었나)
근거 있음(약함). 7c5aeebd2(2025-12-17 Phase 1)에서 객체 통째로 도입. 주석은 :721 '특정 쿼리 그룹 무효화' 한 줄뿐이고 개별 멤버의 설계 근거는 없다. 이후 무효화 전략의 정본이 src/lib/invalidationStrategy.ts 로 옮겨갔다 — 그 파일은 이벤트 기반(`invalidateRelated('review.create')`)이고 도메인별 일괄 무효화보다 정밀하다. docs/analysis/2026-07-16-full-codebase-cleanup-analysis.md:52 가 이미 같은 파일의 형제 문제를 지적한 바 있다: 'lib/queryClient.ts:763-797 invalidationGraph — invalidationStrategy.ts와 중복, queryClient판은 죽은 코드'(그 건은 이미 정리됨).

### 흐름이 끊긴 시점
점진적으로 안 이어졌다. invalidationStrategy.ts 가 정본이 되면서 신규 코드가 이쪽을 안 쓰게 됐고, 기존 소비처도 staffManagement 같은 복합 헬퍼로 수렴했다(useConfirmedStaff.ts 가 8회 호출). 특정 커밋 하나로 끊긴 게 아니라 대체재가 자라면서 자연 도태됐다.

### 지금 살아 있는 코드 흐름
살아남은 7개 멤버는 정상 동작한다:
useConfirmedStaff.ts:147 invalidateQueries.staffManagement(jobPostingId) → queryClient.ts:743-755 confirmedStaff.byJobPosting + settlement.byJobPosting + workLogs.all + schedules.all + reviews.pending + POSTING_FILLED_COUNTS + workSchedule.all 일괄 무효화.
useBoard.ts:342 invalidateQueries.boards() (14회) · profileService.ts:105 invalidateQueries.user() (5회) · employerApplicationService.ts:121 invalidateQueries.employerApplications() (3회) · announcements(5회) · tournamentApproval(3회) · jobPostings(3회).

### 죽은 부분
`invalidateQueries\.[a-zA-Z]+` 를 src·app·e2e 전수 집계한 결과 실제 호출은 7종뿐이다: boards(14) · staffManagement(10) · user(5) · announcements(5) · tournamentApproval(3) · jobPostings(3) · employerApplications(3). (나머지 1건 `invalidateQueries.mockClear` 는 invalidationStrategy.test.ts:97 의 jest mock 조작으로 별개.)
따라서 호출 0인 멤버: applications(:726) · schedules(:728) · workLogs(:729) · notifications(:730) · confirmedStaff(:731) · eventQR(:732) · reports(:733) · settlement(:734) · tournaments(:754) · reviews(:765) · all(:771) — 11종.
특기: `all: () => queryClient.invalidateQueries()` 는 인자 없는 전체 무효화라 실수로 부르면 앱 전체 리페치를 유발하는 함정이고, 호출자가 0이다.

### 판정 근거
제품: 무효화 정책은 사용자에게 직접 보이지 않지만 **틀리면 화면에 낡은 숫자가 남는다**. 이 앱에서 그 위험이 가장 큰 곳은 인원 카운트·그리드 배지인데(staffManagement 주석 :736-741 이 그 함정을 길게 설명한다), 실제 방어는 전부 staffManagement 와 invalidationStrategy 가 하고 있다. 도메인 단위 일괄 무효화 11종은 그 정밀한 설계와 **경쟁하는 조잡한 대안**이다 — 남겨 두면 다음 사람이 `invalidateQueries.workLogs()` 를 부르고 끝내서, staffManagement 가 함께 씻어내야 할 postingFilledCounts·workSchedule 을 빠뜨리는 회귀를 만든다. 즉 이건 죽은 코드일 뿐 아니라 **오용 유도 표면**이다.
비용: 삭제 11줄, tsc 가 전 참조 지목. 필요해지면 invalidationStrategy 에 이벤트를 추가하는 게 정본 경로다.

### 삭제 목록·순서
src/lib/queryClient.ts 에서, 위에서 아래로:
1) :726 applications
2) :728 schedules
3) :729 workLogs
4) :730 notifications
5) :731 confirmedStaff
6) :732 eventQR  ← 이걸 지워야 F3-a 의 eventQR 그룹 삭제가 가능해진다
7) :733 reports
8) :734 settlement
9) :754 tournaments (`/** 대회공고 승인 관련 모든 쿼리 무효화 */` 주석 포함) — **:756-760 tournamentApproval 은 유지**(3회 호출)
10) :765 reviews (`/** 리뷰/평가 관련 모든 쿼리 무효화 */` 주석 포함)
11) :771 `all: () => queryClient.invalidateQueries(),`
남길 것: jobPostings · user · staffManagement · tournamentApproval · announcements · boards · employerApplications 7종.

### 깨지는 것
- 테스트 — src/lib/__tests__/queryClient.test.ts:41 이 invalidateQueries.staffManagement('job-1') 를 단언한다(유지 대상). 삭제 대상 멤버를 단언하는지 파일 전문 확인 후 진행.
- 배럴 — src/lib/index.ts 가 invalidateQueries 를 re-export 한다. 객체 멤버만 줄이므로 배럴 무변경.
- 타입 — 객체 리터럴이라 존재하지 않는 멤버 접근은 tsc 가 즉시 잡는다.
- 순서 의존 — **F3-a 보다 먼저** 적용할 것(eventQR 참조 때문).
- e2e·DB·마이그 — 무관.

### 검증 명령
```
npx tsc --noEmit && npx jest src/lib/__tests__/queryClient.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — 완전 걷기로 `invalidateQueries.<member>` 전수 집계(정의 파일 제외): boards(14)·staffManagement(9+queryClient.test.ts 1=보고서의 10)·user(5)·announcements(5)·tournamentApproval(3)·jobPostings(3)·employerApplications(3) 7종만 실호출. 11종(applications·schedules·workLogs·notifications·confirmedStaff·eventQR·reports·settlement·tournaments·reviews·all) 호출 0 재확인. e2e·Edge Function·동적 문자열 접근 0건. src/lib/index.ts 배럴은 객체 재수출이라 무변경.

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. 특히 `all: () => queryClient.invalidateQueries()`(전체 무효화 함정)와 도메인 일괄 무효화가 staffManagement 의 7종 동시 세척 설계(postingFilledCounts·workSchedule 포함, :736-741 주석 실재 확인)와 경쟁하는 '오용 유도 표면'이라는 논거는 실코드로 뒷받침된다.

### 🛡️ 검증 — 삭제 안전성
안전. 보정 2건: ① [라인 드리프트] tournaments 실제 :755(보고서 :754), all 실제 :769(보고서 :771) — 멤버명 기준으로 삭제할 것(주석 :754 는 tournaments 와 함께, :764 는 reviews 와 함께 제거로 지시 자체는 유효). ② 삭제 후 잔존 참조 무결성 교차 확인 완료 — 지워지는 8개 원라이너가 참조하던 queryKeys.applications.all/schedules.all/workLogs.all/notifications.all/user.all/confirmedStaff.all/reports.all/settlement.all 은 전부 staffManagement 내부·invalidationStrategy·훅에서 계속 라이브라 고아화 없음, queryKeys.eventQR.all 만 F3-a 로 함께 소멸(순서 준수 시 무결). queryClient.test.ts 는 유지 대상만 단언함을 실측 확정.


## `F3-c` — 판정: **제거**

**대상 심볼**

src/shared/id/IdNormalizer.ts:96-114 normalizeUserId · :116-128 generateApplicationId · :130-151 parseApplicationId · :153-174 normalizeWorkLogs · :203-220 extractJobIds · :222-240 extractUserIds · :243-263 함수형 바운드 export 5종(normalizeJobId·normalizeUserId·extractUnifiedIds·generateApplicationId·parseApplicationId) · :28 UserIdDocument · :37 ParsedApplicationId · src/shared/id/index.ts:9-13,:16 배럴

### 원래 의도 (왜 만들었나)
근거 있음. 3a7ea546f(2026-01-20 refactor(mobile): Phase 2 - ID 정규화 모듈 구현). Firebase 시절의 ID 혼재(jobPostingId / eventId / postId 가 같은 것을 가리키던 문제)를 한 곳에서 흡수하려는 모듈이고, generateApplicationId/parseApplicationId 는 Firestore 문서 ID 를 `{jobPostingId}_{applicantId}` 합성 문자열로 만들던 시절의 헬퍼다. 설계 문서는 못 찾았다 — docs/superpowers/specs·docs/analysis 에 IdNormalizer 지목 서술 0건. 다만 메모리 기재 'JPC PostgREST relation 매핑'·'work_logs timestamptz 전환' 이력이 보여 주듯 이 레포는 Supabase UUID PK 로 이미 이주했다.

### 흐름이 끊긴 시점
애초에 안 이어진 것과 끊긴 것이 섞여 있다. 합성 ID 헬퍼(generateApplicationId·parseApplicationId)는 Firebase→Supabase 이주로 존재 이유가 사라졌고, 함수형 바운드 export 5종은 도입 당일부터 소비처가 0이다 — 모든 호출자가 `IdNormalizer.normalizeJobId(...)` 정적 메서드 형태로만 쓴다. `git log -S` 로 `normalizeJobId(` 단독 호출을 도입한 커밋을 찾을 수 없다.

### 지금 살아 있는 코드 흐름
살아 있는 건 정적 메서드 2개뿐:
SettlementRepository.ts:39 import { IdNormalizer } → :418 IdNormalizer.normalizeJobId(workLog) · :487 · :781.
scheduleService.ts:29 import → :242·:250·:670 IdNormalizer.normalizeJobId, :536·:732 IdNormalizer.extractUnifiedIds(workLogs, applications).
settlementCalculation.ts:18 import → :55 IdNormalizer.normalizeJobId(workLog).
전부 클래스 정적 접근이고, :243-263 의 바운드 상수는 이 경로에 끼어들지 않는다.

### 죽은 부분
`IdNormalizer\.[a-zA-Z]+` 전수 집계 후 정의 파일·테스트를 제외해 실측:
- 프로덕션 소비 있음: normalizeJobId(SettlementRepository·scheduleService·settlementCalculation) · extractUnifiedIds(scheduleService).
- 프로덕션 소비 0(테스트 전용): normalizeUserId · generateApplicationId · parseApplicationId · normalizeWorkLogs · extractJobIds · extractUserIds — 6개 정적 메서드. 소비처는 src/shared/__tests__/IdNormalizer.test.ts 뿐이다(:46-73, :80-115, :162-171, :189, :201).
- 함수형 바운드 export 5종(:243-263) — 정의 외 참조 0건. 배럴(src/shared/id/index.ts:9-13)이 re-export 하지만 배럴 경유 import 도 0건(라이브 소비자 3파일 전부 `import { IdNormalizer } from '@/shared/id'` 로 클래스만 가져간다).
- 타입 UserIdDocument(:28)·ParsedApplicationId(:37) — 위 죽은 메서드 시그니처 전용. index.ts:16 이 re-export 하지만 소비 0.

### 판정 근거
제품: 합성 ID(`{jobPostingId}_{applicantId}`)는 Firebase 문서키 시절의 산물이고, 지금 applications 는 Supabase UUID PK 다. 이 헬퍼를 살려 두면 다음 사람이 '어딘가 합성 ID 를 쓰는 경로가 있나' 를 조사하게 되고, 최악의 경우 새 코드에서 UUID 대신 합성키를 만들어 PostgREST 관계 매핑을 깨뜨린다(메모리 기재 'JPC PostgREST relation 매핑' 사고와 같은 계열). 타깃 사용자 관점에서 이 심볼들이 제공하는 가치는 0이다.
비용: 6개 메서드 + 5개 바운드 export + 2개 타입 + 배럴 7줄 + 테스트 블록 4개. 삭제 후 남는 IdNormalizer 는 정적 메서드 2개짜리 얇은 클래스가 되어 오히려 목적이 선명해진다.
주의 — 이건 knip 이 '미사용'으로 지목한 것 중 **실제로 맞은** 케이스다. knip 은 같은 리포트에서 배럴 파일의 정상 re-export 수백 개도 미사용으로 찍었으므로(src/repositories/index.ts 19+52개 등) knip 단독으로는 판정하지 않았고, 정적 메서드 호출 형태를 별도 집계해 교차검증했다.

### 삭제 목록·순서
삭제 순서:
1) src/shared/__tests__/IdNormalizer.test.ts — describe('normalizeUserId')(:46-76) · describe('generateApplicationId / parseApplicationId')(:80-115) · normalizeWorkLogs 케이스(:162-171) · extractJobIds 케이스(:189 포함 블록) · extractUserIds 케이스(:201 포함 블록) 제거. 테스트를 먼저 지워야 다음 단계에서 tsc/jest 가 진짜 소비처만 남긴다.
2) src/shared/id/index.ts:9-13 — normalizeJobId·normalizeUserId·extractUnifiedIds·generateApplicationId·parseApplicationId 5줄 제거(`IdNormalizer` 만 남김)
3) 같은 파일 :16 — `export type { JobIdDocument, UserIdDocument, ParsedApplicationId }` 에서 UserIdDocument·ParsedApplicationId 제거(JobIdDocument 는 normalizeJobId 시그니처에 남으므로 유지)
4) src/shared/id/IdNormalizer.ts:241-263 — 'Helper Functions (편의 함수)' 섹션 전체 제거(주석 헤더 포함)
5) 같은 파일 :222-240 extractUserIds · :203-220 extractJobIds · :153-174 normalizeWorkLogs · :130-151 parseApplicationId · :116-128 generateApplicationId · :96-114 normalizeUserId 메서드 제거
6) 같은 파일 :37 ParsedApplicationId · :28 UserIdDocument 인터페이스 제거
남길 것: :21 JobIdDocument · :60 class IdNormalizer · :74-94 normalizeJobId · :176-201 extractUnifiedIds

### 깨지는 것
- 테스트 모킹 — scheduleService.test.ts:138-140, scheduleService.integration.test.ts:118-120, settlementService.test.ts:245-246 이 `jest.mock('@/shared/id', () => ({ IdNormalizer: { normalizeJobId, extractUnifiedIds } }))` 형태로 **이미 2개 메서드만** 모킹한다. 삭제 대상과 정확히 일치 → 모크 갱신 불필요.
- 배럴 — src/shared/id/index.ts 2곳(:9-13 값, :16 타입). src/shared/index.ts 가 id 를 re-export 하는지 추가 확인 권장.
- 타입 — 인터페이스 제거는 tsc 가 잡는다. JobIdDocument 를 실수로 지우면 normalizeJobId 시그니처가 깨져 즉시 red.
- e2e/·DB·마이그 — 무관.
- ⚠️ 단계 5 에서 extractUnifiedIds(:176-201)를 실수로 함께 지우지 말 것 — scheduleService 2곳이 라이브다.

### 검증 명령
```
npx tsc --noEmit && npx jest src/shared/__tests__/IdNormalizer.test.ts src/services/work/__tests__/scheduleService.test.ts src/services/work/__tests__/settlementService.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (확인)
없음 — `IdNormalizer.<method>` 전수 집계(완전 걷기): 프로덕션 소비는 normalizeJobId(SettlementRepository 3·scheduleService 3·settlementCalculation 1)+extractUnifiedIds(scheduleService 2)뿐, 삭제 대상 6개 메서드는 IdNormalizer.test.ts 전용 재확인. 바운드 export 5종 정의 외 참조 0, 배럴 소비자 3파일 전부 `import { IdNormalizer }` 만. [핵심 추가 검증] 정의 파일 내 normalizeUserId 4회 자기참조가 살아남는 메서드의 내부 호출인지 파일 정독으로 판별 — JSDoc 3회 + extractUserIds(:226, 함께 삭제) 1회이고, **extractUnifiedIds(:176-195)는 삭제 대상을 하나도 내부 호출하지 않는다**(필드 직접 접근). normalizeWorkLogs/extractJobIds 의 this.normalizeJobId 호출은 호출자·피호출자 모두 유지/삭제 짝이 맞아 무결. src/shared/index.ts 부재 실측(상위 배럴 체인 없음 — 보고서의 '추가 확인 권장'을 확인으로 격상).

### ⚖️ 검증 — 판정 심사 (동의)
제거 동의. 합성 ID(`{jobPostingId}_{applicantId}`)가 Supabase UUID PK 체제에서 22P02 계열 사고 유발원이라는 논거는 프로젝트 규칙(.claude/rules/supabase-patterns.md §2 composite string ID 금지)과도 일치한다. knip 교차검증 접근(정적 메서드 호출 별도 집계)도 타당.

### 🛡️ 검증 — 삭제 안전성
안전. 보정 2건: ① [라인 드리프트] 보고서 범위가 실파일과 어긋난다(normalizeUserId 본문 실제 :96-98, generateApplicationId :116-118 등 — 보고서 범위는 JSDoc 포함 추정치) — 심볼 기준 삭제 필수. ② [누락] 클래스 JSDoc(:53-58)의 @example 이 normalizeUserId·generateApplicationId·parseApplicationId 를 예시로 들고 있다 — 함께 정리하지 않으면 다음 사람이 존재하지 않는 API 를 읽는다. 모킹 3파일(settlementService.test:244-248·scheduleService.test:137·scheduleService.integration.test:117)이 정확히 normalizeJobId+extractUnifiedIds 만 목킹함을 실측 — '모크 갱신 불필요' 주장 확정. JobIdDocument 유지(normalizeJobId·normalizeWorkLogs 시그니처)·index.ts:16 타입 축소 지시 정확.


## `F3-d` — 판정: **제거**

**대상 심볼**

src/utils/job-posting/dateUtils.ts:15-30 하위호환 재수출 블록 11종(groupConsecutiveDates·generateId·isDuplicateDate·validateDateCount·isWithinUrgentDateLimit·parseDate·getDateAfterDays·isValidTimeFormat·isValidDateFormat·generateDateRange·sortDates) + :8 generateIdBase import

### 원래 의도 (왜 만들었나)
근거 있음, 파일 자신이 밝힌다. dateUtils.ts:3-5 헤더 `@version 3.0.0 - 중복 함수 제거, date/ 폴더에서 import`, :14 `// Re-export from date/ for backward compatibility`. 즉 날짜 유틸을 utils/date/ 로 이관하면서 기존 import 경로를 깨지 않으려고 만든 **임시 호환 심(shim)** 이다. docs/planning/2026-07-05-unused-exports-triage-handoff-prompt.md:65 가 이미 이 파일을 지목했다 — 'OTHER 버킷(69) — 단순 죽음 아니라 중복/잉여 재수출 disambiguation. utils/job-posting/dateUtils.ts↔utils/date/* ... 이중파일 분석 필요·위험 높음 → 전용 세션 권장'.

### 흐름이 끊긴 시점
이관이 끝나면서 자연 소멸했다. 소비자들이 전부 새 경로로 이주했다 — OrderSheetScreen.tsx:48 `import { groupConsecutiveDates, hasGroupableDates } from '@/utils/date'`, jobPosting.schema.ts:17 `import { isWithinUrgentDateLimit } from '@/utils/date'`. 특정 커밋 하나가 아니라 이주 완료 시점에 심의 존재 이유가 사라졌고, 심을 걷어내는 후속만 안 왔다.

### 지금 살아 있는 코드 흐름
이 파일에서 실제로 소비되는 건 자체 정의 함수 하나뿐이다:
app/(app)/jobs/[id]/apply.tsx:22 `import { getClosingStatus } from '@/utils/job-posting/dateUtils'` → dateUtils.ts:208 getClosingStatus.
src/domains/application/ApplicationValidator.ts:5 → 같은 getClosingStatus.
재수출된 11종의 실제 흐름은 심을 우회한다: OrderSheetScreen.tsx:508 groupConsecutiveDates(sorted) → utils/date 배럴 → utils/date/grouping. jobPosting.schema.ts:340 isWithinUrgentDateLimit → utils/date 배럴 → utils/date/validation.

### 죽은 부분
`from '@/utils/job-posting/dateUtils'` 전수 grep 결과 import 하는 파일은 5개뿐이고, 가져가는 심볼은 **getClosingStatus 하나뿐**이다:
- src/domains/application/ApplicationValidator.ts:5 (getClosingStatus)
- src/domains/application/__tests__/ApplicationValidator.test.ts:16,:25 (getClosingStatus + jest.mock)
- app/(app)/jobs/[id]/apply.tsx:22 (getClosingStatus)
- app/(app)/jobs/[id]/__tests__/ApplyScreen.submitSuccess.test.tsx:115 (jest.mock)
- src/utils/job-posting/__tests__/dateUtils.test.ts (자기 테스트)
**src/utils/job-posting/index.ts 배럴은 존재하지 않는다**(확인함) — 배럴 경유 우회 소비 가능성 없음. `from '@/utils/job-posting'` import 도 0건.
따라서 :15-30 재수출 11종 전부 소비 0. 곁들여 :8 의 `generateId as generateIdBase` import 는 :16 재수출 전용이라 함께 죽는다(파일 내 다른 사용 0 — grep 확인).
⚠️ 살아 있는 것: :10 groupConsecutiveDatesBase 는 :89 에서 formatDateGroup 이 쓴다. :8 toISODateString 은 :38, :9 formatDateWithDay 는 :57~:97 다수. 이 셋은 남긴다.

### 판정 근거
제품: 사용자에게 보이는 것이 없다. 판단 근거는 순전히 '같은 함수로 가는 문이 두 개'라는 사실이다. 실제 피해도 실측됐다 — 이 레포에는 `groupConsecutiveDates` 를 부르는 경로가 utils/date 와 utils/job-posting/dateUtils 두 갈래로 보이고, 그래서 knip 이 9개를 미사용으로 찍었고 triage 문서가 '전용 세션 권장·위험 높음'으로 미뤄 왔다. 즉 이 11줄이 정리 작업 자체를 6개월 넘게 막고 있었다.
비용: 심을 걷어내면 dateUtils.ts 는 '공고 도메인 전용 날짜 표시/집계 함수' 파일로 목적이 하나가 된다(getTodayDateString·formatDateGroup·formatDateRangeDisplay·isDuplicateRole·clampHeadcount·calculateTotalFromDateReqs·calculateFilledFromDateReqs·isFullyClosed·getClosingStatus). 삭제 비용은 낮다 — 소비 경로가 5파일·1심볼로 좁혀져 있고 tsc 가 나머지를 지목한다. triage 문서가 '위험 높음'이라 한 이유는 당시 소비처를 좁히지 않았기 때문이고, 이번에 좁혀 보니 위험이 없다.
반대 논거: 'backward compatibility 니까 남긴다' — 기각. 호환 대상(구 import 경로 사용자)이 레포에 0명이다. 외부 패키지가 아니므로 하위호환 의무가 없다.

### 삭제 목록·순서
1) src/utils/job-posting/dateUtils.ts:14-30 — 주석 3줄(`// Re-export from date/ for backward compatibility`, `// Re-export validation functions`, `// Re-export range functions`)과 export 문 4개(:15, :16, :19-27, :30) 전부 제거
2) 같은 파일 :8 — `import { toISODateString, generateId as generateIdBase } from '../date/core';` → `import { toISODateString } from '../date/core';` 로 축소
3) 같은 파일 :3-5 헤더 주석의 `@version 3.0.0 - 중복 함수 제거, date/ 폴더에서 import` 를 실상에 맞게 갱신(재수출이 사라졌으므로)
4) src/utils/job-posting/__tests__/dateUtils.test.ts:60-97 — 삭제된 재수출 심볼을 흉내내는 jest.mock 팩토리 항목(groupConsecutiveDates:60, isDuplicateDate:89, validateDateCount:90, isWithinUrgentDateLimit:91, getDateAfterDays:93, generateDateRange:97 등) 정리. 여분 목 키는 런타임 에러를 안 내지만 남겨 두면 다음 사람이 '이 파일이 그 함수들을 export 한다'고 오독한다.
남길 것: :9 formatDateWithDay import · :10 groupConsecutiveDatesBase import · :36 이후 자체 정의 함수 9종 전부

### 깨지는 것
- 소비처 — 5파일 모두 getClosingStatus 만 가져가므로 **아무도 안 깨진다**(실측).
- 배럴 — src/utils/job-posting/index.ts 부재 확인. `from '@/utils/job-posting'` 0건.
- 테스트 — dateUtils.test.ts 의 jest.mock 팩토리가 삭제 심볼을 언급하지만 팩토리에 여분 키가 있어도 통과한다. ApplyScreen.submitSuccess.test.tsx:115 와 ApplicationValidator.test.ts:25 의 mock 은 getClosingStatus 대상이라 무영향.
- eslint — 미사용 import(generateIdBase)는 no-unused-vars 가 잡는다. 2단계를 빼먹으면 lint red.
- e2e/ — 날짜 유틸 직접 참조 없음. 단, 메모리 기재 함정대로 상수·문구 변경이 아니므로 e2e 별도 grep 대상은 아니다(함수 재수출 정리일 뿐).
- DB·마이그·알림 — 무관.

### 검증 명령
```
npx tsc --noEmit && npx eslint src/utils/job-posting/dateUtils.ts && npx jest src/utils/job-posting/__tests__/dateUtils.test.ts src/domains/application/__tests__/ApplicationValidator.test.ts
```

### 🔍 검증 — 놓친 소비처 재수색 (일부생존)
1건 발견 — 보고서의 '5파일 모두 getClosingStatus 만 가져간다 → 아무도 안 깨진다' 주장이 자기 테스트에 대해 틀렸다. src/utils/job-posting/__tests__/dateUtils.test.ts:22-34 가 `'../dateUtils'`(심 경유)에서 자체 정의 9종에 더해 **isValidTimeFormat·isValidDateFormat 재수출 2종을 import** 하고 describe(:248·:271)로 실제 실행한다. 재수출 블록(:18-27)을 통째로 지우면 이 import 가 깨져 tsc·jest red. 나머지 9종 재수출(groupConsecutiveDates·generateId·isDuplicateDate·validateDateCount·isWithinUrgentDateLimit·parseDate·getDateAfterDays·generateDateRange·sortDates)은 완전 걷기로 소비 0 확인. utils/job-posting 배럴 부재 ls 실측, `from '@/utils/job-posting'` 0건, e2e 0건, generateIdBase :8/:16 전용·groupConsecutiveDatesBase :89 라이브 전부 보고서와 일치.

### ⚖️ 검증 — 판정 심사 (조건부)
제거 자체는 지지 — 조건: 삭제목록에 dateUtils.test.ts 의 import 수정을 추가할 것. 구체적으로 :22-34 import 에서 isValidTimeFormat·isValidDateFormat 2종을 `'@/utils/date/validation'` 직접 import 로 바꾸거나(원본 validation.ts:13·:20 실재 확인), 두 describe 블록(:248-289)을 utils/date 쪽 테스트로 이관. 기존 :87-94 jest.mock 이 requireActual 스프레드로 두 함수의 실구현을 흘리므로 import 경로만 바꿔도 테스트 의미는 보존된다. 이 수정 없이 4단계(목 팩토리 정리)만 하면 quality 게이트에서 red.

### 🛡️ 검증 — 삭제 안전성
위 조건 반영 시 안전. 나머지 확인: ① 2단계(generateIdBase import 축소) 누락 시 eslint red 라는 지적 정확 — 파일 내 사용 :8/:16 뿐임을 실측. ② ApplyScreen.submitSuccess.test.tsx:115·ApplicationValidator.test.ts:25 목은 getClosingStatus 대상이라 무영향 확인. ③ 4단계의 jest.mock 팩토리 여분 키 정리는 통과에 무영향(목은 모듈 대체라 원본과 무관)임을 구조로 확인 — '오독 방지' 목적 서술이 정확. ④ 헤더 @version 주석 갱신(3단계) 타당. ⑤ 상수·문구 변경이 아니므로 e2e 별도 grep 규칙 비대상이라는 판단도 e2e 실측(0건)으로 뒷받침.
