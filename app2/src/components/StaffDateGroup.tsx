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
  canEdit?: boolean;
  getStaffWorkLog?: (staffId: string, date: string) => any | null;
  applyOptimisticUpdate?: (workLogId: string, newStatus: any) => void;
  multiSelectMode?: boolean;
  selectedStaff?: Set<string>;
  onStaffSelect?: (staffId: string, event?: React.MouseEvent) => void;
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
  eventId,
  canEdit = true,
  getStaffWorkLog,
  applyOptimisticUpdate,
  multiSelectMode = false,
  selectedStaff = new Set(),
  onStaffSelect
}) => {
  const staffCount = staffList.length;
  const selectedInGroup = staffList.filter(staff => selectedStaff.has(staff.id)).length;

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
            {multiSelectMode && selectedInGroup > 0 && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {selectedInGroup}명 선택
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {multiSelectMode && isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onStaffSelect) {
                    staffList.forEach(staff => {
                      if (selectedInGroup === staffList.length) {
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
                }}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {selectedInGroup === staffList.length ? '선택 해제' : '전체 선택'}
              </button>
            )}
            <div>
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
      </div>
      
      {/* 스태프 리스트 */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {multiSelectMode && (
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={staffList.every(staff => selectedStaff.has(staff.id)) && staffList.length > 0}
                      onChange={(e) => {
                        if (onStaffSelect) {
                          staffList.forEach(staff => {
                            if (e.target.checked && !selectedStaff.has(staff.id)) {
                              onStaffSelect(staff.id);
                            } else if (!e.target.checked && selectedStaff.has(staff.id)) {
                              onStaffSelect(staff.id);
                            }
                          });
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      aria-label="이 그룹 전체 선택"
                    />
                  </th>
                )}
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
                  canEdit={canEdit}
                  getStaffWorkLog={getStaffWorkLog}
                  applyOptimisticUpdate={applyOptimisticUpdate}
                  multiSelectMode={multiSelectMode}
                  isSelected={selectedStaff.has(staff.id)}
                  onSelect={onStaffSelect}
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