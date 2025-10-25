/**
 * InquiryManagementPage - 문의 관리자 페이지
 * 관리자가 모든 문의를 조회하고 관리할 수 있는 페이지
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaSearch,
  // FaFilter, // 미래 필터링 UI용
  // FaSort, // 미래 정렬 UI용
  FaEye,
  FaReply,
  FaCheck,
  FaClock,
  FaEnvelope,
  // FaChevronDown // 미래 드롭다운 UI용
} from '../../components/Icons/ReactIconsReplacement';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { logger } from '../../utils/logger';
import {
  collection,
  // getDocs, // 미래 배치 조회용
  doc,
  updateDoc,
  query,
  orderBy,
  // where, // 미래 필터링용
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Inquiry,
  InquiryStatus,
  InquiryCategory,
  INQUIRY_CATEGORIES,
  INQUIRY_STATUS_STYLES,
  InquiryUpdateInput
} from '../../types/inquiry';

// 필터 인터페이스
interface InquiryFilters {
  status: InquiryStatus | 'all';
  category: InquiryCategory | 'all';
  dateRange: 'all' | 'today' | 'week' | 'month';
  search: string;
}

// 정렬 옵션
type SortOption = 'newest' | 'oldest' | 'status';

const InquiryManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  // 상태 관리
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [response, setResponse] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // 필터 및 정렬
  const [filters, setFilters] = useState<InquiryFilters>({
    status: 'all',
    category: 'all',
    dateRange: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // 문의 목록 실시간 구독
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!currentUser) return;

    logger.info('문의 관리 페이지 초기화', { userId: currentUser.uid, component: 'InquiryManagementPage' });

    const inquiriesQuery = query(
      collection(db, 'inquiries'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      inquiriesQuery,
      (snapshot) => {
        const inquiryList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Inquiry));

        logger.info(`문의 목록 조회 성공 - ${inquiryList.length}개`, {
          component: 'InquiryManagementPage'
        });

        setInquiries(inquiryList);
        setLoading(false);
      },
      (error) => {
        logger.error('문의 목록 조회 실패:', error instanceof Error ? error : new Error(String(error)), {
          component: 'InquiryManagementPage'
        });
        showError('문의 목록을 불러오는데 실패했습니다.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]); // showError 제거: useCallback으로 메모이제이션되어 안정적임

  // 필터링된 문의 목록
  const filteredInquiries = useMemo(() => {
    let filtered = [...inquiries];

    // 상태 필터
    if (filters.status !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.status === filters.status);
    }

    // 카테고리 필터
    if (filters.category !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.category === filters.category);
    }

    // 날짜 필터
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (filters.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter(inquiry =>
        inquiry.createdAt.toDate() >= filterDate
      );
    }

    // 검색 필터
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(inquiry =>
        inquiry.subject.toLowerCase().includes(searchTerm) ||
        inquiry.message.toLowerCase().includes(searchTerm) ||
        inquiry.userName.toLowerCase().includes(searchTerm) ||
        inquiry.userEmail.toLowerCase().includes(searchTerm)
      );
    }

    // 정렬
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime());
        break;
      case 'status':
        const statusOrder = { 'open': 0, 'in_progress': 1, 'closed': 2 };
        filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
    }

    return filtered;
  }, [inquiries, filters, sortBy]);

  // 통계 계산
  const stats = useMemo(() => ({
    total: inquiries.length,
    open: inquiries.filter(i => i.status === 'open').length,
    inProgress: inquiries.filter(i => i.status === 'in_progress').length,
    closed: inquiries.filter(i => i.status === 'closed').length
  }), [inquiries]);

  // 상태 변경
  const handleStatusChange = async (inquiryId: string, newStatus: InquiryStatus) => {
    if (!currentUser) return;

    setUpdatingStatus(true);
    try {
      const updateData: InquiryUpdateInput = {
        status: newStatus,
        ...(newStatus === 'in_progress' && {
          responderId: currentUser.uid,
          responderName: currentUser.displayName || '관리자'
        })
      };

      await updateDoc(doc(db, 'inquiries', inquiryId), {
        ...updateData,
        updatedAt: Timestamp.now()
      });

      showSuccess('문의 상태가 변경되었습니다.');
      logger.info('문의 상태 변경 성공', {
        inquiryId,
        newStatus,
        userId: currentUser.uid,
        component: 'InquiryManagementPage'
      });
    } catch (error) {
      logger.error('문의 상태 변경 실패:', error instanceof Error ? error : new Error(String(error)), {
        inquiryId,
        newStatus,
        component: 'InquiryManagementPage'
      });
      showError('문의 상태 변경에 실패했습니다.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // 답변 저장
  const handleSaveResponse = async () => {
    if (!selectedInquiry || !currentUser || !response.trim()) return;

    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'inquiries', selectedInquiry.id), {
        response: response.trim(),
        responderId: currentUser.uid,
        responderName: currentUser.displayName || '관리자',
        respondedAt: Timestamp.now(),
        status: 'closed',
        updatedAt: Timestamp.now()
      });

      showSuccess('답변이 저장되었습니다.');
      setShowModal(false);
      setResponse('');
      setSelectedInquiry(null);

      logger.info('문의 답변 저장 성공', {
        inquiryId: selectedInquiry.id,
        userId: currentUser.uid,
        component: 'InquiryManagementPage'
      });
    } catch (error) {
      logger.error('문의 답변 저장 실패:', error instanceof Error ? error : new Error(String(error)), {
        inquiryId: selectedInquiry.id,
        component: 'InquiryManagementPage'
      });
      showError('답변 저장에 실패했습니다.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // 문의 상세 보기
  const handleViewInquiry = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setResponse(inquiry.response || '');
    setShowModal(true);
  };

  // 날짜 포맷팅
  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 카테고리 아이콘 및 이름 가져오기
  const getCategoryInfo = (category: InquiryCategory) => {
    const categoryInfo = INQUIRY_CATEGORIES.find(cat => cat.key === category);
    return {
      icon: categoryInfo?.icon || '❓',
      name: t(categoryInfo?.labelKey || 'inquiry.categories.other.label')
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          문의 관리
        </h1>
        <p className="text-gray-600">고객 문의를 관리하고 답변할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaEnvelope className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">전체 문의</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaClock className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">대기중</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.open}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaReply className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">처리중</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaCheck className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">완료</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.closed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* 검색 */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="제목, 내용, 작성자 검색..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* 상태 필터 */}
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as InquiryStatus | 'all' }))}
          >
            <option value="all">모든 상태</option>
            <option value="open">대기중</option>
            <option value="in_progress">처리중</option>
            <option value="closed">완료</option>
          </select>

          {/* 카테고리 필터 */}
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value as InquiryCategory | 'all' }))}
          >
            <option value="all">모든 카테고리</option>
            <option value="report">🚨 신고</option>
            {INQUIRY_CATEGORIES.filter(cat => cat.key !== 'report').map((category) => (
              <option key={category.key} value={category.key}>
                {category.icon} {t(category.labelKey)}
              </option>
            ))}
          </select>

          {/* 날짜 필터 */}
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filters.dateRange}
            onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as InquiryFilters['dateRange'] }))}
          >
            <option value="all">전체 기간</option>
            <option value="today">오늘</option>
            <option value="week">최근 7일</option>
            <option value="month">최근 1개월</option>
          </select>

          {/* 정렬 */}
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="status">상태순</option>
          </select>
        </div>
      </div>

      {/* 문의 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  문의 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  작성자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  카테고리
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  작성일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    조건에 맞는 문의가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredInquiries.map((inquiry) => {
                  const categoryInfo = getCategoryInfo(inquiry.category);
                  const statusStyle = INQUIRY_STATUS_STYLES[inquiry.status];

                  return (
                    <tr key={inquiry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {inquiry.subject}
                            </span>
                            {inquiry.category === 'report' && (
                              <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                신고
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {inquiry.message}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {inquiry.userName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {inquiry.userEmail}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-sm text-gray-900">
                          <span className="mr-1">{categoryInfo.icon}</span>
                          {categoryInfo.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bgColor} ${statusStyle.color}`}>
                          {t(statusStyle.labelKey)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(inquiry.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewInquiry(inquiry)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <FaEye className="h-4 w-4 mr-1" />
                            보기
                          </button>
                          {inquiry.status !== 'closed' && (
                            <select
                              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={inquiry.status}
                              onChange={(e) => handleStatusChange(inquiry.id, e.target.value as InquiryStatus)}
                              disabled={updatingStatus}
                            >
                              <option value="open">대기중</option>
                              <option value="in_progress">처리중</option>
                              <option value="closed">완료</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 보기 모달 */}
      {showModal && selectedInquiry && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowModal(false)}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    문의 상세 정보
                  </h3>
                  <div className="border-b border-gray-200 pb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-500">작성자:</span>
                        <span className="ml-2">{selectedInquiry.userName}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">이메일:</span>
                        <span className="ml-2">{selectedInquiry.userEmail}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">카테고리:</span>
                        <span className="ml-2">{getCategoryInfo(selectedInquiry.category).name}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">작성일:</span>
                        <span className="ml-2">{formatDate(selectedInquiry.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">제목</h4>
                  <p className="text-gray-700">{selectedInquiry.subject}</p>
                </div>

                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">내용</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedInquiry.message}</p>
                  </div>
                </div>

                {/* 신고 메타데이터 표시 */}
                {selectedInquiry.category === 'report' && selectedInquiry.reportMetadata && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">신고 상세 정보</h4>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-red-700">신고 유형:</span>
                          <span className="ml-2 text-red-800">{selectedInquiry.reportMetadata.type}</span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700">신고자 유형:</span>
                          <span className="ml-2 text-red-800">
                            {selectedInquiry.reportMetadata.reporterType === 'employer' ? '관리자' : '직원'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700">신고 대상:</span>
                          <span className="ml-2 text-red-800">{selectedInquiry.reportMetadata.targetName}</span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700">이벤트:</span>
                          <span className="ml-2 text-red-800">{selectedInquiry.reportMetadata.eventTitle}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-red-700">날짜:</span>
                          <span className="ml-2 text-red-800">{selectedInquiry.reportMetadata.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedInquiry.response && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">관리자 답변</h4>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedInquiry.response}</p>
                      {selectedInquiry.respondedAt && (
                        <p className="text-sm text-gray-500 mt-2">
                          답변일: {formatDate(selectedInquiry.respondedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedInquiry.status !== 'closed' && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">답변 작성</h4>
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="고객에게 전달할 답변을 입력하세요..."
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {selectedInquiry.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={handleSaveResponse}
                    disabled={!response.trim() || updatingStatus}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? '저장 중...' : '답변 저장'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InquiryManagementPage;