import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Participant } from '../../hooks/useParticipants';

import Modal, { ModalFooter } from '../ui/Modal';

interface ParticipantDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: Participant | null;
  onUpdate: (id: string, data: Partial<Participant>) => Promise<void>;
  tableName?: string | null;
  seatNumber?: number | null;
}

const ParticipantDetailModal: React.FC<ParticipantDetailModalProps> = ({
  isOpen,
  onClose,
  participant,
  onUpdate,
  tableName,
  seatNumber,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Participant>>({});

  useEffect(() => {
    if (participant) {
      setFormData({
        name: participant.name,
        chips: participant.chips,
        phone: participant.phone || '',
      });
    }
  }, [participant]);

  useEffect(() => {
    // If modal is closed, reset editing state
    if (!isOpen) {
      setIsEditing(false);
    }
  }, [isOpen]);

  if (!isOpen || !participant) {
    return null;
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const parsedValue = name === 'chips' ? parseInt(value, 10) || 0 : value;
      setFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleSave = async () => {
    await onUpdate(participant.id, formData);
    setIsEditing(false);
    onClose();
  };

  const footerButtons = (
    <ModalFooter>
      <button onClick={onClose} className="btn">
        {t('participantDetailModal.buttonClose')}
      </button>
      {isEditing ? (
        <button onClick={handleSave} className="btn btn-primary">
          {t('participantDetailModal.buttonSave')}
        </button>
      ) : (
        <button onClick={() => setIsEditing(true)} className="btn btn-secondary">
          {t('participantDetailModal.buttonEdit')}
        </button>
      )}
    </ModalFooter>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEditing ? t('participantDetailModal.editTitle') : t('participantDetailModal.title')}
      size="lg"
      footer={footerButtons}
      aria-label={isEditing ? t('participantDetailModal.editTitle') : t('participantDetailModal.title')}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('participantDetailModal.labelName')}
            </label>
            <input 
              type="text" 
              name="name" 
              value={formData.name || ''} 
              onChange={handleInputChange} 
              className="input input-bordered w-full" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('participantDetailModal.labelPhone')}
            </label>
            <input 
              type="text" 
              name="phone" 
              value={formData.phone || ''} 
              onChange={handleInputChange} 
              className="input input-bordered w-full" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('participantDetailModal.labelChips')}
            </label>
            <input 
              type="number" 
              name="chips" 
              value={formData.chips || 0} 
              onChange={handleInputChange} 
              className="input input-bordered w-full" 
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="font-semibold">{t('participantDetailModal.labelName')}:</span> {participant.name}
          </div>
          <div>
            <span className="font-semibold">{t('participantDetailModal.labelPhone')}:</span> {participant.phone || t('participantDetailModal.notAvailable')}
          </div>
          <div>
            <span className="font-semibold">{t('participantDetailModal.labelChips')}:</span> {participant.chips.toLocaleString()}
          </div>
          <div>
            <span className="font-semibold">{t('participantDetailModal.labelStatus')}:</span>
            <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
              participant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {participant.status === 'active' 
                ? t('participantDetailModal.statusActive') 
                : t('participantDetailModal.statusBusted')
              }
            </span>
          </div>
          <div>
            <span className="font-semibold">{t('participantDetailModal.labelTable')}:</span> 
            {tableName && typeof seatNumber === 'number' 
              ? t('participantDetailModal.tableSeatFormat', { tableName, seatNumber: seatNumber + 1}) 
              : t('participantDetailModal.notAvailable')
            }
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ParticipantDetailModal;