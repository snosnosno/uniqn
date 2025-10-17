import React from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatDate as formatDateUtil } from '../../../utils/jobPosting/dateUtils';
import AssignmentDisplay from '../../../components/common/AssignmentDisplay';
import {
  Application,
  // Assignment // 미래 사용 예정
} from '../../../types/application';

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

type DateValue = string | Date | FirebaseTimestamp;

// 날짜/시간 포맷팅 유틸 함수들 (향후 사용 예정)
// const formatDateTimeValue = (value: string | DateValue): string => {
//   if (!value) return '';
//   if (typeof value === 'string') return value;
//   if (typeof value === 'object' && 'seconds' in value) {
//     return formatDateUtil(value as FirebaseTimestamp);
//   }
//   return String(value);
// };

const formatDateOnly = (value: DateValue): string => {
  return value ? formatDateUtil(value) : '날짜 미정';
};

// 상태 뱃지 컴포넌트
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '✅ 확정';
      case 'rejected':
        return '❌ 미선정';
      default:
        return '⏳ 대기중';
    }
  };

  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(status)}`}>
      {getStatusText(status)}
    </div>
  );
};


// 🔧 Legacy 다중 지원 시간대 표시 컴포넌트 (하위 호환성) - 현재 미사용
/*
const MultipleAssignmentsDisplay: React.FC<{
  assignedTimes: string[];
  assignedRoles: string[];
  assignedDates?: DateValue[] | undefined;
  status: string;
  t: (key: string) => string;
}> = ({ assignedTimes, assignedRoles, assignedDates, status, t }) => {
  // 날짜별로 그룹화
  const groupedByDate: Record<string, Array<{time: string, role: string, index: number}>> = {};

  assignedTimes.forEach((time: string, index: number) => {
    const dateValue = assignedDates?.[index];
    const dateString = formatDateOnly(dateValue || '');

    if (!groupedByDate[dateString]) {
      groupedByDate[dateString] = [];
    }

    groupedByDate[dateString]!.push({
      time: formatDateTimeValue(time),
      role: assignedRoles[index] || '',
      index
    });
  });

  // 날짜 정렬
  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-2">
      {sortedDates.map((date) => (
        <div key={date} className="bg-gray-50 rounded-lg p-2">
          {status === 'confirmed' ? (
            // 확정 상태: 간소화된 표시
            <div className="space-y-1">
              {groupedByDate[date]?.map((item, idx) => (
                <div key={idx} className="text-sm text-gray-700 font-medium">
                  📅 {date} ⏰ {item.time} 👤 {item.role ? String(t(`roles.${item.role}`) || item.role) : ''}
                </div>
              ))}
            </div>
          ) : (
            // 대기 상태: 기존 표시 방식 유지
            <>
              <div className="text-blue-600 font-medium mb-1">
                📅 {date}
              </div>
              <div className="space-y-1 ml-4">
                {groupedByDate[date]?.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-2 text-gray-700">
                    <span>⏰ {item.time}</span>
                    {item.role && (
                      <span className="text-gray-600">
                        - {String(t(`roles.${item.role}`) || item.role)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
*/

// 단일 지원 시간대 표시 컴포넌트 (현재 미사용)
/*
const SingleAssignmentDisplay: React.FC<{
  assignedTime?: string | DateValue | undefined;
  assignedRole?: string | undefined;
  assignedDate?: DateValue | undefined;
  status: string;
  t: (key: string) => string;
}> = ({ assignedTime, assignedRole, assignedDate, status, t }) => (
  <div className="p-2 bg-gray-50 rounded-lg">
    {status === 'confirmed' ? (
      // 확정 상태: 날짜 시간 역할 순서로 한 줄 간소화
      <div className="text-sm text-gray-700 font-medium">
        📅 {assignedDate ? formatDateOnly(assignedDate) : ''} ⏰ {formatDateTimeValue(assignedTime || '')} 👤 {assignedRole ? (String(t(`roles.${assignedRole}`) || assignedRole)) : ''}
      </div>
    ) : (
      // 대기 상태: 기존 표시 방식 유지
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
          // 날짜 - 모바일에서 첫 줄
          {assignedDate && (
            <div className="text-blue-600 font-medium">
              📅 {formatDateOnly(assignedDate)}
            </div>
          )}
          // 시간과 역할 - 모바일에서 둘째 줄
          <div className="flex items-center space-x-2 text-gray-700">
            <span>⏰ {formatDateTimeValue(assignedTime || '')}</span>
            {assignedRole && (
              <span className="text-gray-600">
                - {String(t(`roles.${assignedRole}`) || assignedRole)}
              </span>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);
*/

// 지원 카드 컴포넌트
const ApplicationCard: React.FC<{
  application: Application;
  onViewDetail?: ((jobPosting: any) => void) | undefined;
  onCancel: (postId: string) => void;
  isProcessing: string | null;
  t: (key: string) => string;
}> = ({ application, onViewDetail, onCancel, isProcessing, t: _t }) => (
  <div className="bg-white rounded-lg shadow-md p-4 border">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {application.postTitle || '제목 없음'}
        </h3>
        <div className="text-sm text-gray-500 mt-1">
          지원일: {formatDateOnly(application.appliedAt)}
        </div>
      </div>
      <StatusBadge status={application.status} />
    </div>

    {application.jobPosting && (
      <div className="mb-3 text-sm text-gray-600">
        <p>📍 주소: {application.jobPosting.location}
          {application.jobPosting.district && ` ${application.jobPosting.district}`}
          {application.jobPosting.detailedAddress && ` - ${application.jobPosting.detailedAddress}`}
        </p>
      </div>
    )}

    <div>
      <h4 className="font-medium text-gray-900 mb-2">지원한 시간대</h4>
      
      {/* 🎯 개발 단계: 모든 데이터는 새 구조 (마이그레이션 불필요) */}
      {(() => {
        // 🎯 개발 단계: 마이그레이션 로직 제거
        const processedApplication = application;

        // assignments 배열 표시 (Single Source of Truth) - 공통 컴포넌트 사용
        if (processedApplication.assignments && processedApplication.assignments.length > 0) {
          return (
            <AssignmentDisplay
              assignments={processedApplication.assignments}
              status={processedApplication.status}
            />
          );
        } else {
          return (
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-gray-500 text-sm">지원 정보 없음</div>
            </div>
          );
        }
      })()}

      {application.jobPosting && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          {onViewDetail && application.jobPosting && (
            <button
              onClick={() => onViewDetail(application.postId)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex-1 sm:flex-initial"
              aria-label="공고 상세정보 보기"
            >
              자세히보기
            </button>
          )}
          {application.status === 'applied' && (
            <button
              onClick={() => onCancel(application.postId)}
              disabled={isProcessing === application.postId}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm flex-1 sm:flex-initial"
            >
              {isProcessing === application.postId ? '취소 중...' : '지원 취소'}
            </button>
          )}
        </div>
      )}
    </div>
  </div>
);

// 🔄 중복된 interface 제거 완료 - types/application.ts 타입 사용

interface MyApplicationsTabProps {
  applications: Application[];
  loading: boolean;
  onRefresh: () => void;
  onCancel: (postId: string) => void;
  isProcessing: string | null;
  onTabChange: () => void;
  onViewDetail?: (jobPosting: any) => void;
}

/**
 * 내 지원 현황 탭 컴포넌트
 */
const MyApplicationsTab: React.FC<MyApplicationsTabProps> = ({
  applications,
  loading,
  onRefresh,
  onCancel,
  isProcessing,
  onTabChange,
  onViewDetail
}) => {
  const { t } = useTranslation();


  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" text="지원 현황을 불러오는 중..." />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">📋</div>
        <p className="text-gray-500 mb-4">아직 지원한 공고가 없습니다.</p>
        <button
          onClick={onTabChange}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          구인 공고 보러가기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold">내 지원 현황 ({applications.length}건)</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
        >
          {loading ? '새로고침 중...' : '🔄 새로고침'}
        </button>
      </div>
      
      {applications.map((application) => (
        <ApplicationCard
          key={application.id}
          application={application}
          onViewDetail={onViewDetail}
          onCancel={onCancel}
          isProcessing={isProcessing}
          t={t}
        />
      ))}
    </div>
  );
};

export default MyApplicationsTab;