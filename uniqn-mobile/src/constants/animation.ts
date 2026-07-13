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
