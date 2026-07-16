# TV 모니터 프리셋 레이아웃 + 5슬롯 설정 — 설계 (2026-07-17)

> **위치**: ops 전면 개방 S1에 흡수(사용자 확정) — 상위 설계 `docs/planning/2026-07-16-ops-open-access-monetization-design.md`의 S1 C1(브레이크 카운트다운)·C2(TV 보강)를 본 설계로 확대·대체한다. 실행은 `docs/planning/2026-07-16-ops-open-access-s1-implementation-handoff.md`의 **C6** 태스크.
> **벤치마크 근거**: 와홀덤 웹 관리자(스킨·표시 토글·배경 갤러리)와 k-holdem 실물 전광판 사진(좌 5슬롯 · 중앙 클럭 · 우 프라이즈 패널) — 사용자 제공 이미지 분석 세션(2026-07-17).
> **비개발자 요약 아티팩트**: https://claude.ai/code/artifact/23c7da92-065c-4d56-aa3a-de1dd98eed1e (유저플로우·기능 요약) · https://claude.ai/code/artifact/10a1f9bf-37cf-4fa8-985f-60aa8394ad8b (주요 화면 목업)

## 0. 결정 기록 (재론 시 번호로)

| # | 결정 | 내용 | 기각안 |
|---|------|------|--------|
| T1 | 설정 자유도 | 통계 사이드바 **5슬롯만 모듈 지정**, 프라이즈 패널은 고정 구성, 전체 배치는 **프리셋 3종** | 와홀덤식 표시 토글(설정-데이터 불일치), 풀 드래그앤드롭(과잉) |
| T2 | 타이밍 | **S1에 흡수** — C1/C2와 같은 스냅샷 RPC 교체 1회에 편승 | S1 후 별도 슬라이스 |
| T3 | 기본 5슬롯 | `players` · `totalChips` · `avgStack` · `regStatus` · `nextBreak` — **nextBlinds는 기본 제외**(중앙 타이머 아래 상시 표시라 중복, 사용자 확정) | k-holdem 사진 그대로(NEXT BLINDS 포함) |
| T4 | 프라이즈 패널 | PRIZE POOL(대형·골드) + payouts **상위 5** + KO 풀(조건부). **등록 마감 배지는 패널에서 제거** — `regStatus` 슬롯 모듈로 일원화(중복 표시 방지) | 패널 하단 REG 배지(k-holdem 방식) |
| T5 | 저장·전달 | `ops_tournaments.monitor_config` jsonb + 전용 SECDEF 쓰기 RPC + 스냅샷 RPC가 config 반환 | 대회 수정 RPC 파라미터 확장(검증 로직 오염), TV 로컬 설정(복제 불가·리모컨 조작) |
| T6 | 비주얼 스킨 | **범위 제외** — 원형 다이얼·배경 갤러리·개별 업로드·스폰서 브랜딩은 유료 화이트라벨 축 후속(§7) | v1 동시 출하 |

## 1. 레이아웃 프리셋 (3종)

```
[full — 기본]                        [mirror]                  [classic — 현행 유지]
┌────────┬──────────────┬────────┐  full의 좌우 반전            ┌──────────────────┐
│ 슬롯 1  │   대회명·매장   │ PRIZE  │  (프라이즈 좌·슬롯 우)       │    대회명·매장      │
│ 슬롯 2  │  LEVEL 12    │ POOL   │                            │     LEVEL 12      │
│ 슬롯 3  │   12:34      │ 1~5위  │                            │      12:34        │
│ 슬롯 4  │ 1K/2K·앤티 2K │ (KO)   │                            │   1K/2K·앤티 2K    │
│ 슬롯 5  │ 다음·1.5K/3K  │        │                            │ [슬롯1~5 하단 스트립] │
└────────┴──────────────┴────────┘                            └──────────────────┘
```

- 중앙 타이머 = 항상 최대 위계(squint test 1순위). 다음 블라인드는 중앙 하단 상시 표시.
- **반응형**: 좁은 화면(폰 세로)에서는 프리셋 무관 자동 세로 스택 — 타이머 → 슬롯 2열 그리드 → 프라이즈. 프리셋은 가로(TV) 배치만 결정.
- 다크 고정(기존 모니터와 동일 — 저조도 매장·번인 고려).

## 2. 모듈 카탈로그 v1 (서버 추가 비용 0 — 전부 기존+C1 스냅샷 필드)

| id | 표시 예 | 데이터 소스 | 비고 |
|----|---------|------------|------|
| `players` | PLAYERS 23/61 | stats.playing / entries | **기본 ①** |
| `totalChips` | TOTAL CHIPS 2,440,000 | stats.totalChips | **기본 ②** |
| `avgStack` | AVG STACK 106K (53BB) | averageStack + avgStackBb | **기본 ③** |
| `regStatus` | 등록 진행 중 / 마감 | tournament.registrationOpen | **기본 ④** (T3·T4) |
| `nextBreak` | NEXT BREAK 00:42:10 | C1 브레이크 카운트다운 필드 | **기본 ⑤** |
| `nextBlinds` | NEXT BLINDS 1.5K/3K | nextLevel | 타이머 아래 상시 표시 — 크게 보고 싶을 때만 |
| `entries` | ENTRIES 61 · 리엔트리 8 | entries · reentriesTotal | |
| `tables` | TABLES 3 · 좌석 3 여유 | tablesOpen · seatsFree | |
| `prizePool` | PRIZE POOL | stats.prizePool | classic 프리셋용(패널 없음) |
| `koPool` | KO POOL | stats.knockoutPool | 바운티 대회만 |

