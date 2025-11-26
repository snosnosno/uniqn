import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import LoadingSpinner from '../LoadingSpinner';
import JobPostingCard from '../common/JobPostingCard';
import { JobPosting } from '../../types/jobPosting';
import { toast } from '../../utils/toast';

interface JobPostingListProps {
  jobPostings: JobPosting[];
  loading: boolean;
  onEdit: (post: JobPosting) => void;
  onDelete: (postId: string, title: string) => Promise<boolean>;
  onNavigateToDetail: (postId: string) => void;
  isDeleting?: string | null;
}

const JobPostingList: React.FC<JobPostingListProps> = React.memo(
  ({ jobPostings, loading, onEdit, onDelete, onNavigateToDetail, isDeleting = null }) => {
    const { currentUser } = useAuth();

    const handleDelete = async (postId: string, title: string) => {
      try {
        await onDelete(postId, title);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '공고 삭제 중 오류가 발생했습니다.');
      }
    };

    // 관리자 액션 버튼 렌더링 - 카드 너비에 맞게 균등 배치
    const renderAdminActions = (post: JobPosting) => {
      const isOwner = currentUser?.uid === post.createdBy;

      return (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigateToDetail(post.id)}
            className="w-full text-xs sm:text-sm px-3 py-1.5 min-h-[32px] hover:shadow-sm transition-shadow"
          >
            관리
          </Button>
          {isOwner ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(post)}
                className="w-full text-xs sm:text-sm px-3 py-1.5 min-h-[32px] hover:shadow-sm transition-shadow"
              >
                수정
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(post.id, post.title)}
                loading={isDeleting === post.id}
                disabled={isDeleting === post.id}
                className="w-full text-xs sm:text-sm px-3 py-1.5 min-h-[32px] hover:shadow-sm transition-shadow"
              >
                {isDeleting === post.id ? '삭제 중...' : '삭제'}
              </Button>
            </>
          ) : (
            // 빈 공간을 채우기 위한 빈 div들
            <>
              <div></div>
              <div></div>
            </>
          )}
        </>
      );
    };

    if (loading) {
      return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="text-gray-500 dark:text-gray-400 mt-2">공고 목록을 불러오는 중...</p>
          </div>
        </div>
      );
    }

    if (jobPostings.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 text-4xl mb-2">📋</div>
            <p className="text-gray-500 dark:text-gray-400">등록된 공고가 없습니다.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">새 공고를 작성해보세요.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            등록된 공고 ({jobPostings.length}개)
          </h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {jobPostings.map((post) => (
            <JobPostingCard
              key={post.id}
              post={post}
              variant="admin-list"
              renderActions={renderAdminActions}
              showStatus={true}
              showApplicationCount={true}
              className="border-none shadow-none"
            />
          ))}
        </div>
      </div>
    );
  }
);

export default JobPostingList;
