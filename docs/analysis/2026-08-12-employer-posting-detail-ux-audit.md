# 구인자 공고상세 UX·기능 전면 분석 (2026-08-12)

> 대상: `app/(employer)/my-postings/[id]/` 트리 (상세 허브 + 하위 6화면) · 진입 목록 `app/(app)/(tabs)/employer.tsx`
> 방법: 6축 병렬 실측(정보구조·유저플로우·기능갭·UI폴리시·벤치마크·상태처리) → 축별 반증 검증 → 종합
> 규모: 13 에이전트 · 621 도구호출 · 원본 76건 → 검증 생존 76건(CONFIRMED 66 / PARTIAL 10, 분석가 CRITICAL 5건은 검증 단계에서 HIGH~MEDIUM 하향)
> 심각도: HIGH 16 · MEDIUM 47 · LOW 13

## 0. 메인 세션 독립 검증 (에이전트 보고와 별개로 직접 실측)

전역 verification 규칙에 따라, 파급력이 큰 5건을 메인 세션에서 코드로 직접 재확인했다.

| 주장 | 판정 | 직접 확인한 근거 |
|---|---|---|
| 마감/재오픈이 공고상세에 없다 | ✅ 확인 | 버튼=`JobPostingCard.tsx:181-209`(목록 카드 푸터), 모달=`employer.tsx:524-545`. `my-postings/[id]/index.tsx` 739줄 전체에 해당 액션 없음 |
| 공고 조회수 배선이 끊겨 있다 | ✅ 확인 | RPC `increment_view_count`(baseline:3406) · `JobPostingRepository.ts:663-675` · `jobService.ts:149-151` · 배럴 `services/jobs/index.ts:13` 까지 전부 존재하는데, `incrementViewCount(` **호출부 0건**(테스트 제외 전수 Grep). 비교군: 공지=`useAnnouncement.ts:82`, 게시판=`boardPostService.ts:292-296` 은 호출한다. → `JobDetail.tsx:311` 의 "조회 N" 은 영구 0 |
| realtime 구독이 2중이다 | ✅ 확인 | `_layout.tsx:135` 와 `index.tsx:129-136` 이 같은 id 로 `useJobDetail(realtime:true)`. `useJobDetail.ts:85-115` 의 useEffect 가 인스턴스마다 `subscribeToJobPosting` 을 호출(디듀프 없음) |
| 로딩 언어가 화면마다 다르다 | ✅ 확인 | 상세=`PostingSurfaceState.tsx:21-44` **스켈레톤**, 지원자관리=`applicants.tsx:198` `<Loading/>` **스피너**, 수정=`edit.tsx:142` **스피너**. 추가로 상세 스켈레톤 형상은 구직자용(히어로+급여+4섹션)이라 실제 화면(통계+액션카드 6장)과 불일치 |
| TodayOpsStrip 재사용 가능 | ✅ 확인 | `src/features/employer/settlements/TodayOpsStrip.tsx` 실재, 소비처는 `settlements.tsx:191` 한 곳뿐 |

**미검증으로 남긴 것**: 실기기 관찰이 필요한 항목(§8 PARTIAL 표)은 코드만으로 판정할 수 없어 그대로 PARTIAL 로 둔다. 이 문서의 어떤 항목도 실기기에서 재현 관찰하지 않았다.

---
# 구인자 공고상세 개선 리포트 (76건 종합 · 검증 완료분)

## 1. 한 줄 결론

**공고상세는 사장이 하루에 가장 자주 여는 "운영의 첫 화면"인데, 지금은 결정에 쓸 정보가 대기 인원 하나뿐인 라우팅 통행료다** — 판단할 재료(오늘 상황·정산 잔여·조회수)는 두 단계 안쪽에 숨어 있고, 판단 직후의 실행(마감·재게시·취소승인)은 전부 다른 화면에 있다.

## 2. 현재 화면 진단 요약

- **잘 돼 있는 것**: 좋은 선례가 이미 레포 안에 있다 — `useSubmitGate`의 "성공에서만 닫기"(applicants.tsx:149-169), `error && !data` 가드(qr.tsx:70, collaborators.tsx:56), 허브 스켈레톤(index.tsx:256-263), PTR 공용 상수, ConfirmModal 햅틱. 문제는 이 선례들이 **화면마다 제각각 적용**돼 있다는 것.
- **무너지는 것 ①**: 첫 카드가 상태뱃지+통계 3숫자뿐이고 그 아래는 동급 카드 6장 나열(index.tsx:332-616) — 우선순위·오늘 신호·빈 상태 제안이 0.
- **무너지는 것 ②**: 같은 숫자가 4개 소스(applications 실시간/stats jsonb/filled_positions/배치 RPC)에서 오고 "확정"이라는 한 단어가 두 값을 가리킨다.
- **무너지는 것 ③**: 상태 전이(마감/재오픈)·재게시·취소승인이 상세 밖에 있어, 확정 직후의 자연스러운 다음 행동이 매번 화면 밖 왕복이다.
- **무너지는 것 ④**: 네트워크가 한 번 튀면 멀쩡히 떠 있던 화면이 통째로 에러로 교체되고(index.tsx:265), 오프라인은 "공고 없음"으로 오안내된다.

