# UNIQN 전체 감사 — 상식 관점 결함·어색한 플로우 (2026-08-07)

> 조사: 메인 세션 직접 검증 + 도메인별 병렬 에이전트 5종(구직자·사장/운영·인증/온보딩·UI일관성·횡단정합성)
> 기저선: tsc 0에러 · jest 581스위트 6347테스트 전부 통과 · prod Supabase 읽기전용 쿼리 7건
> **2026-08-07 재확인**: #409~#424 머지 이후에도 아래 주요 8건 전부 잔존(스팟체크 완료)

---

## 총평

코드 품질은 상위권이다. 흔한 코드 냄새는 이미 잡혀 있다 — `console.log` 0 · `Alert.alert` 직접호출 0 · RN `<Image>` 0 · 계층 위반 0 · 낙관적 업데이트 롤백 9훅 전부 정상 · 44px 미만 터치타깃 0 · 접근성 라벨 576/584 · TODO 1건.

그래서 남은 결함은 전부 **"기능이 있다고 말하는데 실제로는 안 되는"** 부류다. 세 덩어리:

1. **탈퇴 파이프라인이 전 구간 고장** — 안내 문구부터 영구삭제 크론까지
2. **만들어놓고 배선을 안 한 기능 8개** — 북마크·지원자검색·대타글 연결·구인처평점·상태머신 등
3. **알림 체계가 DB와 클라이언트 두 갈래로 분열** — 실제 발송되는 타입을 앱이 모른다

---

## 🔴 P0 — 즉시

### A1. 회원탈퇴 영구삭제 크론이 구조적으로 100% 실패

프로덕션에서 인과사슬 전체 확인.

| 단계 | 실측 근거 |
|---|---|
| 크론 `process-scheduled-deletions` 매일 02:13 KST **가동 중**(`active=true`) | prod `cron.job` |
| → EF 가 **service_role** 로 `permanently_delete_user` 호출 | `supabase/functions/process-scheduled-deletions/index.ts:51-86` |
| → 함수 첫 줄 `IF auth.uid() IS NULL → RAISE 'PERMISSION_DENIED'` | prod `pg_get_functiondef` (베이스라인 `20260710000002:8228`) |
| → service_role JWT 엔 `sub` 없음. prod 에서 클레임 재현 실행 → **`auth.uid()` = NULL, 가드 발동 = true** | prod 실행 |

한 건도 성공할 수 없다. EF 는 행마다 예외를 잡아 `failed++` 하고 `console.error` 만 남기므로 **"매일 정상 실행되면서 처리량 영구 0"** — `last_work_date` 죽은 크론과 동형.

