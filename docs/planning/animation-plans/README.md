# 애니메이션 개선 계획 (improve-animations 감사, 2026-07-16)

> 산출: `improve-animations` quick 감사 (커밋 `c0c6113e5`). 각 계획은 자족적 —
> 실행자는 이 대화 컨텍스트 없이 계획 파일만으로 수행 가능해야 한다.
> 실행 후 해당 계획의 Status를 갱신할 것.

## 계획 목록

> ⚠️ **2026-07-27 갱신**: 이 계획들은 폐기된 브랜치에서 한 번 구현됐다가, master 가 같은 파일을
> 다시 쓰는 바람에 **A 묶음만 master 위로 재구현**됐다(PR #350). 아래 Status 는 그 결과다.
> 재구현 규약은 `../2026-07-27-animation-reimplementation-handoff.md` 가 진실원 —
> 각 계획의 Target 과 다르게 구현된 지점이 있다(001 참조).

| # | 제목 | 심각도 | Status |
|---|---|---|---|
| [001](001-motion-tokens.md) | 모션 토큰 신설 (MOTION_EASING·MOTION_DURATION) | HIGH | **DONE** (PR #350 — 단, 신규 파일 `constants/motion.ts` 로) |
| [002](002-toast-easing.md) | Toast 입장 이징 강화 (최고빈도 모션) | HIGH | **DONE** (PR #350) |
| [003](003-reduce-motion-core-ui.md) | 코어 UI 4종 Reduce Motion + 공유 훅 추출 | HIGH | **PARTIAL** (PR #350 — Modal·Toast 만) |
| [004](004-sheet-travel-curve.md) | 시트류 travel 커브 + 75% 퇴장 규칙 | HIGH | **PARTIAL** (PR #350 — Modal 만) |
| [005](005-sheet-drag-dismiss.md) | SheetModal 드래그 dismiss (제스처) | 기회 | TODO (B 묶음 — 006 선행) |
| [006](006-sheet-exit-render-and-thresholds.md) | 시트 퇴장 렌더 보장 + 드래그 임계 스케일 | 구조 | TODO (005 선행 게이트) |

## 남은 작업 (2026-07-27 기준)

`SheetModal.tsx` 관련 전부가 **B 묶음**으로 남았고, 실기기 QA 게이트가 걸려 있다:

```
003 나머지 ── SheetModal reduce motion 분기
004 나머지 ── SheetModal travel 커브 (퇴장 250ms→225ms = 눈에 보이는 변화)
006 ─────── 실기기 관찰 선행 게이트 (퇴장이 '팝 소멸'로 보이는지 · 짧은 시트 임계)
005 ─────── 드래그 dismiss (006 해소 후. jest.setup.js 에 gesture-handler mock 부재 = 선결 과제)
```

- **충돌 주의**: 003·004·005 가 모두 `SheetModal.tsx` 한 파일을 만진다. 순차 실행 필수.
- 검증 공통: `cd uniqn-mobile && npm run quality` + `npx jest src/components/ui --silent` + 계획별 feel check.

## 보류 (계획화하지 않음)

- **희소 순간 딜라이트**(지원 완료·공고 등록 완료 스프링 체크마크 등): 대상 화면·톤이 제품 결정 사안. 결정 후 `improve-animations plan <설명>`으로 단건 계획화.

## 감사에서 기각된 항목 (재보고 금지)

- `OfflineStatusBar` 퇴장 ease-in 225ms — impeccable 룰 25 명문화 결정.
- Pressed 피드백 = 배경 톤 변화(scale 아님) — 룰 21 의도적 선택.
- `DateCalendar` LayoutAnimation — 룰 8 준수 구현(reduce motion 처리 완비).
