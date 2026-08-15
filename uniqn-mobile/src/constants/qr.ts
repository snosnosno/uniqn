/**
 * QR 페이로드 타입과 문구 (S3-5).
 *
 * 🚨 **이 파일이 존재하는 진짜 이유는 오스캔 사고 방지다.**
 *   앱에는 성격이 완전히 다른 두 QR 이 있다:
 *     · 출근 QR(`venue`) — 사장이 현장에 띄우고 **스태프가 찍는다**. 찍으면 출퇴근이 기록된다.
 *     · 지원 QR(`apply`) — 사장이 홍보물에 싣고 **구직자가 찍는다**. 찍으면 공고가 열린다.
 *   둘이 같은 `type` 을 쓰거나 문구가 비슷하면, 현장에서 스태프가 지원 QR 을 찍고
 *   "출근됐겠지" 하고 일을 시작한다 — 그리고 퇴근 때 출근 기록이 없다는 걸 안다.
 *   그래서 ① type 을 반드시 다르게 두고 ② 잘못 찍었을 때 **무엇을 찍었는지 말해 준다.**
 *
 * ⚠️ 기존 출퇴근 QR 문구는 `QRCodeScanner.tsx` / `QRCodeScanner.web.tsx` / `eventQRService.ts` 에
 *    각각 인라인 하드코딩돼 있다(웹/네이티브 이중화). 여기서는 **이번에 실제로 건드리는 문구만**
 *    옮긴다 — 전면 상수화는 `e2e/` 가 리터럴을 수동 동기화하고 있어(eslint ignores 라
 *    `npm run quality` 범위 밖) 별도 작업으로 분리하는 편이 안전하다.
 */

/**
 * QR 페이로드 `type` 값. **두 값은 절대 같아질 수 없다** — 스캐너가 이걸로 용도를 가른다.
 */
export const QR_PAYLOAD_TYPES = {
  /** 출근 QR — 스태프가 찍어 출퇴근을 기록한다 */
  venue: 'venue',
  /** 지원 QR — 구직자가 찍어 공고 상세로 이동한다 */
  apply: 'apply',
} as const;

export type QRPayloadType = (typeof QR_PAYLOAD_TYPES)[keyof typeof QR_PAYLOAD_TYPES];

export const QR_MESSAGES = {
  /** 출근 스캐너에 정체불명 QR 을 댔을 때 */
  notCheckInQR: 'UNIQN 출근 QR이 아닙니다',
  /**
   * 출근 스캐너에 **지원 QR** 을 댔을 때.
   * 그냥 "출근 QR이 아닙니다" 로 끝내면 사용자는 왜 안 되는지 모르고 같은 QR 을 계속 찍는다.
   * 무엇을 찍었는지 + 무엇을 찍어야 하는지를 함께 말한다.
   */
  applyQRScannedAtCheckIn:
    '이건 공고 지원용 QR이에요. 출근하려면 사장님이 보여주는 출근 QR을 찍어주세요.',
  /** 지원 QR 화면 제목 — 출근 QR 화면과 헷갈리지 않게 '지원' 을 앞에 둔다 */
  applyQRTitle: '지원 QR',
  applyQRDescription: '구직자가 이 QR을 찍으면 공고가 바로 열려요.',
  /** 🚨 출근 QR 과 혼동하지 않도록 화면에 못박아 둔다 */
  applyQRNotCheckInNotice: '출근용이 아니에요. 현장 출근은 출퇴근 QR을 따로 사용하세요.',
} as const;
