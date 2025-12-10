import React, { useState, useMemo, useCallback } from 'react';
import { useTournament } from '../contexts/TournamentContextAdapter';
import { useTranslation } from 'react-i18next';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';

import Modal from '../components/ui/Modal';
import BulkAddParticipantsModal from '../components/modals/BulkAddParticipantsModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import MoveSeatModal from '../components/modals/MoveSeatModal';
import TournamentSelector from '../components/TournamentSelector';
import DateNavigator from '../components/DateNavigator';
import ErrorBoundary from '../components/errors/ErrorBoundary';
import { useDateFilter } from '../hooks/useDateFilter';
import { useParticipants, Participant } from '../hooks/useParticipants';
import { useTables, Table } from '../hooks/useTables';
import { ParsedParticipant, downloadCSV, generateParticipantsCSV } from '../utils/csvParser';
import { FaTrash, FaPlus } from '../components/Icons/ReactIconsReplacement';
import { isDefaultTournament } from '../hooks/useTournaments';
import { useTournamentData } from '../contexts/TournamentDataContext';

const ParticipantsPage: React.FC = () => {
  const { state } = useTournament();
  const { t } = useTranslation();
  const { tournaments } = useTournamentData();
  const {
    participants,
    loading: participantsLoading,
    error: participantsError,
    addParticipant,
    updateParticipant,
    deleteParticipant,
  } = useParticipants(state.userId, state.tournamentId);
  const {
    tables,
    loading: tablesLoading,
    error: tablesError,
    moveSeat,
  } = useTables(state.userId, state.tournamentId);
  const { selectedDate } = useDateFilter(); // 최상단에서 호출

  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [newParticipant, setNewParticipant] = useState<Omit<Participant, 'id'>>({
    name: '',
    phone: '',
    playerIdentifier: '',
    participationMethod: '',
    chips: 10000,
    status: 'active' as const,
    userId: '',
    etc: '',
    note: '',
  });

  // 현재 토너먼트 정보 가져오기
  const currentTournament = useMemo(() => {
    if (!state.tournamentId || state.tournamentId === 'ALL') return null;
    return tournaments.find((t) => t.id === state.tournamentId);
  }, [state.tournamentId, tournaments]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);

  // 자리이동 모달 state
  const [isMoveSeatModalOpen, setMoveSeatModalOpen] = useState(false);
  const [selectedPlayerForMove, setSelectedPlayerForMove] = useState<{
    participant: Participant;
    table: Table;
    seatIndex: number;
  } | null>(null);

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = useCallback((value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/\D/g, '');

    // 길이에 따라 포맷 적용
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  }, []);

  const participantLocations = useMemo(() => {
    const locations = new Map<string, string>();
    tables.forEach((table: Table) => {
      (table.seats || []).forEach((participantId: string | null, seatIndex: number) => {
        if (participantId) {
          locations.set(participantId, `${table.name || `T${table.tableNumber}`}-${seatIndex + 1}`);
        }
      });
    });
    return locations;
  }, [tables]);

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [participants, searchTerm]);

  // 자리이동 핸들러
  const handleConfirmMove = useCallback(
    async (toTableId: string, toSeatIndex: number) => {
      if (!selectedPlayerForMove) return;

      try {
        await moveSeat(
          selectedPlayerForMove.participant.id,
          { tableId: selectedPlayerForMove.table.id, seatIndex: selectedPlayerForMove.seatIndex },
          { tableId: toTableId, seatIndex: toSeatIndex }
        );
        toast.success(t('toast.participants.seatMoveSuccess'));
        setMoveSeatModalOpen(false);
        setSelectedPlayerForMove(null);
      } catch (error) {
        logger.error('자리 이동 실패', error as Error, { component: 'ParticipantsPage' });
        toast.error(t('toast.participants.seatMoveError'));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPlayerForMove, moveSeat]
  );

  const getParticipantName = useCallback(
    (participantId: string | null): string => {
      if (!participantId) return '-';
      const participant = participants.find((p) => p.id === participantId);
      return participant?.name || '-';
    },
    [participants]
  );

  const handleOpenModal = (participant: Participant | null) => {
    setEditingParticipant(participant);
    if (participant) {
      setNewParticipant(participant);
    } else {
      setNewParticipant({
        name: '',
        phone: '',
        playerIdentifier: '',
        participationMethod: '',
        chips: 10000,
        status: 'active' as const,
        userId: '',
        etc: '',
        note: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleAddOrUpdateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingParticipant) {
      await updateParticipant(editingParticipant.id, newParticipant);
    } else {
      await addParticipant(newParticipant);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    setIsDeletingSingle(true);
    try {
      await deleteParticipant(deleteConfirmId);
      toast.success(t('toast.participants.deleteSuccess'));
      setDeleteConfirmId(null);
    } catch (error) {
      logger.error(
        'Failed to delete participant:',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'ParticipantsPage' }
      );
      toast.error(t('toast.participants.deleteError'));
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const getParticipantLocation = useCallback(
    (participantId: string) => {
      return participantLocations.get(participantId) || t('common.status.pending');
    },
    [participantLocations, t]
  );

  // 체크박스 관련 함수들
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredParticipants.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // 대량 추가 함수
  const handleBulkAdd = async (parsedParticipants: ParsedParticipant[]) => {
    if (!state.userId || !state.tournamentId) {
      toast.error(t('toast.participants.userIdTournamentRequired'));
      return;
    }

    const batch = writeBatch(db);
    const participantsPath = `users/${state.userId}/tournaments/${state.tournamentId}/participants`;

    parsedParticipants.forEach((participant) => {
      const docRef = doc(collection(db, participantsPath));
      batch.set(docRef, {
        name: participant.name,
        phone: participant.phone || '',
        chips: participant.chips,
        status: 'active' as const,
        playerIdentifier: '',
        participationMethod: '',
        userId: '',
        etc: '',
        note: '',
        createdAt: new Date(),
      });
    });

    try {
      await batch.commit();
      toast.success(t('toast.participants.bulkAddSuccess', { count: parsedParticipants.length }));
      logger.info('대량 추가 완료', {
        component: 'ParticipantsPage',
        data: { count: parsedParticipants.length },
      });
    } catch (error) {
      logger.error('대량 추가 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'ParticipantsPage',
        operation: 'handleBulkAdd',
        data: { count: parsedParticipants.length },
      });
      toast.error(t('toast.participants.bulkAddError'));
      throw error;
    }
  };

  // 선택 삭제 함수
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      toast.warning(t('toast.participants.selectToDelete'));
      return;
    }

    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (!state.userId || !state.tournamentId) {
      toast.error(t('toast.participants.userIdTournamentRequired'));
      return;
    }

    setIsDeleting(true);
    try {
      const tablesPath = `users/${state.userId}/tournaments/${state.tournamentId}/tables`;
      const participantsPath = `users/${state.userId}/tournaments/${state.tournamentId}/participants`;

      // writeBatch 사용 (500개씩 분할 처리)
      const selectedIdsArray = Array.from(selectedIds);
      const batchSize = 500;

      for (let i = 0; i < selectedIdsArray.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchIds = selectedIdsArray.slice(i, i + batchSize);

        // 테이블에서 참가자 제거
        for (const table of tables) {
          if (table.seats) {
            const hasSelectedParticipant = table.seats.some(
              (seatId) => seatId && batchIds.includes(seatId)
            );

            if (hasSelectedParticipant) {
              const newSeats = table.seats.map((seatId) =>
                seatId && batchIds.includes(seatId) ? null : seatId
              );
              const tableRef = doc(db, tablesPath, table.id);
              batch.update(tableRef, { seats: newSeats });
            }
          }
        }

        // 참가자 삭제
        for (const id of batchIds) {
          const participantRef = doc(db, participantsPath, id);
          batch.delete(participantRef);
        }

        await batch.commit();
      }

      toast.success(t('toast.participants.bulkDeleteSuccess', { count: selectedIds.size }));
      setSelectedIds(new Set());
      setIsBulkDeleteConfirmOpen(false);
    } catch (error) {
      logger.error('선택 삭제 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'ParticipantsPage',
        operation: 'handleDeleteSelected',
        data: { selectedCount: selectedIds.size },
      });
      toast.error(t('toast.participants.bulkDeleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 전체 삭제 함수
  const handleDeleteAll = () => {
    if (!state.userId || !state.tournamentId) {
      toast.error(t('toast.participants.userIdTournamentRequired'));
      return;
    }

    setIsDeleteAllConfirmOpen(true);
  };

  const handleDeleteAllConfirm = async () => {
    if (!state.userId || !state.tournamentId) {
      toast.error(t('toast.participants.userIdTournamentRequired'));
      return;
    }

    setIsDeleting(true);
    try {
      const tablesPath = `users/${state.userId}/tournaments/${state.tournamentId}/tables`;
      const participantsPath = `users/${state.userId}/tournaments/${state.tournamentId}/participants`;

      // writeBatch 사용 (500개씩 분할 처리)
      const batchSize = 500;
      const totalCount = participants.length;

      for (let i = 0; i < participants.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchParticipants = participants.slice(i, i + batchSize);

        // 첫 번째 배치에서만 모든 테이블의 seats 초기화
        if (i === 0) {
          for (const table of tables) {
            const tableRef = doc(db, tablesPath, table.id);
            const emptySeats = Array(table.seats?.length || 9).fill(null);
            batch.update(tableRef, { seats: emptySeats });
          }
        }

        // 참가자 삭제
        for (const participant of batchParticipants) {
          const participantRef = doc(db, participantsPath, participant.id);
          batch.delete(participantRef);
        }

        await batch.commit();
      }

      toast.success(t('toast.participants.deleteAllSuccess', { count: totalCount }));
      setIsDeleteAllConfirmOpen(false);
    } catch (error) {
      logger.error('전체 삭제 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'ParticipantsPage',
        operation: 'handleDeleteAll',
        data: { totalCount: participants.length },
      });
      toast.error(t('toast.participants.deleteAllError'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 참가자 데이터 CSV 내보내기
  const handleExportParticipants = () => {
    const participantsData = filteredParticipants.map((p) => ({
      name: p.name,
      phone: p.phone || '',
      chips: p.chips,
      status: p.status,
      location: getParticipantLocation(p.id),
    }));

    const csvContent = generateParticipantsCSV(participantsData);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `participants_${timestamp}.csv`;
    downloadCSV(csvContent, filename);
  };

  if (participantsLoading || tablesLoading) return <div>{t('common.messages.loading')}</div>;
  if (participantsError)
    return (
      <div className="text-red-500 dark:text-red-400">
        {t('participants.errorParticipants')} {participantsError.message}
      </div>
    );
  if (tablesError)
    return (
      <div className="text-red-500 dark:text-red-400">
        {t('participants.errorTables')} {tablesError.message}
      </div>
    );

  const isAllSelected =
    filteredParticipants.length > 0 && filteredParticipants.every((p) => selectedIds.has(p.id));

  // 날짜 필터 사용 (전체 보기 모드가 아닐 때만)
  const dateFilterForSelector = state.tournamentId === 'ALL' ? null : selectedDate;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
        {/* 날짜 선택기 (전체 보기 모드가 아닐 때만 표시) */}
        {state.tournamentId !== 'ALL' && state.tournamentId && (
          <div className="mb-4">
            <DateNavigator />
          </div>
        )}

        <TournamentSelector dateFilter={dateFilterForSelector} />

        {!state.tournamentId ? (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              ⚠️ {t('tournaments.selectFirst')}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t('tournaments.selectFirstDesc')}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3 md:mb-0">
                  {t('participants.title')}
                </h1>
                <div className="flex flex-wrap items-center gap-2 md:space-x-3 md:gap-0">
                  <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="btn btn-secondary flex items-center gap-2 text-sm"
                    disabled={
                      isDeleting ||
                      isModalOpen ||
                      isBulkModalOpen ||
                      state.tournamentId === 'ALL' ||
                      (!!state.tournamentId && isDefaultTournament(state.tournamentId))
                    }
                    tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                    title={
                      state.tournamentId === 'ALL' ||
                      (!!state.tournamentId && isDefaultTournament(state.tournamentId))
                        ? t('tournaments.cannotAddInAllView')
                        : undefined
                    }
                  >
                    <FaPlus className="w-4 h-4" />
                    {t('participantsPage.bulkAdd')}
                  </button>
                  <button
                    onClick={() => handleOpenModal(null)}
                    className="btn btn-primary flex items-center gap-2 text-sm"
                    disabled={
                      isDeleting ||
                      isModalOpen ||
                      isBulkModalOpen ||
                      state.tournamentId === 'ALL' ||
                      (!!state.tournamentId && isDefaultTournament(state.tournamentId))
                    }
                    tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                    title={
                      state.tournamentId === 'ALL' ||
                      (!!state.tournamentId && isDefaultTournament(state.tournamentId))
                        ? t('tournaments.cannotAddInAllView')
                        : undefined
                    }
                  >
                    <FaPlus className="w-4 h-4" />
                    {t('participantsPage.addParticipant')}
                  </button>
                  <button
                    onClick={handleExportParticipants}
                    className="btn btn-secondary bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm"
                    disabled={isModalOpen || isBulkModalOpen || filteredParticipants.length === 0}
                    tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                  >
                    {t('participantsPage.exportExcel')} (
                    {t('participantsPage.count', { count: filteredParticipants.length })})
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    className="btn btn-danger text-sm flex items-center gap-2"
                    disabled={
                      isDeleting || participants.length === 0 || isModalOpen || isBulkModalOpen
                    }
                    tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                  >
                    <FaTrash className="w-3 h-3" />
                    {t('participantsPage.deleteAll')}
                  </button>
                </div>
              </div>

              {/* 검색 및 선택 삭제 */}
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  placeholder={t('participants.searchPlaceholder')}
                  className="input-field flex-1 md:max-w-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isModalOpen || isBulkModalOpen}
                  tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                />
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="btn btn-danger btn-sm flex items-center gap-2"
                    disabled={isDeleting || isModalOpen || isBulkModalOpen}
                    tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                  >
                    <FaTrash className="w-3 h-3" />
                    {t('participantsPage.deleteSelected')} (
                    {t('participantsPage.count', { count: selectedIds.size })})
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-200 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                        disabled={isDeleting || isModalOpen || isBulkModalOpen}
                        tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                      />
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {t('common.name')}
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">ID</th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {t('common.phone')}
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {t('common.chips')}
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {t('common.location')}
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {t('participantsPage.etc')}
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {t('participantsPage.note')}
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {t('participants.tableHeaderActions')}
                    </th>
                    <th className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {t('common.statusLabel')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((p: Participant) => (
                    <tr
                      key={p.id}
                      className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                          className="w-4 h-4"
                          disabled={isDeleting || isModalOpen || isBulkModalOpen}
                          tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                        />
                      </td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2">{p.userId || '-'}</td>
                      <td className="px-4 py-2">{p.phone}</td>
                      <td className="px-4 py-2">{p.chips}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {getParticipantLocation(p.id)}
                      </td>
                      <td className="px-4 py-2">{p.etc || '-'}</td>
                      <td className="px-4 py-2">{p.note || '-'}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="btn btn-secondary btn-xs mr-2"
                          disabled={isModalOpen || isBulkModalOpen}
                          tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="btn btn-danger btn-xs"
                          disabled={isModalOpen || isBulkModalOpen}
                          tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                      <td className="px-4 py-2">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title={
                editingParticipant
                  ? t('participants.modalTitleEdit')
                  : t('participants.modalTitleAdd')
              }
              closeOnEsc={true}
              closeOnBackdrop={true}
              showCloseButton={true}
              preventScroll={true}
            >
              <form onSubmit={handleAddOrUpdateParticipant} className="space-y-4">
                {/* 토너먼트 정보 표시 */}
                {currentTournament && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      <span className="font-semibold">{t('participantsPage.tournament')}:</span>{' '}
                      {currentTournament.name}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.name')}</label>
                  <input
                    key="participant-name-input"
                    type="text"
                    value={newParticipant.name}
                    onChange={(e) => setNewParticipant((p) => ({ ...p, name: e.target.value }))}
                    className="input-field w-full"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('participantsPage.id')}
                  </label>
                  <input
                    type="text"
                    value={newParticipant.userId || ''}
                    onChange={(e) => setNewParticipant((p) => ({ ...p, userId: e.target.value }))}
                    className="input-field w-full"
                    placeholder={t('participantsPage.idPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.phone')}</label>
                  <input
                    key="participant-phone-input"
                    type="text"
                    value={newParticipant.phone}
                    onChange={(e) => setNewParticipant((p) => ({ ...p, phone: e.target.value }))}
                    onBlur={(e) => {
                      const formattedValue = formatPhoneNumber(e.target.value);
                      setNewParticipant((p) => ({ ...p, phone: formattedValue }));
                    }}
                    placeholder="010-1234-5678"
                    maxLength={13}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.chips')}</label>
                  <input
                    key="participant-chips-input"
                    type="number"
                    value={newParticipant.chips}
                    onChange={(e) =>
                      setNewParticipant((p) => ({ ...p, chips: Number(e.target.value) }))
                    }
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('participantsPage.etc')}
                  </label>
                  <input
                    type="text"
                    value={newParticipant.etc || ''}
                    onChange={(e) => setNewParticipant((p) => ({ ...p, etc: e.target.value }))}
                    className="input-field w-full"
                    placeholder={t('participantsPage.etcPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('participantsPage.note')}
                  </label>
                  <input
                    type="text"
                    value={newParticipant.note || ''}
                    onChange={(e) => setNewParticipant((p) => ({ ...p, note: e.target.value }))}
                    className="input-field w-full"
                    placeholder={t('participantsPage.notePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('participantsPage.statusLabel')}
                  </label>
                  <select
                    value={newParticipant.status}
                    onChange={(e) =>
                      setNewParticipant((p) => ({
                        ...p,
                        status: e.target.value as 'active' | 'busted' | 'no-show',
                      }))
                    }
                    className="input-field w-full"
                  >
                    <option value="active">{t('participantsPage.statusActive')}</option>
                    <option value="busted">{t('participantsPage.statusBusted')}</option>
                    <option value="no-show">{t('participantsPage.statusNoShow')}</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    {editingParticipant && editingParticipant.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          // editingParticipant가 속한 테이블 찾기
                          const foundTable = tables.find((t) =>
                            t.seats?.some((seat) => seat === editingParticipant.id)
                          );
                          if (foundTable) {
                            const seatIndex = foundTable.seats.indexOf(editingParticipant.id);
                            setSelectedPlayerForMove({
                              participant: editingParticipant,
                              table: foundTable,
                              seatIndex,
                            });
                            setIsModalOpen(false); // 수정 모달 닫기
                            setMoveSeatModalOpen(true); // 자리이동 모달 열기
                          } else {
                            toast.error(t('toast.tables.notAssigned'));
                          }
                        }}
                        className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
                      >
                        {t('participantsPage.moveSeat')}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn btn-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingParticipant ? t('common.edit') : t('participants.modalButtonAdd')}
                    </button>
                  </div>
                </div>
              </form>
            </Modal>

            <BulkAddParticipantsModal
              isOpen={isBulkModalOpen}
              onClose={() => setIsBulkModalOpen(false)}
              onConfirm={handleBulkAdd}
            />

            {/* Delete Single Participant Confirmation Modal */}
            <ConfirmModal
              isOpen={!!deleteConfirmId}
              onClose={() => !isDeletingSingle && setDeleteConfirmId(null)}
              onConfirm={handleDeleteConfirm}
              title={t('participants.confirmDelete')}
              message={
                deleteConfirmId
                  ? participants.find((p) => p.id === deleteConfirmId)?.name || ''
                  : ''
              }
              confirmText={t('common.delete', { defaultValue: '삭제' })}
              cancelText={t('common.cancel', { defaultValue: '취소' })}
              isDangerous={true}
              isLoading={isDeletingSingle}
            />

            {/* Bulk Delete Confirmation Modal */}
            <ConfirmModal
              isOpen={isBulkDeleteConfirmOpen}
              onClose={() => {
                if (!isDeleting) {
                  setIsBulkDeleteConfirmOpen(false);
                }
              }}
              onConfirm={handleBulkDeleteConfirm}
              title={t('participantsPage.confirmBulkDelete')}
              message={t('participantsPage.confirmBulkDeleteMsg', { count: selectedIds.size })}
              confirmText={t('common.delete')}
              cancelText={t('common.cancel')}
              isDangerous={true}
              isLoading={isDeleting}
            />

            {/* Delete All Confirmation Modal */}
            <ConfirmModal
              isOpen={isDeleteAllConfirmOpen}
              onClose={() => {
                if (!isDeleting) {
                  setIsDeleteAllConfirmOpen(false);
                }
              }}
              onConfirm={handleDeleteAllConfirm}
              title={t('participantsPage.confirmDeleteAll')}
              message={t('participantsPage.confirmDeleteAllMsg', { count: participants.length })}
              confirmText={t('participantsPage.confirmDeleteAllBtn')}
              cancelText={t('common.cancel')}
              isDangerous={true}
              isLoading={isDeleting}
              requireTextInput={{
                placeholder: t('participantsPage.confirmDeleteInput'),
                confirmValue: t('participantsPage.confirmDeleteValue'),
                caseSensitive: true,
              }}
            />

            {/* 자리이동 모달 */}
            {isMoveSeatModalOpen && selectedPlayerForMove && (
              <MoveSeatModal
                isOpen={isMoveSeatModalOpen}
                onClose={() => {
                  setMoveSeatModalOpen(false);
                  setSelectedPlayerForMove(null);
                }}
                tables={tables}
                movingParticipant={selectedPlayerForMove.participant}
                onConfirmMove={handleConfirmMove}
                getParticipantName={getParticipantName}
                currentTournamentId={selectedPlayerForMove.table.tournamentId}
                currentTournamentName={
                  tournaments.find((t) => t.id === selectedPlayerForMove.table.tournamentId)?.name
                }
              />
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default ParticipantsPage;
