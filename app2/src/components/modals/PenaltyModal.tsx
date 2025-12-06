/**
 * PenaltyModal - 패널티 관리 모달
 *
 * 사용자에게 패널티를 부여하고 이력을 관리합니다.
 *
 * @version 1.0
 * @since 2025-01-01
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { usePenalties } from '../../hooks/usePenalties';
import { penaltyCreateSchema } from '../../schemas/penalty.schema';
import {
  WARNING_DURATION_OPTIONS,
  LOGIN_BLOCK_DURATION_OPTIONS,
  PENALTY_DURATION_OPTIONS,
} from '../../types/penalty';
import type { PenaltyDuration, PenaltyType, Penalty } from '../../types/penalty';
import Modal, { ModalFooter } from '../ui/Modal';
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ShieldExclamationIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';

/** 사용자 기본 정보 */
interface UserBasic {
  id: string;
  name: string;
  email: string;
}

interface PenaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserBasic | null;
}

/** 패널티 상태 배지 */
const StatusBadge: React.FC<{ status: Penalty['status'] }> = ({ status }) => {
  const { t } = useTranslation();

  const statusConfig = {
    active: {
      label: t('penalty.status.active'),
      className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      Icon: ExclamationTriangleIcon,
    },
    expired: {
      label: t('penalty.status.expired'),
      className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
      Icon: CheckCircleIcon,
    },
    cancelled: {
      label: t('penalty.status.cancelled'),
      className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      Icon: XCircleIcon,
    },
  };

  const config = statusConfig[status];
  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

/** 패널티 유형 배지 */
const TypeBadge: React.FC<{ type: PenaltyType }> = ({ type }) => {
  const { t } = useTranslation();

  const typeConfig = {
    warning: {
      label: t('penalty.typeWarning'),
      className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      Icon: ShieldExclamationIcon,
    },
    loginBlock: {
      label: t('penalty.typeLoginBlock'),
      className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      Icon: NoSymbolIcon,
    },
  };

  const config = typeConfig[type];
  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

/** 패널티 이력 아이템 */
const PenaltyHistoryItem: React.FC<{
  penalty: Penalty;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}> = ({ penalty, onCancel, isCancelling }) => {
  const { t } = useTranslation();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const formatDate = (timestamp: { toDate: () => Date } | null) => {
    if (!timestamp) return t('penalty.permanent');
    return timestamp.toDate().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDurationLabel = (duration: PenaltyDuration) => {
    const option = PENALTY_DURATION_OPTIONS.find((o) => o.value === duration);
    return option ? t(option.labelKey) : duration;
  };

  const handleCancelSubmit = () => {
    if (cancelReason.trim().length < 2) {
      toast.error(t('penalty.cancelReasonPlaceholder'));
      return;
    }
    onCancel(penalty.id);
    setShowCancelForm(false);
    setCancelReason('');
  };

  return (
    <div
      className={`p-3 rounded-lg border ${
        penalty.status === 'active'
          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {penalty.type && <TypeBadge type={penalty.type} />}
            <StatusBadge status={penalty.status} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getDurationLabel(penalty.duration)}
            </span>
          </div>
          <p
            className={`text-sm font-medium ${
              penalty.status === 'cancelled'
                ? 'line-through text-gray-400 dark:text-gray-500'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {penalty.reason}
          </p>
          {penalty.details && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{penalty.details}</p>
          )}
          <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {t('penalty.startDate')}: {formatDate(penalty.startDate)}
            </span>
            <span>
              {t('penalty.expires')}: {formatDate(penalty.endDate)}
            </span>
          </div>
          {penalty.status === 'cancelled' && penalty.cancelReason && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {t('penalty.cancelReason')}: {penalty.cancelReason}
            </p>
          )}
        </div>

        {/* 취소 버튼 */}
        {penalty.status === 'active' && (
          <div className="ml-2">
            {!showCancelForm ? (
              <button
                onClick={() => setShowCancelForm(true)}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                {t('penalty.cancel')}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('penalty.cancelReasonPlaceholder')}
                  className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleCancelSubmit}
                    disabled={isCancelling}
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {isCancelling ? '...' : t('common.confirm')}
                  </button>
                  <button
                    onClick={() => {
                      setShowCancelForm(false);
                      setCancelReason('');
                    }}
                    className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PenaltyModal: React.FC<PenaltyModalProps> = ({ isOpen, onClose, user }) => {
  const { t } = useTranslation();
  const [type, setType] = useState<PenaltyType>('warning');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [duration, setDuration] = useState<PenaltyDuration>('3d');
  const [validationError, setValidationError] = useState<string | null>(null);

  // 유형에 따른 기간 옵션
  const durationOptions =
    type === 'warning' ? WARNING_DURATION_OPTIONS : LOGIN_BLOCK_DURATION_OPTIONS;

  const { penalties, loading, isAdding, isCancelling, addPenalty, cancelPenalty } = usePenalties(
    user?.id || null
  );

  // 유형 변경 시 기간 초기화
  const handleTypeChange = (newType: PenaltyType) => {
    setType(newType);
    // 유형에 맞는 기본 기간으로 설정
    setDuration(newType === 'warning' ? '3d' : '1d');
  };

  // 폼 초기화
  const resetForm = useCallback(() => {
    setType('warning');
    setReason('');
    setDetails('');
    setDuration('3d');
    setValidationError(null);
  }, []);

  // 패널티 추가
  const handleAddPenalty = async () => {
    if (!user) return;

    setValidationError(null);

    // Zod 검증
    const result = penaltyCreateSchema.safeParse({
      userId: user.id,
      type,
      reason,
      details: details || undefined,
      duration,
    });

    if (!result.success) {
      const firstError = result.error.errors[0];
      setValidationError(firstError?.message || '유효성 검증 실패');
      return;
    }

    try {
      await addPenalty({
        type,
        reason,
        details: details || undefined,
        duration,
      });
      toast.success(t('penalty.addSuccess'));
      resetForm();
    } catch (error) {
      logger.error('패널티 추가 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'PenaltyModal',
        userId: user.id,
      });
      toast.error(t('penalty.addError'));
    }
  };

  // 패널티 취소
  const handleCancelPenalty = async (penaltyId: string) => {
    try {
      await cancelPenalty(penaltyId, '관리자에 의해 취소됨');
      toast.success(t('penalty.cancelSuccess'));
    } catch (error) {
      logger.error('패널티 취소 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'PenaltyModal',
      });
      toast.error(t('penalty.cancelError'));
    }
  };

  if (!user) return null;

  const footerButtons = (
    <ModalFooter>
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
      >
        {t('common.close')}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('penalty.title')} - ${user.name}`}
      size="lg"
      footer={footerButtons}
      aria-label={t('penalty.title')}
    >
      <div className="space-y-6">
        {/* 패널티 추가 폼 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('penalty.addNew')}
          </h4>

          <div className="space-y-3">
            {/* 유형 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('penalty.type')} *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('warning')}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                    type === 'warning'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <ShieldExclamationIcon
                    className={`w-6 h-6 ${
                      type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium mt-1 ${
                      type === 'warning'
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {t('penalty.typeWarning')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 text-center">
                    {t('penalty.warningDescription')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('loginBlock')}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                    type === 'loginBlock'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <NoSymbolIcon
                    className={`w-6 h-6 ${
                      type === 'loginBlock' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium mt-1 ${
                      type === 'loginBlock'
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {t('penalty.typeLoginBlock')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 text-center">
                    {t('penalty.loginBlockDescription')}
                  </span>
                </button>
              </div>
            </div>

            {/* 사유 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('penalty.reason')} *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('penalty.reasonPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                maxLength={100}
              />
            </div>

            {/* 기간 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('penalty.selectDuration')}
              </label>
              <div className="flex flex-wrap gap-2">
                {durationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDuration(option.value)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      duration === option.value
                        ? type === 'warning'
                          ? 'bg-yellow-500 border-yellow-500 text-white'
                          : 'bg-red-600 border-red-600 text-white'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* 상세 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('penalty.details')}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t('penalty.detailsPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                maxLength={500}
              />
            </div>

            {/* 에러 메시지 */}
            {validationError && (
              <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
            )}

            {/* 추가 버튼 */}
            <button
              onClick={handleAddPenalty}
              disabled={isAdding || !reason.trim()}
              className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isAdding ? t('common.processing') : t('penalty.addNew')}
            </button>
          </div>
        </div>

        {/* 패널티 이력 */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('penalty.history')}
          </h4>

          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : penalties.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('penalty.noHistory')}
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {penalties.map((penalty) => (
                <PenaltyHistoryItem
                  key={penalty.id}
                  penalty={penalty}
                  onCancel={handleCancelPenalty}
                  isCancelling={isCancelling}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PenaltyModal;
