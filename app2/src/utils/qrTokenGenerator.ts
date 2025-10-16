/**
 * QR 토큰 생성 및 검증 유틸리티
 *
 * @version 1.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - TOTP (Time-based One-Time Password) 알고리즘 기반
 * - 1분 주기 자동 재생성
 * - HMAC-SHA256 암호화
 * - 클라이언트 사이드 생성으로 비용 최적화
 */

import CryptoJS from 'crypto-js';

/**
 * QR 토큰 생성 (TOTP 기반)
 *
 * @param eventId 공고(이벤트) ID
 * @param date 날짜 (YYYY-MM-DD 형식)
 * @param type QR 타입 ('check-in' | 'check-out')
 * @param seed 시드 값 (UUID)
 * @param timestamp 현재 타임스탬프 (밀리초)
 * @returns 16자리 16진수 토큰
 *
 * @example
 * ```typescript
 * const token = generateQRToken(
 *   'event-123',
 *   '2025-01-16',
 *   'check-in',
 *   'seed-uuid-value',
 *   Date.now()
 * );
 * // => "a1b2c3d4e5f6g7h8"
 * ```
 */
export function generateQRToken(
  eventId: string,
  date: string,
  type: 'check-in' | 'check-out',
  seed: string,
  timestamp: number
): string {
  // 1분 단위로 타임슬롯 계산 (밀리초 → 분)
  const timeSlot = Math.floor(timestamp / 60000);

  // 메시지 생성: eventId:date:type:timeSlot
  const message = `${eventId}:${date}:${type}:${timeSlot}`;

  // HMAC-SHA256 해시 생성
  const hash = CryptoJS.HmacSHA256(message, seed);

  // 16자리 16진수 문자열로 변환
  return hash.toString(CryptoJS.enc.Hex).substring(0, 16);
}

/**
 * QR 토큰 검증
 *
 * @param token 검증할 토큰
 * @param eventId 공고(이벤트) ID
 * @param date 날짜 (YYYY-MM-DD 형식)
 * @param type QR 타입
 * @param seed 시드 값
 * @param scannedTimestamp 스캔 타임스탬프 (밀리초)
 * @param validityWindowMinutes 유효성 윈도우 (분) - 기본 2분
 * @returns 검증 결과 객체
 *
 * @example
 * ```typescript
 * const result = validateQRToken(
 *   'a1b2c3d4e5f6g7h8',
 *   'event-123',
 *   '2025-01-16',
 *   'check-in',
 *   'seed-uuid-value',
 *   Date.now(),
 *   2 // 2분 유효성 윈도우
 * );
 *
 * if (result.isValid) {
 *   console.log('토큰 유효:', result.matchedTimestamp);
 * } else {
 *   console.error('토큰 무효:', result.error);
 * }
 * ```
 */
export function validateQRToken(
  token: string,
  eventId: string,
  date: string,
  type: 'check-in' | 'check-out',
  seed: string,
  scannedTimestamp: number,
  validityWindowMinutes: number = 2
): {
  isValid: boolean;
  matchedTimestamp?: number;
  error?: string;
} {
  // 현재 타임슬롯 계산
  const currentTimeSlot = Math.floor(scannedTimestamp / 60000);

  // 유효성 윈도우 범위 확인 (이전 N분부터 현재까지)
  const startTimeSlot = currentTimeSlot - validityWindowMinutes;
  const endTimeSlot = currentTimeSlot;

  // 각 타임슬롯에 대해 토큰 생성 및 비교
  for (let timeSlot = startTimeSlot; timeSlot <= endTimeSlot; timeSlot++) {
    const expectedToken = generateQRToken(
      eventId,
      date,
      type,
      seed,
      timeSlot * 60000
    );

    if (expectedToken === token) {
      return {
        isValid: true,
        matchedTimestamp: timeSlot * 60000
      };
    }
  }

  return {
    isValid: false,
    error: '토큰이 만료되었거나 유효하지 않습니다.'
  };
}

/**
 * 시드 생성 (UUID v4)
 *
 * @returns UUID v4 형식의 시드
 *
 * @example
 * ```typescript
 * const seed = generateSeed();
 * // => "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateSeed(): string {
  // UUID v4 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 토큰 만료까지 남은 시간 계산 (초)
 *
 * @param currentTimestamp 현재 타임스탬프 (밀리초)
 * @returns 만료까지 남은 초
 *
 * @example
 * ```typescript
 * const remainingSeconds = getTokenExpirySeconds(Date.now());
 * console.log(`${remainingSeconds}초 후 새 QR 코드 생성`);
 * ```
 */
