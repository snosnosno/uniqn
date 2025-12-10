import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useChipBalance } from '../../hooks/useChipBalance';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { ChipTransactionView, ChipTransactionType } from '../../types/payment/chip';

/**
 * 칩 사용 내역 페이지
 *
 * 기능:
 * - 칩 거래 내역 표시 (구매, 사용, 환불, 보너스)
 * - 타입별 필터링
 * - 검색 기능
 * - 페이지네이션
 * - 엑셀 다운로드 (추후 구현)
 */
const ChipHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { recentTransactions, fetchRecentTransactions, isLoading } = useChipBalance();

  const [filterType, setFilterType] = useState<ChipTransactionType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<ChipTransactionView[]>([]);

  /**
   * 트랜잭션 타입 번역
   */
  const getTypeLabel = (type: ChipTransactionType): string => {
    const labels: Record<ChipTransactionType, string> = {
      grant: t('chipHistory.filter.grant'),
      purchase: t('chipHistory.filter.purchase'),
      use: t('chipHistory.filter.use'),
      expire: t('chipHistory.filter.expire'),
      refund: t('chipHistory.filter.refund'),
    };
    return labels[type] || type;
  };

  /**
   * 트랜잭션 타입 스타일
   */
  const getTypeStyle = (type: ChipTransactionType): string => {
    const styles: Record<ChipTransactionType, string> = {
      grant: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
      purchase: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
      use: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300',
      expire: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      refund: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
    };
    return styles[type] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };

  /**
   * 필터링 및 검색
   */
  useEffect(() => {
    let filtered = recentTransactions;

    // 타입 필터
    if (filterType !== 'all') {
      filtered = filtered.filter((tx) => tx.type === filterType);
    }

    // 검색
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.description.toLowerCase().includes(query) ||
          tx.metadata?.packageId?.toLowerCase().includes(query) ||
          tx.metadata?.transactionId?.toLowerCase().includes(query)
      );
    }

    setFilteredTransactions(filtered);
  }, [recentTransactions, filterType, searchQuery]);

  /**
   * 거래 내역 갱신
   */
  const handleRefresh = () => {
    fetchRecentTransactions(50);
  };

  useEffect(() => {
    if (currentUser) {
      fetchRecentTransactions(50);
    }
  }, [currentUser, fetchRecentTransactions]);

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-8 text-center shadow-md">
          <p className="text-gray-900 dark:text-gray-100">{t('chipHistory.loginRequired')}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            {t('chipHistory.login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {t('chipHistory.back')}
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('chipHistory.title')}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('chipHistory.subtitle')}</p>
        </div>

        {/* 필터 및 검색 */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* 타입 필터 */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ChipTransactionType | 'all')}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="all">{t('chipHistory.filter.all')}</option>
              <option value="grant">{t('chipHistory.filter.grant')}</option>
              <option value="purchase">{t('chipHistory.filter.purchase')}</option>
              <option value="use">{t('chipHistory.filter.use')}</option>
              <option value="expire">{t('chipHistory.filter.expire')}</option>
              <option value="refund">{t('chipHistory.filter.refund')}</option>
            </select>
          </div>

          {/* 검색 */}
          <div className="relative flex-1 sm:max-w-xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-10 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {/* 새로고침 버튼 */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="rounded-md bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? t('chipHistory.loading') : t('chipHistory.refresh')}
          </button>
        </div>

        {/* 거래 내역 테이블 */}
        {filteredTransactions.length === 0 ? (
          <div className="rounded-lg bg-white dark:bg-gray-800 p-12 text-center shadow-md">
            <p className="text-gray-500 dark:text-gray-400">{t('chipHistory.empty')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('chipHistory.table.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('chipHistory.table.type')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('chipHistory.table.description')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('chipHistory.table.chipType')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('chipHistory.table.amount')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('chipHistory.table.balance')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {format(tx.createdAt, 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getTypeStyle(tx.type)}`}
                        >
                          {getTypeLabel(tx.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {tx.description}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {tx.chipType === 'red' && (
                          <span className="text-red-600 dark:text-red-400">
                            {t('chipHistory.chipTypes.red')}
                          </span>
                        )}
                        {tx.chipType === 'blue' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {t('chipHistory.chipTypes.blue')}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end">
                          {tx.amount > 0 ? (
                            <>
                              <ArrowUpIcon className="mr-1 h-4 w-4 text-green-500 dark:text-green-400" />
                              <span className="text-green-600 dark:text-green-400">
                                +{tx.amount.toLocaleString()}
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDownIcon className="mr-1 h-4 w-4 text-red-500 dark:text-red-400" />
                              <span className="text-red-600 dark:text-red-400">
                                {tx.amount.toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900 dark:text-gray-100">
                        {tx.balanceAfter.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 페이지네이션 (추후 구현) */}
        {/* <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            1-10 of 100 results
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border px-3 py-1 text-sm">이전</button>
            <button className="rounded-md border px-3 py-1 text-sm">다음</button>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default ChipHistoryPage;
