"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseShortDateFormat = exports.formatDateDisplay = exports.timestampToLocalDateString = void 0;
const firestore_1 = require("firebase/firestore");
/**
 * Firebase Timestamp를 로컬 날짜 문자열(yyyy-MM-dd)로 변환
 * 타임존 차이로 인한 날짜 변경 문제를 해결
 */
function timestampToLocalDateString(timestamp) {
    if (!timestamp) {
        return new Date().toISOString().split('T')[0];
    }
    try {
        let date;
        // Firebase Timestamp 객체인 경우
        if (timestamp instanceof firestore_1.Timestamp) {
            date = timestamp.toDate();
        }
        // Timestamp-like 객체인 경우 (seconds, nanoseconds 속성을 가진 객체)
        else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
            // toDate 메서드가 있으면 사용
            if (typeof timestamp.toDate === 'function') {
                date = timestamp.toDate();
            }
            else {
                // 없으면 직접 변환 - 타임존 보정 적용
                const utcDate = new Date(timestamp.seconds * 1000);
                // 로컬 타임존 오프셋을 적용하여 날짜가 변경되지 않도록 함
                const localDate = new Date(utcDate.getTime() + (utcDate.getTimezoneOffset() * 60000));
                date = localDate;
            }
        }
        // Date 객체인 경우
        else if (timestamp instanceof Date) {
            date = timestamp;
        }
        // 문자열인 경우
        else if (typeof timestamp === 'string') {
            // yyyy-MM-dd 형식인 경우 그대로 반환
            if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
                return timestamp;
            }
            // 다른 형식의 문자열인 경우 Date로 파싱
            date = new Date(timestamp);
        }
        // 숫자인 경우 (milliseconds)
        else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        }
        else {
            // 기본값: 오늘 날짜
            date = new Date();
        }
        // 로컬 날짜 문자열 생성 (yyyy-MM-dd)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    catch (error) {
        console.error('🔴 날짜 변환 오류:', error, timestamp);
        // 오류 발생 시 오늘 날짜 반환
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
exports.timestampToLocalDateString = timestampToLocalDateString;
/**
 * 날짜 문자열을 읽기 쉬운 형식으로 포맷
 * @param dateString yyyy-MM-dd 형식의 날짜 문자열
 * @returns 포맷된 날짜 문자열 (예: "12월 29일 (일)")
 */
function formatDateDisplay(dateString) {
    try {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[date.getDay()];
        return `${month}월 ${day}일 (${weekday})`;
    }
    catch (error) {
        console.error('날짜 포맷 오류:', error);
        return dateString;
    }
}
exports.formatDateDisplay = formatDateDisplay;
/**
 * yy-MM-dd(요일) 형식의 문자열을 yyyy-MM-dd로 변환
 */
function parseShortDateFormat(dateStr) {
    if (/^\d{2}-\d{2}-\d{2}\([일월화수목금토]\)$/.test(dateStr)) {
        const parts = dateStr.split('(')[0].split('-');
        const year = 2000 + parseInt(parts[0]);
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}
exports.parseShortDateFormat = parseShortDateFormat;
