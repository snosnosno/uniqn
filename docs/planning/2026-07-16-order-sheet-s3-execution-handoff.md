# 핸드오프 — 공고작성 주문서 통일 S3(전 타입 편집) → S4(레거시 은퇴) (다음 세션 메인 프롬프트)

> S1(대회 생성)+S2(고정 생성)+**종단 전체리뷰(6관점)+후속 fix 4커밋**까지 완료(브랜치 `docs/order-sheet-unification-design @8e41e8bef`, 로컬·미push).
> 아래 "메인 프롬프트"를 다음 세션에 그대로 붙여넣어 시작한다. **1세션 = 1슬라이스**(S1·S2에서 검증된 리듬) — 이번은 **S3(전 타입 편집)**부터. S4는 그 다음 세션.

---

## 메인 프롬프트

공고작성 주문서 통일의 **S3 — 전 타입 편집 주문서화**를 설계 확인→계획 작성→SDD 구현으로 끝까지 진행해줘.

**착수 전 필수 확인 (실증된 함정 — 반드시 선행):**
1. `git status` + `git branch --show-current` — 작업 브랜치는 **`docs/order-sheet-unification-design`**, HEAD **`8e41e8bef`**(S1 5 + S2 9 + 전체리뷰 fix 4커밋, 미push). `git log --oneline -20`으로 확인. 다르면 브랜치/HEAD부터 바로잡고 시작.
2. **병렬 세션 격리**: 이 메인 체크아웃은 단일트리 — 동시세션이 워킹트리를 master로 되돌린 실증 있음. **커밋 직전마다 `git branch --show-current` 재확인**, master 직접 커밋 금지, 새 커밋은 브랜치 위 append(리베이스·리셋·amend 금지).
3. 내가 만들지 않은 미커밋 코드 변경이 있으면 워크트리 격리(전역 git-workflow).

**설계 SSOT**: `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md` — §2(최종 상태 표), §5(대회 승인·편집), §6-3(S3 분해), §7(함정), §8(검증) 정독. 확정 결정 ⑥: **대회 편집 시 기존 `approvalStatus` 보존(재승인 트리거 금지)**.

**1단계 — S3 계획 작성 (플랜 아직 없음):**
`superpowers:writing-plans`로 `docs/superpowers/plans/2026-07-16-order-sheet-all-types-edit.md` 작성. 실제 코드·정확 경로·실행 명령·기대 출력 포함, TDD 태스크 분해. 계획 확정 후 2단계.

**2단계 — SDD 구현**: `superpowers:subagent-driven-development` — 태스크당 새 서브에이전트 + 태스크 간 리뷰 + 최종 whole-branch 리뷰.
- **모델 라우팅**: 구현=**opus** / 계획·리뷰·판정=**fable**(전역 agents-v2). 2026-07-16 전체리뷰 세션에서 fable 6에이전트 병렬이 정상 동작했으니 fable 우선, 한도 시 fable→opus→sonnet 폴백+다운그레이드 명시.
- 디스패치 금지사항 명시: `mcp__supabase__*` 직접 호출 · 기존 마이그레이션 수정 · PROD 우회 · 범위 밖 리팩터.
- 에이전트 보고 신뢰 금지 — VCS diff + jest 독립 검증 후 다음 태스크.

**작업 디렉토리**: `uniqn-mobile/`. 게이트 = `npm run quality`(EXIT 0) + 관련 `npx jest`.
- jest 경로에 괄호(`app/(employer)/...`)가 있으면 Windows에서 매칭 0건 → 괄호 없는 부분경로(`my-postings` 등)로 실행.

### S3 범위 — 현재 실측 기준 남은 일

하이드레이션(`draftToValues`)은 **이미 전 타입 완료 상태**다(S1이 dated 그룹핑 복원, S2가 fixed 복원, 전체리뷰 fix가 role fabrication 제거·복수 슬롯 흡수까지). S3의 실제 작업:

