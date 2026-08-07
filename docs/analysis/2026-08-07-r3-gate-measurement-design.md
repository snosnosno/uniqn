# R3 착수 게이트 측정 설계 — "센티널 신규 기록률" 을 어떻게 잴 것인가 (2026-08-07)

> 시간 모델 재설계(`2026-08-03-time-model-redesign.md`) **§표 R3 행**의 선행 조건은
> *"R2 + 센티널 신규 기록률 실측 0 근접(서버 카운트 쿼리로 게이트 측정)"* 인데,
> **그 카운트 쿼리가 설계문서에 없다.** 이 문서가 그것을 정의한다.

## 결론 먼저

**단일 지표(`work_logs.time_slot` 신규 센티널 수)로는 이 게이트를 판정할 수 없다.** 분모가 30일에 6건이라,
0 이 나와도 "센티널을 안 쓴다"인지 "아무것도 안 썼다"인지 구분되지 않는다.

대신 **두 축을 겹쳐서** 판정한다.

1. **구조 논거(강함)** — 상류 생산자인 `job_postings.schedule` 의 시간 슬롯은 **전 기간 112건 전수 정본,
   센티널 0건**이다(2026-08-07 prod 실측). 즉 **공고 작성 경로는 센티널을 애초에 낳은 적이 없다.**
   센티널은 여기서 태어나 `confirm_application` 을 타고 내려가므로, 상류가 마르면 하류는 정의상 마른다.
2. **코호트 논거(약하지만 필요)** — R0 이후 실제로 쓰인 표본에서 0 인가.

게이트 = **상류 0 + 하류 모순 없음 + 분모 자체가 0 이 아님.**

> ⚠️ **초안의 오판을 실측이 잡았다.** 처음엔 "상류 112건이므로 이미 충족"이라고 썼는데,
> R0 코호트(`created_at > 2026-08-03`)로 자르면 상류 표본은 **112 가 아니라 3** 이다.
> 112 는 코호트 무관 전체값이었다. **분모를 코호트로 자르기 전에 임계값을 정하면 안 된다** —
> 이 문서의 임계값은 실측 후 다시 매긴 것이다(§3-1).

---

## 1. 왜 순진한 쿼리가 실패하는가

```sql
-- ❌ 이렇게 재면 안 된다
SELECT count(*) FROM work_logs
WHERE created_at > now() - interval '30 days'
  AND (time_slot = '' OR time_slot IN ('미정','NEGOTIABLE'));
-- → 0
```

이 `0` 은 게이트 통과의 증거가 **아니다.** 같은 기간 `work_logs` 신규가 **6건**뿐이라,
센티널을 쓰는 코드 경로가 30일 동안 **한 번도 실행되지 않았어도** 0 이 나온다.

