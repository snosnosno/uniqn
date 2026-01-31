/**
 * 공통 헬퍼 함수
 *
 * @description Cloud Functions에서 공통으로 사용되는 유틸리티 함수
 * @version 1.0.0
 */

import * as admin from 'firebase-admin';

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Firestore Timestamp를 HH:MM 형식으로 변환 (KST 기준)
 *
 * @description
 * - Firestore Timestamp는 UTC로 저장되므로 KST(UTC+9)로 변환
 * - 문자열인 경우 그대로 반환
 *
 * @param time - Firestore Timestamp, 문자열, 또는 null/undefined
 * @returns HH:MM 형식의 시간 문자열 또는 빈 문자열
 *
 * @example
 * formatTime(timestamp) // "14:30"
 * formatTime("14:30")   // "14:30"
 * formatTime(null)      // ""
 */
export function formatTime(
  time: admin.firestore.Timestamp | string | null | undefined
): string {
  if (!time) return '';

  // 문자열인 경우 그대로 반환
  if (typeof time === 'string') {
    return time;
  }

  // Firestore Timestamp인 경우
  if ('toDate' in time) {
    const utcDate = time.toDate();
    // KST로 변환 (UTC+9)
    const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
    const hours = kstDate.getUTCHours().toString().padStart(2, '0');
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return '';
}

// ============================================================================
// User ID Extraction
// ============================================================================

/**
 * staffId에서 실제 userId 추출
 *
 * @description
 * staffId 형식: {userId}_{index} 또는 {userId}
 * 인덱스가 있는 경우 앞부분의 userId만 추출
 *
 * @param staffId - 스태프 ID (userId_index 또는 userId 형식)
 * @returns 실제 사용자 ID
 *
 * @example
 * extractUserId("user123_0")  // "user123"
 * extractUserId("user123")    // "user123"
 * extractUserId("")           // ""
 */
export function extractUserId(staffId: string): string {
  if (!staffId) return '';
  return staffId.includes('_') ? staffId.split('_')[0] : staffId;
}
