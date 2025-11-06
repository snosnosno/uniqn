/**
 * ScheduleDetailModal Container Component
 *
 * Feature: 001-schedule-modal-split
 * Created: 2025-11-05
 * Purpose: 일정 상세 모달 컨테이너 - 탭 컴포넌트 통합 및 상태 관리
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getTodayString } from '../../../../utils/jobPosting/dateUtils';
import { calculateWorkHours } from '../../../../utils/workLogMapper';
import { calculateAllowances } from '../../../../utils/payrollCalculations';
import { JobPosting } from '../../../../types/jobPosting/jobPosting';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { logger } from '../../../../utils/logger';
import { getSnapshotOrFallback } from '../../../../utils/scheduleSnapshot';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UnifiedWorkLog } from '../../../../types/unified/workLog';
import ReportModal from '../../../../components/modals/ReportModal';
import ConfirmModal from '../../../../components/modals/ConfirmModal';

// Import tab components
import BasicInfoTab from './tabs/BasicInfoTab';
import WorkInfoTab from './tabs/WorkInfoTab';
import CalculationTab from './tabs/CalculationTab';

// Import types
import { ScheduleDetailModalProps, SalaryInfo, WorkHistoryItem } from './types';

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
    // schedule.eventId 변경 시에만 재실행 필요, 다른 속성은 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      name: '구인자'
    });
    setIsReportModalOpen(true);
  }, [schedule, jobPosting]);

  const handleReportModalClose = useCallback(() => {
    setIsReportModalOpen(false);
    setReportTarget(null);
  }, []);

  // WorkLog 조회 공통 함수
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

    // 3. WorkLog ID 패턴 매칭
    if (!targetWorkLog) {
      targetWorkLog = realTimeWorkLogs.find(log =>
        log.id.startsWith(schedule.id) &&
        log.date === schedule.date &&
        log.type === 'schedule'
      );
    }

    // 4. eventId + date로 찾기
    if (!targetWorkLog) {
      targetWorkLog = realTimeWorkLogs.find(log =>
        log.eventId === schedule.eventId &&
        log.date === schedule.date &&
        log.type === 'schedule' &&
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

    // WorkLog 우선순위
    const targetWorkLog = getTargetWorkLog();
    const effectiveRole = (targetWorkLog ? targetWorkLog.role : schedule.role) || 'staff';
    const effectiveStartTime = targetWorkLog?.scheduledStartTime || schedule.startTime;
    const effectiveEndTime = targetWorkLog?.scheduledEndTime || schedule.endTime;

    // UnifiedWorkLog 형태로 변환
    const workLogData = {
      id: targetWorkLog?.id || schedule.id,
      scheduledStartTime: effectiveStartTime,
      scheduledEndTime: effectiveEndTime,
      date: schedule.date,
      role: effectiveRole,
      eventId: schedule.eventId
    };

    const { calculateSingleWorkLogPayroll, calculateWorkHours } = await import('../../../../utils/payrollCalculations');

    // 근무시간 계산
    const totalHours = calculateWorkHours(workLogData as any);

    // 스냅샷 우선: jobPosting이 없으면 스냅샷으로 가상 JobPosting 생성
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

    // 급여 계산
    const totalPay = calculateSingleWorkLogPayroll(workLogData as any, effectiveRole || 'staff', effectiveJobPosting);

    // 급여 정보 추출
    const { getRoleSalaryInfo } = await import('../../../../utils/payrollCalculations');
    const { salaryType, salaryAmount } = getRoleSalaryInfo(
      effectiveRole || 'staff',
      effectiveJobPosting,
      undefined,
      schedule.snapshotData
    );

    // 수당 계산
    const allowances = calculateAllowances(
      effectiveJobPosting,
      1,
      schedule.snapshotData
    );

    // 세금 계산
    const totalAmount = totalPay;
    let tax = 0;
    let taxRate: number | undefined;
    let afterTaxAmount = totalAmount;

    const taxSettings = schedule.snapshotData?.taxSettings || jobPosting?.taxSettings;

    if (taxSettings?.enabled) {
      if (taxSettings.taxRate !== undefined && taxSettings.taxRate > 0) {
        taxRate = taxSettings.taxRate;
        tax = Math.round(totalAmount * (taxRate / 100));
      } else if (taxSettings.taxAmount !== undefined && taxSettings.taxAmount > 0) {
        tax = taxSettings.taxAmount;
      }

      afterTaxAmount = totalAmount - tax;
    }

    return {
      salaryType: salaryType as 'hourly' | 'daily' | 'monthly' | 'other',
      baseSalary: salaryAmount,
      totalHours,
      totalDays: 1,
      basePay: totalPay,
      allowances,
      ...(tax > 0 && { tax }),
      ...(taxRate !== undefined && { taxRate }),
      ...(tax > 0 && { afterTaxAmount })
    };
  }, [schedule, jobPosting, realTimeWorkLogs]);

  // 급여 정보 상태 관리
  const [salaryInfo, setSalaryInfo] = useState<SalaryInfo>({
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

  // 근무 내역 생성 (WorkHistoryItem[] 타입)
  const workHistory = useMemo<WorkHistoryItem[]>(() => {
    if (!schedule) return [];

    const targetWorkLog = getTargetWorkLog();

    // WorkLog가 없으면 빈 배열 반환
    if (!targetWorkLog) {
      return [];
    }

    const log = targetWorkLog;

    try {
      // 날짜 파싱
      let dateStr = '날짜 없음';

      if (log.date) {
        const dateValue = new Date(log.date);
        if (!isNaN(dateValue.getTime())) {
          dateStr = `${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
        }
      }

      // 근무 시간 계산
      let workHoursValue = 0;
      try {
        workHoursValue = calculateWorkHours(log as any);
      } catch (error) {
        logger.error('근무 시간 계산 오류:', error instanceof Error ? error : new Error(String(error)));
      }

      return [{
        label: dateStr,
        value: workHoursValue.toFixed(1),
        type: 'info'
      }];
    } catch (error) {
      logger.error('근무 내역 파싱 오류:', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }, [schedule, getTargetWorkLog]);

  if (!schedule) return null;

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
            <BasicInfoTab
              schedule={schedule}
              jobPosting={jobPosting}
              isReadOnly={true}
            />
          )}

          {activeTab === 'work' && (
            <WorkInfoTab
              schedule={schedule}
              workLogs={realTimeWorkLogs}
              onCheckOut={onCheckOut || (() => {})}
              isReadOnly={true}
            />
          )}

          {activeTab === 'calculation' && (
            <CalculationTab
              salaryInfo={salaryInfo}
              workHistory={workHistory}
            />
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
              className="flex-1 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors font-medium"
            >
              퇴근하기
            </button>
          )}

          {schedule.type === 'applied' && onCancel && (
            <button
              onClick={() => setIsCancelConfirmOpen(true)}
              className="flex-1 px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              지원 취소
            </button>
          )}

          {/* 신고 버튼 */}
          {getSnapshotOrFallback(schedule, jobPosting).createdBy() && (
            <button
              onClick={handleReport}
              className="px-4 py-2 bg-orange-500 dark:bg-orange-600 text-white rounded-lg hover:bg-orange-600 dark:hover:bg-orange-500 transition-colors font-medium flex items-center gap-2"
              title="구인자 신고하기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              신고
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-300 text-gray-700 dark:text-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-200 transition-colors font-medium"
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