## 3. 핵심 문제 5선

### 문제 1 — 첫 화면이 "지금 뭘 해야 하는가"를 말하지 않는다
*(병합: ia-01 + toss-01 + ia-05 + baemin-02 + flow-07 + ia-11)*

- **근거**: 첫 카드는 제목·상태뱃지·통계 3숫자·배정 N/M뿐(index.tsx:332-509), 그 아래는 픽셀 단위로 동일한 ActionCard 6장(index.tsx:98-118 단일 컴포넌트, :518-614). 오늘 출근/노쇼(TodayOpsStrip)는 settlements.tsx:191에만, 정산 잔여(settlements.tsx:182-184)는 허브 신호 0(index.tsx는 useSettlement 미사용). 통계 숫자는 탭 불가 View(index.tsx:463-508)이고, 화면 최대 글자가 행동 불가능한 통계 숫자 text-xl(:466/:475/:484)이다. 배지 슬롯은 할 일 개수(:524)·현황 수치(:553)·제약 문장(:568) 세 의미를 돌려쓴다.
- **사용자 시나리오**: 새 지원자 승인까지 5탭(목록→상세→지원자관리→필터 재선택→확정→모달). 상세는 정보를 0 주고 탭 1회를 먹는다. 오늘 누가 출근했는지 보려면 무조건 2탭 들어갔다 나와야 하고, 정산이 남았는지는 초록 "3명" 배지(좌석 수) 때문에 "다 됐나 보다"로 오독된다.
- **개선안**: ① TodayOpsStrip을 상세 헤더 카드 아래로 승격(컴포넌트 재사용, S — baemin-02 검증 완료). ② 순수 함수 `selectPrimaryAction`(취소요청 > 오늘 미출근 > 대기 지원자 > 정산 대기 > 라이브 운영)으로 "지금 할 일" 카드 1장만 크게, 골드는 그 버튼에만. ③ 나머지 카드는 리스트 행으로 강등, 배지는 "처리해야 할 건수"에만 허용(정산 배지를 filledPositions→pendingSettlementCount로 교체). ④ 통계 숫자를 Pressable로 감싸 `applicants?filter=` 파라미터로 직행. 단, 허브 전면 개편은 W2-6으로 원장에 XL 등재된 항목 — 이 리포트의 ①~④는 그 부분 착수이며 한 PR로 묶지 말 것.

### 문제 2 — 판단은 상세에서, 실행은 딴 데서 (상태 전이·재게시의 부재)
*(병합: carrot-01 + ia-02 + flow-01 + gap-06 + carrot-03 + gap-07 + baemin-03)*

- **근거**: `useCloseJobPosting`/`useReopenJobPosting`의 화면 소비처는 employer.tsx:210-211 단 한 곳, 버튼은 목록 카드 푸터(JobPostingCard.tsx:181-210)뿐. 상세의 PostingStatusBadge(index.tsx:358)는 표시 전용. 그런데 [공고 수정] 카드는 "공고 내용과 **상태**를 수정합니다"(:565, :623)라고 거짓 약속하고, 주문서 스키마·매퍼에 status 필드는 없다. 재게시도 0 — 관리 카드 6장(:518-614) 어디에도 없고 프리셋은 createdAt 최신 1건 고정(create.tsx:89-97). 취소요청은 배지만 주고(:531-544) 처리는 전용 화면+수제 모달 강제(cancellation-requests.tsx:243-281).
- **사용자 시나리오**: 마지막 1명을 확정해 정원을 채운 그 순간, 같은 화면에서 마감할 수 없다 — 뒤로가기→목록 필터→카드 재탐색→마감 4탭. "상태를 수정합니다"를 믿고 수정 화면에 들어간 사장은 끝까지 스크롤해도 마감 스위치를 못 찾는다. 매주 금요일 같은 공고를 내는 사장의 재활용 경로는 만료 공고에서 완전히 끊긴다(기존 감사 M3 잔여).
- **개선안**: ① 상태뱃지를 Pressable로 승격 → 기존 ActionSheet로 "모집 마감하기/모집 다시 열기"(확인 문구는 employer.tsx:524-545의 것을 상수로 승격해 단일 소스). 마감은 가역이므로 ConfirmModal 대신 Undo 토스트(toastStore action 필드 실재, useCloseJobPosting에 낙관 업데이트 이미 있음 — undo-01). ② :565/:623 문구를 "공고 내용을 수정합니다"로 정정. ③ expired/closed면 상세 최상단 배너 "이 공고는 끝났어요 + [같은 조건으로 다시 올리기]" → `create?fromPostingId=` 분기(dates 비움+grouped:false 계약은 create.tsx:113-123 그대로 재사용). ④ pending 취소요청 1건이면 상세 최상단 인라인 [거절][승인] 카드, 2건 이상이면 접기 — 기존 화면은 이력으로 격하.

