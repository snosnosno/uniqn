import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnifiedDataContext } from '../../contexts/UnifiedDataContext';
import { logger } from '../../utils/logger';
import { handleError } from '../../utils/errorHandler';
import { ScheduleEvent, ScheduleStats } from '../../types/schedule';
import type { Application, WorkLog } from '../../types/unifiedData';

// Local imports
import { UseScheduleDataReturn } from './types';
import { processApplicationData, processWorkLogData } from './dataProcessors';
import { filterSchedules, createDefaultFilters } from './filterUtils';
import { calculatePayroll } from '../../utils/payrollCalculations';

/**
 * 스케줄 데이터를 관리하는 커스텀 훅
 * UnifiedDataContext를 활용하여 중복 구독 제거
 */
const useScheduleData = (): UseScheduleDataReturn => {
  const { currentUser } = useAuth();
  const context = useUnifiedDataContext();
  const { staff: _staff, workLogs, applications, jobPostings, loading: _contextLoading, error: _contextError } = context.state;
  const [filters, setFilters] = useState(createDefaultFilters());
  const [_lastRefresh, _setLastRefresh] = useState(Date.now());

  // 스케줄 데이터 상태
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UnifiedDataContext 데이터를 스케줄 이벤트로 변환
  useEffect(() => {
    const loadSchedules = async () => {
      if (!currentUser) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      // 🔥 초기 로딩 상태 체크: UnifiedDataContext가 로딩 중이면 대기
      if (_contextLoading.initial) {
        setLoading(true);
        return;
      }

      setLoading(true);

      try {
        const mergedEvents: ScheduleEvent[] = [];
        const processedKeys = new Set<string>();

        // 1. WorkLogs 처리 (우선순위 높음) - 병렬 처리
        const userWorkLogs = Array.from(workLogs.values())
          .filter((log): log is WorkLog => {
            const workLog = log as WorkLog;
            // staffId가 정확히 일치하거나 userId_숫자 패턴으로 시작하는 경우
            return workLog.staffId === currentUser.uid ||
                   workLog.staffId?.startsWith(currentUser.uid + '_');
          });

        // WorkLog 비동기 처리를 병렬로 실행
        const workLogPromises = userWorkLogs.map(workLog =>
          processWorkLogData(workLog.id || '', workLog)
        );
        const workLogEvents = await Promise.all(workLogPromises);

        // WorkLog 이벤트 추가
        workLogEvents.forEach(event => {
          mergedEvents.push(event);

          // 중복 방지 키 생성
          if (event.eventId && event.date) {
            const timeKey = event.startTime && 'seconds' in event.startTime ?
              new Date(event.startTime.seconds * 1000).toTimeString().slice(0, 5) : 'notime';
            const key = `${event.eventId}_${event.date}_${timeKey}`;
            const basicKey = `${event.eventId}_${event.date}`;
            processedKeys.add(key);
            processedKeys.add(basicKey);
          }
        });

        // 2. Applications 처리 (중복 제외) - 병렬 처리
        const userApplications = Array.from(applications.values())
          .filter((app): app is Application => {
            const application = app as Application;
            // applicantId가 정확히 일치하거나 userId_숫자 패턴으로 시작하는 경우
            return application.applicantId === currentUser.uid ||
                   application.applicantId?.startsWith(currentUser.uid + '_');
          });

        // Application 비동기 처리를 병렬로 실행
        const applicationPromises = userApplications.map(application =>
          processApplicationData(application.id || '', application)
        );
        const applicationEventArrays = await Promise.all(applicationPromises);

        // Application 이벤트 추가 (중복 체크)
        applicationEventArrays.flat().forEach(event => {
          if (event.eventId && event.date) {
            const timeKey = event.startTime && 'seconds' in event.startTime ?
              new Date(event.startTime.seconds * 1000).toTimeString().slice(0, 5) : 'notime';
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
            applicationEvents: applicationEventArrays.flat().length
          }
        });
      } catch (err) {
        const errorMessage = handleError(err, {
          component: 'useScheduleData',
          action: 'loadSchedules',
          userId: currentUser?.uid,
          fallbackMessage: '스케줄 데이터를 불러오는 중 오류가 발생했습니다.'
        });
        setError(errorMessage);
        setLoading(false);
      }
    };

    // 🔥 개선된 로딩 로직: UnifiedDataContext 초기 로딩 완료 후 처리
    if (currentUser && !_contextLoading.initial) {
      loadSchedules();
    } else if (!currentUser) {
      // 로그인하지 않은 경우
      setSchedules([]);
      setLoading(false);
    }

    // 기본 반환 (cleanup 불필요)
    return undefined;
  }, [currentUser, applications, workLogs, _contextLoading.initial]);

  // 필터링된 스케줄
  const filteredSchedules = useMemo(() => {
    return filterSchedules(schedules, filters);
  }, [schedules, filters]);

  // 통계 계산 - 완료된 일정만 시간과 수입 계산에 포함
  const stats = useMemo((): ScheduleStats => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const completedEvents = filteredSchedules.filter(e =>
      e.type === 'completed' ||
      (e.status === 'checked_out' && e.actualEndTime)
    );

    const upcomingEvents = filteredSchedules.filter(e =>
      new Date(e.date) > now
    );

    // 완료된 일정 중 이번달 일정 필터링
    const thisMonthCompletedEvents = completedEvents.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate.getMonth() === thisMonth && eventDate.getFullYear() === thisYear;
    });

    // 총 근무 시간 계산 (완료된 일정만, 예정 시간 기준)
    let totalHoursWorked = 0;
    completedEvents.forEach(event => {
      // 예정 시간 기준으로 계산 (startTime, endTime)
      if (event.startTime && event.endTime) {
        const startDate = event.startTime && 'toDate' in event.startTime ?
          event.startTime.toDate() : null;
        const endDate = event.endTime && 'toDate' in event.endTime ?
          event.endTime.toDate() : null;

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
                hoursWorked: hoursWorked
              }
            });
          }
        }
      }
    });

    // 🔥 이번달 수입 계산 (완료된 일정만) - 스냅샷 우선, 세후 급여 사용
    const thisMonthEarnings = thisMonthCompletedEvents.reduce((sum, event) => {
      // WorkLog 찾기 (Map.get 사용) - workLogId로 조회
      const workLog = event.workLogId ? workLogs.get(event.workLogId) : null;
      if (!workLog) return sum + (event.payrollAmount || 0);

      // JobPosting 찾기 (스냅샷 우선)
      const hasSnapshot = !!event.snapshotData;
      const realJobPosting = jobPostings.get(event.eventId);

      // 스냅샷이 있으면 스냅샷 사용, 없으면 realJobPosting 사용
      let jobPosting: any = null;

      if (event.snapshotData) {
        // 스냅샷 데이터를 JobPosting 형식으로 변환
        jobPosting = {
          id: event.eventId,
          title: event.snapshotData.title || '근무',
          location: event.snapshotData.location,
          salaryType: event.snapshotData.salary.type,
          salaryAmount: String(event.snapshotData.salary.amount),
          useRoleSalary: event.snapshotData.salary.useRoleSalary,
          roleSalaries: event.snapshotData.salary.roleSalaries,
          benefits: {
            mealAllowance: event.snapshotData.allowances?.meal || 0,
            transportation: event.snapshotData.allowances?.transportation || 0,
            accommodation: event.snapshotData.allowances?.accommodation || 0
          },
          taxSettings: event.snapshotData.taxSettings
        };
      } else if (realJobPosting?.salaryType || realJobPosting?.salaryAmount) {
        // 새 형식의 JobPosting (salaryType, salaryAmount 있음)
        jobPosting = realJobPosting;
      }

      // JobPosting이 없거나 급여 정보가 없으면 저장된 payrollAmount 사용
      if (!jobPosting || (!jobPosting.salaryType && !jobPosting.salaryAmount)) {
        return sum + (event.payrollAmount || 0);
      }

      // 급여 계산
      const payroll = calculatePayroll([workLog as any], workLog.role || '', jobPosting);
      const totalAmount = payroll.totalPayment;

      // 세금 계산 (스냅샷 우선)
      const taxSettings = event.snapshotData?.taxSettings || jobPosting?.taxSettings;
      if (taxSettings?.enabled) {
        const tax = taxSettings.taxAmount
          ? taxSettings.taxAmount
          : Math.round(totalAmount * (taxSettings.taxRate || 3.3) / 100);
        const afterTaxAmount = totalAmount - tax;
        return sum + afterTaxAmount;
      }

      // 세금 없으면 총 지급액
      return sum + totalAmount;
    }, 0);

    // 🔥 총 수입 계산 (완료된 일정만) - 스냅샷 우선, 세후 급여 사용
    const totalEarnings = completedEvents.reduce((sum, event) => {
      // WorkLog 찾기 (Map.get 사용) - workLogId로 조회
      const workLog = event.workLogId ? workLogs.get(event.workLogId) : null;
      if (!workLog) return sum + (event.payrollAmount || 0);

      // JobPosting 찾기 (스냅샷 우선)
      const realJobPosting = jobPostings.get(event.eventId);
      let jobPosting: any = null;

      if (event.snapshotData) {
        // 스냅샷 데이터를 JobPosting 형식으로 변환
        jobPosting = {
          id: event.eventId,
          title: event.snapshotData.title || '근무',
          location: event.snapshotData.location,
          salaryType: event.snapshotData.salary.type,
          salaryAmount: String(event.snapshotData.salary.amount),
          useRoleSalary: event.snapshotData.salary.useRoleSalary,
          roleSalaries: event.snapshotData.salary.roleSalaries,
          benefits: {
            mealAllowance: event.snapshotData.allowances?.meal || 0,
            transportation: event.snapshotData.allowances?.transportation || 0,
            accommodation: event.snapshotData.allowances?.accommodation || 0
          },
          taxSettings: event.snapshotData.taxSettings
        };
      } else if (realJobPosting?.salaryType || realJobPosting?.salaryAmount) {
        // 새 형식의 JobPosting (salaryType, salaryAmount 있음)
        jobPosting = realJobPosting;
      }

      // JobPosting이 없거나 급여 정보가 없으면 저장된 payrollAmount 사용
      if (!jobPosting || (!jobPosting.salaryType && !jobPosting.salaryAmount)) {
        return sum + (event.payrollAmount || 0);
      }

      // 급여 계산
      const payroll = calculatePayroll([workLog as any], workLog.role || '', jobPosting);
      const totalAmount = payroll.totalPayment;

      // 세금 계산 (스냅샷 우선)
      const taxSettings = event.snapshotData?.taxSettings || jobPosting?.taxSettings;
      if (taxSettings?.enabled) {
        const tax = taxSettings.taxAmount
          ? taxSettings.taxAmount
          : Math.round(totalAmount * (taxSettings.taxRate || 3.3) / 100);
        const afterTaxAmount = totalAmount - tax;
        return sum + afterTaxAmount;
      }

      // 세금 없으면 총 지급액
      return sum + totalAmount;
    }, 0);

    return {
      totalSchedules: filteredSchedules.length,
      completedSchedules: completedEvents.length,
      upcomingSchedules: upcomingEvents.length,
      totalEarnings,
      thisMonthEarnings,
      hoursWorked: Math.round(totalHoursWorked)
    };
  }, [filteredSchedules, workLogs, jobPostings]);

  // 새로고침 함수 (UnifiedDataContext는 자동 실시간 동기화)
  const refreshData = useCallback(() => {
    _setLastRefresh(Date.now());
    // UnifiedDataContext가 자동으로 실시간 동기화하므로 별도 작업 불필요
    logger.info('스케줄 데이터 새로고침 요청', { component: 'useScheduleData' });
  }, []);

  // ID로 스케줄 찾기
  const getScheduleById = useCallback((id: string) => {
    return schedules.find(schedule => schedule.id === id);
  }, [schedules]);

  return {
    schedules: filteredSchedules,
    loading,
    error,
    stats,
    filters,
    setFilters,
    refreshData,
    getScheduleById
  };
};

export default useScheduleData;