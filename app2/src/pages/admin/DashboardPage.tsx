import { StarIcon } from '@heroicons/react/24/solid';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DashboardCard } from '../../components/DashboardCard';
import { auth } from '../../firebase'; // Import auth

interface DashboardStats {
  ongoingEventsCount: number;
  totalDealersCount: number;
  topRatedDealers: {
    id: string;
    name: string;
    rating: number;
    ratingCount: number;
  }[];
}

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Authentication required. Please sign in.");
        }

        const idToken = await user.getIdToken();

        // The exact URL of your deployed HTTP function
        const functionUrl = 'https://us-central1-tholdem-ebc18.cloudfunctions.net/getDashboardStats';
        
        const response = await fetch(functionUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Use the error message from the backend if available
          throw new Error(errorData?.data?.error || `Request failed with status ${response.status}`);
        }

        const result = await response.json();
        setStats(result.data);

      } catch (err: any) {
        console.error("Error fetching dashboard stats:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="p-6 text-center font-semibold">{t('dashboard.loading')}</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600 bg-red-50 rounded-md">{t('dashboard.errorPrefix')}: {error}</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('dashboard.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <DashboardCard title={t('dashboard.ongoingEvents')}>
          <p className="text-5xl font-bold text-blue-600">{stats?.ongoingEventsCount ?? '0'}</p>
        </DashboardCard>

        <DashboardCard title={t('dashboard.totalDealers')}>
          <p className="text-5xl font-bold text-green-600">{stats?.totalDealersCount ?? '0'}</p>
        </DashboardCard>

        <DashboardCard title={t('dashboard.quickLinks')}>
            <div className="flex flex-col space-y-2">
                <a href="/admin/events" className="text-blue-500 hover:underline">{t('dashboard.manageEventsLink')}</a>
                <a href="/admin/payroll" className="text-blue-500 hover:underline">{t('dashboard.processPayrollLink')}</a>
            </div>
        </DashboardCard>
        
        <div className="md:col-span-2 lg:col-span-3">
            <DashboardCard title={t('dashboard.topRatedDealers')}>
                <ul className="space-y-3">
                {stats?.topRatedDealers && stats.topRatedDealers.length > 0 ? (
                    stats.topRatedDealers.map((dealer) => (
                    <li key={dealer.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-semibold text-gray-700">{dealer.name}</span>
                        <div className="flex items-center space-x-2">
                            <span className="font-bold text-yellow-500">{dealer.rating.toFixed(1)}</span>
                            <StarIcon className="h-5 w-5 text-yellow-400" />
                            <span className="text-sm text-gray-500">{t('dashboard.ratingsCount', { count: dealer.ratingCount })}</span>
                        </div>
                    </li>
                    ))
                ) : (
                    <p className="text-gray-500">{t('dashboard.noRatings')}</p>
                )}
                </ul>
          </DashboardCard>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
