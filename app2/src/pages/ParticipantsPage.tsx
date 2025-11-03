import React, { useState, useMemo, useCallback } from 'react';
import { useTournament } from '../contexts/TournamentContext';
import { useTranslation } from 'react-i18next';
import { writeBatch, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';

import Modal from '../components/ui/Modal';
import BulkAddParticipantsModal from '../components/modals/BulkAddParticipantsModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import MoveSeatModal from '../components/modals/MoveSeatModal';
import TournamentSelector from '../components/TournamentSelector';
import DateNavigator from '../components/DateNavigator';
import { useDateFilter } from '../contexts/DateFilterContext';
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
  const { participants, loading: participantsLoading, error: participantsError, addParticipant, updateParticipant, deleteParticipant } = useParticipants(state.userId, state.tournamentId);
  const { tables, loading: tablesLoading, error: tablesError, moveSeat } = useTables(state.userId, state.tournamentId);
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
    note: ''
  });

  // 현재 토너먼트 정보 가져오기
  const currentTournament = useMemo(() => {
    if (!state.tournamentId || state.tournamentId === 'ALL') return null;
    return tournaments.find(t => t.id === state.tournamentId);
  }, [state.tournamentId, tournaments]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // 자리이동 모달 state
  const [isMoveSeatModalOpen, setMoveSeatModalOpen] = useState(false);
  const [selectedPlayerForMove, setSelectedPlayerForMove] = useState<{ participant: Participant; table: Table; seatIndex: number } | null>(null);

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
    return participants.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [participants, searchTerm]);

  // 자리이동 핸들러
  const handleConfirmMove = useCallback(async (toTableId: string, toSeatIndex: number) => {
    if (!selectedPlayerForMove) return;

    try {
      await moveSeat(
        selectedPlayerForMove.participant.id,
        { tableId: selectedPlayerForMove.table.id, seatIndex: selectedPlayerForMove.seatIndex },
        { tableId: toTableId, seatIndex: toSeatIndex }
      );
      toast.success('자리 이동이 완료되었습니다.');
      setMoveSeatModalOpen(false);
      setSelectedPlayerForMove(null);
    } catch (error) {
      logger.error('자리 이동 실패', error as Error, { component: 'ParticipantsPage' });
      toast.error('자리 이동에 실패했습니다.');
    }
  }, [selectedPlayerForMove, moveSeat]);

  const getParticipantName = useCallback((participantId: string | null): string => {
    if (!participantId) return '-';
    const participant = participants.find(p => p.id === participantId);
    return participant?.name || '-';
  }, [participants]);

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
        note: ''
      });
    }
    setIsModalOpen(true);
  };
  
  const handleAddOrUpdateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if(editingParticipant) {
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
      toast.success('참가자가 삭제되었습니다.');
      setDeleteConfirmId(null);
    } catch (error) {
      logger.error('Failed to delete participant:', error instanceof Error ? error : new Error(String(error)), { component: 'ParticipantsPage' });
      toast.error('참가자 삭제에 실패했습니다.');
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const getParticipantLocation = useCallback((participantId: string) => {
    return participantLocations.get(participantId) || t('common.status.pending');
  }, [participantLocations, t]);

  // 체크박스 관련 함수들
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredParticipants.map(p => p.id)));
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
    const batch = writeBatch(db);
    
    parsedParticipants.forEach(participant => {
      const docRef = doc(db, 'participants', Date.now().toString() + Math.random().toString(36).substr(2, 9));
      batch.set(docRef, {
        name: participant.name,
        phone: participant.phone || '',
        chips: participant.chips,
        status: 'active',
        playerIdentifier: '',
        participationMethod: '',
        createdAt: new Date()
      });
    });

    await batch.commit();
  };


  // 선택 삭제 함수
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      toast.warning('삭제할 참가자를 선택해주세요.');
      return;
    }

    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 테이블에서 참가자 제거
        for (const table of tables) {
          if (table.seats) {
            const hasSelectedParticipant = table.seats.some(seatId => 
              seatId && selectedIds.has(seatId)
            );
            
            if (hasSelectedParticipant) {
              const newSeats = table.seats.map(seatId => 
                seatId && selectedIds.has(seatId) ? null : seatId
              );
              const tableRef = doc(db, 'tables', table.id);
              transaction.update(tableRef, { seats: newSeats });
            }
          }
        }

        // 참가자 삭제
        const selectedIdsArray = Array.from(selectedIds);
        for (const id of selectedIdsArray) {
          const participantRef = doc(db, 'participants', id);
          transaction.delete(participantRef);
        }
      });
      
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size}명의 참가자가 삭제되었습니다.`);
      setSelectedIds(new Set());
      setIsBulkDeleteConfirmOpen(false);
    } catch (error) {
      logger.error('선택 삭제 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'ParticipantsPage',
        operation: 'handleDeleteSelected',
        data: { selectedCount: selectedIds.size }
      });
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 전체 삭제 함수
  const handleDeleteAll = async () => {
    // eslint-disable-next-line no-alert
    const confirmText = prompt(
      `모든 참가자(${participants.length}명)를 삭제합니다.\n` +
      '정말로 삭제하려면 "전체삭제"를 입력하세요:'
    );

    if (confirmText !== '전체삭제') {
      return;
    }

    setIsDeleting(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 모든 테이블의 seats 초기화
        for (const table of tables) {
          const tableRef = doc(db, 'tables', table.id);
          const emptySeats = Array(table.seats?.length || 9).fill(null);
          transaction.update(tableRef, { seats: emptySeats });
        }

        // 모든 참가자 삭제
        for (const participant of participants) {
          const participantRef = doc(db, 'participants', participant.id);
          transaction.delete(participantRef);
        }
      });
      
      toast.success(`${participants.length}명의 참가자가 모두 삭제되었습니다.`);
    } catch (error) {
      logger.error('전체 삭제 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'ParticipantsPage',
        operation: 'handleDeleteAll',
        data: { totalCount: participants.length }
      });
      toast.error('전체 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 참가자 데이터 CSV 내보내기
  const handleExportParticipants = () => {
    const participantsData = filteredParticipants.map(p => ({
      name: p.name,
      phone: p.phone || '',
      chips: p.chips,
      status: p.status,
      location: getParticipantLocation(p.id)
    }));

    const csvContent = generateParticipantsCSV(participantsData);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `participants_${timestamp}.csv`;
    downloadCSV(csvContent, filename);
  };

  if (participantsLoading || tablesLoading) return <div>{t('common.messages.loading')}</div>;
  if (participantsError) return <div className="text-red-500 dark:text-red-400">{t('participants.errorParticipants')} {participantsError.message}</div>;
  if (tablesError) return <div className="text-red-500 dark:text-red-400">{t('participants.errorTables')} {tablesError.message}</div>;

  const isAllSelected = filteredParticipants.length > 0 &&
    filteredParticipants.every(p => selectedIds.has(p.id));

  // 날짜 필터 사용 (전체 보기 모드가 아닐 때만)
  const dateFilterForSelector = state.tournamentId === 'ALL' ? null : selectedDate;

  return (
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
          <p className="text-gray-500 dark:text-gray-400 mb-4">⚠️ 토너먼트를 먼저 선택해주세요.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">위의 드롭다운에서 토너먼트를 선택하거나 새로 만들어주세요.</p>
        </div>
      ) : (
        <>
      {/* Header */}
      <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3 md:mb-0">{t('participants.title')}</h1>
          <div className="flex flex-wrap items-center gap-2 md:space-x-3 md:gap-0">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="btn btn-secondary flex items-center gap-2 text-sm"
              disabled={isDeleting || isModalOpen || isBulkModalOpen || state.tournamentId === 'ALL' || (!!state.tournamentId && isDefaultTournament(state.tournamentId))}
              tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
              title={state.tournamentId === 'ALL' || (!!state.tournamentId && isDefaultTournament(state.tournamentId)) ? '전체보기에서는 참가자를 추가할 수 없습니다.' : undefined}
            >
              <FaPlus className="w-4 h-4" />
              대량 추가
            </button>
            <button
              onClick={() => handleOpenModal(null)}
              className="btn btn-primary flex items-center gap-2 text-sm"
              disabled={isDeleting || isModalOpen || isBulkModalOpen || state.tournamentId === 'ALL' || (!!state.tournamentId && isDefaultTournament(state.tournamentId))}
              tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
              title={state.tournamentId === 'ALL' || (!!state.tournamentId && isDefaultTournament(state.tournamentId)) ? '전체보기에서는 참가자를 추가할 수 없습니다.' : undefined}
            >
              <FaPlus className="w-4 h-4" />
              참가자 추가
            </button>
            <button
              onClick={handleExportParticipants}
              className="btn btn-secondary bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm"
              disabled={isModalOpen || isBulkModalOpen || filteredParticipants.length === 0}
              tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
            >
              엑셀 내보내기 ({filteredParticipants.length}명)
            </button>
            <button
              onClick={handleDeleteAll}
              className="btn btn-danger text-sm flex items-center gap-2"
              disabled={isDeleting || participants.length === 0 || isModalOpen || isBulkModalOpen}
              tabIndex={isModalOpen || isBulkModalOpen ? -1 : 0}
            >
              <FaTrash className="w-3 h-3" />
              전체 삭제
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
              선택 삭제 ({selectedIds.size}명)
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
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">{t('common.name')}</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">ID</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">{t('common.phone')}</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">{t('common.chips')}</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">{t('common.location')}</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">기타</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">비고</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">{t('participants.tableHeaderActions')}</th>
              <th className="px-4 py-2 text-gray-900 dark:text-gray-100">{t('common.statusLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.map((p: Participant) => (
              <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 text-gray-900 dark:text-gray-100">
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
                <td className="px-4 py-2 whitespace-nowrap">{getParticipantLocation(p.id)}</td>
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
        title={editingParticipant ? t('participants.modalTitleEdit') : t('participants.modalTitleAdd')}
        closeOnEsc={true}
        closeOnBackdrop={true}
        showCloseButton={true}
        preventScroll={true}
      >
        <form
          onSubmit={handleAddOrUpdateParticipant}
          className="space-y-4"
        >
          {/* 토너먼트 정보 표시 */}
          {currentTournament && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                <span className="font-semibold">토너먼트:</span> {currentTournament.name}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">{t('common.name')}</label>
            <input
              key="participant-name-input"
              type="text"
              value={newParticipant.name}
              onChange={e => setNewParticipant(p => ({ ...p, name: e.target.value }))}
              className="input-field w-full"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ID</label>
            <input
              type="text"
              value={newParticipant.userId || ''}
              onChange={e => setNewParticipant(p => ({ ...p, userId: e.target.value }))}
              className="input-field w-full"
              placeholder="사용자 ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.phone')}</label>
            <input
              key="participant-phone-input"
              type="text"
              value={newParticipant.phone}
              onChange={e => setNewParticipant(p => ({ ...p, phone: e.target.value }))}
              onBlur={e => {
                const formattedValue = formatPhoneNumber(e.target.value);
                setNewParticipant(p => ({ ...p, phone: formattedValue }));
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
              onChange={e => setNewParticipant(p => ({ ...p, chips: Number(e.target.value) }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">기타</label>
            <input
              type="text"
              value={newParticipant.etc || ''}
              onChange={e => setNewParticipant(p => ({ ...p, etc: e.target.value }))}
              className="input-field w-full"
              placeholder="기타 정보"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">비고</label>
            <input
              type="text"
              value={newParticipant.note || ''}
              onChange={e => setNewParticipant(p => ({ ...p, note: e.target.value }))}
              className="input-field w-full"
              placeholder="비고"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">상태</label>
            <select
              value={newParticipant.status}
              onChange={e => setNewParticipant(p => ({ ...p, status: e.target.value as 'active' | 'busted' | 'no-show' }))}
              className="input-field w-full"
            >
              <option value="active">활성</option>
              <option value="busted">탈락</option>
              <option value="no-show">불참</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <div>
              {editingParticipant && editingParticipant.status === 'active' && (
                <button
                  type="button"
                  onClick={() => {
                    // editingParticipant가 속한 테이블 찾기
                    const foundTable = tables.find(t => t.seats?.some(seat => seat === editingParticipant.id));
                    if (foundTable) {
                      const seatIndex = foundTable.seats.indexOf(editingParticipant.id);
                      setSelectedPlayerForMove({
                        participant: editingParticipant,
                        table: foundTable,
                        seatIndex
                      });
                      setIsModalOpen(false); // 수정 모달 닫기
                      setMoveSeatModalOpen(true); // 자리이동 모달 열기
                    } else {
                      toast.error('테이블에 배정되지 않은 참가자입니다.');
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
                >
                  자리 이동
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary">{editingParticipant ? t('common.edit') : t('participants.modalButtonAdd')}</button>
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
        message={deleteConfirmId ? participants.find(p => p.id === deleteConfirmId)?.name || '' : ''}
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
        title="선택 삭제 확인"
        message={`${selectedIds.size}명의 참가자를 삭제하시겠습니까?`}
        confirmText="삭제"
        cancelText="취소"
        isDangerous={true}
        isLoading={isDeleting}
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
          currentTournamentName={tournaments.find(t => t.id === selectedPlayerForMove.table.tournamentId)?.name}
        />
      )}
        </>
      )}
    </div>
  );
};

export default ParticipantsPage;
