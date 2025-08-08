import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface PlayerActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  _onBustOut: () => void;
  onMoveSeat: () => void;
  onShowDetails: () => void;
  position: { top: number; left: number };
}

const PlayerActionModal: React.FC<PlayerActionModalProps> = ({
  isOpen,
  onClose,
  position,
  _onBustOut,
  onMoveSeat,
  onShowDetails,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  // Adjust position to keep modal within viewport
  const adjustedPosition = { ...position };
  if (window.innerWidth - position.left < 200) {
      adjustedPosition.left = window.innerWidth - 200;
  }
  if (window.innerHeight - position.top < 150) {
      adjustedPosition.top = window.innerHeight - 150;
  }

  return (
    <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div
            ref={modalRef}
            className="absolute z-50"
            style={{ top: `${adjustedPosition.top}px`, left: `${adjustedPosition.left}px` }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-48">
                <ul className="divide-y divide-gray-200">
                    <li>
                        <button
                            onClick={onShowDetails}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                            {t('playerActionModal.showDetails')}
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={onMoveSeat}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                            {t('playerActionModal.moveSeat')}
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={_onBustOut}
                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center font-semibold"
                        >
                            {t('playerActionModal.bustOut')}
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    </>
  );
};

export default PlayerActionModal;
