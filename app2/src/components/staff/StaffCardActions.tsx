import React from 'react';
import AttendanceStatusPopover from '../AttendanceStatusPopover';

type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

interface StaffCardActionsProps {
  showActions: boolean;
  setShowActions: (show: boolean) => void;
  workLogId: string;
  currentStatus: AttendanceStatus;
  staffId: string;
  staffName: string;
  eventId?: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  canEdit: boolean;
  multiSelectMode: boolean;
  onEditWorkTime: (staffId: string, type?: 'start' | 'end') => void;
  onDeleteStaff: (staffId: string) => void;
  onStatusChange?: () => void;
  lightImpact: () => void;
}

const StaffCardActions: React.FC<StaffCardActionsProps> = React.memo(({
  showActions,
  setShowActions,
  workLogId,
  currentStatus,
  staffId,
  staffName,
  eventId,
  scheduledStartTime,
  scheduledEndTime,
  canEdit,
  multiSelectMode,
  onEditWorkTime,
  onDeleteStaff,
  onStatusChange,
  lightImpact
}) => {
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    lightImpact();
    action();
    setShowActions(false);
  };

  if (!showActions) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="space-y-3">
        {/* 시간 편집 및 삭제 */}
        <div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={(e) => handleActionClick(e, () => canEdit && onEditWorkTime(staffId))}
              disabled={!canEdit}
              className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                canEdit 
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                  : 'text-gray-400 bg-gray-50 cursor-not-allowed'
              }`}
              title={!canEdit ? "수정 권한이 없습니다" : "근무 시간 수정"}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              시간
            </button>
            <button
              onClick={(e) => handleActionClick(e, () => canEdit && onDeleteStaff(staffId))}
              disabled={!canEdit}
              className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                canEdit 
                  ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                  : 'text-gray-400 bg-gray-50 cursor-not-allowed opacity-50'
              }`}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

StaffCardActions.displayName = 'StaffCardActions';

export default StaffCardActions;