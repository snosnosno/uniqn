import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, required, fullWidth = true, className = '', ...props }, ref) => {
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label ? <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {required ? <span className="text-red-500 ml-1">*</span> : null}
          </label> : null}
        <input
          ref={ref}
          id={inputId}
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
        />
        {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        {helperText && !error ? <p className="mt-1 text-sm text-gray-500">{helperText}</p> : null}
      </div>
    );
  }
);

Input.displayName = 'Input'; 