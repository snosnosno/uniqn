# 죽은 회로 정리 웨이브 — 다음 세션 인계 (2026-08-02)

> 이 문서 하나로 새 세션이 이어받을 수 있어야 한다. 앞 세션의 대화 맥락은 없다고 가정하고 쓴다.

## 0. 지금 상태 (사실만)

| 항목 | 값 |
|---|---|
| 워크트리 | `C:\Users\user\Desktop\T-HOLDEM-cleanup` (**메인 체크아웃 아님**) |
| 브랜치 | `chore/dead-circuit-cleanup` |
| base | `e960ffed3` (착수 시점 `origin/master`) |
| 커밋 | `030ba235d` 제거 14건 (41파일 −2,173줄) · `b53276e13` 완성 9건 (46파일 +4,423/−415) |
| node_modules | 메인 레포로 정션 연결 완료 (818개) — 재설치 불필요 |
| PR | **미생성** |
| 마이그레이션 | 파일 3건 커밋됨 · **DB 적용 0건** |

### 검증된 것 (앞 세션 실행 결과)
```
npx tsc --noEmit   → exit 0
npm run quality    → exit 0 (에러 0 / 경고 102 = 기존 스타일 경고, prettier clean)
npx jest           → 609/609 스위트 · 6,610/6,610 테스트 (exit 0)
red-green          → 전체삭제 낙관갱신 가드 제거 시 해당 1건만 red, 복원 시 green
prod 실측          → notifications 에 type='settlement_requested' 행 0건 (제거 안전)
```

### 검증 안 된 것 — 이번 세션의 과업
- **마이그레이션 3건 미적용 · 로컬 실행 관찰 0회**
- 실기기 QA 전량 (알림 삭제 Undo·프리셋 관리 시트·신고 첨부·프로필 로그아웃)
- 웹 렌더 (SheetModal 이 웹에서는 `WebSheetModal` 이라 동작이 갈릴 수 있음)

---

## 1. 이번 세션 과업

### 과업 A — 코드 리뷰 (먼저)
두 커밋의 diff 를 리뷰한다. `git diff e960ffed3..HEAD`

디스패치 권장 (모델 3계층 라우팅: 판정 = `fable`):
- `code-reviewer` — 알림 훅 재작성(`src/hooks/useNotifications.ts`, +276줄)이 가장 크다
- `database-reviewer` — 마이그레이션 3건
- `security-reviewer` — 신고 증빙 스토리지 RLS · 로그인 시도 제한 삭제

**특히 볼 곳**
1. `useNotifications.ts` 의 캐시 헬퍼 3종(`getNotificationListCaches` / `removeNotificationFromCaches` / `restoreNotificationToCaches`) — `notificationKeys.all` 하위의 **배열인 캐시 전부**를 패치한다. 앞으로 이 네임스페이스에 "배열이지만 알림 목록이 아닌" 캐시가 추가되면 오염된다.
2. 삭제 Undo 의 언마운트 flush = "화면을 떠나면 삭제 확정". 5초 안에 뒤로가기하면 되돌릴 수 없다(템플릿 삭제와 동일 계약이지만 알림은 하드 DELETE 라 파급이 크다).
3. 토스트 dedupe(같은 message+type 무시) 때문에 **제목이 완전히 같은 알림 2건을 연속 삭제하면 두 번째 Undo 토스트가 안 뜬다**(삭제 자체는 정상).
4. `authCoreService.login()` — 로그인 시도 카운터를 들어내면서 에러 경로(`AUTH_INVALID_CREDENTIALS` / `AUTH_USER_NOT_FOUND` / `AUTH_ACCOUNT_DISABLED`)가 온전한지.
5. `PresetManageSheet` 의 `templates` 가 `useCallback` 의존성에서 매 렌더 바뀐다는 eslint 경고 1건이 남아 있다(에러 아님).

### 과업 B — 로컬 Supabase 로 마이그레이션 3건 검증 (핵심)

```bash
cd C:/Users/user/Desktop/T-HOLDEM-cleanup/uniqn-mobile
npm run db:start      # Docker 스택 기동
npm run db:reset      # 전 마이그레이션 재적용 — 신규 3건 포함
npm run test:db       # helper 주입(jpc/ops) + npx supabase test db
```

> ⚠️ 공유 Docker 스택이라 **다른 병렬 세션이 쓰고 있는지 먼저 확인**할 것(`npm run db:status`).
> ⚠️ `npm run db:start` 부팅 실패는 대개 "prod 만 검증된 마이그 이력" 드리프트 신호다. 메모리 `pitfall_local_supabase_helper_drift` 참조.
> ⚠️ 로컬 `parity_baseline_guard` 의 **함수 수 항목은 원래 red** 일 수 있다(로컬 드리프트, 기존 알려진 상태). prod 기준 기대값은 `186 → 187` 로 이미 갱신해 뒀다(P5 가 +2 한 뒤 우리 신설 함수 +1).

**검증 대상 3건**

