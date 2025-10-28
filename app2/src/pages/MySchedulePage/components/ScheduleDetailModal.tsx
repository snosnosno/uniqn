import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getTodayString } from '../../../utils/jobPosting/dateUtils';
import { parseTimeToString, calculateWorkHours } from '../../../utils/workLogMapper';
import { calculateAllowances, PayrollCalculationResult } from '../../../utils/payrollCalculations';
import {
  FaInfoCircle,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle
} from '../../../components/Icons/ReactIconsReplacement';
import { ScheduleEvent } from '../../../types/schedule';
import { JobPosting } from '../../../types/jobPosting/jobPosting';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logger } from '../../../utils/logger';
import { getSnapshotOrFallback } from '../../../utils/scheduleSnapshot';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UnifiedWorkLog } from '../../../types/unified/workLog';
import ReportModal from '../../../components/modals/ReportModal';
import ConfirmModal from '../../../components/modals/ConfirmModal';

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleEvent | null;
  onCheckOut?: (scheduleId: string) => void;
  onCancel?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
}

const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  isOpen: _isOpen,
  onClose,
  schedule,
  onCheckOut,
  onCancel,
  onDelete: _onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'work' | 'calculation'>('basic');
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [_loadingJobPosting, setLoadingJobPosting] = useState(false);
  const [realTimeWorkLogs, setRealTimeWorkLogs] = useState<UnifiedWorkLog[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // JobPosting 데이터 조회
  useEffect(() => {
    const fetchJobPosting = async () => {
      if (!schedule?.eventId) {
        setJobPosting(null);
        return;
      }

      // 🔍 디버깅: 스냅샷 데이터 확인
      logger.info('🔍 [DEBUG] Schedule 데이터 확인', {
        component: 'ScheduleDetailModal',
        data: {
          scheduleId: schedule.id,
          eventId: schedule.eventId,
          sourceCollection: schedule.sourceCollection,
          hasSnapshotData: !!schedule.snapshotData,
          snapshotLocation: schedule.snapshotData?.location,
          scheduleLocation: schedule.location,
          snapshotDataKeys: schedule.snapshotData ? Object.keys(schedule.snapshotData) : []
        }
      });

      setLoadingJobPosting(true);
      try {
        const jobPostingDoc = await getDoc(doc(db, 'jobPostings', schedule.eventId));
        if (jobPostingDoc.exists()) {
          const jobPostingData = {
            id: jobPostingDoc.id,
            ...jobPostingDoc.data()
          } as JobPosting;
          setJobPosting(jobPostingData);
        } else {
          setJobPosting(null);
          logger.warn('ScheduleDetailModal - JobPosting 문서 없음 (스냅샷 사용 필요)', {
            component: 'ScheduleDetailModal',
            data: {
              eventId: schedule.eventId,
              hasSnapshot: !!schedule.snapshotData
            }
          });
        }
      } catch (error) {
        logger.error('ScheduleDetailModal - JobPosting 조회 실패:', error instanceof Error ? error : new Error(String(error)), {
          component: 'ScheduleDetailModal',
          data: { eventId: schedule.eventId }
        });
        setJobPosting(null);
      } finally {
        setLoadingJobPosting(false);
      }
    };

    fetchJobPosting();
  }, [schedule?.eventId]);

  // WorkLog 데이터 구독
  useEffect(() => {
    if (!schedule?.eventId) {
      setRealTimeWorkLogs([]);
      return;
    }

    const workLogsQuery = query(
      collection(db, 'workLogs'),
      where('eventId', '==', schedule.eventId)
    );

    const unsubscribe = onSnapshot(
      workLogsQuery,
      (snapshot) => {
        const workLogsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UnifiedWorkLog[];

        setRealTimeWorkLogs(workLogsData);
      },
      (error) => {
        logger.error('ScheduleDetailModal - WorkLog 구독 오류:', error instanceof Error ? error : new Error(String(error)), {
          component: 'ScheduleDetailModal',
          data: { eventId: schedule.eventId }
        });
      }
    );

    return () => unsubscribe();
  }, [schedule?.eventId]);

  // 급여 유형 한글 라벨
  const getSalaryTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타'
    };
    return labels[type] || type;
  }, []);

  // 역할명 한글 라벨
  const getRoleLabel = useCallback((role: string) => {
    const labels: Record<string, string> = {
      dealer: '딜러',
      floor: '플로어',
      manager: '매니저',
      staff: '스태프'
    };
    return labels[role] || role;
  }, []);

  // 신고 핸들러 (스냅샷 우선 폴백)
  const handleReport = useCallback(() => {
    if (!schedule) return;

    const createdBy = getSnapshotOrFallback(schedule, jobPosting).createdBy();

    if (!createdBy) {
      logger.warn('신고 대상 정보가 없습니다', { component: 'ScheduleDetailModal' });
      return;
    }

    setReportTarget({
      id: createdBy,
      name: '구인자' // JobPosting에서 사용자 이름 정보가 없으므로 기본값 사용
    });
    setIsReportModalOpen(true);
  }, [schedule, jobPosting]);

  const handleReportModalClose = useCallback(() => {
    setIsReportModalOpen(false);
    setReportTarget(null);
  }, []);

  // WorkLog 조회 공통 함수 (getSalaryInfo보다 먼저 정의 필요)
  const getTargetWorkLog = useCallback(() => {
    if (!schedule) return null;

    let targetWorkLog = null;

    // 1. workLogId로 직접 찾기
    if (schedule.sourceCollection === 'workLogs' && schedule.workLogId) {
      targetWorkLog = realTimeWorkLogs.find(log => log.id === schedule.workLogId);
    }

    // 2. sourceId로 찾기
    if (!targetWorkLog && schedule.sourceCollection === 'workLogs' && schedule.sourceId) {
      targetWorkLog = realTimeWorkLogs.find(log => log.id === schedule.sourceId);
    }

    // 3. WorkLog ID 패턴 매칭 (schedule.id를 포함하는 WorkLog)
    // 예: schedule.id = "xxx_0" → WorkLog.id = "xxx_0_2025-10-21"
    if (!targetWorkLog) {
      targetWorkLog = realTimeWorkLogs.find(log =>
        log.id.startsWith(schedule.id) &&
        log.date === schedule.date &&
        log.type === 'schedule'
      );
    }

    // 4. eventId + date로 찾기 (role이 빈 문자열일 수 있음)
    if (!targetWorkLog) {
      targetWorkLog = realTimeWorkLogs.find(log =>
        log.eventId === schedule.eventId &&
        log.date === schedule.date &&
        log.type === 'schedule' &&
        // role이 둘 다 빈 문자열이거나, 같은 경우
        (log.role === schedule.role || (!log.role && !schedule.role))
      );
    }

    return targetWorkLog;
  }, [schedule, realTimeWorkLogs]);

  // 통합 급여 계산 유틸리티 사용
  const getSalaryInfo = useCallback(async () => {
    if (!schedule) return {
      salaryType: 'hourly' as const,
      baseSalary: 10000,
      totalHours: 0,
      totalDays: 1,
      basePay: 0,
      allowances: { meal: 0, transportation: 0, accommodation: 0, bonus: 0, other: 0 }
    };

    // 🔥 WorkLog 우선순위 명확화: WorkLog 데이터를 최우선으로 사용
    const targetWorkLog = getTargetWorkLog();

    // WorkLog가 있으면 WorkLog 데이터 사용, 없으면 Schedule 데이터 사용
    // role이 빈 문자열이면 'staff' 기본값 사용
    const effectiveRole = (targetWorkLog ? targetWorkLog.role : schedule.role) || 'staff';
    const effectiveStartTime = targetWorkLog?.scheduledStartTime || schedule.startTime;
    const effectiveEndTime = targetWorkLog?.scheduledEndTime || schedule.endTime;

    // UnifiedWorkLog 형태로 변환 (WorkLog 우선)
    const workLogData = {
      id: targetWorkLog?.id || schedule.id,
      scheduledStartTime: effectiveStartTime,
      scheduledEndTime: effectiveEndTime,
      date: schedule.date,
      role: effectiveRole,
      eventId: schedule.eventId
    };

    const { calculateSingleWorkLogPayroll, calculateWorkHours } = await import('../../../utils/payrollCalculations');

    // 근무시간 계산 (WorkLog 기준)
    const totalHours = calculateWorkHours(workLogData as any);

    // 🔥 스냅샷 우선: jobPosting이 없으면 스냅샷으로 가상 JobPosting 생성
    const effectiveJobPosting = jobPosting || (schedule.snapshotData ? {
      id: schedule.eventId,
      title: schedule.snapshotData.title || '근무',
      location: schedule.snapshotData.location,
      detailedAddress: schedule.snapshotData.detailedAddress,
      district: schedule.snapshotData.district,
      salaryType: schedule.snapshotData.salary.type,
      salaryAmount: String(schedule.snapshotData.salary.amount),
      useRoleSalary: schedule.snapshotData.salary.useRoleSalary,
      roleSalaries: schedule.snapshotData.salary.roleSalaries,
      benefits: {
        mealAllowance: schedule.snapshotData.allowances?.meal || 0,
        transportation: schedule.snapshotData.allowances?.transportation || 0,
        accommodation: schedule.snapshotData.allowances?.accommodation || 0
      },
      taxSettings: schedule.snapshotData.taxSettings,
      createdBy: schedule.snapshotData.createdBy
    } as any : null);

    // 급여 계산 (WorkLog 기준, 스냅샷 폴백)
    const totalPay = calculateSingleWorkLogPayroll(workLogData as any, effectiveRole || 'staff', effectiveJobPosting);

    // 급여 정보 추출 (WorkLog 역할 기준, 스냅샷 우선)
    const { getRoleSalaryInfo } = await import('../../../utils/payrollCalculations');
    const { salaryType, salaryAmount } = getRoleSalaryInfo(
      effectiveRole || 'staff',
      effectiveJobPosting, // 🔥 스냅샷 폴백이 적용된 effectiveJobPosting 사용
      undefined,
      schedule.snapshotData // 스냅샷 데이터 전달
    );

    // 수당 계산 추가 (스냅샷 우선)
    const allowances = calculateAllowances(
      effectiveJobPosting, // 🔥 스냅샷 폴백이 적용된 effectiveJobPosting 사용
      1, // 1일 기준
      schedule.snapshotData // 스냅샷 데이터 전달
    );

    // 세금 계산 (스냅샷 우선)
    // 🔥 totalPay는 이미 수당이 포함되어 있으므로 중복 추가 방지
    const totalAmount = totalPay;

    let tax = 0;
    let taxRate: number | undefined;
    let afterTaxAmount = totalAmount;

    // 스냅샷 또는 JobPosting에서 세금 설정 가져오기
    const taxSettings = schedule.snapshotData?.taxSettings || jobPosting?.taxSettings;

    if (taxSettings?.enabled) {
      if (taxSettings.taxRate !== undefined && taxSettings.taxRate > 0) {
        // 세율 기반 계산
        taxRate = taxSettings.taxRate;
        tax = Math.round(totalAmount * (taxRate / 100));
      } else if (taxSettings.taxAmount !== undefined && taxSettings.taxAmount > 0) {
        // 고정 세금
        tax = taxSettings.taxAmount;
      }

      afterTaxAmount = totalAmount - tax;
    }

    logger.info('🔍 [DEBUG] 급여 정보 계산 상세', {
      component: 'ScheduleDetailModal',
      data: {
        hasWorkLog: !!targetWorkLog,
        role: effectiveRole,
        salaryType,
        salaryAmount,
        totalHours,
        totalPay,
        totalAmount,
        hasJobPosting: !!jobPosting,
        hasEffectiveJobPosting: !!effectiveJobPosting,
        hasSnapshot: !!schedule.snapshotData,
        allowances,
        tax,
        taxRate,
        afterTaxAmount,
        calculationBreakdown: {
          basePay: totalPay,
          mealAllowance: allowances.meal || 0,
          transportationAllowance: allowances.transportation || 0,
          accommodationAllowance: allowances.accommodation || 0,
          totalBeforeTax: totalAmount,
          taxCalculation: `${totalAmount} × ${taxRate}% = ${tax}`,
          finalAmount: afterTaxAmount
        }
      }
    });

    return {
      salaryType: salaryType as 'hourly' | 'daily' | 'monthly' | 'other',
      baseSalary: salaryAmount,
      totalHours,
      totalDays: 1, // 일정은 하루
      basePay: totalPay, // 🔥 항상 최신 계산 값 사용
      allowances,
      ...(tax > 0 && { tax }),
      ...(taxRate !== undefined && { taxRate }),
      ...(tax > 0 && { afterTaxAmount })
    };
  }, [schedule, jobPosting, getTargetWorkLog]);

  // 급여 정보 상태 관리
  const [salaryInfo, setSalaryInfo] = useState<{
    salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
    baseSalary: number;
    totalHours: number;
    totalDays: number;
    basePay: number;
    allowances: PayrollCalculationResult['allowances'];
    tax?: number;
    taxRate?: number;
    afterTaxAmount?: number;
  }>({
    salaryType: 'hourly',
    baseSalary: 10000,
    totalHours: 0,
    totalDays: 1,
    basePay: 0,
    allowances: { meal: 0, transportation: 0, accommodation: 0, bonus: 0, other: 0 }
  });

  // 급여 정보 업데이트
  useEffect(() => {
    const updateSalaryInfo = async () => {
      const info = await getSalaryInfo();
      setSalaryInfo(info);
    };
    updateSalaryInfo();
  }, [getSalaryInfo]);

  // 근무 내역 생성 - 공통 함수 사용
  const workHistory = useMemo(() => {
    if (!schedule) return [];
    
    // 1. 공통 함수로 WorkLog 찾기
    let targetWorkLog = getTargetWorkLog();
    
    // 여전히 찾지 못한 경우 기본 schedule 데이터 사용
    if (!targetWorkLog) {
      targetWorkLog = {
        id: schedule.id,
        staffId: schedule.sourceCollection === 'applications' ? '' : schedule.sourceId || '',
        staffName: '사용자',
        date: schedule.date,
        role: schedule.role,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        status: 'scheduled' as any,
        type: 'schedule',
        eventId: schedule.eventId
      };
    }
    
    // 2. WorkLog 존재 확인
    if (!targetWorkLog) {
      return [];
    }
    
    // 3. UI 표시용 형태로 변환
    const log = targetWorkLog;
    
    try {
      // 날짜 파싱
      let dateStr = '날짜 없음';
      let dayName = '';
      
      if (log.date) {
        const dateValue = new Date(log.date);
        if (!isNaN(dateValue.getTime())) {
          const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
          dayName = dayNames[dateValue.getDay()] || '';
          dateStr = `${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
        }
      }
      
      // 시간 파싱 - DetailEditModal과 동일한 parseTime 로직
      const parseTime = (timeValue: any): string => {
        const result = parseTimeToString(timeValue);
        return result || '미정';
      };

      // DetailEditModal과 동일: scheduledTime 우선 사용
      let startTime = '미정';
      let endTime = '미정';
      
      if (log.scheduledStartTime) {
        startTime = parseTime(log.scheduledStartTime);
      }
      if (log.scheduledEndTime) {
        endTime = parseTime(log.scheduledEndTime);
      }
      
      // 근무 시간 계산 - DetailEditModal과 동일한 calculateWorkHours 유틸 함수 사용
      let workHours = 0;
      try {
        workHours = calculateWorkHours(log as any);
      } catch (error) {
        logger.error('근무 시간 계산 오류:', error instanceof Error ? error : new Error(String(error)));
      }
      
      return [{
        date: dateStr,
        dayName,
        role: log.role || '',
        startTime,
        endTime,
        workHours: workHours.toFixed(1),
        status: log.status || 'not_started'
      }];
    } catch (error) {
      logger.error('근무 내역 파싱 오류:', error instanceof Error ? error : new Error(String(error)));
      return [{
        date: '오류',
        dayName: '',
        role: log.role || '',
        startTime: '미정',
        endTime: '미정',
        workHours: '0.0',
        status: 'not_started'
      }];
    }
  }, [schedule, getTargetWorkLog]);
  
  if (!schedule) return null;

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // formatTime은 이미 utils/dateUtils에서 import됨


  // 상태별 아이콘과 색상
  const getTypeDisplay = () => {
    switch (schedule.type) {
      case 'applied':
        return {
          icon: <FaHourglassHalf className="w-5 h-5 text-yellow-500" />,
          text: '지원중',
          color: 'text-yellow-600 bg-yellow-100'
        };
      case 'confirmed':
        return {
          icon: <FaCheckCircle className="w-5 h-5 text-green-500" />,
          text: '확정',
          color: 'text-green-600 bg-green-100'
        };
      case 'completed':
        return {
          icon: <FaCheckCircle className="w-5 h-5 text-blue-500" />,
          text: '완료',
          color: 'text-blue-600 bg-blue-100'
        };
      case 'cancelled':
        return {
          icon: <FaTimesCircle className="w-5 h-5 text-red-500" />,
          text: '취소',
          color: 'text-red-600 bg-red-100'
        };
      default:
        return {
          icon: null,
          text: '',
          color: ''
        };
    }
  };

  const typeDisplay = getTypeDisplay();
  const isToday = schedule.date === getTodayString();
  const canCheckOut = isToday && schedule.type === 'confirmed' && schedule.status === 'checked_in';

  // 탭 정의
  const tabs = [
    { id: 'basic' as const, name: '정보', icon: '👤' },
    { id: 'work' as const, name: '근무', icon: '🕐' },
    { id: 'calculation' as const, name: '급여', icon: '💰' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-11/12 md:w-4/5 lg:w-3/5 shadow-lg rounded-md bg-white dark:bg-gray-800">
        {/* 헤더 */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">
                {schedule?.eventName?.charAt(0) || 'S'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                일정 상세
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{schedule?.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex space-x-1 mt-4 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
        {/* 탭 콘텐츠 */}
        <div className="mt-6 min-h-96">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-3">기본 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">공고:</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {schedule.snapshotData?.title || jobPosting?.title || schedule.eventName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">역할:</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {(() => {
                        const targetWorkLog = getTargetWorkLog();
                        // 🔥 WorkLog 우선: WorkLog가 있으면 WorkLog 역할, 없으면 Schedule 역할
                        const effectiveRole = targetWorkLog ? targetWorkLog.role : (schedule.role || '미정');
                        return getRoleLabel(effectiveRole || '미정');
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">날짜:</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(schedule.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">장소:</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {getSnapshotOrFallback(schedule, jobPosting).location()}
                    </span>
                  </div>
                  {(() => {
                    const detailedAddress = getSnapshotOrFallback(schedule, jobPosting).detailedAddress();
                    return detailedAddress && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">상세주소:</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {detailedAddress}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">근무시간:</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {(() => {
                        const targetWorkLog = getTargetWorkLog();

                        // 🔥 WorkLog 우선: WorkLog 시간이 있으면 사용, 없으면 Schedule 시간 사용
                        const effectiveStartTime = targetWorkLog?.scheduledStartTime || schedule.startTime;
                        const effectiveEndTime = targetWorkLog?.scheduledEndTime || schedule.endTime;

                        if (effectiveStartTime && effectiveEndTime) {
                          const startTime = parseTimeToString(effectiveStartTime) || '미정';
                          const endTime = parseTimeToString(effectiveEndTime) || '미정';
                          return `${startTime} - ${endTime}`;
                        }

                        return '미정';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">상태:</span>
                    <span className={`text-sm px-2 py-1 rounded-full ${typeDisplay.color}`}>
                      {typeDisplay.text}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">급여 정보</h4>
                <div className="space-y-2">
                  {/* 급여 설정 소스 표시 (스냅샷 우선) */}
                  {(() => {
                    const targetWorkLog = getTargetWorkLog();
                    // 🔥 WorkLog 우선: WorkLog가 있으면 WorkLog 역할, 없으면 Schedule 역할
                    const effectiveRole = targetWorkLog ? targetWorkLog.role : (schedule.role || 'staff');

                    // 스냅샷 또는 JobPosting에서 급여 설정 확인
                    const snapshotSalary = schedule.snapshotData?.salary;
                    const useRoleSalary = snapshotSalary?.useRoleSalary ?? jobPosting?.useRoleSalary;
                    const roleSalaries = snapshotSalary?.roleSalaries || jobPosting?.roleSalaries;
                    const salaryType = snapshotSalary?.type || jobPosting?.salaryType;

                    if (useRoleSalary && effectiveRole && roleSalaries?.[effectiveRole]) {
                      return (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">설정:</span>
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">역할별 급여</span>
                        </div>
                      );
                    } else if (salaryType) {
                      return (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">설정:</span>
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">공고 기본급여</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">설정:</span>
                          <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">시스템 기본값</span>
                        </div>
                      );
                    }
                  })()}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">급여 유형:</span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{getSalaryTypeLabel(salaryInfo.salaryType)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {salaryInfo.salaryType === 'hourly' ? '시급:' : 
                       salaryInfo.salaryType === 'daily' ? '일급:' : 
                       salaryInfo.salaryType === 'monthly' ? '월급:' : '급여:'}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {salaryInfo.baseSalary.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">예상 기본급:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {salaryInfo.basePay.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  {salaryInfo.tax !== undefined && salaryInfo.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">세금:</span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {salaryInfo.taxRate !== undefined && salaryInfo.taxRate > 0
                          ? `${salaryInfo.taxRate}%`
                          : '고정 세금'}
                      </span>
                    </div>
                  )}
                  {/* 🔥 정산 금액은 스냅샷 사용 시 표시하지 않음 (오래된 캐시 값일 수 있음) */}
                  {!schedule.snapshotData && schedule.payrollAmount && schedule.payrollAmount !== salaryInfo.basePay && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">정산 금액:</span>
                      <span className="text-sm font-medium text-indigo-600">
                        {schedule.payrollAmount.toLocaleString('ko-KR')}원
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">근무 요약</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{salaryInfo.totalDays}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">근무일수</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{salaryInfo.totalHours.toFixed(1)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">근무시간</div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-indigo-600">
                    {salaryInfo.basePay.toLocaleString('ko-KR')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">총 지급액</div>
                </div>
                {salaryInfo.afterTaxAmount !== undefined && salaryInfo.afterTaxAmount > 0 ? (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-600">
                      {salaryInfo.afterTaxAmount.toLocaleString('ko-KR')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">세후 급여</div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {(schedule.payrollAmount || (salaryInfo.totalHours * salaryInfo.baseSalary)).toLocaleString('ko-KR')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">세후 급여</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* 메모 */}
            {schedule.notes && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">메모</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">{schedule.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* 근무 탭 */}
        {activeTab === 'work' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">📅 근무 내역</h4>
            {workHistory.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          날짜
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          역할
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          시작시간
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          종료시간
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          근무시간
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          상태
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {workHistory.map((history, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            <div className="flex items-center gap-2">
                              <span>{history.date}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">({history.dayName})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              history.role === 'floor' ? 'bg-purple-100 text-purple-800' :
                              history.role === 'dealer' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                              history.role === 'manager' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                            }`}>
                              {getRoleLabel(history.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {history.startTime}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {history.endTime}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                            {history.workHours}시간
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              history.status === 'checked_out' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                              history.status === 'checked_in' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                              history.status === 'not_started' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                            }`}>
                              {history.status === 'checked_out' ? '퇴근' :
                               history.status === 'checked_in' ? '출근' :
                               history.status === 'not_started' ? '예정' :
                               history.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* 총 근무시간 합계 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">총 근무시간</span>
                    <span className="text-lg font-bold text-blue-600">
                      {workHistory.reduce((sum, h) => sum + parseFloat(h.workHours), 0).toFixed(1)}시간
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    총 {workHistory.length}일 근무
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">근무 내역이 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* 급여계산 탭 */}
        {activeTab === 'calculation' && (
          <div className="space-y-6">
            {/* 기본급 계산 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">💰 기본급 계산</h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">
                      {getSalaryTypeLabel(salaryInfo.salaryType)} × {salaryInfo.salaryType === 'hourly' ? `${salaryInfo.totalHours.toFixed(1)}시간` : `${salaryInfo.totalDays}일`}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {salaryInfo.baseSalary.toLocaleString('ko-KR')}원 × {salaryInfo.salaryType === 'hourly' ? salaryInfo.totalHours.toFixed(1) : salaryInfo.totalDays}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">기본급 합계</span>
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {(salaryInfo.totalHours * salaryInfo.baseSalary).toLocaleString('ko-KR')}원
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 수당 정보 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">🎁 수당 설정</h4>

              {/* 일당 계산 과정 표시 */}
              {salaryInfo.allowances?.dailyRates && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">일당 기반 계산</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{salaryInfo.allowances.workDays || 1}일 근무</span>
                  </div>
                  {salaryInfo.allowances.dailyRates.meal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">식비: {salaryInfo.allowances.dailyRates.meal.toLocaleString('ko-KR')}원 × {salaryInfo.allowances.workDays || 1}일</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">= {(salaryInfo.allowances.meal || 0).toLocaleString('ko-KR')}원</span>
                    </div>
                  )}
                  {salaryInfo.allowances.dailyRates.transportation && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">교통비: {salaryInfo.allowances.dailyRates.transportation.toLocaleString('ko-KR')}원 × {salaryInfo.allowances.workDays || 1}일</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">= {(salaryInfo.allowances.transportation || 0).toLocaleString('ko-KR')}원</span>
                    </div>
                  )}
                  {salaryInfo.allowances.dailyRates.accommodation && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">숙소비: {salaryInfo.allowances.dailyRates.accommodation.toLocaleString('ko-KR')}원 × {salaryInfo.allowances.workDays || 1}일</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">= {(salaryInfo.allowances.accommodation || 0).toLocaleString('ko-KR')}원</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 총 계산 */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">기본급</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {(salaryInfo.totalHours * salaryInfo.baseSalary).toLocaleString('ko-KR')}원
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">수당 합계</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {(() => {
                      const totalAllowances =
                        (salaryInfo.allowances?.meal || 0) +
                        (salaryInfo.allowances?.transportation || 0) +
                        (salaryInfo.allowances?.accommodation || 0) +
                        (salaryInfo.allowances?.bonus || 0) +
                        (salaryInfo.allowances?.other || 0);
                      return totalAllowances.toLocaleString('ko-KR') + '원';
                    })()}
                  </span>
                </div>
                {salaryInfo.tax !== undefined && salaryInfo.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">세금</span>
                    <span className="text-red-600">
                      -{salaryInfo.tax.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                )}
                <div className="border-t border-indigo-200 pt-2 flex justify-between">
                  <span className="text-base font-medium text-gray-800 dark:text-gray-200">총 지급액</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {(() => {
                      const basePay = salaryInfo.totalHours * salaryInfo.baseSalary;
                      const totalAllowances =
                        (salaryInfo.allowances?.meal || 0) +
                        (salaryInfo.allowances?.transportation || 0) +
                        (salaryInfo.allowances?.accommodation || 0) +
                        (salaryInfo.allowances?.bonus || 0) +
                        (salaryInfo.allowances?.other || 0);
                      const totalPay = basePay + totalAllowances;
                      // 🔥 항상 최신 계산 값 사용 (schedule.payrollAmount는 오래된 값일 수 있음)
                      return totalPay.toLocaleString('ko-KR') + '원';
                    })()}
                  </span>
                </div>
                {salaryInfo.afterTaxAmount !== undefined && salaryInfo.afterTaxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-base font-medium text-green-700">세후 급여</span>
                    <span className="text-lg font-bold text-green-600">
                      {salaryInfo.afterTaxAmount.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 계산 안내 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FaInfoCircle className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-700">급여 계산 안내</p>
              </div>
              <p className="text-sm text-blue-600">
                예정 근무 시간을 기준으로 자동 계산된 예상 급여입니다.
                실제 지급 금액은 관리자 확인 후 결정됩니다.
              </p>
            </div>
          </div>
        )}
        </div>

        {/* 액션 버튼 */}
        <div className="mt-6 flex gap-3">
          {canCheckOut && onCheckOut && (
            <button
              onClick={() => {
                onCheckOut(schedule.id);
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              퇴근하기
            </button>
          )}
          
          {schedule.type === 'applied' && onCancel && (
            <button
              onClick={() => setIsCancelConfirmOpen(true)}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              지원 취소
            </button>
          )}

          {/* 신고 버튼 (스냅샷 우선 폴백) */}
          {getSnapshotOrFallback(schedule, jobPosting).createdBy() && (
            <button
              onClick={handleReport}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
              title="구인자 신고하기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              신고
            </button>
          )}

          {/* 삭제 버튼 - 추후 업데이트 예정 */}
          {/* {canDelete && (
            <button
              onClick={() => {
                onDelete(schedule.id);
                onClose();
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-2"
              title="일정 삭제"
            >
              <FaTrash className="w-4 h-4" />
              삭제
            </button>
          )} */}
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            닫기
          </button>
        </div>

        {/* Report Modal */}
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={handleReportModalClose}
          targetUser={reportTarget || { id: '', name: '구인자' }}
          event={{
            id: schedule?.eventId || '',
            title: jobPosting?.title || schedule?.eventName || '',
            date: schedule?.date || getTodayString()
          }}
          reporterType="employee"
        />

        {/* Cancel Confirmation Modal */}
        <ConfirmModal
          isOpen={isCancelConfirmOpen}
          onClose={() => !isCancelling && setIsCancelConfirmOpen(false)}
          onConfirm={async () => {
            if (schedule && onCancel) {
              setIsCancelling(true);
              try {
                await onCancel(schedule.id);
                onClose();
              } finally {
                setIsCancelling(false);
                setIsCancelConfirmOpen(false);
              }
            }
          }}
          title="지원 취소"
          message="지원을 취소하시겠습니까?"
          confirmText="취소하기"
          cancelText="돌아가기"
          isDangerous={true}
          isLoading={isCancelling}
        />
      </div>
    </div>
  );
};

export default ScheduleDetailModal;