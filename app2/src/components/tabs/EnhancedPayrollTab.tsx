import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import { JobPosting } from '../../types/jobPosting';
import { useUnifiedData } from '../../hooks/useUnifiedData';
import { logger } from '../../utils/logger';
import BulkAllowancePanel from '../payroll/BulkAllowancePanel';
import DetailEditModal from '../payroll/DetailEditModal';
import RoleSalarySettings from '../payroll/RoleSalarySettings';
import { EnhancedPayrollCalculation, BulkAllowanceSettings, RoleSalaryConfig } from '../../types/payroll';
import { usePayrollWorker } from '../../hooks/usePayrollWorker';
import { normalizeRole } from '../../utils/workLogHelpers';

interface EnhancedPayrollTabProps {
  jobPosting?: JobPosting | null;
  eventId?: string; // UnifiedData 필터링을 위한 선택적 eventId
}

const EnhancedPayrollTab: React.FC<EnhancedPayrollTabProps> = ({ jobPosting, eventId }) => {
  
  // 계산 중복 방지를 위한 ref
  const hasCalculated = useRef(false);
  const lastCalculationKey = useRef<string>('');
  
  // 모달 상태 관리
  const [editingStaff, setEditingStaff] = useState<EnhancedPayrollCalculation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 통합 데이터 훅 사용
  const { state, loading } = useUnifiedData();
  const dataLoading = loading.initial;
  
  // Web Worker 기반 정산 계산
  const {
    payrollData,
    summary,
    loading: calculationLoading,
    error: calculationError,
    calculatePayroll,
    isOptimized,
    calculationTime
  } = usePayrollWorker();
  
  // 실제 WorkLogs 데이터 (상태 변환 통일, eventId 필터링) - 메모이제이션 강화
  const workLogs = useMemo(() => {
    const workLogsArray = Array.from(state.workLogs.values());
    
    // jobPosting.id를 우선 사용, 없으면 eventId 사용
    const postingId = jobPosting?.id || eventId;
    
    // postingId가 있을 때만 필터링
    if (!postingId) {
      logger.warn('정산탭: jobPosting.id와 eventId 모두 없음', {
        component: 'EnhancedPayrollTab',
        data: { jobPostingExists: !!jobPosting, eventId }
      });
      return [];
    }
    
    const filteredWorkLogs = workLogsArray.filter(
      workLog => workLog.eventId === postingId
    );
    
    logger.info(`정산탭 WorkLog 필터링: ${filteredWorkLogs.length}개 (공고: ${postingId})`, {
      component: 'EnhancedPayrollTab', 
      data: { 
        postingId, 
        totalWorkLogs: workLogsArray.length,
        filteredCount: filteredWorkLogs.length,
        workLogDetails: filteredWorkLogs.map(log => ({
          id: log.id,
          staffId: log.staffId,
          date: log.date,
          role: log.role,
          eventId: log.eventId,
          staffName: log.staffName
        }))
      }
    });
    
    // 상태 변환은 한 번에 수행
    return filteredWorkLogs.map(workLog => ({
      ...workLog,
      // 상태 변환 통일 - UnifiedWorkLog 타입과 호환 (조건문 최적화)
      status: workLog.status === 'absent' ? 'cancelled' as const : 
              (workLog.status || 'not_started') as 'checked_in' | 'checked_out' | 'completed' | 'cancelled' | 'not_started'
    }));
  }, [state.workLogs, jobPosting?.id, eventId]);

  // 정산 기간 설정 (현재 월 기준)
  const { startDate, endDate } = useMemo((): { startDate: string; endDate: string } => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);
    
    return {
      startDate: start.toISOString().split('T')[0] || '',
      endDate: end.toISOString().split('T')[0] || ''
    };
  }, []);

  // 역할 목록 (UnifiedData에서 추출, jobPosting은 보조) - normalizeRole 적용
  const availableRoles = useMemo(() => {
    const roleSet = new Set<string>();
    
    // 1. WorkLogs에서 역할 추출 (정규화된 형태로 저장)
    workLogs.forEach(workLog => {
      if (workLog.role) {
        const normalizedRole = normalizeRole(workLog.role);
        if (normalizedRole) {
          roleSet.add(normalizedRole);
        }
      }
    });
    
    // 2. jobPosting의 confirmedStaff에서 추가 (정규화된 형태로)
    jobPosting?.confirmedStaff?.forEach(staff => {
      if (staff.role) {
        const normalizedRole = normalizeRole(staff.role);
        if (normalizedRole) {
          roleSet.add(normalizedRole);
        }
      }
    });
    
    // Set을 Array로 변환하면서 정렬까지 한 번에 수행
    const roles = roleSet.size > 0 ? Array.from(roleSet).sort() : [];
    
    logger.info('정산탭 역할 목록', {
      component: 'EnhancedPayrollTab',
      data: { 
        roles,
        workLogsCount: workLogs.length,
        confirmedStaffCount: jobPosting?.confirmedStaff?.length || 0
      }
    });
    
    return roles;
  }, [workLogs, jobPosting?.confirmedStaff]);

  // 수당 및 급여 오버라이드 상태 관리
  const [staffAllowanceOverrides, setStaffAllowanceOverrides] = useState<Record<string, any>>({});
  const [roleSalaryOverrides, setRoleSalaryOverrides] = useState<Record<string, { salaryType: string; salaryAmount: number }>>({});

  // 확정된 스태프 가져오기 (jobPosting 또는 UnifiedData에서) - 메모이제이션 강화
  const confirmedStaff = useMemo(() => {
    // jobPosting이 있으면 우선 사용 (early return)
    if (jobPosting?.confirmedStaff && jobPosting.confirmedStaff.length > 0) {
      return jobPosting.confirmedStaff;
    }
    
    // 이미 필터링된 workLogs와 staff 데이터 사용
    const staffArray = Array.from(state.staff.values());
    const staffLookup = new Map(staffArray.map(staff => [staff.id, staff]));
    
    // WorkLogs에서 확정된 스태프 추출 (이미 필터링된 workLogs 사용)
    const confirmedStaffMap = new Map();
    
    workLogs.forEach(workLog => {
      const key = `${workLog.staffId}_${workLog.role}`;
      if (!confirmedStaffMap.has(key)) {
        const staff = staffLookup.get(workLog.staffId);
        confirmedStaffMap.set(key, {
          userId: workLog.staffId,
          staffId: workLog.staffId,
          name: workLog.staffName || staff?.name || 'Unknown',
          role: workLog.role || 'Staff',
          timeSlot: `${workLog.scheduledStartTime ? new Date(workLog.scheduledStartTime.seconds * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '09:00'}-${workLog.scheduledEndTime ? new Date(workLog.scheduledEndTime.seconds * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : '18:00'}`,
          confirmedAt: workLog.createdAt || Timestamp.now(),
          status: 'confirmed' as const,
          phone: staff?.phone || '',
          note: ''
        });
      }
    });
    
    return Array.from(confirmedStaffMap.values());
  }, [jobPosting?.confirmedStaff, workLogs, state.staff]);

  // confirmedStaff 길이를 안정적인 변수로 메모이제이션 (useEffect 의존성 최적화)
  const confirmedStaffCount = useMemo(() => confirmedStaff?.length || 0, [confirmedStaff]);

  // 객체 참조 안정화를 위한 메모이제이션 (무한 루프 방지)
  const memoizedRoleSalaryOverrides = useMemo(() => 
    roleSalaryOverrides || {}, [JSON.stringify(roleSalaryOverrides)]
  );

  const memoizedStaffAllowanceOverrides = useMemo(() => 
    staffAllowanceOverrides || {}, [JSON.stringify(staffAllowanceOverrides)]
  );

  // 중복 계산 방지를 위한 키 메모이제이션 (무한 루프 방지)
  const calculationKey = useMemo(() => 
    `${workLogs.length}-${confirmedStaffCount}-${startDate}-${endDate}-${JSON.stringify(memoizedRoleSalaryOverrides)}-${JSON.stringify(memoizedStaffAllowanceOverrides)}`,
    [workLogs.length, confirmedStaffCount, startDate, endDate, memoizedRoleSalaryOverrides, memoizedStaffAllowanceOverrides]
  );

  // 정산 계산 실행 (메모이제이션으로 무한루프 방지)
  const memoizedCalculatePayroll = useCallback(() => {
    logger.info('정산 계산 조건 확인', {
      component: 'EnhancedPayrollTab',
      data: {
        hasConfirmedStaff: !!confirmedStaff,
        confirmedStaffLength: confirmedStaff?.length || 0,
        workLogsLength: workLogs.length,
        jobPostingId: jobPosting?.id || 'none'
      }
    });

    if (!confirmedStaff || confirmedStaff.length === 0 || workLogs.length === 0) {
      logger.warn('정산 계산 건너뛰기 - 필수 데이터 부족', {
        component: 'EnhancedPayrollTab',
        data: {
          hasConfirmedStaff: !!confirmedStaff,
          confirmedStaffLength: confirmedStaff?.length || 0,
          workLogsLength: workLogs.length
        }
      });
      return;
    }

    logger.info('Web Worker 정산 계산 시작', {
      component: 'EnhancedPayrollTab',
      data: {
        confirmedStaff: confirmedStaff.length,
        workLogs: workLogs.length,
        period: `${startDate} ~ ${endDate}`,
        dataSource: jobPosting ? 'jobPosting' : 'UnifiedData'
      }
    });

    calculatePayroll({
      workLogs,
      confirmedStaff: confirmedStaff || [],
      jobPosting: jobPosting || null,
      startDate: startDate,
      endDate: endDate,
      roleSalaryOverrides: memoizedRoleSalaryOverrides,
      staffAllowanceOverrides: memoizedStaffAllowanceOverrides
    });
  }, [workLogs, confirmedStaff, jobPosting, startDate, endDate, memoizedRoleSalaryOverrides, memoizedStaffAllowanceOverrides, calculatePayroll]);

  useEffect(() => {
    logger.info('useEffect 정산 계산 조건 체크', {
      component: 'EnhancedPayrollTab',
      data: {
        calculationLoading,
        workLogsLength: workLogs.length,
        confirmedStaffCount,
        currentCalculationKey: calculationKey,
        lastCalculationKey: lastCalculationKey.current,
        keyChanged: lastCalculationKey.current !== calculationKey
      }
    });

    // 임시로 조건을 단순화 - 디버깅용
    if (
      !calculationLoading && 
      workLogs.length > 0
      // confirmedStaffCount > 0 &&  // 임시로 주석 처리
      // lastCalculationKey.current !== calculationKey  // 임시로 주석 처리
    ) {
      logger.info('정산 계산 실행 조건 충족', {
        component: 'EnhancedPayrollTab'
      });
      lastCalculationKey.current = calculationKey;
      hasCalculated.current = true;
      memoizedCalculatePayroll();
    } else {
      logger.warn('정산 계산 실행 조건 불충족', {
        component: 'EnhancedPayrollTab',
        data: {
          calculationLoading,
          workLogsLength: workLogs.length,
          confirmedStaffCount,
          keyChanged: lastCalculationKey.current !== calculationKey
        }
      });
    }
  }, [calculationLoading, calculationKey, memoizedCalculatePayroll]);

  // 통합된 로딩 및 에러 상태
  const isLoading = dataLoading || calculationLoading;
  const error = state.error.global || calculationError;
  
  // 데이터 상태 디버깅 (production에서는 비활성화, 계산 중일 때는 로그 스킵)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !calculationLoading) {
      logger.debug('정산탭 데이터 상태 확인', {
        component: 'EnhancedPayrollTab',
        data: {
          dataLoading,
          calculationLoading,
          workLogsCount: workLogs.length,
          confirmedStaffCount: confirmedStaffCount,
          payrollDataCount: payrollData?.length || 0,
          hasJobPosting: !!jobPosting,
          error: error || null
        }
      });
    }
  }, [dataLoading, calculationLoading, workLogs.length, confirmedStaffCount, payrollData?.length, jobPosting, error]);

  // 실제 정산 데이터 사용
  const staffWorkData = payrollData || [];
  
  // 로컬 상태로 구현해야 할 기능들
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  
  const toggleStaffSelection = useCallback((staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  }, []);
  
  const toggleSelectAll = useCallback(() => {
    setSelectedStaffIds(prev => 
      prev.length === staffWorkData.length ? [] : staffWorkData.map(s => s.staffId)
    );
  }, [staffWorkData]);
  
  // CSV 내보내기 구현
  const exportToCSV = useCallback(() => {
    if (!payrollData || payrollData.length === 0) {
      logger.warn('내보낼 정산 데이터가 없습니다.', { component: 'EnhancedPayrollTab' });
      return;
    }

    try {
      const headers = [
        '이름',
        '역할', 
        '근무일수',
        '근무시간',
        '급여유형',
        '기본급',
        '수당',
        '총 지급액'
      ];
      
      const rows = payrollData.map(data => [
        data.staffName,
        data.role,
        `${data.totalDays}일`,
        `${data.totalHours}시간`,
        getSalaryTypeLabel(data.salaryType),
        data.basePay.toLocaleString('ko-KR'),
        data.allowanceTotal.toLocaleString('ko-KR'),
        data.totalAmount.toLocaleString('ko-KR')
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

      // BOM 추가하여 한글 깨짐 방지
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fileName = `정산_${startDate}_${endDate}_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logger.info('CSV 내보내기 완료', { 
        component: 'EnhancedPayrollTab', 
        data: { fileName, recordCount: payrollData.length }
      });
    } catch (error) {
      logger.error('CSV 내보내기 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'EnhancedPayrollTab'
      });
    }
  }, [payrollData, startDate, endDate]);

  // 대량 수당 적용 구현
  const applyBulkAllowances = useCallback((settings: BulkAllowanceSettings) => {
    if (!payrollData || payrollData.length === 0) {
      logger.warn('적용할 정산 데이터가 없습니다.', { component: 'EnhancedPayrollTab' });
      return;
    }

    logger.info('대량 수당 적용 시작', { 
      component: 'EnhancedPayrollTab', 
      data: { settings, targetCount: payrollData.length }
    });

    // 적용 대상 결정 (전체 또는 선택된 스태프)
    const targetStaffIds = selectedStaffIds.length > 0 ? selectedStaffIds : payrollData.map(data => data.staffId);
    
    // 수당 정보 업데이트
    const updates: Record<string, any> = {};
    
    targetStaffIds.forEach(staffId => {
      // 기존 수당과 새 설정 병합
      const existingAllowances = staffAllowanceOverrides[staffId] || {};
      updates[staffId] = {
        ...existingAllowances,
        meal: (settings.allowances.meal?.enabled ? settings.allowances.meal.amount : 0) ?? existingAllowances.meal ?? 0,
        transportation: (settings.allowances.transportation?.enabled ? settings.allowances.transportation.amount : 0) ?? existingAllowances.transportation ?? 0,
        accommodation: (settings.allowances.accommodation?.enabled ? settings.allowances.accommodation.amount : 0) ?? existingAllowances.accommodation ?? 0,
        bonus: (settings.allowances.bonus?.enabled ? settings.allowances.bonus.amount : 0) ?? existingAllowances.bonus ?? 0,
        other: (settings.allowances.other?.enabled ? settings.allowances.other.amount : 0) ?? existingAllowances.other ?? 0
      };
    });

    // 상태 업데이트
    setStaffAllowanceOverrides(prev => ({ ...prev, ...updates }));
    
    logger.info('대량 수당 적용 완료', { 
      component: 'EnhancedPayrollTab',
      data: { updatedStaff: targetStaffIds.length }
    });
  }, [payrollData, selectedStaffIds, staffAllowanceOverrides]);
  
  const updateStaffAllowances = useCallback((uniqueKey: string, allowances: any) => {
    logger.info('스태프 수당 업데이트', { 
      component: 'EnhancedPayrollTab', 
      data: { uniqueKey, allowances }
    });
    
    // 개별 스태프 수당 업데이트
    setStaffAllowanceOverrides(prev => ({
      ...prev,
      [uniqueKey]: allowances
    }));
  }, []);
  
  const updateRoleSalarySettings = useCallback((roleSalaries: RoleSalaryConfig) => {
    logger.info('역할별 급여 설정 업데이트', { 
      component: 'EnhancedPayrollTab',
      data: { roleSalaries }
    });
    
    // 역할별 급여 설정 전체 업데이트
    const updates: Record<string, { salaryType: string; salaryAmount: number }> = {};
    
    Object.entries(roleSalaries).forEach(([role, config]) => {
      updates[role] = {
        salaryType: config.salaryType,
        salaryAmount: config.salaryAmount
      };
    });
    
    setRoleSalaryOverrides(updates);
  }, []);

  // 디버깅 로그 (development 모드에서만)
  if (process.env.NODE_ENV === 'development' && payrollData?.length > 0) {
    logger.debug('EnhancedPayrollTab - 렌더링', {
      component: 'EnhancedPayrollTab',
      data: {
        payrollDataCount: staffWorkData.length,
        summary: summary || { totalStaff: 0, totalAmount: 0 },
        availableRoles,
        isOptimized,
        calculationTime: calculationTime || 0
      }
    });
  }

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
    updateStaffAllowances(staff.staffId, allowances);
    closeEditModal();
  }, [updateStaffAllowances, closeEditModal]);


  // 확정된 스태프가 없는 경우 (UnifiedData 기반 체크)
  if ((!confirmedStaff || confirmedStaff.length === 0) && workLogs.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            정산할 스태프 데이터가 없습니다
          </h3>
          <p className="text-gray-500 mb-4">
            근무 기록이 있는 스태프가 없습니다. 스태프 관리 또는 내 스케줄에서 근무 데이터를 확인해주세요.
          </p>
          <div className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg">
            💡 팁: 정산은 workLogs와 staff 데이터를 기반으로 자동 계산됩니다.
            <br />
            jobPosting이 없어도 UnifiedDataContext의 실시간 데이터로 정산이 가능합니다.
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
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
          <p className="text-red-600">{error || '알 수 없는 오류가 발생했습니다.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">정산 관리</h2>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          disabled={staffWorkData.length === 0}
        >
          CSV 내보내기
        </button>
      </div>

      {/* 요약 정보 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-around items-center mb-3">
          <div className="text-center">
            <h3 className="text-xs font-medium text-gray-500 mb-1">총 인원</h3>
            <p className="text-xl font-bold text-gray-900">
              {summary?.totalStaff || 0}명
            </p>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          <div className="text-center">
            <h3 className="text-xs font-medium text-gray-500 mb-1">총 지급액</h3>
            <p className="text-xl font-bold text-indigo-600">
              {(summary?.totalAmount || 0).toLocaleString('ko-KR')}원
            </p>
          </div>
        </div>
        
      </div>

      {/* 급여 설정 */}
      <RoleSalarySettings
        roles={availableRoles}
        jobPosting={jobPosting || null}
        onUpdate={updateRoleSalarySettings}
        className="mb-6"
      />

      {/* 추가 수당 설정 */}
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
                staffWorkData.map((data, index) => {
                  // 더 견고한 uniqueKey 생성 (staffId + role + period + index)
                  const uniqueKey = `${data.staffId}-${data.role}-${startDate}_${endDate}-${index}`;
                  const isSelected = selectedStaffIds.includes(data.staffId);
                  
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
                          onChange={() => toggleStaffSelection(data.staffId)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {data.staffName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {data.role}
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
                        {data.basePay.toLocaleString('ko-KR')}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {data.allowanceTotal.toLocaleString('ko-KR')}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {data.totalAmount.toLocaleString('ko-KR')}원
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
          workLogs={workLogs}  // workLogs를 props로 전달
          onSave={handleSaveAllowances}
        />
      )}

    </div>
  );
};

export default EnhancedPayrollTab;