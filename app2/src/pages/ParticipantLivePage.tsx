
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useTournament } from '../contexts/TournamentContext';

const ParticipantLivePage: React.FC = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const { state } = useTournament();
    
    // 'announcements'를 state 구조분해에서 제거했습니다.
    const { participants, settings, blindLevel, remainingTime } = state;
    const participant = participants.find(p => p.id === id);

    const currentBlind = settings.blindLevels[blindLevel - 1] || settings.blindLevels[0] || { sb: 0, bb: 0 };
    const nextBlind = settings.blindLevels[blindLevel] || settings.blindLevels[settings.blindLevels.length - 1] || { sb: 0, bb: 0 };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    if (!participant) {
        return <div className="card text-center">{t('participantLivePage.notFound', { id })}</div>;
    }
    
    const activePlayers = participants.filter(p => p.status === 'active').length;
    const totalChips = participants.reduce((sum, p) => sum + p.chipCount, 0);
    const avgStack = activePlayers > 0 ? Math.floor(totalChips / activePlayers) : 0;

    // 더미 공지사항 데이터
    const dummyAnnouncements = [
        { message: t('participantLivePage.dummyAnnouncement1') },
        { message: t('participantLivePage.dummyAnnouncement2') },
    ];

    return (
        <div className="max-w-md mx-auto p-4 space-y-6 font-sans">
            {/* Announcements Section - 더미 데이터 사용 */}
            {dummyAnnouncements.length > 0 && (
                <div className="bg-yellow-500 text-black p-4 rounded-lg shadow-lg">
                    <h3 className="font-bold text-lg mb-2">{t('participantLivePage.announcements')}</h3>
                    {/* 마지막 공지사항만 표시하는 예시 */}
                    {dummyAnnouncements.length > 0 && (
                        <p>{dummyAnnouncements[dummyAnnouncements.length - 1]?.message}</p>
                    )}
                </div>
            )}
            
            {/* My Info */}
            <div className="card text-center !bg-blue-900 border border-blue-600">
                <h2 className="text-3xl font-bold">{participant.name}</h2>
                <div className="grid grid-cols-3 gap-2 mt-2 text-blue-200">
                    <span>{t('participantLivePage.table', { tableNumber: participant.tableNumber || 'N/A' })}</span>
                    <span>{t('participantLivePage.seat', { seatNumber: participant.seatNumber || 'N/A' })}</span>
                    <span>{t('participantLivePage.chips', { chipCount: participant.chipCount.toLocaleString() })}</span>
                </div>
            </div>

            {/* Blind Timer */}
            <div className="card text-center">
                 <p className="text-gray-400 text-sm">{t('participantLivePage.nextLevelIn')}</p>
                 <h3 className="text-6xl font-bold font-mono tracking-widest">{formatTime(remainingTime)}</h3>
                 <div className="mt-2 text-gray-300">
                     {t('participantLivePage.nextBlind', { blind: nextBlind ? `${nextBlind.sb}/${nextBlind.bb}` : t('participantLivePage.tournamentEnd') })}
                 </div>
            </div>
            
            {/* Tournament Info */}
            <div className="card">
                <h3 className="text-xl font-bold mb-4">{t('participantLivePage.tournamentInfo')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <InfoBox title={t('participantLivePage.currentBlind')} value={`${currentBlind.sb} / ${currentBlind.bb}`} />
                    <InfoBox title={t('participantLivePage.remainingPlayers')} value={`${activePlayers} / ${participants.length}`} />
                    <InfoBox title={t('participantLivePage.avgStack')} value={avgStack.toLocaleString()} />
                    <InfoBox title={t('participantLivePage.totalChips')} value={totalChips.toLocaleString()} />
                </div>
            </div>

             <div className="card">
                <h3 className="text-xl font-bold mb-4">{t('participantLivePage.rulesTitle')}</h3>
                <div className="text-sm text-gray-400 space-y-2">
                   <p>{t('participantLivePage.rule1')}</p>
                   <p>{t('participantLivePage.rule2')}</p>
                </div>
            </div>
        </div>
    );
};

// 작은 정보 박스 컴포넌트
const InfoBox: React.FC<{title: string, value: string | number}> = ({title, value}) => (
    <div className="bg-gray-700 p-4 rounded-lg text-center">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
    </div>
)

export default ParticipantLivePage;
