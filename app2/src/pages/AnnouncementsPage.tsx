/**
 * 공지사항 페이지
 *
 * @description
 * 시스템 공지사항을 관리하는 페이지
 * - 관리자: 공지사항 등록/수정/삭제
 * - 일반 사용자: 조회만 가능
 * - 페이지네이션 (10개씩)
 * - 이미지 첨부 지원
 *
 * @version 3.0.0
 * @since 2025-12-10
 */

import React, { useState, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  MegaphoneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';
import AnnouncementCard from '../components/announcements/AnnouncementCard';
import CreateAnnouncementModal from '../components/announcements/CreateAnnouncementModal';
import EditAnnouncementModal from '../components/announcements/EditAnnouncementModal';
import AnnouncementDetailModal from '../components/announcements/AnnouncementDetailModal';
import { useAuth } from '../contexts/AuthContext';
import { useSystemAnnouncements } from '../hooks/useSystemAnnouncements';
import { logger } from '../utils/logger';
import type { SystemAnnouncement } from '../types';

/**
 * 공지사항 페이지 컴포넌트
 */
const AnnouncementsPage: React.FC = memo(() => {
  const { t } = useTranslation();
  const { isAdmin, role } = useAuth();

  // Hook - 단일 소스 (모든 기능 제공)
  const {
    announcements,
    loading,
    error,
    pagination,
    goToPage,
    nextPage,
    prevPage,
    incrementViewCount,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    uploadImage,
    deleteImage,
    uploadProgress,
  } = useSystemAnnouncements();

  // 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SystemAnnouncement | null>(null);

  /**
   * 공지사항 카드 클릭 (상세 보기)
   */
  const handleAnnouncementClick = useCallback(
    (announcement: SystemAnnouncement) => {
      setSelectedAnnouncement(announcement);
      setIsDetailModalOpen(true);
      incrementViewCount(announcement.id);
    },
    [incrementViewCount]
  );

  /**
   * 등록 성공 핸들러
   */
  const handleCreateSuccess = useCallback(() => {
    setIsCreateModalOpen(false);
    logger.info('공지사항 등록 완료', { component: 'AnnouncementsPage' });
  }, []);

  /**
   * 수정 버튼 클릭
   */
  const handleEdit = useCallback((announcement: SystemAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  }, []);

  /**
   * 수정 성공 핸들러
   */
  const handleEditSuccess = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedAnnouncement(null);
    logger.info('공지사항 수정 완료', { component: 'AnnouncementsPage' });
  }, []);

  /**
   * 삭제 핸들러
   */
  const handleDelete = useCallback(
    async (announcementId: string) => {
      try {
        await deleteAnnouncement(announcementId);
        logger.info('공지사항 삭제 완료', {
          component: 'AnnouncementsPage',
          data: { announcementId },
        });
      } catch (err) {
        logger.error('공지사항 삭제 실패', err instanceof Error ? err : new Error(String(err)), {
          component: 'AnnouncementsPage',
          data: { announcementId },
        });
        throw err; // 모달에서 에러 처리하도록
      }
    },
    [deleteAnnouncement]
  );

  /**
   * 상세 모달 닫기
   */
  const handleDetailClose = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedAnnouncement(null);
  }, []);

  /**
   * 수정 모달 닫기
   */
  const handleEditClose = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedAnnouncement(null);
  }, []);

  /**
   * 페이지 새로고침
   */
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  // 로딩 상태
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">
              {t('announcements.error.loadFailed', '공지사항을 불러올 수 없습니다')}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{error.message}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5" />
              {t('common.retry', '다시 시도')}
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
          <div className="flex items-center gap-3">
            <MegaphoneIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('announcements.title', '공지사항')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {t('announcements.description', '시스템 공지 및 업데이트 정보')}
              </p>
            </div>
          </div>

          {/* 관리자 전용: 등록 버튼 */}
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              <span>{t('announcements.create.button', '등록')}</span>
            </button>
          )}
        </div>

        {/* 통계 */}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
          <span>
            {t('announcements.stats.total', '전체 {{count}}개', {
              count: pagination.totalCount,
            })}
          </span>
          <span className="text-gray-400">|</span>
          <span>
            {t('announcements.stats.page', '페이지 {{current}} / {{total}}', {
              current: pagination.currentPage,
              total: pagination.totalPages || 1,
            })}
          </span>
        </div>
      </div>

      {/* 공지사항 목록 */}
      {announcements.length === 0 ? (
        /* 빈 목록 */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <MegaphoneIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {t('announcements.empty.title', '공지사항이 없습니다')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {t(
                'announcements.empty.description',
                '새로운 공지사항이 등록되면 여기에 표시됩니다.'
              )}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 공지사항 카드 목록 */}
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onClick={handleAnnouncementClick}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              {/* 이전 버튼 */}
              <button
                type="button"
                onClick={prevPage}
                disabled={!pagination.hasPrevPage}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={t('common.prevPage', '이전 페이지')}
              >
                <ChevronLeftIcon className="w-5 h-5" />
                <span className="hidden sm:inline">{t('common.prev', '이전')}</span>
              </button>

              {/* 페이지 번호 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    // 현재 페이지 주변 2개씩만 표시
                    const current = pagination.currentPage;
                    return (
                      page === 1 || page === pagination.totalPages || Math.abs(page - current) <= 2
                    );
                  })
                  .map((page, index, filtered) => {
                    // 생략 부호 표시
                    const prevPage = filtered[index - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;

                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && (
                          <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => goToPage(page)}
                          className={`min-w-[40px] h-10 rounded-lg font-medium transition-colors ${
                            page === pagination.currentPage
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          aria-label={t('common.goToPage', '{{page}}페이지로 이동', { page })}
                          aria-current={page === pagination.currentPage ? 'page' : undefined}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* 다음 버튼 */}
              <button
                type="button"
                onClick={nextPage}
                disabled={!pagination.hasNextPage}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={t('common.nextPage', '다음 페이지')}
              >
                <span className="hidden sm:inline">{t('common.next', '다음')}</span>
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* 등록 모달 */}
      <CreateAnnouncementModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        createAnnouncement={createAnnouncement}
        uploadImage={uploadImage}
        deleteImage={deleteImage}
        uploadProgress={uploadProgress}
      />

      {/* 수정 모달 */}
      {selectedAnnouncement && (
        <EditAnnouncementModal
          isOpen={isEditModalOpen}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
          announcement={selectedAnnouncement}
          updateAnnouncement={updateAnnouncement}
          uploadImage={uploadImage}
          deleteImage={deleteImage}
          uploadProgress={uploadProgress}
        />
      )}

      {/* 상세 모달 */}
      <AnnouncementDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleDetailClose}
        announcement={selectedAnnouncement}
        isAdmin={isAdmin}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
});

AnnouncementsPage.displayName = 'AnnouncementsPage';

export default AnnouncementsPage;