| 파일 | 내용 | 신설/재정의 |
|---|---|---|
| `20260802150000_report_evidence_storage.sql` | 증빙 버킷 + `storage.objects` RLS 3종 (본인 폴더만 쓰기 / 열람 = 본인 + `is_admin()`) | 버킷·정책 신설 |
| `20260802160000_notify_on_report_review.sql` | 신고 처리 결과 알림 트리거 | **함수 신설 (파리티 +1)** |
| `20260802160100_job_posting_update_changed_labels.sql` | 공고 변경 알림 본문에 바뀐 항목 한글 라벨 | 기존 함수 **재정의** |

신설 pgTAP: `supabase/tests/report_review_notify.test.sql` · `supabase/tests/job_posting_update_changed_labels.test.sql`

### 🚨 과업 B 에서 정적 검사로 끝내면 안 되는 이유

`notify_on_job_posting_update` 는 본문에 **`EXCEPTION WHEN OTHERS`** 가 있어 실패를 통째로 삼킨다.
07-27 에 이 함수가 `anyarray || anyarray` 오버로드 때문에 **`malformed array literal` 로 항상 실패**하고 있었는데, 예외가 삼켜져서 **prod 에 `job_updated` 알림이 0건 누적된 것을 아무도 몰랐다**. 같은 사고를 재발시키지 않으려면 **파싱 통과가 아니라 실제 발화를 관찰**해야 한다.

**반드시 3분기를 각각 실제 UPDATE 로 발화시켜 눈으로 확인할 것:**

```sql
-- 로컬에서 (job_postings 행 하나를 잡고)
-- ① 수정 분기: 급여만 바꾼다 → body 에 '급여' 라벨이 실제로 들어갔는가
-- ② 수정 분기: 급여 + 근무일 → 라벨 2개, 순서가 중요도순(급여 먼저)인가
-- ③ 취소 분기: status → 'cancelled'
-- ④ 마감 분기: status → 'closed'
-- 각각 직후 SELECT type, title, body, data FROM notifications ORDER BY created_at DESC LIMIT 5;
```
- 알림이 **0건** 나오면 EXCEPTION 이 삼킨 것이다 → 실패다. 통과로 읽지 말 것.
- `data.changedFields` 는 그대로 유지되는지도 확인(기존 계약).
- 신고 알림도 같은 방식: `reports` 1행 INSERT → `status`를 `resolved` / `dismissed` 로 각각 UPDATE → `notifications` 에 `reporter_id` 앞으로 행이 생기는가. **`reporter_id IS NULL` 인 행에서는 안 터지는가**도 확인.

### 완료 기준 (exit proof)
아래를 **이번 세션에서 실행한 출력**으로 제시할 수 있어야 완료다.
1. `npm run db:reset` 성공 (마이그 3건 적용 로그)
2. `npm run test:db` 결과 — 실패 0 (또는 실패가 있으면 그것이 기존 로컬 드리프트임을 base 와 대조해 증명)
3. 위 4분기 각각의 `notifications` 조회 결과 (실제 body 문자열)
4. `notify_on_report_review` 의 `pg_proc.proconfig` 에 `pg_temp` 포함 확인, ACL 에 PUBLIC/anon/authenticated EXECUTE 없음 확인

### 과업 C — 결과 보고 후 사용자 결정
prod 적용 여부는 **사용자가 결정한다.** 임의로 `mcp__supabase__apply_migration` 을 prod 에 실행하지 말 것.
보고에 포함할 것: 관찰된 body 문자열 실물 · 파리티 함수 수 전후 · 스토리지 정책이 로컬에서 실제로 만들어졌는지(권한 없으면 `RAISE WARNING` 으로 skip 되도록 방어돼 있다 — **skip 됐으면 prod 에서도 skip 된다는 뜻이니 반드시 보고**).

---

## 2. 이번 웨이브가 무엇을 했나 (리뷰 배경)

30개 항목을 **원래 의도 추적 → 실제 코드 흐름 → 제거/완성/유지 판정** 했다. 근거 문서 3종이 `docs/analysis/` 에 있다.

| 문서 | 내용 |
|---|---|
| `2026-08-02-employer-seeker-ux-friction-audit.md` | 1차: 구인자·구직자 여정 6축 감사 110건 |
| `2026-08-02-ux-friction-selected-deepdive.md` | 2차: 선별 항목 근본원인·인과사슬·수정설계 |
| `2026-08-02-dead-circuit-triage.md` | 3차: 죽은 회로 30건 의도추적 + 제거/완성/유지 판정 (**이 브랜치의 근거**) |

### 제거 14건 (커밋 `030ba235d`)
북마크 전량(하트 UI 포함) · 알림 스토어 미소비 API · 신고 조회 죽은 절반 · 쿼리키 16종 · `invalidateQueries` 11종 · `reviews.bubbleScore` · **클라이언트 로그인 시도 제한 전체** · 사전질문 死코드 · `IdNormalizer` 합성 ID · `dateUtils` 재수출 심 · `quietHours` · `SETTLEMENT_REQUESTED`

