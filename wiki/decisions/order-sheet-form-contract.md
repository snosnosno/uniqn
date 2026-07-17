---
area: decisions
updated: 2026-07-17
status: current
sources:
  - uniqn-mobile/src/schemas/orderSheet.schema.ts
  - uniqn-mobile/src/utils/order-sheet/mappers.ts
  - uniqn-mobile/src/utils/order-sheet/roleSalaries.ts
  - uniqn-mobile/src/utils/job-posting/draftAdapter.ts
  - uniqn-mobile/src/domains/job-posting/serialization.ts
  - uniqn-mobile/src/hooks/useUnsavedChangesGuard.ts
  - uniqn-mobile/src/components/employer/order-sheet/sheets/TimeSlotsSheet.tsx
  - uniqn-mobile/src/components/employer/order-sheet/sheets/ConditionsSheet.tsx
  - PR#246
  - PR#247
  - PR#252
  - PR#253
  - PR#261
tags: [order-sheet, form, zod, react-hook-form, mapper, modal]
---

# 결정: 주문서 폼 계약 — 3제네릭 zodResolver + canonical 매퍼 등가성 + Design B

## 1. 폼 계약은 2형(z.input/z.output) — RHF 3제네릭 필수
`orderSheetValuesSchema`는 **z.input=폼 상태**(장소 null 허용·default 필드 optional)와 **z.output=제출 결과**(검증 통과·non-null·default 채움)가 다르다. 그래서 `useForm<z.input, unknown, z.output>` **3제네릭**으로 소비해야 한다.
- **근거(스파이크 실측)**: 단일 제네릭은 zod4.3.6 × @hookform/resolvers5.2.2에서 컴파일 불가. `location`은 `.nullable().refine(v=>v!==null)`로 z.output에서 null이 제거된다(의도 — 매퍼가 가드 없이 소비).

## 2. canonical 매퍼 등가성 — 신구 동일 산출
`mappers.ts`가 `OrderSheetValues` ↔ 기존 `JobPostingDraft`를 왕복한다. 주문서는 **새 UI일 뿐 기존 create 경로와 동일한 draft를 산출**해야 한다(신구 등가성 테스트가 게이트). 새 폼이 별도 쓰기 경로를 만들지 않는 게 핵심 — [[layers]] Service→Repository 단일화 유지.

## 3. Design B (승인 일탈) — 단일 화면 카드 + 바텀시트
초기 설계(Design A: 항목별 전용 화면 네비게이션) 대신 **단일 화면 카드 + 항목별 바텀시트 12종**을 승인·구현. `by_role` 급여는 canonical 매퍼의 by_role 복원 분기로 왕복 보존(shared에도 roleCatalog salary 전사 + `draftToValues`가 by_role만 roleSalaries 복원 — 협의/shared "급여 미정" 오표시 해소). 일탈 사유: 브리프 자기모순 + 협의(other, `{type:'other',amount:0}`) 표현.