> 🔑 이건 이 레포에서 이미 한 번 값을 치른 오독이다 — 탈퇴 감사가 `users.status='deactivated'` **0건**을
> "피해자 없음"으로 읽었는데 실제로는 **"탈퇴가 불가능해서 0건"** 이었다(#427).
> **0 을 보면 분자가 아니라 분모부터 확인하라.**

## 2. prod 실측 (2026-08-07)

### 2-1. 하류 — `work_logs.time_slot`

| 형태 | 행 수 | 최초 | 최종 |
|---|---|---|---|
| `HH:mm` (정본) | 3 | 2026-07-30 | 2026-08-06 |
| **sentinel: 범위/기타** | **2** | 2026-07-24 | **2026-07-24** |
| `NULL` (정본) | 1 | 2026-08-06 | 2026-08-06 |

전체 6건 = **전부 최근 30일 내**. 즉 이 테이블에는 "옛 코호트"가 없다.
**마지막 센티널 기록이 2026-07-24 이고, R0 prod 적용(2026-08-03) 이후 기록은 전부 정본이다.**
방향은 맞지만 **n=3 이라 통계적 무게가 없다.**

### 2-2. 상류 — `job_postings.schedule` 의 시간 슬롯

코호트를 어떻게 자르느냐로 분모가 크게 달라진다. **셋 다 실측했다.**

| 코호트 | 슬롯 수 | 센티널 |
|---|---|---|
| `created_at > R0` (신규 생성 공고만) | **3** | **0** |
| `updated_at > R0` (편집분 포함) | **9** | **0** |
| 코호트 무관 전체 | **112** | **0** |

🔑 **전 기간 112건에 센티널이 0 이다.** 공고 작성 경로는 센티널을 **한 번도 낳은 적이 없다.**
그렇다면 `work_logs` 의 센티널 2건(2026-07-24)은 이 경로가 아니라 **다른 출처**(구 직접 쓰기 경로 또는 시드)에서 왔다.
→ R3 착수 판정에서 상류는 **구조 논거**로 쓰고, 통계적 분모는 하류 능동 실행(§4-2)으로 만든다.

🔑 **코호트 술어는 `updated_at` 을 쓴다.** `created_at` 만 보면 **R0 이후의 공고 편집**이 통째로 빠진다
(3 vs 9). 게이트가 재려는 것은 "새로 만들어진 공고"가 아니라 **"R0 이후 일어난 쓰기"** 다.

---

## 3. 게이트 측정 쿼리 (정본)

`R0_APPLIED_AT` = R0 prod 적용 시각. prod 기록명 `20260803025714`(레포 `20260803120000`).
아래 쿼리는 그 시각을 코호트 경계로 쓴다.

```sql
-- ============================================================
-- R3 착수 게이트 측정 — 센티널 신규 기록률
--   판정: PASS / FAIL / UNMEASURED  (UNMEASURED 는 통과가 아니다)
-- ============================================================
WITH params AS (
  -- R0 prod 적용 시각(= 서버 정규화가 켜진 시점). 코호트 경계.
  SELECT timestamptz '2026-08-03 02:57:14+00' AS r0_at
),

-- ── 상류: 공고 스케줄의 시간 슬롯 (분모가 큰 축) ──────────────
upstream AS (
  SELECT
    -- 🔑 created_at 이 아니라 updated_at. R0 이후의 **공고 편집**도 쓰기다(실측 3 vs 9).
    (jp.updated_at > p.r0_at)                                    AS post_r0,
    NOT (
      ts->>'startTime' IS NULL
      OR ts->>'startTime' ~ '^[0-9]{2}:[0-9]{2}$'
    )                                                            AS is_sentinel
  FROM params p
  CROSS JOIN public.job_postings jp
  CROSS JOIN LATERAL jsonb_array_elements(
       COALESCE(jp.schedule->'requirements','[]'::jsonb)) req
  CROSS JOIN LATERAL jsonb_array_elements(
       COALESCE(req->'timeSlots','[]'::jsonb)) ts
),

-- ── 하류: work_logs.time_slot (게이트의 실제 대상) ────────────
downstream AS (
  SELECT
    (wl.created_at > p.r0_at)                                    AS post_r0,
    NOT (
      wl.time_slot IS NULL
      OR wl.time_slot ~ '^[0-9]{2}:[0-9]{2}$'
    )                                                            AS is_sentinel
  FROM params p
  CROSS JOIN public.work_logs wl
),

agg AS (
  SELECT
    (SELECT count(*) FROM upstream   WHERE post_r0)                       AS up_total,
    (SELECT count(*) FROM upstream   WHERE post_r0 AND is_sentinel)       AS up_sentinel,
    (SELECT count(*) FROM downstream WHERE post_r0)                       AS down_total,
    (SELECT count(*) FROM downstream WHERE post_r0 AND is_sentinel)       AS down_sentinel
)
SELECT
  up_total, up_sentinel, down_total, down_sentinel,
  CASE
    -- 🔴 분모 게이트가 먼저다. 표본이 없으면 "통과"가 아니라 "측정 안 됨"이다.
    WHEN up_sentinel > 0 OR down_sentinel > 0 THEN 'FAIL: 센티널 신규 기록 존재'
    WHEN up_total   < 10                      THEN 'UNMEASURED: 상류 표본 부족 (필요 10+)'
    WHEN down_total < 3                       THEN 'UNMEASURED: 하류 표본 부족 (필요 3+ — 세 경로 각 1회)'
    ELSE 'PASS'
  END AS verdict
FROM agg;
```

> FAIL 판정을 분모 검사보다 **먼저** 둔 것은 의도적이다. 표본이 적어도 **센티널이 실제로 보이면
> 그건 이미 결론**이다 — 분모 부족을 이유로 FAIL 을 UNMEASURED 로 덮으면 안 된다.

### 임계값 근거 (2026-08-07 실측 후 재산정)

| 항목 | 값 | 왜 |
|---|---|---|
| 상류 최소 표본 | **10** | 실측 `updated_at > R0` = **9**. 초안의 50 은 코호트 무관 값(112)을 보고 정한 것이라 **도달 불가**였다. 10 은 "곧 닿되 지금은 아닌" 값 — 공고 1건만 더 편집되면 넘는다 |
| 하류 최소 표본 | **3** | `work_logs` 생성 경로가 정확히 셋(`confirm_application`·`add_direct_staff`·QR 체크인)이다. **경로당 1회**를 요구해 "한 경로만 밟고 통과"를 막는다. 통계가 아니라 **경로 커버리지** 기준이다 |
| 허용 센티널 | **0** | "근접"이 아니라 **0**. 1건이라도 있으면 R3 백필 후 다시 태어난다 |

### 2026-08-07 시점 실행 결과

```
up_total=9  up_sentinel=0  down_total=3  down_sentinel=0
verdict = UNMEASURED: 하류 표본 부족 (필요 3+ ...)   ← created_at 기준일 때 up_total=3
```

> 위 수치는 `updated_at` 코호트 기준이다. **아직 PASS 가 아니다** — 하류 3경로 커버리지를 §4-2 로 채워야 한다.
> 방향은 좋다: 어느 코호트로 잘라도 **센티널 신규 0**.

---

## 4. 저트래픽에서 게이트를 채우는 방법

prod 트래픽이 작다(`users 27` · `work_logs 6` · 30일 지원 6건). **기다려서 로그가 쌓이길 기대하는 방식은 성립하지 않는다.**
아래 셋을 병행한다.

### 4-1. 상류는 **구조 논거**로 쓴다 (통계 논거로 쓰지 말 것)

전 기간 112 슬롯 중 센티널 **0** — 공고 작성 경로는 센티널을 낳은 적이 없다.
다만 **R0 코호트로 자르면 9건뿐**이라 이것만으로 "충족"이라 부를 수 없다.
상류는 "발생원이 말라 있다"는 **구조적 근거**로 쓰고, 판정 표본은 §4-2 로 만든다.

### 4-2. 하류 경로를 능동적으로 밟는다 (대기 대신 실행)

`work_logs` 를 만드는 경로는 셋뿐이다 — `confirm_application`(지원 확정) · `add_direct_staff`(직접 추가) ·
QR 체크인. 실기기 QA(`docs/qa/2026-08-07-device-qa-checklist.md`) 때 **세 경로를 각 1회씩 실제로 밟고**
그 직후 위 쿼리를 돌린다. 그러면 `down_total >= 3` 이 되어 UNMEASURED 를 벗어난다.

> 🔑 이게 "기다리기"보다 나은 이유: 30일을 기다려도 표본이 6건이다. **한 시간 안에 3건을 직접 만드는 편이 빠르고 결정적이다.**

### 4-3. n=1 도 놓치지 않는 관측 트리거 (선택 — 확신이 더 필요할 때)

표본이 작을수록 "언제 한 번 들어왔는지"가 중요해진다. 카운트 쿼리는 **지금 남아 있는 행**만 보므로,
들어왔다가 수정된 센티널은 잡지 못한다. 그럴 땐 차단이 아니라 **관측만 하는** 트리거를 R3 직전에 잠시 켠다.

```sql
-- 선례: 20260803120000:211 의 RAISE LOG 관측 패턴
CREATE OR REPLACE FUNCTION public.observe_worklog_sentinel_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.time_slot IS NOT NULL
     AND NEW.time_slot !~ '^[0-9]{2}:[0-9]{2}$' THEN
    RAISE LOG 'R3_GATE sentinel write: work_log=% time_slot=% by=%',
      NEW.id, NEW.time_slot, current_user;
  END IF;
  RETURN NEW;
END $$;
```

- **차단하지 않는다** — `RAISE LOG` 뿐이다. 게이트 측정용이라 오탐이 사용자를 막으면 안 된다.
- 확인은 `mcp__supabase__get_logs` 또는 대시보드 Postgres 로그에서 `R3_GATE` 로 검색.
- **R3 마이그레이션에서 반드시 DROP 한다.** 남기면 파리티 함수 수가 +1 되어 `parity-smoke` 가 빨개진다.

---

## 5. 게이트 판정 절차 (실행 순서)

1. **실기기 QA 중** `confirm_application` · `add_direct_staff` · QR 체크인을 각 1회 실행 (4-2)
2. §3 쿼리 실행
3. `verdict` 로 판정:
   - `PASS` → R3 착수 가능
   - `FAIL` → 센티널을 낳은 경로를 먼저 찾는다. `up_sentinel>0` 이면 공고 작성, `down_sentinel>0` 이면 확정/체크인 경로
   - `UNMEASURED` → **통과가 아니다.** 부족한 쪽 표본을 만들고 다시 잰다
4. 판정 결과(수치 포함)를 R3 PR 본문에 그대로 붙인다 — "게이트 통과함" 이 아니라 `up_total=N / up_sentinel=0 / down_total=M / down_sentinel=0`

---

## 6. 이 설계가 **다루지 않는** 것

| 항목 | 왜 제외했나 |
|---|---|
| `applications.assignments` jsonb 의 센티널 | R0 ③ 이 INSERT 시점에 흡수하도록 설계돼 **백필을 하지 않기로** 이미 결정됐다(재설계 문서 §78·§95). 게이트 대상이 아니다 |
| 구 코호트(R0 이전) 잔존 센티널 | R3 **백필의 대상**이지 착수 게이트의 대상이 아니다. 게이트는 "새로 안 생기는가"만 본다. 현재 잔존 = `work_logs` 2건(2026-07-24) |
| 채택률 기반 판정 | 계기판이 없다 — `expo-insights` 미설치 · Sentry `release`/`dist` 미태깅 · 앱 버전 서버 기록 0건. **이 게이트를 채택률로 대체하려는 시도는 하지 말 것** |

---

## 부록. 현황 재확인용 한 줄 쿼리

```sql
SELECT time_slot, count(*), max(created_at)::date AS last_seen
FROM public.work_logs
WHERE time_slot IS NOT NULL AND time_slot !~ '^[0-9]{2}:[0-9]{2}$'
GROUP BY 1 ORDER BY 2 DESC;
-- 2026-08-07 실측: 범위형 2건, 최종 2026-07-24
```
