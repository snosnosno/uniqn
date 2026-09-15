---
area: decisions
updated: 2026-09-15
status: current
sources:
  - uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx
  - uniqn-mobile/app/(employer)/my-postings/[id]/__tests__/JobPostingDetailScreen.actionHierarchy.test.tsx
  - uniqn-mobile/src/features/employer/tab/EmployerMoreMenu.tsx
  - uniqn-mobile/src/components/workSchedule/__tests__/VenueSelector.test.tsx
  - uniqn-mobile/src/components/employer/order-sheet/ScheduleSection.tsx
  - docs/planning/2026-09-13-employer-ia-session-prompts.md
  - PR#492
  - PR#493
  - PR#494
tags: [ux, ia, navigation, employer, a11y, regression]
---

# 결정: 진입점은 신호에 따라 숨기지 않는다 — 숨김은 "0개일 때"만, 그것도 같은 자리에서 바꾼다

**한 줄:** 사장은 메뉴를 **위치로** 기억한다. "지금 할 일"로 승격됐다고, 공고 종류가 다르다고, 팀원이 한 명뿐이라고 진입점을 빼면 사장은 기능이 바뀐 게 아니라 **"메뉴가 없어졌다"**고 읽는다. 밀도 정리보다 자리의 안정이 먼저다.

## 근거 (실사고 + 코드로 검증됨)

- 공고 상세에서 "지금 할 일" 카드로 승격된 진입점을 타일 목록에서 뺐더니 사장이 자리를 훑고 "메뉴가 없어졌다"고 제보했다 — 사고 기록이 코드 주석으로 남아 있다(`app/(employer)/my-postings/[id]/index.tsx:778`). 상시 공고에서도 같은 이유로 숨기지 않는다(`:741`). 회귀 방지 테스트: `JobPostingDetailScreen.actionHierarchy.test.tsx:10`.
- 공고 작성 주문서도 같은 뼈대다 — 날짜가 없어도 조건 카드를 숨기면 사장은 템플릿 조건이 사라진 줄 알고, 제출 시 **침묵 유실**로 이어진다(`ScheduleSection.tsx:56`, [[order-sheet-form-contract]]).

## 규칙

1. **"지금 할 일" 은 알림이고 목록은 지도다.** 승격 카드가 떠도 원래 자리의 진입점은 그대로 둔다.
2. **조건부 숨김은 대상이 0개일 때만.** 있다가 없어지는 전이는 금지. 1개일 때도 숨기지 않는다.
3. **0개여도 "입구"가 사라지면 안 되면, 숨기지 말고 같은 자리에서 다른 행동으로 바꾼다.**
   - ⋯ 메뉴의 팀: 나 혼자면 `팀원 초대`, 2명 이상이면 `팀` — 도착지는 둘 다 팀 화면(`EmployerMoreMenu.tsx:46`). 팀 화면으로 가는 **유일한** 진입점이라 숨기면 초대할 길이 없다.
   - 근무표 지점 선택기: 지점 1곳이면 **칩 줄만** 접고 ⚙설정·`+ 지점 추가` 는 남긴다(`VenueSelector.test.tsx:7`) — 같은 줄에 붙어 있어 통째로 숨기면 지점을 늘릴 입구가 동반 소실된다.
4. **배지는 합치지 않는다.** `3명 대기` / `취소요청 1` 을 `할 일 6` 으로 뭉치면 눌러봐야 무엇인지 안다.
5. **예외는 "보는 사람에게 도착지가 무의미할 때"뿐이다.** 협업자 화면의 `팀 보기 ›` 는 공고 소유자에게만 보인다 — 협업자 본인이 누르면 이 공고와 무관한 **자기** 팀 화면으로 간다(PR#495, 사용자 결정). 신호(개수·상태)가 아니라 **역할에 따른 의미**로 가르는 것이라 규칙 1~3 과 충돌하지 않는다.

## 폐기된 계획 (되살리지 말 것)

기획 문서(`2026-09-13-employer-ia-session-prompts.md` §2)는 "팀 링크 멤버 2명 이상일 때만"(S3), "멤버가 본인뿐이면 팀 진입점 미노출"(S5), "지점·팀 선택기 2개 이상일 때만"(S4)을 적었다. 셋 다 **이 결정과 모순**이라 실행 중 폐기됐다. 문서가 코드보다 오래됐다 — 새 세션이 기획 문서만 읽고 부활시키는 것이 이 결정의 가장 큰 재발 경로다. 상세는 [[employer-ia-redesign-2026-09]].

## 함께 지킬 것

- 접기·펼치기로 밀도를 줄일 때(숨김의 대안) `accessibilityState.expanded` 와 상태별 라벨을 같이 준다 — 눈에는 열렸는데 낭독은 닫힘이면 스크린리더 사용자에게는 여전히 "없어진" 것이다.
- 실패를 0건처럼 숨기지 않는다 — 조회 실패 시 한 줄을 지우지 말고 실패를 알린 뒤 재시도를 둔다([[error-vs-empty-state]]).