- 현재 prod `status='deactivated'` **0건** → 피해자 없음. **첫 실사용자 탈퇴 순간 발화**.
- uid 요구 SECDEF 함수 56개 중 service_role 경로 호출은 **이것 하나뿐**(EF 전체 `.rpc()` 4종 대조 완료) → 수정 범위 좁음.
- 수정 방향 2택: ①RPC 가드에 service_role 분기 추가(`current_setting('request.jwt.claims')` role 검사) ②EF 를 admin JWT 경유로 전환.
- ⚠️ 착수 전 `supabase/tests/` pgTAP 전수 grep(트리거·가드 변경이 기존 테스트를 깨뜨린 선례 있음 — #420).

### A2. 탈퇴 안내 문구가 코드가 지키지 않는 약속을 한다

`app/(app)/settings/delete-account.tsx:234-238` — "진행 중인 지원 내역이 **모두 취소**됩니다", "**모든 데이터가 영구 삭제**됩니다".

실제: `UserRepository.ts:301-315` 가 `users.status='deactivated'` 만 쓴다. 7일 뒤 RPC 도 applications·work_logs 를 **취소가 아니라 익명화**만 한다(status 불변, `filled_positions` 미회수). 사장 근무표에 "[deleted]" 유령 스태프가 확정 상태로 남고 정원도 계속 소모.

확정 근무·미정산 급여가 있어도 경고 없이 탈퇴 통과.

**덤**: 필수로 받는 탈퇴 사유가 **저장되지 않는다**(`UserRepository.ts:301-313` UPDATE 에 reason 없음, `:222` 주석이 자인).

### A3. 실제 발송되는 출퇴근 알림을 앱이 모른다

prod `notifications` 실측 — `work_log_check_in` 2건, `work_log_check_out` 2건, 최근 2026-07-28. 이 문자열은 `src/`·`supabase/functions/` **어디에도 없다**(재확인 08-07: 0건). 클라 enum 에는 `staff_checked_in`·`check_in_confirmed` 가 있으나 **prod 발송 0건**(죽은 값).

| 영향 | 근거 |
|---|---|
| 출퇴근 알림이 '출퇴근' 카테고리 탭에서 **증발**(전체 탭에만) | `notificationGrouping.ts:287-288` — 미매핑 → `undefined ≠ categoryFilter` |
| 사용자가 출퇴근 푸시를 **꺼도 계속 발송** | `send-push-notification/index.ts:130-131` — `if (!category) return false; // 미매핑 = 기본 허용` |
| 딥링크 미등록. 구인자용은 **자기 공고의 구직자용 상세**로 착지 | `NotificationRouteMap` 미등록 / baseline `:5273` |

드리프트 가드 테스트는 **클라↔EF 사본 일치만** 검사 → 둘 다 DB 와 어긋난 상태를 "정합"으로 판정.

**값 리네임은 불가**(이미 발송된 행 존재) → 클라가 흡수. 드리프트 가드에 "DB 발송 타입" 차원 추가 필요.

### A4. 데이터 화면 12곳에 에러 상태가 없어 실패가 "빈 상태"로 위장

전체 90화면 중 `ErrorState` 채택 20개. 공용 컴포넌트가 이미 있는데 미배선.

**최악**: 리뷰 허브(`useReviews.ts:377-385` 가 error 를 반환조차 안 함) — 조회 실패 시 `reviews/history.tsx:166-171` 이 **"모든 평가를 완료했어요"** 축하 문구. 7일 마감 기능이라 이 오안내를 믿으면 **평가 기회가 실제로 소멸**. RefreshControl 도 없어 재시도 불가.

기타: `support/faq.tsx:17,39`(error 분기 0건 재확인) · `support/my-inquiries.tsx:81` · `employer-application-status.tsx:249` · `my-postings/[id]/collaborators.tsx:28` · `(ops)/tournaments/[id].tsx`

---

## 🟠 P1 — 사용자가 실제로 겪는 결함

### B1. 배선 안 된 기능 8개

| 기능 | 상태 | 근거 |
|---|---|---|
| 공고 북마크(하트) | 저장되는데 **모아볼 화면 없음**(08-07 재확인: 라우트 0) | `useBookmarks.ts`·`bookmarkStore.ts` 소비처는 `JobCard` 토글뿐 |
| 지원자 검색·정렬 | 유틸+테스트만, 화면 호출 **0건**(08-07 재확인) | `filterApplicants` |
| 대타 게시판 → 원 공고 연결 | 데이터 저장, **렌더 0건** | `boardSubstituteService.ts:54-79`(주석: "지원자 네비게이션에 사용") |
| 구인처 평점(버블스코어) | 스태프에게 **절대 안 보임** | `JobDetail.tsx:69` `canReadOwnerProfile = isAdmin \|\| isEmployer`, `:82` 쿼리조차 비활성 |
| 상태 머신 `statusFlow`/`canTransition` | 소비자 **0** + DB 실전이와 모순 | `statusFlow.ts` — no_show 종결로 정의했으나 DB QR 은 no_show→checked_in 실행 |
| 문의 답변 알림 `inquiry_answered` | 배선 완비, **발송자 0** → 문의자는 답변을 모름 | 답변 RPC `20260725150000` 가 INSERT 안 함, prod 0건 |
| 알림 5종 settlement_requested·report_resolved·application_cancelled·app_update·maintenance | 동일 | prod 실측 0건 |
| ops 라이브 운영툴 전체 | 컴포넌트 50여개·탭 7종이 플래그 OFF | `featureFlags.ts:26` + 원격 OFF |

**ops 별도 문제**: `app/(ops)/_layout.tsx` 가 인증만 검사하고 **플래그를 안 본다**(08-07 재확인: `ops_hub` 참조 0건) → 플래그 OFF 인데 딥링크·직접 URL 로 아무 로그인 사용자나 진입 가능. "플래그만 켜면 오픈"이라는 전제와 실제 접근성이 어긋난다.

### B2. 돈이 걸린 결함 3건

- **지점 정산: 카드와 상세 모달이 같은 근무에 다른 금액** — 카드는 수당·세금 포함 canonical 을 받는데(SETTLE-8), 탭해서 여는 모달엔 `allowances`/`taxSettings` 미전달(08-07 재확인: 0건) → 수당 0·기본세금으로 **재계산**. 폴백 `{type:'hourly', amount:0}` 이라 salaryInfo 부재 시 0원을 그린다. (`venue-settlements.tsx:240-245` / `SettlementDetailModal.tsx:103-107`)
- **일괄 정산이 클라이언트 다단계 뮤테이션** — `SettlementRepository.ts:440-528` `Promise.all` 개별 update 루프 + 클라 금액 계산. "이미 정산 완료" 판정이 읽기 시점 스냅샷이라 동시 정산 시 중복 통과 가능, 부분 실패 롤백 없음. **CLAUDE.md "정산=RPC 필수" 정면 위반**. ⚠️메모리 기재 "R4 선행=`SettlementRepository.ts:372`·`:648` RPC 화"와 같은 트랙일 가능성 — 착수 전 대조.
- **기본단가 ₩15,000 자동 적용이 무신호** — 공고 스팬 행이 fallback 이어도 배지·안내에서 제외(`venue-settlements.tsx:73-79,127`). 코드 주석이 "거짓 배지가 된다(HIGH-1)"라고 사유는 남겼으나 대체 신호 미생성.

### B3. 막다른 골목 4건

- **profile-setup 에 탈출구 없음** — "이전" 버튼이 **토스트만**(`profile-setup.tsx:84-86`), 제스처 백 비활성, 타 라우트는 가드가 되돌림. 잘못된 계정으로 로그인하면 **앱 안에서 계정 변경 불가**. 소셜 가입 화면엔 "중단하고 나가기"+signOut 이 있는데 이 화면만 없다.
- **거절된 지원은 안 보이는데 재지원은 서버가 차단** — `ApplicationRepository.ts:230-236` 이 CANCELLED 외 전부 "이미 지원한 공고입니다". 거절 알림을 놓치면 지원서를 다 쓴 뒤 **사실과 다른 메시지**. 거절 사유 화면 없음.
- **사장 탈퇴 시 확정 스태프는 "그냥 마감됐다"만 받음** — RPC 가 `owner_id=NULL` 로 만들어 앱 내 사장 연락처(`ownerPhone`)까지 소멸. 근무 취소 여부도, 급여 수령처도 알 수 없고 물어볼 수도 없다.
- **UGC 게시판인데 사용자 차단 기능 없음**(08-07 재확인: 코드·DB 0건) — 신고·모더레이션은 있음. Apple 1.2 는 ①필터 ②신고 **③학대 사용자 차단** ④연락처를 요구하는데 ③만 결여. 1.0.5 통과 이력이 있어 즉시 리젝 단정은 불가하나 심사 재현성 리스크.

### B4. 그 외 P1

- **문체 무작위 혼용** — 합니다체 436 vs 해요체 588. 같은 다이얼로그 안에서도(`settings/index.tsx:107`).
- **색상 하드코딩 332건/120파일** — 같은 버튼 행에 3가지 지정 방식(`ConfirmedStaffCard.tsx:247/271/283`), success 그린 `#22C55E` 18건 vs `#16A34A` 4건.
- **로딩 패턴 이원화** — 코어 탭 Skeleton(30파일) vs 주변 화면 전면 스피너(16파일, 6곳 색 미지정 → 다크 저대비).
- **내 정보 열람에 '제3자 제공 동의' 누락** — 가입 시 [필수]로 받는 동의(#95)가 열람 화면·클라 타입·조회 컬럼에 전부 없음. DB 엔 컬럼 존재. 열람권 대응 목적에 비추면 구멍.
- **오프라인 캐시 TTL 을 온라인 staleTime 으로 겸용, 4훅** — `useWorkLogs.ts:86,150` 은 **TTL 30초**라 오프라인 캐시가 무의미. 모범 패턴(`offlineCachePolicies`=24h)이 `useSchedules` 에 이미 존재 → 수렴만 하면 됨.
- **전화 걸기 안전 래퍼를 핵심 동선이 우회** — Sentry 실사고(UNIQN-MOBILE-1F) 때문에 만든 `openExternalUrl` 을 관리자·사업자정보 4곳만 사용, 트래픽 몰리는 **7곳은 맨손 `Linking.openURL`**(08-07 재확인: 7건). 웹·태블릿에서 무반응 + unhandled rejection.
  - `JobDetail.tsx:93` · `InfoTab.tsx:313` · `WorkTab.tsx:144,174,210` · `apply.tsx:106` · `app/jobs/[id].tsx:55`

---

## 🟡 P2 — 어색함·미완성

- **지점 이름변경·삭제 불가** — 오타 지점 영구 잔존, 단가표·정산 분열. 자동 기본지점 생성까지 있어 늘기만 함. (`VenueSettingsSheet.tsx:6`·`work-schedule.tsx:222-223` 코드 주석 자인)
- **ops 대회 날짜·게임타입이 무검증 자유 텍스트** — "7/1" 로 넣어도 저장 성공, 당일 '이어서 운영' 카드만 영영 안 뜸(정확 문자열 비교). 조용한 실패. (`new.tsx:197-205` / `opsTournament.schema.ts:46` / `selectResumeTournament.ts:26-28`)
- **게시판 50건 하드캡**(08-07 재확인) — `useBoardPosts(type, 50)`, `onEndReached` 없음, 검색 없음 → 51번째부터 영구 도달 불가.
- **게시글 작성·수정에 이탈 가드 없음** — 뒤로가기 한 번에 전량 소실. 같은 앱 지원 폼엔 가드 존재(규칙 불일치). (`write.tsx:40`·`edit/[postId].tsx:108`)
- **'지원하기' 비활성 사유 미표시 + 알려주려던 코드가 도달 불가** — `ApplicationForm.tsx:247` `disabled` → `:188` early return → `:192-197` 하이라이트가 구조적으로 죽음.
- **지원 직전 재검증 실패를 삼키고 제출** — `apply.tsx:212-214` catch 가 `logger.warn` 만 → 마감 공고에도 제출.
- **미작성 평가 dedup 이 '최근 20건'만 참조** — 마감 창 안 21건 이상이면 이미 쓴 평가가 부활하고 재작성 시 서버 거부(대회사 40명 평가가 전형). `useReviews.ts:356-362`
- **한 건 마감 중 전 카드 잠금** — `employer.tsx:484-485` 가 `isPending` 브로드캐스트.
- **정산 일괄선택 '선택 N건'과 '선택 금액'이 다른 모집단** — `SettlementList.tsx:206-212` vs `:367`.
- **탈퇴 유예 모달이 (app) 전용** — (employer)/(ops) 딥링크 직진입 시 우회.
- **알림 권한 배너가 OS 설정 복귀 후 미갱신** — AppState 리스너 없음(`settings/notifications.tsx:54-59`). 안내가 스스로 거짓말이 되는 구간.
- **이메일 중복을 본인인증(SMS 비용·시간) 후에 통보** + 로그인/비밀번호찾기 CTA 없음.
- **같은 `completed` 에 반대 라벨** — `WORK_LOG_STATUS_LABELS`='정산 완료' vs `CONFIRMED_STAFF_STATUS_LABELS`='정산 대기'.
- **수동 상태 시트가 종결 상태 역전이 무제한 허용** — completed→scheduled(기록 삭제) 등. 정산완료 행 가드가 이 층에 없음(`statusTransitions.ts:41-89`).
- **'장소' vs '지점' 같은 주문서 안에서 혼용** — `PlaceSheet.tsx:155` vs `VenueSelectChips.tsx:32`.
- **이모지 잔존** — `jobPosting.ts:79-84` 역할 아이콘 6종이 전부 이모지인데 **플로어·매니저가 같은 👔**(구분 실패). 디자인 룰 14 위반.
- **관리자 대시보드에 대기건수 배지 0** — 큐 성격 타일 5개를 일일이 열어야 함. 같은 파일에 raw Tailwind 팔레트(rose/cyan/emerald/orange)+하드코딩 hex 7개.
- **ops '오늘' 판정이 KST +9h 하드코딩** — 앱 표준 `getTodayString()`(로컬)과 이원화(`selectResumeTournament.ts:13`).

---

## 🔵 P3 — 다듬기

**이모지 제거 잔재 7곳** — 컨테이너를 빈 채로 뒀다. 두 곳은 미관 문제가 아님:

| 위치 | 사라진 것 |
|---|---|
| `ui/FormSelect.tsx:69` | **선택된 옵션 체크 표시** → 선택 상태가 글자색으로만 전달(색상 단독 의존) |
| `ui/FormField.tsx:55`, `FormSelect.tsx:205` | 에러 메시지 앞 경고 아이콘 |
| `FormErrorBoundary.tsx:40`, `DataFetchErrorBoundary.tsx:43`, `delete-account.tsx:229` | 에러/경고 아이콘 |
| `settings/index.tsx:28-40` | SunIcon 이 빈 문자열 → "다크 모드" 행만 아이콘 공백 |

그 외: 버전 행이 안 눌리는데 chevron 표시 · 태그라인 불일치("홀덤 스태프 매칭 플랫폼" vs "안전한 스태프 채용 플랫폼") + 스플래시 `bg-surface-dark` 고정(라이트모드 밝기 점프) · 생체인증 토글 비활성 사유 미표시 · 푸시 마스터 토글이 로딩 중 기본 ON 으로 보이고 조작 무시 · 연락처 미등록 고정공고에 "위 연락처로 문의" · 잠긴 글 수정 화면이 사용자가 못 하는 "잠금 해제"를 안내 · 금액 표기 ₩ vs 원 이중 규약(`toLocaleString` 직접 25건) · 800줄 초과 4파일(`schedule.tsx` 1292 · `OrderSheetScreen.tsx` 1201 · `JobPostingRepository.ts` 1115 · `SettlementRepository.ts` 814) · jest 워커 teardown 누수 · `ErrorState.tsx:121-125` 가 내부 에러코드를 `__DEV__` 게이트 없이 노출 · bare `catch {}` 71곳(대부분 의도적, 신규 리뷰 체크포인트로만).

---

## 건강한 것 (반증 완료 — 재제기 금지)

- 앱 런타임 `console.log` **0건** · Presentation/Hooks 의 Supabase 직접 호출 **0건**(authCoreService rpc 4건은 허용 예외) · `Alert.alert` 직접 호출 **0건** · RN `<Image>` **0건**
- 낙관적 업데이트 롤백 **9훅 전수 정상**(useBoard 는 Snapshots 네이밍이라 초기 grep 이 놓쳤을 뿐)
- 알림 46종이 문구·딥링크 매핑 **100% 커버**(A3 의 DB 축 분열과는 별개 축)
- FlatList 7곳 전부 소형(규칙 적합) · 뒤로가기 아이콘 ChevronLeftIcon 단일 · `dark:` 커버리지 높음 · 44px 미만 무보정 터치타깃 0
- 자동마감 크론 타임존 Asia/Seoul 정상 · 워크스페이스 플로우 견고(보관 시 진행공고 차단 RPC + 건수 포함 한글 에러)
- 워크스페이스 초대 알림→(employer) 게이트 충돌 가설 **기각**(RPC 가 후보를 employer/admin 으로 제한)

---

## 권고 순서

1. **탈퇴 파이프라인 3건 묶어서**(A1+A2+사유저장) — 법적 의무가 걸려 있고 **피해자 0명인 지금이 가장 싼 시점**
2. **알림 타입 정합**(A3) — `inquiry_answered` 발송 1줄 추가는 체감 대비 가장 저렴
3. **`ErrorState` 배선 12화면**(A4) — 공용 컴포넌트 존재, 화면당 반나절급. 리뷰 허브부터
4. **배선 안 된 8개 기능은 "완성 vs 제거" 결정**(B1) — 지금은 셋 다 유지비만
5. **문체·용어는 카피 가이드 1페이지 확정 후 일괄 치환** — 가이드 없이 개별 수선은 무의미. 색상·토스트 진입점은 ESLint 로 재발 차단

---

## 검증 근거·한계

- **실행 증거**: tsc `--noEmit` exit 0 · jest 581/581 스위트·6347/6347 테스트 통과(212초) · prod Supabase 읽기전용 7건(`cron.job`·`pg_proc`·`pg_trigger`·`notifications` 타입분포·`users` 집계·`auth.uid()` 클레임 재현)
- **교차검증**: 에이전트 보고 중 최고영향 6건(알림 타입 드리프트 2종·구인처 평점 게이트·게시판 하드캡·정산 모달 인자·푸시 fail-open)을 메인 세션이 소스에서 직접 재확인. 표본 6/6 정확.
- **한계**: 에이전트 보고 나머지 항목은 인용 `파일:줄`을 전수 재검증하지 않음 — **착수 전 해당 파일 확인 권장**. 실기기 QA 축(렌더·제스처·다크모드 실측)은 범위 밖.
- **감사 시점 파일 미수정.** 2026-08-07 재확인 시 주요 8건 전부 잔존.
