/**
 * UNIQN Mobile - 애니메이션/타이밍 상수
 */

/**
 * 네이티브 Modal(시트) dismiss 애니메이션 대기 시간 (ms).
 *
 * iOS 에서 두 네이티브 Modal 을 겹쳐 present 하면 터치 라우팅이 깨지므로,
 * 시트를 먼저 닫고 이 시간만큼 기다린 뒤 2차 모달(QR 스캐너·확인 다이얼로그·신고)을 연다.
 * iOS pageSheet dismiss 애니메이션(~250ms)에 여유를 더한 값.
 */
export const SHEET_DISMISS_ANIMATION_MS = 300;

/**
 * 주문서 연쇄 입력에서 시트→시트 전환 대기 시간 (ms).
 *
 * 두 네이티브 Modal 을 겹쳐 present 하면 iOS 터치 라우팅이 깨지므로, 이전 시트를 먼저
 * 언마운트한 뒤 이 시간만큼 기다렸다가 다음 시트를 마운트한다.
 *
 * SHEET_DISMISS_ANIMATION_MS(300) 보다 짧은 이유: 주문서 시트는 조건부 렌더라
 * exit 애니메이션을 타지 않고 즉시 언마운트된다(visible 이 false 로 내려가지 않음).
 * 따라서 이 값은 시각 애니메이션 대기가 아니라 네이티브 dismiss 커밋 여유분이다.
 *
 * ⚠️ iOS 실기기 QA 대상 — 전환 중 터치가 먹지 않으면 300 으로 올릴 것.
 */
export const SHEET_CHAIN_SWAP_MS = 180;