### 완성 9건 (커밋 `b53276e13`)
알림 삭제/전체삭제 낙관갱신 + Undo · 무한스크롤 복구 · 이중 소스 경계 · 프로필 로그아웃 출구 · 프리셋 삭제·이름변경 UI · 신고 증빙 첨부 · 마이그 2건(신고 결과 알림 · 공고 변경 문구)

### 제품 결정 (사용자 확정)
- **'내 신고 내역' 화면 신설안 기각** — 결과 통지는 알림 1건으로 대체
- **신고 사진 첨부는 완성** (원래 제거 후보였음)
- **로그인 5회 잠금은 기능 자체 삭제** (사전 경고 추가가 아니라)
- 북마크 하트 버튼 제거 = 기능 상실이 아니라 **지키지 못할 약속을 하는 어포던스 제거**

---

## 3. 🔴 미해결 — 사용자에게 확인 필요

**Supabase Auth 자체의 로그인 rate limit 이 켜져 있는지 레포로 확인할 수 없다.**
- `supabase/config.toml` `[auth]` 에 rate limit 키가 하나도 없고, `site_url` 이 `localhost:4101` 인 **로컬 개발용**이라 호스팅 프로젝트를 통제하지 않는다.
- DB 의 `check_rate_limit` 계열 RPC 는 **앱 레벨 리미터**이고 anon·authenticated 모두 EXECUTE 회수돼 로그인 경로에서 도달 불가.
- → **Supabase 대시보드 → Authentication → Rate Limits 에서 사람이 직접 확인해야 한다.** 클라 잠금을 지웠으므로 이게 유일한 방어선이다.
- 참고: `AUTH_RATE_LIMITED` 에러 코드는 **살아 있다**(이메일 열거 방지 리미터가 계속 사용). 지우지 말 것.

---

## 4. 이번 세션에서 실증한 함정 (재발 방지)

1. **`jest.setup.js:204` 가 `useQuery`/`useMutation` 을 전역 스텁**한다(항상 `data: undefined`). 실물 QueryClient 를 쓰는 테스트는 반드시 첫 줄에:
   ```ts
   jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));
   ```
   레포에 이미 10여 개 선례가 있다. 안 넣으면 **파일 내 전 케이스가 실패**한다.

2. **"green 이다" ≠ "그 테스트가 결함을 잡는다".** 전체삭제 테스트가 `onSuccess` 의 `invalidateQueries` → refetch 로 목록이 되채워진 **뒤에** 단언해서, 구현이 아무것도 안 해도 통과하는 상태였다. `onMutate` 가 `mutationFn` 보다 먼저 실행되는 성질을 이용해 "서버를 부르는 순간의 렌더 소스"를 붙잡도록 재설계했다. **가드를 제거해 red 를 본 뒤에야 통과로 인정할 것.**

3. **테스트에서 서버 promise 를 붙잡으면 실패 시 jest 가 무한정 매달린다.** 단언이 먼저 실패하면 resolve 가 영영 호출되지 않는다. 캡처 방식(mockImplementation 안에서 상태를 기록)이 안전하다.

4. **`src/lib/` 가 ripgrep 검색에서 조용히 통째로 누락된다.** 레포 루트 `.gitignore` 의 `lib/` 무시 + `!uniqn-mobile/src/lib/` 재포함 부정 패턴을 rg 가 처리하지 못한다. 하필 `queryClient.ts`·`invalidationStrategy.ts` 가 거기 있어 **"이 키는 아무도 안 쓴다"는 정반대 결론**을 낳는다. 경로를 명시 나열하고 **대조군을 함께 검색**해 공허한 0 인지 확인할 것.

5. **알림 타입 개수를 하드코딩한 테스트가 있다**(`NotificationRouteMap.test.ts` 의 `toBe(47)`). 타입을 추가·제거하면 grep 으로는 안 잡히고 jest 에서만 드러난다.

6. **전체 스위트(600+) 병렬 부하에서 `useSchedules.test.ts` 가 expo-crypto 모듈 로딩 경쟁으로 간헐 실패**한다. 단독 실행은 통과. 재실행으로 확인할 것.

7. **`origin/master` 는 착수 몇 분 만에 움직인다.** 이번에도 `75d4b3fe4` → `e960ffed3` 로 PR 5건이 들어왔다. 리뷰·머지 직전 반드시 최신 master 재통합 + 재검증.

---

## 5. 그다음 (이번 세션 범위 밖)

- PR 생성 (사용자 명시 요청 시에만)
- 실기기 QA: 알림 삭제 Undo(토스트가 실제로 보이고 눌리는지) · 프리셋 관리 시트(RN Modal 위 confirmAction) · 신고 사진 첨부 업로드 · 프로필 로그아웃 3면 출구(헤더·하단·안드로이드 물리 백)
- 웹 렌더 확인 (`WebSheetModal` 경로)
- 1차·2차 감사의 **미착수 항목** — 공고 종료시각 부재, 목록 정렬 방향 역전, QR 실패 시 대안 부재, 노쇼 무통보, 지점 미선택 침묵, 근무표 1명·1일 배치 등. `docs/analysis/` 2건 참조.
