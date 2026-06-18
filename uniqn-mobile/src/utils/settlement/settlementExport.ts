/**
 * UNIQN Mobile - 정산 내역 CSV 내보내기
 *
 * @description 사업주 세무/정산 증빙용. GroupedSettlement[](계산 완료된 그룹)을
 *              CSV 문자열로 변환하고, 플랫폼별로 내보낸다(웹 다운로드 / 모바일 공유).
 *              새 네이티브 의존성 없이 RN Share + 웹 Blob 으로 구현.
 */

import { Platform, Share } from 'react-native';
import type { GroupedSettlement } from '@/types/settlement';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

const CSV_HEADER = ['스태프', '근무기간', '근무일수', '역할', '정산상태', '총정산액(원)'] as const;

// Excel 한글 깨짐 방지용 BOM
const BOM = '﻿';

/** CSV 필드 이스케이프 — 쉼표/따옴표/개행 포함 시 따옴표로 감싸고 내부 따옴표는 중복 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function settlementStatusLabel(overallStatus: GroupedSettlement['overallStatus']): string {
  switch (overallStatus) {
    case 'all_completed':
      return '정산완료';
    case 'partial':
      return '일부 정산';
    case 'all_pending':
    default:
      return '미정산';
  }
}

function formatPeriod(dateRange: GroupedSettlement['dateRange']): string {
  const { start, end } = dateRange;
  if (!start && !end) return '미정';
  if (start === end) return start;
  return `${start}~${end}`;
}

function staffLabel(group: GroupedSettlement): string {
  return group.staffProfile.name ?? group.staffProfile.nickname ?? group.staffId;
}

/**
 * GroupedSettlement[] → CSV 문자열(순수 함수).
 * 금액은 GroupedSettlement.summary.totalAmount(세후 canonical)를 그대로 사용한다.
 */
export function buildSettlementCsv(groups: GroupedSettlement[]): string {
  const rows: string[][] = [
    [...CSV_HEADER],
    ...groups.map((group) => [
      staffLabel(group),
      formatPeriod(group.dateRange),
      String(group.dateRange.totalDays),
      group.roles.join(' / '),
      settlementStatusLabel(group.overallStatus),
      String(group.summary.totalAmount),
    ]),
  ];

  return BOM + rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

export interface ExportSettlementResult {
  success: boolean;
  reason?: 'empty' | 'error';
}

/**
 * 정산 내역을 CSV 로 내보낸다.
 * - 웹: Blob 다운로드(.csv)
 * - 모바일: RN Share 로 CSV 텍스트 공유(메일/메모 등으로 저장)
 */
export async function exportSettlementCsv(
  groups: GroupedSettlement[],
  fileBaseName = '정산내역'
): Promise<ExportSettlementResult> {
  if (!groups.length) {
    return { success: false, reason: 'empty' };
  }

  const csv = buildSettlementCsv(groups);

  try {
    if (Platform.OS === 'web') {
      // 웹: Blob URL 다운로드
      if (typeof document === 'undefined') {
        return { success: false, reason: 'error' };
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileBaseName}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true };
    }

    // 모바일: CSV 텍스트 공유(파일 저장은 새 네이티브 의존성 필요 → 1차는 텍스트 공유)
    const result = await Share.share(
      { title: `${fileBaseName} CSV`, message: csv },
      { dialogTitle: '정산 내역 내보내기' }
    );
    return { success: result.action === Share.sharedAction };
  } catch (error) {
    logger.error('정산 내역 내보내기 실패', toError(error));
    return { success: false, reason: 'error' };
  }
}
