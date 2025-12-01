import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';
import { FixedSizeList as List } from 'react-window';

import { StaffData } from '../../utils/staff/staffDataTransformer';
import type { AttendanceDisplayRecord } from '../../hooks/useAttendanceStatus';
import {
  useCachedFormatDate,
  useCachedTimeDisplay,
  useCachedTimeSlotColor,
} from '../../hooks/useCachedFormatDate';
import AttendanceStatusPopover from '../attendance/AttendanceStatusPopover';
import { getTodayString, convertToDateString } from '../../utils/jobPosting/dateUtils';
import { formatTime } from '../../utils/dateUtils';

interface VirtualizedStaffTableProps {
  staffList: StaffData[];
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (
    staffId: string,
    targetDate?: string
  ) => AttendanceDisplayRecord | null;
  attendanceRecords: AttendanceDisplayRecord[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate?: boolean;
  height?: number;
  rowHeight?: number;
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  canEdit?: boolean;
}

interface ItemData {
  staffList: StaffData[];
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (
    staffId: string,
    targetDate?: string
  ) => AttendanceDisplayRecord | null;
  attendanceRecords: AttendanceDisplayRecord[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate: boolean;
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  canEdit?: boolean;
}

// 가상화된 테이블 행 컴포넌트 (StaffRow 로직을 인라인으로 구현)
const VirtualizedTableRow: React.FC<{
  index: number;
  style: React.CSSProperties;
  data: ItemData;
}> = React.memo(({ index, style, data }) => {
  const { t } = useTranslation();
  const {
    staffList,
    onEditWorkTime,
    onDeleteStaff,
    getStaffAttendanceStatus,
    attendanceRecords,
    formatTimeDisplay,
    getTimeSlotColor,
    showDate,
    onShowProfile,
  } = data;

  const staff = staffList[index];

  // 메모이제이션된 포맷팅 (항상 호출하되 결과는 조건부로 사용)
  const formattedDate = useCachedFormatDate(staff?.assignedDate);
  useCachedTimeDisplay(staff?.assignedTime, formatTimeDisplay);
  useCachedTimeSlotColor(staff?.assignedTime, getTimeSlotColor);

  // 출석 데이터 (항상 호출) - workLogId 생성하여 날짜별 구분
  const workLogId = useMemo(() => {
    if (!staff) return null;

    const dateString = convertToDateString(staff.assignedDate) || getTodayString();

    // 날짜가 제대로 파싱되었는지 확인
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      logger.warn('⚠️ VirtualizedStaffTable - assignedDate 파싱 실패:', {
        component: 'VirtualizedStaffTable',
        data: {
          staffId: staff.id,
          staffName: staff.name,
          assignedDate: staff.assignedDate,
          parsedDate: dateString,
        },
      });
    }

    const actualStaffId = staff.id.replace(/_\d+$/, '');
    return `virtual_${actualStaffId}_${dateString}`;
  }, [staff]);

  const attendanceRecord = staff && workLogId ? getStaffAttendanceStatus(workLogId) : null;
  const exceptionRecord = staff ? attendanceRecords.find((r) => r.staffId === staff.id) : null;

  // 메모이제이션된 출근/퇴근 시간 데이터 (항상 호출)
  const memoizedTimeData = useMemo(() => {
    const tbdText = t('common.tbd', '미정');
    if (!staff) {
      return {
        displayStartTime: '',
        displayEndTime: tbdText,
        startTimeColor: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
        endTimeColor: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
        hasEndTime: false,
      };
    }

    // actualStartTime/actualEndTime 사용 - Timestamp를 문자열로 변환
    const rawActualStartTime =
      exceptionRecord?.workLog?.actualStartTime || attendanceRecord?.actualStartTime;
    const actualStartTime =
      typeof rawActualStartTime === 'string'
        ? rawActualStartTime
        : rawActualStartTime
          ? formatTime(rawActualStartTime, { defaultValue: '' })
          : undefined;

    // @deprecated: assignedTime 사용, 추후 workLog.scheduledStartTime 우선 사용
    const scheduledStartTime = staff.assignedTime;

    // 출근시간 결정: 정산 목적으로 예정 시간 우선, 없으면 실제 시간
    const startTime = scheduledStartTime || actualStartTime;

    // 퇴근시간 - Timestamp를 문자열로 변환
    const rawEndTime = exceptionRecord?.workLog?.actualEndTime || attendanceRecord?.actualEndTime;
    const endTime =
      typeof rawEndTime === 'string'
        ? rawEndTime
        : rawEndTime
          ? formatTime(rawEndTime, { defaultValue: '' })
          : undefined;

    return {
      displayStartTime: formatTimeDisplay(startTime),
      displayEndTime: endTime ? formatTimeDisplay(endTime) : tbdText,
      startTimeColor: getTimeSlotColor(startTime),
      endTimeColor: endTime
        ? getTimeSlotColor(endTime)
        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
      hasEndTime: !!endTime,
      hasActualStartTime: !!actualStartTime, // 실제 출근시간이 있는지 여부
      isScheduledTimeTBD: scheduledStartTime === '미정' || scheduledStartTime === tbdText, // 예정시간이 미정인지 여부
    };
  }, [staff, attendanceRecord, exceptionRecord, formatTimeDisplay, getTimeSlotColor, t]);

  if (!staff) {
    return <div style={style} />;
  }

  // 스태프 데이터
  const displayName = staff.name || t('staff.nameTBD', '이름 미정');
  const avatarInitial = (staff.name || 'U').charAt(0).toUpperCase();
  const roleDisplay = staff.assignedRole || staff.role || t('staff.roleTBD', '역할 미정');
  const hasContact = !!(staff.phone || staff.email);

  return (
    <div
      style={style}
      className="flex w-full border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      {/* 출근 시간 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        <button
          onClick={() => onEditWorkTime(staff.id, 'start')}
          disabled={!data.canEdit}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            data.canEdit ? 'hover:opacity-80' : 'opacity-50 cursor-not-allowed'
          } ${memoizedTimeData.startTimeColor}`}
          title={
            !data.canEdit
              ? t('common.noEditPermission', '수정 권한이 없습니다')
              : memoizedTimeData.hasActualStartTime
                ? t('attendance.editActualCheckIn', '실제 출근시간 수정')
                : memoizedTimeData.isScheduledTimeTBD
                  ? t('attendance.setCheckInTime', '미정 - 출근시간 설정')
                  : t('attendance.editScheduledCheckIn', '예정 출근시간 수정')
          }
        >
          {memoizedTimeData.hasActualStartTime
            ? '✅'
            : memoizedTimeData.isScheduledTimeTBD
              ? '📋'
              : '🕘'}{' '}
          {memoizedTimeData.displayStartTime}
        </button>
      </div>

      {/* 퇴근 시간 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        <button
          onClick={() => onEditWorkTime(staff.id, 'end')}
          disabled={!data.canEdit}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            data.canEdit ? 'hover:opacity-80' : 'opacity-50 cursor-not-allowed'
          } ${memoizedTimeData.endTimeColor} ${!memoizedTimeData.hasEndTime && data.canEdit ? 'hover:bg-gray-200 dark:hover:bg-gray-600' : ''}`}
          title={
            !data.canEdit
              ? t('common.noEditPermission', '수정 권한이 없습니다')
              : t('attendance.editScheduledCheckOut', '예정 퇴근시간 수정')
          }
        >
          {memoizedTimeData.hasEndTime ? '🕕' : '⏳'} {memoizedTimeData.displayEndTime}
        </button>
      </div>

