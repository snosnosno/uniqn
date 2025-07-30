import React from 'react';

import { StaffData } from '../hooks/useStaffManagement';
import StaffCard from './StaffCard';

interface StaffDateGroupMobileProps {
  date: string;
  staffList: StaffData[];
  isExpanded: boolean;
  onToggleExpansion: (date: string) => void;
  onEditWorkTime: (staffId: string, timeType?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  getStaffAttendanceStatus: (staffId: string) => any;
  attendanceRecords: any[];
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  selectedStaff?: Set<string>;
  onStaffSelect?: (staffId: string) => void;
  multiSelectMode?: boolean;
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
  getStaffWorkLog?: (staffId: string, date: string) => any | null;
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

  // 출석 상태별 통계
  const attendanceStats = staffList.reduce((acc, staff) => {
    const record = getStaffAttendanceStatus(staff.id);
    const status = record?.status || 'not_started';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checked_in': return '✅';
      case 'checked_out': return '🏁';
      default: return '⏰';
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
                    <div className="text-lg font-bold">{date}</div>
                    <div className="text-sm text-blue-100">
                      {(() => {
                        try {
                          // yy-MM-dd(요일) 형식에서 날짜 부분과 요일 추출
                          if (date.includes('(') && date.includes(')')) {
                            // 이미 요일이 포함된 경우 (예: "25-07-25(금)")
                            const dayMatch = date.match(/\((.+)\)/);
                            if (dayMatch && dayMatch[1]) {
                              const dayChar = dayMatch[1];
                              const dayMap: { [key: string]: string } = {
                                '일': '일요일',
                                '월': '월요일', 
                                '화': '화요일',
                                '수': '수요일',
                                '목': '목요일',
                                '금': '금요일',
                                '토': '토요일'
                              };
                              return dayMap[dayChar] || dayChar;
                            }
                          }
                          
                          // yy-MM-dd 형식에서 날짜 부분 추출하여 요일 계산
                          const dateMatch = date.match(/(\d{2})-(\d{2})-(\d{2})/);
                          if (dateMatch) {
                            const [, year, month, day] = dateMatch;
                            if (!year || !month || !day) return '';
                            const fullYear = 2000 + parseInt(year);
                            const dateObj = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                            return dateObj.toLocaleDateString('ko-KR', { 
                              weekday: 'long' 
                            });
                          }
                          return '';
                        } catch (error) {
                          console.error('요일 계산 오류:', error);
                          return '';
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
              
              {multiSelectMode && selectedCount > 0 && (
                <div className="bg-yellow-400 bg-opacity-90 rounded-full px-3 py-1">
                  <span className="text-yellow-900 text-sm font-medium">
                    {selectedCount}개 선택
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 출석 현황 요약 */}
            <div className="flex items-center space-x-1">
              {Object.entries(attendanceStats).map(([status, count]) => (
                <div key={status} className="flex items-center space-x-1 bg-white bg-opacity-20 rounded-full px-2 py-1">
                  <span className="text-sm">{getStatusIcon(status)}</span>
                  <span className="text-white text-xs font-medium">{count}</span>
                </div>
              ))}
            </div>
            
            {/* 확장/축소 아이콘 */}
            <div className="text-white">
              <svg className={`w-6 h-6 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
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