/**
 * Staff-based QR 출석 시스템 타입 정의
 *
 * @version 2.0
 * @since 2025-10-16
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - 스태프별 고유 QR 코드
 * - 동적 토큰 (3분 만료)
 * - 관리자 스캔 컨텍스트
 * - 중복 스캔 방지 (5분 쿨다운)
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 스태프 QR 페이로드
 * - 스태프별 고유 QR 코드 데이터 구조
 */
export interface StaffQRPayload {
  type: 'staff-attendance';
  version: '2.0';
  staffId: string;
  securityCode: string;  // UUID 기반 고유 코드
  generatedAt: number;   // timestamp
}

/**
 * 스태프 QR 메타데이터 (users/{userId}/qrMetadata)
 * - Firestore에 저장되는 QR 관련 정보
 */
export interface StaffQRMetadata {
  securityCode: string;
  createdAt: Timestamp;
  lastRegeneratedAt?: Timestamp;
  regenerationCount: number;
  lastUsedAt?: Timestamp;
  totalScanCount: number;
}

/**
 * QR 스캔 컨텍스트
 * - 관리자가 스캔 모드를 활성화할 때 설정
 */
export interface QRScanContext {
  eventId: string;
  eventTitle: string;
  date: string;  // YYYY-MM-DD (getKoreanDate())
  mode: 'check-in' | 'check-out';
  roundUpInterval: 15 | 30;
  location?: { lat: number; lng: number };
  activatedAt: Timestamp;
  activatedBy: string;  // managerId
}

/**
 * 스캔 이력 (scanHistory 컬렉션)
 */
export interface ScanHistory {
  id: string;  // auto-generated
  staffId: string;
  staffName: string;
  eventId: string;
  date: string;
  mode: 'check-in' | 'check-out';
  scannedAt: Timestamp;
  workLogId: string;
  scannedBy: string;  // managerId
  deviceInfo?: string;
  location?: { lat: number; lng: number };
}

/**
 * 중복 스캔 방지 (scanCooldowns 컬렉션)
 */
export interface ScanCooldown {
  key: string;  // `${staffId}_${eventId}_${date}_${mode}`
  staffId: string;
  eventId: string;
  date: string;
  mode: 'check-in' | 'check-out';
  lastScanAt: Timestamp;
  expiresAt: Timestamp;  // lastScanAt + 5분
}

/**
 * QR 스캔 결과
 */
export interface QRScanResult {
  success: boolean;
  message: string;
  workLogId?: string;
  actualTime?: Timestamp;
  adjustedScheduledTime?: Timestamp;
  staffName?: string;
  remainingCooldown?: number;  // 초 단위
}
