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
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        // 모바일에서는 터치 이벤트 후 잠시 대기
        if (event.type === 'touchstart') {
          setTimeout(() => onClose(), 100);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
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
    <div
        ref={modalRef}
        className="fixed z-[70]"
        style={{ top: `${adjustedPosition.top}px`, left: `${adjustedPosition.left}px` }}
        onClick={(e) => e.stopPropagation()}
    >
            <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 w-48">
                <ul className="divide-y divide-gray-200">
                    <li>
                        <button
                            onClick={onShowDetails}
                            className="w-full text-left px-4 py-4 text-base text-gray-700 hover:bg-gray-100 flex items-center touch-manipulation"
                        >
                            {t('playerActionModal.showDetails')}
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={onMoveSeat}
                            className="w-full text-left px-4 py-4 text-base text-gray-700 hover:bg-gray-100 flex items-center touch-manipulation"
                        >
                            {t('playerActionModal.moveSeat')}
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={_onBustOut}
                            className="w-full text-left px-4 py-4 text-base text-red-600 hover:bg-red-50 flex items-center font-semibold touch-manipulation"
                        >
                            {t('playerActionModal.bustOut')}
                        </button>
                    </li>
                </ul>
            </div>
    </div>
  );
};

export default PlayerActionModal;
