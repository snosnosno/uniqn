import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { writeBatch, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';

import Modal from '../components/ui/Modal';
import BulkAddParticipantsModal from '../components/modals/BulkAddParticipantsModal';
import CSVUploadButton from '../components/upload/CSVUploadButton';
import { useParticipants, Participant } from '../hooks/useParticipants';
import { useTables, Table } from '../hooks/useTables';
import { ParsedParticipant, downloadCSV, generateSampleCSV } from '../utils/csvParser';
import { FaTrash, FaPlus, FaFileExport } from '../components/Icons/ReactIconsReplacement';

const ParticipantsPage: React.FC = () => {
  const { t } = useTranslation();
  const { participants, loading: participantsLoading, error: participantsError, addParticipant, updateParticipant, deleteParticipant } = useParticipants();
  const { tables, loading: tablesLoading, error: tablesError } = useTables();

  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [newParticipant, setNewParticipant] = useState<Omit<Participant, 'id'>>({ name: '', phone: '', playerIdentifier: '', participationMethod: '', chips: 10000, status: 'active' as const });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleOpenModal = (participant: Participant | null) => {
    setEditingParticipant(participant);
    if (participant) {
      setNewParticipant(participant);
    } else {
      setNewParticipant({ name: '', phone: '', playerIdentifier: '', participationMethod: '', chips: 10000, status: 'active' as const });
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
    if (window.confirm(t('participants.confirmDelete'))) {
      await deleteParticipant(id);
    }
  };

  const getParticipantLocation = useCallback((participantId: string) => {
    return participantLocations.get(participantId) || t('participants.locationWaiting');
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

  // CSV 파일 내용 처리
  const handleCSVContent = (content: string) => {
    setIsBulkModalOpen(true);
    // BulkAddParticipantsModal에서 content를 처리할 수 있도록
    // 모달이 열리면 자동으로 텍스트 영역에 입력됨
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 100);
  };

  // 선택 삭제 함수
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      toast.warning('삭제할 참가자를 선택해주세요.');
      return;
    }

    if (!window.confirm(`${selectedIds.size}명의 참가자를 삭제하시겠습니까?`)) {
      return;
    }

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

  // 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const csvContent = generateSampleCSV();
    downloadCSV(csvContent);
  };

  if (participantsLoading || tablesLoading) return <div>{t('participants.loading')}</div>;
  if (participantsError) return <div className="text-red-500">{t('participants.errorParticipants')} {participantsError.message}</div>;
  if (tablesError) return <div className="text-red-500">{t('participants.errorTables')} {tablesError.message}</div>;

  const isAllSelected = filteredParticipants.length > 0 && 
    filteredParticipants.every(p => selectedIds.has(p.id));

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('participants.title')}</h1>
      <div className="mb-4 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <input 
            type="text"
            placeholder={t('participants.searchPlaceholder')}
            className="input-field flex-1 md:max-w-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <CSVUploadButton onFileRead={handleCSVContent} disabled={isDeleting} />
          <button 
            onClick={() => setIsBulkModalOpen(true)} 
            className="btn btn-secondary flex items-center gap-2"
            disabled={isDeleting}
          >
            <FaPlus className="w-4 h-4" />
            대량 추가
          </button>
          <button 
            onClick={() => handleOpenModal(null)} 
            className="btn btn-primary flex items-center gap-2"
            disabled={isDeleting}
          >
            <FaPlus className="w-4 h-4" />
            참가자 추가
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={handleDownloadTemplate}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <FaFileExport className="w-3 h-3" />
            CSV 템플릿 다운로드
          </button>
          <span className="text-gray-400">|</span>
          {selectedIds.size > 0 && (
            <>
              <button 
                onClick={handleDeleteSelected}
                className="btn btn-danger btn-sm flex items-center gap-2"
                disabled={isDeleting}
              >
                <FaTrash className="w-3 h-3" />
                선택 삭제 ({selectedIds.size}명)
              </button>
              <span className="text-gray-400">|</span>
            </>
          )}
          <button 
            onClick={handleDeleteAll}
            className="btn btn-danger btn-sm flex items-center gap-2"
            disabled={isDeleting || participants.length === 0}
          >
            <FaTrash className="w-3 h-3" />
            전체 삭제
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="w-full table-auto">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                  disabled={isDeleting}
                />
              </th>
              <th className="px-4 py-2">{t('participants.tableHeaderName')}</th>
              <th className="px-4 py-2">{t('participants.tableHeaderPhone')}</th>
              <th className="px-4 py-2">{t('participants.tableHeaderStatus')}</th>
              <th className="px-4 py-2">{t('participants.tableHeaderChips')}</th>
              <th className="px-4 py-2">{t('participants.tableHeaderLocation')}</th>
              <th className="px-4 py-2">{t('participants.tableHeaderActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.map((p: Participant) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                    className="w-4 h-4"
                    disabled={isDeleting}
                  />
                </td>
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">{p.phone}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p.chips}</td>
                <td className="px-4 py-2">{getParticipantLocation(p.id)}</td>
                <td className="px-4 py-2">
                  <button onClick={() => handleOpenModal(p)} className="btn btn-secondary btn-xs mr-2">{t('participants.actionEdit')}</button>
                  <button onClick={() => handleDelete(p.id)} className="btn btn-danger btn-xs">{t('participants.actionDelete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingParticipant ? t('participants.modalTitleEdit') : t('participants.modalTitleAdd')}>
        <form onSubmit={handleAddOrUpdateParticipant} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('participants.modalLabelName')}</label>
            <input type="text" value={newParticipant.name} onChange={e => setNewParticipant(p => ({ ...p, name: e.target.value }))} className="input-field w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('participants.modalLabelPhone')}</label>
            <input type="text" value={newParticipant.phone} onChange={e => setNewParticipant(p => ({ ...p, phone: e.target.value }))} className="input-field w-full" />
          </div>
           <div>
            <label className="block text-sm font-medium mb-1">{t('participants.modalLabelChips')}</label>
            <input type="number" value={newParticipant.chips} onChange={e => setNewParticipant(p => ({ ...p, chips: Number(e.target.value) }))} className="input-field w-full" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">{t('participants.modalButtonCancel')}</button>
            <button type="submit" className="btn btn-primary">{editingParticipant ? t('participants.modalButtonUpdate') : t('participants.modalButtonAdd')}</button>
          </div>
        </form>
      </Modal>

      <BulkAddParticipantsModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onConfirm={handleBulkAdd}
      />
    </div>
  );
};

export default ParticipantsPage;
