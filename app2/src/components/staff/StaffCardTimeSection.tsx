import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

interface StaffCardTimeSectionProps {
  displayStartTime: string;
  displayEndTime: string;
  startTimeColor: string;
  endTimeColor: string;
  canEdit: boolean;
  multiSelectMode: boolean;
  onEditWorkTime: (staffId: string, type?: 'start' | 'end') => void;
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
  const { isMobile } = useResponsive();
  
  // 미정 상태이거나 canEdit이 true인 경우 편집 가능
  const isTimeEditable = canEdit && !multiSelectMode;
  
  // 모바일에서는 통합 버튼, 데스크톱에서는 개별 버튼
  if (isMobile) {
    return (
      <div className="flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isTimeEditable) {
              onEditWorkTime(staffId);
            }
          }}
          disabled={!isTimeEditable}
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ${
            isTimeEditable ? 'hover:opacity-80 cursor-pointer' : 'opacity-50 cursor-not-allowed'
          } transition-opacity whitespace-nowrap`}
          title={!canEdit ? "수정 권한이 없습니다" : multiSelectMode ? "다중 선택 모드에서는 시간을 수정할 수 없습니다" : "근무 시간 수정"}
        >
          <span>시간: {displayStartTime} ~ {displayEndTime}</span>
        </button>
      </div>
    );
  }
  
  // 데스크톱에서는 기존 개별 버튼
  return (
    <div className="flex flex-row sm:flex-col gap-2 sm:gap-1 mt-2 sm:mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isTimeEditable) {
            onEditWorkTime(staffId);
          }
        }}
        disabled={!isTimeEditable}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${startTimeColor} ${
          isTimeEditable ? 'hover:opacity-80 cursor-pointer' : 'opacity-50 cursor-not-allowed'
        } transition-opacity whitespace-nowrap`}
        title={!canEdit ? "수정 권한이 없습니다" : multiSelectMode ? "다중 선택 모드에서는 시간을 수정할 수 없습니다" : "근무 시간 수정"}
      >
        <span>출근: {displayStartTime}</span>
      </button>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isTimeEditable) {
            onEditWorkTime(staffId);
          }
        }}
        disabled={!isTimeEditable}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${endTimeColor} ${
          isTimeEditable ? 'hover:opacity-80 cursor-pointer' : 'opacity-50 cursor-not-allowed'
        } transition-opacity whitespace-nowrap`}
        title={!canEdit ? "수정 권한이 없습니다" : multiSelectMode ? "다중 선택 모드에서는 시간을 수정할 수 없습니다" : "근무 시간 수정"}
      >
        <span>퇴근: {displayEndTime}</span>
      </button>
    </div>
  );
});

StaffCardTimeSection.displayName = 'StaffCardTimeSection';

export default StaffCardTimeSection;