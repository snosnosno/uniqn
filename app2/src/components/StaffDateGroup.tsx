import React from 'react';

import { StaffData } from '../hooks/useStaffManagement';
import StaffRow from './StaffRow';

interface StaffDateGroupProps {
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
  onShowProfile?: (staffId: string) => void;
  eventId?: string;
}

const StaffDateGroup: React.FC<StaffDateGroupProps> = ({
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
  onShowProfile,
  eventId
}) => {
  // const { t } = useTranslation(); // 현재 미사용
  const staffCount = staffList.length;

  const handleHeaderClick = () => {
    onToggleExpansion(date);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* 날짜 헤더 */}
      <div 
        className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
        onClick={handleHeaderClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-lg font-semibold text-gray-900">
              {date === '날짜 미정' ? (
                <span className="text-gray-500">📅 날짜 미정</span>
              ) : (
                <span>📅 {date}</span>
              )}
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {staffCount}명
            </div>
          </div>
          <div className="text-gray-400">
            {isExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
      </div>
      
      {/* 스태프 리스트 */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  출근
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  퇴근
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  역할
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  연락처
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  출석
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffList.map((staff) => (
                <StaffRow
                  key={staff.id}
                  staff={staff}
                  onEditWorkTime={onEditWorkTime}
                  onDeleteStaff={onDeleteStaff}
                  getStaffAttendanceStatus={getStaffAttendanceStatus}
                  attendanceRecords={attendanceRecords}
                  formatTimeDisplay={formatTimeDisplay}
                  getTimeSlotColor={getTimeSlotColor}
                  onShowProfile={onShowProfile}
                  eventId={eventId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StaffDateGroup;