import React from 'react';

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode; // icon prop is now optional
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ title, children, className, icon }) => {
  return (
    <div className={`bg-white p-6 rounded-xl shadow-md ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
        {icon ? <div className="text-2xl">{icon}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
};
