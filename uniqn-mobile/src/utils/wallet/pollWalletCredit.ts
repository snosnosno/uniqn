/**
 * UNIQN Mobile - pollWalletCredit
 * @description 충전 적립은 웹훅 비동기 → 잔액이 baseline 초과로 증가할 때까지 폴링.
 *   interval×maxAttempts 내 미증가면 timeout(credited:false). 연속 2회 fetch 실패 시 조기 종료.
 */
export interface PollWalletCreditParams {
  baseline: number;
  fetchBalance: () => Promise<number>;
  intervalMs?: number;
  maxAttempts?: number;
}

export interface PollWalletCreditResult {
  credited: boolean;
  balance: number;
}

export async function pollWalletCredit({
  baseline,
  fetchBalance,
  intervalMs = 1000,
  maxAttempts = 10,
}: PollWalletCreditParams): Promise<PollWalletCreditResult> {
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  let consecutiveFailures = 0;
  let lastBalance = baseline;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(intervalMs);
    try {
      const balance = await fetchBalance();
      consecutiveFailures = 0;
      lastBalance = balance;
      if (balance > baseline) {
        return { credited: true, balance };
      }
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 2) {
        return { credited: false, balance: lastBalance };
      }
    }
  }
  return { credited: false, balance: lastBalance };
}
