# 핸드오프 — 지점 역할별 급여 설계(JIT안) + 근무표 제거 잔여 출하 게이트 (다음 세션 메인 프롬프트)

> 작성: 2026-07-23. 이전 세션 = 데이터 위치·해소 로직 코드 실측 + 유저플로우 개선(JIT)까지 확정.
> 이 문서를 다음 세션 첫 프롬프트로 사용. 설계 미결 3건은 **코드로 이미 답이 나옴**(아래 §3).

## 상태 스냅샷

- **PR #297 머지 확인 완료**(이 세션에서 검증): `gh pr view 297` → state=MERGED, mergedAt `2026-07-22T10:57:06Z`, 머지커밋 `c95686da6`, **E2E Tests=SUCCESS**(러너 경합 timeout 해당 없음), Quality 3종·Tests·Bundle·EAS 전부 SUCCESS.
- 급여 정책 결정문서: `docs/planning/2026-07-22-venue-role-salary-policy-decision.md`(역할별 단가표 + 슬롯 override + 폴백 가시화).
- 이번 세션 = 그 정책의 **데이터 위치·정산 해소·UI 진입점**을 코드로 실측하고, 유저플로우를 **JIT(그때그때 묻기)안**으로 개선.

## 남은 출하 게이트 (근무표 제거 — 아직 미완, 원래 핸드오프 §2~4)

이 세션은 **머지 확인만** 했다. 아래는 그대로 잔여:
1. **웹 재배포** — guide.html 교정 라이브 반영. master 체크아웃 + origin/master 재fetch·ff 후 `node scripts/deploy-cloudflare.js --force`. ⚠️빈 번들(라우트 0)도 exit 0 → 라우트 수 검증 필수 · 워크트리서 배포하면 Preview로 감.
2. **OTA** — 직전 재fetch·ff, Commit 필드=origin HEAD 확인. JS 전용(네이티브 추가 0).
3. **워크트리 `T-HOLDEM-grid` 정리** — `/worktree-cleanup`.
4. **실기기 QA** — 원래 핸드오프 §4 6항목(반복 액션 부재·필요인원 저장·슬롯 편집·"공고로 모집" 프리필·탭 라벨).
   착수점: `docs/planning/2026-07-22-grid-removal-ship-gates-handoff.md`.

> 급여 설계와 출하 게이트는 독립 — 순서 무관. 출하 게이트부터 닫고 급여는 별도 /plan 세션으로 가도 됨.

## §1. 결함 (급여)

근무표 직접 배치는 `jobPostingId = containerId`(지점 자신)라 급여 정보가 없다 → 정산이 폴백 시급 **₩15,000**(`utils/settlement/constants.ts` `DEFAULT_SALARY_INFO`)로 **조용히** 계산.
- 슬롯 override(`customSalaryInfo`)는 이미 최우선 배선됨(`domains/settlement/helpers.ts:254`).
- 미결은 **2순위(지점 역할별 단가표)** 저장·해소뿐.

## §2. 코드로 확정한 사실 (파일:라인)

- **컨테이너는 job_posting 행이지만 급여 필드를 안 읽음.** 경량 `VenueContainer`로만 파싱(`domains/weeklyGrid/venueContainer.ts:4-7` — strict 스키마 null 증발 회피). 로드 컬럼(`VENUE_CONTAINER_COLUMNS`)=`id,title,workspace_id,owner_id,venue_id,schedule,status` — **roleCatalog/compensation 미로드**.
- **JobPosting은 이미 역할별 급여를 네이티브 지원**: `roleCatalog: {role,customRole?,salary?}[]`(`types/jobPosting.ts:82`) + `compensation.mode:'shared'|'by_role'`.
- **정산 해소기**: `getRoleSalaryFromRoles(roles[], targetRole, customRole, defaultSalary)`(`domains/settlement/helpers.ts:73-95`). 매칭: `effectiveRole = (role==='other' && customRole) ? customRole : role`. 미매칭 시 **조용히** fallback 반환(94행).
- **컨테이너 통합 불가**: `getPostingSettlementContext`(`domains/job-posting/core.ts:294`)의 roles는 `schedule.requirements`에서 파생(`getPostingRoleStats` core.ts:117). 컨테이너는 requirements가 비어 있음(softTargets를 requirements와 **의도 분리** — `domains/weeklyGrid/softTargets.ts:4-6`, MAX_CAPACITY 가드 회피). → 컨테이너 roleCatalog를 채워도 기존 경로로 역할별 해소 **안 됨** → "컨테이너 roleCatalog 재사용"안(후보 B) **기각 확정**.
- **커스텀 역할은 실제 발생**: AddSlotSheet가 `role==='other'`일 때 customRole 자유입력+XSS 검증(`components/weeklyGrid/AddSlotSheet.tsx:130·226`, `addSlotPayload.ts:107` assertSafeText). → 'other' 단일 뭉갬은 오답, `other:<customRole>`별 구분 필요.
- **updateSlot은 custom_role을 안 건드림**(가설 검증 완료): `WorkLogRepositoryVenue.ts:102-143` 갱신대상=time_slot·role·color·notes·edited_by만. → other 슬롯 재저장 시 custom_role 보존(유실 없음). dealer→other 변경 시 이름없는 '기타' 슬롯 생김(기존 UX 갭, 급여와 무관).

## §3. 데이터 위치·해소 — 확정 (미결 3건 답)

