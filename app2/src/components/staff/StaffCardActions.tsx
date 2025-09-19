import React, { useMemo } from 'react';
import { UnifiedWorkLog } from '../../types/unified/workLog';

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
  // 새로 추가된 props
  workLog?: UnifiedWorkLog | null;
  assignedDate?: string;
  onReport?: (staffId: string, staffName: string) => void;
}

const StaffCardActions: React.FC<StaffCardActionsProps> = React.memo(({
  showActions,
  setShowActions,
  workLogId: _workLogId,
  currentStatus: _currentStatus,
  staffId,
  staffName,
  eventId: _eventId,
  scheduledStartTime: _scheduledStartTime,
  scheduledEndTime: _scheduledEndTime,
  canEdit,
  multiSelectMode: _multiSelectMode,
  onEditWorkTime,
  onDeleteStaff,
  onStatusChange: _onStatusChange,
  lightImpact,
  workLog,
  assignedDate: _assignedDate,
  onReport
}) => {
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    lightImpact();
    action();
    setShowActions(false);
  };

  // 삭제 가능 여부 판단
  const canDelete = useMemo(() => {
    if (!workLog) {
      return {
        allowed: true,
        reason: undefined
      };
    }
    
    const deletableStatuses = ['scheduled', 'not_started'];
    const status = workLog.status || 'scheduled';
    
    // 이미 급여가 지급된 경우 (isPaid가 있는 경우에만 체크)
    if ('isPaid' in workLog && workLog.isPaid) {
      return {
        allowed: false,
        reason: '급여 지급 완료 후에는 삭제할 수 없습니다'
      };
    }
    
    // 상태에 따른 삭제 가능 여부
    if (!deletableStatuses.includes(status)) {
      const statusMessages: Record<string, string> = {
        'checked_in': '출근 후에는 삭제할 수 없습니다',
        'checked_out': '근무 완료 후에는 삭제할 수 없습니다',
        'completed': '근무 완료 후에는 삭제할 수 없습니다'
      };
      
      return {
        allowed: false,
        reason: statusMessages[status] || '현재 상태에서는 삭제할 수 없습니다'
      };
    }
    
    return { allowed: true, reason: undefined };
  }, [workLog]);

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

            {/* 신고 버튼 - 모든 구인자가 사용 가능 */}
            <button
              onClick={(e) => handleActionClick(e, () => onReport && onReport(staffId, staffName))}
              className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors text-orange-600 bg-orange-50 hover:bg-orange-100"
              title="스태프 신고하기"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              신고
            </button>

            <button
              onClick={(e) => handleActionClick(e, () => canEdit && canDelete.allowed && onDeleteStaff(staffId))}
              disabled={!canEdit || !canDelete.allowed}
              className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                canEdit && canDelete.allowed
                  ? 'text-red-600 bg-red-50 hover:bg-red-100'
                  : 'text-gray-400 bg-gray-50 cursor-not-allowed opacity-50'
              }`}
              title={
                !canEdit
                  ? "수정 권한이 없습니다"
                  : !canDelete.allowed
                    ? canDelete.reason
                    : "스태프 삭제"
              }
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