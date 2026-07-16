# 애니메이션 개선 계획 (improve-animations 감사, 2026-07-16)

> 산출: `improve-animations` quick 감사 (커밋 `c0c6113e5`). 각 계획은 자족적 —
> 실행자는 이 대화 컨텍스트 없이 계획 파일만으로 수행 가능해야 한다.
> 실행 후 해당 계획의 Status를 갱신할 것.

## 계획 목록

| # | 제목 | 심각도 | Status |
|---|---|---|---|
| [001](001-motion-tokens.md) | 모션 토큰 신설 (MOTION_EASING·MOTION_DURATION) | HIGH | DONE |
| [002](002-toast-easing.md) | Toast 입장 이징 강화 (최고빈도 모션) | HIGH | DONE |
| [003](003-reduce-motion-core-ui.md) | 코어 UI 4종 Reduce Motion + 공유 훅 추출 | HIGH | DONE |
| [004](004-sheet-travel-curve.md) | 시트류 travel 커브 + 75% 퇴장 규칙 | HIGH | DONE |
| [005](005-sheet-drag-dismiss.md) | SheetModal 드래그 dismiss (제스처) | 기회 | IMPLEMENTED(실기기 QA 대기) |

## 권장 실행 순서·의존성

```
001 (토큰) ──┬── 002 (Toast)     ← 병렬 가능
             └── 004 (시트 커브) ← 병렬 가능
003 (reduce motion) ← 001~004과 독립, 언제든 실행 가능 (단 002·004와 같은 파일을 만지므로 순차 권장)
005 (드래그 dismiss) ← 001·004 이후 마지막
```

- **충돌 주의**: 002·003·004가 모두 `Toast.tsx`/`Modal.tsx`/`SheetModal.tsx`를 만진다. 병렬 실행하지 말고 001 → 004 → 002 → 003 → 005 순차를 권장.
- 검증 공통: `cd uniqn-mobile && npm run quality` + `npx jest src/components/ui --silent` + 계획별 feel check.

## 보류 (계획화하지 않음)

- **희소 순간 딜라이트**(지원 완료·공고 등록 완료 스프링 체크마크 등): 대상 화면·톤이 제품 결정 사안. 결정 후 `improve-animations plan <설명>`으로 단건 계획화.

## 감사에서 기각된 항목 (재보고 금지)

- `OfflineStatusBar` 퇴장 ease-in 225ms — impeccable 룰 25 명문화 결정.
- Pressed 피드백 = 배경 톤 변화(scale 아님) — 룰 21 의도적 선택.
- `DateCalendar` LayoutAnimation — 룰 8 준수 구현(reduce motion 처리 완비).
