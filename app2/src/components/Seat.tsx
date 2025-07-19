import React from 'react';
import { useDrag, useDrop } from 'react-dnd';

import { Table } from '../hooks/useTables';

const ItemTypes = {
  SEAT: 'seat',
};

export interface SeatProps {
  table: Table;
  seatIndex: number;
  participantId: string | null;
  getParticipantName: (id: string | null) => string;
  onMoveSeat: (
    participantId: string,
    from: { tableId: string; seatIndex: number },
    to: { tableId: string; seatIndex: number }
  ) => void;
  onBustOut: (participantId: string) => void;
}

export const Seat: React.FC<SeatProps> = ({ table, seatIndex, participantId, getParticipantName, onMoveSeat }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.SEAT,
    item: { participantId, from: { tableId: table.id, seatIndex } },
    canDrag: !!participantId,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [participantId, table.id, seatIndex]);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.SEAT,
    drop: (item: { participantId: string; from: { tableId: string; seatIndex: number } }) => {
      if (item.participantId) {
        onMoveSeat(item.participantId, item.from, { tableId: table.id, seatIndex });
      }
    },
    canDrop: () => !participantId, // Crucial fix: Can only drop on an empty seat.
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [table.id, seatIndex, onMoveSeat, participantId]);

  const participantName = getParticipantName(participantId);
  
  const getBackgroundColor = () => {
    if (isOver && canDrop) {
      return 'bg-green-200'; // Highlight drop target
    }
    if (participantId) {
      return 'bg-blue-100 text-blue-800 cursor-pointer';
    }
    return 'bg-gray-200 border-2 border-dashed border-gray-400';
  }

  return (
    <div
      ref={(node) => drag(drop(node))}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className={`relative p-2 rounded-md h-16 flex flex-col justify-center items-center text-xs group ${getBackgroundColor()}`}
    >
      <span className="font-bold text-sm mb-1">{seatIndex + 1}</span>
      <span className="font-semibold">{participantName}</span>
    </div>
  );
};
