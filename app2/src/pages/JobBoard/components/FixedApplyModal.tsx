import React from 'react';
import { useTranslation } from 'react-i18next';
import { FixedJobPosting, RoleWithCount } from '@/types/jobPosting/jobPosting';
import { formatWorkTimeDisplay } from '@/utils/jobPosting/jobPostingHelpers';

interface FixedApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  posting: FixedJobPosting;
  selectedRoles: string[];
  onRoleChange: (role: string, isChecked: boolean) => void;
  onApply: () => void;
  isProcessing: boolean;
}

/**
 * 고정공고 지원 모달 컴포넌트
 *
 * 고정공고는 날짜가 없고 역할만 선택하면 됩니다.
 */
const FixedApplyModal: React.FC<FixedApplyModalProps> = ({
  isOpen,
  onClose,
  posting,
  selectedRoles,
  onRoleChange,
  onApply,
  isProcessing,
}) => {
  const { t } = useTranslation();

  if (!isOpen || !posting.fixedData) return null;

  const { fixedData } = posting;
  const { workSchedule, requiredRolesWithCount = [] } = fixedData;

  // 근무 일정 텍스트
  const scheduleText = workSchedule
    ? `주 ${workSchedule.daysPerWeek}일 근무 · ${formatWorkTimeDisplay(workSchedule.startTime, workSchedule.endTime)}`
    : '근무 일정 미정';

  return (
    <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-20 mx-auto p-4 sm:p-6 border w-full max-w-[95%] sm:max-w-lg shadow-lg rounded-md bg-white dark:bg-gray-800">
        {/* 헤더 */}
        <div className="mb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
            {posting.title} 지원하기
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">📌 고정공고</p>
        </div>

        {/* 근무 정보 */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <span>📅</span>
            <span>{scheduleText}</span>
          </div>
          {posting.location && (
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 mt-1">
              <span>📍</span>
              <span>
                {posting.location}
                {posting.district && ` (${posting.district})`}
              </span>
            </div>
          )}
        </div>

        {/* 역할 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            지원할 역할 선택 (여러 개 선택 가능)
          </label>

          {requiredRolesWithCount.length > 0 ? (
            <div className="space-y-2">
              {requiredRolesWithCount.map((role: RoleWithCount, index: number) => {
                const isSelected = selectedRoles.includes(role.name);

                return (
                  <label
                    key={index}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all border-2 ${
                      isSelected
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onRoleChange(role.name, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <span className="ml-3 flex-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        👤 {t(`roles.${role.name}`, role.name)}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        (모집 {role.count}명)
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <p>모집 역할 정보가 없습니다.</p>
            </div>
          )}
        </div>

        {/* 안내 문구 */}
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600 dark:text-yellow-400">💡</span>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              고정공고는 상시 모집 공고입니다. 지원 후 채용 담당자가 연락드립니다.
            </p>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-500 min-h-[44px] text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onApply}
            disabled={selectedRoles.length === 0 || isProcessing}
            className="py-2 px-4 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 min-h-[44px] text-sm"
          >
            {isProcessing ? '처리 중...' : `지원하기 (${selectedRoles.length}개)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FixedApplyModal;
