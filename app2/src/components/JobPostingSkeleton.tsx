import React from 'react';

interface JobPostingSkeletonProps {
  count?: number;
}

const JobPostingSkeleton: React.FC<JobPostingSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6 animate-pulse">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 mb-4 lg:mb-0">
                {/* Title and badge */}
                <div className="flex items-center mb-2">
                  <div className="h-5 sm:h-6 bg-gray-200 rounded w-48 sm:w-64 mr-2"></div>
                  <div className="h-5 bg-gray-200 rounded-full w-12"></div>
                </div>
                
                {/* Date */}
                <div className="h-4 bg-gray-200 rounded w-40 mb-1"></div>
                
                {/* Location */}
                <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                
                {/* Salary */}
                <div className="h-4 bg-gray-200 rounded w-28 mb-1"></div>
                
                {/* Benefits */}
                <div className="flex gap-2 mb-3">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                
                {/* Time slots */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <div className="h-4 bg-gray-200 rounded w-16 mr-4"></div>
                    <div className="flex gap-2">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-4 bg-gray-200 rounded w-16 mr-4"></div>
                    <div className="flex gap-2">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Buttons */}
              <div className="w-full lg:w-auto lg:ml-4">
                <div className="flex flex-row sm:flex-col gap-2">
                  <div className="flex-1 sm:w-full h-10 bg-gray-200 rounded"></div>
                  <div className="flex-1 sm:w-full h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default JobPostingSkeleton;