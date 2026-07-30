/**
 * JobPostingRepositoryVenue — 지점 프로필 RPC 래퍼 contract test
 *
 * 이 스위트가 지키는 것은 **서버가 준 한글 사유가 사용자에게 도달하는가** 다.
 * update_venue_container 는 P0001 로 `INVALID_INPUT: ...` 형태를 던지는데,
 * handleSupabaseError 의 P0001 특수분기는 다른 도메인 3종뿐이고 POSTGREST_ERROR_MAP 에도
 * P0001 이 없다. 매핑을 빼면 '같은 이름의 지점이 이미 있습니다' 가
 * '알 수 없는 오류가 발생했습니다' 로 뭉개진다 — 그리고 그건 화면 테스트로는 잘 안 잡힌다
 * (폴백 문구가 그럴듯해서 통과해 버린다). 그래서 레포 경계에서 직접 못 박는다.
 *
 * 특히 동명 충돌(23505)은 유일성이 서버 상태라 클라 선차단이 **원리적으로 불가능한**
 * 유일한 정상 도달 거부다.
 */
import { updateVenueContainer, getMyVenueContexts } from '../JobPostingRepositoryVenue';
import { ValidationError, PermissionError, BusinessError } from '@/errors';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockRpc = supabase.rpc as unknown as jest.Mock;

/** PostgREST 가 실제로 돌려주는 형태(plpgsql RAISE → P0001). */
const rpcError = (message: string) => ({
  data: null,
  error: { code: 'P0001', message, details: null, hint: null },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateVenueContainer — 인자 전달', () => {
  it('undefined 필드는 NULL(=미변경), 빈 문자열은 그대로(=제거) 보낸다', async () => {
    mockRpc.mockResolvedValue({ data: {}, error: null });

    await updateVenueContainer('venue-1', { name: '강남점', contactPhone: '' });

    expect(mockRpc).toHaveBeenCalledWith('update_venue_container', {
      p_container_id: 'venue-1',
      p_name: '강남점',
      p_location: null,
      p_contact_phone: '',
      p_description: null,
    });
  });
});

describe('updateVenueContainer — 서버 거부 사유 매핑', () => {
  it('동명 지점(23505 변환)은 서버 원문 그대로 사용자에게 전달된다', async () => {
    mockRpc.mockResolvedValue(rpcError('INVALID_INPUT: 같은 이름의 지점이 이미 있습니다'));

    await expect(updateVenueContainer('venue-1', { name: '지점B' })).rejects.toMatchObject({
      userMessage: '같은 이름의 지점이 이미 있습니다',
    });
    await expect(updateVenueContainer('venue-1', { name: '지점B' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('길이 초과 등 다른 INVALID_INPUT 도 원문을 보존한다', async () => {
    mockRpc.mockResolvedValue(rpcError('INVALID_INPUT: 지점명은 50자 이하여야 합니다'));

    await expect(updateVenueContainer('venue-1', { name: 'x' })).rejects.toMatchObject({
      userMessage: '지점명은 50자 이하여야 합니다',
    });
  });

  it('권한 거부는 PermissionError 로 승격한다', async () => {
    mockRpc.mockResolvedValue(rpcError('PERMISSION_DENIED: 운영처 관리 권한이 없습니다'));

    await expect(updateVenueContainer('venue-1', { name: '지점' })).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  // 원문에 uuid 가 섞여 있어 그대로 노출하면 안 된다 — 사용자용 문구로 바꾼다.
  it('지점 미존재는 uuid 를 노출하지 않는 안내로 바꾼다', async () => {
    mockRpc.mockResolvedValue(rpcError('VENUE_NOT_FOUND: 3f2504e0-4f89-11d3-9a0c-0305e82c3301'));

    const err = await updateVenueContainer('venue-1', { name: '지점' }).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessError);
    expect(err.userMessage).not.toContain('3f2504e0');
  });
});

describe('getMyVenueContexts — 투영', () => {
  it('snake_case 행을 containerId → 컨텍스트 Map 으로 투영한다', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          job_posting_id: 'venue-1',
          title: '홀덤펍 강남점',
          location: { name: '강남역 2번 출구', district: '강남구' },
          contact_phone: '02-123-4567',
          description: '소개',
          owner_name: '김사장',
        },
      ],
      error: null,
    });

    const result = await getMyVenueContexts(['venue-1']);

    expect(result.get('venue-1')).toEqual({
      title: '홀덤펍 강남점',
      location: { name: '강남역 2번 출구', district: '강남구' },
      contactPhone: '02-123-4567',
      description: '소개',
      ownerName: '김사장',
    });
  });

  it('빈 location({}) 은 null 로 정규화한다(DB 기본값이 빈 객체다)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          job_posting_id: 'venue-1',
          title: '지점',
          location: {},
          contact_phone: null,
          description: null,
          owner_name: null,
        },
      ],
      error: null,
    });

    expect(
      await getMyVenueContexts(['venue-1']).then((m) => m.get('venue-1')?.location)
    ).toBeNull();
  });

  it('빈 배열 입력이면 RPC 를 호출하지 않는다', async () => {
    expect((await getMyVenueContexts([])).size).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
