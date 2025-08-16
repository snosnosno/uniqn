import React, { useState, useCallback, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { EnhancedPayrollCalculation, AllowanceType } from '../../types/payroll';
import { formatCurrency } from '../../i18n-helpers';

interface AllowanceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: EnhancedPayrollCalculation | null;
  onSave: (staffId: string, allowances: EnhancedPayrollCalculation['allowances']) => void;
}

const AllowanceEditModal: React.FC<AllowanceEditModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSave
}) => {
  const [allowances, setAllowances] = useState({
    meal: 0,
    transportation: 0,
    accommodation: 0,
    bonus: 0,
    other: 0,
    otherDescription: ''
  });

  // staff 데이터가 변경될 때 allowances 초기화
  useEffect(() => {
    if (staff) {
      setAllowances({
        meal: staff.allowances.meal || 0,
        transportation: staff.allowances.transportation || 0,
        accommodation: staff.allowances.accommodation || 0,
        bonus: staff.allowances.bonus || 0,
        other: staff.allowances.other || 0,
        otherDescription: staff.allowances.otherDescription || ''
      });
    }
  }, [staff]);

  const handleAmountChange = useCallback((type: AllowanceType, value: string) => {
    const numValue = parseInt(value) || 0;
    setAllowances(prev => ({
      ...prev,
      [type]: numValue
    }));
  }, []);

  const handleDescriptionChange = useCallback((value: string) => {
    setAllowances(prev => ({
      ...prev,
      otherDescription: value
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (staff) {
      onSave(staff.staffId, allowances);
      onClose();
    }
  }, [staff, allowances, onSave, onClose]);

  const getTotalAllowances = useCallback(() => {
    return allowances.meal + 
           allowances.transportation + 
           allowances.accommodation + 
           allowances.bonus + 
           allowances.other;
  }, [allowances]);

  const getTotalAmount = useCallback(() => {
    if (!staff) return 0;
    return staff.basePay + getTotalAllowances();
  }, [staff, getTotalAllowances]);

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {staff.staffName} - 수당 편집
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 기본 정보 */}
        <div className="px-6 py-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">기본 정보</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">역할:</span>
              <span className="font-medium">{staff.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">근무일수:</span>
              <span className="font-medium">{staff.totalDays}일</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">근무시간:</span>
              <span className="font-medium">{staff.totalHours.toFixed(1)}시간</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">기본급:</span>
              <span className="font-medium text-indigo-600">
                {formatCurrency(staff.basePay, 'KRW', 'ko')}
              </span>
            </div>
          </div>
        </div>

        {/* 수당 설정 */}
        <div className="px-6 py-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">수당 설정</h4>
          <div className="space-y-3">
            {/* 식비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.meal > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('meal', '0');
                    } else if (allowances.meal === 0) {
                      handleAmountChange('meal', '50000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">식비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.meal}
                  onChange={(e) => handleAmountChange('meal', e.target.value)}
                  disabled={allowances.meal === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 교통비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.transportation > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('transportation', '0');
                    } else if (allowances.transportation === 0) {
                      handleAmountChange('transportation', '30000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">교통비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.transportation}
                  onChange={(e) => handleAmountChange('transportation', e.target.value)}
                  disabled={allowances.transportation === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 숙소비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.accommodation > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('accommodation', '0');
                    } else if (allowances.accommodation === 0) {
                      handleAmountChange('accommodation', '100000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">숙소비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.accommodation}
                  onChange={(e) => handleAmountChange('accommodation', e.target.value)}
                  disabled={allowances.accommodation === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 보너스 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.bonus > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('bonus', '0');
                    } else if (allowances.bonus === 0) {
                      handleAmountChange('bonus', '100000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">보너스</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.bonus}
                  onChange={(e) => handleAmountChange('bonus', e.target.value)}
                  disabled={allowances.bonus === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 기타 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allowances.other > 0}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        handleAmountChange('other', '0');
                        handleDescriptionChange('');
                      } else if (allowances.other === 0) {
                        handleAmountChange('other', '50000');
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">기타</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={allowances.other}
                    onChange={(e) => handleAmountChange('other', e.target.value)}
                    disabled={allowances.other === 0}
                    className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  />
                  <span className="text-sm text-gray-500">원</span>
                </div>
              </div>
              {allowances.other > 0 && (
                <input
                  type="text"
                  value={allowances.otherDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="기타 수당 설명 (예: 야간수당)"
                />
              )}
            </div>
          </div>
        </div>

        {/* 합계 */}
        <div className="px-6 py-4 bg-gray-50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">수당 합계:</span>
            <span className="font-medium">
              {formatCurrency(getTotalAllowances(), 'KRW', 'ko')}
            </span>
          </div>
          <div className="flex justify-between text-base">
            <span className="font-medium text-gray-700">총 지급액:</span>
            <span className="font-bold text-indigo-600">
              {formatCurrency(getTotalAmount(), 'KRW', 'ko')}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllowanceEditModal;