import React from 'react';

interface StaffCardContactInfoProps {
  phone?: string;
  email?: string;
  postingTitle?: string;
  postingId?: string;
}

const StaffCardContactInfo: React.FC<StaffCardContactInfoProps> = React.memo(({
  phone,
  email,
  postingTitle: _postingTitle,
  postingId: _postingId
}) => {
  const hasContactInfo = phone || email;
  
  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      <div className="space-y-4">
        {/* 연락처 정보 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">연락처 정보</h4>
          {hasContactInfo ? (
            <div className="space-y-2">
              {phone && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    <span className="text-sm text-gray-600">{phone}</span>
                  </div>
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    통화
                  </a>
                </div>
              )}
              {email && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    <span className="text-sm text-gray-600 truncate">{email}</span>
                  </div>
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors flex-shrink-0 ml-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    메일
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">연락처 정보가 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
});

StaffCardContactInfo.displayName = 'StaffCardContactInfo';

export default StaffCardContactInfo;