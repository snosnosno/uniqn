import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaEllipsisV, FaMoneyBillWave } from '../Icons/ReactIconsReplacement';

import { Table } from '../../hooks/useTables';
import { Participant } from '../../hooks/useParticipants';

interface TableCardProps {
  table: Table;
  onTableClick: () => void;
  isMobile: boolean;
  getDealerName: (staffId: string | null) => string;
  participants?: Participant[];
  onPlayerSelect?: (participant: Participant | null, table: Table, seatIndex: number, event?: React.MouseEvent) => void;
  tournamentColor?: string; // 토너먼트 색상
  isSelectionMode?: boolean; // 선택 모드 여부
  isSelected?: boolean; // 선택 상태
  onSelect?: (checked: boolean) => void; // 선택 핸들러
}

const TableCard: React.FC<TableCardProps> = ({
  table,
  onTableClick,
  isMobile,
  getDealerName,
  participants,
  onPlayerSelect,
  tournamentColor,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
}) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: table.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.8 : 1,
    borderColor: table.borderColor || 'transparent',
    borderLeftWidth: tournamentColor ? '8px' : '4px',
    borderLeftColor: tournamentColor || 'transparent',
  };
  
  const isStandby = table.status === 'standby';
  const playerCount = table.seats?.filter(s => s !== null).length || 0;
  const maxSeats = table.seats?.length || 9;
  
  // 테이블의 총 칩 카운트 계산 (메모이제이션으로 성능 최적화)
  const totalChips = useMemo(() => {
    if (!participants || !table.seats) return 0;
    
    return table.seats.reduce((total, participantId) => {
      if (!participantId) return total;
      const participant = participants.find(p => p.id === participantId);
      return total + (participant?.chips || 0);
    }, 0);
  }, [participants, table.seats]);

  // 참가자 정보 가져오기
  const seatInfo = useMemo(() => {
    if (!table.seats) return [];
    return table.seats.map((participantId, index) => {
      if (!participantId) return { seatNumber: index + 1, name: null, chips: 0, participant: null };
      const participant = participants?.find(p => p.id === participantId);
      return {
        seatNumber: index + 1,
        name: participant?.name || 'Unknown',
        chips: participant?.chips || 0,
        participant: participant || null
      };
    });
  }, [participants, table.seats]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative p-4 rounded-lg flex flex-col transition-shadow duration-100 bg-white dark:bg-gray-800 shadow-md hover:shadow-xl border-4 dark:border-gray-700 min-h-[200px]`}
      onClick={onTableClick}
    >
      {/* Card Header */}
      <div
        className="w-full flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700"
      >
        <div className="flex items-center gap-2 flex-1">
          {/* 선택 모드 체크박스 */}
          {isSelectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect?.(e.target.checked);
              }}
              className="w-5 h-5 cursor-pointer rounded border-gray-300 dark:border-gray-600"
            />
          )}
          <h3
              className={`font-bold text-lg truncate text-gray-900 dark:text-gray-100 ${!isMobile && !isSelectionMode ? 'cursor-grab' : ''}`}
              {...(!isSelectionMode ? listeners : {})}
              {...(!isSelectionMode ? attributes : {})}
          >
              {table.name || `Table ${table.tableNumber}`}
          </h3>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <FaUsers className="w-4 h-4 mr-1 text-gray-600 dark:text-gray-300" />
                <span>{playerCount}/{maxSeats}</span>
            </div>
            {totalChips > 0 && (
                <div className="flex items-center text-sm font-semibold text-green-600 dark:text-green-400">
                    <FaMoneyBillWave className="w-4 h-4 mr-1 text-green-600 dark:text-green-400" />
                    <span>{totalChips.toLocaleString()}</span>
                </div>
            )}
        </div>
        <button
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={(e) => {
                e.stopPropagation();
                onTableClick();
            }}
        >
            <FaEllipsisV className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Dealer Info */}
      <div className="w-full text-center mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('tableCard.dealer')} {getDealerName(table.assignedStaffId || null)}
        </p>
      </div>

      {/* Players List with Chips */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {seatInfo.map((seat) => (
          <div key={seat.seatNumber} className="text-center">
            {seat.name ? (
              <div
                className="border dark:border-gray-600 rounded p-1 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                onClick={(e) => {
                  e.stopPropagation(); // 테이블 카드 클릭 방지
                  if (onPlayerSelect && seat.participant) {
                    onPlayerSelect(seat.participant, table, seat.seatNumber - 1, e);
                  } else {
                    // fallback으로 테이블 디테일 모달 열기
                    onTableClick();
                  }
                }}
              >
                <div className="text-xs font-medium truncate text-gray-900 dark:text-gray-100">
                  {seat.seatNumber}. {seat.name}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 font-bold">
                  {seat.chips.toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="border dark:border-gray-600 border-dashed rounded p-1 opacity-50">
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {seat.seatNumber}. 빈자리
                </div>
                <div className="text-xs text-gray-300 dark:text-gray-600">
                  -
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isStandby ? <div className="absolute inset-0 bg-gray-400 dark:bg-gray-600 bg-opacity-50 dark:bg-opacity-60 flex items-center justify-center rounded-lg pointer-events-none">
              <span className="text-white font-bold text-lg bg-black dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 px-4 py-2 rounded">{t('common.status.pending')}</span>
          </div> : null}
    </div>
  );
};

export default TableCard;
