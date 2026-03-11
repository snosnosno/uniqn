/**
 * MockTimestamp - Firebase Timestamp 테스트 mock
 *
 * @description instanceof 체크를 지원하는 class-based Timestamp mock
 */

class MockTimestamp {
  constructor(seconds, nanoseconds = 0) {
    this._seconds = seconds;
    this._nanoseconds = nanoseconds;
  }

  get seconds() {
    return this._seconds;
  }

  get nanoseconds() {
    return this._nanoseconds;
  }

  toDate() {
    return new Date(this._seconds * 1000 + this._nanoseconds / 1000000);
  }

  toMillis() {
    return this._seconds * 1000 + this._nanoseconds / 1000000;
  }

  isEqual(other) {
    return this._seconds === other._seconds && this._nanoseconds === other._nanoseconds;
  }

  static now() {
    const now = Date.now();
    return new MockTimestamp(Math.floor(now / 1000), (now % 1000) * 1000000);
  }

  static fromDate(date) {
    const ms = date.getTime();
    return new MockTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  static fromMillis(milliseconds) {
    return new MockTimestamp(Math.floor(milliseconds / 1000), (milliseconds % 1000) * 1000000);
  }
}

module.exports = MockTimestamp;