### 문제 3 — 숫자를 믿을 수 없다: 4개 소스, "확정"이라는 이름 충돌, 게이트 불일치
*(병합: ia-04 + flow-06 + stat-01 + gap-05 + ia-08③ + format-01①)*

- **근거**: 한 카드 안에 ①applications 실시간 stats(index.tsx:143-149, :282-288) ②stats jsonb 폴백(projections.ts:99-107) ③filled_positions 컬럼(facts.ts:87) ④배치 RPC(usePostingFilledCounts.ts:9-18)가 섞인다. 정의도 어긋난다: 클라 stats.total은 rejected 포함 무조건 증가(ApplicationRepositoryHelpers.ts:245), 서버 jsonb는 applied/confirmed/cancellation_pending만 카운트(마이그 20260718000000:123-155) — 진입 직후 숫자가 소리 없이 점프한다. 허브는 :475에서 stats.confirmed를 "확정", :493-496에서 filled_positions를 "배정 현황"이라 부르는데 지원자 화면(applicants.tsx:240-248)은 **같은 filled_positions를 "확정"**이라 부른다. 게이트도 분열: 삭제 가드는 applications 축(index.tsx:285), 수정 배너는 work_logs 축을 "확정된 N명"으로 오표기(edit.tsx:58, :190). 수정 카드의 "일정·역할 수정 제한" 배지(:566-569)는 실제 서버 계약(역할 소멸 한 축만 차단, JobPostingRepository.ts:87-121)보다 넓게 말한다. 근무 종료 시 서버가 application을 completed로 전이시키므로(baseline:2658-2667) 끝난 공고는 confirmed 0 → 삭제 가드가 뚫린다(ia-08③).
- **사용자 시나리오**: 한 사람이 3일치를 확정하면 "확정 1 / 배정 3"이 같은 카드에 나란히 뜬다. 상세에서 "확정 2"를 보고 지원자 화면으로 넘어가면 같은 자리에 "확정 3"이 뜬다 — 같은 단어, 다른 숫자. 숫자를 못 믿는 순간 이 카드는 장식이 된다.
- **개선안**: ① 소스를 둘로 줄인다 — applications 축은 "검토 대기 N · 확정 N"만, work_logs 축은 "자리 N/M 채움"으로 통일(공용 컴포넌트 1개, 목록 카드 문구와 동일). "확정"은 applications에만 사용. ② 삭제 게이트를 "work_logs 존재 여부"로 교체(selectors.ts:41-43 주석이 지목한 진짜 위험), edit.tsx:58 표기를 사람 수가 아닌 자리 수로 정정. ③ completed 포함 여부를 도메인 selector 함수 하나로 고정하고 계약 테스트. ④ 잠금 배지는 "확정 배정 역할 잠김"으로, 편집 화면 역할 칩에 자물쇠+사전 안내(저장 실패까지 기다리지 않기).

### 문제 4 — 일시 장애·내비게이션에서 화면이 거짓말을 한다
*(병합: err-01 + err-02 + rt-01(=flow-11) + del-01 + del-02(=flow-05) + flow-02)*

- **근거**: index.tsx:265가 `if (error || !posting || ...)` — posting이 손에 있어도 error만 서면 전체 화면 교체. 형제 화면(qr.tsx:70, collaborators.tsx:56)은 이미 올바른 가드를 쓰는데 index·applicants(:208)·settlements(:171)만 미적용. :273은 원시 `error?.message`를 그대로 노출해 ErrorState의 sanitize를 우회(ErrorState.tsx:47), 오프라인이면 "공고 정보를 찾을 수 없습니다"(=삭제됐다는 말)가 뜨고 "다시 시도"는 무반응. 원인 축은 이중 구독 — _layout.tsx:135와 index.tsx:129-136이 같은 id로 `useJobDetail(realtime:true)`을 각각 불러 진입 1회에 HTTP 3회+이벤트당 setQueryData 2회, 에러 state도 각자라 :314-317의 fail-closed OR 주석이 그 증상을 자인한다. 삭제 확인 버튼은 이중 탭 방지 0(Modal.tsx:694-711, 웹 페이드아웃 중 2번째 클릭 유입), 삭제 후 `router.back()`은 무조건 호출(index.tsx:224). 푸시 알림 5종은 상세를 건너뛰고 자식 화면으로 직행해 뒤로가기가 구직자 홈으로 튄다(NotificationRouteMap.ts:8-48, HeaderBackButton.tsx:29-32가 fallbackHref 무시).
- **사용자 시나리오**: 지하 홀덤펍에서 상세를 열어둔 채 신호가 튀면 멀쩡한 화면이 "공고를 불러올 수 없습니다"로 바뀐다 → 사장은 공고가 사라진 줄 알고 같은 공고를 하나 더 만든다 → 지원자가 쪼개진다. 새벽 푸시로 확정 처리한 뒤 뒤로가기를 누르면 구직자용 공고 목록에 떨어진다.
- **개선안**: ① 가드를 `(error && !posting)`으로 좁히고, posting 있는 error는 얇은 배너("정보가 최신이 아닐 수 있어요")로. ② 오프라인 전용 분기 + 재시도 버튼 숨김, message prop 대신 error만 전달(edit.tsx:163 동일). ③ index.tsx의 자체 useJobDetail을 제거하고 `useJobDetailContext()` 소비로 수렴 — 중복 fetch·에러 분열·OR 게이트가 한 번에 소멸. ④ ConfirmModal에 `isLoading` prop + `if (isDeleting) return` 가드, 삭제 성공 시 `canGoBack() ? back() : replace('/(app)/(tabs)/employer')`. ⑤ 딥링크 실행부에서 상세를 먼저 깔고 자식을 push하는 2단 push.

