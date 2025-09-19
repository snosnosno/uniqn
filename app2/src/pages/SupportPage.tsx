/**
 * SupportPage - 문의/FAQ 및 고객지원 페이지
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaQuestionCircle,
  FaEnvelope,
  FaChevronDown,
  FaChevronUp,
  FaPaperPlane,
  FaExclamationTriangle
} from '../components/Icons/ReactIconsReplacement';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Inquiry,
  InquiryCreateInput,
  InquiryCategory,
  INQUIRY_CATEGORIES,
  INQUIRY_STATUS_STYLES,
  FAQ_ITEMS,
  FAQItem
} from '../types/inquiry';

interface FAQItemComponentProps {
  faq: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItemComponent: React.FC<FAQItemComponentProps> = ({ faq, isOpen, onToggle }) => {
  const { t } = useTranslation();

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-900">
          {t(faq.questionKey)}
        </span>
        {isOpen ? (
          <FaChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <FaChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-3 text-gray-600 border-t border-gray-100">
          <div className="pt-3">
            {t(faq.answerKey)}
          </div>
        </div>
      )}
    </div>
  );
};

const SupportPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  // FAQ 상태
  const [openFAQItems, setOpenFAQItems] = useState<Set<string>>(new Set());
  const [selectedFAQCategory, setSelectedFAQCategory] = useState<InquiryCategory | 'all'>('all');

  // 문의하기 폼 상태
  const [inquiryForm, setInquiryForm] = useState({
    category: 'general' as InquiryCategory,
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 내 문의 내역
  const [myInquiries, setMyInquiries] = useState<Inquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);

  // 활성 탭
  const [activeTab, setActiveTab] = useState<'faq' | 'inquiry' | 'my-inquiries'>('faq');

  // FAQ 필터링
  const filteredFAQs = useMemo(() => {
    if (selectedFAQCategory === 'all') {
      return FAQ_ITEMS.filter(faq => faq.isActive);
    }
    return FAQ_ITEMS.filter(faq => faq.category === selectedFAQCategory && faq.isActive);
  }, [selectedFAQCategory]);

  // 내 문의 내역 구독
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!currentUser || activeTab !== 'my-inquiries') return;

    setLoadingInquiries(true);
    setInquiriesError(null);

    logger.info('문의 내역 조회 시작', {
      userId: currentUser.uid,
      component: 'SupportPage'
    });

    // 타임아웃 설정 (10초)
    const timeoutId = setTimeout(() => {
      logger.warn('문의 내역 조회 타임아웃', { component: 'SupportPage' });
      setLoadingInquiries(false);
      setInquiriesError('조회 시간이 초과되었습니다. 새로고침 후 다시 시도해주세요.');
    }, 10000);

    // 먼저 orderBy 없이 시도 (인덱스 문제 우회)
    const trySimpleQuery = () => {
      logger.info('Simple query 시작', {
        userId: currentUser.uid,
        component: 'SupportPage'
      });

      const simpleQuery = query(
        collection(db, 'inquiries'),
        where('userId', '==', currentUser.uid)
      );

      return onSnapshot(
        simpleQuery,
        (snapshot) => {
          logger.info('문의 내역 조회 성공 (simple query)', {
            docCount: snapshot.docs.length,
            component: 'SupportPage',
            userId: currentUser.uid
          });


          const inquiries = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
              id: doc.id,
              ...data,
              // Timestamp 변환 확인
              createdAt: data.createdAt || Timestamp.now(),
              updatedAt: data.updatedAt || Timestamp.now(),
              respondedAt: data.respondedAt || null
            } as Inquiry;
          }).sort((a, b) => {
            // 클라이언트 사이드에서 정렬
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });

          logger.info('문의 내역 조회 완료', {
            count: inquiries.length,
            component: 'SupportPage'
          });

          setMyInquiries(inquiries);
          setLoadingInquiries(false);
          setInquiriesError(null);
          clearTimeout(timeoutId);
        },
        (error) => {
          logger.error('Simple 쿼리도 실패:', error instanceof Error ? error : new Error(String(error)), {
            userId: currentUser.uid,
            errorCode: error.code || 'unknown',
            errorMessage: error.message || String(error),
            component: 'SupportPage'
          });

          // 더 구체적인 에러 메시지
          const errorMessage = error.code === 'permission-denied'
            ? '문의 내역에 접근할 권한이 없습니다.'
            : '문의 내역을 불러오는데 실패했습니다.';

          setInquiriesError(errorMessage);
          showError(errorMessage);
          setLoadingInquiries(false);
          clearTimeout(timeoutId);
        }
      );
    };

    // 단순한 쿼리부터 시작 (인덱스 문제 방지)
    logger.info('단순 쿼리로 문의 내역 조회 시작', {
      userId: currentUser.uid,
      component: 'SupportPage'
    });

    const unsubscribe = trySimpleQuery();

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [currentUser, activeTab]); // showError 제거: useCallback으로 메모이제이션되어 안정적임

  // FAQ 토글
  const toggleFAQ = (faqId: string) => {
    const newOpenItems = new Set(openFAQItems);
    if (newOpenItems.has(faqId)) {
      newOpenItems.delete(faqId);
    } else {
      newOpenItems.add(faqId);
    }
    setOpenFAQItems(newOpenItems);
  };

  // 문의 제출
  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showError('로그인이 필요합니다.');
      return;
    }

    if (!inquiryForm.subject.trim() || !inquiryForm.message.trim()) {
      showError('제목과 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const inquiryData: InquiryCreateInput = {
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userName: currentUser.displayName || '사용자',
        category: inquiryForm.category,
        subject: inquiryForm.subject.trim(),
        message: inquiryForm.message.trim()
      };

      await addDoc(collection(db, 'inquiries'), {
        ...inquiryData,
        status: 'open',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      showSuccess('문의가 성공적으로 접수되었습니다.');

      // 폼 초기화
      setInquiryForm({
        category: 'general',
        subject: '',
        message: ''
      });

      // 내 문의 탭으로 이동
      setActiveTab('my-inquiries');

    } catch (error) {
      logger.error('문의 제출 실패:', error instanceof Error ? error : new Error(String(error)), {
        component: 'SupportPage'
      });
      showError('문의 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('support.title', '고객 지원')}
          </h1>
          <p className="text-lg text-gray-600">
            {t('support.subtitle', 'FAQ를 확인하거나 문의사항을 보내주세요')}
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'faq'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaQuestionCircle className="w-4 h-4 inline mr-2" />
            {t('support.tabs.faq', 'FAQ')}
          </button>

          <button
            onClick={() => setActiveTab('inquiry')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'inquiry'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FaEnvelope className="w-4 h-4 inline mr-2" />
            {t('support.tabs.inquiry', '문의하기')}
          </button>

          {currentUser && (
            <button
              onClick={() => setActiveTab('my-inquiries')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'my-inquiries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('support.tabs.myInquiries', '내 문의')}
              {myInquiries.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                  {myInquiries.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* FAQ 탭 */}
        {activeTab === 'faq' && (
          <div className="space-y-6">
            {/* 카테고리 필터 */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedFAQCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFAQCategory === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('support.faq.all', '전체')}
              </button>

              {INQUIRY_CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  onClick={() => setSelectedFAQCategory(category.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFAQCategory === category.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-1">{category.icon}</span>
                  {t(category.labelKey)}
                </button>
              ))}
            </div>

            {/* FAQ 목록 */}
            <div className="space-y-3">
              {filteredFAQs.map((faq) => (
                <FAQItemComponent
                  key={faq.id}
                  faq={faq}
                  isOpen={openFAQItems.has(faq.id)}
                  onToggle={() => toggleFAQ(faq.id)}
                />
              ))}

              {filteredFAQs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {t('support.faq.noResults', '해당 카테고리에 FAQ가 없습니다.')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 문의하기 탭 */}
        {activeTab === 'inquiry' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {!currentUser ? (
              <div className="text-center py-8">
                <FaExclamationTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('support.inquiry.loginRequired', '로그인이 필요합니다')}
                </h3>
                <p className="text-gray-600">
                  {t('support.inquiry.loginMessage', '문의를 작성하려면 먼저 로그인해주세요.')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-6">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('support.inquiry.category', '문의 분류')}
                  </label>
                  <select
                    id="category"
                    value={inquiryForm.category}
                    onChange={(e) => setInquiryForm(prev => ({
                      ...prev,
                      category: e.target.value as InquiryCategory
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {INQUIRY_CATEGORIES.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.icon} {t(category.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('support.inquiry.subject', '제목')}
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={inquiryForm.subject}
                    onChange={(e) => setInquiryForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder={t('support.inquiry.subjectPlaceholder', '문의 제목을 입력해주세요')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('support.inquiry.message', '내용')}
                  </label>
                  <textarea
                    id="message"
                    value={inquiryForm.message}
                    onChange={(e) => setInquiryForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder={t('support.inquiry.messagePlaceholder', '문의 내용을 자세히 작성해주세요')}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {t('support.inquiry.submitting', '제출 중...')}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <FaPaperPlane className="w-4 h-4 mr-2" />
                      {t('support.inquiry.submit', '문의 제출')}
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* 내 문의 탭 */}
        {activeTab === 'my-inquiries' && currentUser && (
          <div className="space-y-4">

            {loadingInquiries ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">{t('support.myInquiries.loading', '문의 내역을 불러오는 중...')}</p>
              </div>
            ) : inquiriesError ? (
              <div className="text-center py-8 bg-white rounded-lg">
                <FaExclamationTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  문의 내역 조회 실패
                </h3>
                <p className="text-gray-600 mb-4">{inquiriesError}</p>
                <button
                  onClick={() => {
                    setInquiriesError(null);
                    setActiveTab('faq');
                    setTimeout(() => setActiveTab('my-inquiries'), 100);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  다시 시도
                </button>
              </div>
            ) : myInquiries.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg">
                <FaEnvelope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('support.myInquiries.empty', '문의 내역이 없습니다')}
                </h3>
                <p className="text-gray-600">
                  {t('support.myInquiries.emptyMessage', '문의사항이 있으시면 언제든지 문의해주세요.')}
                </p>
              </div>
            ) : (
              myInquiries.map((inquiry) => {
                const statusStyle = INQUIRY_STATUS_STYLES[inquiry.status];
                return (
                  <div key={inquiry.id} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <h3 className="font-medium text-gray-900">{inquiry.subject}</h3>
                          {inquiry.category === 'report' && (
                            <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              🚨 신고
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {inquiry.createdAt.toDate().toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.color} ${statusStyle.bgColor}`}>
                        {t(statusStyle.labelKey)}
                      </span>
                    </div>

                    <div className="text-gray-700 mb-4 whitespace-pre-wrap">
                      {inquiry.message}
                    </div>

                    {/* 신고 메타데이터 표시 */}
                    {inquiry.category === 'report' && inquiry.reportMetadata && (
                      <div className="mb-4">
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                          <h4 className="font-medium text-red-800 mb-2 text-sm">신고 상세 정보</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="font-medium text-red-700">신고 대상:</span>
                              <span className="ml-1 text-red-800">{inquiry.reportMetadata.targetName}</span>
                            </div>
                            <div>
                              <span className="font-medium text-red-700">이벤트:</span>
                              <span className="ml-1 text-red-800">{inquiry.reportMetadata.eventTitle}</span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="font-medium text-red-700">날짜:</span>
                              <span className="ml-1 text-red-800">{inquiry.reportMetadata.date}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {inquiry.response && (
                      <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                        <h4 className="font-medium text-blue-900 mb-2">
                          {t('support.myInquiries.response', '답변')}
                        </h4>
                        <p className="text-blue-800 whitespace-pre-wrap">{inquiry.response}</p>
                        {inquiry.respondedAt && (
                          <p className="text-xs text-blue-600 mt-2">
                            {inquiry.respondedAt.toDate().toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportPage;