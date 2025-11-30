/**
 * WorkInfoTab Component
 *
 * Feature: 001-schedule-modal-split
 * Created: 2025-11-05
 * Purpose: 근무 정보 탭 - 스태프 배정, 출석 상태, 근무 기록 표시
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkInfoTabProps } from '../types';
import { parseTimeToString, calculateWorkHours } from '@/utils/workLogMapper';
import { logger } from '@/utils/logger';

/**
 * WorkInfoTab - 근무 내역 표시 컴포넌트
 *
 * @param schedule - 일정 데이터
 * @param workLogs - 실시간 WorkLog 리스트
 * @param onCheckOut - 퇴근 처리 핸들러
 * @param isReadOnly - 읽기 전용 모드
 */
const WorkInfoTab: React.FC<WorkInfoTabProps> = ({
  schedule,
  workLogs,
  onCheckOut: _onCheckOut,
  isReadOnly: _isReadOnly,
}) => {
  const { t } = useTranslation();

  // 역할명 라벨
  const getRoleLabel = (role: string) => {
    return t(`roles.${role}`, role);
  };

  // 목표 WorkLog 찾기
  const getTargetWorkLog = () => {
    if (!schedule) return null;

    let targetWorkLog = null;

    // 1. workLogId로 직접 찾기
    if (schedule.sourceCollection === 'workLogs' && schedule.workLogId) {
      targetWorkLog = workLogs.find((log) => log.id === schedule.workLogId);
    }

    // 2. sourceId로 찾기
    if (!targetWorkLog && schedule.sourceCollection === 'workLogs' && schedule.sourceId) {
      targetWorkLog = workLogs.find((log) => log.id === schedule.sourceId);
    }

    // 3. WorkLog ID 패턴 매칭
    if (!targetWorkLog) {
      targetWorkLog = workLogs.find(
        (log) =>
          log.id.startsWith(schedule.id) && log.date === schedule.date && log.type === 'schedule'
      );
    }

    // 4. eventId + date로 찾기
    if (!targetWorkLog) {
      targetWorkLog = workLogs.find(
        (log) =>
          log.eventId === schedule.eventId &&
          log.date === schedule.date &&
          log.type === 'schedule' &&
          (log.role === schedule.role || (!log.role && !schedule.role))
      );
    }

    return targetWorkLog;
  };

  // 근무 내역 생성
  const workHistory = useMemo(() => {
    if (!schedule) return [];

    // 1. 공통 함수로 WorkLog 찾기
    let targetWorkLog = getTargetWorkLog();

    // 여전히 찾지 못한 경우 기본 schedule 데이터 사용
    if (!targetWorkLog) {
      targetWorkLog = {
        id: schedule.id,
        staffId: schedule.sourceCollection === 'applications' ? '' : schedule.sourceId || '',
        staffName: t('common.user', '사용자'),
        date: schedule.date,
        role: schedule.role,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        status: 'scheduled' as any,
        type: 'schedule',
        eventId: schedule.eventId,
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
      let dateStr = t('common.noDate', '날짜 없음');
      let dayName = '';

      if (log.date) {
        const dateValue = new Date(log.date);
        if (!isNaN(dateValue.getTime())) {
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

      // 시간 파싱
      const parseTime = (timeValue: string | { toDate: () => Date } | null | undefined): string => {
        const result = parseTimeToString(timeValue);
        return result || t('common.tbd', '미정');
      };

      let startTime = t('common.tbd', '미정');
      let endTime = t('common.tbd', '미정');

      if (log.scheduledStartTime) {
        startTime = parseTime(log.scheduledStartTime);
      }
      if (log.scheduledEndTime) {
        endTime = parseTime(log.scheduledEndTime);
      }

      // 근무 시간 계산
      let workHours = 0;
      try {
        workHours = calculateWorkHours(log as any);
      } catch (error) {
        logger.error(
          '근무 시간 계산 오류:',
          error instanceof Error ? error : new Error(String(error))
        );
      }

      return [
        {
          date: dateStr,
          dayName,
          role: log.role || '',
          startTime,
          endTime,
          workHours: workHours.toFixed(1),
          status: log.status || 'not_started',
        },
      ];
    } catch (error) {
      logger.error(
        '근무 내역 파싱 오류:',
        error instanceof Error ? error : new Error(String(error))
      );
      return [
        {
          date: t('common.error', '오류'),
          dayName: '',
          role: log.role || '',
          startTime: t('common.tbd', '미정'),
          endTime: t('common.tbd', '미정'),
          workHours: '0.0',
          status: 'not_started',
        },
      ];
    }
    // getTargetWorkLog는 schedule과 workLogs에 의존하므로 추가 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, workLogs]);

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
        📅 {t('workInfo.workHistory', '근무 내역')}
      </h4>
      {workHistory.length > 0 ? (
        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.date', '날짜')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.role', '역할')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('workInfo.startTime', '시작시간')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('workInfo.endTime', '종료시간')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('workInfo.workHours', '근무시간')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                            : history.role === 'dealer'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                              : history.role === 'manager'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
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
                      {history.workHours}
                      {t('common.hourUnit', '시간')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          history.status === 'checked_out'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : history.status === 'checked_in'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                              : history.status === 'not_started'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {history.status === 'checked_out'
                          ? t('attendance.status.checkedOut', '퇴근')
                          : history.status === 'checked_in'
                            ? t('attendance.status.checkedIn', '출근')
                            : history.status === 'not_started'
                              ? t('attendance.status.scheduled', '예정')
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
                {t('workInfo.totalWorkHours', '총 근무시간')}
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {workHistory.reduce((sum, h) => sum + parseFloat(h.workHours), 0).toFixed(1)}
                {t('common.hourUnit', '시간')}
              </span>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('workInfo.totalDaysWorked', '총 {{count}}일 근무', { count: workHistory.length })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm">{t('workInfo.noWorkHistory', '근무 내역이 없습니다.')}</p>
        </div>
      )}
    </div>
  );
};

// React.memo로 래핑하여 불필요한 리렌더링 방지
export default React.memo(WorkInfoTab);
