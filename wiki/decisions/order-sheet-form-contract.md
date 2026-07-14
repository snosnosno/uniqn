---
area: decisions
updated: 2026-07-14
status: current
sources:
  - uniqn-mobile/src/schemas/orderSheet.schema.ts
  - uniqn-mobile/src/utils/order-sheet/mappers.ts
  - uniqn-mobile/src/components/employer/order-sheet/sheets/TimeSlotsSheet.tsx
  - uniqn-mobile/src/components/employer/order-sheet/sheets/ConditionsSheet.tsx
  - PR#246
  - PR#247
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

관련: [[job-posting-kiosk-order-sheet]] · [[whitelist-silent-drop]] · [[ios-userflow-fixes]] · [[capacity-full]] · [[layers]]
