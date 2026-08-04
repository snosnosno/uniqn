/**
 * 회귀 가드 — 관측 싱크 무한 재귀 차단 (2026-08-04)
 *
 * 결함: 웹에는 Sentry SDK 가 없어 sentryService 가 로그로 폴백하는데, 그 폴백이
 * `logger.error(msg, error, ...)` 였다. 그러면 logger output() 의 자동 전송 조건
 * (isProduction && level==='error' && entry.error) 을 다시 만족해 sentryService 로
 * 또 전달되고 → 또 폴백하며 **무한 재귀**한다. 비동기라 스택은 안 터지고
 * 마이크로태스크 큐만 무한히 채워 메인 스레드를 굶긴다.
 *
 * 실측(2026-08-04): E2E 1회 실행에서 콘솔 에러 3,729,998건, 페이지 응답 정지 →
 * `board.spec:88` 60초 타임아웃. 만성 flake 의 실제 원인이었다.
 *
 * ⚠️ 루프 **왕복 전체**는 이 저장소의 Jest 로 재현할 수 없다. logger 는
 *    sentryService 를 동적 `import()` 로 지연 로드하는데, jest-expo 는
 *    `--experimental-vm-modules` 없이 돌아 동적 import 가 항상 reject 되고
 *    logger 쪽 `.catch(() => {})` 가 이를 삼킨다. 즉 유닛 테스트에서는 전달이
 *    애초에 일어나지 않아 "전달 N회" 류의 단언은 빈 통과(vacuous)가 된다.
 *    → 대신 고리의 **말단 계약**을 두 각도로 고정한다:
 *      (1) 소스 계약 — 관측 모듈이 `logger.error(` 를 쓰지 않는다
 *      (2) 행위 계약 — 웹 폴백 모듈을 **정적** import 해 실제 호출 대상을 단언
 *    왕복 자체의 행위 증거는 E2E 실패율(수정 전 60% → 수정 후 0%)이 담당한다.
 */
import fs from 'fs';
import path from 'path';

import { logger } from '@/utils/logger';
// 정적 import — 이 저장소 Jest 는 동적 import() 를 지원하지 않는다(파일 상단 주석 참고).
import * as sentryWeb from '@/services/observability/sentryService.web';

const OBSERVABILITY_DIR = path.join(__dirname, '..', '..', 'services', 'observability');

/** 웹 폴백을 가진 관측 모듈 — 이 파일들이 재귀 고리의 말단 싱크다. */
const FALLBACK_MODULES = ['sentryService.ts', 'sentryService.web.ts'];

describe('관측 계층 로깅 계약', () => {
  // 특정 메시지 문자열이 아니라 `logger.error(` 자체를 금지한다. 문자열만 막으면
  // 다른 문구의 logger.error 를 새로 추가했을 때 재귀가 부활해도 가드가 green 이다.
  it.each(FALLBACK_MODULES)('%s 는 logger.error 를 쓰지 않는다 (쓰면 무한 재귀)', (fileName) => {
    const source = fs.readFileSync(path.join(OBSERVABILITY_DIR, fileName), 'utf8');

    // 주석에 등장하는 'logger.error' 는 계약 위반이 아니므로 호출 형태만 본다.
    const callSites = source.split('\n').filter((line) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      return code.includes('logger.error(');
    });

    expect(callSites).toEqual([]);
  });

  it('logger 는 관측 전용 비전달 싱크를 노출한다', () => {
    expect(typeof logger.observability).toBe('function');
  });

  /**
   * 행위 단언 — 웹 폴백 모듈을 **정적으로** import 하면 동적 import 제약을 우회해
   * "폴백은 비전달 싱크만 쓴다"를 직접 증명할 수 있다. 문자열/소스 가드가 놓치는
   * 개명·변종을 이 단언이 잡는다.
   */
  it('웹 폴백(recordError)은 logger.observability 만 호출한다', async () => {
    const observabilitySpy = jest
      .spyOn(logger, 'observability')
      .mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    try {
      await sentryWeb.recordError(new Error('boom'), { component: 'test' });

      expect(observabilitySpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      observabilitySpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('logger.observability 는 콘솔에는 남긴다 (관측 유실 방지)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      logger.observability('Sentry web fallback event', new Error('boom'), {
        component: 'sentryService',
      });

      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
