import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJobPostingOperations } from '../hooks/useJobPostingOperations';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from '../utils/toast';
import Button from '../components/ui/Button';
import JobPostingForm from '../components/jobPosting/JobPostingForm';
import JobPostingList from '../components/jobPosting/JobPostingList';
import EditJobPostingModal from '../components/jobPosting/modals/EditJobPostingModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import type { JobPosting, JobPostingFormData } from '../types/jobPosting';

const JobPostingAdminPage = () => {
  const { t } = useTranslation();
  const { canCreateJobPostings } = usePermissions();
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);
  const [_isDeleting, _setIsDeleting] = useState<string | null>(null);

  const {
    jobPostings,
    loading,
    isEditModalOpen,
    currentPost,
    handleCreateJobPosting,
    handleUpdateJobPosting,
    handleDeleteJobPostingClick,
    handleDeleteJobPostingConfirm,
    deleteConfirmPost,
    setDeleteConfirmPost,
    handleNavigateToDetail,
    openEditModal,
    closeEditModal,
  } = useJobPostingOperations();

  // 공고 생성 핸들러
  const handleCreate = async (formData: Partial<JobPosting>) => {
    try {
      // JobPostingForm의 Zod 검증을 통과한 데이터이므로 타입 단언 사용
      await handleCreateJobPosting(formData as JobPostingFormData);
      toast.success(t('toast.jobPosting.createSuccess'));
      setIsCreateFormVisible(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.jobPosting.createError'));
      throw error; // JobPostingForm에서 로딩 상태 해제를 위해
    }
  };

  // 공고 수정 핸들러
  const handleUpdate = async (postId: string, formData: Partial<JobPosting>) => {
    try {
      // JobPostingForm의 Zod 검증을 통과한 데이터이므로 타입 단언 사용
      await handleUpdateJobPosting(postId, formData as JobPostingFormData);
      toast.success(t('toast.jobPosting.updateSuccess'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.jobPosting.updateError'));
      throw error;
    }
  };

  // 공고 삭제 핸들러
  const handleDelete = async (postId: string, title: string) => {
    handleDeleteJobPostingClick(postId, title);
    return true; // Return true to indicate the modal should wait for confirmation
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8">
      <div className="w-full px-2 sm:px-4 lg:px-6">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {t('common.jobManagement')}
              </h1>
            </div>

            {canCreateJobPostings && (
              <Button
                variant="primary"
                onClick={() => setIsCreateFormVisible(!isCreateFormVisible)}
              >
                {isCreateFormVisible ? t('common.viewList') : t('common.createPost')}
              </Button>
            )}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="space-y-8">
          {isCreateFormVisible ? (
            <JobPostingForm onSubmit={handleCreate} />
          ) : (
            <JobPostingList
              jobPostings={jobPostings}
              loading={loading}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onNavigateToDetail={handleNavigateToDetail}
              isDeleting={_isDeleting}
            />
          )}
        </div>

        {/* 수정 모달 */}
        <EditJobPostingModal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          currentPost={currentPost}
          onUpdate={handleUpdate}
        />

        {/* 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={!!deleteConfirmPost}
          onClose={() => setDeleteConfirmPost(null)}
          onConfirm={async () => {
            const success = await handleDeleteJobPostingConfirm();
            if (success) {
              toast.success(
                t('toast.jobPosting.deleteSuccess', { title: deleteConfirmPost?.title })
              );
            }
          }}
          title="공고 삭제"
          message={`"${deleteConfirmPost?.title}" 공고를 삭제하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없습니다.`}
          confirmText="삭제"
          cancelText="취소"
          isDangerous={true}
        />
      </div>
    </div>
  );
};

export default JobPostingAdminPage;
