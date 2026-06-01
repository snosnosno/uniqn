import { pollWalletCredit } from '../pollWalletCredit';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('잔액이 baseline 초과로 증가하면 credited:true로 조기 종료', async () => {
  const fetchBalance = jest
    .fn()
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(15);
  const p = pollWalletCredit({ baseline: 5, fetchBalance, intervalMs: 1000, maxAttempts: 10 });
  await jest.advanceTimersByTimeAsync(3000);
  await expect(p).resolves.toEqual({ credited: true, balance: 15 });
  expect(fetchBalance).toHaveBeenCalledTimes(3);
});

it('maxAttempts 내 증가 없으면 credited:false (timeout)', async () => {
  const fetchBalance = jest.fn().mockResolvedValue(5);
  const p = pollWalletCredit({ baseline: 5, fetchBalance, intervalMs: 1000, maxAttempts: 3 });
  await jest.advanceTimersByTimeAsync(3000);
  await expect(p).resolves.toEqual({ credited: false, balance: 5 });
  expect(fetchBalance).toHaveBeenCalledTimes(3);
});

it('연속 2회 fetch 실패 시 조기 종료(credited:false)', async () => {
  const fetchBalance = jest.fn().mockRejectedValue(new Error('net'));
  const p = pollWalletCredit({ baseline: 5, fetchBalance, intervalMs: 1000, maxAttempts: 10 });
  await jest.advanceTimersByTimeAsync(2000);
  await expect(p).resolves.toEqual({ credited: false, balance: 5 });
  expect(fetchBalance).toHaveBeenCalledTimes(2);
});
