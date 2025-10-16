/**
 * QR 출석 시스템 타입 정의
 *
 * @version 1.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - 1분 주기 자동 재생성 QR 코드
 * - 출근/퇴근 분리된 QR 코드
 * - TOTP 기반 일회용 토큰
 * - 클라이언트 사이드 생성 (비용 최적화)
 */

import { Timestamp } from 'firebase/firestore';

/**
 * QR 시드 (일별 1개, 하루 1회 생성)
 * @description Firestore 컬렉션: eventQRSeeds/{eventId}_{date}
 */
export interface EventQRSeed {
  /** 공고(이벤트) ID */
  eventId: string;

  /** 날짜 (YYYY-MM-DD 형식) */
  date: string;

  /** 랜덤 시드 (UUID) - TOTP 생성용 */
  seed: string;

  /** 퇴근 시 라운드업 간격 (분) */
  roundUpInterval?: 15 | 30;

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 생성자 ID */
  createdBy: string;

  /** 만료 시간 (다음날 00:00) */
  expiresAt: Timestamp;
}

/**
 * QR 코드 페이로드 (JSON 문자열로 인코딩)
 * @description QR 코드에 포함되는 데이터
 */
export interface QRCodePayload {
  /** 공고(이벤트) ID */
  eventId: string;

  /** 날짜 (YYYY-MM-DD 형식) */
  date: string;

  /** QR 타입 */
  type: 'check-in' | 'check-out';

  /** 생성된 토큰 (HMAC-SHA256 기반) */
  token: string;

  /** 토큰 생성 시간 (유효성 검증용) */
  timestamp: number;

  /** 버전 (추후 호환성 유지용) */
  version: '1.0';
}

/**
 * 사용된 토큰 기록
 * @description Firestore 컬렉션: usedTokens/{token}
 * @note 1-2분 후 자동 삭제 (TTL)
 */
export interface UsedToken {
  /** 토큰 (문서 ID와 동일) */
  token: string;

  /** 공고(이벤트) ID */
  eventId: string;

  /** 날짜 (YYYY-MM-DD 형식) */
  date: string;

  /** QR 타입 */
  type: 'check-in' | 'check-out';

  /** 사용한 스태프 ID */
  staffId: string;

  /** 사용 시간 */
  usedAt: Timestamp;

  /** 만료 시간 (2분 후) */
  expiresAt: Timestamp;
}

/**
 * QR 출석 처리 결과
 */
export interface QRAttendanceResult {
  /** 성공 여부 */
  success: boolean;

  /** 메시지 (에러 또는 성공 메시지) */
  message: string;

  /** 업데이트된 WorkLog ID */
  workLogId?: string;

  /** 실제 출근/퇴근 시간 */
  actualTime?: Timestamp;

  /** 조정된 스케줄 시간 (퇴근 시에만 해당) */
  adjustedScheduledTime?: Timestamp;
}

/**
 * QR 생성 옵션
 */
export interface QRGenerationOptions {
  /** 공고(이벤트) ID */
  eventId: string;

  /** 날짜 (YYYY-MM-DD 형식) */
  date: string;

  /** QR 타입 */
  type: 'check-in' | 'check-out';

  /** 라운드업 간격 (퇴근 시 사용) */
  roundUpInterval?: 15 | 30;
}

/**
 * QR 스캔 처리 옵션
 */
export interface QRScanOptions {
  /** QR 페이로드 */
  payload: QRCodePayload;

  /** 스캔한 스태프 ID */
  staffId: string;

  /** 스캔 시간 (기본: 현재 시간) */
  scannedAt?: Timestamp;
}
