/**
 * UNIQN Mobile - Undo(되돌리기) 유예 상수
 *
 * @description 파괴적 액션을 즉시 커밋하지 않고 "되돌리기" 토스트가 떠 있는 동안 유예하는 시간.
 *              템플릿 삭제(`useTemplateManager`)와 알림 삭제(`useNotifications`)가 같은 값을 쓴다 —
 *              화면마다 유예 시간이 갈리면 사용자가 "여긴 되돌아가는데 저긴 안 된다"를 학습한다.
 *
 * ⚠️ 로컬 복제 금지. 새 Undo 액션도 반드시 이 상수를 import 할 것.
 *
 * import 는 배럴(`@/constants`)이 아니라 `@/constants/undo` 직접 경로를 쓴다
 * (배럴 상수 순환 참조로 모듈 스코프 값이 undefined 가 되는 함정이 재발한 이력 —
 *  `src/constants/motion.ts` 상단 주석 참조).
 */

/**
 * 되돌리기 유예 시간 (ms).
 *
 * 토스트 노출 시간(`duration`)과 같은 값을 써야 "버튼이 사라진 직후 커밋" 이 성립한다.
 * 이 값을 줄이면 되돌릴 시간이 부족하고, 늘리면 화면을 떠날 때 flush 되는 삭제가 많아진다.
 */
export const UNDO_DELAY_MS = 5000;
