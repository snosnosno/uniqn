import React from 'react';
import { useTranslation } from 'react-i18next';

import { StaffFilters as StaffFiltersType } from '../../hooks/useStaffManagement';

interface StaffFiltersProps {
  filters: StaffFiltersType;
  onFiltersChange: (filters: StaffFiltersType) => void;
  availableDates: string[];
  availableRoles: string[];
  groupByDate: boolean;
  onGroupByDateChange: (value: boolean) => void;
  onQRCodeClick: () => void;
  totalStaffCount: number;
  filteredStaffCount: number;
}

const StaffFilters: React.FC<StaffFiltersProps> = ({
  filters,
  onFiltersChange,
  availableDates,
  availableRoles,
  groupByDate,
  onGroupByDateChange,
  onQRCodeClick,
  totalStaffCount,
  filteredStaffCount,
}) => {
  const { t } = useTranslation();

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
      selectedStatus: 'all',
    });
  };

  const hasActiveFilters =
    filters.searchTerm ||
    filters.selectedDate !== 'all' ||
    filters.selectedRole !== 'all' ||
    filters.selectedStatus !== 'all';

  return (
    <div className="mb-6 space-y-4">
      {/* 상단 통계 */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          총 {totalStaffCount}명의 스태프
          {hasActiveFilters && filteredStaffCount !== totalStaffCount && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              (필터링된 결과: {filteredStaffCount}명)
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 필터 컨트롤 */}
      <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
        {/* 검색 */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="스태프 이름, 역할, 연락처로 검색..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={filters.searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* 날짜 필터 */}
        <div className="min-w-0 lg:w-48">
          <select
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={filters.selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
          >
            <option value="all">모든 날짜</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {date === '날짜 미정' ? '날짜 미정' : date}
              </option>
            ))}
          </select>
        </div>

        {/* 역할 필터 */}
        <div className="min-w-0 lg:w-48">
          <select
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={filters.selectedRole}
            onChange={(e) => handleRoleChange(e.target.value)}
          >
            <option value="all">모든 역할</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* 상태 필터 */}
        <div className="min-w-0 lg:w-48">
          <select
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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

      {/* 하단 컨트롤 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        {/* 그룹화 및 보기 옵션 */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="groupByDate"
              checked={groupByDate}
              onChange={(e) => onGroupByDateChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label
              htmlFor="groupByDate"
              className="text-sm text-gray-700 dark:text-gray-300 font-medium"
            >
              날짜별 그룹화
            </label>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex space-x-3">
          <button
            onClick={onQRCodeClick}
            className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12V8H8v4h4z"
              />
            </svg>
            {t('attendance.actions.generateQR')}
          </button>
        </div>
      </div>

      {/* 활성 필터 표시 */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.searchTerm && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              검색: "{filters.searchTerm}"
              <button
                onClick={() => handleSearchChange('')}
                className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                ×
              </button>
            </span>
          )}
          {filters.selectedDate !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
              날짜: {filters.selectedDate}
              <button
                onClick={() => handleDateChange('all')}
                className="ml-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
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
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
              상태: {filters.selectedStatus}
              <button
                onClick={() => handleStatusChange('all')}
                className="ml-2 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200"
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

export default StaffFilters;
