import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { JobPosting } from '../../types/jobPosting';
import { useUnifiedData } from '../../hooks/useUnifiedData';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import { toISODateString } from '../../utils/dateUtils';
import BulkAllowancePanel from '../payroll/BulkAllowancePanel';
import TaxSettingsPanel from '../payroll/TaxSettingsPanel';
import DetailEditModal from '../payroll/DetailEditModal';
import RoleSalarySettings from '../payroll/RoleSalarySettings';
import {
  EnhancedPayrollCalculation,
  BulkAllowanceSettings,
  RoleSalaryConfig,
} from '../../types/payroll';
import { StaffAllowanceData } from '../../workers/payrollCalculator.worker';
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
  const [showExportConfirmModal, setShowExportConfirmModal] = useState(false);

  // 급여 유형 한글 변환 (의존성 없는 함수는 최상단에 배치)
  const getSalaryTypeLabel = useCallback((type: string) => {
    const labels: { [key: string]: string } = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타',
    };
    return labels[type] || type;
  }, []);

  // 통합 데이터 훅 사용
  const { state, loading } = useUnifiedData();
  const dataLoading = loading;

  // Web Worker 기반 정산 계산
  const {
    payrollData,
    summary,
    loading: calculationLoading,
    error: calculationError,
    calculatePayroll,
    // isOptimized, calculationTime는 현재 미사용
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
        data: { jobPostingExists: !!jobPosting, eventId },
      });
      return [];
    }

    const filteredWorkLogs = workLogsArray.filter((workLog) => workLog.eventId === postingId);

    // 상태 변환은 한 번에 수행
    return filteredWorkLogs.map((workLog) => ({
      ...workLog,
      // 상태 변환 통일 - UnifiedWorkLog 타입과 호환 (조건문 최적화)
      status:
        workLog.status === 'absent'
          ? ('cancelled' as const)
          : ((workLog.status || 'not_started') as
              | 'checked_in'
              | 'checked_out'
              | 'completed'
              | 'cancelled'
              | 'not_started'),
    }));
  }, [state.workLogs, eventId, jobPosting]);

  // 정산 기간 설정 (현재 월 기준)
  const { startDate, endDate } = useMemo((): { startDate: string; endDate: string } => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);

    return {
      startDate: toISODateString(start) || '',
      endDate: toISODateString(end) || '',
    };
  }, []);

  // 역할 목록 (UnifiedData에서 추출, jobPosting은 보조) - normalizeRole 적용
  const availableRoles = useMemo(() => {
    const roleSet = new Set<string>();

    // 1. WorkLogs에서 역할 추출 (정규화된 형태로 저장)
    workLogs.forEach((workLog) => {
      if (workLog.role) {
        const normalizedRole = normalizeRole(workLog.role);
        if (normalizedRole) {
          roleSet.add(normalizedRole);
        }
      }
    });

    // 2. jobPosting의 confirmedStaff에서 추가 (정규화된 형태로)
    jobPosting?.confirmedStaff?.forEach((staff) => {
      if (staff.role) {
        const normalizedRole = normalizeRole(staff.role);
        if (normalizedRole) {
          roleSet.add(normalizedRole);
        }
      }
    });

    // Set을 Array로 변환하면서 정렬까지 한 번에 수행
    const roles = roleSet.size > 0 ? Array.from(roleSet).sort() : [];

    return roles;
  }, [workLogs, jobPosting]);

  // 수당 및 급여 오버라이드 상태 관리
  const [staffAllowanceOverrides, setStaffAllowanceOverrides] = useState<
    Record<string, StaffAllowanceData>
  >({});
  const [roleSalaryOverrides, setRoleSalaryOverrides] = useState<
    Record<string, { salaryType: string; salaryAmount: number }>
  >({});

  // 확정된 스태프 가져오기 (jobPosting 또는 UnifiedData에서) - 메모이제이션 강화
  const confirmedStaff = useMemo(() => {
    // jobPosting이 있으면 우선 사용 (early return)
    if (jobPosting?.confirmedStaff && jobPosting.confirmedStaff.length > 0) {
      return jobPosting.confirmedStaff;
    }

    // 이미 필터링된 workLogs와 staff 데이터 사용
    const staffArray = Array.from(state.staff.values());
    const staffLookup = new Map(staffArray.map((staff) => [staff.id, staff]));

    // WorkLogs에서 확정된 스태프 추출 (이미 필터링된 workLogs 사용)
    const confirmedStaffMap = new Map();

    workLogs.forEach((workLog) => {
      const key = `${workLog.staffId}_${workLog.role}`;
      if (!confirmedStaffMap.has(key)) {
        const staff = staffLookup.get(workLog.staffId);
        confirmedStaffMap.set(key, {
          userId: workLog.staffId,
          staffId: workLog.staffId,
          name: workLog.staffName || staff?.name || 'Unknown',
          role: workLog.role || 'Staff',
          timeSlot: `${workLog.scheduledStartTime ? new Date(workLog.scheduledStartTime.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '09:00'}-${workLog.scheduledEndTime ? new Date(workLog.scheduledEndTime.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '18:00'}`,
          confirmedAt: workLog.createdAt || Timestamp.now(),
          status: 'confirmed' as const,
          phone: staff?.phone || '',
          note: '',
        });
      }
    });

    return Array.from(confirmedStaffMap.values());
  }, [jobPosting?.confirmedStaff, workLogs, state.staff]);

  // confirmedStaff 길이를 안정적인 변수로 메모이제이션 (useEffect 의존성 최적화)
  const confirmedStaffCount = useMemo(() => confirmedStaff?.length || 0, [confirmedStaff]);

  // 객체 참조 안정화를 위한 메모이제이션 (무한 루프 방지)
  const memoizedRoleSalaryOverrides = useMemo(
    () => roleSalaryOverrides || {},
    [roleSalaryOverrides]
  );

  const memoizedStaffAllowanceOverrides = useMemo(
    () => staffAllowanceOverrides || {},
    [staffAllowanceOverrides]
  );

  // 중복 계산 방지를 위한 키 메모이제이션 (무한 루프 방지)
  const calculationKey = useMemo(
    () =>
      `${workLogs.length}-${confirmedStaffCount}-${startDate}-${endDate}-${JSON.stringify(memoizedRoleSalaryOverrides)}-${JSON.stringify(memoizedStaffAllowanceOverrides)}`,
    [
      workLogs.length,
      confirmedStaffCount,
      startDate,
      endDate,
      memoizedRoleSalaryOverrides,
      memoizedStaffAllowanceOverrides,
    ]
  );

  // 정산 계산 실행 (메모이제이션으로 무한루프 방지)
  const memoizedCalculatePayroll = useCallback(() => {
    if (!confirmedStaff || confirmedStaff.length === 0 || workLogs.length === 0) {
      logger.warn('정산 계산 건너뛰기 - 필수 데이터 부족', {
        component: 'EnhancedPayrollTab',
        data: {
          hasConfirmedStaff: !!confirmedStaff,
          confirmedStaffLength: confirmedStaff?.length || 0,
          workLogsLength: workLogs.length,
        },
      });
      return;
    }

    calculatePayroll({
      workLogs,
      confirmedStaff: confirmedStaff || [],
      jobPosting: jobPosting || null,
      startDate: startDate,
      endDate: endDate,
      roleSalaryOverrides: memoizedRoleSalaryOverrides,
      staffAllowanceOverrides: memoizedStaffAllowanceOverrides,
    });
  }, [
    workLogs,
    confirmedStaff,
    jobPosting,
    startDate,
    endDate,
    memoizedRoleSalaryOverrides,
    memoizedStaffAllowanceOverrides,
    calculatePayroll,
  ]);

  useEffect(() => {
    if (!calculationLoading && workLogs.length > 0) {
      lastCalculationKey.current = calculationKey;
      hasCalculated.current = true;
      memoizedCalculatePayroll();
    }
  }, [
    calculationLoading,
    calculationKey,
    memoizedCalculatePayroll,
    confirmedStaffCount,
    workLogs.length,
  ]);

  // 통합된 로딩 및 에러 상태
  const isLoading = dataLoading || calculationLoading;
  const error = state.error.global || calculationError;

  // 실제 정산 데이터 사용 (메모이제이션으로 안정적인 참조 유지)
  const staffWorkData = useMemo(() => payrollData || [], [payrollData]);

  // 로컬 상태로 구현해야 할 기능들
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const toggleStaffSelection = useCallback((staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!staffWorkData) return;
    setSelectedStaffIds((prev) =>
      prev.length === staffWorkData.length ? [] : staffWorkData.map((s) => s.staffId)
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
        '세금',
        '총 지급액',
        '세후 급여',
      ];

      const rows = payrollData.map((data) => [
        data.staffName,
        data.role,
        `${data.totalDays}일`,
        `${data.totalHours}시간`,
        getSalaryTypeLabel(data.salaryType),
        data.basePay.toLocaleString('ko-KR'),
        data.allowanceTotal.toLocaleString('ko-KR'),
        data.tax !== undefined && data.tax > 0 ? data.tax.toLocaleString('ko-KR') : '-',
        data.totalAmount.toLocaleString('ko-KR'),
        data.afterTaxAmount !== undefined
          ? data.afterTaxAmount.toLocaleString('ko-KR')
          : data.totalAmount.toLocaleString('ko-KR'),
      ]);

      // CSV 필드를 큰따옴표로 감싸서 쉼표 문제 해결
      const escapeCSVField = (field: string): string => {
        // 필드에 쉼표, 큰따옴표, 줄바꿈이 있으면 큰따옴표로 감싸기
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          // 큰따옴표는 두 개로 이스케이프
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCSVField).join(','))
        .join('\n');

      // BOM 추가하여 한글 깨짐 방지
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fileName = `정산_${startDate}_${endDate}_${toISODateString(new Date()) || ''}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 다운로드 성공 후 모달 닫기
      setShowExportConfirmModal(false);

      logger.info('CSV 내보내기 성공', {
        component: 'EnhancedPayrollTab',
        data: { fileName, rowCount: payrollData.length },
      });
    } catch (error) {
      logger.error('CSV 내보내기 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'EnhancedPayrollTab',
      });
    }
  }, [payrollData, startDate, endDate, getSalaryTypeLabel]);

  // 대량 수당 적용 구현
  const applyBulkAllowances = useCallback(
    async (settings: BulkAllowanceSettings) => {
      if (!payrollData || payrollData.length === 0) {
        logger.warn('적용할 정산 데이터가 없습니다.', { component: 'EnhancedPayrollTab' });
        return;
      }

      if (!jobPosting?.id) {
        logger.warn('JobPosting ID가 없어 Firebase에 저장할 수 없습니다.', {
          component: 'EnhancedPayrollTab',
        });
        return;
      }

      try {
        // 적용 대상 결정 (전체 또는 선택된 스태프)
        const targetStaffIds =
          selectedStaffIds.length > 0 ? selectedStaffIds : payrollData.map((data) => data.staffId);

        // 수당 정보 업데이트
        const updates: Record<string, StaffAllowanceData> = {};

        // 기본 수당 객체
        const defaultAllowances: StaffAllowanceData = {
          meal: 0,
          transportation: 0,
          accommodation: 0,
          bonus: 0,
          other: 0,
        };

        targetStaffIds.forEach((staffId) => {
          // 해당 스태프의 근무일수 찾기
          const staffData = payrollData.find((data) => data.staffId === staffId);
          const workDays = staffData?.totalDays || 1;

          // 기존 수당과 새 설정 병합
          const existingAllowances = staffAllowanceOverrides[staffId] || defaultAllowances;

          // 일당으로 설정된 수당들의 총액 계산
          const mealTotal = settings.allowances.meal?.enabled
            ? settings.allowances.meal.amount * workDays
            : 0;
          const transportationTotal = settings.allowances.transportation?.enabled
            ? settings.allowances.transportation.amount * workDays
            : 0;
          const accommodationTotal = settings.allowances.accommodation?.enabled
            ? settings.allowances.accommodation.amount * workDays
            : 0;

          updates[staffId] = {
            ...existingAllowances,
            meal: mealTotal || existingAllowances.meal || 0,
            transportation: transportationTotal || existingAllowances.transportation || 0,
            accommodation: accommodationTotal || existingAllowances.accommodation || 0,
            bonus:
              (settings.allowances.bonus?.enabled ? settings.allowances.bonus.amount : 0) ??
              existingAllowances.bonus ??
              0,
            other:
              (settings.allowances.other?.enabled ? settings.allowances.other.amount : 0) ??
              existingAllowances.other ??
              0,

            // 일당 정보도 함께 저장 (DetailEditModal에서 사용)
            dailyRates: {
              meal: settings.allowances.meal?.enabled ? settings.allowances.meal.amount : undefined,
              transportation: settings.allowances.transportation?.enabled
                ? settings.allowances.transportation.amount
                : undefined,
              accommodation: settings.allowances.accommodation?.enabled
                ? settings.allowances.accommodation.amount
                : undefined,
            },
            workDays: workDays,
            isManualEdit: false,
          };
        });

        // Firebase에 저장하기 위한 benefits 업데이트
        const updatedBenefits = {
          ...jobPosting.benefits,
          // 일당 설정 저장
          mealAllowance: settings.allowances.meal?.enabled
            ? settings.allowances.meal.amount.toString()
            : jobPosting.benefits?.mealAllowance || '',
          transportation: settings.allowances.transportation?.enabled
            ? settings.allowances.transportation.amount.toString()
            : jobPosting.benefits?.transportation || '',
          accommodation: settings.allowances.accommodation?.enabled
            ? settings.allowances.accommodation.amount.toString()
            : jobPosting.benefits?.accommodation || '',
          isPerDay: true, // 일당 기반으로 설정
        };

        // JobPosting 업데이트 (Firebase에 저장)
        const postRef = doc(db, 'jobPostings', jobPosting.id);
        await updateDoc(postRef, {
          benefits: updatedBenefits,
          updatedAt: new Date(),
        });

        // 상태 업데이트
        setStaffAllowanceOverrides((prev) => ({ ...prev, ...updates }));
      } catch (error) {
        logger.error(
          '대량 수당 적용 중 오류 발생',
          error instanceof Error ? error : new Error(String(error)),
          {
            component: 'EnhancedPayrollTab',
          }
        );

        // 오류 발생 시에도 로컬 상태는 업데이트 (사용자 경험 개선)
        const targetStaffIds =
          selectedStaffIds.length > 0 ? selectedStaffIds : payrollData.map((data) => data.staffId);
        const updates: Record<string, StaffAllowanceData> = {};

        // 기본 수당 객체 (catch 블록용)
        const defaultAllowances: StaffAllowanceData = {
          meal: 0,
          transportation: 0,
          accommodation: 0,
          bonus: 0,
          other: 0,
        };

        targetStaffIds.forEach((staffId) => {
          const staffData = payrollData.find((data) => data.staffId === staffId);
          const workDays = staffData?.totalDays || 1;
          const existingAllowances = staffAllowanceOverrides[staffId] || defaultAllowances;

          const mealTotal = settings.allowances.meal?.enabled
            ? settings.allowances.meal.amount * workDays
            : 0;
          const transportationTotal = settings.allowances.transportation?.enabled
            ? settings.allowances.transportation.amount * workDays
            : 0;
          const accommodationTotal = settings.allowances.accommodation?.enabled
            ? settings.allowances.accommodation.amount * workDays
            : 0;

          updates[staffId] = {
            ...existingAllowances,
            meal: mealTotal || existingAllowances.meal || 0,
            transportation: transportationTotal || existingAllowances.transportation || 0,
            accommodation: accommodationTotal || existingAllowances.accommodation || 0,
            bonus:
              (settings.allowances.bonus?.enabled ? settings.allowances.bonus.amount : 0) ??
              existingAllowances.bonus ??
              0,
            other:
              (settings.allowances.other?.enabled ? settings.allowances.other.amount : 0) ??
              existingAllowances.other ??
              0,
            dailyRates: {
              meal: settings.allowances.meal?.enabled ? settings.allowances.meal.amount : undefined,
              transportation: settings.allowances.transportation?.enabled
                ? settings.allowances.transportation.amount
                : undefined,
              accommodation: settings.allowances.accommodation?.enabled
                ? settings.allowances.accommodation.amount
                : undefined,
            },
            workDays: workDays,
            isManualEdit: false,
          };
        });

        setStaffAllowanceOverrides((prev) => ({ ...prev, ...updates }));
      }
    },
    [payrollData, selectedStaffIds, staffAllowanceOverrides, jobPosting]
  );

  const updateStaffAllowances = useCallback((uniqueKey: string, allowances: StaffAllowanceData) => {
    // 개별 스태프 수당 업데이트
    setStaffAllowanceOverrides((prev) => ({
      ...prev,
      [uniqueKey]: allowances,
    }));
  }, []);

  const updateRoleSalarySettings = useCallback(
    async (roleSalaries: RoleSalaryConfig) => {
      if (!jobPosting?.id) {
        logger.warn('JobPosting ID가 없어 급여 설정을 저장할 수 없습니다.', {
          component: 'EnhancedPayrollTab',
        });
        return;
      }

      try {
        // 역할별 급여 설정 전체 업데이트
        const updates: Record<string, { salaryType: string; salaryAmount: number }> = {};

        Object.entries(roleSalaries).forEach(([role, config]) => {
          updates[role] = {
            salaryType: config.salaryType,
            salaryAmount: config.salaryAmount,
          };
        });

        // Firebase에 저장
        const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);
        await updateDoc(jobPostingRef, {
          roleSalaries: updates,
          useRoleSalary: true,
          updatedAt: Timestamp.now(),
        });

        // 로컬 상태 업데이트
        setRoleSalaryOverrides(updates);

        logger.info('급여 설정 저장 완료', {
          component: 'EnhancedPayrollTab',
          data: { jobPostingId: jobPosting.id, roleSalaries: updates },
        });
      } catch (error) {
        logger.error(
          '급여 설정 저장 실패',
          error instanceof Error ? error : new Error(String(error)),
          {
            component: 'EnhancedPayrollTab',
            data: { jobPostingId: jobPosting.id },
          }
        );
        throw error;
      }
    },
    [jobPosting]
  );

  // 세금 설정 업데이트
  const updateTaxSettings = useCallback(
    async (taxSettings: NonNullable<JobPosting['taxSettings']>) => {
      if (!jobPosting?.id) {
        logger.warn('JobPosting ID가 없어 세금 설정을 저장할 수 없습니다.', {
          component: 'EnhancedPayrollTab',
        });
        return;
      }

      try {
        const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);
        await updateDoc(jobPostingRef, {
          taxSettings,
          updatedAt: Timestamp.now(),
        });

        logger.info('세금 설정 저장 완료', {
          component: 'EnhancedPayrollTab',
          data: { jobPostingId: jobPosting.id, taxSettings },
        });
      } catch (error) {
        logger.error(
          '세금 설정 저장 실패',
          error instanceof Error ? error : new Error(String(error)),
          {
            component: 'EnhancedPayrollTab',
            data: { jobPostingId: jobPosting.id },
          }
        );
        throw error;
      }
    },
    [jobPosting]
  );

  // 수당 편집 모달 열기
  const openEditModal = useCallback((data: EnhancedPayrollCalculation) => {
    setEditingStaff(data);
    setIsEditModalOpen(true);
  }, []);

  // 수당 편집 모달 닫기
  const closeEditModal = useCallback(() => {
    setEditingStaff(null);
    setIsEditModalOpen(false);
  }, []);

  // 수당 저장
  const handleSaveAllowances = useCallback(
    (staff: EnhancedPayrollCalculation, allowances: EnhancedPayrollCalculation['allowances']) => {
      updateStaffAllowances(staff.staffId, allowances);
      closeEditModal();
    },
    [updateStaffAllowances, closeEditModal]
  );

  // 확정된 스태프가 없는 경우 (UnifiedData 기반 체크)
  if ((!confirmedStaff || confirmedStaff.length === 0) && workLogs.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            정산할 스태프 데이터가 없습니다
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            근무 기록이 있는 스태프가 없습니다. 스태프 관리 또는 내 스케줄에서 근무 데이터를
            확인해주세요.
          </p>
          <div className="text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">오류 발생</h3>
          <p className="text-red-600 dark:text-red-400">
            {error?.message || '알 수 없는 오류가 발생했습니다.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">정산 관리</h2>
        <button
          onClick={() => setShowExportConfirmModal(true)}
          className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
          disabled={staffWorkData.length === 0}
        >
          CSV 내보내기
        </button>
      </div>

      {/* 요약 정보 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex justify-around items-center mb-3">
          <div className="text-center">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">총 인원</h3>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {summary?.totalStaff || 0}명
            </p>
          </div>
          <div className="h-10 w-px bg-gray-200 dark:bg-gray-700"></div>
          <div className="text-center">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">총 지급액</h3>
            <p className="text-xl font-bold text-indigo-600">
              {(summary?.totalAmount || 0).toLocaleString('ko-KR')}원
            </p>
          </div>
          {payrollData.some(
            (data) => data.afterTaxAmount !== undefined && data.afterTaxAmount > 0
          ) && (
            <>
              <div className="h-10 w-px bg-gray-200 dark:bg-gray-700"></div>
              <div className="text-center">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  세후 급여 합계
                </h3>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {payrollData
                    .filter((data) => data.afterTaxAmount !== undefined && data.afterTaxAmount > 0)
                    .reduce((sum, data) => sum + (data.afterTaxAmount || 0), 0)
                    .toLocaleString('ko-KR')}
                  원
                </p>
              </div>
            </>
          )}
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
        jobPostingBenefits={jobPosting?.benefits}
      />

      {/* 세금 설정 */}
      <TaxSettingsPanel jobPosting={jobPosting || null} onUpdate={updateTaxSettings} />

      {/* 상세 내역 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">📋 상세 내역</h3>
          <div className="flex gap-2">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 transition-colors"
            >
              {selectedStaffIds.length === staffWorkData.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  선택
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  역할
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  근무일수
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  근무시간
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  급여유형
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  기본급
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  수당
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  총 지급액
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  세후 급여
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {staffWorkData.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
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
                      className={`${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''} hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors`}
                      onClick={(e) => {
                        // 체크박스 클릭은 제외
                        const target = e.target as HTMLInputElement;
                        if (!target.type || target.type !== 'checkbox') {
                          openEditModal(data);
                        }
                      }}
                    >
                      <td
                        className="px-3 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStaffSelection(data.staffId)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {data.staffName}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full">
                          {data.role}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {data.totalDays}일
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {data.totalHours.toFixed(1)}시간
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {getSalaryTypeLabel(data.salaryType)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {data.basePay.toLocaleString('ko-KR')}원
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {data.allowanceTotal.toLocaleString('ko-KR')}원
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {data.totalAmount.toLocaleString('ko-KR')}원
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                        {data.afterTaxAmount !== undefined && data.afterTaxAmount > 0
                          ? `${data.afterTaxAmount.toLocaleString('ko-KR')}원`
                          : '-'}
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
          workLogs={workLogs} // workLogs를 props로 전달
          onSave={handleSaveAllowances}
        />
      )}

      {/* CSV 내보내기 확인 모달 */}
      {showExportConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                CSV 내보내기 확인
              </h3>
            </div>

            {/* 내용 */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                정산 데이터를 CSV 파일로 내보내시겠습니까?
              </p>

              {/* CSV 필드 정보 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  포함될 정보:
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>• 이름, 역할, 근무일수, 근무시간</li>
                  <li>• 급여유형, 기본급, 수당</li>
                  <li>• 세금, 총 지급액, 세후 급여</li>
                </ul>
              </div>

              {/* 파일 정보 */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <span className="font-medium">파일명:</span> 정산_{startDate}_{endDate}_
                  {toISODateString(new Date()) || ''}.csv
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                  <span className="font-medium">스태프 수:</span> {payrollData?.length || 0}명
                </p>
              </div>
            </div>

            {/* 버튼 */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => setShowExportConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                취소
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 dark:bg-green-700 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
              >
                내보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedPayrollTab;