### 문제 5 — 런칭기 핵심 루프(유입→확정→운영)에 신호와 도구가 비어 있다
*(병합: gap-01(=carrot-02) + empty-01(=flow-13)+carrot-04 + gap-04 + gap-03 + flow-08 + gap-02 + gap-10)*

- **근거**: `increment_view_count` RPC(baseline:3406, 셀프인플레 가드 포함)·Repository(:663-684)·서비스(jobService.ts:149)가 전부 있는데 **호출부 0건** — view_count는 영구 0이고 구직자 화면은 "조회 0"을 렌더한다(JobDetail.tsx:305-313). 지원 0명이어도 카드 설명은 "0명의 지원자가 대기중입니다"(index.tsx:521), 유일한 해법인 공유는 헤더 22px 아이콘(:304-313)뿐 — 직전 화면(create-success.tsx:131-139)에선 골드 CTA였다. D-1 정원 미달 알림 크론은 0(공고군 알림은 전부 사후 통보, notification.ts:91-110). 확정 스태프에게 공지 보낼 방법 0, 사장→스태프 연락은 번호 텍스트뿐(ContactInfo.tsx:50-56 — 반대 방향엔 ContactActions tel:/sms:가 이미 있다). 근무표 경유 생성은 완료 화면을 우회해 공유 CTA·프리셋 제안을 통째로 못 본다(create.tsx:171-181).
- **사용자 시나리오**: 공고 3일째 지원 0. "아무도 못 본 것"(공유 필요)인지 "봤는데 조건이 별로"(수정 필요)인지 구분할 수단이 없어 아무것도 안 하고 D-day에 인력 펑크. 대회 아침 집합 시간이 바뀌면 확정 8명의 번호를 눈으로 옮겨 적어 단톡방을 판다 — 그 순간부터 운영은 카톡으로 이탈한다.
- **개선안**: ① 구직자 상세 진입에 incrementViewCount 배선(서버 작업 불필요) + 통계 스트립 4칸(조회는 회색 강등) + "조회 있는데 지원 0" 인라인 힌트. ② `totalApplicants === 0` 분기: "아직 지원자가 없어요 + [공고 공유하기] 골드 CTA"(handleShare 재사용). ③ 지원자 카드 번호 Text를 기존 ContactActions로 교체(반나절). ④ 크론 1잡 `notify-posting-shortfall`(D-2/D-1, 멱등키 posting_id+d_offset) + 배정 현황 줄에 D-day·부족 경고. ⑤ 확정 스태프 일괄 공지(신규 타입 employer_notice, 200자 시트). ⑥ 헤더에 구직자 미리보기 EyeIcon(도착지 라우트는 이미 소유자 허용 — jobs/[id]/index.tsx:143-144).

## 4. 개선 로드맵 3단계

### 1단계 — 즉시 (S, 반나절~2일씩, 코드 몇 줄로 체감 변화)

