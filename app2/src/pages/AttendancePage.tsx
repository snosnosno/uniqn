import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { callFunctionLazy } from '../utils/firebase-dynamic';
import { usePageOptimizedData } from '../hooks/useUnifiedData';

import { logger } from '../utils/logger';

const AttendancePage: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const [scanResult, setScanResult] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const { currentUser: _currentUser, role } = useAuth();
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Smart Hybrid Context 사용 - 자신의 출석 데이터만 구독
    const { workLogs, attendanceRecords, loading: _loading } = usePageOptimizedData(location.pathname);

    // 성능 최적화 로그
    useEffect(() => {
        logger.info('AttendancePage 최적화 모드', {
            component: 'AttendancePage',
            data: {
                role,
                workLogsCount: workLogs.length,
                attendanceCount: attendanceRecords.length,
                isOptimized: true
            }
        });
    }, [role, workLogs.length, attendanceRecords.length]);

    // QR 스캐너 초기화
    useEffect(() => {
        if (!scannerRef.current) {
            scannerRef.current = new Html5QrcodeScanner(
                'qr-reader',
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );

            scannerRef.current.render(
                async (decodedText) => {
                    setScanResult(decodedText);

                    // Extract token from URL
                    const urlParts = decodedText.split('/');
                    const token = urlParts[urlParts.length - 1];

                    if (token && !isSubmitting) {
                        setIsSubmitting(true);
                        setFeedback(null);
                        try {
                            await callFunctionLazy('recordAttendance', { qrCodeToken: token });
                            setFeedback({ type: 'success', message: t('attendancePage.success') });
                        } catch (err: unknown) {
                            logger.error('Error occurred', err instanceof Error ? err : new Error(String(err)), { component: 'AttendancePage' });
                            setFeedback({ type: 'error', message: (err as Error).message || t('attendancePage.fail') });
                        } finally {
                            setIsSubmitting(false);
                            setTimeout(() => setScanResult(''), 2000);
                        }
                    }
                },
                (errorMessage) => {
                    // QR 코드 스캔 오류는 무시 (지속적으로 발생)
                    logger.debug('QR scan error', { error: errorMessage });
                }
            );
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch((err) => {
                    logger.error('QR scanner cleanup error', err instanceof Error ? err : new Error(String(err)));
                });
            }
        };
    }, [isSubmitting, t]);

    return (
        <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('attendancePage.title')}</h1>

            {/* 최적화 정보 표시 (개발 모드) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mb-4 p-2 bg-blue-100 rounded-lg text-sm">
                    <p>🚀 Smart Hybrid Context 활성화</p>
                    <p>📊 데이터: {workLogs.length} 근무, {attendanceRecords.length} 출석</p>
                    <p>💰 비용 절감: ~95%</p>
                </div>
            )}
            <div className="w-full max-w-md bg-white p-4 rounded-lg shadow-xl">
                <div id="qr-reader" className="w-full" />
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