1. **저장 위치 = 컨테이너 `schedule.roleSalaries`** (JSONB, softTargets 옆). 후보 비교 결과 채택:
   - 마이그레이션 0·**RLS 변경 0**(schedule 컬럼 기존재, `/guard` 불요) · 증발 위험 0(경량 파서만 확장) · softTargets 패턴 그대로 복제.
   - 별도 테이블(후보 C)=신규 RLS 정책 복제 필요(오버엔지니어링, 기각). compensation 재사용(후보 B)=§2 통합 불가로 기각.
2. **타입 = `PostingRoleCatalogEntry[]` 배열**(Record 아님). 해소기 시그니처가 배열을 요구 → **어댑터 0으로 직결**. 키 규약은 기존 `getPostingRoleKey`(core.ts:21, `other:<customRole>`) 재사용.
3. **정산 삽입 = 분기 유지·payload 교체**(`services/work/settlement/settlementVenueQuery.ts:121`):
   ```ts
   const container = await getVenueContainerById(venueId); // 경량 경로(schedule 포함)
   const venueContext = { roles: container?.roleSalaries ?? [], defaultSalary: DEFAULT_SALARY_INFO, allowances: undefined, taxSettings: undefined };
   // found?.context ?? venueContext
   ```
   `getEffectiveSalaryInfoFromRoles`·`SettlementCalculator` **무수정 재사용**. 쿼리당 단건 read 1회 추가.
   ⚠️ **배지용 신규 헬퍼 필요**: `getRoleSalaryFromRoles`는 미매칭 시 조용히 폴백 → 해소 출처(`override|venueTable|fallback`) 반환하는 형제 헬퍼 별도 작성해야 "기본 단가 적용" 배지 가능(결정문서 "조용한 오답 금지" 요건).

## §4. 유저플로우 개선 — JIT(그때그때 묻기)안 [채택 방향]

**문제**: 원안은 숨은 지점 설정 화면에 사장이 **미리** 단가를 입력하길 기대 → 아픔(정산 ₩15,000)과 설정(지점관리)이 끊김. 숨은 설정은 발견 안 되면 없는 기능.

**개선**: 묻는 시점을 3접점으로 이동(포스기 비유: 바코드 없는 상품 첫 스캔 시 그 자리서 가격 물어 저장→다음부터 자동).

| 접점 | 시점 | 동작 |
|---|---|---|
| **1. 배치 시(주 진입점)** | AddSlotSheet에서 **단가 미설정 역할** 선택 시 | 인라인 급여 필드 1개(미설정일 때만 노출): "○○ 시급 미설정 — 지금 입력하면 이후 자동" → **지점 단가표에 저장**(슬롯 아님). 설정된 역할이면 아무것도 안 보임 |
| **2. 정산 시(구제)** | "기본 단가 적용" 배지를 **탭 가능**하게 | 탭 → 역할 단가 설정 → 재계산. 1을 건너뛴 사장 회수 |
| **3. 지점 관리(관리·보조)** | 단가표 시트(원안, 단 보조 진입점) | 시급 인상 등 일괄 조회·수정 |

한 문장 설명: **"처음 쓰는 역할만 한 번 물어봐요. 다음부턴 자동이에요."**

**JIT가 공짜로 해결하는 것**:
- **A/B 결정 소멸**: '칩 러너'(커스텀) 슬롯 추가 순간 JIT가 그 이름 단가를 물어 `{role:'other',customRole:'칩 러너',salary}` 자동 생성 → B의 커버리지를 A의 단순함으로. 단가표 시트에 자유입력 UI 불요.
- **EditSlotSheet override v1 컷 가능**: 개인별 예외는 정산 건별 수정(`customSalaryInfo`)이 **이미 배선**. EditSlotSheet는 이미 밀도 높음(시간·역할·색상·메모+삭제+휠피커) → 급여 중복 표면 회피, 파일 수·복잡도 감소.

**비용(정직)**: AddSlotSheet 조건부 필드 1개(미설정일 때만), 슬롯+단가 2쓰기 순서처리(단가 먼저 저장, 실패해도 다음에 다시 물음—무해). 데이터 위치·해소는 §3 그대로 변경 없음.

## §5. 다음 액션

1. **HARD-GATE: `/plan` 먼저** (3+파일·schedule JSONB 스키마 형태 변경 예상, DB 마이그는 MCP `apply_migration` 전용).
2. 설계 세션 입력은 §3(확정)+§4(JIT방향)로 완성됨. 남은 제품결정: **JIT안 채택 여부** 최종 확인(원안=미리 설정 vs JIT=그때그때). 이전 세션 권고=JIT.
3. RLS/SECDEF 영향 없음(schedule JSONB=기존 컬럼) → `/guard` 불요. 단 배지 헬퍼·정산 재계산 경로는 code-reviewer 필수.

## 세션 교훈 (메모리 반영 대상)
- 컨테이너는 strict JobPosting 스키마에서 의도적 격리 → 급여는 경량 read 경로(schedule JSONB)로만 도달 가능. compensation/roleCatalog 재사용은 requirements-파생 해소 때문에 불가.
- 해소기가 미매칭을 **조용히** 폴백 → "조용한 오답 금지" 요건은 출처 반환 형제 헬퍼가 별도로 필요(기존 헬퍼 재사용만으론 배지 못 만듦).
- 설계 리뷰 시 "묻는 시점"을 옮기면 숨은 설정 화면 + A/B 분기 + 중복 override 표면이 동시 소멸(JIT 재배열).
