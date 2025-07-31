import { QRCodeSVG } from 'qrcode.react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { callFunctionLazy } from '../utils/firebase-dynamic';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';

import Modal from './Modal';

interface QRCodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
  title?: string;
  description?: string;
}

const QRCodeGeneratorModal: React.FC<QRCodeGeneratorModalProps> = ({
  isOpen,
  onClose,
  eventId = 'default-event',
  title,
  description
}) => {
  const { t } = useTranslation();
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleGenerateQrCode = async () => {
    if (!eventId) {
      showError(t('attendance.messages.attendanceError'));
      return;
    }

    setIsGenerating(true);
    try {
      logger.info('QR 코드 생성 시작', { 
        operation: 'generateQrCode',
        eventId 
      });

      // 동적 로딩으로 Firebase 함수 호출
      const result = await callFunctionLazy('generateQrCodeToken', { eventId });
      
      const {token} = (result as { token: string });
      if (token) {
        const qrUrl = `${window.location.origin}/attend/${token}`;
        setQrCodeValue(qrUrl);
        showSuccess(t('attendance.messages.qrCodeGenerated'));
        
        logger.info('QR 코드 생성 완료', { 
          operation: 'generateQrCode',
          eventId,
          tokenGenerated: !!token
        });
      } else {
        throw new Error('토큰 생성 실패');
      }
    } catch (error: any) {
      logger.error('QR 코드 생성 실패', error, { 
        operation: 'generateQrCode',
        eventId,
        errorCode: error.code,
        errorMessage: error.message
      });
      
      // CORS 또는 네트워크 오류 시 폴백 처리
      if (error.code === 'functions/unavailable' || error.message?.includes('CORS')) {
        logger.warn('CORS 문제 감지, 폴백 모드로 전환', { 
          operation: 'generateQrCode',
          eventId 
        });
        
        // 폴백: 로컬 토큰 생성
        const fallbackToken = `fallback-${eventId}-${Date.now()}`;
        const qrUrl = `${window.location.origin}/attend/${fallbackToken}`;
        setQrCodeValue(qrUrl);
        showSuccess(`${t('attendance.messages.qrCodeGenerated')  } (폴백 모드)`);
      } else {
        showError(t('attendance.messages.attendanceError'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setQrCodeValue(null);
    setIsGenerating(false);
    onClose();
  };

  const modalTitle = title || t('attendance.actions.generateQR');
  const modalDescription = description || t('eventDetail.qrModalDescription');

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={modalTitle}
    >
      <div className="p-6 flex flex-col items-center">
        <p className="mb-6 text-center text-gray-600">{modalDescription}</p>
        
        {!qrCodeValue && !isGenerating && (
          <button
            onClick={handleGenerateQrCode}
            className="mb-6 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            {t('attendance.actions.generateQR')}
          </button>
        )}
        
        {isGenerating ? <div className="mb-6 flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="text-gray-600">{t('eventDetail.qrGenerating')}</span>
          </div> : null}
        
        {qrCodeValue ? <div className="mb-6">
            <div className="p-4 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
              <QRCodeSVG 
                value={qrCodeValue} 
                size={256}
                level="M"
                includeMargin
              />
            </div>
            <p className="mt-4 text-sm text-gray-500 text-center max-w-xs">
              {t('attendancePage.success')}
            </p>
          </div> : null}
        
        <div className="flex justify-end space-x-3 w-full">
          {qrCodeValue ? <button
              onClick={() => {
                setQrCodeValue(null);
                setIsGenerating(false);
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              새로 생성
            </button> : null}
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default QRCodeGeneratorModal;