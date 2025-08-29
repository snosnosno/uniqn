import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { XMarkIcon, CurrencyDollarIcon, UsersIcon } from '@heroicons/react/24/outline';
import { EnhancedPayrollCalculation, BulkSalaryUpdate, BulkSalaryEditResult } from '../../types/payroll';
import { formatCurrency } from '../../i18n-helpers';
import { logger } from '../../utils/logger';

interface BulkSalaryEditModalProps {
  isOpen: boolean;
  selectedStaff: EnhancedPayrollCalculation[];
  availableRoles: string[];
  onApply: (update: BulkSalaryUpdate) => Promise<BulkSalaryEditResult>;
  onClose: () => void;
}

const BulkSalaryEditModal: React.FC<BulkSalaryEditModalProps> = ({
  isOpen,
  selectedStaff,
  availableRoles,
  onApply,
  onClose
}) => {
  const [applyMode, setApplyMode] = useState<'selected' | 'byRole'>('selected');
  const [targetRole, setTargetRole] = useState<string>('');
  const [salaryType, setSalaryType] = useState<'hourly' | 'daily' | 'monthly' | 'other'>('hourly');
  const [salaryAmount, setSalaryAmount] = useState<number>(15000);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewResult, setPreviewResult] = useState<BulkSalaryEditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      setApplyMode('selected');
      setTargetRole('');
      setSalaryType('hourly');
      setSalaryAmount(15000);
      setIsPreviewMode(false);
      setPreviewResult(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // 적용 대상 스태프 계산
  const targetStaff = useMemo(() => {
    if (applyMode === 'selected') {
      return selectedStaff;
    } else {
      return selectedStaff.filter(staff => staff.role === targetRole);
    }
  }, [applyMode, selectedStaff, targetRole]);

  // 급여 유형 라벨
  const getSalaryTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타'
    };
    return labels[type] || type;
  }, []);

  // 미리보기 실행
  const handlePreview = useCallback(async () => {
    if (targetStaff.length === 0) return;

    setIsLoading(true);
    try {
      const updateData: BulkSalaryUpdate = {
        targetStaffIds: targetStaff.map(staff => `${staff.staffId}_${staff.role}`),
        salaryType,
        salaryAmount,
        previewMode: true,
        ...(applyMode === 'byRole' && targetRole && { applyToRole: targetRole })
      };

      const result = await onApply(updateData);
      setPreviewResult(result);
      setIsPreviewMode(true);

      logger.info('일괄 급여 편집 미리보기 실행', {
        component: 'BulkSalaryEditModal',
        operation: 'preview'
      });
    } catch (error) {
      logger.error('일괄 급여 편집 미리보기 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'BulkSalaryEditModal'
      });
    } finally {
      setIsLoading(false);
    }
  }, [targetStaff, salaryType, salaryAmount, applyMode, targetRole, onApply]);

  // 최종 적용
  const handleApplyChanges = useCallback(async () => {
    if (!previewResult || targetStaff.length === 0) return;

    setIsLoading(true);
    try {
      const updateData: BulkSalaryUpdate = {
        targetStaffIds: targetStaff.map(staff => `${staff.staffId}_${staff.role}`),
        salaryType,
        salaryAmount,
        previewMode: false,
        ...(applyMode === 'byRole' && targetRole && { applyToRole: targetRole })
      };

      await onApply(updateData);
      
      logger.info('일괄 급여 편집 적용 완료', {
        component: 'BulkSalaryEditModal',
        operation: 'apply'
      });

      onClose();
    } catch (error) {
      logger.error('일괄 급여 편집 적용 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'BulkSalaryEditModal'
      });
    } finally {
      setIsLoading(false);
    }
  }, [previewResult, targetStaff, salaryType, salaryAmount, applyMode, targetRole, onApply, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        {/* 헤더 */}
        <div className="flex justify-between items-center pb-4 border-b">
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-medium text-gray-900">
              급여 일괄 편집
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-4 space-y-6">
          {/* 적용 대상 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              적용 대상
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="applyMode"
                  value="selected"
                  checked={applyMode === 'selected'}
                  onChange={(e) => setApplyMode(e.target.value as 'selected' | 'byRole')}
                  className="mr-2"
                />
                선택된 스태프 ({selectedStaff.length}명)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="applyMode"
                  value="byRole"
                  checked={applyMode === 'byRole'}
                  onChange={(e) => setApplyMode(e.target.value as 'selected' | 'byRole')}
                  className="mr-2"
                />
                특정 역할만
              </label>
            </div>
          </div>

          {/* 역할 선택 */}
          {applyMode === 'byRole' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                대상 역할
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">역할을 선택하세요</option>
                {availableRoles.map(role => {
                  const count = selectedStaff.filter(s => s.role === role).length;
                  return (
                    <option key={role} value={role}>
                      {role} ({count}명)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* 급여 설정 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                급여 유형
              </label>
              <select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value as typeof salaryType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="hourly">시급</option>
                <option value="daily">일급</option>
                <option value="monthly">월급</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                급여 금액
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                  원
                </span>
              </div>
            </div>
          </div>

          {/* 적용 대상 요약 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <UsersIcon className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">적용 대상 요약</h4>
                <p className="text-sm text-blue-700 mt-1">
                  {targetStaff.length}명의 스태프에게 {getSalaryTypeLabel(salaryType)}{' '}
                  {salaryAmount.toLocaleString('ko-KR')}원을 적용합니다.
                </p>
                {applyMode === 'byRole' && targetRole && (
                  <p className="text-xs text-blue-600 mt-1">
                    역할: {targetRole}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 미리보기 결과 */}
          {isPreviewMode && previewResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">변경 미리보기</h4>
                <span className="text-sm text-gray-500">
                  총 {previewResult.affectedStaff.length}건 변경
                </span>
              </div>
              
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        스태프
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        변경 전
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        변경 후
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        차이
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewResult.affectedStaff.map((staff, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {staff.staffName}
                          <div className="text-xs text-gray-500">{staff.role}</div>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {getSalaryTypeLabel(staff.beforeSalary.type)}<br />
                          {staff.beforeSalary.amount.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {getSalaryTypeLabel(staff.afterSalary.type)}<br />
                          {staff.afterSalary.amount.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          <span className={`font-medium ${
                            staff.amountDifference > 0 ? 'text-green-600' :
                            staff.amountDifference < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {staff.amountDifference > 0 ? '+' : ''}
                            {staff.amountDifference.toLocaleString('ko-KR')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 총 변경 금액 */}
              {previewResult.totalAmountDifference !== 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      총 급여 변경액
                    </span>
                    <span className={`text-lg font-bold ${
                      previewResult.totalAmountDifference > 0 ? 'text-green-600' :
                      previewResult.totalAmountDifference < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {previewResult.totalAmountDifference > 0 ? '+' : ''}
                      {previewResult.totalAmountDifference.toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 버튼 그룹 */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              취소
            </button>
            
            {!isPreviewMode ? (
              <button
                onClick={handlePreview}
                disabled={isLoading || targetStaff.length === 0 || (applyMode === 'byRole' && !targetRole)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? '처리 중...' : '미리보기'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsPreviewMode(false);
                    setPreviewResult(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-600 rounded-md hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  다시 설정
                </button>
                <button
                  onClick={handleApplyChanges}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? '적용 중...' : '변경 적용'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkSalaryEditModal;