import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  loading?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  footer,
  variant = 'default',
  size = 'md',
  className = '',
  onClick,
  loading = false,
  ...props
}) => {
  const baseClasses = 'card bg-base-100 transition-all duration-200';
  
  const variantClasses = {
    default: 'shadow-sm',
    bordered: 'border border-base-300',
    elevated: 'shadow-lg'
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const clickableClass = onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : '';
  const loadingClass = loading ? 'opacity-75 pointer-events-none' : '';

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    clickableClass,
    loadingClass,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} {...props}>
      {(title || subtitle || headerActions) ? <div className="card-header flex items-center justify-between p-4 pb-2">
          <div className="flex-1">
            {title ? <h3 className="card-title text-lg font-semibold text-base-content">
                {title}
              </h3> : null}
            {subtitle ? <p className="text-sm text-base-content/70 mt-1">
                {subtitle}
              </p> : null}
          </div>
          {headerActions ? <div className="flex items-center gap-2">
              {headerActions}
            </div> : null}
        </div> : null}
      
      <div className="card-body p-4 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : (
          children
        )}
      </div>
      
      {footer ? <div className="card-footer p-4 pt-2 border-t border-base-300">
          {footer}
        </div> : null}
    </div>
  );
};

export default Card; 