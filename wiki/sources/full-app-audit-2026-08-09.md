---
area: sources
updated: 2026-08-10
status: current
sources:
  - docs/analysis/2026-08-09-full-app-audit-2rounds.md
  - docs/planning/2026-08-09-audit-followup-session-prompts.md
  - uniqn-mobile/src/repositories/supabase/ConfirmedStaffRepository.ts
  - uniqn-mobile/scripts/verify-web-build.js
  - PR#458
  - PR#459
  - PR#460
  - PR#461
tags: [audit, security, performance, data-integrity, launch, methodology]
---

# 소스: 전방위 감사 2라운드 — 확정 60건 (2026-08-09)

**규모**: 에이전트 41개 · 툴 1,391회 · 1,773 파일 / 320,878 LOC / 마이그 103개
**결과**: 확정 **60건**(HIGH 7 · MED 22 · LOW 31) · **반증 3건** · 미확인 0건

## 결론 — 건강하지만, 지금이 가장 싼 시점이다

prod 실측이 근거다: `work_logs` **6행** · `applications` **6건** · `auth.users` **27명** ·
storage 객체 **11개**. **아직 실사용 전**이라, 60건 중 "지금 사용자가 피해를 입고 있다"는
**0건**이고 전부 "런칭하면 피해가 시작된다"이다. 지금 고치면 데이터 마이그레이션·사고 대응·
사용자 공지가 전부 불필요하고, 런칭 후엔 셋 다 붙는다.

건강함도 실측이다 — `console.log` 0 · `@ts-ignore` 0 · `Alert.alert` 직접호출 0 ·
상대경로 `../../../` 0 · knip 미사용 파일 0 · SECDEF `search_path` 미고정 0 · 파리티 208/111 일치.

> 🔑 **약점이 하나의 패턴으로 수렴한다** — 규약이 **"웨이브" 단위로 소급 적용되고, 웨이브가
> 지나간 뒤의 신규 코드와 웨이브 범위 밖 도메인에는 자동 전파되지 않는다.**
> HIGH 7건 중 **5건**이 정확히 이 패턴이다. (실증: ops 오프라인 가드 0건 = [[ops-defect7-wave-2026-08]],
> 정산 도메인에 살아남은 FOREACH 푸시 루프, `repositories/` 타임아웃 0건)

## 착지 현황 (2026-08-10 실측, `git log` 대조)

감사 다음 날 4개 세션이 돌아 **S0 전량 + S1 첫 항목**이 닫혔다. 아래 표가 이 페이지의
"발견" 서술보다 **우선하는 현재 상태**다.

| 세션 | PR | 닫힌 감사 id |
|---|---|---|
| S0 서버 | **#458** `d52c4cf44` | sec-01(chat 버킷 owner-scope) · sec-02(temp MIME) · cost-01~05 |
| S0 웹 | **#459** `b8491c9ce` | monitor-01(폴링 영구정지) · web-01(`lang`) · web-02(wakeLock) · web-03(번들 마커) · ui-01 |
| 알림·정산 | **#460** `fd6984266` | push-01(FOREACH→배치) · push-02(receipts 폴링 EF 신설) · push-04 |
| S1 첫 항목 | **#461** `4a57e7d73` | **skew-F1**(버전 게이트 배선) |

🔴 **미착수**: data-01(서버 절반 + 클라 전환) · testgap-01(계측 3종) · auth-F1/F2/F3 ·
realtime-01/02/05 · err-01/03 · dep-01/02 · S2·S3 전량. `app_config` 버전값 갱신도 미완.

> 🚨 **원장 공백 발견**: 세션4 는 data-01 의 **서버 절반**(`update_work_log_slot` status-only
> patch 확장)을 전제하는데 세션1 대상 목록에 그게 없었다. 감사 §3 S0-서버 표에는 있다 —
> **원장으로 옮겨 적을 때 항목이 샜다.** 다음 세션이 서버부터 해야 한다.

## 대표 발견

