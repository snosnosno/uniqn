---
area: sources
updated: 2026-07-16
status: current
sources:
  - uniqn-mobile/src/schemas/orderSheet.schema.ts
  - uniqn-mobile/src/utils/order-sheet/mappers.ts
  - uniqn-mobile/src/domains/job-posting/serialization.ts
  - uniqn-mobile/src/components/jobs/JobDetail.tsx
  - docs/planning/2026-07-14-job-posting-kiosk-order-sheet-design.md
  - PR#246
  - PR#247
tags: [job-posting, order-sheet, ux, kiosk, conditions]
---

# 소스: 공고작성 키오스크 "주문서" 개편 (2026-07-14, PR#246+#247)

## 무엇 / 왜
구인자 공고 등록을 항목별 전용 화면 네비게이션에서 **단일 화면 카드형 "주문서"**(프리셋 채움 + 행 탭 → 바텀시트)로 전면 개편. 타깃([[target-market]])인 홀덤펍 사장의 상시 단발 공고를 "탭 몇 번"으로 끝내는 게 목표 — 프리셋 캐러셀("마지막 공고" + 저장 템플릿)이 전체 구성을 1탭에 교체한다.

## 출하 (배포 게이트 실측)
- **마이그**: `job_postings.conditions` jsonb nullable(additive·멱등) prod 적용. 파리티 가드는 함수·정책·pg_temp만 카운트 → 컬럼 추가 무해(실측).
- **PR#246**(본): SDD 11태스크(태스크당 opus 구현 + fable 리뷰) + 최종 whole-branch 리뷰. squash `beb28d1f0`.
- **PR#247**(후속): conditions 지원자 표시 UI + 폴리시 소건 5. squash `0326682f4`. code-reviewer(fable) APPROVE.
- **OTA**: production channel, android+ios, update group `4193f9ab`. env-inject 검증(dist .hbc 번들 + EAS 서버 env `EXPO_PUBLIC_SUPABASE_URL` prod 일치 — [[wallet-iap-removal]] 시절 PortOne 빈값 재앙과 대비).

## 폼 계약·매퍼 (상세는 [[order-sheet-form-contract]])
- `orderSheetValuesSchema`(`orderSheet.schema.ts`)가 **z.input(폼 상태)/z.output(제출)** 2형. RHF `useForm<z.input, unknown, z.output>` **3제네릭 필수**.
- canonical 매퍼(`mappers.ts`)가 OrderSheetValues ↔ 기존 draft 왕복 — **신구 등가성 테스트**로 기존 create 경로와 동일 산출 보장.

## 재발 방지 교훈 (이 개편이 노출/사전적발)
1. **conditions 왕복 9지점** — 신규 컬럼의 매핑 지점이 4가 아니라 9(쓰기4+템플릿2+읽기+수정). 계획 리뷰가 사전 적발. 상세·규칙은 [[whitelist-silent-drop]] 실증 #3.
2. **읽기 배선 ≠ 표시 UI**: `deserializeJobPostingDocument`(`serialization.ts:499`)가 entity에 conditions를 hydrate해도, 지원자가 보는 **표시 UI**(`JobDetail.tsx` '모집 조건' 섹션)는 별개 — 계획이 쓰기 파이프만 잡아 표시가 갭으로 남았고 PR#247이 완결. "필드가 읽히는가"와 "화면에 뜨는가"는 다른 질문.
3. **Design B 승인 일탈** + **#244 지연 전환 가드** + **guaranteedHours PROVIDED_FLAG(-1) 금지**(문서게이트 min(0) reject→등록 사망) + **중첩 RN Modal→embedded overlay**([[ios-userflow-fixes]] #244). → [[order-sheet-form-contract]].

## 폴리시 소건 (PR#247)
프리셋 ⚡이모지→Lucide `ZapIcon`(이모지 상태표시 안티패턴 해소) · `CheckIcon` stroke 2.0 · ConditionsSheet confirm 시 trim · TimeSlotsSheet roles 깊은복사(참조 변형 차단) · TemplateModal onSave try/catch(이중 토스트 없음 — 피드백은 `useTemplateManager` saveMutation.onError 소유).

## 후속 (이 소스 범위 밖 — 2026-07-16 주석)
본 소스는 #246/#247(키오스크 개편·conditions)만 문서화. 이후 주문서 폼 계약이 확장됨 — #252(역할별 급여 기본화)·#253(일정 그룹 복원 `scheduleGroups`)·#257(지역 필수화). scheduleGroups·roleSalaries 커버리지 계약은 [[order-sheet-form-contract]] §6.

관련: [[order-sheet-form-contract]] · [[whitelist-silent-drop]] · [[ios-userflow-fixes]] · [[layers]] · [[target-market]]
