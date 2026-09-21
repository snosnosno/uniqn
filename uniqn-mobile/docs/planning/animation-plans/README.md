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

## ⚠️ 기대치 정렬 — 이 계획들이 실제로 바꾸는 것

이 감사의 출발점은 "앱 전체 UI/UX를 최신화하고 예쁘게"였지만, **감사 결과 이 코드베이스의 모션 시스템은 이미 잘 통제되고 있었다**. `impeccable-design.md` 34개 룰, `constants/motion.ts` 토큰, `useReduceMotion` SSOT 훅, 모범 컴포넌트(`Toast.tsx` 등)가 모두 갖춰진 상태였고, 발견된 것은 **"낡음"이 아니라 그 규약에서 이탈한 컴플라이언스 드리프트**였다.

따라서 11개 계획을 모두 실행해도 **앱이 "더 예뻐지지는" 않는다.** 실제 효과를 정직하게 나누면:

| 구분 | 계획 | 일반 사용자(동작 줄이기 OFF)가 체감하는가 |
|---|---|---|
| **보이는 변화** | 001 | ✅ 모달·회원가입 스텝의 통통 튀는 느낌이 사라짐 — 이 묶음에서 체감 폭이 가장 큼 |
| | 009 | ✅ 아코디언 셰브론이 실제로 회전 애니메이션됨(지금은 스냅) |
| | 011 | ✅ 4곳에 없던 전환 모션이 생김 |
| | 010 | ✅ 펼침/접힘 연타 시 끊김이 사라짐(미세) |
| | 006·004 일부 | ◑ 퇴장 25~50ms 빨라짐(매우 미세, 나란히 비교해야 보임) |
| **안 보이는 위생** | 002·003·005 | ❌ "동작 줄이기" 사용자에게만 영향 — 접근성 정책 준수 |
| | 007·008 | ❌ 시각적 변화 0(토큰/SSOT 리팩터). 007은 **오히려 아무것도 안 달라져야 성공** |

**즉 이 계획들의 가치는 "예뻐짐"이 아니라 접근성 정책 위반 해소 + 향후 커브 개선이 전파될 경로 확보다.** 둘 다 필요한 작업이지만, 시각적 현대화를 기대하고 실행하면 결과가 기대와 다르다.

### 시각적 현대화를 원한다면 — 이 감사 범위 밖의 후보

모션 감사는 "움직임"만 본다. 눈에 띄는 개편의 레버리지는 다른 축에 있다(모두 **미착수**, 별도 판단 필요):

1. **재질감 — `expo-blur` 미설치**: iOS 26 계열의 반투명 유리 재질이 현재 없다. `impeccable-design.md` §24가 이미 `backdrop-blur`를 스티키 헤더 스펙으로 언급하지만 실제 블러 모듈이 없어 구현 불가 상태. 공식 Expo 모듈이라 도입 비용은 낮음.
2. **밀도 — v4 룰(34번) 적용 여지**: `impeccable-design.md`가 세로 픽셀 예산(710px)·`InfoRow`·`ActionTileGrid` 기준을 이미 정해뒀고 실측 선례(`ba3d08a77`)도 있다. 아직 이 기준을 적용하지 않은 화면을 찾는 것이 "화면이 시원해 보이는" 체감 개선으로는 모션보다 효과가 크다.
3. **레퍼런스 리서치 — 디자인 MCP 미도입**: LazyWeb/InspoAI 등 실제 앱 스크린샷 MCP 도입이 보류 상태(설치 스크립트가 전역 `~/.claude/skills` 를 건드리는 문제로 사용자 결정 대기). 도입되면 "경쟁 앱은 이 화면을 어떻게 푸는가"를 근거로 개편할 수 있다.

## 감사에서 확인된 참고사항 (재작업 방지용)

- **이미 정책을 준수 중인 예시(참고용 exemplar)**: `Toast.tsx`(MOTION_EASING/MOTION_DURATION 정확히 소비 + reduceMotion ref 패턴), `GroupedScheduleCard.tsx`/`app/(app)/(tabs)/schedule.tsx`(LayoutAnimation + reduceMotion 가드 패턴), `ScheduleConditionCard.tsx`(useReduceMotion + LinearTransition + MOTION_DURATION 토큰 — 이미 모범적). 계획 002·003·004·005 실행 시 이 파일들을 그대로 베낀다.
- **이번 범위에서 발견 없음**: `src/components/admin/**`, `src/components/ops/**`, `src/components/review/**`, `src/components/workspace/**`, `src/components/settings/**`, `src/components/profile/**`, `src/components/version/**`, `src/components/headers/**`, `src/components/navigation/**`, `src/components/modals/**` — grep 기준 애니메이션 코드 자체가 없음(정적 UI). 향후 이 디렉터리에 모션이 추가되면 재감사 필요.
- **`NotificationBadge.tsx`는 의도적으로 계획 대상에서 제외**(계획 004 Problem 절 참고) — 순수 opacity 전용이라 이미 정책 준수 상태.