- **버전 게이트 3계층 사망** — 별도 페이지: [[deploy-channel-skew]] (감사 최대 발견, ✅#461 배선)
- **data-01 4번째 Lost Update** — `ConfirmedStaffRepository.ts:336-360`(역할)·`:566-578`(상태)에
  클라 read-modify-write 가 남아 있다. **같은 파일 `:370-374` 주석이 형제 경로는 이미 RPC 로
  전환됐다고 자백**한다([[settlement-history-lost-update]] 의 4번째 형제).
- **err-01 문구 정정** — "무타임아웃"은 부정확하다. `utils/timeout.ts:25` 정의는 있고
  `services/auth/` 3서비스에 배선돼 있다. 정확히는 **데이터 평면(`repositories/`) 0건**이다.
- **web-03** — 21시간 웹 다운 사고의 재발방지 장치인 `verify-web-build.js` 의 마커가
  `(app)`/`(auth)` **2종뿐**이라 6 라우트그룹 중 4종에 장님이다.
- **monitor-01** — 공개 모니터 폴링이 **1회 실패 = 영구 정지** + 네트워크 오류를 "무효 링크"로 오탐.

## 반증 3건 — 그대로 받았으면 퇴행이었다

1. **venue-settlements FlatList → FlashList 금지** — CLAUDE.md 가 소형 리스트의 FlatList 를 **명시 허용**.
2. **`setProfile` 3곳을 `refreshProfile` 로 교체 금지** — CLAUDE.md 조항은 Supabase Auth 직접 호출
   제한이지 Zustand setter 제한이 아니다. 교체하면 매 토글마다 `refreshSession` 왕복.
3. **`board_posts.comment_count` "레이스 수정" 금지** — `tr_board_comment_count_sync` 트리거가 이미
   원자 증감하고, RLS 때문에 클라 쓰기는 대부분 무음 no-op. 허용되는 건 **죽은 클라 코드 제거뿐**.

> 🔑 3건 중 2건이 **"규약이 명시 허용한 패턴을 결함으로 고치는"** 유형이었다.
> 적대적 검증 단계가 없었으면 전부 작업 목록에 들어갔다.

원장에는 이 외에도 "하지 말 것" **15건**이 근거와 함께 있다(죽은 코드로 보이지만 의도적 보존인
`detectSlotConflicts` · 읽기 폴링에 INSERT 가드 이식 금지 · 모니터를 Realtime 으로 전환 금지 등).

## 착지가 가르쳐준 것 (감사가 몰랐던 3건)

수정을 실제로 해 보니 **감사의 처방 자체가 틀린 것**이 나왔다. 발견보다 이쪽이 재사용 가치가 크다.

- 🚨 **`storage.objects` 는 `CREATE POLICY` 만 된다** — prod `postgres` 는 `rolsuper=f` 이고
  `supabase_storage_admin` 롤도 아니라 **DROP/ALTER/`COMMENT ON POLICY` 가 전부 42501** 이다
  (COMMENT 금지는 CI DB Tests 가 잡았다). 그래서 sec-01 봉합은 **RESTRICTIVE 정책 추가**
  (AND 결합)가 유일한 길이었다. 🔑 **로컬 psql 은 `DROP POLICY` 가 통과한다 — 로컬 통과 ≠
  CI/prod 통과.** 술어에 `<>` 를 쓰면 NULL 행에서 RESTRICTIVE 가 차단해버리는 것도 같이 조심.
  되돌리기도 같은 이유로 SQL 로는 불가하고, 버킷 삭제는 `storage.protect_delete()` 트리거가 막는다.
- 🔑 **web `lang` 은 `app/+html.tsx` 가 아니라 `app.config.ts` 의 `web.lang`** — 감사 처방(web-01)이
  틀렸다. `web.output` 미설정 = SPA 라 **`+html.tsx` 가 통째로 무시된다**(실측: 둬도 `lang="en"`).
  SPA 는 `@expo/cli` 템플릿의 `%LANG_ISO_CODE%` ← `exp.web.lang` 을 쓴다(`app.config.ts:297`).
  `public/index.html` 신설 금지는 여전히 유효하다(템플릿보다 먼저 집힌다).
- 🔑 **`document?.x` 는 미선언 식별자를 못 막는다** — 옵셔널 체이닝은 nullish 만 막고 **바인딩
  부재는 `ReferenceError`** 다. RN 네이티브·jest node 환경엔 `document` 가 없다 →
  `typeof` 가드로 지역변수에 담아라(web-02 wakeLock 배선에서 실증).

## 부재증명을 어디까지 믿을 수 있나

- **신뢰**: 파괴적 DDL 부재(마이그 7개 전문 열람 — 단 **시점 한정 증명**, 새 마이그가 추가되면 무효) ·
  realtime 배선 갭(검증 중 11→**19곳**으로 확장 정정) · jsonb Lost Update 46컬럼 전수(한계 자진 선언) ·
  TanStack 캐시 크로스유저 누출 없음.
- **중간**: 푸시 중복 트리거 없음(91개 사람 눈 대조 — **재현 명령이 없다**) ·
  네이티브 API 웹 크래시 없음 — 검증 중 **Grep 브레이스 글롭 공허 매칭**(`{src,app}/**` 이 0파일)이
  이 환경에 실재함이 드러났다. **"Grep 0건" 형태의 다른 부재증명도 같은 함정을 밟았을 수 있다.**
- **미확인**: `functions/`·`supabase/functions/`(eslint ignores 사각과 겹친다) ·
  **Supabase 콘솔 설정 전반** — Auth Rate Limits(브루트포스 방어선이 0일 수 있다)·세션 모드·
  인프라 rate limit. **레포로 증명 불가 — 사람이 콘솔에서 볼 일.**

## 아직 못 본 곳

`functions/` 2종 전체 · **테이블 RLS 정책 의미론 재감사**(#241 이후 마이그 수십 개가 쌓였는데
파리티 가드는 함수 "개수"만 본다) · 스토어 심사 표면 · 접근성 · 성능 실측(콜드스타트·번들·저사양 Android).

## 감사 방법론 (재현용)

- **`UNVERIFIABLE` 을 `REFUTED` 와 분리**한 것이 핵심. 과거 이 프로젝트는 한도로 죽은 에이전트의
  `verdict=null` 을 "기각"으로 오분류한 사고 이력이 있다.
- **부재증명을 산출물로 강제**한 것이 46개 jsonb 컬럼 전수 스캔을 끌어냈다. "없다"를 안 믿으려면
  **스캔 범위를 자산으로 요구**해야 한다.
- 🚨 **실패 사례**: JSON Schema 에 한글 property key(`부재증명`)를 넣어 **7/8 에이전트가 400 즉사**
  (`^[a-zA-Z0-9_.-]{1,64}$`). **스키마 키는 ASCII, 한글은 후처리·enum 값에만.**

## 연결

- 최대 발견의 별도 페이지: [[deploy-channel-skew]]
- 이 감사 직전 웨이브: [[ops-defect7-wave-2026-08]] · [[post-1-0-5-merge-wave]]
- Lost Update 계보: [[settlement-history-lost-update]] · [[supabase-write-pitfalls]]
- 계측 부재가 막고 있는 게이트: [[rollout-instrumentation-gap]]
- 파리티 가드가 세는 것과 안 세는 것: [[prod-parity-baseline]]
- 배포·CI 게이트 계보(web-03 이 속한 축): [[e2e-gate-absence]]