export function getTokenExpirySeconds(currentTimestamp: number): number {
  const currentTimeSlot = Math.floor(currentTimestamp / 60000);
  const nextTimeSlot = currentTimeSlot + 1;
  const nextTimeSlotMs = nextTimeSlot * 60000;
  const remainingMs = nextTimeSlotMs - currentTimestamp;
  return Math.ceil(remainingMs / 1000);
}

/**
 * QR 페이로드 생성 (JSON 인코딩)
 *
 * @param eventId 공고(이벤트) ID
 * @param date 날짜 (YYYY-MM-DD 형식)
 * @param type QR 타입
 * @param token 생성된 토큰
 * @param timestamp 생성 타임스탬프
 * @returns JSON 문자열
 *
 * @example
 * ```typescript
 * const payload = generateQRPayload(
 *   'event-123',
 *   '2025-01-16',
 *   'check-in',
 *   'a1b2c3d4e5f6g7h8',
 *   Date.now()
 * );
 * // JSON 문자열로 QR 코드에 인코딩
 * ```
 */
export function generateQRPayload(
  eventId: string,
  date: string,
  type: 'check-in' | 'check-out',
  token: string,
  timestamp: number
): string {
  return JSON.stringify({
    eventId,
    date,
    type,
    token,
    timestamp,
    version: '1.0'
  });
}

/**
 * QR 페이로드 파싱
 *
 * @param payloadString JSON 문자열
 * @returns 파싱된 페이로드 객체 또는 null
 *
 * @example
 * ```typescript
 * const payload = parseQRPayload(qrCodeData);
 * if (payload) {
 *   console.log('이벤트 ID:', payload.eventId);
 *   console.log('타입:', payload.type);
 * }
 * ```
 */
export function parseQRPayload(payloadString: string): {
  eventId: string;
  date: string;
  type: 'check-in' | 'check-out';
  token: string;
  timestamp: number;
  version: '1.0';
} | null {
  try {
    const payload = JSON.parse(payloadString);

    // 필수 필드 검증
    if (
      !payload.eventId ||
      !payload.date ||
      !payload.type ||
      !payload.token ||
      !payload.timestamp ||
      !payload.version
    ) {
      return null;
    }

    // 타입 검증
    if (payload.type !== 'check-in' && payload.type !== 'check-out') {
      return null;
    }

    // 버전 검증
    if (payload.version !== '1.0') {
      return null;
    }

    return payload as {
      eventId: string;
      date: string;
      type: 'check-in' | 'check-out';
      token: string;
      timestamp: number;
      version: '1.0';
    };
  } catch {
    return null;
  }
}

/**
 * 라운드업 시간 계산 (퇴근 시 사용)
 *
 * @param timestamp 원본 타임스탬프 (밀리초)
 * @param intervalMinutes 라운드업 간격 (15 또는 30분)
 * @returns 라운드업된 타임스탬프
 *
 * @example
 * ```typescript
 * // 15:47 → 16:00 (15분 단위)
 * const rounded = roundUpTimestamp(
 *   new Date('2025-01-16T15:47:00').getTime(),
 *   15
 * );
 * // => 16:00 타임스탬프
 *
 * // 15:47 → 16:00 (30분 단위)
 * const rounded30 = roundUpTimestamp(
 *   new Date('2025-01-16T15:47:00').getTime(),
 *   30
 * );
 * // => 16:00 타임스탬프
 * ```
 */
export function roundUpTimestamp(
  timestamp: number,
  intervalMinutes: 15 | 30
): number {
  const date = new Date(timestamp);
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();

  // 현재 분이 정확히 간격의 배수이고 초/밀리초가 0이면 그대로 반환
  if (minutes % intervalMinutes === 0 && seconds === 0 && milliseconds === 0) {
    return timestamp;
  }

  // 다음 간격까지 올림
  const nextInterval = Math.ceil(minutes / intervalMinutes) * intervalMinutes;

  // 새 Date 객체 생성
  const roundedDate = new Date(date);
  roundedDate.setMinutes(nextInterval, 0, 0);

  return roundedDate.getTime();
}
