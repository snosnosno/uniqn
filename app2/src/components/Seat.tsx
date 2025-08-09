import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import { Table } from '../hooks/useTables';
import { Participant } from '../hooks/useParticipants';

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
}

export const Seat: React.FC<SeatProps> = ({ table, seatIndex, participantId, participant, getParticipantName, onMoveSeat: _onMoveSeat, _onBustOut }) => {
  const seatId = `${table.id}-${seatIndex}`;
  
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `drag-${seatId}`,
    data: {
      participantId,
      from: { tableId: table.id, seatIndex }
    },
    disabled: !participantId,
  });

  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: `drop-${seatId}`,
    data: {
      tableId: table.id,
      seatIndex
    },
    disabled: !!participantId, // Can only drop on empty seats
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const participantName = getParticipantName(participantId);
  
  const getBackgroundColor = () => {
    if (isOver && !participantId) {
      return 'bg-green-200'; // Highlight drop target
    }
    if (participantId) {
      return 'bg-blue-100 text-blue-800 cursor-pointer';
    }
    return 'bg-gray-200 border-2 border-dashed border-gray-400';
  }

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={style}
      className={`relative p-2 rounded-md h-20 flex flex-col justify-center items-center text-xs group ${getBackgroundColor()}`}
    >
      <div
        {...(participantId ? listeners : {})}
        {...(participantId ? attributes : {})}
        className="w-full h-full flex flex-col justify-center items-center"
      >
        <span className="font-bold text-sm">{seatIndex + 1}</span>
        <span className="font-semibold truncate w-full text-center">{participantName}</span>
        {participant && participant.chips !== undefined && (
          <span className="text-green-600 font-bold text-xs mt-1">
            {participant.chips.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
};