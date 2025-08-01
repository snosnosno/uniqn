import React from 'react';

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = React.memo(({ 
  title, 
  children, 
  className = '', 
  icon, 
  action,
  loading = false 
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {icon && <div className="flex-shrink-0">{icon}</div>}
            <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
        <div className={`${loading ? 'opacity-50' : ''} transition-opacity duration-200`}>
          {loading ? (
            <div className="flex justify-center items-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
});
