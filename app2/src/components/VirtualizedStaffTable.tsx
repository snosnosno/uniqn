import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

import { StaffData } from '../hooks/useStaffManagement';
import { useCachedFormatDate, useCachedTimeDisplay, useCachedTimeSlotColor } from '../hooks/useCachedFormatDate';
import { getExceptionIcon, getExceptionSeverity } from '../utils/attendanceExceptionUtils';
import AttendanceStatusCard from './AttendanceStatusCard';

interface VirtualizedStaffTableProps {
  staffList: StaffData[];
  onEditWorkTime: (staffId: string) => void;
  onExceptionEdit: (staffId: string) => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate?: boolean;
  height?: number;
  rowHeight?: number;
}

interface ItemData {
  staffList: StaffData[];
  onEditWorkTime: (staffId: string) => void;
  onExceptionEdit: (staffId: string) => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate: boolean;
}

// 가상화된 테이블 행 컴포넌트 (StaffRow 로직을 인라인으로 구현)
const VirtualizedTableRow: React.FC<{
  index: number;
  style: React.CSSProperties;
  data: ItemData;
}> = React.memo(({ index, style, data }) => {
  const {
    staffList,
    onEditWorkTime,
    onExceptionEdit,
    onDeleteStaff,
    getStaffAttendanceStatus,
    attendanceRecords,
    formatTimeDisplay,
    getTimeSlotColor,
    showDate
  } = data;

  const staff = staffList[index];
  
  // 메모이제이션된 포맷팅 (항상 호출하되 결과는 조건부로 사용)
  const formattedDate = useCachedFormatDate(staff?.assignedDate);
  const formattedTime = useCachedTimeDisplay(staff?.assignedTime, formatTimeDisplay);
  const timeSlotColor = useCachedTimeSlotColor(staff?.assignedTime, getTimeSlotColor);
  
  if (!staff) {
    return <div style={style} />;
  }

  // 스태프 데이터
  const displayName = staff.name || '이름 미정';
  const avatarInitial = (staff.name || 'U').charAt(0).toUpperCase();
  const roleDisplay = staff.assignedRole || staff.role || '역할 미정';
  const hasContact = !!(staff.phone || staff.email);

  // 출석 데이터
  const attendanceRecord = getStaffAttendanceStatus(staff.id);
  const exceptionRecord = attendanceRecords.find(r => r.staffId === staff.id);
  const hasException = !!(exceptionRecord?.workLog?.exception);
  const exceptionType = exceptionRecord?.workLog?.exception?.type;
  const exceptionSeverity = exceptionRecord?.workLog?.exception ? 
    getExceptionSeverity(exceptionRecord.workLog.exception.type) : null;

  return (
    <div style={style} className="flex w-full border-b border-gray-200 hover:bg-gray-50 transition-colors">
      {/* 시간 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${timeSlotColor}`}>
          ⏰ {formattedTime}
        </div>
      </div>
      
      {/* 이름 열 */}
      <div className="px-4 py-4 flex-1 min-w-0 flex items-center">
        <div className="flex-shrink-0 h-8 w-8">
          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
            {avatarInitial}
          </div>
        </div>
        <div className="ml-3 min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 truncate">
            {displayName}
          </div>
          {showDate && staff.assignedDate && (
            <div className="text-sm text-gray-500 truncate">
              📅 {formattedDate}
            </div>
          )}
        </div>
      </div>
      
      {/* 역할 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        <div className="text-sm text-gray-900 truncate">{roleDisplay}</div>
      </div>
      
      {/* 연락처 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-40">
        <div className="text-sm text-gray-900 space-y-1">
          {staff.phone && (
            <div className="flex items-center">
              <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <a href={`tel:${staff.phone}`} className="text-blue-600 hover:text-blue-800 transition-colors truncate">
                {staff.phone}
              </a>
            </div>
          )}
          {staff.email && (
            <div className="flex items-center">
              <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <a href={`mailto:${staff.email}`} className="text-blue-600 hover:text-blue-800 transition-colors truncate">
                {staff.email.length > 15 ? `${staff.email.substring(0, 15)}...` : staff.email}
              </a>
            </div>
          )}
          {!hasContact && (
            <span className="text-gray-400 text-xs">연락처 없음</span>
          )}
        </div>
      </div>
      
      {/* 출석 상태 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-32">
        {attendanceRecord ? (
          <AttendanceStatusCard
            status={attendanceRecord.status}
            checkInTime={attendanceRecord.checkInTime}
            checkOutTime={attendanceRecord.checkOutTime}
            size="sm"
          />
        ) : (
          <AttendanceStatusCard status="not_started" size="sm" />
        )}
      </div>
      
      {/* 예외 상황 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-24">
        {hasException ? (
          <div className="flex items-center gap-1">
            <span className={`text-${exceptionSeverity === 'high' ? 'red' : exceptionSeverity === 'medium' ? 'yellow' : 'orange'}-500`}>
              {getExceptionIcon(exceptionType!)}
            </span>
            <span className="text-xs text-gray-600 truncate">
              {exceptionType}
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">정상</span>
        )}
      </div>
      
      {/* 작업 열 */}
      <div className="px-4 py-4 flex-shrink-0 w-40">
        <div className="flex space-x-1">
          <button
            onClick={() => onEditWorkTime(staff.id)}
            className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            title="시간 수정"
          >
            시간
          </button>
          <button
            onClick={() => onExceptionEdit(staff.id)}
            className="px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors"
            title="예외 상황 처리"
          >
            예외
          </button>
          <button
            onClick={() => onDeleteStaff(staff.id)}
            className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            title="스태프 삭제"
          >
            삭제
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
  onExceptionEdit,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  showDate = true,
  height = 600,
  rowHeight = 80
}) => {
  const itemData = useMemo((): ItemData => ({
    staffList,
    onEditWorkTime,
    onExceptionEdit,
    onDeleteStaff,
    getStaffAttendanceStatus,
    attendanceRecords,
    formatTimeDisplay,
    getTimeSlotColor,
    showDate
  }), [
    staffList,
    onEditWorkTime,
    onExceptionEdit,
    onDeleteStaff,
    getStaffAttendanceStatus,
    attendanceRecords,
    formatTimeDisplay,
    getTimeSlotColor,
    showDate
  ]);

  if (staffList.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-600">표시할 스태프가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* 테이블 헤더 */}
      <div className="flex w-full bg-gray-50 border-b border-gray-200">
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          시간
        </div>
        <div className="px-4 py-3 flex-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          이름
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          역할
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-40 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          연락처
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-32 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          출석
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-24 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          예외
        </div>
        <div className="px-4 py-3 flex-shrink-0 w-40 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          작업
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