import React from 'react';

interface StaffCardHeaderProps {
  name: string;
  role?: string;
  assignedRole?: string;
  date?: string;
  formattedDate?: string;
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
  formattedDate,
  showDate = false,
  multiSelectMode = false,
  onShowProfile,
  staffId
}) => {
  const displayName = name || '이름 미정';
  const roleDisplay = assignedRole || role || '역할 미정';
  
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onShowProfile && !multiSelectMode) {
              onShowProfile(staffId);
            }
          }}
          disabled={multiSelectMode}
          className={`text-lg font-semibold text-gray-900 truncate px-3 py-1 rounded-md border transition-all duration-200 text-left inline-block ${
            multiSelectMode 
              ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50' 
              : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          {displayName}
        </button>
        <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
          {roleDisplay}
        </span>
      </div>
      
      {showDate && date && (
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-sm text-gray-500">
            📅 {formattedDate || date}
          </span>
        </div>
      )}
    </div>
  );
});

StaffCardHeader.displayName = 'StaffCardHeader';

export default StaffCardHeader;