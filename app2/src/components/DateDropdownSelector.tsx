import React from 'react';
// import { useTranslation } from 'react-i18next';

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
}

const DateDropdownSelector: React.FC<DateDropdownSelectorProps> = ({
  value,
  onChange,
  includeYear = true,
  label,
  className = '',
  disabled = false
}) => {
  // Get current year for default range
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i - 2); // 2 years before to 2 years after

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
      {label ? <label className="block text-sm font-medium text-gray-700">
          {label}
        </label> : null}
      
      <div className="flex space-x-2">
        {/* Year Dropdown */}
        {includeYear ? <select
            value={value.year || ''}
            onChange={(e) => handleDateChange('year', e.target.value)}
            disabled={disabled}
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:bg-gray-100"
          >
            <option value="">년도</option>
            {years.map(year => (
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
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:bg-gray-100"
        >
          <option value="">전체</option>
          <option value="01">1월</option>
          <option value="02">2월</option>
          <option value="03">3월</option>
          <option value="04">4월</option>
          <option value="05">5월</option>
          <option value="06">6월</option>
          <option value="07">7월</option>
          <option value="08">8월</option>
          <option value="09">9월</option>
          <option value="10">10월</option>
          <option value="11">11월</option>
          <option value="12">12월</option>
        </select>
        
        {/* Day Dropdown */}
        <select
          value={value.day || ''}
          onChange={(e) => handleDateChange('day', e.target.value)}
          disabled={disabled || !value.month}
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:bg-gray-100"
        >
          <option value="">전체</option>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map(day => (
            <option key={day} value={day.toString().padStart(2, '0')}>
              {day}일
            </option>
          ))}
        </select>
      </div>
      
      {/* Display selected date */}
      {value.month && value.day ? <p className="text-xs text-gray-500">
          {includeYear && value.year ? `${value.year}년 ` : ''}
          {parseInt(value.month)}월 {parseInt(value.day)}일
        </p> : null}
    </div>
  );
};

export default DateDropdownSelector;