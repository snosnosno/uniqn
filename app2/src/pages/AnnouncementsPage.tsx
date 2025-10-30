/**
 * 공지사항 페이지
 *
 * @description
 * 시스템 공지 및 앱 업데이트 알림을 표시하는 페이지
 * - 관리자: 공지사항 등록/수정/삭제 가능
 * - 일반 사용자: 공지사항 조회만 가능
 *
 * @version 2.0.0
 * @since 2025-10-02
 * @updated 2025-10-25
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import LoadingSpinner from '../components/LoadingSpinner';
import CreateAnnouncementModal from '../components/announcements/CreateAnnouncementModal';
import EditAnnouncementModal from '../components/announcements/EditAnnouncementModal';
import AnnouncementDetailModal from '../components/announcements/AnnouncementDetailModal';
import { useAuth } from '../contexts/AuthContext';
import { useSystemAnnouncements } from '../hooks/useSystemAnnouncements';
import { logger } from '../utils/logger';
import type { SystemAnnouncement } from '../types';
import {
  getPriorityLabel,
  getPriorityBadgeStyle
} from '../types';

const AnnouncementsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, role } = useAuth();
  const {
    announcements,
    activeAnnouncements,
    loading,
    error,
    incrementViewCount,
    deleteAnnouncement
  } = useSystemAnnouncements();

  // 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SystemAnnouncement | null>(null);

  /**
   * 공지사항 카드 클릭 (상세 보기)
   */
  const handleAnnouncementClick = useCallback((announcement: SystemAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setIsDetailModalOpen(true);
    incrementViewCount(announcement.id);
  }, [incrementViewCount]);

  /**
   * 등록 성공
   */
  const handleCreateSuccess = useCallback(() => {
    // 목록 자동 새로고침 (실시간 구독)
  }, []);

  /**
   * 수정 핸들러
   */
  const handleEdit = useCallback((announcement: SystemAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  }, []);

  /**
   * 수정 성공
   */
  const handleEditSuccess = useCallback(() => {
    // 목록 자동 새로고침 (실시간 구독)
    setSelectedAnnouncement(null);
  }, []);

  /**
   * 삭제 핸들러
   */
  const handleDelete = useCallback(async (announcementId: string) => {
    try {
      await deleteAnnouncement(announcementId);
    } catch (err) {
      logger.error('공지사항 삭제 실패', err instanceof Error ? err : new Error(String(err)), {
        component: 'AnnouncementsPage',
        data: { announcementId }
      });
    }
  }, [deleteAnnouncement]);

  /**
   * 우선순위별 정렬 (긴급 > 중요 > 일반)
   */
  const sortedAnnouncements = [...activeAnnouncements].sort((a, b) => {
    const priorityOrder = { urgent: 3, important: 2, normal: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

    if (priorityDiff !== 0) return priorityDiff;

    // 우선순위가 같으면 최신순 (null 체크 추가)
    if (!a.createdAt || !b.createdAt) return 0;
    const aDate = a.createdAt instanceof Date ? a.createdAt : a.createdAt.toDate();
    const bDate = b.createdAt instanceof Date ? b.createdAt : b.createdAt.toDate();
    return bDate.getTime() - aDate.getTime();
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">
              공지사항을 불러올 수 없습니다
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">🔔 공지사항</h1>
            <p className="text-gray-600 dark:text-gray-300">시스템 공지 및 업데이트 정보</p>
          </div>

          {/* 관리자 전용: 등록 버튼 */}
          {role === 'admin' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center space-x-1.5"
            >
              <span>➕</span>
              <span>등록</span>
            </button>
          )}
        </div>

        {/* 통계 */}
        <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
          <span>전체 {announcements.length}개</span>
          <span>•</span>
          <span>활성 {activeAnnouncements.length}개</span>
        </div>
      </div>

      {/* 공지사항 목록 */}
      {sortedAnnouncements.length === 0 ? (
        /* 빈 목록 */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📢</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
              공지사항이 없습니다
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              새로운 공지사항이 등록되면 알림을 받으실 수 있습니다.
            </p>
            <button
              onClick={() => navigate('/app/notifications')}
              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              알림 센터로 이동
            </button>
          </div>
        </div>
      ) : (
        /* 공지사항 카드 목록 */
        <div className="space-y-4">
          {sortedAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              onClick={() => handleAnnouncementClick(announcement)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              {/* 카드 헤더 */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 pr-4 line-clamp-2">
                  {announcement.title}
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getPriorityBadgeStyle(announcement.priority)}`}>
                  {getPriorityLabel(announcement.priority)}
                </span>
              </div>

              {/* 카드 메타 정보 */}
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                <span className="flex items-center space-x-1">
                  <span>👤</span>
                  <span>{announcement.createdByName}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <span>📅</span>
                  <span>
                    {announcement.createdAt
                      ? format(
                          announcement.createdAt instanceof Date
                            ? announcement.createdAt
                            : announcement.createdAt.toDate(),
                          'yyyy.MM.dd HH:mm',
                          { locale: ko }
                        )
                      : '-'}
                  </span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <span>👁️</span>
                  <span>{announcement.viewCount.toLocaleString()}회</span>
                </span>
              </div>

              {/* 읽기 더보기 표시 */}
              <div className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
                자세히 보기 →
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 안내 */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-blue-500 dark:text-blue-400 text-xl mr-3">ℹ️</span>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
              알림 설정
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              중요한 공지사항을 놓치지 않도록 알림 센터에서 알림 설정을 확인하세요.
            </p>
          </div>
        </div>
      </div>

      {/* 등록 모달 */}
      <CreateAnnouncementModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* 수정 모달 */}
      {selectedAnnouncement && (
        <EditAnnouncementModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedAnnouncement(null);
          }}
          onSuccess={handleEditSuccess}
          announcement={selectedAnnouncement}
        />
      )}

      {/* 상세 모달 */}
      <AnnouncementDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedAnnouncement(null);
        }}
        announcement={selectedAnnouncement}
        isAdmin={isAdmin}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default AnnouncementsPage;
