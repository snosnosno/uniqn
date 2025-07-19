import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// 임시 데이터
const dummyTournaments = [
    { id: 't1', name: '데일리 토너먼트 #1', date: '2023-10-26', status: 'completed', playerCount: 50, winner: 'Player A' },
    { id: 't2', name: '위클리 스페셜', date: '2023-10-22', status: 'completed', playerCount: 80, winner: 'Player B' },
];

const HistoryPage: React.FC = () => {
    const { t } = useTranslation();
    const [tournaments, setTournaments] = useState<any[]>([]);
    
    useEffect(() => {
        // const fetchTournaments = async () => {
        //     const result = await getCompletedTournaments();
        //     setTournaments(result);
        // };
        // fetchTournaments();
        setTournaments(dummyTournaments); // 임시 데이터 사용
    }, []);

    return (
        <div className="card max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">{t('historyPage.title')}</h2>
            <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                    <thead className="bg-gray-700">
                        <tr className="text-left text-gray-300">
                            <th className="p-3">{t('historyPage.tournamentName')}</th>
                            <th className="p-3">{t('historyPage.date')}</th>
                            <th className="p-3">{t('historyPage.participants')}</th>
                            <th className="p-3">{t('historyPage.winner')}</th>
                            <th className="p-3 text-right">{t('historyPage.details')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-600">
                        {tournaments.map((tournament) => (
                            <tr key={tournament.id} className="hover:bg-gray-700">
                                <td className="p-3">{tournament.name}</td>
                                <td className="p-3">{tournament.date}</td>
                                <td className="p-3">{tournament.playerCount}</td>
                                <td className="p-3">{tournament.winner || '-'}</td>
                                <td className="p-3 text-right">
                                    <Link to={`/history/${tournament.id}`} className="btn btn-primary text-xs">
                                        {t('historyPage.viewResults')}
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HistoryPage;
