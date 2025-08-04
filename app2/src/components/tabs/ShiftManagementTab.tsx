import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCalendarAlt, FaClock, FaUsers, FaTable, FaPlus, FaCog, FaHistory } from '../Icons/ReactIconsReplacement';

// import { useAuth } from '../../contexts/AuthContext';
import { useJobPostingContext } from '../../contexts/JobPostingContextAdapter';

interface ShiftManagementTabProps {
  jobPosting?: any;
}

const ShiftManagementTab: React.FC<ShiftManagementTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  // const { currentUser } = useAuth();
  const { staff, loading: contextLoading } = useJobPostingContext();
  
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  
  // 현재 선택된 날짜 상태
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0] || ''; // YYYY-MM-DD 형식
  });

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
      {/* 헤더 섹션 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium">{jobPosting.title} - 시프트 관리</h3>
          <p className="text-sm text-gray-600 mt-1">
            스태프 교대 스케줄 및 시간 관리
          </p>
        </div>
        <div className="text-sm text-gray-600">
          {t('common.comingSoon', '향후 업데이트 예정')}
        </div>
      </div>

      {error ? <div className="bg-red-50 p-4 rounded-lg mb-4">
          <p className="text-red-600">{error}</p>
        </div> : null}

      {/* 날짜 선택 및 컨트롤 바 */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* 날짜 선택 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="w-5 h-5 text-blue-600" />
              <label className="font-semibold text-gray-700">
                {t('shiftSchedule.selectDate', '날짜 선택')}:
              </label>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* 컨트롤 버튼들 */}
          <div className="flex items-center gap-2">
            <button 
              className="btn btn-outline btn-sm flex items-center gap-2"
              disabled
            >
              <FaHistory className="w-4 h-4" />
              {t('shiftSchedule.generateWorkLogs', '근무기록 생성')}
            </button>
            <button 
              className="btn btn-outline btn-sm flex items-center gap-2"
              disabled
            >
              <FaCog className="w-4 h-4" />
              {t('shiftSchedule.settings', '설정')}
            </button>
            <button 
              className="btn btn-primary btn-sm flex items-center gap-2"
              disabled
            >
              <FaPlus className="w-4 h-4" />
              {t('shiftSchedule.createSchedule', '스케줄 생성')}
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* 스케줄 그리드 영역 (3/4) */}
        <div className="xl:col-span-3">
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-xl font-semibold mb-4 text-blue-600 flex items-center">
              <FaTable className="w-5 h-5 mr-2"/> 
              {t('shiftSchedule.scheduleGrid', '스케줄 그리드')}
            </h4>
            
            <div className="text-center py-12">
              <FaCalendarAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h5 className="text-lg font-semibold text-gray-600 mb-2">
                시프트 스케줄 관리 기능
              </h5>
              <p className="text-gray-500 mb-4">
                스태프들의 교대 근무 스케줄을 시간대별로 관리하는 기능이 이곳에 추가될 예정입니다.
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• 시간대별 스태프 배정</p>
                <p>• 테이블별 딜러 로테이션</p>
                <p>• 근무 시간 추적</p>
                <p>• 자동 교대 알림</p>
              </div>
            </div>
          </div>
        </div>

        {/* 사이드바 - 스태프 목록 및 정보 (1/4) */}
        <div className="space-y-6">
          
          {/* 할당된 스태프 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-xl font-semibold mb-4 text-blue-600 flex items-center">
              <FaUsers className="w-5 h-5 mr-2"/> 
              할당된 스태프 ({staff.length})
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {staff.length > 0 ? staff.map((staffMember: any) => (
                <div key={staffMember.id} className="flex items-center bg-blue-50 p-3 rounded-lg shadow-sm">
                  <div className="w-8 h-8 bg-blue-300 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-semibold text-blue-700">
                      {staffMember.name?.charAt(0) || 'S'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{staffMember.name}</p>
                    <p className="text-sm text-gray-500">
                      {(staffMember as any).assignedRole || staffMember.role} | {(staffMember as any).assignedTime || staffMember.assignedTime || '시간 미정'}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  할당된 스태프가 없습니다.
                </p>
              )}
            </div>
          </div>

          {/* 시간대 정보 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-xl font-semibold mb-4 text-purple-600 flex items-center">
              <FaClock className="w-5 h-5 mr-2"/> 
              시간대 정보
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {jobPosting.timeSlots?.length > 0 ? (
                jobPosting.timeSlots.map((timeSlot: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-700">
                      {timeSlot.time}
                    </span>
                    <span className="text-sm text-gray-500">
                      {timeSlot.roles?.length || 0} 역할
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  설정된 시간대가 없습니다.
                </p>
              )}
            </div>
          </div>

          {/* 테이블 정보 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-xl font-semibold mb-4 text-green-600 flex items-center">
              <FaTable className="w-5 h-5 mr-2"/> 
              테이블 정보
            </h4>
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-3">🎯</div>
              <p className="text-sm text-gray-500">
                게임 테이블 관리 기능이<br/>향후 추가될 예정입니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 시프트 관리 기능 소개 */}
      <div className="mt-6 bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">예정된 시프트 관리 기능</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">📅 스케줄 관리</h5>
            <p className="text-sm text-gray-600">
              일일/주간 단위로 스태프 근무 스케줄을 생성하고 관리합니다.
            </p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">🔄 자동 교대</h5>
            <p className="text-sm text-gray-600">
              설정된 시간에 따라 자동으로 교대 알림을 발송하고 관리합니다.
            </p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">⏰ 근무 추적</h5>
            <p className="text-sm text-gray-600">
              실시간으로 스태프 근무 시간을 추적하고 기록합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftManagementTab;