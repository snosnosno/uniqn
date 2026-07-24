# ops 블라인드 기본 구조(1~30) + 프리셋 저장 — 설계 (2026-07-23)

> **범위**: 블라인드 탭에 ① 대회 생성 시 **기본 1~30 레벨 자동 시드** ② **프리셋 저장·불러오기**(내 계정 전용) ③ 자유 편집·저장/수정. 신규 스키마 포함 → 착수 전 `/guard` + 마이그레이션.
> **동반 spec**: 탭/레이아웃 재배치는 별도 — `2026-07-23-ops-console-layout-redesign-design.md`. 본 spec은 블라인드 탭 **내부 기능**만.
> **비개발자 요약 아티팩트**: https://claude.ai/code/artifact/3b2a9451-e6cf-4e18-8989-c0c7779d3720 (④ 블라인드 탭 · §05 프리셋 시트)
> **근거**: 기존 `ops_set_blind_levels`(전체교체 SECDEF)·`BlindLevelsTab`(로컬 draft 편집)·`OpsBlindLevel` 타입 실측. UI 프리셋 참고 = `src/components/employer/order-sheet/PresetCarousel.tsx`.

## 0. 결정 기록 (재론 시 번호로)

| # | 결정 | 내용 | 기각안 |
|---|------|------|--------|
| B1 | 기본값 확정 | LV 1~30, **ante = BB**, 20분/레벨, 브레이크 없음 (아래 §2 표 — 사용자 확정) | 브레이크 포함·다른 상승곡선 |
| B2 | 시드 시점 | 대회 생성 시 자동으로 기본 30레벨 주입 | 빈 상태 후 수동 |
| B3 | 프리셋 범위 | **내 계정 전용**(owner_id 스코프) — 내가 여는 모든 대회에서 재사용 | 워크스페이스 공유(RLS 복잡), 앱 고정 프리셋만(커스텀 불가) |
| B4 | 프리셋 종류 | 앱 기본 제공(기본30 등) **+** 사용자 저장 커스텀을 한 목록에 | 사용자 저장만 |
| B5 | 적용 방식 | 프리셋 적용 = 현재 구조 **전체 교체**(확인 필요 — 되돌리기 어려움) | 병합/추가 |
| B6 | 저장 경로 | 기존 `ops_set_blind_levels`(전체교체) 재사용, 프리셋은 **신규 테이블+RPC** 분리 | 블라인드 RPC 확장(계약 오염) |
| B7 | 편집 자유도 | 레벨별 SB/BB/ante/시간 편집·추가·삭제·브레이크 삽입 전부 가능(현행 draft 흐름 유지) | 제한 편집 |

## 1. 현재 상태 (As-Is, 코드 검증됨)

- 타입 `OpsBlindLevel`: `level`·`smallBlind`·`bigBlind`·`ante`·`durationSec`·`isBreak`·`sort`(`src/types/ops.ts:186`).
- 저장 = `ops_set_blind_levels(p_tournament_id, p_actor_id, p_levels jsonb)` **전체교체 SECDEF**(baseline `:7615`). sort 1..N 재부여.
- 훅 `useSetBlindLevels`(→ `opsBlindLevelService.setLevels` → repo → RPC), 조회 `useOpsBlindLevels`.
- `BlindLevelsTab`: 서버값 → 로컬 `draft` 배열 → 추가/편집/삭제 → `setLevelsMut` 일괄 저장. **이미 자유 편집·저장 구조 존재.**
- 대회 생성(`app/(ops)/tournaments/new.tsx`): 블라인드 시드 **없음**(신규 대회 = 블라인드 0개).
- 프리셋 인프라 **없음**.

**핵심**: 편집·저장 하부구조(B7)는 이미 있다. 신규는 **기본 시드(B2)** + **프리셋 저장소(B3)** 두 축뿐.

## 2. 기본 구조 값 (B1 — 확정)

`ante = bigBlind`, `durationSec = 1200`(20분), `isBreak = false` 전 레벨.

| LV | SB | BB / ante | LV | SB | BB / ante |
|----|-----|-----------|----|-----|-----------|
| 1 | 100 | 200 | 16 | 4,000 | 8,000 |
| 2 | 200 | 300 | 17 | 5,000 | 10,000 |
| 3 | 200 | 400 | 18 | 6,000 | 12,000 |
| 4 | 300 | 500 | 19 | 8,000 | 16,000 |
| 5 | 300 | 600 | 20 | 10,000 | 20,000 |
| 6 | 400 | 800 | 21 | 15,000 | 25,000 |
| 7 | 500 | 1,000 | 22 | 15,000 | 30,000 |
| 8 | 600 | 1,200 | 23 | 20,000 | 40,000 |
| 9 | 800 | 1,500 | 24 | 25,000 | 50,000 |
| 10 | 1,000 | 2,000 | 25 | 30,000 | 60,000 |
| 11 | 1,500 | 2,500 | 26 | 40,000 | 80,000 |
| 12 | 1,500 | 3,000 | 27 | 50,000 | 100,000 |
| 13 | 2,000 | 4,000 | 28 | 60,000 | 120,000 |
| 14 | 2,500 | 5,000 | 29 | 80,000 | 150,000 |
| 15 | 3,000 | 6,000 | 30 | 100,000 | 200,000 |

→ 단일 소스 상수 `src/domains/ops/defaultBlindStructure.ts`(`DEFAULT_BLIND_LEVELS: OpsBlindLevelInput[]`). 시드(B2)와 앱 기본 프리셋(B4) 둘 다 이 상수를 참조.

## 3. 프리셋 저장소 (B3·B6)

