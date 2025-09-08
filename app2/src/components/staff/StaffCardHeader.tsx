import React from 'react';

interface StaffCardHeaderProps {
  name: string;
  role?: string;
  assignedRole?: string;
  date?: string;
  showDate?: boolean;
  multiSelectMode?: boolean;
  onShowProfile?: (staffId: string) => void;
  staffId: string;
}

const StaffCardHeader: React.FC<StaffCardHeaderProps> = React.memo(({
  name,
  role,
  assignedRole,
  date,
  showDate = false,
  multiSelectMode = false,
  onShowProfile,
  staffId
}) => {
  const displayName = name || '이름 미정';
  const roleDisplay = assignedRole || role || '역할 미정';
  
  // 날짜 포맷팅 (08-08(금) 형식)
  const formatDateShort = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
      const weekDay = weekDays[d.getDay()];
      return `${month}-${day}(${weekDay})`;
    } catch {
      return dateStr;
    }
  };
  
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onShowProfile && !multiSelectMode) {
              onShowProfile(staffId);
            }
          }}
          disabled={multiSelectMode}
          className={`inline-flex items-center gap-2 text-lg font-bold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-all duration-200 ${
            multiSelectMode 
              ? 'cursor-not-allowed opacity-50' 
              : 'hover:bg-gray-200 hover:border-gray-300'
          }`}
        >
          <span>{displayName}</span>
          <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-medium">
            {roleDisplay}
          </span>
        </button>
        
        {showDate && date && (
          <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 font-medium">
            {formatDateShort(date)}
          </span>
        )}
      </div>
    </div>
  );
});

StaffCardHeader.displayName = 'StaffCardHeader';

export default StaffCardHeader;