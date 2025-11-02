import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StaffFilters as StaffFiltersType } from '../../hooks/useStaffManagement';

interface StaffFiltersMobileProps {
  filters: StaffFiltersType;
  onFiltersChange: (filters: StaffFiltersType) => void;
  availableDates: string[];
  availableRoles: string[];
  groupByDate: boolean;
  onGroupByDateChange: (value: boolean) => void;
  onQRCodeClick: () => void;
  totalStaffCount: number;
  filteredStaffCount: number;
  multiSelectMode?: boolean;
  onMultiSelectToggle?: () => void;
  selectedCount?: number;
  onBulkActions?: () => void;
}

const StaffFiltersMobile: React.FC<StaffFiltersMobileProps> = ({
  filters,
  onFiltersChange,
  availableDates,
  availableRoles,
  groupByDate,
  onGroupByDateChange,
  onQRCodeClick,
  totalStaffCount,
  filteredStaffCount,
  multiSelectMode = false,
  onMultiSelectToggle,
  selectedCount = 0,
  onBulkActions
}) => {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, searchTerm: value });
  };

  const handleDateChange = (value: string) => {
    onFiltersChange({ ...filters, selectedDate: value });
  };

  const handleRoleChange = (value: string) => {
    onFiltersChange({ ...filters, selectedRole: value });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, selectedStatus: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      searchTerm: '',
      selectedDate: 'all',
      selectedRole: 'all',
      selectedStatus: 'all'
    });
  };

  const hasActiveFilters = filters.searchTerm || 
    filters.selectedDate !== 'all' || 
    filters.selectedRole !== 'all' || 
    filters.selectedStatus !== 'all';

  return (
    <div className="mb-4 space-y-4">
      {/* 상단 통계 및 모드 전환 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <div className="font-medium">
            총 {totalStaffCount}명의 스태프
          </div>
          {hasActiveFilters && filteredStaffCount !== totalStaffCount && (
            <div className="text-blue-600 dark:text-blue-400">
              필터링된 결과: {filteredStaffCount}명
            </div>
          )}
          {multiSelectMode && selectedCount > 0 && (
            <div className="text-purple-600 dark:text-purple-400 font-medium">
              {selectedCount}명 선택됨
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 다중 선택 모드 토글 */}
          {onMultiSelectToggle && (
            <button
              onClick={onMultiSelectToggle}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                multiSelectMode
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                  : 'bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 dark:border-gray-600'
              }`}
            >
              {multiSelectMode ? '선택 모드' : '선택 모드'}
            </button>
          )}
          
          {/* 필터 토글 버튼 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 검색바 */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="스태프 이름, 역할, 연락처로 검색..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
          value={filters.searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {filters.searchTerm && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 확장 가능한 필터 섹션 */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">필터 옵션</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                전체 초기화
              </button>
            )}
          </div>

          {/* 필터 컨트롤들 */}
          <div className="grid grid-cols-1 gap-4">
            {/* 날짜 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">날짜</label>
              <select
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
              >
                <option value="all">모든 날짜</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>
                    {date === '날짜 미정' ? '날짜 미정' : date}
                  </option>
                ))}
              </select>
            </div>

            {/* 역할 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">역할</label>
              <select
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.selectedRole}
                onChange={(e) => handleRoleChange(e.target.value)}
              >
                <option value="all">모든 역할</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* 상태 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">출석 상태</label>
              <select
                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={filters.selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="all">모든 상태</option>
                <option value="present">출석</option>
                <option value="late">지각</option>
                <option value="early_leave">조퇴</option>
              </select>
            </div>
          </div>

          {/* 표시 옵션 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">표시 옵션</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-200">날짜별 그룹화</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupByDate}
                    onChange={(e) => onGroupByDateChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-gray-200 after:border-gray-300 dark:border-gray-600 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼들 */}
      <div className="flex flex-col space-y-2">
        {multiSelectMode && selectedCount > 0 && onBulkActions && (
          <button
            onClick={onBulkActions}
            className="w-full py-3 bg-purple-600 dark:bg-purple-700 text-white rounded-xl font-medium hover:bg-purple-700 dark:hover:bg-purple-800 transition-colors"
          >
            선택된 {selectedCount}명 일괄 작업
          </button>
        )}
        
        <button
          onClick={onQRCodeClick}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12V8H8v4h4z" />
          </svg>
          <span>{t('attendance.actions.generateQR')}</span>
        </button>
      </div>

      {/* 활성 필터 태그 */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.searchTerm && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              검색: "{filters.searchTerm}"
              <button
                onClick={() => handleSearchChange('')}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          )}
          {filters.selectedDate !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900/30 text-green-800">
              날짜: {filters.selectedDate}
              <button
                onClick={() => handleDateChange('all')}
                className="ml-2 text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </span>
          )}
          {filters.selectedRole !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              역할: {filters.selectedRole}
              <button
                onClick={() => handleRoleChange('all')}
                className="ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
              >
                ×
              </button>
            </span>
          )}
          {filters.selectedStatus !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
              상태: {filters.selectedStatus}
              <button
                onClick={() => handleStatusChange('all')}
                className="ml-2 text-orange-600 hover:text-orange-800"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffFiltersMobile;