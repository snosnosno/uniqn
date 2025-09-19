/**
 * ReportModal - 신고 모달 컴포넌트
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  FaExclamationTriangle,
  FaPaperPlane,
  FaInfoCircle
} from '../Icons/ReactIconsReplacement';
import Modal from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { logger } from '../../utils/logger';
import {
  collection,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  ReportType,
  ReporterType,
  REPORT_TYPES
} from '../../types/report';
import { InquiryCreateInput } from '../../types/inquiry';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 신고 대상자 정보 */
  targetUser: {
    id: string;
    name: string;
  };
  /** 이벤트 정보 */
  event: {
    id: string;
    title: string;
    date: string;
  };
  /** 신고자 유형 */
  reporterType: ReporterType;
}

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  event,
  reporterType
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [reportType, setReportType] = useState<ReportType>('tardiness');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 폼 초기화
  const resetForm = () => {
    setReportType('tardiness');
    // textarea 값 직접 초기화
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
  };

  // 모달 열림 시 초기화
  useEffect(() => {
    if (isOpen) {
      // 폼 초기화
      resetForm();
      // 포커스 설정 제거 - 사용자가 직접 클릭하여 입력하도록 함
    }
  }, [isOpen]);

  // 모달 닫기
  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };


  // 신고 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showError('로그인이 필요합니다.');
      return;
    }

    // textarea에서 실제 값 가져오기 (uncontrolled input)
    const actualDescription = textareaRef.current?.value || '';
    const actualLength = actualDescription.trim().length;

    if (actualLength === 0) {
      showError('신고 사유를 입력해주세요.');
      return;
    }

    // 기타 유형의 경우 더 자세한 설명 요구
    if (reportType === 'other' && actualLength < 10) {
      showError('기타 유형의 경우 10자 이상의 자세한 설명이 필요합니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 신고 유형에 따른 한국어 제목 생성
      const reportTypeNames: Record<ReportType, string> = {
        tardiness: '지각',
        negligence: '근무태만',
        no_show: '노쇼',
        inappropriate_behavior: '부적절한 행동',
        other: '기타 문제'
      };

      const reportTypeName = reportTypeNames[reportType];

      // inquiries 컬렉션에 저장 (신고 카테고리로)
      const inquiryData: InquiryCreateInput = {
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userName: currentUser.displayName || '사용자',
        category: 'report',
        subject: `[신고] ${reportTypeName} - ${targetUser.name} (${event.title})`,
        message: `신고 내용: ${actualDescription.trim()}\n\n--- 신고 상세 정보 ---\n신고 유형: ${reportTypeName}\n신고 대상: ${targetUser.name}\n이벤트: ${event.title}\n날짜: ${event.date}\n신고자 유형: ${reporterType === 'employer' ? '관리자' : '직원'}`
      };

      await addDoc(collection(db, 'inquiries'), {
        ...inquiryData,
        status: 'open',
        reportMetadata: {
          type: reportType,
          reporterType,
          targetId: targetUser.id,
          targetName: targetUser.name,
          eventId: event.id,
          eventTitle: event.title,
          date: event.date
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      showSuccess('신고가 접수되었습니다. 검토 후 처리하겠습니다.');

      logger.info('신고 접수 완료', {
        component: 'ReportModal',
        data: {
          reportType: reportType,
          reporterType,
          targetId: targetUser.id,
          eventId: event.id
        }
      });

      handleClose();

    } catch (error) {
      logger.error('신고 제출 실패:', error instanceof Error ? error : new Error(String(error)), {
        component: 'ReportModal'
      });
      showError('신고 제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title=""
      closeOnEsc={false}        // ESC 키 완전 비활성화
      closeOnBackdrop={false}   // 배경 클릭 비활성화
      showCloseButton={false}   // 기본 닫기 버튼 비활성화
      autoFocus={false}         // 자동 포커스 비활성화 (textarea 입력 방해 방지)
      disableFocusTrap={true}   // 포커스 트랩 완전 비활성화 (입력 중 포커스 이동 방지)
    >
      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FaExclamationTriangle className="w-6 h-6 text-red-500 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('report.title', '신고하기')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 신고 대상 정보 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-2">
            {t('report.targetInfo', '신고 대상')}
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <span className="font-medium">{t('report.targetName', '이름')}:</span> {targetUser.name}
            </div>
            <div>
              <span className="font-medium">{t('report.eventTitle', '이벤트')}:</span> {event.title}
            </div>
            <div>
              <span className="font-medium">{t('report.eventDate', '날짜')}:</span> {event.date}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 신고 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('report.type', '신고 유형')}
            </label>
            <div className="grid grid-cols-1 gap-3">
              {REPORT_TYPES.map((typeOption) => (
                <label
                  key={typeOption.key}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    reportType === typeOption.key
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    value={typeOption.key}
                    checked={reportType === typeOption.key}
                    onChange={(e) => setReportType(e.target.value as ReportType)}
                    className="mt-1 w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">
                      {t(typeOption.labelKey)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {t(typeOption.descriptionKey)}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        typeOption.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        typeOption.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        typeOption.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {t(`report.severity.${typeOption.severity}`, typeOption.severity)}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 상세 설명 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              {t('report.description', '상세 설명')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="description"
              defaultValue=""
              placeholder={
                reportType === 'other'
                  ? t('report.descriptionPlaceholder.other', '구체적인 상황과 문제점을 자세히 설명해주세요 (최소 10자)')
                  : t('report.descriptionPlaceholder.default', '발생한 상황을 구체적으로 설명해주세요')
              }
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              required
            />
            {reportType === 'other' && (
              <div className="mt-2 text-xs text-gray-500 flex items-center">
                <FaInfoCircle className="w-3 h-3 mr-1 text-blue-500" />
                {t('report.otherTypeNotice', '기타 유형은 10자 이상의 자세한 설명이 필요합니다.')}
              </div>
            )}
          </div>

          {/* 경고 메시지 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <FaInfoCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">
                  {t('report.warning.title', '신고 전 확인사항')}
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('report.warning.falseReport', '허위 신고 시 제재를 받을 수 있습니다.')}</li>
                  <li>{t('report.warning.evidence', '가능한 한 구체적이고 객관적인 사실을 기재해주세요.')}</li>
                  <li>{t('report.warning.processing', '신고 접수 후 관리자가 검토하여 처리합니다.')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {t('common.cancel', '취소')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {t('report.submitting', '제출 중...')}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <FaPaperPlane className="w-4 h-4 mr-2" />
                  {t('report.submit', '신고 제출')}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ReportModal;