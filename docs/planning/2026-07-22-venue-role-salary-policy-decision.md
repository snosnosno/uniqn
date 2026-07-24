# 지점 급여 상속 결함 — 정책 결정 (2026-07-22)

> 결정 기록. 구현은 별도 세션에서 설계(HARD-GATE: 3+ 파일·DB 스키마 변경 예상 → `/plan` 먼저).

## 결함 요약 (설계 §8.2, `2026-07-22-grid-remove-repeat-actions-design.md`)

근무표 직접 배치는 `jobPostingId = containerId`(지점 자신)라 급여 정보가 없고,
정산이 `FALLBACK_SETTLEMENT_CONTEXT`(시급 ₩15,000, `constants.ts:8`)로 조용히 계산된다.
완화: 정산 화면 건별 급여 수정(`useStaffSettlementsHandlers.ts:267`)은 이미 배선됨 —
계산기는 `customSalaryInfo` 최우선(`helpers.ts:254`).

## 사용자 결정 (2026-07-22)

사용자 제약 원문:
- "역할마다 시급이나 일급 월급이 다를 수도 있고"
- "사람이 날마다 역할이 바뀔 수도 있고"
- "편집이 편해야 해"

## 채택 정책 — 지점 역할별 단가표 + 슬롯 override

1. **1차 키 = 역할(StaffRole)**: 지점(컨테이너)에 역할별 기본 급여표를 둔다.
   예: dealer=시급 20,000 · floor=일급 150,000 · serving=시급 12,000.
   급여 단위는 기존 JobPosting 급여 모델(salaryType: 시급/일급/월급 등 + 금액)을 재사용 — 새 단위 체계 발명 금지.
2. **역할 변경 자동 추종**: 슬롯의 역할이 바뀌면 급여도 그 역할의 단가로 따라간다
   (사람 고정 단가가 아니므로 "날마다 역할이 바뀌는" 케이스가 자동 해결).
3. **슬롯별 override**: EditSlotSheet(이미 시간·역할·색상·메모 편집)에 급여 override 필드를 얹는다.
   개인별 차등(경력 등)은 이 건별 override 로 커버. 정산 `customSalaryInfo` 경로와 일관.
4. **폴백 서열**: 슬롯 override > 지점 역할별 단가 > (미설정 시) 폴백 ₩15,000 + **"기본 단가 적용" 가시화 배지**.
   조용한 오답 금지 — 폴백으로 계산될 때는 정산 화면에서 표시한다.

## 기각한 대안

- **스태프별 단가장부**: 사람이 날마다 역할이 바뀌는 제약과 충돌(사람 고정 단가는 역할 차등 미해결).
- **지점 기본 시급 1개**: 역할별 차등 미해결 — ₩15,000 오답이 ₩18,000 오답이 될 뿐(설계문서 기지적).
- **슬롯별 입력만**: 매 배치 입력 부담 — "편집이 편해야 해" 제약 위반. override 는 예외 경로로만.

## 착수 시 주의

- 데이터 위치 후보: 컨테이너 `job_postings.schedule`(JSONB, softTargets 와 동거) vs 별도 컬럼/테이블 — 설계 세션에서 결정. RLS/SECDEF 영향 시 `/guard` 먼저.
- 정산 소비처: `settlementVenueQuery.ts` → `FALLBACK_SETTLEMENT_CONTEXT` 경로에 역할별 단가 해소를 삽입.
- 근무표 화면 편집 진입: 지점 설정(단가표 1회 입력)은 VenueSelector/지점 관리 쪽, 건별은 EditSlotSheet.
