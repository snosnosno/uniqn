import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaEllipsisV } from './Icons/ReactIconsReplacement';

import { Table } from '../hooks/useTables';

interface TableCardProps {
  table: Table;
  onTableClick: () => void;
  isMobile: boolean;
  getDealerName: (dealerId: string | null) => string;
}

const TableCard: React.FC<TableCardProps> = ({
  table,
  onTableClick,
  isMobile,
  getDealerName,
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
  };
  
  const isStandby = table.status === 'standby';
  const playerCount = table.seats?.filter(s => s !== null).length || 0;
  const maxSeats = table.seats?.length || 9;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative p-4 rounded-lg flex flex-col transition-shadow duration-100 bg-white shadow-md hover:shadow-xl border-4 min-h-[120px] justify-center`}
      onClick={onTableClick}
    >
      {/* Card Header */}
      <div 
        className="w-full flex justify-between items-center mb-3 pb-2 border-b"
      >
        <h3 
            className={`font-bold text-lg truncate ${!isMobile ? 'cursor-grab' : ''}`}
            {...listeners} 
            {...attributes}
        >
            {table.name || `Table ${table.tableNumber}`}
        </h3>
        <div className="flex items-center text-sm text-gray-600">
            <FaUsers className="w-4 h-4 mr-2" />
            <span>{playerCount} / {maxSeats}</span>
        </div>
        <button 
            className="p-2 rounded-full hover:bg-gray-200" 
            onClick={(e) => { 
                e.stopPropagation(); 
                onTableClick();
            }}
        >
            <FaEllipsisV className="w-4 h-4" />
        </button>
      </div>

      {/* Dealer Info */}
      <div className="w-full text-center">
        <p className="text-sm text-gray-500">
          {t('tableCard.dealer')} {getDealerName(table.assignedDealerId || null)}
        </p>
      </div>

      {isStandby ? <div className="absolute inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center rounded-lg pointer-events-none">
              <span className="text-white font-bold text-lg bg-black bg-opacity-50 px-4 py-2 rounded">{t('tableCard.waiting')}</span>
          </div> : null}
    </div>
  );
};

export default TableCard;
