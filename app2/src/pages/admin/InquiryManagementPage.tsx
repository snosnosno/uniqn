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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Inquiry,
  InquiryStatus,
  InquiryCategory,
  INQUIRY_CATEGORIES,
  INQUIRY_STATUS_STYLES,
  InquiryUpdateInput,
} from '../../types/inquiry';
import { REPORT_TYPES, ReportType } from '../../types/report';

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
    search: '',
  });
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // 문의 목록 실시간 구독
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!currentUser) return;

    logger.info('문의 관리 페이지 초기화', {
      userId: currentUser.uid,
      component: 'InquiryManagementPage',
    });

    const inquiriesQuery = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      inquiriesQuery,
      (snapshot) => {
        const inquiryList = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Inquiry
        );

        logger.info(`문의 목록 조회 성공 - ${inquiryList.length}개`, {
          component: 'InquiryManagementPage',
        });

        setInquiries(inquiryList);
        setLoading(false);
      },
      (error) => {
        logger.error(
          '문의 목록 조회 실패:',
          error instanceof Error ? error : new Error(String(error)),
          {
            component: 'InquiryManagementPage',
          }
        );
        showError(t('toast.inquiry.loadError'));
        setLoading(false);
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // showError 제거: useCallback으로 메모이제이션되어 안정적임

  // 필터링된 문의 목록
  const filteredInquiries = useMemo(() => {
    let filtered = [...inquiries];

    // 상태 필터
    if (filters.status !== 'all') {
      filtered = filtered.filter((inquiry) => inquiry.status === filters.status);
    }

    // 카테고리 필터
    if (filters.category !== 'all') {
      filtered = filtered.filter((inquiry) => inquiry.category === filters.category);
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

      filtered = filtered.filter((inquiry) => inquiry.createdAt.toDate() >= filterDate);
    }

    // 검색 필터
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (inquiry) =>
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
        const statusOrder = { open: 0, in_progress: 1, closed: 2 };
        filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
    }

    return filtered;
  }, [inquiries, filters, sortBy]);

  // 통계 계산
  const stats = useMemo(
    () => ({
      total: inquiries.length,
      open: inquiries.filter((i) => i.status === 'open').length,
      inProgress: inquiries.filter((i) => i.status === 'in_progress').length,
      closed: inquiries.filter((i) => i.status === 'closed').length,
    }),
    [inquiries]
  );

  // 상태 변경
  const handleStatusChange = async (inquiryId: string, newStatus: InquiryStatus) => {
    if (!currentUser) return;

    setUpdatingStatus(true);
    try {
      const updateData: InquiryUpdateInput = {
        status: newStatus,
        ...(newStatus === 'in_progress' && {
          responderId: currentUser.uid,
          responderName: currentUser.displayName || '관리자',
        }),
      };

      await updateDoc(doc(db, 'inquiries', inquiryId), {
        ...updateData,
        updatedAt: Timestamp.now(),
      });

      showSuccess(t('toast.inquiry.statusChangeSuccess'));
      logger.info('문의 상태 변경 성공', {
        inquiryId,
        newStatus,
        userId: currentUser.uid,
        component: 'InquiryManagementPage',
      });
    } catch (error) {
      logger.error(
        '문의 상태 변경 실패:',
        error instanceof Error ? error : new Error(String(error)),
        {
          inquiryId,
          newStatus,
          component: 'InquiryManagementPage',
        }
      );
      showError(t('toast.inquiry.statusChangeError'));
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
        updatedAt: Timestamp.now(),
      });

      showSuccess(t('toast.inquiry.responseSaveSuccess'));
      setShowModal(false);
      setResponse('');
      setSelectedInquiry(null);

      logger.info('문의 답변 저장 성공', {
        inquiryId: selectedInquiry.id,
        userId: currentUser.uid,
        component: 'InquiryManagementPage',
      });
    } catch (error) {
      logger.error(
        '문의 답변 저장 실패:',
        error instanceof Error ? error : new Error(String(error)),
        {
          inquiryId: selectedInquiry.id,
          component: 'InquiryManagementPage',
        }
      );
      showError(t('toast.inquiry.responseSaveError'));
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

  // userName에서 순수 이름만 추출 (JSON 데이터 제거)
  const extractUserName = (userName: string): string => {
    if (!userName) return t('inquiry.unknown');
    // "[" 이전의 텍스트만 추출하고 trim
    const bracketIndex = userName.indexOf('[');
    if (bracketIndex > 0) {
      return userName.substring(0, bracketIndex).trim();
    }
    return userName.trim();
  };

  // message에서 JSON 데이터 제거 (신고 상세정보는 별도 섹션에 표시)
  const extractMessage = (message: string): string => {
    if (!message) return '';
    // "[" 또는 "{" 이전의 텍스트만 추출
    const bracketIndex = message.indexOf('[');
    const braceIndex = message.indexOf('{');

    let cutIndex = -1;
    if (bracketIndex > 0 && braceIndex > 0) {
      cutIndex = Math.min(bracketIndex, braceIndex);
    } else if (bracketIndex > 0) {
      cutIndex = bracketIndex;
    } else if (braceIndex > 0) {
      cutIndex = braceIndex;
    }

    if (cutIndex > 0) {
      return message.substring(0, cutIndex).trim();
    }
    return message.trim();
  };

  // 날짜 포맷팅
  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 카테고리 아이콘 및 이름 가져오기
  const getCategoryInfo = (category: InquiryCategory) => {
    const categoryInfo = INQUIRY_CATEGORIES.find((cat) => cat.key === category);
    return {
      icon: categoryInfo?.icon || '❓',
      name: t(categoryInfo?.labelKey || 'inquiry.categories.other.label'),
    };
  };

  // 신고 유형 번역
  const getReportTypeName = (type: string): string => {
    const reportType = REPORT_TYPES.find((rt) => rt.key === (type as ReportType));
    return reportType ? t(reportType.labelKey) : type;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('inquiry.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">{t('inquiry.subtitle')}</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaEnvelope className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('inquiry.stats.total')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaClock className="h-8 w-8 text-red-500 dark:text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('inquiry.stats.open')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.open}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaReply className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('inquiry.stats.inProgress')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.inProgress}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
          <div className="flex items-center">
            <FaCheck className="h-8 w-8 text-green-500 dark:text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('inquiry.stats.closed')}
              </p>
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
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
            <input
              type="text"
              placeholder={t('inquiry.filter.searchPlaceholder')}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* 상태 필터 */}
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value as InquiryStatus | 'all' }))
            }
          >
            <option value="all">{t('inquiry.filter.allStatus')}</option>
            <option value="open">{t('inquiry.status.open')}</option>
            <option value="in_progress">{t('inquiry.status.inProgress')}</option>
            <option value="closed">{t('inquiry.status.closed')}</option>
          </select>

          {/* 카테고리 필터 */}
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filters.category}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                category: e.target.value as InquiryCategory | 'all',
              }))
            }
          >
            <option value="all">{t('inquiry.filter.allCategory')}</option>
            <option value="report">🚨 {t('inquiry.report')}</option>
            {INQUIRY_CATEGORIES.filter((cat) => cat.key !== 'report').map((category) => (
              <option key={category.key} value={category.key}>
                {category.icon} {t(category.labelKey)}
              </option>
            ))}
          </select>

          {/* 날짜 필터 */}
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filters.dateRange}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: e.target.value as InquiryFilters['dateRange'],
              }))
            }
          >
            <option value="all">{t('inquiry.filter.allPeriod')}</option>
            <option value="today">{t('inquiry.filter.today')}</option>
            <option value="week">{t('inquiry.filter.week')}</option>
            <option value="month">{t('inquiry.filter.month')}</option>
          </select>

          {/* 정렬 */}
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="newest">{t('inquiry.filter.newest')}</option>
            <option value="oldest">{t('inquiry.filter.oldest')}</option>
            <option value="status">{t('inquiry.filter.byStatus')}</option>
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
                  {t('inquiry.table.inquiryInfo')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('inquiry.table.author')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('inquiry.table.category')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('inquiry.table.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('inquiry.table.createdAt')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {t('inquiry.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    {t('inquiry.empty')}
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
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                              {inquiry.subject}
                            </span>
                            {inquiry.category === 'report' && (
                              <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 text-xs font-medium rounded-full">
                                {t('inquiry.report')}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {inquiry.message}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {extractUserName(inquiry.userName)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {inquiry.userEmail}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-sm text-gray-900 dark:text-gray-100">
                          <span className="mr-1">{categoryInfo.icon}</span>
                          {categoryInfo.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bgColor} ${statusStyle.color}`}
                        >
                          {t(statusStyle.labelKey)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(inquiry.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewInquiry(inquiry)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <FaEye className="h-4 w-4 mr-1" />
                            {t('inquiry.view')}
                          </button>
                          {inquiry.status !== 'closed' && (
                            <select
                              className="text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={inquiry.status}
                              onChange={(e) =>
                                handleStatusChange(inquiry.id, e.target.value as InquiryStatus)
                              }
                              disabled={updatingStatus}
                            >
                              <option value="open">{t('inquiry.status.open')}</option>
                              <option value="in_progress">{t('inquiry.status.inProgress')}</option>
                              <option value="closed">{t('inquiry.status.closed')}</option>
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
              <div
                className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"
                onClick={() => setShowModal(false)}
              ></div>
            </div>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('inquiry.detail.title')}
                  </h3>
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-500 dark:text-gray-400">
                          {t('inquiry.detail.author')}:
                        </span>
                        <span className="ml-2 dark:text-gray-300">
                          {extractUserName(selectedInquiry.userName)}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500 dark:text-gray-400">
                          {t('inquiry.detail.email')}:
                        </span>
                        <span className="ml-2 dark:text-gray-300">{selectedInquiry.userEmail}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500 dark:text-gray-400">
                          {t('inquiry.detail.category')}:
                        </span>
                        <span className="ml-2 dark:text-gray-300">
                          {getCategoryInfo(selectedInquiry.category).name}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500 dark:text-gray-400">
                          {t('inquiry.detail.createdAt')}:
                        </span>
                        <span className="ml-2 dark:text-gray-300">
                          {formatDate(selectedInquiry.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('inquiry.detail.subject')}
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300">{selectedInquiry.subject}</p>
                </div>

                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {t('inquiry.detail.content')}
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {extractMessage(selectedInquiry.message)}
                    </p>
                  </div>
                </div>

                {/* 신고 메타데이터 표시 */}
                {selectedInquiry.category === 'report' && selectedInquiry.reportMetadata && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {t('inquiry.detail.reportDetail')}
                    </h4>
                    <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg border border-red-200 dark:border-red-700">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-red-700 dark:text-red-300">
                            {t('inquiry.detail.reportType')}:
                          </span>
                          <span className="ml-2 text-red-800 dark:text-red-200">
                            {getReportTypeName(selectedInquiry.reportMetadata.type)}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700 dark:text-red-300">
                            {t('inquiry.detail.reporterType')}:
                          </span>
                          <span className="ml-2 text-red-800 dark:text-red-200">
                            {selectedInquiry.reportMetadata.reporterType === 'employer'
                              ? t('inquiry.reporterTypes.employer')
                              : t('inquiry.reporterTypes.staff')}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700 dark:text-red-300">
                            {t('inquiry.detail.reportTarget')}:
                          </span>
                          <span className="ml-2 text-red-800 dark:text-red-200">
                            {selectedInquiry.reportMetadata.targetName}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700 dark:text-red-300">
                            {t('inquiry.detail.event')}:
                          </span>
                          <span className="ml-2 text-red-800 dark:text-red-200">
                            {selectedInquiry.reportMetadata.eventTitle}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-red-700 dark:text-red-300">
                            {t('inquiry.detail.date')}:
                          </span>
                          <span className="ml-2 text-red-800 dark:text-red-200">
                            {selectedInquiry.reportMetadata.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedInquiry.response && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {t('inquiry.detail.adminResponse')}
                    </h4>
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {selectedInquiry.response}
                      </p>
                      {selectedInquiry.respondedAt && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          {t('inquiry.detail.responseDate')}:{' '}
                          {formatDate(selectedInquiry.respondedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedInquiry.status !== 'closed' && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {t('inquiry.detail.writeResponse')}
                    </h4>
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={t('inquiry.detail.responsePlaceholder')}
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {selectedInquiry.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={handleSaveResponse}
                    disabled={!response.trim() || updatingStatus}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 dark:bg-blue-700 text-base font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? t('inquiry.saving') : t('inquiry.saveResponse')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-600 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('inquiry.close')}
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
