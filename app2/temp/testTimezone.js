"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dateUtils_1 = require("./dateUtils");
const dateUtils_2 = require("./jobPosting/dateUtils");
// Firebase Timestamp 형태의 객체 테스트
const testTimestamp = {
    seconds: 1735408800,
    nanoseconds: 0
};
console.log('=== 타임존 변환 테스트 ===');
console.log('원본 Timestamp:', testTimestamp);
console.log('UTC 시간:', new Date(testTimestamp.seconds * 1000).toISOString());
console.log('로컬 시간:', new Date(testTimestamp.seconds * 1000).toString());
console.log('\n=== timestampToLocalDateString 함수 테스트 ===');
console.log('변환 결과:', (0, dateUtils_1.timestampToLocalDateString)(testTimestamp));
console.log('\n=== convertToDateString 함수 테스트 ===');
console.log('변환 결과:', (0, dateUtils_2.convertToDateString)(testTimestamp));
console.log('\n=== getTodayString 함수 테스트 ===');
console.log('오늘 날짜 (로컬):', (0, dateUtils_2.getTodayString)());
console.log('오늘 날짜 (UTC):', new Date().toISOString().split('T')[0]);
// 실제 Firebase Timestamp 객체처럼 toDate 메서드가 있는 경우
const timestampWithToDate = {
    seconds: testTimestamp.seconds,
    nanoseconds: testTimestamp.nanoseconds,
    toDate: function () {
        return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
    }
};
console.log('\n=== toDate 메서드가 있는 Timestamp 테스트 ===');
console.log('timestampToLocalDateString:', (0, dateUtils_1.timestampToLocalDateString)(timestampWithToDate));
console.log('convertToDateString:', (0, dateUtils_2.convertToDateString)(timestampWithToDate));
