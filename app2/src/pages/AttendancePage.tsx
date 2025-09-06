import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrReader } from 'react-qr-reader';

import { useAuth } from '../contexts/AuthContext';
import { callFunctionLazy } from '../utils/firebase-dynamic';


import { logger } from '../utils/logger';
const AttendancePage: React.FC = () => {
    const { t } = useTranslation();
    const [scanResult, setScanResult] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const { currentUser: _currentUser } = useAuth();

    const handleScan = async (result: any, error: any) => {
        if (!!result) {
            const scannedUrl = result?.getText();
            setScanResult(scannedUrl);
            
            // Extract token from URL
            const urlParts = scannedUrl.split('/');
            const token = urlParts[urlParts.length - 1];

            if (token && !isSubmitting) {
                setIsSubmitting(true);
                setFeedback(null);
                try {
                    await callFunctionLazy('recordAttendance', { qrCodeToken: token });
                    setFeedback({ type: 'success', message: t('attendancePage.success') });
                } catch (err: any) {
                    logger.error('Error occurred', err instanceof Error ? err : new Error(String(err)), { component: 'AttendancePage' });
                    setFeedback({ type: 'error', message: err.message || t('attendancePage.fail') });
                } finally {
                    setIsSubmitting(false);
                    // Optionally clear result after processing
                    setTimeout(() => setScanResult(''), 2000); 
                }
            }
        }

        if (!!error) {
            // Error handling logic could be added here if needed
        }
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('attendancePage.title')}</h1>
            <div className="w-full max-w-md bg-white p-4 rounded-lg shadow-xl">
                <QrReader
                    onResult={handleScan}
                    constraints={{ facingMode: 'environment' }}
                    containerStyle={{ width: '100%' }}
                />
                {scanResult ? <p className="mt-4 text-center text-sm text-gray-600">{t('attendancePage.lastScanned', { scanResult })}</p> : null}
            </div>

            {isSubmitting ? <p className="mt-4 text-blue-600">{t('attendancePage.submitting')}</p> : null}
            
            {feedback ? <div className={`mt-4 p-4 rounded-md w-full max-w-md text-center ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {feedback.message}
                </div> : null}
        </div>
    );
};

export default AttendancePage;