### 3.1 스키마 — 신규 테이블 `ops_blind_presets`

```
ops_blind_presets
  id          uuid PK default gen_random_uuid()
  owner_id    uuid NOT NULL  → auth.users (소유자)
  name        text NOT NULL  (예: "딥스택 40레벨")
  levels      jsonb NOT NULL (OpsBlindLevelInput[] 스냅샷)
  created_at  timestamptz default now()
  updated_at  timestamptz default now()
```

- **RLS(FORCE)**: owner_id = auth.uid() 인 행만 SELECT/변이. `is_admin()` 우회 허용.
- 인덱스: `(owner_id, created_at desc)`.
- `levels` jsonb는 저장 시 서버에서 **화이트리스트 재조립**(sb/bb/ante/durationSec/isBreak/level만) — 임의 필드 유입 차단.

### 3.2 RPC (신규, SECDEF 하드닝 — [[secdef-hardening]])

| RPC | 역할 | actor 바인딩 |
|-----|------|-------------|
| `ops_save_blind_preset(p_actor_id, p_name, p_levels jsonb)` | 현재 구조를 프리셋으로 저장(신규 or 동명 갱신) | auth.uid() = actor, owner_id = actor |
| `ops_delete_blind_preset(p_actor_id, p_preset_id)` | 프리셋 삭제 | owner 매칭 |
| 조회 | 프리셋 목록은 **RLS 통과 직접 SELECT**(TanStack 읽기전용, Repository 경유 — 아키텍처 예외 허용) | — |

- 신규 함수 **PUBLIC/anon EXECUTE REVOKE 필수**(anon SECDEF =2 계약 보존, ops 규율).
- `search_path = public, extensions, pg_temp`, plpgsql NULL fail-open 차단.
- **프리셋 적용은 서버 RPC 불요** — 클라가 프리셋 `levels`를 draft에 로드 후 기존 `ops_set_blind_levels`로 저장(B5·B6).

## 4. 기본 시드 (B2)

대회 생성 직후 기본 30레벨을 주입. 두 방식 중 택1(구현 시 확정):
- **(a) 클라 주도**: `new.tsx` 대회 생성 성공 직후 `setLevels(DEFAULT_BLIND_LEVELS)` 1콜. 서버 변경 0, 가장 단순. **기본안**.
- (b) 서버 주도: `ops_create_tournament` 내부에서 시드 — RPC 변경(계약 확장) 필요, 기각 유력.

(a)면 신규 스키마는 프리셋용 테이블/RPC뿐, `ops_create_tournament` 불변.

## 5. UI (와이어프레임 ④ + §05)

- 블라인드 탭 상단 **프리셋 바**: `프리셋 · <현재 이름> ▾` + `구조 저장`.
  - `▾` → 프리셋 시트: 앱 기본(기본30) + 내 저장 목록. 항목 탭 = 적용(전체교체 확인, B5).
  - `구조 저장` → 이름 입력 → `ops_save_blind_preset`.
- 레벨 리스트: 현행 draft 편집 그대로(행 탭 편집·＋레벨/브레이크·삭제·저장).
- 신규 훅: `useOpsBlindPresets`(목록)·`useSaveBlindPreset`·`useDeleteBlindPreset`. 신규 레포 `OpsBlindPresetRepository`.

## 6. 임팩트 · 리스크

| 항목 | 판정 |
|---|---|
| 스키마 | 신규 테이블 1 + RPC 2 → **/guard 먼저** + 마이그(MCP `apply_migration`). RLS·anon REVOKE·SECDEF 하드닝 필수 |
| 기존 블라인드 저장 | 불변(`ops_set_blind_levels` 재사용) |
| 리스크 | 중. anon SECDEF =2 계약 회귀(신규 RPC REVOKE 누락) / 프리셋 적용 전체교체 오조작(B5 확인 다이얼로그) |
| 테스트 | 상수 30레벨 스냅샷 · 프리셋 저장/불러오기/삭제 RPC(pgTAP owner 격리) · 시드 후 sort 1..30 · 프리셋 적용=전체교체 |
| DB 리뷰 | database-reviewer + security-reviewer(신규 RLS·SECDEF) |

## 7. 슬라이스 (구현 순서)

1. **S1** `defaultBlindStructure.ts` 상수(§2) + 시드(B2-a): 대회 생성 후 기본 30레벨 주입 + 테스트
2. **S2** 스키마: `ops_blind_presets` 테이블 + RLS(FORCE·owner) + 인덱스 (/guard → 마이그)
3. **S3** RPC 2종(save/delete) SECDEF 하드닝 + **anon REVOKE 회귀 가드**(카탈로그 카운트 =2) + pgTAP
4. **S4** 레포·훅(`useOpsBlindPresets`/save/delete) + 프리셋 바·시트 UI + 앱 기본 프리셋 병합
5. **S5** 적용=전체교체 확인 UX + 전체 QA·테스트

각 슬라이스 끝 `npm run quality` + Jest/pgTAP. 마이그는 MCP 전용(db push 금지). 실기기 QA는 사용자 게이트.

## 8. 미해결 / 후속

- 워크스페이스 공유 프리셋(B3 기각안)은 팀 운영 수요 확인 시 후속.
- 프리셋에 **브레이크 포함** 여부는 사용자 저장분에 자연 반영(levels 스냅샷). 앱 기본 프리셋 확장(딥스택/터보)은 §2 상수 옆에 추가 상수로.
- 기본 구조 durations/브레이크 조정은 편집으로 흡수(B7) — 기본값 변경 요청 시 §2만 수정.
