import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Participant } from '../../hooks/useParticipants';
import { Table } from '../../hooks/useTables';
import { logger } from '../../utils/logger';

import Modal, { ModalFooter } from '../ui/Modal';

interface MoveSeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Table[];
  movingParticipant: Participant | null;
  onConfirmMove: (tableId: string, seatIndex: number) => void;
  getParticipantName: (participantId: string | null) => string;
  currentTournamentId?: string | null | undefined; // 현재 참가자가 속한 토너먼트 ID
  currentTournamentName?: string | undefined; // 현재 토너먼트 이름
}

const MoveSeatModal: React.FC<MoveSeatModalProps> = ({
  isOpen,
  onClose,
  tables,
  movingParticipant,
  onConfirmMove,
  getParticipantName,
  currentTournamentId,
  currentTournamentName,
}) => {
  const { t } = useTranslation();
  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; seatIndex: number } | null>(
    null
  );

  if (!isOpen || !movingParticipant) return null;

  // 같은 토너먼트의 테이블만 필터링
  const filteredTables = currentTournamentId
    ? tables.filter((table) => table.tournamentId === currentTournamentId)
    : tables;

  const handleSeatSelect = (
    tableId: string,
    seatIndex: number,
    participantId: string | null,
    tableStatus?: string
  ) => {
    logger.info('자리 선택을 시도합니다', {
      component: 'MoveSeatModal',
      additionalData: {
        tableId,
        seatIndex,
        participantId,
        tableStatus,
        isEmpty: !participantId,
        isTableOpen: tableStatus === 'open',
      },
    });

    // FIX: Use a looser check for empty seat (!participantId) to handle both null and undefined.
    if (!participantId && tableStatus === 'open') {
      setSelectedSeat({ tableId, seatIndex });
      logger.info('자리 선택 성공', {
        component: 'MoveSeatModal',
        additionalData: { tableId, seatIndex },
      });
    } else {
      logger.warn('자리 선택 불가능', {
        component: 'MoveSeatModal',
        additionalData: {
          reason: participantId ? '이미 점유된 자리' : '테이블이 열려있지 않음',
          tableId,
          seatIndex,
          participantId,
          tableStatus,
        },
      });
    }
  };

  const handleConfirm = () => {
    if (selectedSeat) {
      logger.info('자리 이동 확정 버튼 클릭', {
        component: 'MoveSeatModal',
        additionalData: {
          selectedSeat,
          movingParticipant: movingParticipant?.id,
        },
      });
      onConfirmMove(selectedSeat.tableId, selectedSeat.seatIndex);
      setSelectedSeat(null);
    } else {
      logger.warn('자리 이동 확정 실패: 선택된 자리가 없음', { component: 'MoveSeatModal' });
    }
  };

  const currentSeatInfo = filteredTables
    .flatMap((t) => t.seats.map((pId, sIdx) => ({ pId, tId: t.id, sIdx })))
    .find((s) => s.pId === movingParticipant.id);
  const currentTable = filteredTables.find((t) => t.id === currentSeatInfo?.tId);
  const currentTableName =
    currentTable?.name ||
    t('moveSeatModal.defaultTableName', { number: currentTable?.tableNumber });
  const currentLocation = currentSeatInfo
    ? `${currentTableName} - ${currentSeatInfo.sIdx + 1}${t('moveSeatModal.seatSuffix')}`
    : t('common.notApplicable');

  const footerButtons = (
    <ModalFooter>
      <button onClick={onClose} className="btn btn-secondary">
        {t('common.cancel')}
      </button>
      <button onClick={handleConfirm} className="btn btn-primary" disabled={!selectedSeat}>
        {t('moveSeatModal.buttonConfirm')}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('moveSeatModal.title', { name: movingParticipant.name })}
      size="xl"
      footer={footerButtons}
      aria-label={t('moveSeatModal.title', { name: movingParticipant.name })}
    >
      <div
        className="mb-4 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <h4 className="font-bold text-blue-800 dark:text-blue-300">
          {t('moveSeatModal.sectionTitle')}
        </h4>
        <p className="text-gray-900 dark:text-gray-100">
          <strong>{t('moveSeatModal.labelName')}</strong> {movingParticipant.name}
        </p>
        {currentTournamentName && (
          <p className="text-gray-900 dark:text-gray-100">
            <strong>토너먼트:</strong> {currentTournamentName}
          </p>
        )}
        <p className="text-gray-900 dark:text-gray-100">
          <strong>{t('moveSeatModal.labelCurrentLocation')}</strong> {currentLocation}
        </p>
      </div>
      <div
        className="space-y-4 max-h-[60vh] overflow-y-auto p-1"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {filteredTables.map((table) => (
          <div
            key={table.id}
            className={`border dark:border-gray-700 rounded-lg p-3 ${table.status !== 'open' ? 'bg-gray-100 dark:bg-gray-700 opacity-70' : ''}`}
          >
            <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
              {table.name || t('moveSeatModal.defaultTableName', { number: table.tableNumber })}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({table.status})
              </span>
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {table.seats.map((participantId, seatIndex) => {
                const isSelected =
                  selectedSeat?.tableId === table.id && selectedSeat?.seatIndex === seatIndex;
                const isCurrentSeat = participantId === movingParticipant.id;
                const isSelectable = !participantId && table.status === 'open' && !isCurrentSeat;

                return (
                  <div
                    key={seatIndex}
                    onClick={() =>
                      handleSeatSelect(table.id, seatIndex, participantId, table.status)
                    }
                    className={`relative p-2 rounded-md h-16 flex flex-col justify-center items-center text-xs group
                      ${
                        isCurrentSeat
                          ? 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-2 border-yellow-500 dark:border-yellow-700'
                          : isSelectable
                            ? 'cursor-pointer bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-2 border-dashed border-green-400 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }
                      ${isSelected ? 'ring-4 ring-blue-500' : ''}
                    `}
                    title={
                      isCurrentSeat
                        ? '현재 위치'
                        : isSelectable
                          ? '이동 가능한 자리'
                          : '이동 불가능한 자리'
                    }
                  >
                    <span className="font-bold text-sm mb-1">{seatIndex + 1}</span>
                    <span className="font-semibold truncate w-full text-center">
                      {isCurrentSeat
                        ? `${getParticipantName(participantId)} (현재)`
                        : getParticipantName(participantId)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default MoveSeatModal;
