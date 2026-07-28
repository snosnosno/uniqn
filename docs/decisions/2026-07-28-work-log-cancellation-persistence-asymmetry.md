# ADR: work_logs 취소 경로 2종의 영속 의미론 비대칭 — 유지하되 리더에 status 술어를 강제한다

- 날짜: 2026-07-28
- 상태: 수용(Accepted)
- 관련: 마이그 `20260727112025`(#357 소프트 취소), `20260728185802`(본 결정의 후속 봉합)

## 배경

work_logs 배정을 끊는 경로가 둘인데, **영속 의미론이 서로 다르다.**

| 경로 | RPC | 처리 | 최신 정의 |
|---|---|---|---|
| 직접 배치 인원 빼기 | `remove_direct_staff` | **소프트 취소** (`status='cancelled'`, 행 잔존) | `20260727120000` |
| 확정 지원 취소 | `cancel_application_atomically` | **하드 DELETE** (`status='scheduled'` 행 삭제) | `20260727150000` |

#357 이전에는 둘 다 하드 DELETE 였다. 그래서 "행이 있다 == 지금 배치돼 있다"가 성립했고,
이 전제에 기대어 status 술어 없이 work_logs 를 읽는 코드가 정당했다.

#357 이 한쪽만 소프트로 바꾸면서 그 전제가 조용히 깨졌다. 실제로 `get_my_venue_role_salaries`
가 이 전제 위에 서 있었고, 근무표에서 빠진 스태프가 지점 단가표를 계속 조회하는 결함이 됐다
(prod 라이브였으나 실측 유출 0건 — 아직 컨테이너에서 소프트 취소된 스태프가 없었다).

## 결정

**비대칭을 지금 없애지 않는다.** 대신 **모든 리더가 status 술어를 명시하도록 강제한다.**

### 왜 통일하지 않는가

`cancel_application_atomically` 를 소프트 취소로 바꾸는 건 한 줄 교체가 아니다. 최소한:

- `fn_sync_filled_positions_seat` 의 DELETE 분기와 `UPDATE OF status` 분기가 좌석 델타를
  이중 계산하지 않는지 재검증해야 한다.
- `notify_on_work_log_update` Case1 이 지원 취소에도 `schedule_cancelled` 알림을 새로 쏘게 된다
  (지금은 지원 취소 알림이 별도 경로).
- 재지원 시 `DUPLICATE_ASSIGNMENT` 판정 대상이 바뀐다.
- 정산(JIT)·리뷰 리마인더가 취소 잔존 행을 어떻게 볼지 각각 결정해야 한다.

즉 이건 정리(cleanup)가 아니라 설계 변경이다. 반대로 **리더에 술어를 강제하는 쪽은
어느 의미론에서도 정답이므로**, 비대칭이 남아 있어도 안전하다.

### 강제 규칙

> work_logs 를 "현재 배치"의 근거로 읽는 모든 SQL 은
> `status NOT IN ('cancelled','no_show')` 를 **명시**한다.
> 행의 존재만으로 배치를 판정하지 않는다.

## 감사 결과 (2026-07-28, prod `pg_proc` 실측)

`prosrc` 가 `work_logs` 를 참조하는 public 함수 중 `no_show` 배제가 없는 7건을 전수 확인했다.

| 함수 | 판정 |
|---|---|
| `get_my_venue_role_salaries` | ❌ **결함** — 본 PR 마이그 `20260728185802` 로 봉합 |
| `fn_send_review_reminders` | ✅ 안전 — `check_out_ts IS NOT NULL` 로 걸러진다. `remove_direct_staff` 가 `checked_in/checked_out/completed` 행의 취소를 거부하므로 소프트 취소 행에는 `check_out_ts` 가 없다 |
| `list_all_work_logs` | ✅ 의도 — 관리자 전수 조회, 취소 행 포함이 목적 |
| `cancel_application_atomically` | ✅ 라이터(취소를 만드는 쪽) |
| `permanently_delete_user` | ✅ 삭제 경로, 전수 대상이 맞다 |
| `fn_work_logs_pin_posting_id` | ✅ 컬럼 고정 트리거, 집합 판정 아님 |
| `sync_schedule_board` | ✅ 자체 `cancelled` 처리 보유 |

형제 리더 `get_venue_day_slots` / `get_venue_grid_summary` 는 #357 당시 이미 술어를 갖고 있었다.
`add_direct_staff` 의 중복·정원 판정도 마찬가지다.

## 결과

- 새 SQL 이 work_logs 를 배치 근거로 읽으면 위 규칙을 적용한다. 리뷰에서 이 술어의
  **부재**를 지적 대상으로 삼는다.
- 회귀 가드: `supabase/tests/my_venue_role_salaries.test.sql` — 소프트 취소 후 0건을 단언하고,
  같은 컨테이너에 활성 배정이 남으면 계속 읽히는 것(과잉 차단 방지)까지 함께 고정한다.
- 비대칭 해소는 별도 설계건으로 남긴다. 착수하려면 위 "왜 통일하지 않는가" 4항목이 선행 조사 목록이다.
