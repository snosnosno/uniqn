/**
 * 부팅 분기 우선순위 회귀 테스트 (감사 skew-F1).
 *
 * 이 결함의 실체는 "화면이 없다"가 아니라 **"분기가 없다"** 였다 —
 * app/_layout.tsx 가 requiresUpdate / isMaintenanceMode 를 구조분해에서 빼버려
 * 서버가 강제 업데이트를 발동해도 "앱을 불러올 수 없습니다 + 재시도"로만 보였다.
 * 그래서 여기서 고정하는 것은 화면 모양이 아니라 **우선순위**다.
 */
import { resolveVersionGate, type VersionGateInput } from '../resolveVersionGate';

const base: VersionGateInput = {
  isInitialized: false,
  isLoading: false,
  error: null,
  requiresUpdate: false,
  isMaintenanceMode: false,
};

describe('resolveVersionGate', () => {
  it('로딩 중이면 loading', () => {
    expect(resolveVersionGate({ ...base, isLoading: true }).kind).toBe('loading');
  });

  it('초기화 전이고 오류도 없으면 loading (판정할 정보가 없다)', () => {
    expect(resolveVersionGate({ ...base, isInitialized: false, error: null }).kind).toBe('loading');
  });

  it('점검 모드가 일반 오류보다 우선한다', () => {
    const gate = resolveVersionGate({
      ...base,
      error: new Error('maintenance'),
      isMaintenanceMode: true,
      maintenanceMessage: '02:00까지 점검합니다',
    });
    expect(gate).toEqual({ kind: 'maintenance', message: '02:00까지 점검합니다' });
  });

  it('강제 업데이트가 일반 오류보다 우선한다 (이 순서가 뒤집히면 결함 재현)', () => {
    const gate = resolveVersionGate({
      ...base,
      error: new Error('force update'),
      requiresUpdate: true,
    });
    expect(gate.kind).toBe('forceUpdate');
  });

  it('점검과 강제 업데이트가 동시에 참이면 점검이 이긴다', () => {
    const gate = resolveVersionGate({
      ...base,
      error: new Error('both'),
      requiresUpdate: true,
      isMaintenanceMode: true,
    });
    expect(gate.kind).toBe('maintenance');
  });

  it('사유를 모르는 실패만 일반 오류 화면으로 간다', () => {
    expect(resolveVersionGate({ ...base, error: new Error('boom') }).kind).toBe('error');
  });

  it('초기화 성공 + requiresUpdate 는 차단이 아니라 소프트 업데이트 안내다', () => {
    const gate = resolveVersionGate({
      ...base,
      isInitialized: true,
      requiresUpdate: true,
      latestVersion: '1.0.7',
    });
    expect(gate).toEqual({
      kind: 'app',
      softUpdate: { available: true, latestVersion: '1.0.7' },
    });
  });

  it('정상 부팅이면 배너 없이 앱으로', () => {
    const gate = resolveVersionGate({ ...base, isInitialized: true });
    expect(gate).toEqual({
      kind: 'app',
      softUpdate: { available: false, latestVersion: undefined },
    });
  });

  it('🔑 error 동반 여부가 차단(forceUpdate)과 안내(soft)를 가르는 유일한 축이다', () => {
    const blocked = resolveVersionGate({ ...base, error: new Error('x'), requiresUpdate: true });
    const advised = resolveVersionGate({ ...base, isInitialized: true, requiresUpdate: true });
    expect(blocked.kind).toBe('forceUpdate');
    expect(advised.kind).toBe('app');
  });
});
