import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Modal from '../components/Modal';
import { useParticipants, Participant } from '../hooks/useParticipants';
import { useTables, Table } from '../hooks/useTables';

const ParticipantsPage: React.FC = () => {
  const { t } = useTranslation();
  const { participants, loading: participantsLoading, error: participantsError, addParticipant, updateParticipant, deleteParticipant } = useParticipants();
  const { tables, loading: tablesLoading, error: tablesError } = useTables();

  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [newParticipant, setNewParticipant] = useState<Omit<Participant, 'id'>>({ name: '', phone: '', playerIdentifier: '', participationMethod: '', chips: 10000, status: 'active' as const });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  if (participantsLoading || tablesLoading) return <div>{t('participants.loading')}</div>;
  if (participantsError) return <div className="text-red-500">{t('participants.errorParticipants')} {participantsError.message}</div>;
  if (tablesError) return <div className="text-red-500">{t('participants.errorTables')} {tablesError.message}</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('participants.title')}</h1>
      <div className="mb-4 flex gap-2">
        <input 
          type="text"
          placeholder={t('participants.searchPlaceholder')}
          className="input-field w-full md:w-1/3"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button onClick={() => handleOpenModal(null)} className="btn btn-primary">
          {t('participants.addNew')}
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="w-full table-auto">
          <thead className="bg-gray-200">
            <tr>
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
    </div>
  );
};

export default ParticipantsPage;
