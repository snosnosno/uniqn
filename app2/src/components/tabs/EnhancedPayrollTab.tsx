import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting } from '../../types/jobPosting';
import { useEnhancedPayroll } from '../../hooks/useEnhancedPayroll';
import { formatCurrency } from '../../i18n-helpers';
import { logger } from '../../utils/logger';
import BulkAllowancePanel from '../payroll/BulkAllowancePanel';
import DetailEditModal from '../payroll/DetailEditModal';
import RoleSalarySettings from '../payroll/RoleSalarySettings';
import BulkSalaryEditModal from '../payroll/BulkSalaryEditModal';
import { EnhancedPayrollCalculation } from '../../types/payroll';

interface EnhancedPayrollTabProps {
  jobPosting?: JobPosting | null;
}

const EnhancedPayrollTab: React.FC<EnhancedPayrollTabProps> = ({ jobPosting }) => {
  const { i18n } = useTranslation();
  
  // 날짜 범위는 전체 기간으로 고정

  // 모달 상태 관리
  const [editingStaff, setEditingStaff] = useState<EnhancedPayrollCalculation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkSalaryModalOpen, setIsBulkSalaryModalOpen] = useState(false);

  // 정산 데이터 조회
  const {
    payrollData,
    summary,
    loading,
    error,
    selectedStaffIds,
    toggleStaffSelection,
    toggleSelectAll,
    applyBulkAllowances,
    updateStaffAllowances,
    exportToCSV,
    availableRoles,
    updateRoleSalarySettings,
    handleBulkSalaryEdit,
    roleSalaryOverrides
  } = useEnhancedPayroll({
    ...(jobPosting?.id && { jobPostingId: jobPosting.id }),
    ...(jobPosting && { jobPosting }),
    confirmedStaff: jobPosting?.confirmedStaff || []
    // 날짜 필터 제거 - 전체 기간 자동 계산
  });


  // 급여 유형 한글 변환
  const getSalaryTypeLabel = useCallback((type: string) => {
    const labels: { [key: string]: string } = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타'
    };
    return labels[type] || type;
  }, []);

  // 수당 편집 모달 열기
  const openEditModal = useCallback((staff: EnhancedPayrollCalculation) => {
    // 디버깅: 전달되는 staff 데이터 확인
    logger.debug('EnhancedPayrollTab - openEditModal staff', { 
      component: 'EnhancedPayrollTab', 
      data: {
        staffId: staff.staffId,
        staffName: staff.staffName,
        role: staff.role,
        totalHours: staff.totalHours,
        workLogsCount: staff.workLogs?.length || 0
      }
    });
    
    if (staff.workLogs && staff.workLogs.length > 0) {
      const firstLog = staff.workLogs[0];
      if (firstLog) {
        logger.debug('EnhancedPayrollTab - 첫 번째 workLog 상세', { 
          component: 'EnhancedPayrollTab', 
          data: {
            id: firstLog.id,
            date: firstLog.date,
            scheduledStartTime: firstLog.scheduledStartTime ? 'set' : 'null',
            scheduledEndTime: firstLog.scheduledEndTime ? 'set' : 'null',
            actualStartTime: firstLog.actualStartTime ? 'set' : 'null',
            actualEndTime: firstLog.actualEndTime ? 'set' : 'null',
            assignedTime: (firstLog as any).assignedTime || 'none',
            isVirtual: (firstLog as any).isVirtual || false
          }
        });
      }
    }
    setEditingStaff(staff);
    setIsEditModalOpen(true);
  }, []);

  // 수당 편집 모달 닫기
  const closeEditModal = useCallback(() => {
    setEditingStaff(null);
    setIsEditModalOpen(false);
  }, []);

  // 수당 저장 핸들러
  const handleSaveAllowances = useCallback((staff: EnhancedPayrollCalculation, allowances: EnhancedPayrollCalculation['allowances']) => {
    const key = `${staff.staffId}_${staff.role}`;
    updateStaffAllowances(key, allowances);
  }, [updateStaffAllowances]);

  // 수당 상세 툴팁 생성
  const getAllowanceDetails = useCallback((data: EnhancedPayrollCalculation) => {
    const details = [];
    if (data.allowances.meal > 0) details.push(`식비: ${data.allowances.meal.toLocaleString()}원`);
    if (data.allowances.transportation > 0) details.push(`교통비: ${data.allowances.transportation.toLocaleString()}원`);
    if (data.allowances.accommodation > 0) details.push(`숙소비: ${data.allowances.accommodation.toLocaleString()}원`);
    if (data.allowances.bonus > 0) details.push(`보너스: ${data.allowances.bonus.toLocaleString()}원`);
    if (data.allowances.other > 0) {
      const desc = data.allowances.otherDescription ? ` (${data.allowances.otherDescription})` : '';
      details.push(`기타${desc}: ${data.allowances.other.toLocaleString()}원`);
    }
    return details.join('\n');
  }, []);

  // 전체 선택 상태 확인
  const isAllSelected = useMemo(() => {
    return payrollData.length > 0 && selectedStaffIds.length === payrollData.length;
  }, [payrollData, selectedStaffIds]);

  // 확정된 스태프가 없는 경우
  if (!jobPosting?.confirmedStaff || jobPosting.confirmedStaff.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            확정된 스태프가 없습니다
          </h3>
          <p className="text-gray-500">
            지원자를 승인하여 스태프로 확정한 후 정산을 진행할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">오류 발생</h3>
          <p className="text-red-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">정산 관리</h2>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            자동 불러오기
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            disabled={payrollData.length === 0}
          >
            CSV 내보내기
          </button>
        </div>
      </div>


      {/* 요약 카드 - 간소화된 버전 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-2">총 인원</h3>
          <p className="text-3xl font-bold text-gray-900">{summary.totalStaff}명</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 mb-2">총 지급액</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {formatCurrency(summary.totalAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
          </p>
        </div>
      </div>

      {/* 역할별 급여 설정 */}
      <RoleSalarySettings
        roles={availableRoles}
        jobPosting={jobPosting}
        onUpdate={updateRoleSalarySettings}
        className="mb-6"
      />

      {/* 일괄 수당 적용 패널 */}
      <BulkAllowancePanel
        availableRoles={availableRoles}
        onApply={applyBulkAllowances}
        selectedStaffCount={selectedStaffIds.length}
      />

      {/* 스태프별 상세 내역 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">📋 상세 내역</h3>
          <div className="flex items-center gap-3">
            {selectedStaffIds.length > 0 && (
              <>
                <button
                  onClick={() => setIsBulkSalaryModalOpen(true)}
                  className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors"
                >
                  급여 일괄편집
                </button>
                <span className="text-sm text-gray-500">
                  {selectedStaffIds.length}명 선택됨
                </span>
              </>
            )}
          </div>
        </div>
        
        {payrollData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    스태프
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    역할
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무일수
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무시간
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    급여유형
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기본급여
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수당
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총액
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrollData.map((data) => (
                  <tr 
                    key={`${data.staffId}_${data.role}`} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openEditModal(data)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.includes(`${data.staffId}_${data.role}`)}
                        onChange={() => toggleStaffSelection(`${data.staffId}_${data.role}`)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{data.staffName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{data.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{data.totalDays}일</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{data.totalHours.toFixed(1)}시간</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {getSalaryTypeLabel(data.salaryType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(data.basePay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div 
                        className="text-sm text-gray-900"
                        title={getAllowanceDetails(data)}
                      >
                        {data.allowanceTotal > 0 
                          ? formatCurrency(data.allowanceTotal, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)
                          : '-'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-indigo-600">
                        {formatCurrency(data.totalAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="text-gray-400 text-6xl mb-4">💰</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              정산 내역이 없습니다
            </h3>
            <p className="text-gray-500">
              선택한 기간에 근무 기록이 없습니다.
            </p>
          </div>
        )}
      </div>

      {/* 상세 편집 모달 */}
      <DetailEditModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        staff={editingStaff}
        onSave={handleSaveAllowances}
      />

      {/* 일괄 급여 편집 모달 */}
      <BulkSalaryEditModal
        isOpen={isBulkSalaryModalOpen}
        selectedStaff={payrollData.filter(data => selectedStaffIds.includes(`${data.staffId}_${data.role}`))}
        availableRoles={availableRoles}
        onApply={handleBulkSalaryEdit}
        onClose={() => setIsBulkSalaryModalOpen(false)}
      />
    </div>
  );
};

export default EnhancedPayrollTab;