| # | 항목 | 규모 | 근거 파일 | 해소 지적 |
|---|---|---|---|---|
| 1 | 에러 가드 좁히기 `(error && !posting)` + partial 배너, applicants/settlements 동일 | S | index.tsx:265, applicants.tsx:208, settlements.tsx:171 | err-01 |
| 2 | 오프라인 분기 + message prop 제거(sanitize 경유) | S | index.tsx:273, edit.tsx:163 | err-02 |
| 3 | ConfirmModal `isLoading` + isDeleting 가드 + 삭제 후 canGoBack 폴백 | S~M | Modal.tsx:694-711, index.tsx:216-227 | del-01, del-02/flow-05 |
| 4 | TodayOpsStrip 상세 승격(재사용 렌더) | S | settlements.tsx:191, index.tsx 첫 카드 아래 | baemin-02 |
| 5 | 지원 0 빈 상태 + 공유 골드 CTA + "0명의 지원자" 문구 분기 | S | index.tsx:463-508, :521 | empty-01, carrot-04, flow-13 |
| 6 | 근무 정보 기본 펼침(또는 요약 1줄 상시 노출) | S | index.tsx:153, :349-375 | toss-04, ia-03 |
| 7 | 조회수 배선(incrementViewCount) + 스트립 4칸 | S~M | app/(app)/jobs/[id], index.tsx:463-491 | gap-01, carrot-02 |
| 8 | 문구·라벨 일괄: "상태를 수정합니다" 정정, 삭제/취소→"공고 삭제"/"돌아가기", 취소요청 모달 "취소"→"닫기", 정산 배지 "명"→"자리", 삭제 캡션 조건부+대비 토큰 | S | index.tsx:565·623·733-734, cancellation-requests.tsx:267-277, index.tsx:551-553·719-721 | ia-02②, label-01, flow-06③, ia-08①, contrast-02 |
| 9 | 색·대비: 보라 #8B5CF6→토큰, #3B82F6→STATUS_COLORS.info, 다크 구분선 `dark:bg-surface`→`bg-divider`, 삭제 pressed 토큰, NumericText | S | index.tsx:582·609·473·482·700 | color-01, ia-14, contrast-01, ia-09(부분), state-01 |
| 10 | a11y 묶음: ActionCard 배지 라벨 합성, 통계 그룹 라벨, 토글 expanded+44px, 삭제 사유 라벨 | S | index.tsx:96·107-111·359-373·463-508·703-705 | a11y-01~04, ia-13, touch-01 |
| 11 | 사장→지원자 전화/문자: 번호 Text→ContactActions 교체 | S | ContactInfo.tsx:50-56, ProfileInfoSections.tsx:168-173 | gap-03① |
| 12 | 고정 공고 설명 카드 1장(문구 상수 승격, 3곳 통일) + 수정 카드 원위치 | S | index.tsx:531-628, settlements.tsx:151, qr.tsx:88 | ia-06, flow-09 |
| 13 | 구직자 미리보기 EyeIcon(승인 대기는 캡션 대체) | S | index.tsx:302-319, jobs/[id]:143-148 | gap-02 |
| 14 | 잡동사니: PTR props 통일, 죽은 message prop 제거, 일정 1개 자동선택+"날짜 선택 필요" 라벨 | S | index.tsx:324-330·260, useAssignmentSelection.ts:101 | ptr-01, load-01(부분), flow-03 |

