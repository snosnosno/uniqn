import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import LoadingSpinner from '../LoadingSpinner';
import JobPostingCard from '../common/JobPostingCard';
import { JobPosting } from '../../types/jobPosting';

interface JobPostingListProps {
  jobPostings: JobPosting[];
  loading: boolean;
  onEdit: (post: JobPosting) => void;
  onDelete: (postId: string, title: string) => Promise<boolean>;
  onNavigateToDetail: (postId: string) => void;
  isDeleting?: string | null;
}

const JobPostingList: React.FC<JobPostingListProps> = React.memo(({
  jobPostings,
  loading,
  onEdit,
  onDelete,
  onNavigateToDetail,
  isDeleting = null
}) => {
  const { currentUser } = useAuth();

  const handleDelete = async (postId: string, title: string) => {
    try {
      await onDelete(postId, title);
    } catch (error) {
      alert(error instanceof Error ? error.message : '공고 삭제 중 오류가 발생했습니다.');
    }
  };

  // 관리자 액션 버튼 렌더링
  const renderAdminActions = (post: JobPosting) => (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => onNavigateToDetail(post.id)}
      >
        관리
      </Button>
      {currentUser?.uid === post.createdBy && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(post)}
          >
            수정
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(post.id, post.title)}
            loading={isDeleting === post.id}
            disabled={isDeleting === post.id}
          >
            {isDeleting === post.id ? '삭제 중...' : '삭제'}
          </Button>
        </>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-8">
          <LoadingSpinner />
          <p className="text-gray-500 mt-2">공고 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (jobPostings.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">📋</div>
          <p className="text-gray-500">등록된 공고가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">새 공고를 작성해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">등록된 공고 ({jobPostings.length}개)</h2>
      </div>

      <div className="divide-y divide-gray-200">
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
});

export default JobPostingList;