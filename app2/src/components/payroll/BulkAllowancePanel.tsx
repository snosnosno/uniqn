import React, { useState, useCallback, useEffect } from 'react';
import { BulkAllowanceSettings, AllowanceType } from '../../types/payroll';
import { Benefits } from '../../types/jobPosting/base';

interface BulkAllowancePanelProps {
  availableRoles: string[];
  onApply: (settings: BulkAllowanceSettings) => void;
  selectedStaffCount?: number;
  jobPostingBenefits?: Benefits | undefined;
}

const BulkAllowancePanel: React.FC<BulkAllowancePanelProps> = ({
  availableRoles,
  onApply,
  selectedStaffCount = 0,
  jobPostingBenefits,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [applyTo, setApplyTo] = useState<'all' | 'selected' | 'byRole'>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [allowances, setAllowances] = useState({
    meal: { enabled: false, amount: 0 },
    transportation: { enabled: false, amount: 0 },
    accommodation: { enabled: false, amount: 0 },
    bonus: { enabled: false, amount: 0 },
    other: { enabled: false, amount: 0, description: '' },
  });

  // Firebase에서 저장된 benefits 정보를 기반으로 allowances 초기화
  useEffect(() => {
    if (jobPostingBenefits && jobPostingBenefits.isPerDay) {
      const mealAmount = jobPostingBenefits.mealAllowance
        ? parseInt(jobPostingBenefits.mealAllowance) || 0
        : 0;
      const transportAmount = jobPostingBenefits.transportation
        ? parseInt(jobPostingBenefits.transportation) || 0
        : 0;
      const accommodationAmount = jobPostingBenefits.accommodation
        ? parseInt(jobPostingBenefits.accommodation) || 0
        : 0;

      setAllowances({
        meal: { enabled: mealAmount > 0, amount: mealAmount },
        transportation: { enabled: transportAmount > 0, amount: transportAmount },
        accommodation: { enabled: accommodationAmount > 0, amount: accommodationAmount },
        bonus: { enabled: false, amount: 0 },
        other: { enabled: false, amount: 0, description: '' },
      });
    }
  }, [jobPostingBenefits]);

  const handleAllowanceToggle = useCallback((type: AllowanceType) => {
    setAllowances((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !prev[type].enabled,
      },
    }));
  }, []);

  const handleAllowanceAmountChange = useCallback((type: AllowanceType, amount: string) => {
    const numAmount = parseInt(amount) || 0;
    setAllowances((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        amount: numAmount,
      },
    }));
  }, []);

  const handleOtherDescriptionChange = useCallback((description: string) => {
    setAllowances((prev) => ({
      ...prev,
      other: {
        ...prev.other,
        description,
      },
    }));
  }, []);

  const handleRoleToggle = useCallback((role: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      }
      return [...prev, role];
    });
  }, []);

  const handleApply = useCallback(() => {
    const settings: BulkAllowanceSettings = {
      applyTo,
      ...(applyTo === 'byRole' && { targetRoles: selectedRoles }),
      allowances: {
        meal: allowances.meal,
        transportation: allowances.transportation,
        accommodation: allowances.accommodation,
        bonus: allowances.bonus,
        other: allowances.other,
      },
    };
    onApply(settings);
  }, [applyTo, selectedRoles, allowances, onApply]);

  const getTotalAllowances = useCallback(() => {
    let total = 0;
    if (allowances.meal.enabled) total += allowances.meal.amount;
    if (allowances.transportation.enabled) total += allowances.transportation.amount;
    if (allowances.accommodation.enabled) total += allowances.accommodation.amount;
    if (allowances.bonus.enabled) total += allowances.bonus.amount;
    if (allowances.other.enabled) total += allowances.other.amount;
    return total;
  }, [allowances]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* 헤더 (클릭 가능) */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              💰 추가 수당 설정
            </h3>
            {getTotalAllowances() > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({getTotalAllowances().toLocaleString()}원)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <svg
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m19 9-7 7-7-7"
              />
            </svg>
          </div>
        </button>
      </div>

      {/* 내용 (접기/펼치기) */}
      {isExpanded && (
        <div className="p-6">
          {/* 적용 대상 선택 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              적용 대상
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setApplyTo('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  applyTo === 'all'
                    ? 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800'
                    : 'bg-gray-100 text-gray-700 dark:text-gray-200 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setApplyTo('selected')}
                disabled={selectedStaffCount === 0}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  applyTo === 'selected'
                    ? 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800'
                    : 'bg-gray-100 text-gray-700 dark:text-gray-200 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                선택 ({selectedStaffCount}명)
              </button>
              <button
                onClick={() => setApplyTo('byRole')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  applyTo === 'byRole'
                    ? 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800'
                    : 'bg-gray-100 text-gray-700 dark:text-gray-200 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                }`}
              >
                역할별
              </button>
            </div>
          </div>

          {/* 역할 선택 (역할별 적용 시) */}
          {applyTo === 'byRole' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                역할 선택
              </label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleToggle(role)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedRoles.includes(role)
                        ? 'bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800'
                        : 'bg-gray-100 text-gray-700 dark:text-gray-200 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 수당 설정 */}
          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">수당 항목</h4>

            {/* 식비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.meal.enabled}
                  onChange={() => handleAllowanceToggle('meal')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">식비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.meal.amount}
                  onChange={(e) => handleAllowanceAmountChange('meal', e.target.value)}
                  disabled={!allowances.meal.enabled}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600"
                  placeholder="0"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">원</span>
              </div>
            </div>

            {/* 교통비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.transportation.enabled}
                  onChange={() => handleAllowanceToggle('transportation')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">교통비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.transportation.amount}
                  onChange={(e) => handleAllowanceAmountChange('transportation', e.target.value)}
                  disabled={!allowances.transportation.enabled}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600"
                  placeholder="0"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">원</span>
              </div>
            </div>

            {/* 숙소비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.accommodation.enabled}
                  onChange={() => handleAllowanceToggle('accommodation')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">숙소비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.accommodation.amount}
                  onChange={(e) => handleAllowanceAmountChange('accommodation', e.target.value)}
                  disabled={!allowances.accommodation.enabled}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600"
                  placeholder="0"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">원</span>
              </div>
            </div>

            {/* 보너스 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.bonus.enabled}
                  onChange={() => handleAllowanceToggle('bonus')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">보너스</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.bonus.amount}
                  onChange={(e) => handleAllowanceAmountChange('bonus', e.target.value)}
                  disabled={!allowances.bonus.enabled}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600"
                  placeholder="0"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">원</span>
              </div>
            </div>

            {/* 기타 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allowances.other.enabled}
                    onChange={() => handleAllowanceToggle('other')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">기타</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={allowances.other.amount}
                    onChange={(e) => handleAllowanceAmountChange('other', e.target.value)}
                    disabled={!allowances.other.enabled}
                    className="w-32 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">원</span>
                </div>
              </div>
              {allowances.other.enabled && (
                <input
                  type="text"
                  value={allowances.other.description}
                  onChange={(e) => handleOtherDescriptionChange(e.target.value)}
                  className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="기타 수당 설명 (예: 야간수당)"
                />
              )}
            </div>
          </div>

          {/* 총 수당 및 적용 버튼 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">총 수당:</span>
              <span className="ml-2 text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                {getTotalAllowances().toLocaleString()}원
              </span>
            </div>
            <button
              onClick={handleApply}
              disabled={applyTo === 'byRole' && selectedRoles.length === 0}
              className="px-6 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              적용하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkAllowancePanel;
