import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

import { StaffData } from '../../hooks/useStaffManagement';
import { AttendanceRecord } from '../../hooks/useAttendanceStatus';
import { UnifiedWorkLog } from '../../types/unified/workLog';
import StaffCard from './StaffCard';

interface VirtualizedStaffListProps {
  staffList: StaffData[];
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => AttendanceRecord | undefined;
  attendanceRecords: AttendanceRecord[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate?: boolean;
  multiSelectMode?: boolean;
  selectedStaff?: Set<string>;
  onStaffSelect?: (staffId: string) => void;
  height?: number; // 리스트 높이
  itemHeight?: number; // 각 아이템 높이
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  canEdit?: boolean;
  getStaffWorkLog?: (staffId: string, date: string) => UnifiedWorkLog | null;
}

interface ItemData {
  staffList: StaffData[];
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => AttendanceRecord | undefined;
  attendanceRecords: AttendanceRecord[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  showDate: boolean;
  multiSelectMode: boolean;
  selectedStaff: Set<string>;
  onStaffSelect?: (staffId: string) => void;
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  canEdit?: boolean;
  getStaffWorkLog?: (staffId: string, date: string) => UnifiedWorkLog | null;
}

// 메모이제이션된 리스트 아이템 컴포넌트
const VirtualizedStaffItem: React.FC<{
  index: number;
  style: React.CSSProperties;
  data: ItemData;
}> = React.memo(({ index, style, data }) => {
  const {
    staffList,
    onEditWorkTime,
    onDeleteStaff,
    getStaffAttendanceStatus,
    attendanceRecords,
    formatTimeDisplay,
    getTimeSlotColor,
    showDate,
    multiSelectMode,
    selectedStaff,
    onStaffSelect,
    onShowProfile,
    eventId,
    canEdit,
    getStaffWorkLog
  } = data;

  const staff = staffList[index];
  
  if (!staff) {
    return <div style={style} />;
  }

  return (
    <div style={{ ...style, padding: '4px 0' }}>
      <StaffCard
        staff={staff}
        onEditWorkTime={onEditWorkTime}
        onDeleteStaff={onDeleteStaff}
        getStaffAttendanceStatus={getStaffAttendanceStatus}
        attendanceRecords={attendanceRecords}
        formatTimeDisplay={formatTimeDisplay}
        getTimeSlotColor={getTimeSlotColor}
        showDate={showDate}
        isSelected={multiSelectMode ? selectedStaff.has(staff.id) : false}
        {...(multiSelectMode && onStaffSelect && { onSelect: onStaffSelect })}
        {...(onShowProfile && { onShowProfile })}
        {...(eventId && { eventId })}
        canEdit={!!canEdit}
        {...(getStaffWorkLog && { getStaffWorkLog })}
      />
    </div>
  );
});

VirtualizedStaffItem.displayName = 'VirtualizedStaffItem';

const VirtualizedStaffList: React.FC<VirtualizedStaffListProps> = ({
  staffList,
  onEditWorkTime,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  showDate = true,
  multiSelectMode = false,
  selectedStaff = new Set(),
  onStaffSelect,
  height = 600,
  itemHeight = 200,
  onShowProfile,
  eventId,
  canEdit,
  getStaffWorkLog
}) => {
  // 메모이제이션된 아이템 데이터
  const itemData = useMemo((): ItemData => ({
    staffList,
    onEditWorkTime,
    onDeleteStaff,
    getStaffAttendanceStatus,
    attendanceRecords,
    formatTimeDisplay,
    getTimeSlotColor,
    showDate: showDate || false,
    multiSelectMode: multiSelectMode || false,
    selectedStaff: selectedStaff || new Set(),
    ...(onStaffSelect && { onStaffSelect }),
    ...(onShowProfile && { onShowProfile }),
    ...(eventId && { eventId }),
    canEdit: canEdit || false,
    ...(getStaffWorkLog && { getStaffWorkLog })
  }), [
    staffList,
    onEditWorkTime,
    onDeleteStaff,
    getStaffAttendanceStatus,
    attendanceRecords,
    formatTimeDisplay,
    getTimeSlotColor,
    showDate,
    multiSelectMode,
    selectedStaff,
    onStaffSelect,
    onShowProfile,
    eventId,
    canEdit,
    getStaffWorkLog
  ]);

  // 스태프 리스트가 비어있는 경우
  if (staffList.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-600">표시할 스태프가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <List
        height={Math.min(height, staffList.length * itemHeight)}
        width="100%"
        itemCount={staffList.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={5} // 성능 최적화를 위한 오버스캔
      >
        {VirtualizedStaffItem}
      </List>
    </div>
  );
};

export default VirtualizedStaffList;