- 슬롯마다 "비움" 선택 가능. 같은 모듈 중복 선택은 설정 UI에서 비활성.
- **데이터 없는 모듈은 자동 숨김**(빈 카드 금지, 아래 모듈 당김) — koPool 비바운티, nextBreak 브레이크 없는 구조 등.
- **카탈로그 예약(후속)**: `totalTime`(경과 — RPC 계산 필드 추가 필요) · `regCloseCountdown`(레지마감 레벨 컬럼+편집 UI 신설 필요 — S1은 regStatus 배지로 충분) · 커스텀 텍스트/스폰서(유료).

## 3. config 스키마 & 전방 호환

```jsonc
// ops_tournaments.monitor_config (jsonb, NULL 허용)
{ "v": 1, "preset": "full", "slots": ["players", "totalChips", "avgStack", "regStatus", "nextBreak"] }
// preset: "full" | "mirror" | "classic" · slots: (모듈id | null) 정확히 5개
```

- **NULL 컬럼 = 기본값**(full + 기본 5종) — 기존 대회·미설정 대회는 마이그레이션 없이 그대로 동작.
- **전방 호환**: 렌더러는 모르는 모듈 id를 무시(슬롯 숨김), 모르는 preset은 full로 폴백 — 이후 모듈·프리셋 추가가 구버전 클라를 깨지 않는다.
- 중복 id가 저장돼 있으면 첫 항목만 렌더.

## 4. 서버 (신규 마이그레이션 파일만 — 기존 파일 수정 금지)

1. **컬럼**: `ALTER TABLE ops_tournaments ADD COLUMN monitor_config jsonb` (NULL 기본).
2. **쓰기 RPC** `ops_set_monitor_config(p_tournament_id uuid, p_actor uuid, p_config jsonb)`:
   - SECDEF 3규칙(`SET search_path = public,extensions,pg_temp` · anon/PUBLIC EXECUTE REVOKE 후 authenticated GRANT · NULL 가드 `IS DISTINCT FROM`)
   - actor 바인딩(auth.uid() 위조 차단) + **owner 전용**(스태프 쓰기 분리는 F3 후속과 동축)
   - 서버측 화이트리스트 검증: preset enum · slots 배열 길이 5 · id enum — 위반 시 P0001(`mapOpsRpcError` 매핑)
   - **anon-executable SECDEF =2 불변 계약 유지**(monitor/player만) — 카탈로그 카운트 pgTAP 재확인
3. **읽기**: `ops_get_monitor_snapshot` CREATE OR REPLACE(**C1과 같은 신규 마이그 1개**에서) — `monitorConfig` · `payouts[]`(상위 5: position·amount) · 브레이크 카운트다운 필드 동시 추가. 비-PII 화이트리스트 유지(config는 비-PII).
4. **d4 복제 연동**: 대회 복제 RPC에 `monitor_config` 복사 포함(A4 스펙에 1줄).

## 5. 클라이언트

- **모듈 레지스트리** `src/components/ops/monitor/registry.ts`(신규): id → { 라벨, 스냅샷 셀렉터, 포맷터, 가용성 판정 }. 렌더는 레지스트리 순회만.
- **monitor/[token].tsx 개편**: 프리셋 분기(full/mirror/classic) + 슬롯 컬럼 + 프라이즈 패널 + 반응형 세로 스택. 기존 4s 폴링·서버시각 offset 보정 그대로.
- **설정 UI**: ops 대회 화면에 "TV 모니터 구성" — 프리셋 3택 세그먼트(미니 다이어그램) + 슬롯 5개 SelectBottomSheet(기존 컴포넌트) + 저장. 저장 토스트 "TV에 곧 반영돼요"(4s 폴링 내 자동 반영, 별도 푸시 없음). 진행 중 대회에서도 변경 가능.
- 디자인 게이트: 다크 고정 · 골드는 상금 금액·PRIZE POOL만(60-30-10) · 타이머 위계 최상위 · 금액 truncation 금지.

## 6. 테스트 (S1 검증 게이트에 합류)

- **pgTAP**: `ops_set_monitor_config` 권한(REVOKE 단언 · 비-owner P0001 · actor 위조) red-green 실측, 화이트리스트 거부(잘못된 preset/slots), 스냅샷 신필드 반환, anon-executable =2 카운트.
- **Jest**: 레지스트리 매핑 전수 · 프리셋 분기 렌더 · config NULL 기본값 · 미지 id 무시 · 데이터 없는 모듈 자동 숨김 · 중복 id 첫 항목만.
- **렌더 관찰**: 실브라우저 가로(TV)/세로(폰) 각 1회 — 브레이크 카운트다운이 클럭과 어긋나지 않는지(fablize 그라운딩).

## 7. 범위 제외 · 후속 로드맵

| 단계 | 내용 |
|------|------|
| P2(무료 후속) | `totalTime` 모듈 · `regCloseCountdown`(레지마감 레벨 정의 필요) |
| 유료 화이트라벨 축 | 제공 배경 갤러리 → 개별 배경/로고 업로드(Storage + 공개 TV 노출이라 부적절 콘텐츠 검토 장치 동반) → 스폰서 브랜딩·사진 QR · 원형 다이얼 등 스킨 |

배경 업로드는 기술적으로 단순(Storage+config 참조)하나 악용 방어(F2)와 같은 축이므로 별도 슬라이스로 분리한다.
