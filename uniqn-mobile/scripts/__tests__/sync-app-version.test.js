const { buildVersionValue, parseArgs, resolveKeysToUpdate } = require('../sync-app-version');

describe('sync-app-version: buildVersionValue', () => {
  it('지정 플랫폼만 새 버전으로 덮어쓰고 나머지는 보존한다', () => {
    const current = { ios: '1.0.0', android: '1.0.0', web: '1.0.0' };
    const next = buildVersionValue(current, '1.0.3', ['ios', 'android']);
    expect(next).toEqual({ ios: '1.0.3', android: '1.0.3', web: '1.0.0' });
  });

  it('기존 value 가 없어도(null) 새 객체를 만든다', () => {
    expect(buildVersionValue(null, '2.1.0', ['ios'])).toEqual({ ios: '2.1.0' });
    expect(buildVersionValue(undefined, '2.1.0', ['android'])).toEqual({ android: '2.1.0' });
  });

  it('원본을 변경하지 않는다(불변성)', () => {
    const current = { ios: '1.0.0', web: '1.0.0' };
    const next = buildVersionValue(current, '1.1.0', ['ios']);
    expect(current).toEqual({ ios: '1.0.0', web: '1.0.0' });
    expect(next).not.toBe(current);
  });
});

describe('sync-app-version: parseArgs', () => {
  it('기본값은 dry-run/force 비활성 + ios,android 플랫폼', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, force: false, platforms: ['ios', 'android'] });
  });

  it('--dry-run, --force 플래그를 인식한다', () => {
    expect(parseArgs(['--dry-run', '--force'])).toMatchObject({ dryRun: true, force: true });
  });

  it('--platform 목록을 파싱한다', () => {
    expect(parseArgs(['--platform=ios,web']).platforms).toEqual(['ios', 'web']);
    expect(parseArgs(['--platform=android']).platforms).toEqual(['android']);
  });
});

describe('sync-app-version: resolveKeysToUpdate', () => {
  // 업데이트 모달은 recommended_version 을 기준으로 뜬다.
  // versionService.checkVersion: shouldUpdate = recommendedVersion
  //   ? current < recommendedVersion : current < latestVersion
  // → recommended_version 행이 존재하는 한 latest_version 만 올려서는 안내가 뜨지 않는다.
  it('기본 갱신 대상에 latest_version 과 recommended_version 을 모두 포함한다', () => {
    expect(resolveKeysToUpdate({ force: false })).toEqual([
      'latest_version',
      'recommended_version',
    ]);
  });

  it('--force 는 force_update_version 을 추가한다 (앱 잠금 레버 — opt-in)', () => {
    expect(resolveKeysToUpdate({ force: true })).toEqual([
      'latest_version',
      'recommended_version',
      'force_update_version',
    ]);
  });

  it('force 가 아니면 force_update_version 을 절대 포함하지 않는다', () => {
    expect(resolveKeysToUpdate({ force: false })).not.toContain('force_update_version');
    expect(resolveKeysToUpdate({})).not.toContain('force_update_version');
  });
});
