import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { TournamentConfig } from '../../types/jobPosting/jobPosting';
import { logger } from '../../utils/logger';

interface RejectionReasonDisplayProps {
  tournamentConfig: TournamentConfig;
  className?: string;
  /** 접기/펼치기 기능 활성화 (기본값: false) */
  collapsible?: boolean;
  /** 초기 펼침 상태 (기본값: true) */
  defaultExpanded?: boolean;
}

/**
 * 대회 공고 거부 사유 표시 컴포넌트
 * rejected 상태일 때만 거부 사유와 거부 일시를 표시
 */
export const RejectionReasonDisplay: React.FC<RejectionReasonDisplayProps> = ({
  tournamentConfig,
  className = '',
  collapsible = false,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [adminName, setAdminName] = useState<string | null>(null);

  const { rejectionReason, rejectedAt, rejectedBy } = tournamentConfig;

  // 관리자 이름 조회
  useEffect(() => {
    const fetchAdminName = async () => {
      if (!rejectedBy) return;

      try {
        // 프로필에서 이름 조회
        const profileDocRef = doc(db, 'users', rejectedBy, 'profile', 'basic');
        const profileDoc = await getDoc(profileDocRef);

        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          if (profileData?.name) {
            setAdminName(profileData.name);
            return;
          }
        }

        // users 문서에서 이름 조회
        const userDocRef = doc(db, 'users', rejectedBy);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData?.displayName) {
            setAdminName(userData.displayName);
            return;
          }
          if (userData?.name) {
            setAdminName(userData.name);
            return;
          }
        }

        // 이름을 찾지 못한 경우 ID 유지
        logger.warn('관리자 이름을 찾을 수 없음', {
          component: 'RejectionReasonDisplay',
          data: { rejectedBy },
        });
      } catch (error) {
        logger.error(
          '관리자 정보 조회 실패',
          error instanceof Error ? error : new Error(String(error)),
          { component: 'RejectionReasonDisplay', data: { rejectedBy } }
        );
      }
    };

    fetchAdminName();
  }, [rejectedBy]);

  // rejected 상태가 아니면 렌더링하지 않음
  if (tournamentConfig.approvalStatus !== 'rejected') {
    return null;
  }

  // 거부 사유가 없으면 렌더링하지 않음
  if (!rejectionReason) {
    return null;
  }

  const formattedDate = rejectedAt
    ? format(rejectedAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko })
    : null;

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`mt-2 p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ${className}`}
    >
      {/* 헤더 */}
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={toggleExpanded}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleExpanded();
                }
              }
            : undefined
        }
      >
        <div className="flex items-center gap-1.5">
          <span className="text-red-600 dark:text-red-400 text-sm font-medium">거부 사유</span>
          {formattedDate && (
            <span className="text-red-500 dark:text-red-500 text-xs">({formattedDate})</span>
          )}
        </div>
        {collapsible && (
          <button
            type="button"
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            aria-label={isExpanded ? '접기' : '펼치기'}
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* 거부 사유 본문 */}
      {isExpanded && (
        <div className="mt-2">
          <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
            {rejectionReason}
          </p>
          {rejectedBy && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">
              처리자: {adminName || rejectedBy}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RejectionReasonDisplay;
