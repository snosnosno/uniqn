/**
 * 환불 블랙리스트 관리 페이지
 *
 * 기능:
 * - 환불 블랙리스트 조회
 * - 블랙리스트 추가/제거
 * - 사용자 환불 이력 확인
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

interface RefundBlacklistEntry {
  id: string;
  userId: string;
  userEmail: string;
  reason: string;
  refundCount: number;
  blacklistedAt: Date;
  isPermanent: boolean;
}

interface UserRefundHistory {
  userId: string;
  userEmail: string;
  userName: string;
  refundCount: number;
  lastRefundDate?: Date;
  totalRefundAmount: number;
}

const RefundBlacklistPage: React.FC = () => {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [blacklist, setBlacklist] = useState<RefundBlacklistEntry[]>([]);
  const [refundHistory, setRefundHistory] = useState<UserRefundHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'blacklist' | 'history'>('blacklist');
  const [searchQuery, setSearchQuery] = useState('');

  // 관리자 권한 확인
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      logger.warn('RefundBlacklistPage: 관리자 권한 필요');
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);

    try {
      await Promise.all([loadBlacklist(), loadRefundHistory()]);
    } catch (error) {
      logger.error('RefundBlacklistPage: 데이터 로딩 실패', error as Error);
    } finally {
      setLoading(false);
    }
  };

  const loadBlacklist = async () => {
    try {
      const q = query(collection(db, 'refundBlacklist'), orderBy('blacklistedAt', 'desc'));

      const snapshot = await getDocs(q);

      const entries: RefundBlacklistEntry[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          userEmail: data.userEmail,
          reason: data.reason,
          refundCount: data.refundCount,
          blacklistedAt: data.blacklistedAt.toDate(),
          isPermanent: data.isPermanent || false,
        };
      });

      setBlacklist(entries);
      logger.info('RefundBlacklistPage: 블랙리스트 로딩 완료', { count: entries.length });
    } catch (error) {
      logger.error('RefundBlacklistPage: 블랙리스트 로딩 실패', error as Error);
    }
  };

  const loadRefundHistory = async () => {
    try {
      // 모든 완료된 환불 요청 조회
      const q = query(
        collection(db, 'refundRequests'),
        where('status', 'in', ['approved', 'completed']),
        orderBy('requestedAt', 'desc')
      );

      const snapshot = await getDocs(q);

      // 사용자별로 그룹화
      const userMap = new Map<string, UserRefundHistory>();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId;

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            userEmail: data.userEmail,
            userName: data.userName,
            refundCount: 0,
            totalRefundAmount: 0,
          });
        }

        const user = userMap.get(userId)!;
        user.refundCount += 1;
        user.totalRefundAmount += data.refundAmount || 0;

        const requestedAt = data.requestedAt?.toDate();
        if (requestedAt && (!user.lastRefundDate || requestedAt > user.lastRefundDate)) {
          user.lastRefundDate = requestedAt;
        }
      });

      const history = Array.from(userMap.values()).sort((a, b) => b.refundCount - a.refundCount);

      setRefundHistory(history);
      logger.info('RefundBlacklistPage: 환불 이력 로딩 완료', { count: history.length });
    } catch (error) {
      logger.error('RefundBlacklistPage: 환불 이력 로딩 완료', error as Error);
    }
  };

  const handleAddToBlacklist = async (user: UserRefundHistory) => {
    // 사유를 입력하는 간단한 방법: 기본 사유 사용
    const reason = `반복적인 환불 요청 (${user.refundCount}회)`;

    try {
      const blacklistRef = doc(db, 'refundBlacklist', user.userId);
      await setDoc(blacklistRef, {
        id: user.userId,
        userId: user.userId,
        userEmail: user.userEmail,
        reason,
        refundCount: user.refundCount,
        blacklistedAt: Timestamp.now(),
        isPermanent: true,
      });

      logger.info('RefundBlacklistPage: 블랙리스트 추가 완료', { userId: user.userId });
      toast.success(t('toast.blacklist.addSuccess', { email: user.userEmail }));

      await loadBlacklist();
    } catch (error) {
      logger.error('RefundBlacklistPage: 블랙리스트 추가 실패', error as Error);
      toast.error(t('toast.blacklist.addFailed'));
    }
  };

  const handleRemoveFromBlacklist = async (entry: RefundBlacklistEntry) => {
    try {
      await deleteDoc(doc(db, 'refundBlacklist', entry.id));

      logger.info('RefundBlacklistPage: 블랙리스트 제거 완료', { userId: entry.userId });
      toast.success(t('toast.blacklist.removeSuccess', { email: entry.userEmail }));

      await loadBlacklist();
    } catch (error) {
      logger.error('RefundBlacklistPage: 블랙리스트 제거 실패', error as Error);
      toast.error(t('toast.blacklist.removeFailed'));
    }
  };

  const filteredBlacklist = blacklist.filter(
    (entry) =>
      entry.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = refundHistory.filter(
    (user) =>
      user.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            접근 권한이 없습니다
          </h1>
          <p className="text-gray-600 dark:text-gray-300">관리자만 접근 가능한 페이지입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">환불 블랙리스트 관리</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">환불 남용 사용자를 관리합니다.</p>
        </div>

        {/* 탭 */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('blacklist')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'blacklist'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              블랙리스트 ({blacklist.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              환불 이력 ({refundHistory.length})
            </button>
          </nav>
        </div>

        {/* 검색 */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="이메일 또는 사유로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
          </div>
        ) : (
          <>
            {/* 블랙리스트 탭 */}
            {activeTab === 'blacklist' && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        사용자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        사유
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        환불 횟수
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        등록일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        유형
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredBlacklist.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                        >
                          블랙리스트가 비어있습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredBlacklist.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {entry.userEmail}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {entry.userId}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                              {entry.reason}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {entry.refundCount}회
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {entry.blacklistedAt.toLocaleDateString('ko-KR')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                entry.isPermanent
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}
                            >
                              {entry.isPermanent ? '영구' : '임시'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleRemoveFromBlacklist(entry)}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            >
                              제거
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 환불 이력 탭 */}
            {activeTab === 'history' && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        사용자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        환불 횟수
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        총 환불 금액
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        마지막 환불일
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                        >
                          환불 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((user) => {
                        const isBlacklisted = blacklist.some(
                          (entry) => entry.userId === user.userId
                        );

                        return (
                          <tr
                            key={user.userId}
                            className={isBlacklisted ? 'bg-red-50 dark:bg-red-900/10' : ''}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {user.userName}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {user.userEmail}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div
                                className={`text-sm font-semibold ${
                                  user.refundCount >= 3
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {user.refundCount}회
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-white">
                                {user.totalRefundAmount.toLocaleString()}원
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-white">
                                {user.lastRefundDate?.toLocaleDateString('ko-KR') || '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {isBlacklisted ? (
                                <span className="text-red-600 dark:text-red-400 font-semibold">
                                  블랙리스트
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAddToBlacklist(user)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                                  disabled={user.refundCount < 3}
                                >
                                  블랙리스트 추가
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RefundBlacklistPage;
