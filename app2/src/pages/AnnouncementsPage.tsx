/**
 * 공지사항 페이지
 *
 * @description
 * 시스템 공지 및 앱 업데이트 알림을 표시하는 페이지
 *
 * @version 1.0.0
 * @since 2025-10-02
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const AnnouncementsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">🔔 공지사항</h1>
        <p className="text-gray-600">시스템 공지 및 업데이트 정보</p>
      </div>

      {/* 공지사항 목록 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📢</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            공지사항이 없습니다
          </h3>
          <p className="text-gray-500 mb-6">
            새로운 공지사항이 등록되면 알림을 받으실 수 있습니다.
          </p>
          <button
            onClick={() => navigate('/app/notifications')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            알림 센터로 이동
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-blue-500 text-xl mr-3">ℹ️</span>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              알림 설정
            </h4>
            <p className="text-sm text-blue-700">
              중요한 공지사항을 놓치지 않도록 알림 센터에서 알림 설정을 확인하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsPage;
