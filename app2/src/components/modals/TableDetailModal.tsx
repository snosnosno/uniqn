import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Table } from '../../hooks/useTables';
import { Participant } from '../../hooks/useParticipants';
import { Tournament } from '../../hooks/useTournaments';
import { useDateFilter } from '../../hooks/useDateFilter';

import Modal from '../ui/Modal';
import { Seat } from '../tables/Seat';
import { toast } from '../../utils/toast';
import { handleFirebaseError, isPermissionDenied, FirebaseError } from '../../utils/firebaseErrors';

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
  onPlayerSelect: (
    participantId: string,
    tableId: string,
    seatIndex: number,
    event: React.MouseEvent
  ) => void;
  updateTableDetails: (tableId: string, data: { name?: string; borderColor?: string }) => void;
  onCloseTable: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
  activateTable: (tableId: string) => void;
  updateTableMaxSeats: (
    tableId: string,
    newMaxSeats: number,
    getParticipantName: (id: string) => string
  ) => Promise<void>;
  tournaments?: Tournament[];
  assignTableToTournament?: (tableIds: string[], tournamentId: string) => Promise<void>;
  isDimmed?: boolean;
}

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
  onDeleteTable,
  activateTable,
  updateTableMaxSeats,
  tournaments = [],
  assignTableToTournament,
  isDimmed = false,
}) => {
  const { t } = useTranslation();
  const { selectedDate } = useDateFilter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tableName, setTableName] = useState('');

  // 같은 날짜의 토너먼트만 필터링
  const sameDateTournaments = useMemo(() => {
    if (!selectedDate) return tournaments;
    return tournaments.filter((t) => t.date === selectedDate || t.dateKey === selectedDate);
  }, [tournaments, selectedDate]);

  useEffect(() => {
    if (table) {
      setTableName(table.name || '');
    }
  }, [table]);

  if (!table) return null;

  const handleMaxSeatsChange = async (newMaxSeats: number) => {
    if (table) {
      try {
        await updateTableMaxSeats(
          table.id,
          newMaxSeats,
          (id) => getParticipantName(id) || t('tableDetailModal.participantUnknown')
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
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

  const handleCloseTableClick = () => {
    if (table) {
      onCloseTable(table.id);
      onClose();
    }
  };

  const handleDeleteTableClick = () => {
    if (table) {
      onDeleteTable(table.id);
      onClose();
    }
  };

  const handleActivateTableClick = () => {
    if (table) {
      activateTable(table.id);
      onClose();
    }
  };

  const handleTournamentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!table || !assignTableToTournament) return;

    const newTournamentId = e.target.value;
    if (!newTournamentId) return;

    try {
      await assignTableToTournament([table.id], newTournamentId);
      toast.success(t('toast.tables.assignedToTournament'));
    } catch (error) {
      // 🎯 Firebase Error Handling (Phase 3-2 Integration)
      if (isPermissionDenied(error)) {
        toast.error(t('toast.tables.noAssignPermission'));
        return;
      }

      const message = handleFirebaseError(
        error as FirebaseError,
        {
          operation: 'assignTableToTournament',
          tableId: table.id,
          tournamentId: newTournamentId,
          component: 'TableDetailModal',
        },
        'ko'
      );

      toast.error(t('toast.tables.assignFailed', { message }));
    }
  };

  const totalSeats = (table.seats || []).length;
  const filledSeats = (table.seats || []).filter((s) => s !== null).length;

  const modalTitle = (
    <div className="flex items-center justify-between w-full">
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {`${table.name || t('tableDetailModal.defaultTableName', { number: table.tableNumber })} (${filledSeats}/${totalSeats})`}
      </span>
      <div className="flex items-center gap-2">
        {isEditingName ? (
          <input
            type="text"
            value={tableName}
            onChange={(e) => {
              e.stopPropagation();
              setTableName(e.target.value);
            }}
            onBlur={handleNameUpdate}
            onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate(e)}
            className="w-32 px-2 py-1 text-sm border border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            placeholder={t('tableDetailModal.defaultTableName', { number: table.tableNumber })}
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingName(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="테이블 이름 수정"
          >
            ✏️ 편집
          </button>
        )}
        {sameDateTournaments.length > 0 && assignTableToTournament && (
          <select
            value={table.tournamentId || ''}
            onChange={handleTournamentChange}
            onClick={(e) => e.stopPropagation()}
            className="select select-bordered select-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
          >
            <option value="">토너먼트 선택</option>
            {sameDateTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="xl"
      showCloseButton={true}
      aria-label="테이블 세부정보"
    >
      <div className="relative">
        {isDimmed ? (
          <div
            className="absolute inset-0 bg-black bg-opacity-50 z-10 rounded-md"
            aria-hidden="true"
          ></div>
        ) : null}

        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteTableClick}
              className="btn btn-sm bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white dark:text-gray-100 border-none"
            >
              테이블 삭제
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <label
                htmlFor="max-seats-modal"
                className="text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                {t('tableDetailModal.labelMaxSeats')}
              </label>
              <select
                id="max-seats-modal"
                value={totalSeats}
                onChange={(e) => handleMaxSeatsChange(parseInt(e.target.value, 10))}
                className="select select-bordered select-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                onClick={(e) => e.stopPropagation()}
              >
                {Array.from({ length: 8 }, (_, i) => i + 4).map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>
            {table.status === 'standby' && (
              <button onClick={handleActivateTableClick} className="btn btn-primary btn-sm">
                {t('tableDetailModal.buttonActivate')}
              </button>
            )}
            <button
              onClick={handleCloseTableClick}
              className="btn btn-sm bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white border-none"
            >
              {t('tableDetailModal.buttonClose')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 text-center">
          {(table.seats || []).map((participantId, seatIndex) => {
            const participant = participantId
              ? participants?.find((p) => p.id === participantId)
              : undefined;
            return (
              <Seat
                key={`seat-${table.id}-${seatIndex}`}
                table={table}
                seatIndex={seatIndex}
                participantId={participantId}
                {...(participant && { participant })}
                getParticipantName={getParticipantName}
                onMoveSeat={onMoveSeat}
                _onBustOut={() => participantId && _onBustOut(participantId, table.id)}
                onPlayerSelect={onPlayerSelect}
              />
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default TableDetailModal;
