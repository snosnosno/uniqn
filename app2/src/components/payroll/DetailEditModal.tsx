import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { EnhancedPayrollCalculation } from '../../types/payroll';
import { formatCurrency } from '../../i18n-helpers';
import { logger } from '../../utils/logger';
import { calculateWorkHours, parseTimeToString } from '../../utils/workLogMapper';
import { getStaffIdentifier, matchStaffIdentifier } from '../../utils/staffIdMapper';
import { findTargetWorkLog, filterWorkLogsByRole } from '../../utils/workLogHelpers';

import { UnifiedWorkLog } from '../../types/unified/workLog';

interface DetailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: EnhancedPayrollCalculation | null;
  workLogs: UnifiedWorkLog[]; // props로 workLogs 받기
  onSave: (
    staff: EnhancedPayrollCalculation,
    allowances: EnhancedPayrollCalculation['allowances']
  ) => void;
}

const DetailEditModal: React.FC<DetailEditModalProps> = ({
  isOpen,
  onClose,
  staff,
  workLogs, // props로 받은 workLogs 사용
  onSave: _onSave,
}) => {
  const { t } = useTranslation();
  const [allowances, setAllowances] = useState<EnhancedPayrollCalculation['allowances']>({
    meal: 0,
    transportation: 0,
    accommodation: 0,
    bonus: 0,
    other: 0,
    isManualEdit: false,
  });

  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState<'basic' | 'work' | 'calculation'>('basic');

  // props로 받은 workLogs를 사용 (중복 구독 방지)
  const realTimeWorkLogs = workLogs;

  // 탭 정의
  const tabs = [
    { id: 'basic' as const, name: t('payroll.tabs.basic', '정보'), icon: '👤' },
    { id: 'work' as const, name: t('payroll.tabs.work', '근무'), icon: '🕐' },
    { id: 'calculation' as const, name: t('payroll.tabs.calculation', '급여'), icon: '💰' },
  ];

  // staff 데이터가 변경될 때 allowances 초기화
  useEffect(() => {
    if (staff) {
      // 디버깅 로그 추가
      logger.info('🔍 DetailEditModal staff 데이터 확인', {
        component: 'DetailEditModal',
        data: {
          staffId: staff.staffId,
          staffName: staff.staffName,
          allowances: staff.allowances,
          hasDailyRates: !!staff.allowances.dailyRates,
          hasWorkDays: !!staff.allowances.workDays,
          meal: staff.allowances.meal,
          transportation: staff.allowances.transportation,
          dailyRates: staff.allowances.dailyRates,
          workDays: staff.allowances.workDays,
        },
      });

      // 총액(일당×일수)으로 계산되어 온 값을 그대로 사용
      const newAllowances: EnhancedPayrollCalculation['allowances'] = {
        meal: staff.allowances.meal || 0,
        transportation: staff.allowances.transportation || 0,
        accommodation: staff.allowances.accommodation || 0,
        bonus: staff.allowances.bonus || 0,
        other: staff.allowances.other || 0,
        isManualEdit: staff.allowances.isManualEdit || false,
        // 일당 계산 정보를 조건부로 보존 (일당 계산 과정 표시용)
        ...(staff.allowances.dailyRates && { dailyRates: staff.allowances.dailyRates }),
        ...(staff.allowances.workDays !== undefined && { workDays: staff.allowances.workDays }),
      };

      // 선택적 필드들은 조건부로 추가
      if (staff.allowances.otherDescription) {
        newAllowances.otherDescription = staff.allowances.otherDescription;
      }

      logger.info('🎯 DetailEditModal allowances 설정 결과', {
        component: 'DetailEditModal',
        data: {
          originalMeal: staff.allowances.meal,
          calculatedMeal: newAllowances.meal,
          originalTransportation: staff.allowances.transportation,
          calculatedTransportation: newAllowances.transportation,
          newAllowances,
        },
      });

      setAllowances(newAllowances);
    }
  }, [staff]);

  // 역할 추론 함수 제거 - 정확한 역할 정보만 사용

  // getTargetWorkLog 패턴 적용 - ScheduleDetailModal 참고
  const _getTargetWorkLog = useCallback(
    (date: string) => {
      if (!staff) return null;

      const staffId = getStaffIdentifier(staff);

      // 1. 우선 정확한 조건으로 WorkLog 찾기
      let targetWorkLog = findTargetWorkLog(realTimeWorkLogs, {
        staffId,
        date,
        role: staff.role,
      });

      // 2. 못찾으면 role 없이 찾기
      if (!targetWorkLog) {
        targetWorkLog = findTargetWorkLog(realTimeWorkLogs, {
          staffId,
          date,
        });
      }

      return targetWorkLog;
    },
    [staff, realTimeWorkLogs]
  );

  // 날짜별 근무 내역 계산 - getTargetWorkLog 패턴 사용
  const workHistory = useMemo(() => {
    if (!staff) return [];

    const staffId = getStaffIdentifier(staff);

    // 1. 스태프의 모든 WorkLog 가져오기
    const allStaffWorkLogs = realTimeWorkLogs.filter((log) => {
      const matches = matchStaffIdentifier(log, [staffId]);
      return matches;
    });

    // 2. filterWorkLogsByRole 유틸리티 사용
    const staffRoleWorkLogs = filterWorkLogsByRole(allStaffWorkLogs, staff.role);

    // 3. 날짜별로 그룹화하여 중복 제거 (기존 로직 유지)
    const mergedLogsMap = new Map<string, any>();

    staffRoleWorkLogs.forEach((log) => {
      const key = `${log.date}`;

      if (!mergedLogsMap.has(key)) {
        // 새로운 날짜인 경우 추가
        mergedLogsMap.set(key, { ...log, role: log.role || staff.role });
      } else {
        // 기존 데이터가 있는 경우 병합 (더 완전한 데이터 우선)
        const existingLog = mergedLogsMap.get(key);
        mergedLogsMap.set(key, {
          ...existingLog,
          // 실제 시간 정보가 있으면 우선 사용
          actualStartTime: log.actualStartTime || existingLog.actualStartTime,
          actualEndTime: log.actualEndTime || existingLog.actualEndTime,
          // 예정 시간 정보 우선순위: 더 완전한 데이터
          scheduledStartTime: log.scheduledStartTime || existingLog.scheduledStartTime,
          scheduledEndTime: log.scheduledEndTime || existingLog.scheduledEndTime,
          // 상태 정보 (더 진행된 상태 우선)
          status: log.status || existingLog.status,
          // 기타 정보 병합 (타입 안전성을 위해 any로 캐스팅)
          timeSlot: (log as any).timeSlot || (existingLog as any).timeSlot,
          assignedTime: (log as any).assignedTime || (existingLog as any).assignedTime,
        });
      }
    });

    const uniqueWorkLogs = Array.from(mergedLogsMap.values());

    if (uniqueWorkLogs.length === 0) return [];

    try {
      // 실시간 WorkLogs를 날짜별로 정렬
      const sortedLogs = [...uniqueWorkLogs].sort((a, b) => {
        const getDateValue = (date: string | Date | { seconds: number } | null | undefined) => {
          if (!date) return 0;
          try {
            if (typeof date === 'object' && 'seconds' in date) {
              return date.seconds * 1000;
            } else if (typeof date === 'string') {
              return new Date(date).getTime();
            } else if (date instanceof Date) {
              return date.getTime();
            }
            return 0;
          } catch {
            return 0;
          }
        };
        return getDateValue(a.date) - getDateValue(b.date);
      });

      const tbdText = t('common.tbd', '미정');
      return sortedLogs.map((log) => {
        try {
          // 날짜 파싱
          let dateStr = t('common.noDate', '날짜 없음');
          let dayName = '';

          if (log.date) {
            let dateValue: Date | null = null;
            const logDate = log.date as any;

            if (typeof logDate === 'object' && 'seconds' in logDate) {
              dateValue = new Date(logDate.seconds * 1000);
            } else if (typeof logDate === 'string') {
              dateValue = new Date(logDate);
            } else if (logDate instanceof Date) {
              dateValue = logDate;
            }

            if (dateValue && !isNaN(dateValue.getTime())) {
              const dayNames = [
                t('common.days.sun', '일'),
                t('common.days.mon', '월'),
                t('common.days.tue', '화'),
                t('common.days.wed', '수'),
                t('common.days.thu', '목'),
                t('common.days.fri', '금'),
                t('common.days.sat', '토'),
              ];
              dayName = dayNames[dateValue.getDay()] || '';
              dateStr = `${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
            }
          }

          // 시간 데이터 파싱 - workLogMapper의 함수 사용
          const parseTime = (
            timeValue: string | Date | { seconds: number } | null | undefined
          ): string => {
            const result = parseTimeToString(timeValue);

            if (result) {
              return result;
            }

            return tbdText;
          };

          // 정산 목적: scheduledStartTime/scheduledEndTime (스태프탭 설정)만 사용
          // 실제 시간으로 폴백하지 않음 - 정산은 스케줄된 시간 기준
          let startTime = tbdText;
          let endTime = tbdText;

          // scheduledTime이 있으면 사용
          if (log.scheduledStartTime) {
            startTime = parseTime(log.scheduledStartTime);
          }
          if (log.scheduledEndTime) {
            endTime = parseTime(log.scheduledEndTime);
          }

          // timeSlot 필드에서 직접 파싱 (백업)
          if ((startTime === tbdText || endTime === tbdText) && (log as any).timeSlot) {
            const timeSlot = (log as any).timeSlot;
            if (timeSlot && timeSlot !== tbdText && timeSlot.includes('-')) {
              const parts = timeSlot.split('-').map((t: string) => t.trim());
              if (parts[0] && startTime === tbdText) {
                startTime = parts[0];
              }
              if (parts[1] && endTime === tbdText) {
                endTime = parts[1];
              }
            }
          }

          // assignedTime이 있으면 변환해서 사용 (최종 백업)
          if ((startTime === tbdText || endTime === tbdText) && (log as any).assignedTime) {
            const assignedTime = (log as any).assignedTime;
            if (assignedTime && assignedTime.includes('-')) {
              const parts = assignedTime.split('-').map((t: string) => t.trim());
              if (parts[0] && startTime === tbdText) startTime = parts[0];
              if (parts[1] && endTime === tbdText) endTime = parts[1];
            }
          }

          // 근무 시간 계산 - calculateWorkHours 함수 사용
          let workHours = 0;
          try {
            workHours = calculateWorkHours(log);
          } catch (error) {
            logger.error(
              '근무 시간 계산 오류',
              error instanceof Error ? error : new Error(String(error)),
              {
                component: 'DetailEditModal',
                data: { logId: log.id },
              }
            );
            // 백업 계산 로직
            if (startTime !== tbdText && endTime !== tbdText) {
              const parseTimeToMinutes = (timeStr: string): number => {
                const parts = timeStr.split(':').map(Number);
                const hours = parts[0] || 0;
                const minutes = parts[1] || 0;
                return hours * 60 + minutes;
              };

              const startMinutes = parseTimeToMinutes(startTime);
              const endMinutes = parseTimeToMinutes(endTime);

              let totalMinutes = endMinutes - startMinutes;
              if (totalMinutes < 0) {
                totalMinutes += 24 * 60;
              }

              workHours = totalMinutes / 60;
            }
          }

          // 상태 결정 로직 개선
          let displayStatus = log.status || 'scheduled';

          // 시간정보가 없는 경우의 상태 처리
          if (
            (startTime === tbdText || endTime === tbdText) &&
            !log.actualStartTime &&
            !log.actualEndTime
          ) {
            displayStatus = 'scheduled'; // 예정 상태
          }

          // 실제 출퇴근 데이터가 있는 경우 상태 우선
          if (
            log.actualStartTime ||
            log.actualEndTime ||
            log.status === 'checked_out' ||
            log.status === 'checked_in'
          ) {
            displayStatus = log.status || 'checked_in';
          }

          return {
            date: dateStr,
            dayName,
            role: log.role || staff.role, // 역할 정보 (정확한 역할 사용)
            startTime,
            endTime,
            workHours: workHours.toFixed(1),
            status: displayStatus,
            rawLog: log,
            // 추가 정보
            hasTimeInfo: startTime !== tbdText && endTime !== tbdText,
            hasActualTime: !!(log.actualStartTime || log.actualEndTime),
          };
        } catch (error) {
          logger.error(
            '근무 내역 파싱 오류',
            error instanceof Error ? error : new Error(String(error)),
            { component: 'DetailEditModal' }
          );
          const errorText = t('common.error', '오류');
          return {
            date: t('common.parseError', '파싱 오류'),
            dayName: '',
            startTime: errorText,
            endTime: errorText,
            workHours: '0.0',
            status: errorText,
            rawLog: log,
          };
        }
      });
    } catch (error) {
      logger.error(
        '근무 내역 전체 파싱 오류',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'DetailEditModal' }
      );
      return [];
    }
  }, [staff, realTimeWorkLogs, t]);

  const getTotalAllowances = useCallback(() => {
    return (
      allowances.meal +
      allowances.transportation +
      allowances.accommodation +
      allowances.bonus +
      allowances.other
    );
  }, [allowances]);

  const getTotalAmount = useCallback(() => {
    if (!staff) return 0;
    return staff.basePay + getTotalAllowances();
  }, [staff, getTotalAllowances]);

  // 급여 유형 한글 라벨
  const getSalaryTypeLabel = useCallback(
    (type: string) => {
      const labels: Record<string, string> = {
        hourly: t('payroll.salaryType.hourly', '시급'),
        daily: t('payroll.salaryType.daily', '일급'),
        monthly: t('payroll.salaryType.monthly', '월급'),
        other: t('payroll.salaryType.other', '기타'),
      };
      return labels[type] || type;
    },
    [t]
  );

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border dark:border-gray-700 w-11/12 md:w-4/5 lg:w-3/5 shadow-lg rounded-md bg-white dark:bg-gray-800">
        {/* 헤더 */}
        <div className="flex justify-between items-center pb-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 dark:text-indigo-300 font-medium text-sm">
                {staff.staffName.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {staff.staffName} {t('payroll.detailTitle', '정산 상세')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{staff.role}</p>
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
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
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
          {/* 기본정보 탭 */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    {t('payroll.basicInfo', '기본 정보')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t('common.name', '이름')}:
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {staff.staffName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t('common.role', '역할')}:
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{staff.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t('common.contact', '연락처')}:
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {staff.phone || t('common.notRegistered', '미등록')}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    {t('payroll.salaryInfo', '급여 정보')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t('payroll.salaryType.label', '급여 유형')}:
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {getSalaryTypeLabel(staff.salaryType)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t('payroll.baseSalary', '기본 급여')}:
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {staff.baseSalary.toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t('payroll.basePay', '기본급')}:
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {staff.basePay.toLocaleString('ko-KR')}
                      </span>
                    </div>
                    {staff.tax !== undefined && staff.tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {t('payroll.tax', '세금')}:
                        </span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {staff.taxRate !== undefined && staff.taxRate > 0
                            ? `${staff.taxRate}%`
                            : t('payroll.fixedTax', '고정 세금')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  {t('payroll.workSummary', '근무 요약')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {staff.totalDays}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('payroll.workDays', '근무일수')}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {staff.totalHours.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('payroll.workHours', '근무시간')}
                    </div>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {staff.totalAmount.toLocaleString('ko-KR')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('payroll.totalPay', '총 지급액')}
                    </div>
                  </div>
                  {staff.afterTaxAmount !== undefined && staff.afterTaxAmount > 0 ? (
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {staff.afterTaxAmount.toLocaleString('ko-KR')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t('payroll.afterTaxPay', '세후 급여')}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-400 dark:text-gray-500">-</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t('payroll.afterTaxPay', '세후 급여')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 근무내역 탭 */}
          {activeTab === 'work' && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
                📅 {t('payroll.workHistory', '근무 내역')}
              </h4>
              {workHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="border dark:border-gray-600 rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('common.date', '날짜')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('common.role', '역할')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('payroll.startTime', '시작시간')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('payroll.endTime', '종료시간')}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('payroll.workHours', '근무시간')}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('common.status', '상태')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {workHistory.map((history) => (
                          <tr
                            key={`history-${history.date}`}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              <div className="flex items-center gap-2">
                                <span>{history.date}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({history.dayName})
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  history.role === 'floor'
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                                    : history.role === 'dealer'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                      : history.role === 'manager'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                }`}
                              >
                                {history.role === 'floor'
                                  ? 'floor'
                                  : history.role === 'dealer'
                                    ? 'dealer'
                                    : history.role === 'manager'
                                      ? 'manager'
                                      : history.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {history.startTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {history.endTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                              {t('payroll.hoursFormat', '{{hours}}시간', {
                                hours: history.workHours,
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  history.status === 'checked_out'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : history.status === 'checked_in'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                      : history.status === 'scheduled'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                        : history.status === 'absent'
                                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                }`}
                              >
                                {history.status === 'checked_out'
                                  ? t('attendance.checkedOut', '퇴근')
                                  : history.status === 'checked_in'
                                    ? t('attendance.checkedIn', '출근')
                                    : history.status === 'scheduled'
                                      ? t('attendance.scheduled', '예정')
                                      : history.status === 'absent'
                                        ? t('attendance.absent', '결석')
                                        : history.status === 'not_started'
                                          ? t('attendance.notStarted', '출근전')
                                          : history.status}
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
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('payroll.totalWorkHours', '총 근무시간')}
                      </span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {t('payroll.hoursFormat', '{{hours}}시간', {
                          hours: workHistory
                            .reduce((sum, h) => sum + parseFloat(h.workHours), 0)
                            .toFixed(1),
                        })}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {t('payroll.totalWorkDaysCount', '총 {{count}}일 근무', {
                        count: workHistory.length,
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-sm">{t('payroll.noWorkHistory', '근무 내역이 없습니다.')}</p>
                </div>
              )}
            </div>
          )}

          {/* 급여계산 탭 */}
          {activeTab === 'calculation' && (
            <div className="space-y-6">
              {/* 기본급 계산 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  💰 {t('payroll.basePayCalculation', '기본급 계산')}
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        {getSalaryTypeLabel(staff.salaryType)} ×{' '}
                        {staff.salaryType === 'hourly'
                          ? t('payroll.hoursFormat', '{{hours}}시간', {
                              hours: staff.totalHours.toFixed(1),
                            })
                          : t('payroll.daysFormat', '{{days}}일', { days: staff.totalDays })}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {staff.baseSalary.toLocaleString('ko-KR')} ×{' '}
                        {staff.salaryType === 'hourly'
                          ? staff.totalHours.toFixed(1)
                          : staff.totalDays}
                      </span>
                    </div>
                    <div className="border-t dark:border-gray-600 pt-2 flex justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('payroll.basePayTotal', '기본급 합계')}
                      </span>
                      <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {staff.basePay.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 수당 설정 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  🎁 {t('payroll.allowanceInfo', '수당 정보')}
                </h4>

                {/* 일당 계산 정보 표시 */}
                {allowances.dailyRates && allowances.workDays ? (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        {t('payroll.dailyBasedCalculation', '일당 기반 계산')}
                      </span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {t('payroll.daysWorked', '{{days}}일 근무', { days: allowances.workDays })}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-blue-700">
                      {allowances.dailyRates.meal && (
                        <div className="flex justify-between">
                          <span>
                            {t('payroll.allowance.mealPerDay', '식비: {{amount}}원/일', {
                              amount: allowances.dailyRates.meal.toLocaleString(),
                            })}
                          </span>
                          <span>
                            = {(allowances.dailyRates.meal * allowances.workDays).toLocaleString()}
                            {t('common.won', '원')}
                          </span>
                        </div>
                      )}
                      {allowances.dailyRates.transportation && (
                        <div className="flex justify-between">
                          <span>
                            {t('payroll.allowance.transportPerDay', '교통비: {{amount}}원/일', {
                              amount: allowances.dailyRates.transportation.toLocaleString(),
                            })}
                          </span>
                          <span>
                            ={' '}
                            {(
                              allowances.dailyRates.transportation * allowances.workDays
                            ).toLocaleString()}
                            {t('common.won', '원')}
                          </span>
                        </div>
                      )}
                      {allowances.dailyRates.accommodation && (
                        <div className="flex justify-between">
                          <span>
                            {t('payroll.allowance.accommodationPerDay', '숙소비: {{amount}}원/일', {
                              amount: allowances.dailyRates.accommodation.toLocaleString(),
                            })}
                          </span>
                          <span>
                            ={' '}
                            {(
                              allowances.dailyRates.accommodation * allowances.workDays
                            ).toLocaleString()}
                            {t('common.won', '원')}
                          </span>
                        </div>
                      )}
                      {allowances.bonus > 0 && (
                        <div className="flex justify-between">
                          <span>{t('payroll.allowance.bonus', '보너스')}:</span>
                          <span>
                            {allowances.bonus.toLocaleString()}
                            {t('common.won', '원')}
                          </span>
                        </div>
                      )}
                      {allowances.other > 0 && (
                        <div className="flex justify-between">
                          <span>
                            {t('payroll.allowance.other', '기타')}
                            {allowances.otherDescription ? ` (${allowances.otherDescription})` : ''}
                            :
                          </span>
                          <span>
                            {allowances.other.toLocaleString()}
                            {t('common.won', '원')}
                          </span>
                        </div>
                      )}
                    </div>
                    {allowances.isManualEdit && (
                      <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                        ⚠️ {t('payroll.manuallyEdited', '수동으로 수정됨')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    {t('payroll.noAllowanceInfo', '수당 정보가 없습니다.')}
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  💡{' '}
                  {t(
                    'payroll.allowanceTip',
                    "수당은 정산 탭의 '추가 수당 설정'에서 일괄 관리할 수 있습니다."
                  )}
                </div>
              </div>

              {/* 세금 설정 */}
              {staff.tax !== undefined && staff.tax > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    💸 {t('payroll.taxSettings', '세금 설정')}
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">
                          {staff.taxRate !== undefined && staff.taxRate > 0
                            ? t('payroll.taxRate', '세율 ({{rate}}%)', { rate: staff.taxRate })
                            : t('payroll.tax', '세금')}
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          -{staff.tax.toLocaleString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 총 계산 */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">
                      {t('payroll.basePay', '기본급')}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {formatCurrency(staff.basePay, 'KRW', 'ko')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">
                      {t('payroll.allowanceTotal', '수당 합계')}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {getTotalAllowances().toLocaleString('ko-KR')}
                    </span>
                  </div>
                  {staff.tax !== undefined && staff.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        {t('payroll.tax', '세금')}
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        -{staff.tax.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-indigo-200 dark:border-indigo-700 pt-2 flex justify-between">
                    <span className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {t('payroll.totalPay', '총 지급액')}
                    </span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {getTotalAmount().toLocaleString('ko-KR')}
                    </span>
                  </div>
                  {staff.afterTaxAmount !== undefined && staff.afterTaxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-base font-medium text-green-700">
                        {t('payroll.afterTaxPay', '세후 급여')}
                      </span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {staff.afterTaxAmount.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 border border-transparent rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
          >
            {t('common.close', '닫기')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailEditModal;
