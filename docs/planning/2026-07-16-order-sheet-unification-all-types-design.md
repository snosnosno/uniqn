# 공고작성 전면 주문서 통일 — 설계 v1 (2026-07-16)

> 목적: 주문서(order-sheet) 키오스크를 **모든 공고 타입(지원·급구·대회·고정)의 생성·편집 단일 경로**로 확장한다.
> 레거시 `JobPostingScrollForm` + `draftAdapter`는 마지막 슬라이스에서 은퇴 — 키오스크 설계문서(`2026-07-14-job-posting-kiosk-order-sheet-design.md`) §7 후속 백로그 "고정·대회 주문서화 + edit 이관 → draftAdapter 제거(재구축 완결)"의 종착점.
> 시각 설계안(아티팩트): https://claude.ai/code/artifact/bee7aa02-b57a-43fa-aeb2-fd8cbe9715ae

## 0. 배경 — 현재 상태 실측

주문서 개편(PR#246/#247)은 **지원(regular)·급구(urgent) 생성만** 커버한다. 실측으로 확인된 현행:

- `orderSheet.schema.ts:104` — `postingType: z.enum(['regular', 'urgent'])` (fixed/tournament는 스키마에 아예 없음).
- `TypeSegment.tsx`는 4개 타입 버튼을 노출하지만, `OrderSheetScreen.tsx:398-406` `handleTypeChange`가 `fixed`/`tournament` 선택 시 `onSwitchToLegacyForm(t)` 호출 후 즉시 return → **레거시 상세 폼으로 강제 이탈**.
- 편집(`edit.tsx`)은 **모든 타입이 레거시** `JobPostingScrollForm`. 주문서 편집 경로는 존재하지 않는다.
- 프리셋 캐러셀은 대회/고정 공고를 만나면 매퍼가 실패해 `try/catch`로 조용히 제외(`create.tsx:96-115`).

### 공고 유형 4종 vs 스케줄 축 2종 (독립)

| PostingType | schedule.kind | 날짜 | 특수성 |
|---|---|---|---|
| regular(지원) | dated | 최대 7일 | — |
| urgent(급구) | dated | 최대 7일 | 상한일자 +7일 |
| tournament(대회) | dated | 최대 30일 | 관리자 승인 워크플로우(pending→approved), 승인 후에만 검색 노출 |
| fixed(고정) | **fixed** | **날짜 없음(date:null)** | 상시 반복 근무, 지원방식 `fixed_role`(역할만 선택), 게시기간 7일 자동 |

## 1. 확정 결정 (사용자 승인 이력, 2026-07-16)

| 결정 | 선택 |
|---|---|
| 이식 범위 | **둘 다 한 스펙, 슬라이스 분리** — 대회·고정을 하나의 설계 문서에 담고 구현은 순차 슬라이스 |
| 생성 vs 편집 | **생성+편집 모두 주문서화** — 지원/급구 편집도 함께 이관(레거시 은퇴 조건 성립) |
| 고정 스케줄 UX | **현행 유지** — 주 N일(`daysPerWeek`) + 출근시간(`startTime`) + 협의 토글(`isStartTimeNegotiable`). 요일 개별선택 미도입, 무마이그레이션 |
| 레거시 은퇴 | **마지막 정리 슬라이스로 포함** — `JobPostingScrollForm` + `draftAdapter` + legacy 분기 제거 + knip 데드코드 정리 |
| 스케줄 스키마 표현 | **discriminated union**(스케줄만 분기, 전체 폼 union 아님) — RHF 3제네릭과 궁합, 공통 필드 평탄 유지 |
| 대회 편집 승인상태 | **기존 approvalStatus 보존**(재승인 트리거 없음) — 승인된 대회 수정이 pending 리셋 유발 금지 |

## 2. 최종 상태

주문서를 **4개 타입 전부의 생성·편집이 지나는 유일한 폼**으로.

| 타입 | 생성 | 편집 | 새 시트 |
|---|---|---|---|
| 지원/급구 | 주문서(현행 ✅) | 레거시 → **주문서 이관** | 0 |
| 대회 | 레거시 → **주문서** | 레거시 → **주문서** | 0 (안내배너만) |
| 고정 | 레거시 → **주문서** | 레거시 → **주문서** | 1 (근무조건 시트) |

## 3. 아키텍처 — "스키마는 확장, 쓰기 경로는 불변"

```
주문서 UI (RHF 3제네릭 + zodResolver)   ← 거의 무변경(고정만 "근무조건" 행 스왑)
  → orderSheet.schema                    ← 확장: postingType 4종 + 스케줄 discriminated union
  → mappers                              ← 확장: draftToValues · valuesToCreateInput · valuesToUpdateInput
  → useCreateJobPosting / useUpdateJobPosting  ← 무변경
  → Service → Repository → Supabase       ← 무변경(RLS · 트랜잭션 · SP1 불변식)
```

### 3.1 스케줄 = discriminated union (postingType 기준)

- **dated**(지원·급구·대회): 기존 `scheduleGroups` 그대로. 날짜 배열 + 시간대별 역할. 상한 `DATE_CONSTRAINTS[postingType].maxDates`(7/7/30) — **이미 postingType 기반**이라 enum 추가만으로 30일 자동 반영.
- **fixed**(고정): 신규 `fixedSchedule { daysPerWeek, startTime, isStartTimeNegotiable }`. 날짜 없음 → 쓰기 시 SP1 synthetic `requirements:[{date:null, timeSlots:[{startTime, roles}]}]` 1개.
- 충돌 해소: 기존 `orderSheetScheduleGroupSchema`는 `dates.min(1)` 필수 → 고정과 정면 충돌. union 분기로 격리. superRefine이 `postingType`↔스케줄 표현 정합을 강제(fixed면 fixedSchedule present + scheduleGroups 미검증, dated면 그 반대).

### 3.2 매퍼 확장 (무마이그레이션 목표)

- `draftToValues`(`mappers.ts:204`)의 `schedule.kind !== 'dated'` throw를 **fixed 전용 변환으로 대체**(고정 draft/posting → fixedSchedule 값 복원).
- **대회 silent 치환 제거**: `mappers.ts:278` `postingType: draft.postingType === 'urgent' ? 'urgent' : 'regular'`가 tournament를 조용히 regular로 뭉갠다 → postingType 원본 보존으로 수정.
- **fixed 쓰기 SP1 헬퍼 통합**: `buildFixedSyntheticRequirement`/`buildFixedDraft`/`draftToCreateJobPostingInput` fixed 분기/`templateToDraft` fixed 변환 4곳 중복(기존 TODO(SP1 후속) 주석)을 공유 헬퍼로 통합해 주문서 create input이 재사용.
- 급여/복지/조건/사전질문 매핑은 전 타입 공유 — 무변경.

## 4. 시트 · 행 구성 (타입별)

- **지원/급구/대회**: 기존 주문서 행 그대로 — 제목·장소·연락처·설명 / 날짜·시간·역할 / 급여·복지·세금 / 조건 / 사전질문.
- **고정**: 날짜·시간 시트 → **"근무조건" 시트 1개로 대체** (주 출근일수 칩 0=협의~7 · 출근시간 휠 · 출근시간 협의 토글). 역할·급여 이하 공유. "게시기간 7일 자동" 안내 텍스트 재현(`FIXED_POSTING_DURATION_DAYS=7`).
- **유형 세그먼트**: `handleTypeChange`의 대회/고정 레거시 이탈 로직(`OrderSheetScreen.tsx:398-406`) 제거 → 4종 모두 주문서 내부에서 처리. `create.tsx`의 `handleSwitchToLegacyForm` 분기도 함께 제거(S3/S4).

## 5. 대회 승인 처리

- **생성**: 승인 config는 폼 입력 0. Repository가 `postingType==='tournament'`이면 `{ approvalStatus: PENDING, submittedAt: now }` 자동 주입(`JobPostingRepository.ts:484-486`, 유지). `handleOrderSheetSubmit`(`create.tsx:215-259`)에 **토스트 분기 추가** — "공고가 등록되었습니다. 관리자 승인 후 게시됩니다." + 등록버튼 라벨 "승인 요청" + 주문서 안내 배너("승인까지 1-2 영업일").
- **편집(확정 결정)**: 기존 `approvalStatus` **보존**. update 매퍼(`valuesToUpdateInput`)가 `tournamentConfig`를 덮어쓰지 않도록 명시 — 승인된 대회를 수정해도 pending 리셋 금지. ※현재 update 경로의 tournamentConfig 처리 실측으로 확정(구현 계획 단계).

## 6. 슬라이스 분해 (순차 · 저위험부터)

1. **S1 — 대회 생성**: `orderSheet.schema.ts:104` enum에 `'tournament'` 추가 · 안내배너/버튼라벨/토스트 · **매퍼 silent-coercion 버그 근절**(`mappers.ts:278`) + 읽기방향 회귀 테스트. 새 시트 0. **저위험·고가치.**
2. **S2 — 고정 생성**: 근무조건 시트 + 스키마 union 분기(`fixedSchedule`) + SP1 헬퍼 통합. 9지점 왕복 전수(신규 필드).
3. **S3 — 전 타입 편집 주문서화**: `draftToValues` 전 타입 하이드레이션 + `valuesToUpdateInput` 신설 + 대회 승인상태 보존. `edit.tsx`가 `OrderSheetScreen` 사용(전 타입).
4. **S4 — 레거시 은퇴**: `JobPostingScrollForm` · `draftAdapter` · `create.tsx`/`edit.tsx` legacy 분기 · `PostingTypeSelector`(레거시용) 제거 + knip 데드코드 정리. 재구축 완결.

## 7. 재발방지 · 함정 (실측 근거)

- **대회 silent-coercion**([[whitelist-silent-drop]] 재발 클래스): `mappers.ts:278`이 대회를 예외 없이 regular로 조용히 뭉갠다. 프리셋 로드 시 대회→지원 변질. S1에서 근절 + **읽기방향 회귀 테스트**(대회 draft → values → 대회 유지).
- **9지점 왕복 전수**([[whitelist-silent-drop]], #194 동형): 신규 `fixedSchedule`은 TABLE_COLUMNS SELECT 화이트리스트·`deserializeJobPostingDocument`·`toCreateJobPostingInput`·`draftToUpdateJobPostingInput`·템플릿·읽기 전 지점 갱신. 4지점만 하면 쓰기만 되고 읽기 전건 증발.
- **SP1 불변식**: 고정 = `requirements:[{date:null, timeSlots:[{startTime, roles}]}]` 1개(zod superRefine 강제). 공유 헬퍼로 통합하되 불변식 회귀 스냅샷(`sp1Equivalence.test.ts`) 유지.
- **신·구 등가성 게이트**: 각 타입 `valuesToCreateInput` 산출 == 기존 레거시 `draftToCreateJobPostingInput` 산출. 무마이그 확정은 구현 계획에서 `job_postings` 기존 JSONB(requirements) 수용 실측.
- **zodResolver 3제네릭**: `useForm<z.input, unknown, z.output>` 유지(단일 제네릭 컴파일 불가). union 도입 시 z.input/z.output 2형 유지.
- **guaranteedHours PROVIDED_FLAG(-1) 금지**: 문서게이트 `min(0)` reject → 등록 사망. 기존 규칙 승계.

## 8. 검증 · 테스트 전략

- 스키마 단위 테스트: fixed union 분기 · 대회 postingType 보존 · XSS/경계값.
- 대회 silent-coercion red-green(재현 → 수정 확인).
- fixed SP1 등가성: 주문서 `valuesToCreateInput`(fixed) == 레거시 산출.
- 9지점 왕복 own-property 가드 red-green.
- 키오스크 플로우 e2e: 대회 생성(승인 안내) · 고정 생성(근무조건) · 각 타입 편집 왕복.
- S4 후 레거시 제거 시 참조 무결성(knip 0 · 빌드 green).

## 9. 이번에 안 하는 것 (슬라이스 경계)

- 요일 개별선택(주 N일 유지) · 대회 특화 필드(대회명/바이인/상금 — 코드베이스에 위젯 자체 없음) · 위저드 3스텝(D안) · 로컬 임시저장 · 서버 스키마/RLS 변경(§3.2 JSONB 수용 확인 외 없음).

## 10. 후속 백로그

- D안 진화: 프리셋 없으면 위저드 3스텝 → 주문서 착륙.
- create/edit 마크업 중복 해소(S3에서 상당 부분 자연 해소).
