import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, pointerWithin } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';

import { Table } from '../../hooks/useTables';
import { Participant } from '../../hooks/useParticipants';

import Modal from '../ui/Modal';
import { Seat } from '../tables/Seat';

interface TableDetailModalProps {
  table: Table | null;
  isOpen: boolean;
  onClose: () => void;
  getParticipantName: (id: string | null) => string;
  participants?: Participant[];
  onMoveSeat: (
    participantId: string,
    from: { tableId: string; seatIndex: number },
    to: { tableId: string; seatIndex: number }
  ) => void;
  _onBustOut: (participantId: string, tableId: string) => void;
  onPlayerSelect: (participantId: string, tableId: string, seatIndex: number, event: React.MouseEvent) => void;
  updateTableDetails: (tableId: string, data: { name?: string; borderColor?: string }) => void;
  onCloseTable: (tableId: string) => void;
  activateTable: (tableId: string) => void;
  updateTableMaxSeats: (tableId: string, newMaxSeats: number, getParticipantName: (id: string) => string) => Promise<void>;
  isDimmed?: boolean;
}

const PRESET_COLORS = [
  '#FFFFFF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7D842', '#8A2BE2', '#32CD32', '#FF8C00'
];

const TableDetailModal: React.FC<TableDetailModalProps> = ({
  table,
  isOpen,
  onClose,
  getParticipantName,
  participants,
  onMoveSeat,
  _onBustOut,
  onPlayerSelect,
  updateTableDetails,
  onCloseTable,
  activateTable,
  updateTableMaxSeats,
  isDimmed = false,
}) => {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tableName, setTableName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (table) {
      setTableName(table.name || '');
    }
  }, [table]);

  if (!table) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.data.current && over.data.current) {
      const { participantId, from } = active.data.current;
      const { tableId, seatIndex } = over.data.current;
      
      if (participantId && from && tableId !== undefined && seatIndex !== undefined) {
        onMoveSeat(participantId, from, { tableId, seatIndex });
      }
    }
  };

  const handleMaxSeatsChange = async (newMaxSeats: number) => {
    if (table) {
      try {
        await updateTableMaxSeats(table.id, newMaxSeats, (id) => getParticipantName(id) || t('tableDetailModal.participantUnknown'));
      } catch (error) {
        alert(error instanceof Error ? error.message : String(error));
      }
    }
  };

  const handleNameUpdate = (e: React.FocusEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (tableName.trim() && tableName.trim() !== table.name) {
      updateTableDetails(table.id, { name: tableName.trim() });
    }
    setIsEditingName(false);
  };

  const handleColorSelect = (e: React.MouseEvent, color: string) => {
    e.stopPropagation();
    updateTableDetails(table.id, { borderColor: color });
    setShowColorPicker(false);
  }

  const handleCloseTableClick = () => {
    if (table) {
      onCloseTable(table.id);
      onClose();
    }
  };

  const handleActivateTableClick = () => {
    if (table) {
      activateTable(table.id);
      onClose();
    }
  };

  const totalSeats = (table.seats || []).length;
  const filledSeats = (table.seats || []).filter(s => s !== null).length;
  const emptySeatCount = totalSeats - filledSeats;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title=""
      size="xl"
      showCloseButton={true}
      aria-label="테이블 세부정보"
    >
      <DndContext 
        onDragEnd={handleDragEnd}
        collisionDetection={pointerWithin}
      >
        <div className="relative">
          {isDimmed ? <div className="absolute inset-0 bg-black bg-opacity-50 z-10 rounded-md" aria-hidden="true"></div> : null}
          
          <div className="flex justify-between items-center mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                    onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: table.borderColor || '#cccccc' }}
                    title={t('tableDetailModal.changeBorderColorTitle')}
                />
                {showColorPicker ? <div className="absolute z-30 top-8 left-0 bg-white p-2 rounded-md shadow-lg flex gap-2">
                        {PRESET_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={(e) => handleColorSelect(e, color)}
                                className="w-6 h-6 rounded-full"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div> : null}
              </div>
              {isEditingName ? (
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => {e.stopPropagation(); setTableName(e.target.value);}}
                  onBlur={handleNameUpdate}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate(e)}
                  className="font-bold text-xl text-gray-800 border-b-2 border-blue-500 focus:outline-none"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h2
                  className="text-xl font-bold text-gray-800 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
                >
                  {table.name || t('tableDetailModal.defaultTableName', { number: table.tableNumber })}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600 space-x-4 mr-2">
                    <span>{t('tableDetailModal.infoParticipants')} {filledSeats}/{totalSeats}</span>
                    <span>{t('tableDetailModal.infoEmptySeats')} {emptySeatCount}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <label htmlFor="max-seats-modal" className="text-sm font-semibold">{t('tableDetailModal.labelMaxSeats')}</label>
                    <select
                        id="max-seats-modal"
                        value={totalSeats}
                        onChange={(e) => handleMaxSeatsChange(parseInt(e.target.value, 10))}
                        className="select select-bordered select-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {Array.from({ length: 8 }, (_, i) => i + 4).map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>
                {table.status === 'standby' && (
                  <button
                    onClick={handleActivateTableClick}
                    className="btn btn-primary btn-sm"
                  >
                    {t('tableDetailModal.buttonActivate')}
                  </button>
                )}
                <button
                  onClick={handleCloseTableClick}
                  className="btn btn-sm bg-red-500 hover:bg-red-600 text-white border-none"
                >
                  {t('tableDetailModal.buttonClose')}
                </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 text-center">
            {(table.seats || []).map((participantId, i) => {
              const participant = participantId ? participants?.find(p => p.id === participantId) : undefined;
              return (
                <div 
                  key={i} 
                  onClick={(e) => {
                    if (participantId) {
                      e.stopPropagation();
                      onPlayerSelect(participantId, table.id, i, e);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <Seat
                    table={table}
                    seatIndex={i}
                    participantId={participantId}
                    {...(participant && { participant })}
                    getParticipantName={getParticipantName}
                    onMoveSeat={onMoveSeat}
                    _onBustOut={() => participantId && _onBustOut(participantId, table.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </DndContext>
    </Modal>
  );
};

export default TableDetailModal;