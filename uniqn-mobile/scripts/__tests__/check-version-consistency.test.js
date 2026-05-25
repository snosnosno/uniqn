const {
  parseArgs,
  compareVersions,
  isSingleSourceIntact,
  evaluateAgainstLatest,
} = require('../check-version-consistency');

describe('check-version-consistency: compareVersions', () => {
  it('대소 비교가 정확하다', () => {
    expect(compareVersions('1.0.3', '1.0.2')).toBe(1);
    expect(compareVersions('1.0.2', '1.0.3')).toBe(-1);
    expect(compareVersions('1.0.2', '1.0.2')).toBe(0);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });
});

describe('check-version-consistency: isSingleSourceIntact', () => {
  it('package.json 을 읽으면 통과', () => {
    const src = 'const VERSION = JSON.parse(fs.readFileSync(`${__dirname}/package.json`)).version;';
    expect(isSingleSourceIntact(src)).toBe(true);
  });

  it('버전 하드코딩이면 실패', () => {
    expect(isSingleSourceIntact("const VERSION = '1.0.2';")).toBe(false);
  });

  it('package.json 참조가 없으면 실패', () => {
    expect(isSingleSourceIntact('const VERSION = someOther;')).toBe(false);
  });
});

describe('check-version-consistency: evaluateAgainstLatest', () => {
  const latest = { ios: '1.0.2', android: '1.0.2', web: '1.0.2' };

  it('빌드 버전이 더 높으면 통과', () => {
    expect(evaluateAgainstLatest('1.0.3', latest, ['ios', 'android'])).toEqual({
      ok: true,
      problems: [],
    });
  });

  it('빌드 버전이 같으면 실패 (버전 안 올림)', () => {
    const result = evaluateAgainstLatest('1.0.2', latest, ['ios']);
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain('ios');
  });

  it('빌드 버전이 더 낮으면 실패', () => {
    expect(evaluateAgainstLatest('1.0.1', latest, ['android']).ok).toBe(false);
  });

  it('플랫폼 항목이 없으면 실패', () => {
    const result = evaluateAgainstLatest('2.0.0', { ios: '1.0.2' }, ['ios', 'android']);
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain('android');
  });
});

describe('check-version-consistency: parseArgs', () => {
  it('기본값 + --skip-db + --platform 파싱', () => {
    expect(parseArgs([])).toEqual({ skipDb: false, platforms: ['ios', 'android'] });
    expect(parseArgs(['--skip-db']).skipDb).toBe(true);
    expect(parseArgs(['--platform=ios,web']).platforms).toEqual(['ios', 'web']);
  });
});
