import React from 'react';

interface StaffCardTimeSectionProps {
  displayStartTime: string;
  displayEndTime: string;
  startTimeColor: string;
  endTimeColor: string;
  isScheduledTimeTBD: boolean;
  hasEndTime: boolean;
  canEdit: boolean;
  multiSelectMode: boolean;
  onEditWorkTime: (staffId: string, type: 'start' | 'end') => void;
  staffId: string;
}

const StaffCardTimeSection: React.FC<StaffCardTimeSectionProps> = React.memo(({
  displayStartTime,
  displayEndTime,
  startTimeColor,
  endTimeColor,
  isScheduledTimeTBD,
  hasEndTime,
  canEdit,
  multiSelectMode,
  onEditWorkTime,
  staffId
}) => {
  return (
    <div className="flex flex-col space-y-1 mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canEdit && !multiSelectMode) {
            onEditWorkTime(staffId, 'start');
          }
        }}
        disabled={!canEdit || multiSelectMode}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${startTimeColor} ${
          canEdit && !multiSelectMode ? 'hover:opacity-80' : 'opacity-50 cursor-not-allowed'
        } transition-opacity`}
      >
        {isScheduledTimeTBD ? '📋' : '🕘'} 출근: {displayStartTime}
      </button>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canEdit && !multiSelectMode) {
            onEditWorkTime(staffId, 'end');
          }
        }}
        disabled={!canEdit || multiSelectMode}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-opacity ${
          canEdit && !multiSelectMode
            ? `hover:opacity-80 ${endTimeColor}`
            : 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
        }`}
        title={!canEdit ? "수정 권한이 없습니다" : multiSelectMode ? "다중 선택 모드에서는 시간을 수정할 수 없습니다" : "예정 퇴근시간 수정"}
      >
        {hasEndTime ? '🕕' : '⏳'} 퇴근: {displayEndTime}
      </button>
    </div>
  );
});

StaffCardTimeSection.displayName = 'StaffCardTimeSection';

export default StaffCardTimeSection;