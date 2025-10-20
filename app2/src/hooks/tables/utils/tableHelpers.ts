/**
 * tableHelpers.ts
 *
 * 테이블 관련 유틸리티 함수 모음
 * - 배열 셔플, 경로 생성, 검증 로직 등
 */

import { Table } from '../../useTables';

/**
 * 배열을 무작위로 섞습니다 (Fisher-Yates 알고리즘)
 * @template T 배열 요소 타입
 * @param array 섞을 배열
 * @returns 섞인 새 배열
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = newArray[i]!;
    newArray[i] = newArray[j]!;
    newArray[j] = temp;
  }
  return newArray;
};

/**
 * 멀티테넌트 환경에서 테이블의 실제 tournamentId를 가져옵니다
 * @param table 테이블 객체
 * @param fallbackId fallback으로 사용할 tournamentId
 * @returns 실제 tournamentId
 */
export const getActualTournamentId = (
  table: Table,
  fallbackId: string | null
): string => {
  return table.tournamentId || fallbackId || '';
};

/**
 * 멀티테넌트 테이블 경로를 생성합니다
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID
 * @param tableId 테이블 ID
 * @returns Firestore 경로
 */
export const getTablePath = (
  userId: string,
  tournamentId: string,
  tableId: string
): string => {
  return `users/${userId}/tournaments/${tournamentId}/tables/${tableId}`;
};

/**
 * 멀티테넌트 participants 경로를 생성합니다
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID
 * @returns Firestore 경로
 */
export const getParticipantsPath = (
  userId: string,
  tournamentId: string
): string => {
  return `users/${userId}/tournaments/${tournamentId}/participants`;
};

/**
 * 멀티테넌트 participants 문서 경로를 생성합니다
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID
 * @param participantId 참가자 ID
 * @returns Firestore 경로
 */
export const getParticipantPath = (
  userId: string,
  tournamentId: string,
  participantId: string
): string => {
  return `users/${userId}/tournaments/${tournamentId}/participants/${participantId}`;
};

/**
 * 테이블이 유효한지 검증합니다
 * @param table 검증할 테이블 객체
 * @returns 유효 여부
 */
export const isValidTable = (table: Table | null | undefined): table is Table => {
  return !!table && typeof table.id === 'string' && typeof table.tableNumber === 'number';
};

/**
 * 테이블의 빈 자리 인덱스 배열을 반환합니다
 * @param table 테이블 객체
 * @returns 빈 자리 인덱스 배열
 */
export const getEmptySeatIndexes = (table: Table): number[] => {
  if (!table.seats) return [];
  return table.seats
    .map((seat, index) => (seat === null ? index : -1))
    .filter(index => index !== -1);
};

/**
 * 테이블의 참가자 수를 계산합니다
 * @param table 테이블 객체
 * @returns 참가자 수
 */
export const getPlayerCount = (table: Table): number => {
  if (!table.seats) return 0;
  return table.seats.filter(seat => seat !== null).length;
};
