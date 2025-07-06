import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useJobPostingContext } from '../../contexts/JobPostingContext';

interface EventManagementTabProps {
  jobPosting?: any;
}

const EventManagementTab: React.FC<EventManagementTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { loading: contextLoading } = useJobPostingContext();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Early return if no job posting data
  if (!jobPosting) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-500">공고 정보를 불러올 수 없습니다.</div>
        </div>
      </div>
    );
  }

  if (contextLoading || loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium">{jobPosting.title} - 이벤트 관리</h3>
        <div className="text-sm text-gray-600">
          {t('common.comingSoon', '향후 업데이트 예정')}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-lg mb-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 이벤트 관리 기본 UI 구조 */}
      <div className="space-y-6">
        {/* 이벤트 개요 섹션 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">이벤트 개요</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이벤트명
              </label>
              <div className="p-3 bg-gray-50 rounded-md text-gray-900">
                {jobPosting.title}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이벤트 기간
              </label>
              <div className="p-3 bg-gray-50 rounded-md text-gray-900">
                {jobPosting.startDate && jobPosting.endDate 
                  ? `${jobPosting.startDate} ~ ${jobPosting.endDate}`
                  : '기간 정보 없음'
                }
              </div>
            </div>
          </div>
        </div>

        {/* 이벤트 상태 섹션 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">이벤트 상태</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {jobPosting.status === 'active' ? '진행중' : 
                 jobPosting.status === 'closed' ? '완료' : '대기중'}
              </div>
              <div className="text-sm text-gray-600 mt-1">현재 상태</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {jobPosting.confirmedStaff?.length || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">확정 스태프</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {jobPosting.timeSlots?.length || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">시간대</div>
            </div>
          </div>
        </div>

        {/* 이벤트 설정 섹션 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">이벤트 설정</h4>
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🏆</div>
            <h5 className="text-lg font-medium text-gray-900 mb-2">
              이벤트 관리 기능
            </h5>
            <p className="text-gray-500 mb-4">
              토너먼트 이벤트 생성, 수정, 삭제 및 상세 설정 기능이 이곳에 추가될 예정입니다.
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• 토너먼트 테이블 관리</p>
              <p>• 게임 규칙 설정</p>
              <p>• 상금 구조 관리</p>
              <p>• 참가자 등록 관리</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventManagementTab;