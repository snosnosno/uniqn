import { useTranslation } from 'react-i18next';
import { BOARD_TABS } from '@/config/boardTabs';
import { PostingType } from '@/types/jobPosting/jobPosting';

interface JobBoardTabsProps {
  activeTab: PostingType | 'myApplications' | 'all';
  onTabChange: (tab: PostingType | 'myApplications' | 'all') => void;
}

export const JobBoardTabs: React.FC<JobBoardTabsProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  // Feature Flag으로 활성화된 탭만 필터링
  const enabledTabs = BOARD_TABS.filter(tab => tab.enabled);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav className="-mb-px flex space-x-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {enabledTabs.map((tab) => {
          const isActive = tab.postingType ? activeTab === tab.postingType : activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange((tab.postingType || tab.id) as PostingType | 'myApplications' | 'all')}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                border-b-2 -mb-px first:pl-1
                ${
                  isActive
                    ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-lg" role="img" aria-label={tab.id}>
                {tab.icon}
              </span>
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
