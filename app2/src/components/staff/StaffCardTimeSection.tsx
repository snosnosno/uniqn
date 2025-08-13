import React from 'react';

interface StaffCardTimeSectionProps {
  displayStartTime: string;
  displayEndTime: string;
  startTimeColor: string;
  endTimeColor: string;
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
  canEdit,
  multiSelectMode,
  onEditWorkTime,
  staffId
}) => {
  return (
    <div className="flex flex-row sm:flex-col gap-2 sm:gap-1 mt-2 sm:mt-2">
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
        } transition-opacity whitespace-nowrap`}
      >
        <span>출근: {displayStartTime}</span>
      </button>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canEdit && !multiSelectMode) {
            onEditWorkTime(staffId, 'end');
          }
        }}
        disabled={!canEdit || multiSelectMode}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-opacity whitespace-nowrap ${
          canEdit && !multiSelectMode
            ? `hover:opacity-80 ${endTimeColor}`
            : 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
        }`}
        title={!canEdit ? "수정 권한이 없습니다" : multiSelectMode ? "다중 선택 모드에서는 시간을 수정할 수 없습니다" : "예정 퇴근시간 수정"}
      >
        <span>퇴근: {displayEndTime}</span>
      </button>
    </div>
  );
});

StaffCardTimeSection.displayName = 'StaffCardTimeSection';

export default StaffCardTimeSection;