import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnifiedData } from '../useUnifiedData';
import { logger } from '../../utils/logger';
import { handleError } from '../../utils/errorHandler';
import { ScheduleEvent, ScheduleStats } from '../../types/schedule';
import type { Application, WorkLog } from '../../types/unifiedData';
import type { JobPosting } from '../../types/jobPosting';
import type { UnifiedWorkLog } from '../../types/unified/workLog';

// Local imports
import { UseScheduleDataReturn } from './types';
import { processApplicationData, processWorkLogData } from './dataProcessors';
import { filterSchedules, createDefaultFilters } from './filterUtils';

/**
 * 스케줄 데이터를 관리하는 커스텀 훅
 * Zustand Store 기반 useUnifiedData를 활용하여 중복 구독 제거
 */
const useScheduleData = (): UseScheduleDataReturn => {
  const { currentUser } = useAuth();
  const {
    staff: _staff,
    workLogs,
    applications,
    jobPostings,
    loading: _contextLoading,
    error: _contextError,
  } = useUnifiedData();
  const [filters, setFilters] = useState(createDefaultFilters());
  const [_lastRefresh, _setLastRefresh] = useState(Date.now());

  // 스케줄 데이터 상태
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // UnifiedDataContext 데이터를 스케줄 이벤트로 변환
  useEffect(() => {
    const loadSchedules = async () => {
      if (!currentUser) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      // 🔥 초기 로딩 상태 체크: Zustand Store가 로딩 중이면 대기
      if (_contextLoading) {
        setLoading(true);
        return;
      }

      setLoading(true);

      try {
        const mergedEvents: ScheduleEvent[] = [];
        const processedKeys = new Set<string>();

        // 1. WorkLogs 처리 (우선순위 높음) - 병렬 처리
        const userWorkLogs = Array.from(workLogs.values()).filter((log): log is WorkLog => {
          const workLog = log as WorkLog;
          // staffId가 정확히 일치하거나 userId_숫자 패턴으로 시작하는 경우
          return (
            workLog.staffId === currentUser.uid ||
            workLog.staffId?.startsWith(currentUser.uid + '_')
          );
        });

        // WorkLog 비동기 처리를 병렬로 실행
        const workLogPromises = userWorkLogs.map((workLog) =>
          processWorkLogData(workLog.id || '', workLog)
        );
        const workLogEvents = await Promise.all(workLogPromises);

        // WorkLog 이벤트 추가
        workLogEvents.forEach((event) => {
          mergedEvents.push(event);

          // 중복 방지 키 생성
          if (event.eventId && event.date) {
            const timeKey =
              event.startTime && 'seconds' in event.startTime
                ? new Date(event.startTime.seconds * 1000).toTimeString().slice(0, 5)
                : 'notime';
            const key = `${event.eventId}_${event.date}_${timeKey}`;
            const basicKey = `${event.eventId}_${event.date}`;
            processedKeys.add(key);
            processedKeys.add(basicKey);
          }
        });

        // 2. Applications 처리 (중복 제외) - 병렬 처리
        const userApplications = Array.from(applications.values()).filter(
          (app): app is Application => {
            const application = app as Application;
            // applicantId가 정확히 일치하거나 userId_숫자 패턴으로 시작하는 경우
            return (
              application.applicantId === currentUser.uid ||
              application.applicantId?.startsWith(currentUser.uid + '_')
            );
          }
        );

        // Application 비동기 처리를 병렬로 실행
        const applicationPromises = userApplications.map((application) =>
          processApplicationData(application.id || '', application)
        );
        const applicationEventArrays = await Promise.all(applicationPromises);

        // Application 이벤트 추가 (중복 체크)
        applicationEventArrays.flat().forEach((event) => {
          if (event.eventId && event.date) {
            const timeKey =
              event.startTime && 'seconds' in event.startTime
                ? new Date(event.startTime.seconds * 1000).toTimeString().slice(0, 5)
                : 'notime';
            const preciseKey = `${event.eventId}_${event.date}_${timeKey}`;
            const basicKey = `${event.eventId}_${event.date}`;

            // 중복 체크
            if (!processedKeys.has(preciseKey) && !processedKeys.has(basicKey)) {
              mergedEvents.push(event);
              processedKeys.add(preciseKey);
              processedKeys.add(basicKey);
            }
          } else {
            // eventId나 date가 없는 경우 그냥 추가
            mergedEvents.push(event);
          }
        });

        setSchedules(mergedEvents);
        setLoading(false);
        setError(null);

        logger.info('스케줄 데이터 로드 완료', {
          component: 'useScheduleData',
          userId: currentUser.uid,
          data: {
            totalEvents: mergedEvents.length,
            workLogEvents: workLogEvents.length,
            applicationEvents: applicationEventArrays.flat().length,
          },
        });
      } catch (err) {
        const errorMessage = handleError(err, {
          component: 'useScheduleData',
          action: 'loadSchedules',
          userId: currentUser?.uid,
          fallbackMessage: '스케줄 데이터를 불러오는 중 오류가 발생했습니다.',
        });
        setError(new Error(errorMessage));
        setLoading(false);
      }
    };

    // 🔥 개선된 로딩 로직: Zustand Store 로딩 완료 후 처리
    if (currentUser && !_contextLoading) {
      loadSchedules();
    } else if (!currentUser) {
      // 로그인하지 않은 경우
      setSchedules([]);
      setLoading(false);
    }

    // 기본 반환 (cleanup 불필요)
    return undefined;
  }, [currentUser, applications, workLogs, _contextLoading]);

  // 필터링된 스케줄
  const filteredSchedules = useMemo(() => {
    return filterSchedules(schedules, filters);
  }, [schedules, filters]);

  // Map 생성 (O(1) 조회를 위해)
  const workLogsMap = useMemo(() => new Map(workLogs.map((wl) => [wl.id, wl])), [workLogs]);
  const jobPostingsMap = useMemo(
    () => new Map(jobPostings.map((jp) => [jp.id, jp])),
    [jobPostings]
  );

  // 통계 계산 - 완료된 일정만 시간과 수입 계산에 포함
  const stats = useMemo((): ScheduleStats => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const completedEvents = filteredSchedules.filter(
      (e) => e.type === 'completed' || (e.status === 'checked_out' && e.actualEndTime)
    );

    const upcomingEvents = filteredSchedules.filter((e) => new Date(e.date) > now);

    // 🔥 이번달 수입 계산을 위한 월별 필터링 헬퍼 함수
    const isEventInMonth = (event: ScheduleEvent, month: number, year: number): boolean => {
      // ✅ YYYY-MM-DD 문자열을 안전하게 파싱 (타임존 문제 방지)
      const dateParts = event.date.split('-');
      if (dateParts.length < 2) return false;

      const eventYear = parseInt(dateParts[0] || '0', 10);
      const eventMonth = parseInt(dateParts[1] || '0', 10) - 1; // 0-based month

      const result = eventMonth === month && eventYear === year;

      logger.info('🔍 월별 필터링 체크', {
        component: 'useScheduleData',
        data: {
          eventId: event.eventId,
          eventName: event.eventName,
          date: event.date,
          eventMonth: eventMonth,
          eventYear: eventYear,
          targetMonth: month,
          targetYear: year,
          isInMonth: result,
        },
      });

      return result;
    };

    // 총 근무 시간 계산 (완료된 일정만, 예정 시간 기준)
    let totalHoursWorked = 0;
    completedEvents.forEach((event) => {
      // 예정 시간 기준으로 계산 (startTime, endTime)
      if (event.startTime && event.endTime) {
        const startDate =
          event.startTime && 'toDate' in event.startTime ? event.startTime.toDate() : null;
        const endDate = event.endTime && 'toDate' in event.endTime ? event.endTime.toDate() : null;

        if (startDate && endDate) {
          let hoursWorked = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

          // 자정을 넘는 근무 처리: 음수인 경우 (Timestamp 날짜 조정 실패 시)
          if (hoursWorked < 0) {
            // 24시간을 더해서 다음날 종료로 계산
            hoursWorked += 24;
          }

          totalHoursWorked += Math.max(0, hoursWorked);

          // 디버깅: 계산된 시간이 24시간을 초과하는 경우 로그
          if (hoursWorked > 24) {
            logger.warn('비정상적인 근무시간 감지', {
              component: 'useScheduleData',
              data: {
                eventId: event.id,
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                hoursWorked: hoursWorked,
              },
            });
          }
        }
      }
    });

    // 🔥 이번달 수입 계산 (완료된 일정만) - 모달과 100% 동일한 로직 사용
    const thisMonthEarnings = completedEvents.reduce((sum, event) => {
      // 이번달 근무만 포함
      const isInMonth = isEventInMonth(event, thisMonth, thisYear);

      if (!isInMonth) {
        return sum;
      }

      // WorkLog 찾기 (workLogId로 직접 찾기)
      const targetWorkLog = event.workLogId ? workLogsMap.get(event.workLogId) : null;

      // JobPosting 찾기
      const jobPosting = jobPostingsMap.get(event.eventId);

      logger.info('🔍 급여 데이터 확인', {
        component: 'useScheduleData',
        data: {
          eventId: event.eventId,
          hasJobPosting: !!jobPosting,
          jobPostingSalaryAmount: jobPosting?.salaryAmount,
          jobPostingRoleSalaries: jobPosting?.roleSalaries,
          jobPostingRoleSalariesKeys: jobPosting?.roleSalaries
            ? Object.keys(jobPosting.roleSalaries)
            : [],
          hasSnapshotData: !!event.snapshotData,
          snapshotSalary: event.snapshotData?.salary,
        },
      });

      // 모달과 동일한 로직: JobPosting이 없거나 급여 정보가 없으면 스냅샷 사용
      const hasJobPostingSalary =
        jobPosting &&
        ((jobPosting.salaryAmount && jobPosting.salaryAmount !== '0') ||
          (jobPosting.roleSalaries && Object.keys(jobPosting.roleSalaries).length > 0));
      const effectiveJobPosting = hasJobPostingSalary
        ? jobPosting
        : event.snapshotData
          ? ({
              id: event.eventId,
              title: event.snapshotData.title || '근무',
              location: event.snapshotData.location,
              detailedAddress: event.snapshotData.detailedAddress,
              district: event.snapshotData.district,
              salaryType: event.snapshotData.salary.type,
              salaryAmount: String(event.snapshotData.salary.amount),
              useRoleSalary: event.snapshotData.salary.useRoleSalary,
              roleSalaries: event.snapshotData.salary.roleSalaries,
              benefits: {
                mealAllowance: event.snapshotData.allowances?.meal || 0,
                transportation: event.snapshotData.allowances?.transportation || 0,
                accommodation: event.snapshotData.allowances?.accommodation || 0,
              },
              taxSettings: event.snapshotData.taxSettings,
              createdBy: event.snapshotData.createdBy,
            } as unknown as JobPosting)
          : null;

      logger.info('✅ effectiveJobPosting 결정', {
        component: 'useScheduleData',
        data: {
          eventId: event.eventId,
          usedJobPosting: hasJobPostingSalary,
          usedSnapshot: !hasJobPostingSalary && !!event.snapshotData,
          effectiveSalaryAmount: effectiveJobPosting?.salaryAmount,
          effectiveRoleSalaries: effectiveJobPosting?.roleSalaries,
          effectiveRoleSalariesKeys: effectiveJobPosting?.roleSalaries
            ? Object.keys(effectiveJobPosting.roleSalaries)
            : [],
        },
      });

      // 역할 결정
      const effectiveRole = (targetWorkLog ? targetWorkLog.role : event.role) || 'staff';

      // 근무 시간 계산
      const effectiveStartTime = targetWorkLog?.scheduledStartTime || event.startTime;
      const effectiveEndTime = targetWorkLog?.scheduledEndTime || event.endTime;

      const workLogData = {
        id: targetWorkLog?.id || event.id,
        scheduledStartTime: effectiveStartTime,
        scheduledEndTime: effectiveEndTime,
        date: event.date,
        role: effectiveRole,
        eventId: event.eventId,
      };

      const {
        calculateSingleWorkLogPayroll,
        calculateWorkHours,
      } = require('../../utils/payrollCalculations');
      const totalHours = calculateWorkHours(workLogData as unknown as UnifiedWorkLog);

      // 급여 계산 (모달과 동일)
      const totalPay = calculateSingleWorkLogPayroll(
        workLogData as unknown as UnifiedWorkLog,
        effectiveRole,
        effectiveJobPosting
      );

      // 세금 계산
      const taxSettings = event.snapshotData?.taxSettings || jobPosting?.taxSettings;
      let tax = 0;
      const totalAmount = totalPay;
      let afterTaxAmount = totalAmount;

      if (taxSettings?.enabled) {
        if (taxSettings.taxRate !== undefined && taxSettings.taxRate > 0) {
          tax = Math.round(totalAmount * (taxSettings.taxRate / 100));
        } else if (taxSettings.taxAmount !== undefined && taxSettings.taxAmount > 0) {
          tax = taxSettings.taxAmount;
        }
        afterTaxAmount = totalAmount - tax;
      }

      logger.info('💰 이번달 수입 합산', {
        component: 'useScheduleData',
        data: {
          eventId: event.eventId,
          eventName: event.eventName,
          date: event.date,
          totalHours,
          totalPay,
          tax,
          afterTaxAmount,
          이전합계: sum,
          새로운합계: sum + afterTaxAmount,
        },
      });

      return sum + afterTaxAmount;
    }, 0);

    // 🔥 총 수입 계산 (완료된 일정만) - 모달과 100% 동일한 로직 사용
    const totalEarnings = completedEvents.reduce((sum, event) => {
      // WorkLog 찾기
      const targetWorkLog = event.workLogId ? workLogsMap.get(event.workLogId) : null;

      // JobPosting 찾기
      const jobPosting = jobPostingsMap.get(event.eventId);

      logger.info('🔍 급여 데이터 확인', {
        component: 'useScheduleData',
        data: {
          eventId: event.eventId,
          hasJobPosting: !!jobPosting,
          jobPostingSalaryAmount: jobPosting?.salaryAmount,
          jobPostingRoleSalaries: jobPosting?.roleSalaries,
          jobPostingRoleSalariesKeys: jobPosting?.roleSalaries
            ? Object.keys(jobPosting.roleSalaries)
            : [],
          hasSnapshotData: !!event.snapshotData,
          snapshotSalary: event.snapshotData?.salary,
        },
      });

      // 모달과 동일한 로직: JobPosting이 없거나 급여 정보가 없으면 스냅샷 사용
      const hasJobPostingSalary =
        jobPosting &&
        ((jobPosting.salaryAmount && jobPosting.salaryAmount !== '0') ||
          (jobPosting.roleSalaries && Object.keys(jobPosting.roleSalaries).length > 0));
      const effectiveJobPosting = hasJobPostingSalary
        ? jobPosting
        : event.snapshotData
          ? ({
              id: event.eventId,
              title: event.snapshotData.title || '근무',
              location: event.snapshotData.location,
              detailedAddress: event.snapshotData.detailedAddress,
              district: event.snapshotData.district,
              salaryType: event.snapshotData.salary.type,
              salaryAmount: String(event.snapshotData.salary.amount),
              useRoleSalary: event.snapshotData.salary.useRoleSalary,
              roleSalaries: event.snapshotData.salary.roleSalaries,
              benefits: {
                mealAllowance: event.snapshotData.allowances?.meal || 0,
                transportation: event.snapshotData.allowances?.transportation || 0,
                accommodation: event.snapshotData.allowances?.accommodation || 0,
              },
              taxSettings: event.snapshotData.taxSettings,
              createdBy: event.snapshotData.createdBy,
            } as unknown as JobPosting)
          : null;

      logger.info('✅ effectiveJobPosting 결정', {
        component: 'useScheduleData',
        data: {
          eventId: event.eventId,
          usedJobPosting: hasJobPostingSalary,
          usedSnapshot: !hasJobPostingSalary && !!event.snapshotData,
          effectiveSalaryAmount: effectiveJobPosting?.salaryAmount,
          effectiveRoleSalaries: effectiveJobPosting?.roleSalaries,
          effectiveRoleSalariesKeys: effectiveJobPosting?.roleSalaries
            ? Object.keys(effectiveJobPosting.roleSalaries)
            : [],
        },
      });

      // 역할 결정
      const effectiveRole = (targetWorkLog ? targetWorkLog.role : event.role) || 'staff';

      // 근무 시간 계산
      const effectiveStartTime = targetWorkLog?.scheduledStartTime || event.startTime;
      const effectiveEndTime = targetWorkLog?.scheduledEndTime || event.endTime;

      const workLogData = {
        id: targetWorkLog?.id || event.id,
        scheduledStartTime: effectiveStartTime,
        scheduledEndTime: effectiveEndTime,
        date: event.date,
        role: effectiveRole,
        eventId: event.eventId,
      };

      const { calculateSingleWorkLogPayroll } = require('../../utils/payrollCalculations');

      // 급여 계산 (모달과 동일)
      const totalPay = calculateSingleWorkLogPayroll(
        workLogData as unknown as UnifiedWorkLog,
        effectiveRole,
        effectiveJobPosting
      );

      // 세금 계산
      const taxSettings = event.snapshotData?.taxSettings || jobPosting?.taxSettings;
      let tax = 0;
      const totalAmount = totalPay;
      let afterTaxAmount = totalAmount;

      if (taxSettings?.enabled) {
        if (taxSettings.taxRate !== undefined && taxSettings.taxRate > 0) {
          tax = Math.round(totalAmount * (taxSettings.taxRate / 100));
        } else if (taxSettings.taxAmount !== undefined && taxSettings.taxAmount > 0) {
          tax = taxSettings.taxAmount;
        }
        afterTaxAmount = totalAmount - tax;
      }

      return sum + afterTaxAmount;
    }, 0);

    return {
      totalSchedules: filteredSchedules.length,
      completedSchedules: completedEvents.length,
      upcomingSchedules: upcomingEvents.length,
      totalEarnings,
      thisMonthEarnings,
      hoursWorked: Math.round(totalHoursWorked),
    };
  }, [filteredSchedules, workLogsMap, jobPostingsMap]);

  // 새로고침 함수 (UnifiedDataContext는 자동 실시간 동기화)
  const refreshData = useCallback(() => {
    _setLastRefresh(Date.now());
    // UnifiedDataContext가 자동으로 실시간 동기화하므로 별도 작업 불필요
    logger.info('스케줄 데이터 새로고침 요청', { component: 'useScheduleData' });
  }, []);

  // ID로 스케줄 찾기
  const getScheduleById = useCallback(
    (id: string) => {
      return schedules.find((schedule) => schedule.id === id);
    },
    [schedules]
  );

  return {
    schedules: filteredSchedules,
    loading,
    error,
    stats,
    filters,
    setFilters,
    refreshData,
    getScheduleById,
  };
};

export { useScheduleData };
