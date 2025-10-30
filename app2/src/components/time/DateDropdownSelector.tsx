import React from 'react';

export interface DateDropdownSelectorProps {
  value: {
    year?: string;
    month?: string;
    day?: string;
  };
  onChange: (value: { year?: string; month?: string; day?: string }) => void;
  includeYear?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
  minDate?: string; // yyyy-MM-dd format
  maxDate?: string; // yyyy-MM-dd format
}

const DateDropdownSelector: React.FC<DateDropdownSelectorProps> = React.memo(({
  value,
  onChange,
  includeYear = true,
  label,
  className = '',
  disabled = false,
  minDate,
  maxDate
}) => {
  // Get current year for default range
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i - 2); // 2 years before to 2 years after

  // Parse min and max dates
  const minDateObj = minDate ? new Date(minDate) : null;
  const maxDateObj = maxDate ? new Date(maxDate) : null;
  
  // Filter years based on min/max dates
  const availableYears = years.filter(year => {
    if (minDateObj && year < minDateObj.getFullYear()) return false;
    if (maxDateObj && year > maxDateObj.getFullYear()) return false;
    return true;
  });

  // Check if a specific date is within the allowed range
  const isDateInRange = (year: string, month: string, day: string) => {
    if (!year || !month || !day) return true;
    
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(dateStr);
    
    if (minDateObj && date < minDateObj) return false;
    if (maxDateObj && date > maxDateObj) return false;
    
    return true;
  };

  // Check if a month is partially or fully available
  const isMonthAvailable = (year: string, month: string) => {
    if (!year || !month) return true;
    
    const firstDay = new Date(`${year}-${month.padStart(2, '0')}-01`);
    const lastDay = new Date(parseInt(year), parseInt(month), 0);
    
    if (minDateObj && lastDay < minDateObj) return false;
    if (maxDateObj && firstDay > maxDateObj) return false;
    
    return true;
  };

  const handleDateChange = (type: 'year' | 'month' | 'day', selectedValue: string) => {
    const newValue = { ...value, [type]: selectedValue };
    
    // Clear dependent fields when parent field is cleared
    if (type === 'year' && !selectedValue) {
      newValue.month = '';
      newValue.day = '';
    } else if (type === 'month' && !selectedValue) {
      newValue.day = '';
    }
    
    onChange(newValue);
  };

  // Get days in selected month
  const getDaysInMonth = (year?: string, month?: string) => {
    if (!year || !month) return 31; // Default to 31 days if year/month not selected
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return daysInMonth;
  };

  const maxDays = getDaysInMonth(value.year, value.month);

  return (
    <div className={`space-y-2 ${className}`}>
      {label ? <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
        </label> : null}
      
      <div className="flex space-x-2">
        {/* Year Dropdown */}
        {includeYear ? <select
            value={value.year || ''}
            onChange={(e) => handleDateChange('year', e.target.value)}
            disabled={disabled}
            className="flex-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-600"
          >
            <option value="">년도</option>
            {availableYears.map(year => (
              <option key={year} value={year.toString()}>
                {year}년
              </option>
            ))}
          </select> : null}
        
        {/* Month Dropdown */}
        <select
          value={value.month || ''}
          onChange={(e) => handleDateChange('month', e.target.value)}
          disabled={disabled || (includeYear && !value.year)}
          className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-700 dark:text-gray-100"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const month = (i + 1).toString().padStart(2, '0');
            const isAvailable = !value.year || isMonthAvailable(value.year, month);
            return isAvailable ? (
              <option key={month} value={month}>
                {i + 1}월
              </option>
            ) : null;
          })}
        </select>
        
        {/* Day Dropdown */}
        <select
          value={value.day || ''}
          onChange={(e) => handleDateChange('day', e.target.value)}
          disabled={disabled || !value.month}
          className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-700 dark:text-gray-100"
        >
          {Array.from({ length: maxDays }, (_, i) => {
            const day = (i + 1).toString().padStart(2, '0');
            const isAvailable = !value.year || !value.month || isDateInRange(value.year, value.month, day);
            return isAvailable ? (
              <option key={day} value={day}>
                {i + 1}일
              </option>
            ) : null;
          })}
        </select>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 날짜 드롭다운 셀렉터의 주요 props 비교
  return (
    JSON.stringify(prevProps.value) === JSON.stringify(nextProps.value) &&
    prevProps.includeYear === nextProps.includeYear &&
    prevProps.label === nextProps.label &&
    prevProps.className === nextProps.className &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.minDate === nextProps.minDate &&
    prevProps.maxDate === nextProps.maxDate &&
    prevProps.onChange === nextProps.onChange
  );
});

export default DateDropdownSelector;