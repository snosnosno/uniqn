import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { logger } from '../utils/logger';
const AnnouncementsPage: React.FC = () => {
    const { t } = useTranslation();
    const [message, setMessage] = useState('');

    const handlePost = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        logger.debug(`Dispatching POST_ANNOUNCEMENT with message: "${message}" (not implemented yet)`, { component: 'AnnouncementsPage' });
        
        setMessage('');
    };

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-4">{t('announcements.title')}</h2>
            <form onSubmit={handlePost}>
                <textarea
                    className="input-field w-full"
                    rows={3}
                    placeholder={t('announcements.placeholder')}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary w-full mt-2">
                    {t('announcements.buttonPost')}
                </button>
            </form>
        </div>
    );
};

export default AnnouncementsPage; 