주의: 문구를 상수로 바꿀 때 `e2e/`는 quality가 못 잡는다 — 별도 Grep 필수(PR#353 선례).

### 2단계 — 구조 (M~L, 화면 재구성)

| # | 항목 | 규모 | 근거 파일 | 해소 지적 |
|---|---|---|---|---|
| 1 | 상태 전이 상세 배선: 상태뱃지→ActionSheet(마감/재오픈), Undo 토스트 전환 | M | index.tsx:358, employer.tsx:210-211·524-545 | carrot-01, flow-01, gap-06, undo-01 |
| 2 | 재게시: expired/closed 배너 + `fromPostingId` 프리셋 + 캐러셀 최근 3건 | M | index.tsx 최상단, create.tsx:43-47·89-142 | carrot-03, gap-07 |
| 3 | "지금 할 일" 카드 + selectPrimaryAction + 카드 위계 3단(리스트 행 강등) + 골드 총량 2곳 + 섹션 간격 gap-8 + 타이포 위계 | L | index.tsx:98-118·512-616, colors | toss-01, ia-01(부분), ia-05, gold-01, ia-11, ia-12, nest-01 |
| 4 | 숫자 진실원 통일 + "확정"/"자리" 라벨 분리 공용 컴포넌트 + 삭제 게이트 소스 교체 + 스켈레톤 대기 | M | index.tsx:282-290·463-508, applicants.tsx:238-250, edit.tsx:58, selectors.ts:39-47 | ia-04, flow-06, stat-01, ia-08③, format-01① |
| 5 | useJobDetail 컨텍스트 수렴(이중 구독 제거, OR 게이트 단순화, 자식 4화면 점검) | M | index.tsx:129-136, _layout.tsx:135·137 | rt-01, flow-11, flow-10(부분) |
| 6 | 딥링크 2단 push(상세 깔고 자식) | M | deepLinkNavigationExecutor.ts:75, NotificationRouteMap.ts:8-48 | flow-02 |
| 7 | 취소요청 인라인 처리 + 수제 모달→ConfirmModal 수렴(햅틱 상속) | M | index.tsx:531-544, cancellation-requests.tsx:243-281 | baemin-03, haptic-01 |
| 8 | 확정해제·취소승인 Undo 전환(주의: action 토스트는 루프·재시도 금지, per-id 가드) | M | applicants.tsx:127-140, toastStore.ts:23·69-71 | toss-03 |
| 9 | 통계 숫자 탭 가능 + applicants filter 파라미터 주입 | S~M | index.tsx:463-508, ApplicantList.tsx:82 | flow-07 |
| 10 | 로딩 스켈레톤 통일(applicantList/settlementList 프리셋 재사용) + ActionCard→PressableCard | M | applicants.tsx:197-202, settlements.tsx:162-167, edit.tsx:141-146, index.tsx:91-97 | loading-01, load-01, state-02 |
| 11 | 새 지원 인라인 알림(prevRef 비교+햅틱, 소리 금지) + 근무표 경유 생성에 액션 토스트 | M | useApplicantsByJobPosting.ts:104-117, create.tsx:171-181 | baemin-01, flow-08 |
| 12 | "공유" 용어 분리: 협업자 카드→"함께 관리할 사람" 개명 | S | index.tsx:608-614, collaborators.tsx:41 | ia-10, flow-12(헤더 통일 동시) |

### 3단계 — 기능 (L~XL, 신규)

| # | 항목 | 규모 | 근거 파일 | 해소 지적 |
|---|---|---|---|---|
| 1 | D-1/D-2 정원 미달 크론 알림 + 배정 줄 D-day·부족 경고 | M | baseline_platform_glue.sql:176-227(크론 목록), index.tsx:493-507 | gap-04 |
| 2 | 확정 스태프 일괄 공지(employer_notice RPC + 발송 이력) | M~L | notification.ts:19-182, settlements.tsx:206-212 | gap-03② |
| 3 | 지원자 노쇼 이력 칩(집계 RPC, 횟수만·업장 비노출) | M~L | CardHeader.tsx:92-99, statusValues.ts:34 | gap-08 |
| 4 | 협업자 권한 2단(viewer/manager — RLS가 진짜 게이트) | L | jobPostingCollaborator.ts:12-19, baseline:9973-9980 | gap-09 |
| 5 | 공유 출처 파라미터 + 지원용 QR(출퇴근 QR과 문구 분리 필수) | M | useShare.ts:120, qr.tsx:98-120 | gap-10 |
| 6 | 상세 트리 탭 컨테이너 개편(형제 push 스택→상단 탭) — **W2-6 원장 트랙(XL)과 통합 계획** | L~XL | index.tsx:178-196, useJobDetail.ts:34 | flow-04, ia-01(잔여) |
| 7 | ops 스택 브레드크럼/fallbackHref 정비 | S~M | index.tsx:198-206, RouteRegistry.ts | flow-14 |

## 5. 재설계 제안: 공고상세 화면 v2

```
As-Is (index.tsx 현행)                      To-Be (v2 제안)
─────────────────────────────────          ─────────────────────────────────
[← 공고 상세 | 제목…]      [공유][QR]       [← 공고 상세 | 제목…] [미리보기][공유][QR][⋯]
                                                                    (⋯ = 공고 삭제)
┌ Card ─────────────────────────┐          ┌ (조건부) 상태 배너 ──────────────┐
│ [대회][승인뱃지]               │          │ 반려: 사유+[수정][재제출] (최상단) │
│ 제목 (text-lg, 2줄 중복)       │          │ 만료/마감: [같은 조건으로 다시 올리기]│
│        [상태뱃지] [상세 ▾]     │          └─────────────────────────────────┘
│ (접힘: 위치/일정/급여/수당/     │          ┌ 헤더 카드 ───────────────────────┐
│  세금/사전질문 — 기본 숨김)     │          │ 제목(보조) · [모집중 ▾]←탭=마감/재오픈│
│ ┌내부 카드(중첩)─────────┐    │          │ 「내일」 8/14(목) 18:00 · 강남 · 12만│
│ │ 지원자 | 확정 | 대기중  │    │          │ (요약 1줄 상시 — 접지 않는다)      │
│ │ (text-xl, 탭 불가,      │    │          ├ TodayOpsStrip (오늘 근무 시) ─────┤
│ │  다크서 구분선 소실)     │    │          │ 출근 3/5 · 노쇼 1 · 정산 대기 2   │
│ │ 배정 현황 1 / 5 명      │    │          │ (각 배지 = 목적지 딥점프)          │
│ └───────────────────────┘    │          └─────────────────────────────────┘
└───────────────────────────────┘          ┌ 지금 할 일 (1장, 유일한 골드) ────┐
"관리" (text-lg)                            │ "취소 요청 1건 — 근무 3시간 전"    │
 ┌카드│지원자 관리        (3명)┐            │ [거절] [요청 승인]  ← 인라인 처리  │
 ┌카드│취소 요청 관리     (2건)┐            │ (없으면: "오늘은 처리할 일이 없어요")│
 ┌카드│스태프 관리/정산   (3명)┐            └─────────────────────────────────┘
 ┌카드│공고 수정 (수정 제한)   ┐            숫자 스트립 (전부 탭 가능):
 ┌카드│라이브 운영 (보라 아이콘)┐            조회 82 | 지원 5 | 확정 2 | 대기 3
 ┌카드│공유 관리               ┐            자리 3/5 채움 · D-1 (부족 시 warning)
 (6장 동급 나열, 우선순위 없음)              ├ 지원 0이면: "아직 지원이 없어요"   ┤
                                            │ + [공고 공유하기] (골드 CTA)      │
(고정 공고: 수정 카드가 섹션 밖              관리 (리스트 행 + 디바이더):
 별도 블록에 소속 없이 표류)                  · 지원자 관리            대기 3
                                            · 스태프·정산         정산 대기 2
"공고 내용" description                      · 공고 수정  (확정 역할 잠김 병기)
                                            · 함께 관리할 사람 ("공유" 개명)
(반려 시) 반려 배너 — 스크롤 최하단          ★ 라이브 운영: 진행 중이면 여기가 아니라
 [수정하기][재제출]                             "지금 할 일" 위 최상단 고정 (b2b-01)
────────────────────────────────           근무 정보 (기본 펼침: 일정·급여·위치)
[공고 삭제] full-width (최대 시각 무게)       · "수당·세금·사전질문"만 더 보기
"확정된 지원자가 있는 공고는                 공고 내용
 삭제할 수 없습니다" (상시 노출)             ─────────────────────────────────
                                            [하단 고정 CTA 1개 — 상황별]
                                            모집중="지원자 3명 보기" / 정원참=
                                            "모집 마감하기" / 만료="다시 올리기"
                                            (ScrollView 하단 인셋 예약 필수 — 룰32)
```

핵심 이동: 삭제는 헤더 ⋯ 오버플로로(비활성 사유는 시트 캡션), 반려 배너는 최하단→최상단, 통계는 장식→진입점, 골드는 8곳+→"지금 할 일"과 빈 상태 공유 CTA 최대 2곳.

## 6. 벤치마크 매핑 표

| 벤치마크 패턴 | UNIQN 적용안 | 관련 지적 |
|---|---|---|
| 당근 "판매중 ▾" 상태 바텀시트 | 상태뱃지 탭→ActionSheet 마감/재오픈, capacity_full은 "정원 참(자동)" disabled | carrot-01 |
| 당근 "조회 32 · 관심 3 · 채팅 1" | 스트립 4칸(조회는 회색 강등) + 조회/지원 비대칭 힌트 배너 | gap-01, carrot-02 |
| 당근 오래된 글 "끌어올리기" 우선 제안 | 만료/마감 공고 최상단 "같은 조건으로 다시 올리기" | carrot-03 |
| 당근 매너온도+거래 횟수 | 지원자 카드 "완료 12 · 노쇼 1" 신뢰 칩(warning 틴트만, 낙인 금지) | gap-08 |
| 토스 "한 화면 한 결정" | selectPrimaryAction 기반 "지금 할 일" 1장, 나머지 회색 리스트 | toss-01 |
| 토스 "삭제됐어요 · 되돌리기" 토스트 | 마감·확정해제·취소승인 = 낙관 실행+5초 Undo (삭제는 확인 유지) | undo-01, toss-03 |
| 토스 "마지막 성공 화면 유지 + 얇은 배너" | error && !posting 가드 + partial 배너 | err-01 |
| 배민 "지금 처리할 주문" 최상단 카드 | TodayOpsStrip 상세 승격 + 노쇼>0이면 1순위 집기 | baemin-02 |
| 배민 주문 카드 위 인라인 수락/거절 | 취소요청 상세 인라인 [거절][승인] + 승인 후 "공고 공유" 연쇄 | baemin-03 |
| 배민 "오늘 마감 임박" 푸시 | D-2/D-1 정원 미달 크론 알림(멱등키) | gap-04 |
| 배민 "직원 공지" | 확정 N명 일괄 공지 시트 + 발송 이력 1줄 | gap-03 |

## 7. 하지 말아야 할 것 (B2B 운영도구의 경계)

- **라이브 운영을 빈도 기준으로 강등하지 말 것** — 대회 D-day엔 유일하게 중요한 진입점이다. `opsTournaments.length>0`이면 항상 최상단 고정(index.tsx:576-606). 소비자앱의 "자주 안 쓰면 숨김" 논리를 여기 적용하면 현장에서 못 찾는다. (b2b-01)
- **협업자 시점에서 액션을 '숨기지' 말 것** — B2B는 되돌릴 수 없는 대타인 행동이라 숨김 대신 **비활성+사유 캡션**("공고 삭제는 소유자만 할 수 있어요")이 기본값. isOwner 판정은 collaborators.tsx:34에 이미 있다. (b2b-01)
- **알림음을 넣지 말 것** — 홀덤펍 현장은 야간·고소음. 배민의 소리+배지+고정 중 소리는 버리고 햅틱+시각 고정으로 대체. (baemin-01⑤)
- **공고 삭제를 Undo로 바꾸지 말 것** — Undo 전환 대상은 가역 액션(마감·확정해제·취소승인)만. 삭제는 확인 모달 유지, 라벨만 교체. (undo-01)
- **확인 다이얼로그를 전부 없애지 말 것** — 반대로 마감처럼 완전 가역인 것에 모달을 남기면 "모달 무의식 통과" 습관이 진짜 파괴 액션으로 전이된다. 기준은 가역성이지 위험해 보이는 정도가 아니다. (undo-01)
- **하단 고정 CTA를 얹을 때 ScrollView 인셋 예약 없이 배포하지 말 것** — 현행 index.tsx:321-331엔 인셋이 없어 즉시 가림 사고가 난다(임펙커블 룰32). (toss-02)
- **1·2단계를 W2-6 허브 전면 개편(원장 등재 XL)과 한 묶음으로 만들지 말 것** — 프로젝트 메모리가 "W2 10항목=4~5주 XL, 묶음에서 빼라"고 명시. 이 리포트의 단계는 독립 착지 가능한 슬라이스로 설계했다.
- **요약 1줄의 금액을 자르지 말 것** — 금액·수치는 truncation 금지, NumericText 사용(룰26·룰19).

## 8. 미검증·불확실 항목 (PARTIAL — 과장 없이)

| 지적 | 불확실한 부분 | 확인 방법 |
|---|---|---|
| ia-03 | "다른 탭 다녀오면 다시 접힌다"는 부정확 의심 — expo-router Stack push는 이전 화면을 언마운트하지 않아 useState 유지. 리셋은 목록 재진입 시로 한정 | 실기기에서 상세→지원자→뒤로 후 isInfoExpanded 유지 여부 관찰 |
| ia-07 | 상단 TournamentStatusBadge가 탭 가능(사유 모달)이라 "사유 열람이 최하단뿐"은 과장. 단 index.tsx:340-344가 jobPostingId 미전달로 모달에 수정/재제출 버튼이 안 뜨는 건 사실 | TournamentStatusBadge에 jobPostingId를 넘겨 모달 :282 조건 충족되는지 확인 |
| nest-01 | ②반려 사유 박스의 "배경색 동일해 무의미" 주장은 반증됨(배너가 bg-error-50 틴트, index.tsx:650). 중첩 위반 2곳 자체는 유효 | — (①만 반영, ②는 색 주장 제외하고 구조만) |
| toss-03 | ③dedupe 함정은 반증 — toastStore.ts:69-71이 action 토스트를 dedupe에서 명시 면제. "이름 유일화" 불필요. 진짜 주의점은 action 토스트를 재시도 루프에 넣지 않기 | — (본론인 Undo 전환·M9 미이행은 유효) |
| baemin-01 | "아무 신호 없다"는 앱 수준 과장 — DB 트리거 푸시 알림 실재(baseline:4204-4261). 성립하는 건 "상세를 보고 있는 순간의 화면 내 신호 공백"만 | — (범위 좁혀 2단계 11번에 반영) |
| b2b-01 | ③"잠금 경고가 수정 화면에만"은 부정확 — 상세 ActionCard에 '일정·역할 수정 제한' 배지 실재(index.tsx:566-570). 정보량 차이만 있음 | — (gap-05의 문구 정합 작업으로 흡수) |
| del-02 / flow-05 | "딥링크 진입이면 갇힌다" 범위 과장 — 네이티브 푸시는 push라 스택 하부에 탭이 깔려 back 동작. 실제 갇힘은 웹 직접 URL 등 히스토리 없는 진입 한정. "재조회가 err-01 에러를 띄운다"도 반증(getById는 cancelled 정상 반환 — 취소된 공고 화면이 그려질 뿐) | 웹에서 상세 URL 직접 진입→삭제→화면 잔류 재현. canGoBack 폴백은 어차피 1단계 3번에 포함 |
| format-01 | ②제목 펼침 부재를 룰26 위반으로 모는 건 룰 오적용(타이틀 행은 ellipsis 자체 허용). ①확정/정원 표기 불일치만 유효 | — (①만 2단계 4번에 반영) |
| flow-14 | "돌아올 길이 시스템 뒤로가기뿐"은 부정확 — ops 3화면 모두 StackHeader 뒤로가기 실재. 남는 실결함은 직진입 시 fallbackHref가 구인자 맥락 상실 + 브레드크럼 부재 | ops 화면 3곳의 fallbackHref 값 확인(tournaments/index.tsx:454 등) |
| (편집자 발견) undo-01 ↔ del-02 상충 | undo-01은 삭제를 "서버 hard delete"라 서술했으나 del-02·flow-05와 selectors.ts:39-43은 soft cancel(status='cancelled')로 검증 — soft cancel이 맞다. 단 "삭제는 확인 유지" 결론 자체는 두 지적 모두 동의하므로 로드맵에 영향 없음 | JobPostingRepository의 delete 경로에서 실제 DML 확인 |

---
등급 표기는 전부 검증자 조정치를 따랐다(분석가 CRITICAL 주장 5건은 검증 단계에서 이미 HIGH/MEDIUM으로 하향 반영됨). 근거 없는 항목은 싣지 않았다.