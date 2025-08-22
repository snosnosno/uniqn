import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting } from '../../types/jobPosting';
import { useStaffWorkData } from '../../hooks/useStaffWorkData';
import { useJobPostingContext } from '../../contexts/JobPostingContextAdapter';
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
  const { refreshStaff, refreshWorkLogs } = useJobPostingContext();
  
  // 모달 상태 관리
  const [editingStaff, setEditingStaff] = useState<EnhancedPayrollCalculation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkSalaryModalOpen, setIsBulkSalaryModalOpen] = useState(false);

  // 통합 훅 사용 - 모든 데이터와 로직이 여기에 통합됨
  const {
    staffWorkData,
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
    getSalaryInfo
  } = useStaffWorkData({
    eventId: jobPosting?.id
  });

  // 디버깅 로그
  logger.debug('EnhancedPayrollTab - 렌더링', {
    component: 'EnhancedPayrollTab',
    data: {
      staffWorkDataCount: staffWorkData.length,
      summary,
      availableRoles
    }
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
  const openEditModal = useCallback((data: any) => {
    logger.debug('EnhancedPayrollTab - 수당 편집 모달 열기', { 
      component: 'EnhancedPayrollTab', 
      data: {
        uniqueKey: data.uniqueKey,
        staffName: data.staffName,
        role: data.role
      }
    });
    
    setEditingStaff(data);
    setIsEditModalOpen(true);
  }, []);

  // 수당 편집 모달 닫기
  const closeEditModal = useCallback(() => {
    setEditingStaff(null);
    setIsEditModalOpen(false);
  }, []);

  // 수당 저장
  const handleSaveAllowances = useCallback((staff: EnhancedPayrollCalculation, allowances: EnhancedPayrollCalculation['allowances']) => {
    logger.debug('EnhancedPayrollTab - 수당 저장', {
      component: 'EnhancedPayrollTab',
      data: {
        staffId: staff.staffId,
        uniqueKey: (staff as any).uniqueKey,
        allowances
      }
    });
    
    // uniqueKey를 사용하여 업데이트 (이제 staffId만 사용)
    const uniqueKey = (staff as any).uniqueKey || staff.staffId;
    updateStaffAllowances(uniqueKey, allowances);
    closeEditModal();
  }, [updateStaffAllowances, closeEditModal]);

  // 일괄 급여 수정 핸들러
  const handleBulkSalaryEdit = useCallback((updates: any) => {
    logger.debug('EnhancedPayrollTab - 일괄 급여 수정', {
      component: 'EnhancedPayrollTab',
      data: updates
    });
    
    // 역할별 급여 설정 업데이트
    const roleSalaryConfig: any = {};
    if (updates.role && updates.salaryType && updates.salaryAmount) {
      roleSalaryConfig[updates.role] = {
        salaryType: updates.salaryType,
        salaryAmount: updates.salaryAmount
      };
      updateRoleSalarySettings(roleSalaryConfig);
    }
    
    setIsBulkSalaryModalOpen(false);
  }, [updateRoleSalarySettings]);

  // 자동 불러오기 핸들러
  const handleRefresh = useCallback(() => {
    logger.info('정산 데이터 새로고침 시작', { component: 'EnhancedPayrollTab' });
    refreshStaff();
    refreshWorkLogs();
    // 추가 동기화를 위한 재호출
    setTimeout(() => {
      refreshWorkLogs();
    }, 500);
  }, [refreshStaff, refreshWorkLogs]);

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
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            자동 불러오기
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            disabled={staffWorkData.length === 0}
          >
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
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

      {/* 상세 내역 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">📋 상세 내역</h3>
          <div className="flex gap-2">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {selectedStaffIds.length === staffWorkData.length ? '전체 해제' : '전체 선택'}
            </button>
            {selectedStaffIds.length > 0 && (
              <button
                onClick={() => setIsBulkSalaryModalOpen(true)}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                선택 항목 급여 수정
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  선택
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  역할
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  근무일수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  근무시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  급여유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  기본급
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  수당
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  총 지급액
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffWorkData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    정산 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                staffWorkData.map((data) => {
                  const uniqueKey = (data as any).uniqueKey || data.staffId;
                  const isSelected = selectedStaffIds.includes(uniqueKey);
                  const roles = (data as any).roles || [data.role];
                  
                  return (
                    <tr 
                      key={uniqueKey} 
                      className={`${isSelected ? 'bg-indigo-50' : ''} hover:bg-gray-50 cursor-pointer transition-colors`}
                      onClick={(e) => {
                        // 체크박스 클릭은 제외
                        const target = e.target as HTMLInputElement;
                        if (!target.type || target.type !== 'checkbox') {
                          openEditModal(data);
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStaffSelection(uniqueKey)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {data.staffName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {roles.join(', ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {data.totalDays}일
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {data.totalHours.toFixed(1)}시간
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getSalaryTypeLabel(data.salaryType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(data.basePay, 'KRW', 'ko')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(data.allowanceTotal, 'KRW', 'ko')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(data.totalAmount, 'KRW', 'ko')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수당 편집 모달 */}
      {isEditModalOpen && editingStaff && (
        <DetailEditModal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          staff={editingStaff}
          onSave={handleSaveAllowances}
        />
      )}

      {/* 일괄 급여 편집 모달 */}
      {isBulkSalaryModalOpen && (
        <BulkSalaryEditModal
          isOpen={isBulkSalaryModalOpen}
          onClose={() => setIsBulkSalaryModalOpen(false)}
          availableRoles={availableRoles}
          selectedStaff={staffWorkData.filter(data => selectedStaffIds.includes((data as any).uniqueKey))}
          onApply={async (update) => {
            handleBulkSalaryEdit(update);
            return { 
              affectedStaff: [],
              totalAmountDifference: 0,
              successCount: selectedStaffIds.length,
              failCount: 0
            };
          }}
        />
      )}
    </div>
  );
};

export default EnhancedPayrollTab;