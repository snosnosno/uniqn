import React, { forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  options: SelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    label, 
    error, 
    helperText, 
    required, 
    fullWidth = true, 
    className = '', 
    options,
    onChange,
    placeholder,
    ...props 
  }, ref) => {
    const selectId = props.id || `select-${Math.random().toString(36).substr(2, 9)}`;
    
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };
    
    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label ? <label 
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {required ? <span className="text-red-500 ml-1">*</span> : null}
          </label> : null}
        <select
          ref={ref}
          id={selectId}
          onChange={handleChange}
          className={`
            block w-full px-3 py-2 border rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300'
            }
          `}
          {...props}
        >
          {placeholder ? <option value="" disabled>
              {placeholder}
            </option> : null}
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        {helperText && !error ? <p className="mt-1 text-sm text-gray-500">{helperText}</p> : null}
      </div>
    );
  }
);

Select.displayName = 'Select'; 