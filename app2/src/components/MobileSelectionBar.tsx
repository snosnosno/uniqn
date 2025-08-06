import React from 'react';
import Button from './common/Button';

interface MobileSelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkEdit: () => void;
  onBulkStatusChange: () => void;
  onCancel: () => void;
  isAllSelected: boolean;
}

const MobileSelectionBar: React.FC<MobileSelectionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkEdit,
  onBulkStatusChange,
  onCancel,
  isAllSelected
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 md:hidden z-50 mobile-selection-bar">
      <div className="space-y-3">
        {/* 선택 정보 및 액션 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-lg">
              {selectedCount}명 선택
            </span>
            <button
              onClick={isAllSelected ? onDeselectAll : onSelectAll}
              className="text-blue-600 text-sm font-medium"
            >
              {isAllSelected ? '전체 해제' : `전체 선택(${totalCount})`}
            </button>
          </div>
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
            aria-label="선택 취소"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* 액션 버튼 */}
        <div className="grid grid-cols-2 gap-2">
          <Button 
            size="sm" 
            variant="primary"
            onClick={onBulkEdit}
            className="flex items-center justify-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>시간 수정</span>
          </Button>
          <Button 
            size="sm" 
            variant="secondary"
            onClick={onBulkStatusChange}
            className="flex items-center justify-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>상태 변경</span>
          </Button>
        </div>
        
        {/* 대량 선택 경고 */}
        {selectedCount > 100 && (
          <div className="bulk-selection-warning text-xs text-yellow-800 flex items-start space-x-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>대량 선택으로 인해 성능이 저하될 수 있습니다.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSelectionBar;