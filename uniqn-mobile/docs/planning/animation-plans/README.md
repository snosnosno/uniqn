# 모션 개선 계획 — 실행 순서

`/improve-animations` 감사(2026-09-21, 커밋 `d824729`) 결과로 작성된 11개 계획. 148개 화면 + 44개 UI 컴포넌트 전수 감사(공용 UI/`(app)`/`(employer)`/`(admin)+(ops)+(auth)+(public)` 4개 영역 병렬 감사 후 직접 재검증) 기반.

## 상태

| # | 제목 | 심각도 | 상태 | 파일 수 |
|---|---|---|---|---|
| 001 | Modal/SignupForm 바운스·오버슈트 제거 | HIGH | TODO | 2 |
| 002 | LayoutAnimation 호출부에 reduceMotion 가드 추가 | HIGH | TODO | 6 |
| 003 | 공용 UI 프리미티브 Reanimated에 reduceMotion 적용 | HIGH | TODO | 3 |
| 004 | 알림 리스트에 reduceMotion 적용 | HIGH | TODO | 2 |
| 005 | 온보딩/회원가입 진입 애니메이션에 reduceMotion 적용 | HIGH | TODO | 3 |
| 006 | 퇴장 애니메이션 75% 규칙 정정 | MEDIUM | TODO | 2 |
| 007 | MOTION_EASING/MOTION_DURATION 토큰 소비 통일 | MEDIUM | TODO | 4 |
| 008 | DateCalendar/SlotCard SSOT 훅 전환 | MEDIUM | TODO | 2 |
| 009 | Accordion 아이콘 회전 죽은 코드 수정 | MEDIUM | TODO | 1 |
| 010 | LayoutAnimation→Reanimated 전환 | MEDIUM | TODO | 6 |
| 011 | 놓친 기회 4건(전환 모션 추가) | LOW-MEDIUM | TODO | 4 |

## 권장 실행 순서 및 의존성

```
1단계 (독립적으로 바로 실행 가능, 병렬 가능)
  001 ─┐
  002 ─┤
  003 ─┼─→ 서로 겹치는 파일 없음, 순서 무관
  004 ─┤
  005 ─┤
  008 ─┘

2단계 (1단계 일부에 의존)
  006 ─→ SheetModal.tsx 부분은 001과 무관, NotificationItem/Group 부분은
         004가 이미 처리했다면 자동 충족 (004 먼저 권장)
  007 ─→ SheetModal.tsx 대상 부분은 006 이후 실행 권장(같은 라인을 다룸),
         SlotCard.tsx 대상 부분은 008과 무관

3단계 (1단계에 강하게 의존 — 반드시 순서 준수)
  009 ─→ Accordion.tsx 본체 로직은 002가 먼저 적용되어 있어야 함
         (reduceMotion 변수를 재사용)

4단계 (가장 큰 리팩터 — 001~003·009 완료 후, 후순위 권장)
  010 ─→ 002가 6개 대상 파일 전부에 적용되어 있어야 함(reduceMotion 재사용).
         006에서 보류한 "LayoutAnimation 프리셋 방향 비대칭" 문제를 이 단계가 해소한다.

5단계 (독립적, 언제든 — additive)
  011 ─→ ScheduleConditionCard.tsx 항목은 이미 reduceMotion/LinearTransition이
         있어 의존성 없음. 나머지 3항목도 서로 독립적.
```

**요약**: 001·002·003·004·005·008은 지금 바로, 어떤 순서로든 병렬 실행 가능(파일이 겹치지 않음 — 단, 002와 008이 같은 파일을 건드리지 않는지는 각 계획의 대상 파일 목록으로 확인됨: 겹치지 않음). 006·007은 그 다음(같은 파일의 후속 수정이라 순서가 있으면 충돌을 피하기 쉬움). 009는 002 이후. 010은 가장 마지막(리팩터 규모가 크고 002에 의존) — 급하지 않다면 스킵하거나 별도 스프린트로 미뤄도 무방. 011은 아무 때나.

## 감사에서 확인된 참고사항 (재작업 방지용)

- **이미 정책을 준수 중인 예시(참고용 exemplar)**: `Toast.tsx`(MOTION_EASING/MOTION_DURATION 정확히 소비 + reduceMotion ref 패턴), `GroupedScheduleCard.tsx`/`app/(app)/(tabs)/schedule.tsx`(LayoutAnimation + reduceMotion 가드 패턴), `ScheduleConditionCard.tsx`(useReduceMotion + LinearTransition + MOTION_DURATION 토큰 — 이미 모범적). 계획 002·003·004·005 실행 시 이 파일들을 그대로 베낀다.
- **이번 범위에서 발견 없음**: `src/components/admin/**`, `src/components/ops/**`, `src/components/review/**`, `src/components/workspace/**`, `src/components/settings/**`, `src/components/profile/**`, `src/components/version/**`, `src/components/headers/**`, `src/components/navigation/**`, `src/components/modals/**` — grep 기준 애니메이션 코드 자체가 없음(정적 UI). 향후 이 디렉터리에 모션이 추가되면 재감사 필요.
- **`NotificationBadge.tsx`는 의도적으로 계획 대상에서 제외**(계획 004 Problem 절 참고) — 순수 opacity 전용이라 이미 정책 준수 상태.