1. **`valuesToUpdateInput` 신설**(mappers.ts) — 주문서 값 → update input. 레거시 대응물(`draftToUpdateJobPostingInput`, draftAdapter)과 **신·구 등가성 게이트**(타입별 산출 비교 테스트). 현재 update 경로의 실제 형상은 구현 전 실측.
2. **🔑 대회 편집 승인상태 보존(확정 결정 ⑥)**: `valuesToUpdateInput`이 `tournamentConfig`를 **아예 만지지 않도록**(부분 업데이트에서 키 자체 미포함) — 승인된 대회 수정이 pending 리셋 유발 금지. **red-green 필수**: approved 대회 → 편집 저장 → approvalStatus 불변 어서션.
3. **`edit.tsx` 전 타입 `OrderSheetScreen` 배선** — 현재 편집은 전 타입 레거시 `JobPostingScrollForm`. 편집 진입 시 `posting → draft → draftToValues`로 initialValues 하이드레이션. 완료 동선(토스트·복귀)은 편집 시맨틱으로.
4. **편집 왕복 전수(#194 재발 클래스)**: 하이드레이션→수정→`valuesToUpdateInput` 왕복에서 **주문서 밖 필드**(편집이 안 다루는 서버 필드: status·filledPositions·tournamentConfig·workspaceId 등)가 덮이거나 증발하지 않는지 — update는 부분 패치가 원칙. own-property red-green.
5. **S3 재점검 이월 항목**: fixed 역할 시트가 dated 슬롯용 `RolesSheet` 재사용 중(전체리뷰에서 "S3 재점검" 판정) — 편집 이관하면서 구조 유지/분리 결정.

### S3가 반드시 알아야 할 전체리뷰 fix 4커밋의 새 계약 (2026-07-16, `4ed437257`·`ca63f68cb`·`b1fadd336`·`8e41e8bef`)

- **M7 스태시/복원**: `OrderSheetScreen.handleTypeChange`가 dated↔fixed 전환 시 반대 축 입력을 ref 스태시 후 복귀 시 복원한다(동일 타입 재탭 no-op). **편집 모드에서 타입 전환을 허용할지는 S3 제품 결정** — 허용하면 스태시 시맨틱 그대로, 금지하면 세그먼트 비활성이 자연스럽다(기존 공고의 타입 변경은 update 경로·카운터에 파급).
- **매퍼 하드닝**: `valuesToDraft`는 `postingType==='fixed'`만으로 fixed 분기(fixedSchedule 부재 시 빈 근무조건 폴백) — mixed draft({fixed, kind:'dated'}) 생산 불가. `draftToValues`(fixed)는 role 부재 엔트리를 '딜러'로 조작하지 않음(customRole→'other' 승격, 둘 다 없으면 드랍)·복수 슬롯 전부 흡수.
- **스키마 상호배타는 의도적 반강제**(설계 확정 ⑤ — superRefine은 자기 축만 검증, 반대 축 잔여는 handleTypeChange 불변식+매퍼가 처리). **S3에서 편집 하이드레이션이라는 외부값 유입 경로가 새로 생기므로**, `draftToValues`가 전 타입에서 이 불변식(fixed→scheduleGroups:[], dated→fixedSchedule 미포함)을 유지하는지 계획 단계에서 재확인.
- 헬퍼: `defaultFixedSchedule()`·`seedFixedScheduleIfMissing`·`applySyncedRoleSalaries`(급여 프리필 토스트 공용)·`START_TIME_RE`는 schema export 단일 정의. `errorMessageForRow`에 fixed 배선 완료. `handleApplyPreset`는 fixed면 `syncRoleSalariesForRoles` 사용.
- `create-success.tsx`: pending(승인 대기) 대회는 공유 CTA 숨김("승인이 완료되면 공유할 수 있어요") — 상세가 승인 게이트(`app/(app)/jobs/[id]/index.tsx:139 isTournamentApprovalBlocked`)에 막히기 때문. **편집 완료 동선에도 같은 원칙 적용**(승인 대기 대회 편집 후 공유 유도 금지).

**불변 계약**: 한글(주석·커밋·문구) · `logger` · `dark:`(라인하이트는 다크 가산 — 감산 역전 금지, impeccable §1) · `@/` 경로 · toast/Alert · camelCase · 아이콘 `@/components/icons` stroke 2.0 · 커밋 `<type>(<scope>): 한글` · zodResolver 3제네릭(`useForm<z.input, unknown, z.output>`) · `guaranteedHours` PROVIDED_FLAG(-1) 금지 · **서버 무변경**(마이그·RLS·EF·직렬화 0 → JSON-only OTA 유지. update 경로가 서버 함수를 요구하면 STOP하고 사용자에게 보고).

**출하 게이트(사용자)**: 전 태스크 green + 최종 whole-branch 리뷰 후 → 실기기 QA는 사용자 게이트. push/PR/OTA는 **명시 요청 시에만**.

**슬라이스 경계**: 이번은 **S3(전 타입 편집)만**. S4(레거시 은퇴)는 S3 완료·검증 후 별도 세션 — 손대지 말 것(레거시 폼은 S3 동안 병존).

---

## S4 — 레거시 은퇴 (S3 다음 세션 · 별도 계획)

S3 머지 가능 상태 확인 후 착수. 범위:

- `JobPostingScrollForm` · `draftAdapter` · `create.tsx`/`edit.tsx` legacy 분기 · `PostingTypeSelector`(레거시용) 제거 + **knip 데드코드 정리**(참조 무결성 · 빌드 green · `knip:gate` 래칫 준수).
- **전체리뷰에서 사문 표시해 둔 것들 삭제**(주석에 "S4 제거 예정" 마킹돼 있음):
  1. `create.tsx` `legacyType`/`handleSwitchToLegacyForm`/사문 Alert — 호출자 0 실증.
  2. `OrderSheetScreen` `onSwitchToLegacyForm` prop(소비 안 함, 계약 주석 참조).
- ⚠️ `draftAdapter` 제거 전 의존 실측: `buildFixedSyntheticRequirement`(S2가 export해 mappers·jobTemplate이 사용) 등 **살아있는 심볼은 이주 후 제거** — 통째 삭제 금지.
- knip 보호: peer-only 네이티브(mmkv/nitro) `knip.ignoreDependencies`, babel/expo-modules-core 오탐 주의(`pitfall_knip_falsepositive_build_config`).
- S4 완료 = 재구축 완결. 이후 전 브랜치 push/PR/OTA는 사용자 게이트.

---

## 세션 컨텍스트 (참고)

- **현재 상태**: 브랜치 `docs/order-sheet-unification-design @8e41e8bef`(미push, master 869febacda 분기). 최종 실측: `npm run quality` EXIT 0 · 초점 29 suites/258 tests PASS · 서버 무변경 0건.
- **전체리뷰 결과(2026-07-16, 6관점 fable 병렬)**: 설계 6결정 6/6 일치 · S1 5+S2 8태스크 전수 DONE · Critical 0 · Important 4 전부 수정(M7·mixed-draft·fabrication·pending 공유) · Minor 9 수정/3 이월. 이월 상세는 위 "S3 재점검"·"S4 삭제 목록".
- **무조치 확정(재제안 금지)**: 스키마 상호배타 완전 강제(설계 ⑤가 반강제 선택 — 주석 교정+매퍼 이중가드로 갈음) · WorkConditionSheet `rounded-lg` vs RolesSheet `rounded-full` 비일관(정합 방향은 RolesSheet 쪽 후속 — impeccable §14가 rounded-full 금지).
- **사용자 확정 6결정**: ①한 스펙·슬라이스 분리 ②전 타입 생성+편집 주문서화 ③고정 스케줄 현행 유지(주 N일) ④레거시 은퇴 마지막 ⑤스케줄 discriminated union(스케줄만 분기) ⑥대회 편집 approvalStatus 보존.
- 아키텍처 체인 실측: `JobPostingRepository.ts:484-485` tournament면 {approvalStatus:PENDING, submittedAt} 자동 주입 · 공개조회 `:233-236` APPROVED만 · 상세 `jobs/[id]:139` 미승인 열람·지원 차단(P0#4) · `getById`(:146)는 승인 무관 조회(컨테이너만 차단).
- 관련 위키: `wiki/decisions/order-sheet-form-contract.md` · `wiki/decisions/whitelist-silent-drop.md` · `wiki/sources/job-posting-kiosk-order-sheet.md`.
- 관련 메모리: `project_order_sheet_unification_all_types`(전체리뷰 반영 완료) · `project_schedule_schema_unification_sp1` · `pitfall_shared_worktree_concurrent_branch_switch`.
- 이전 로드맵 문서: `docs/planning/2026-07-16-order-sheet-s2-s4-remaining-handoff.md`(S2 착수용 — S2 완료로 본 문서가 대체).
