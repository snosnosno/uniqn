/**
 * QR 코드 생성 모달 (v2.0 - 클라이언트 사이드 생성)
 *
 * @version 2.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 *
 * 주요 변경사항:
 * - Firebase Functions 대신 클라이언트 사이드 생성
 * - 출근/퇴근 QR 분리
 * - 1분 주기 자동 재생성
 * - TOTP 기반 보안
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal, { ModalFooter } from '../ui/Modal';
import QRDisplay from '../qr/QRDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';

interface QRCodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  date: string;
  roundUpInterval?: 15 | 30;
  title?: string;
  description?: string;
}

/**
 * QR 코드 생성 모달
 *
 * @example
 * ```typescript
 * <QRCodeGeneratorModal
 *   isOpen={true}
 *   onClose={() => setIsOpen(false)}
 *   eventId="event-123"
 *   date="2025-01-16"
 *   roundUpInterval={30}
 * />
 * ```
 */
const QRCodeGeneratorModal: React.FC<QRCodeGeneratorModalProps> = ({
  isOpen,
  onClose,
  eventId,
  date,
  roundUpInterval = 30,
  title,
  description
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'check-in' | 'check-out'>('check-in');
  const [localRoundUpInterval, setLocalRoundUpInterval] = useState<15 | 30>(roundUpInterval);

  // 모달 닫힐 때 탭 초기화
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('check-in');
    }
  }, [isOpen]);

  // 로그
  useEffect(() => {
    if (isOpen) {
      logger.info('QR 생성 모달 열림', { eventId, date });
    }
  }, [isOpen, eventId, date]);

  const handleClose = () => {
    logger.info('QR 생성 모달 닫힘', { eventId, date });
    onClose();
  };

  const modalTitle = title || t('qr.modalTitle', 'QR 코드 생성');
  const modalDescription =
    description ||
    t('qr.modalDescription', '출근 또는 퇴근용 QR 코드를 생성하여 스태프에게 공유하세요.');

  const footerButtons = (
    <ModalFooter>
      <button
        onClick={handleClose}
        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
      >
        {t('common.close', '닫기')}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      size="lg"
      footer={footerButtons}
      aria-label={modalTitle}
    >
      <div className="flex flex-col">
        {/* 설명 */}
        <p className="mb-6 text-center text-gray-600">{modalDescription}</p>

        {/* 탭 버튼 */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('check-in')}
            className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
              activeTab === 'check-in'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('qr.checkInTab', '출근용 QR')}
          </button>
          <button
            onClick={() => setActiveTab('check-out')}
            className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
              activeTab === 'check-out'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('qr.checkOutTab', '퇴근용 QR')}
          </button>
        </div>

        {/* 라운드업 간격 설정 (퇴근 탭에서만 표시) */}
        {activeTab === 'check-out' && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {t('qr.roundUpIntervalLabel', '퇴근 시간 라운드업 간격')}
              </span>
              <select
                value={localRoundUpInterval}
                onChange={(e) => setLocalRoundUpInterval(Number(e.target.value) as 15 | 30)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value={15}>{t('qr.interval15', '15분 단위')}</option>
                <option value={30}>{t('qr.interval30', '30분 단위')}</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-gray-500">
              {t(
                'qr.roundUpExplanation',
                `예: 17:47 퇴근 → ${localRoundUpInterval === 15 ? '18:00' : '18:00'}로 조정`
              )}
            </p>
          </div>
        )}

        {/* QR 디스플레이 */}
        <div className="flex justify-center">
          {activeTab === 'check-in' && (
            <QRDisplay
              eventId={eventId}
              date={date}
              type="check-in"
              roundUpInterval={localRoundUpInterval}
              createdBy={currentUser?.uid}
              size={300}
              showTitle={false}
            />
          )}

          {activeTab === 'check-out' && (
            <QRDisplay
              eventId={eventId}
              date={date}
              type="check-out"
              roundUpInterval={localRoundUpInterval}
              createdBy={currentUser?.uid}
              size={300}
              showTitle={false}
            />
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-600 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">
                {t('qr.infoTitle', '안내사항')}
              </h4>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('qr.info1', 'QR 코드는 1분마다 자동으로 재생성됩니다.')}</li>
                  <li>{t('qr.info2', '출근과 퇴근은 각각 별도의 QR 코드를 사용합니다.')}</li>
                  <li>
                    {t('qr.info3', '각 QR 코드는 한 번만 사용 가능하며, 2분 후 만료됩니다.')}
                  </li>
                  {activeTab === 'check-out' && (
                    <li>
                      {t(
                        'qr.info4',
                        `퇴근 시간은 ${localRoundUpInterval}분 단위로 자동 조정됩니다.`,
                        { interval: localRoundUpInterval }
                      )}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(QRCodeGeneratorModal);