## 4. 중첩 Modal 금지 — embedded overlay + 지연 전환(#244)
- 주문서 시트 안에서 여는 피커(TimeWheelPicker)는 **중첩 RN Modal이 아니라 SheetModal overlay 슬롯에 absoluteFill embedded** — iOS 터치 먹통(#186/#243) 회피. [[ios-userflow-fixes]].
- **TimeSlots↔Roles 전환은 즉시 스왑 금지**: 부모가 시트를 닫고(onConfirm) `onEditSlotRoles`로 **#244 지연 전환**(타이머 정리 + 재진입 가드). 직접 스왑하면 iOS에서 두 시트가 겹쳐 터치 죽음.

## 5. 함정 (등록 사망 유발)
- `guaranteedHours`에 `PROVIDED_FLAG`(-1) 넣으면 문서게이트 `min(0)` reject → **등록 전건 실패**. 보장시간은 시간값(0 이상), 나머지 복지 3종만 -1(제공)/양수.
- `INITIAL_JOB_POSTING_DRAFT.compensation.mode` 초기값 — by_role 팩토리로 우회.
- 신규 필드(conditions 등)는 **9개 왕복 지점** 전수 — [[whitelist-silent-drop]].

## 6. 일정 그룹 + 역할별 급여 계약 (#253/#252 후속)
- **일정 = `scheduleGroups`**: 평평한 slot 배열이 아니라 `scheduleGroups: [{ dates: 'YYYY-MM-DD'[]≥1, timeSlots, grouped }]`(≥1). 슬롯은 `scheduleGroups.flatMap(g=>g.timeSlots)`로 파생(3지 세그먼트 UI).
- **`roleSalaries` 커버리지 refine**: `useSameSalary=false`(기본 by_role, 설계 §S2.1)면 모든 (역할×그룹) 키를 `roleSalaries`가 **전수 커버**해야 통과. 키 = `keyOf(role, customRole)`(other는 `other:${customRole}`로 분리). 미커버 시 zod reject(`path:['roleSalaries']`).
- **by_role `defaultSalary` = 활성 `roleSalaries` 최저값**(CEO-1): 비활성(고아) roleSalaries 값이 defaultSalary로 새면 안 됨 — 유령 세그먼트 캐리어 기록 금지([[whitelist-silent-drop]] 계열). 매퍼 `roleSalaries.ts`/`syncRoleSalaries`는 **의존성 0 모듈**(mappers와 순환 차단), `draftToValues`는 by_role일 때만 roleSalaries 복원.

## 7. update = patch 시맨틱 — conditions는 양분기 상시 전달 (#261 S3)
편집이 create와 결정적으로 다른 지점: **수정 직렬화는 patch(생략=현행 유지)**다. `serialization.ts:360-365`가 `input.conditions`가 undefined면 `current.conditions`로 폴백한다 — create의 "키 생략 관례"를 그대로 update에 승계하면 **conditions 해제 계열이 전부 침묵 무시**된다(축소 payload에서 conditions 제외·전량 해제 키 생략 → serialize current-폴백 부활 → "성공 토스트 + 침묵 소실"). [[whitelist-silent-drop]] 재발 클래스.
- **확정 계약**: `mappers.ts:303`(draft→update)·`:397`(update input) **양분기 모두 `conditions: { ...(draft.conditions ?? {}) }` 상시 전달**. 빈 `{}`도 wholesale 반영(3계층 실측 선행). 되돌리기 금지.
- **편집 진입은 위임으로 등가성 보장**: `mappers.ts:525` `valuesToUpdateInput` = `draftToUpdateJobPostingInput(valuesToDraft(values), options)` — `valuesToCreateInput`과 동형 패턴이라 신·구 편집 결과가 구조적으로 일치.

## 8. 전 타입 단일 경로 + 레거시 은퇴 + markClean (#261 S4)
- **주문서 = 전 타입(지원·급구·대회·고정) create/edit 단일 경로**. `OrderSheetScreen` `mode='edit'`에서 TypeSegment disabled·`scheduleLocked`(확정 지원자 있으면 일정/시간/역할/근무조건 잠금, **급여는 미잠금** — 서버 identity 가드가 역할 키 집합만 비교). 대회 편집은 approvalStatus 보존(재승인 없음).
- **레거시 폼 30파일 + `draftAdapter` formData 읽기 방향 은퇴**(−4773+180줄). 존치: `TemplateModal`·`DatePickerModal`·`formDataToDraft`(템플릿 백컴팻 라이브) — 오삭제 금지. 왕복/편집 위임(`draftToCreate/UpdateJobPostingInput`)은 §7 conditions 계약 테스트 직결이라 존치(이주 비용>가치).
- **markClean**(`useUnsavedChangesGuard.ts`): 저장 성공 직후 같은 틱 `back()`이 stale 미저장 상태를 읽어 잘못된 이탈 경고를 띄우던 버그를 제거(TDD). 저장 핸들러가 명시적으로 dirty 플래그를 청소한다.
- **서버 무변경**(마이그·RLS·EF·직렬화 계약 0) = JSON-only OTA 가능. 소스 요약=[[order-sheet-unification]].

관련: [[job-posting-kiosk-order-sheet]] · [[whitelist-silent-drop]] · [[order-sheet-unification]] · [[ios-userflow-fixes]] · [[capacity-full]] · [[layers]] · [[nativewind-rn-pitfalls]]
