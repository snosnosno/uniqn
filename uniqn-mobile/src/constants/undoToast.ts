/**
 * 되돌리기 토스트 공통 상수.
 *
 * @description "확인하고 실행"(ConfirmModal) 대신 "실행하고 되돌리기"(action 토스트)를 쓰는
 *   액션들의 공통 표현. 어포던스 단어가 화면마다 다르면 사용자는 그게 같은 기능인지 모른다.
 *
 * ⚠️ action 토스트는 dedupe 면제다(`toastStore.ts` 주석) — 같은 message+type 이 연속으로
 *   발생하면 되돌리기 어포던스가 여러 개 쌓인다. **호출부에 per-id 가드가 없으면
 *   이 상수를 쓰지 말 것.** 루프·재시도 경로에 action 토스트를 넣어서도 안 된다.
 */

/** 되돌리기 어포던스 라벨 — 앱 전역에서 같은 단어를 쓴다. */
export const UNDO_TOAST_LABEL = '되돌리기';

/**
 * 되돌리기 토스트 노출 시간(ms).
 *
 * 기본 3초는 문장을 읽고 누르기엔 짧다 — 되돌릴 수 있다는 사실 자체를 인지할 시간을 준다.
 */
export const UNDO_TOAST_DURATION_MS = 6000;
