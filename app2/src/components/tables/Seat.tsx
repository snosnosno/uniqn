import React from 'react';

import { Table } from '../../hooks/useTables';
import { Participant } from '../../hooks/useParticipants';
import { logger } from '../../utils/logger';

export interface SeatProps {
  table: Table;
  seatIndex: number;
  participantId: string | null;
  participant?: Participant;
  getParticipantName: (id: string | null) => string;
  onMoveSeat: (
    participantId: string,
    from: { tableId: string; seatIndex: number },
    to: { tableId: string; seatIndex: number }
  ) => void;
  _onBustOut: (participantId: string) => void;
  onPlayerSelect?: (participantId: string, tableId: string, seatIndex: number, event: React.MouseEvent) => void;
}

export const Seat: React.FC<SeatProps> = ({ table, seatIndex, participantId, participant, getParticipantName, onMoveSeat: _onMoveSeat, _onBustOut, onPlayerSelect }) => {
  const participantName = getParticipantName(participantId);

  const getBackgroundColor = () => {
    if (participantId) {
      return 'bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 active:bg-blue-300 transition-colors duration-150';
    }
    return 'bg-gray-200 border-2 border-dashed border-gray-400';
  };

  const handleClick = (event: React.MouseEvent) => {
    if (participantId && onPlayerSelect) {
      logger.info('좌석에서 참가자가 클릭되었습니다', {
        component: 'Seat',
        additionalData: {
          participantId,
          participantName: participantName,
          tableId: table.id,
          tableName: table.name,
          seatIndex,
          hasOnPlayerSelect: !!onPlayerSelect
        }
      });

      event.preventDefault();
      event.stopPropagation();
      onPlayerSelect(participantId, table.id, seatIndex, event);
    } else {
      logger.debug('좌석 클릭이 무시되었습니다', {
        component: 'Seat',
        additionalData: {
          hasParticipant: !!participantId,
          hasOnPlayerSelect: !!onPlayerSelect,
          participantName: participantName
        }
      });
    }
  };

  return (
    <div
      onClick={participantId ? handleClick : undefined}
      className={`relative p-2 rounded-md h-20 flex flex-col justify-center items-center text-xs group ${getBackgroundColor()}`}
      role={participantId ? "button" : undefined}
      tabIndex={participantId ? 0 : undefined}
      onKeyDown={participantId ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        }
      } : undefined}
    >
      <span className="font-bold text-sm">{seatIndex + 1}</span>
      <span className="font-semibold truncate w-full text-center">{participantName}</span>
      {participant && participant.chips !== undefined && (
        <span className="text-green-600 font-bold text-xs mt-1">
          {participant.chips.toLocaleString()}
        </span>
      )}
    </div>
  );
};