      {/* 이름 열 */}
      <div className="px-4 py-4 flex-1 min-w-0 flex items-center">
        <div className="flex-shrink-0 h-8 w-8">
          <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
            {avatarInitial}
          </div>
        </div>
        <div className="ml-3 min-w-0 flex-1">
          <button
            onClick={() => {
              if (onShowProfile) {
                onShowProfile(staff.id);
              }
            }}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 px-3 py-1 rounded-md border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-sm transition-all duration-200 text-left inline-block"
          >
            {displayName}
          </button>
          {showDate && staff.assignedDate && (
            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
              📅 {formattedDate}
            </div>
          )}
        </div>
      </div>

      {/* 역할 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{roleDisplay}</div>
      </div>

      {/* 연락처 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-40">
        <div className="text-sm text-gray-900 dark:text-gray-100 space-y-1">
          {staff.phone && (
            <div className="flex items-center">
              <svg
                className="w-3 h-3 mr-1 text-gray-400 dark:text-gray-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <a
                href={`tel:${staff.phone}`}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors truncate"
              >
                {staff.phone}
              </a>
            </div>
          )}
          {staff.email && (
            <div className="flex items-center">
              <svg
                className="w-3 h-3 mr-1 text-gray-400 dark:text-gray-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <a
                href={`mailto:${staff.email}`}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors truncate"
              >
                {staff.email.length > 15 ? `${staff.email.substring(0, 15)}...` : staff.email}
              </a>
            </div>
          )}
          {!hasContact && (
            <span className="text-gray-400 dark:text-gray-500 text-xs">
              {t('staff.noContact', '연락처 없음')}
            </span>
          )}
        </div>
      </div>

      {/* 출석 상태 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        <AttendanceStatusPopover
          workLogId={attendanceRecord?.workLogId || workLogId || ''}
          currentStatus={attendanceRecord?.status || 'not_started'}
          staffId={staff.id}
          staffName={staff.name || ''}
          eventId={data.eventId || ''}
          size="sm"
          canEdit={!!data.canEdit}
        />
      </div>

      {/* 작업 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        <div className="flex space-x-1">
          <button
            onClick={() => onDeleteStaff(staff.id)}
            disabled={!data.canEdit}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              data.canEdit
                ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
            title={
              data.canEdit
                ? t('staff.deleteStaff', '스태프 삭제')
                : t('common.noEditPermission', '수정 권한이 없습니다')
            }
          >
            {t('common.delete', '삭제')}
          </button>
        </div>
      </div>
    </div>
  );
});

VirtualizedTableRow.displayName = 'VirtualizedTableRow';

const VirtualizedStaffTable: React.FC<VirtualizedStaffTableProps> = ({
  staffList,
  onEditWorkTime,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  showDate = true,
  height = 600,
  rowHeight = 80,
  onShowProfile,
  eventId,
  canEdit = true,
}) => {
  const { t } = useTranslation();

  const itemData = useMemo(
    (): ItemData => ({
      staffList,
      onEditWorkTime,
      onDeleteStaff,
      getStaffAttendanceStatus,
      attendanceRecords,
      formatTimeDisplay,
      getTimeSlotColor,
      showDate: showDate || false,
      ...(onShowProfile && { onShowProfile }),
      ...(eventId && { eventId }),
      canEdit,
    }),
    [
      staffList,
      onEditWorkTime,
      onDeleteStaff,
      getStaffAttendanceStatus,
      attendanceRecords,
      formatTimeDisplay,
      getTimeSlotColor,
      showDate,
      onShowProfile,
      eventId,
      canEdit,
    ]
  );

  if (staffList.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center">
        <p className="text-gray-600 dark:text-gray-300">
          {t('staff.noStaffToDisplay', '표시할 스태프가 없습니다.')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* 테이블 헤더 */}
      <div className="flex w-full bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('attendance.checkIn', '출근')}
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('attendance.checkOut', '퇴근')}
        </div>
        <div className="px-4 py-3 flex-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('common.name', '이름')}
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('common.role', '역할')}
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-40 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('common.contact', '연락처')}
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('common.attendance', '출석')}
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t('common.actions', '작업')}
        </div>
      </div>

      {/* 가상화된 리스트 */}
      <List
        height={Math.min(height, staffList.length * rowHeight)}
        width="100%"
        itemCount={staffList.length}
        itemSize={rowHeight}
        itemData={itemData}
        overscanCount={10}
      >
        {VirtualizedTableRow}
      </List>
    </div>
  );
};

export default VirtualizedStaffTable;
