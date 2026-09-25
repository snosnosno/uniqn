/**
 * UNIQN Mobile — 앱 내 채팅 상수 (단일 출처)
 *
 * 서버 값과 짝을 이루는 상수는 S1 마이그(`20260925100000_chat_schema_and_rpcs.sql`)와 같아야 한다.
 */

/**
 * 채팅 사진 버킷 id.
 * ⚠️ 구 `'chat'` 버킷(2026-08 owner-scope 정리 대상)과 다르다 — 이 상수만 쓴다.
 */
export const CHAT_MEDIA_BUCKET = 'chat-media';

/**
 * (S4 M1) 사진 접수 창구 버킷 — 앱은 여기에만 올린다. `chat-media` 직접 쓰기는 서버가 봉쇄했고,
 * 정화 EF(`CHAT_MEDIA_SANITIZE_FUNCTION`)가 EXIF 를 떼고 `chat-media` 의 같은 경로로 옮긴다.
 */
export const CHAT_MEDIA_INBOX_BUCKET = 'chat-media-inbox';

/** (S4 M1) 사진 정화 Edge Function 이름 */
export const CHAT_MEDIA_SANITIZE_FUNCTION = 'chat-media-sanitize';

/** 메시지 본문 최대 길이 — 서버 `chat_msg_shape_chk`(1~1000자)와 같다 */
export const CHAT_MESSAGE_MAX_LENGTH = 1000;

/** 목록·과거 메시지 한 페이지 크기 */
export const CHAT_PAGE_SIZE = 30;

/** 실시간 꼬리(tail) 조회 상한 — 넘으면 과거 페이지를 새로 받는다 */
export const CHAT_TAIL_CAP = 200;

/** 사진 재인코딩: 긴 변 픽셀 */
export const CHAT_IMAGE_LONG_EDGE = 1600;

/** 사진 재인코딩: JPEG 품질 */
export const CHAT_JPEG_QUALITY = 0.8;

/** 사진 업로드 상한(바이트) — 서버 버킷 `file_size_limit` 1.5MB 와 같다 */
export const CHAT_MAX_UPLOAD_BYTES = 1572864;

/** 사진 서명 URL 유효 시간(초) — 보안 리뷰 L9 권고로 5분 */
export const CHAT_SIGNED_URL_TTL_SEC = 300;

/** 안 읽음 배지 상한 — 서버가 99 에서 세기를 멈춘다 */
export const CHAT_UNREAD_CAP = 99;

/** (S4) 신고 사유 코드 — 서버 `chat_report_message` 의 p_reason 허용값과 같다 */
export const CHAT_REPORT_REASONS = ['abuse', 'scam', 'sexual', 'spam', 'other'] as const;
export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];

/** (S4) 신고 사유 라벨 — 신고 시트와 관리자 신고 상세가 같이 쓴다 */
export const CHAT_REPORT_REASON_LABELS: Record<ChatReportReason, string> = {
  abuse: '욕설·비하',
  scam: '사기·금전 요구',
  sexual: '음란·불쾌한 사진',
  spam: '스팸·광고',
  other: '기타',
};

/** (S4) 신고 설명 최대 길이 — 서버 p_detail 상한과 같다 */
export const CHAT_REPORT_DETAIL_MAX_LENGTH = 500;
