import * as XLSX from 'xlsx';
import { logger } from './logger';
import { Table } from '../hooks/useTables';
import { Participant } from '../hooks/useParticipants';

/**
 * 테이블 데이터를 엑셀로 내보내기
 * 3개 테이블씩 한 행에 배치하고, 각 테이블은 번호-이름-칩 형식으로 표시
 */
export const exportTablesToExcel = (
  tables: Table[],
  participants: Participant[],
  _t: (key: string) => string
): void => {
  try {
    logger.info('테이블 엑셀 내보내기 시작', { data: { tableCount: tables.length } });

    // 워크북 생성
    const workbook = XLSX.utils.book_new();

    // 워크시트 데이터 생성
    const worksheetData: (string | number | null)[][] = [];

    // 통계 데이터 계산
    const stats = calculateStatistics(tables, participants);

    // 통계 정보를 워크시트 최상단에 추가
    worksheetData.push(['전체 칩', formatChips(stats.totalChips)]);
    worksheetData.push(['평균 칩', formatChips(Math.round(stats.averageChips))]);
    worksheetData.push(['테이블 평균 칩', formatChips(Math.round(stats.tableAverageChips))]);
    worksheetData.push(['최대 테이블 칩', formatChips(stats.maxTableChips)]);
    worksheetData.push(['최소 테이블 칩', formatChips(stats.minTableChips)]);

    // 통계와 테이블 데이터 구분을 위한 빈 행 2개 추가
    worksheetData.push([]);
    worksheetData.push([]);

    // 테이블을 3개씩 그룹화
    const tableGroups: Table[][] = [];
    for (let i = 0; i < tables.length; i += 3) {
      tableGroups.push(tables.slice(i, i + 3));
    }

    // 각 테이블 그룹 처리
    tableGroups.forEach((group, groupIndex) => {
      // 테이블 헤더 행 추가 (Table 1, 총칩 XXX, Table 2, 총칩 XXX)
      const headerRow: (string | null)[] = [];
      group.forEach((table, index) => {
        if (index > 0) headerRow.push(null); // 테이블 간 구분 열
        const tableChips = stats.tableChips[table.id] || 0;
        headerRow.push(`Table ${table.tableNumber}`, formatChips(tableChips), null);
      });
      worksheetData.push(headerRow);

      // 컬럼 헤더 행 추가 (번호, 이름, 칩)
      const columnHeaderRow: (string | null)[] = [];
      group.forEach((_, index) => {
        if (index > 0) columnHeaderRow.push(null); // 테이블 간 구분 열
        columnHeaderRow.push('번호', '이름', '칩');
      });
      worksheetData.push(columnHeaderRow);

      // 각 테이블의 최대 좌석 수 구하기
      const maxSeats = Math.max(...group.map(table => table.seats.length));

      // 좌석 데이터 행 추가
      for (let seatIndex = 0; seatIndex < maxSeats; seatIndex++) {
        const dataRow: (string | number | null)[] = [];

        group.forEach((table, tableIndex) => {
          if (tableIndex > 0) dataRow.push(null); // 테이블 간 구분 열

          const seatNumber = seatIndex + 1;
          const participantId = table.seats[seatIndex];

          if (participantId) {
            const participant = participants.find(p => p.id === participantId);
            if (participant) {
              dataRow.push(
                seatNumber,
                participant.name,
                participant.chips ? formatChips(participant.chips) : 0
              );
            } else {
              dataRow.push(seatNumber, '알 수 없음', 0);
            }
          } else if (seatIndex < table.seats.length) {
            // 빈 자리
            dataRow.push(seatNumber, '', null);
          } else {
            // 해당 테이블에 이 좌석이 없음
            dataRow.push(null, null, null);
          }
        });

        worksheetData.push(dataRow);
      }

      // 테이블 그룹 간 빈 행 2개 추가 (마지막 그룹이 아닌 경우)
      if (groupIndex < tableGroups.length - 1) {
        worksheetData.push([]);
        worksheetData.push([]);
      }
    });

    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // 열 너비 설정
    const columnWidths: XLSX.ColInfo[] = [];
    const tablesPerRow = Math.min(3, tables.length);

    for (let i = 0; i < tablesPerRow; i++) {
      if (i > 0) {
        columnWidths.push({ width: 2 }); // 구분 열
      }
      columnWidths.push({ width: 8 });  // 번호 열
      columnWidths.push({ width: 15 }); // 이름 열
      columnWidths.push({ width: 12 }); // 칩 열
    }

    worksheet['!cols'] = columnWidths;

    // 워크북에 워크시트 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, '테이블 현황');

    // 파일명 생성 (현재 날짜/시간 포함)
    const now = new Date();
    const fileName = `테이블_현황_${formatDate(now)}_${formatTime(now)}.xlsx`;

    // 파일 다운로드
    XLSX.writeFile(workbook, fileName);

    logger.info('테이블 엑셀 내보내기 완료', { data: { fileName, tableCount: tables.length } });
  } catch (error) {
    logger.error('테이블 엑셀 내보내기 실패:', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

/**
 * 칩 수량을 천 단위 콤마가 포함된 문자열로 포맷
 */
const formatChips = (chips: number): string => {
  return chips.toLocaleString('ko-KR');
};

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 시간을 HHmm 형식으로 포맷
 */
const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
};

/**
 * 통계 데이터 계산 인터페이스
 */
interface Statistics {
  totalChips: number;
  averageChips: number;
  tableAverageChips: number;
  maxTableChips: number;
  minTableChips: number;
  tableChips: { [tableId: string]: number };
}

/**
 * 전체 통계 데이터 계산
 */
const calculateStatistics = (tables: Table[], participants: Participant[]): Statistics => {
  // 각 테이블별 칩 합계 계산
  const tableChips: { [tableId: string]: number } = {};

  tables.forEach(table => {
    let tableTotal = 0;
    table.seats.forEach(participantId => {
      if (participantId) {
        const participant = participants.find(p => p.id === participantId);
        if (participant && participant.chips) {
          tableTotal += participant.chips;
        }
      }
    });
    tableChips[table.id] = tableTotal;
  });

  // 전체 통계 계산
  const totalChips = Object.values(tableChips).reduce((sum, chips) => sum + chips, 0);
  const activeParticipants = participants.filter(p => p.status === 'active').length;
  const averageChips = activeParticipants > 0 ? totalChips / activeParticipants : 0;
  const tableAverageChips = tables.length > 0 ? totalChips / tables.length : 0;

  const tableChipValues = Object.values(tableChips);
  const maxTableChips = tableChipValues.length > 0 ? Math.max(...tableChipValues) : 0;
  const minTableChips = tableChipValues.length > 0 ? Math.min(...tableChipValues) : 0;

  return {
    totalChips,
    averageChips,
    tableAverageChips,
    maxTableChips,
    minTableChips,
    tableChips
  };
};