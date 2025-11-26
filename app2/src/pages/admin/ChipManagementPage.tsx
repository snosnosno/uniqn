import React, { useState } from 'react';
import { ManualChipGrant } from '../../components/admin/ManualChipGrant';
import { GiftIcon, ChartBarIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

/**
 * 관리자 칩 관리 페이지
 *
 * 기능:
 * - 수동 칩 지급
 * - 칩 통계 대시보드 (추후 구현)
 * - 환불 요청 관리 (추후 구현)
 * - 칩 거래 내역 조회 (추후 구현)
 */
const ChipManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'grant' | 'stats' | 'refunds' | 'history'>('grant');

  const tabs = [
    { id: 'grant' as const, label: '수동 칩 지급', icon: GiftIcon },
    { id: 'stats' as const, label: '칩 통계', icon: ChartBarIcon },
    { id: 'refunds' as const, label: '환불 관리', icon: CurrencyDollarIcon },
    { id: 'history' as const, label: '거래 내역', icon: ClockIcon },
  ];

  const handleGrantSuccess = () => {
    // 성공 시 통계 갱신 등 추가 작업 가능
    // 추후 통계 데이터 갱신 로직 추가 예정
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">칩 관리</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">칩 지급, 환불, 통계를 관리합니다</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${
                        activeTab === tab.id
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                      }
                    `}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 탭 컨텐츠 */}
        <div>
          {activeTab === 'grant' && <ManualChipGrant onSuccess={handleGrantSuccess} />}

          {activeTab === 'stats' && (
            <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md">
              <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
                칩 통계 대시보드
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* 총 칩 발행량 */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                          총 칩 발행량
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                          준비 중
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>

                {/* 오늘 판매액 */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CurrencyDollarIcon className="h-8 w-8 text-green-500 dark:text-green-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                          오늘 판매액
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                          준비 중
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>

                {/* 이번 달 판매액 */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                          이번 달 판매액
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                          준비 중
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>

                {/* 환불 대기 */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                          환불 대기
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                          준비 중
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 칩 통계 기능은 추후 업데이트 예정입니다
                </p>
              </div>
            </div>
          )}

          {activeTab === 'refunds' && (
            <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md">
              <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
                환불 요청 관리
              </h3>
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 환불 관리 기능은 추후 업데이트 예정입니다
                </p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md">
              <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
                칩 거래 내역
              </h3>
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 거래 내역 기능은 추후 업데이트 예정입니다
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChipManagementPage;
