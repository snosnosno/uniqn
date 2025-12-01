import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { ClockIcon, SaveIcon, TimesIcon, UsersIcon, CalendarIcon } from '../Icons';
import { doc, Timestamp, writeBatch } from 'firebase/firestore';

import { db } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import { parseToDate } from '../../utils/jobPosting/dateUtils';
import Modal, { ModalFooter } from '../ui/Modal';
import { toISODateString } from '../../utils/dateUtils';
import { handleFirebaseError, isPermissionDenied, FirebaseError } from '../../utils/firebaseErrors';

interface SelectedStaff {
  id: string;
  name: string;
  assignedDate?: string;
  assignedTime?: string;
  workLogId?: string;
}

interface WorkLogUpdateData {
  [key: string]: Timestamp | string | null | undefined;
  updatedAt: Timestamp;
  scheduledStartTime?: Timestamp | null;
  scheduledEndTime?: Timestamp | null;
  status?: 'not_started' | 'checked_in' | 'checked_out';
}

interface BulkTimeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStaff: SelectedStaff[];
  eventId: string;
  onComplete?: () => void;
}

const BulkTimeEditModal: React.FC<BulkTimeEditModalProps> = ({
  isOpen,
  onClose,
  selectedStaff,
  eventId,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const [isUpdating, setIsUpdating] = useState(false);
  const [editMode, setEditMode] = useState<'time' | 'status'>('time');

  // 시간 설정 상태
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('');
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');

  // 출석 상태 설정
  const [attendanceStatus, setAttendanceStatus] = useState<
    'not_started' | 'checked_in' | 'checked_out'
  >('not_started');

  // 유효성 검사 상태
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 시간과 분 옵션 생성
  const generateHourOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      options.push({
        value: hour.toString().padStart(2, '0'),
        label: t('common.hourSuffix', '{{hour}}시', { hour: hour.toString().padStart(2, '0') }),
      });
    }
    return options;
  };

  const generateMinuteOptions = () => {
    const options = [];
    for (let minute = 0; minute < 60; minute += 5) {
      options.push({
        value: minute.toString().padStart(2, '0'),
        label: t('common.minuteSuffix', '{{minute}}분', {
          minute: minute.toString().padStart(2, '0'),
        }),
      });
    }
    return options;
  };

  const hourOptions = generateHourOptions();
  const minuteOptions = generateMinuteOptions();

  // 시간 문자열 결합
  const combineTime = (hour: string, minute: string) => {
    if (hour && minute) {
      return `${hour}:${minute}`;
    }
    return '';
  };

  // 시간 문자열을 Timestamp로 변환
  const parseTimeString = (
    timeString: string,
    baseDate: Date,
    isEndTime = false,
    startTimeString = ''
  ) => {
    if (!timeString) return null;

    try {
      const timeParts = timeString.split(':').map(Number);
      if (timeParts.length !== 2) {
        logger.error('Invalid time string format:', new Error('Invalid time format'), {
          component: 'BulkTimeEditModal',
        });
        return null;
      }

      const [hours, minutes] = timeParts;

      if (
        hours === undefined ||
        minutes === undefined ||
        isNaN(hours) ||
        isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        logger.error('Invalid time string:', new Error(`Invalid time: ${timeString}`), {
          component: 'BulkTimeEditModal',
        });
        return null;
      }

      const date = new Date();
      date.setFullYear(baseDate.getFullYear());
      date.setMonth(baseDate.getMonth());
      date.setDate(baseDate.getDate());
      date.setHours(hours, minutes, 0, 0);

      // 종료 시간이 시작 시간보다 이른 경우 다음날로 설정
      if (isEndTime && startTimeString) {
        const startTimeParts = startTimeString.split(':');
        if (startTimeParts.length === 2 && startTimeParts[0]) {
          const startHour = parseInt(startTimeParts[0]);
          const endHour = hours;

          if (endHour < startHour) {
            date.setDate(date.getDate() + 1);
          }
        }
      }

      if (isNaN(date.getTime())) {
        logger.error('Invalid date created:', new Error('Invalid date'), {
          component: 'BulkTimeEditModal',
        });
        return null;
      }

      return Timestamp.fromDate(date);
    } catch (error) {
      logger.error(
        'Error parsing time string:',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'BulkTimeEditModal', data: { timeString } }
      );
      return null;
    }
  };

  // 유효성 검사
  const validateInputs = () => {
    const errors: string[] = [];

    if (editMode === 'time') {
      // 시간 편집 모드에서는 최소한 시작 시간이 있어야 함
      const startTime = combineTime(startHour, startMinute);
      const endTime = combineTime(endHour, endMinute);

      if (!startTime && !endTime) {
        errors.push(
          t(
            'validation.requiredTimeField',
            '최소한 시작 시간 또는 종료 시간 중 하나는 설정해야 합니다.'
          )
        );
      }

      // 시간 형식 검증
      if (startTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)) {
        errors.push(t('validation.invalidStartTimeFormat', '시작 시간 형식이 올바르지 않습니다.'));
      }

      if (endTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
        errors.push(t('validation.invalidEndTimeFormat', '종료 시간 형식이 올바르지 않습니다.'));
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // 일괄 업데이트 처리
  const handleBulkUpdate = async () => {
    if (!validateInputs()) {
      return;
    }

    setIsUpdating(true);

    try {
      const batch = writeBatch(db);
      const now = Timestamp.now();
      let successCount = 0;
      let errorCount = 0;
      const missingWorkLogs: string[] = [];

      for (const staff of selectedStaff) {
        try {
          const dateString = staff.assignedDate || toISODateString(new Date()) || '';
          const workLogId = staff.workLogId || `${eventId}_${staff.id}_${dateString}`;
          const workLogRef = doc(db, 'workLogs', workLogId);

          // ⚠️ WorkLog가 없거나 virtual인 경우 스킵
          if (!staff.workLogId || staff.workLogId.startsWith('virtual_')) {
            missingWorkLogs.push(staff.name);
            errorCount++;
            continue;
          }

          if (editMode === 'time') {
            // ✅ 시간 수정 모드: scheduledStartTime, scheduledEndTime만 업데이트
            const startTime = combineTime(startHour, startMinute);
            const endTime = combineTime(endHour, endMinute);
            const baseDate = parseToDate(dateString) || new Date();

            const updateData: WorkLogUpdateData = {
              updatedAt: now,
            };

            // 시간이 설정된 경우에만 업데이트
            if (startTime) {
              const parsedStartTime = parseTimeString(startTime, baseDate, false);
              if (parsedStartTime) {
                updateData.scheduledStartTime = parsedStartTime;
              }
            }

            if (endTime) {
              const parsedEndTime = parseTimeString(endTime, baseDate, true, startTime);
              if (parsedEndTime) {
                updateData.scheduledEndTime = parsedEndTime;
              }
            }

            // ✅ 무조건 update만 사용 (set 사용 금지 - 기존 필드 보존)
            batch.update(workLogRef, updateData);
          } else {
            // ✅ 출석 상태 수정 모드: status만 업데이트
            const updateData: WorkLogUpdateData = {
              status: attendanceStatus,
              updatedAt: now,
            };

            // ✅ 무조건 update만 사용 (set 사용 금지 - 기존 필드 보존)
            batch.update(workLogRef, updateData);
          }

          successCount++;
        } catch (error) {
          logger.error(
            `Error updating staff ${staff.id}:`,
            error instanceof Error ? error : new Error(String(error)),
            { component: 'BulkTimeEditModal' }
          );
          errorCount++;
        }
      }

      // 배치 커밋
      await batch.commit();

      // ✅ Firebase Functions (onWorkTimeChanged)가 자동으로 알림 생성
      // - 트리거: workLogs onUpdate
      // - 조건: scheduledStartTime 또는 scheduledEndTime 변경
      // - 수신자: 해당 workLog의 스태프
      logger.info('일괄 시간 수정 완료 - Firebase Functions가 알림 전송 예정', {
        data: {
          successCount,
          editMode,
        },
      });

      // ⚠️ WorkLog가 없는 스태프가 있으면 경고 메시지 표시
      if (missingWorkLogs.length > 0) {
        showError(
          t('toast.bulk.missingWorkLogs', {
            names: missingWorkLogs.join(', '),
            success: successCount,
            fail: errorCount,
          })
        );
      } else if (errorCount === 0) {
        // 성공 메시지를 더 구체적으로 표시
        if (editMode === 'time') {
          const startTime = combineTime(startHour, startMinute);
          const endTime = combineTime(endHour, endMinute);
          const checkInLabel = t('attendance.checkIn', '출근');
          const checkOutLabel = t('attendance.checkOut', '퇴근');
          const timeInfo = `${startTime ? `${checkInLabel}: ${startTime}` : ''}${startTime && endTime ? ' / ' : ''}${endTime ? `${checkOutLabel}: ${endTime}` : ''}`;
          showSuccess(t('toast.bulk.timeUpdateSuccess', { count: successCount, timeInfo }));
        } else {
          const statusText =
            attendanceStatus === 'not_started'
              ? t('attendance.status.notStarted', '출근 전')
              : attendanceStatus === 'checked_in'
                ? t('attendance.status.checkedIn', '출근')
                : t('attendance.status.checkedOut', '퇴근');
          showSuccess(
            t('toast.bulk.statusUpdateSuccess', { count: successCount, status: statusText })
          );
        }
      } else {
        showError(t('toast.bulk.partialError', { success: successCount, fail: errorCount }));
      }

      if (onComplete) {
        onComplete();
      }

      onClose();
    } catch (error) {
      // 🎯 Firebase Error Handling (Phase 3-2 Integration)
      if (isPermissionDenied(error)) {
        showError(t('toast.bulk.noPermission'));
        logger.error(
          '일괄 수정 권한 거부',
          error instanceof Error ? error : new Error(String(error)),
          {
            component: 'BulkTimeEditModal',
            data: { staffCount: selectedStaff.length, eventId, editMode },
          }
        );
        return;
      }

      const message = handleFirebaseError(
        error as FirebaseError,
        {
          operation: 'bulkUpdate',
          staffCount: selectedStaff.length,
          eventId,
          editMode,
          component: 'BulkTimeEditModal',
        },
        'ko'
      );

      showError(t('toast.bulk.updateFailed', { message }));
    } finally {
      setIsUpdating(false);
    }
  };

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setStartHour('');
      setStartMinute('');
      setEndHour('');
      setEndMinute('');
      setAttendanceStatus('not_started');
      setValidationErrors([]);
      setEditMode('time');
    }
  }, [isOpen]);

  const footerButtons = (
    <ModalFooter>
      <button
        onClick={onClose}
        disabled={isUpdating}
        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <TimesIcon className="w-4 h-4 mr-2" />
        {t('common.cancel', '취소')}
      </button>
      <button
        onClick={handleBulkUpdate}
        disabled={isUpdating || selectedStaff.length === 0}
        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all"
      >
        {isUpdating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
            <span>{t('common.processing', '처리 중...')}</span>
          </>
        ) : (
          <>
            <SaveIcon className="w-4 h-4 mr-2" />
            <span>
              {t('bulkEdit.updateCount', '{{count}}명 일괄 수정', { count: selectedStaff.length })}
            </span>
          </>
        )}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('bulkEdit.title', '일괄 수정')}
      size="lg"
      footer={footerButtons}
      aria-label={t('bulkEdit.title', '일괄 수정')}
    >
      <div className="space-y-6">
        {/* 선택된 스태프 정보 */}
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <UsersIcon className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="font-semibold text-lg">
              {t('bulkEdit.selectedStaff', '선택된 스태프')}
            </h3>
          </div>
          <p className="text-gray-700 dark:text-gray-200">
            {t('bulkEdit.selectedCount', '총 {{count}}명의 스태프가 선택되었습니다.', {
              count: selectedStaff.length,
            })}
          </p>
          <div className="mt-2 max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {selectedStaff.map((staff) => (
                <span
                  key={staff.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  {staff.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 수정 모드 선택 */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setEditMode('time')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                editMode === 'time'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              <ClockIcon className="w-4 h-4 inline-block mr-2" />
              {t('bulkEdit.editWorkTime', '근무 시간 수정')}
            </button>
            <button
              onClick={() => setEditMode('status')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                editMode === 'status'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4 inline-block mr-2" />
              {t('bulkEdit.editAttendance', '출석 상태 수정')}
            </button>
          </nav>
        </div>

        {/* 시간 편집 모드 */}
        {editMode === 'time' ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                ⚠️{' '}
                {t(
                  'bulkEdit.timeWarning',
                  '설정한 시간이 선택된 모든 스태프에게 동일하게 적용됩니다.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 시작 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('workTime.startTime', '시작 시간')}
                </label>
                <div className="flex space-x-2">
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('common.hour', '시')}</option>
                    {hourOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('common.minute', '분')}</option>
                    {minuteOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 종료 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('workTime.endTime', '종료 시간')}
                  <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                    ({t('common.optional', '선택사항')})
                  </span>
                </label>
                <div className="flex space-x-2">
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('common.hour', '시')}</option>
                    {hourOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('common.minute', '분')}</option>
                    {minuteOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 미리보기 */}
            {(combineTime(startHour, startMinute) || combineTime(endHour, endMinute)) && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('bulkEdit.previewTime', '적용될 시간')}
                </h4>
                <div className="text-lg font-mono dark:text-gray-100">
                  {combineTime(startHour, startMinute) || t('common.noChange', '변경 없음')} ~{' '}
                  {combineTime(endHour, endMinute) || t('common.tbd', '미정')}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 출석 상태 편집 모드 */
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                ⚠️{' '}
                {t(
                  'bulkEdit.statusWarning',
                  '선택한 출석 상태가 모든 스태프에게 동일하게 적용됩니다.'
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                {t('bulkEdit.selectStatus', '출석 상태 선택')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    value="not_started"
                    checked={attendanceStatus === 'not_started'}
                    onChange={(e) =>
                      setAttendanceStatus(
                        e.target.value as 'not_started' | 'checked_in' | 'checked_out'
                      )
                    }
                    className="mr-3"
                  />
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full mr-2"></div>
                    <span className="font-medium dark:text-gray-100">
                      {t('attendance.status.notStarted', '출근 전')}
                    </span>
                  </div>
                </label>

                <label className="flex items-center p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    value="checked_in"
                    checked={attendanceStatus === 'checked_in'}
                    onChange={(e) =>
                      setAttendanceStatus(
                        e.target.value as 'not_started' | 'checked_in' | 'checked_out'
                      )
                    }
                    className="mr-3"
                  />
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 dark:bg-green-600 rounded-full mr-2"></div>
                    <span className="font-medium">{t('attendance.status.checkedIn', '출근')}</span>
                  </div>
                </label>

                <label className="flex items-center p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    value="checked_out"
                    checked={attendanceStatus === 'checked_out'}
                    onChange={(e) =>
                      setAttendanceStatus(
                        e.target.value as 'not_started' | 'checked_in' | 'checked_out'
                      )
                    }
                    className="mr-3"
                  />
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-2"></div>
                    <span className="font-medium dark:text-gray-100">
                      {t('attendance.status.checkedOut', '퇴근')}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 유효성 검사 오류 */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">
              {t('common.error', '오류')}
            </h4>
            <ul className="list-disc list-inside text-red-700 dark:text-red-400 space-y-1">
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkTimeEditModal;
