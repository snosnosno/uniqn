import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';

// 임시 데이터
const dummyTournaments = {
    t1: { id: 't1', name: '데일리 토너먼트 #1', date: '2023-10-26', playerCount: 50, winner: 'Player A', prizePool: 5000000, results: [
        { rank: 1, name: 'Player A', prize: 2500000 },
        { rank: 2, name: 'Player C', prize: 1500000 },
        { rank: 3, name: 'Player F', prize: 1000000 },
    ]},
    t2: { id: 't2', name: '위클리 스페셜', date: '2023-10-22', playerCount: 80, winner: 'Player B', prizePool: 10000000, results: [
        { rank: 1, name: 'Player B', prize: 5000000 },
        { rank: 2, name: 'Player D', prize: 3000000 },
        { rank: 3, name: 'Player E', prize: 2000000 },
    ]},
};

const HistoryDetailPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const [tournament, setTournament] = useState<any>(null);

    useEffect(() => {
        // 나중에는 API 호출로 대체
        if(id) {
            setTournament(dummyTournaments[id as keyof typeof dummyTournaments]);
        }
    }, [id]);
    
    const formatCurrency = (amount: number) => {
        const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';
        const currency = i18n.language === 'ko' ? 'KRW' : 'USD';
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
    }

    if (!tournament) {
        return <div className="card text-center">{t('historyDetail.loading')}</div>;
    }

    return (
        <div className="card max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">{t('historyDetail.title', { name: tournament.name })}</h2>
                <Link to="/history" className="btn btn-secondary">{t('historyDetail.backToList')}</Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                 <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="text-sm text-gray-400">{t('historyDetail.date')}</p>
                    <p className="text-lg font-bold">{tournament.date}</p>
                </div>
                <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="text-sm text-gray-400">{t('historyDetail.participants')}</p>
                    <p className="text-lg font-bold">{t('historyDetail.playerCount', { count: tournament.playerCount })}</p>
                </div>
                <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="text-sm text-gray-400">{t('historyDetail.prizePool')}</p>
                    <p className="text-lg font-bold">{formatCurrency(tournament.prizePool)}</p>
                </div>
                <div className="bg-gray-700 p-3 rounded-lg">
                    <p className="text-sm text-gray-400">{t('historyDetail.winner')}</p>
                    <p className="text-lg font-bold">{tournament.winner}</p>
                </div>
            </div>

            <h3 className="text-xl font-semibold mb-3">{t('historyDetail.finalRanking')}</h3>
            <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                    <thead className="bg-gray-700">
                        <tr className="text-left text-gray-300">
                            <th className="p-3">{t('historyDetail.rank')}</th>
                            <th className="p-3">{t('historyDetail.name')}</th>
                            <th className="p-3 text-right">{t('historyDetail.prize')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-600">
                        {tournament.results.map((r: any) => (
                            <tr key={r.rank} className="hover:bg-gray-700">
                                <td className="p-3 text-lg font-bold">{r.rank}</td>
                                <td className="p-3">{r.name}</td>
                                <td className="p-3 text-right font-mono">{formatCurrency(r.prize)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default HistoryDetailPage;
