import React, { useContext, useState } from 'react';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { toast } from '../utils/toast';
import { IconType, FaUsers, FaClock, FaTrophy } from '../components/Icons/ReactIconsReplacement';

import { TournamentContext, Participant } from '../contexts/TournamentContext';
import { setupTestData } from '../firebase';

const TournamentDashboard = () => {
    const { t } = useTranslation();
    const context = useContext(TournamentContext);
    const [isSeeding, setIsSeeding] = useState(false);

    if (!context) {
        return <div>{t('common.messages.loading')}</div>;
    }

    const { state } = context;
    const { participants, tournamentStatus, blindLevel } = state;

    const handleSetupTestData = async () => {
        setIsSeeding(true);
        try {
            const result = await setupTestData();
            switch (result) {
                case 'SUCCESS':
                    toast.success(t('tournamentDashboard.seeding.success'));
                    window.location.reload();
                    break;
                case 'SKIPPED':
                    toast.info(t('tournamentDashboard.seeding.skipped'));
                    break;
                case 'ERROR':
                    toast.error(t('tournamentDashboard.seeding.error'));
                    break;
            }
        } catch (error) {
            logger.error('Error setting up test data:', error instanceof Error ? error : new Error(String(error)), { component: 'TournamentDashboard' });
            toast.error(t('tournamentDashboard.seeding.unexpectedError'));
        } finally {
            setIsSeeding(false);
        }
    };

    const totalBuyIn = participants.reduce((acc: number, p: Participant) => {
        const entryFee = 100000;
        const rebuyCost = 50000;
        return acc + entryFee + ((p.rebuyCount || 0) * rebuyCost);
    }, 0);
    const totalPrize = totalBuyIn;

    interface StatCardProps {
        icon: IconType;
        title: string;
        value: string | number;
        color: string;
    }

    const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center">
            <div className={`p-3 rounded-full mr-4 ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-sm text-gray-500">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="container text-gray-800">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('tournamentDashboard.title')}</h1>

            {process.env.NODE_ENV === 'development' && (
                <div className="mb-4 p-4 border border-red-400 bg-red-50 rounded-lg">
                    <h3 className="text-lg font-bold text-red-700 mb-2">{t('tournamentDashboard.devTools.title')}</h3>
                    <button
                        onClick={handleSetupTestData}
                        disabled={isSeeding}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {isSeeding ? t('tournamentDashboard.devTools.buttonSeeding') : t('tournamentDashboard.devTools.button')}
                    </button>
                    <p className="text-sm text-gray-600 mt-2">
                        {t('tournamentDashboard.devTools.description')}
                    </p>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    icon={FaUsers} 
                    title={t('tournamentDashboard.stats.totalParticipants')} 
                    value={participants.length}
                    color="bg-blue-500"
                />
                <StatCard 
                    icon={FaClock} 
                    title={t('tournamentDashboard.stats.currentBlindLevel')}
                    value={blindLevel !== null ? `#${blindLevel + 1}` : 'N/A'}
                    color="bg-green-500"
                />
                <StatCard 
                    icon={FaTrophy} 
                    title={t('tournamentDashboard.stats.estimatedPrizePool')}
                    value={`₩${totalPrize.toLocaleString()}`}
                    color="bg-yellow-500"
                />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">{t('tournamentDashboard.status.title')}</h2>
                <p className={`text-lg font-semibold ${tournamentStatus === 'running' ? 'text-green-500' : 'text-red-500'}`}>
                    {t(`tournamentDashboard.status.${tournamentStatus}`)}
                </p>
                <p className="text-gray-600 mt-2">
                    {t('tournamentDashboard.status.welcome')}
                </p>
            </div>
        </div>
    );
};

export default TournamentDashboard;
