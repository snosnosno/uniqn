import React from 'react';

import { logger } from '../utils/logger';
import { StaffData } from '../hooks/useStaffManagement';
import StaffCard from './StaffCard';
import { UnifiedWorkLog } from '../types/unified/workLog';

interface StaffDateGroupMobileProps {
  date: string;
  staffList: StaffData[];
  isExpanded: boolean;
  onToggleExpansion: (date: string) => void;
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string, targetDate?: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  selectedStaff?: Set<string>;
  onStaffSelect?: (staffId: string) => void;
  multiSelectMode?: boolean;
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  getStaffWorkLog?: (staffId: string, date: string) => UnifiedWorkLog | null;
}

const StaffDateGroupMobile: React.FC<StaffDateGroupMobileProps> = ({
  date,
  staffList,
  isExpanded,
  onToggleExpansion,
  onEditWorkTime,
  onDeleteStaff,
  getStaffAttendanceStatus,
  attendanceRecords,
  formatTimeDisplay,
  getTimeSlotColor,
  selectedStaff = new Set(),
  onStaffSelect,
  multiSelectMode = false,
  onShowProfile,
  eventId,
  getStaffWorkLog
}) => {
  const staffCount = staffList.length;
  const selectedCount = multiSelectMode ? Array.from(selectedStaff).filter(id => 
    staffList.some(staff => staff.id === id)
  ).length : 0;

  const handleHeaderClick = () => {
    onToggleExpansion(date);
  };

  const handleGroupSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStaffSelect) {
      staffList.forEach(staff => {
        if (selectedCount === staffList.length) {
          // 모두 선택된 경우 해제
          if (selectedStaff.has(staff.id)) {
            onStaffSelect(staff.id);
          }
        } else {
          // 일부만 선택된 경우 모두 선택
          if (!selectedStaff.has(staff.id)) {
            onStaffSelect(staff.id);
          }
        }
      });
    }
  };


  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4">
      {/* 날짜 헤더 */}
      <div 
        className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-4 cursor-pointer active:from-blue-600 active:to-purple-700 transition-all duration-150"
        onClick={handleHeaderClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-white">
              {date === '날짜 미정' ? (
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📅</span>
                  <div>
                    <div className="text-lg font-bold">날짜 미정</div>
                    <div className="text-sm text-blue-100">일정 조정 필요</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📅</span>
                  <div>
                    <div className="text-lg font-bold">
                      {(() => {
                        try {
                          // yy-MM-dd 형식에서 MM-dd(요일) 형식으로 변환
                          const dateMatch = date.match(/(\d{2})-(\d{2})-(\d{2})/);
                          if (dateMatch) {
                            const [, year, month, day] = dateMatch;
                            if (!year || !month || !day) return date;
                            const fullYear = 2000 + parseInt(year);
                            const dateObj = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                            const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
                            const weekDay = weekDays[dateObj.getDay()];
                            return `${month}-${day}(${weekDay})`;
                          }
                          return date;
                        } catch (error) {
                          logger.error('날짜 형식 변환 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'StaffDateGroupMobile' });
                          return date;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 py-1">
                <span className="text-white text-sm font-medium">
                  {staffCount}명
                </span>
              </div>
              
              {multiSelectMode && (
                <>
                  {selectedCount > 0 && (
                    <div className="bg-yellow-400 bg-opacity-90 rounded-full px-3 py-1">
                      <span className="text-yellow-900 text-sm font-medium">
                        {selectedCount}개 선택
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleGroupSelect}
                    className="bg-blue-500 bg-opacity-90 rounded-full px-3 py-1 hover:bg-opacity-100 transition-opacity"
                  >
                    <span className="text-white text-sm font-medium">
                      {selectedCount === staffList.length ? '그룹 해제' : '그룹 선택'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* 확장/축소 아이콘 */}
          <div className="text-white">
            <svg className={`w-6 h-6 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* 스태프 카드 리스트 */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-gray-50">
          {staffList.map((staff) => (
            <StaffCard
              key={staff.id}
              staff={staff}
              onEditWorkTime={onEditWorkTime}
              onDeleteStaff={onDeleteStaff}
              getStaffAttendanceStatus={getStaffAttendanceStatus}
              attendanceRecords={attendanceRecords}
              formatTimeDisplay={formatTimeDisplay}
              getTimeSlotColor={getTimeSlotColor}
              showDate={false} // 그룹 헤더에 날짜가 있으므로 카드에서는 숨김
              isSelected={multiSelectMode ? selectedStaff.has(staff.id) : false}
              multiSelectMode={multiSelectMode}
              {...(multiSelectMode && onStaffSelect && { onSelect: onStaffSelect })}
              {...(onShowProfile && { onShowProfile })}
              {...(eventId && { eventId })}
              {...(getStaffWorkLog && { getStaffWorkLog })}
            />
          ))}
          
          {staffList.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">👥</div>
              <div className="text-gray-500 text-sm">이 날짜에 할당된 스태프가 없습니다</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffDateGroupMobile;