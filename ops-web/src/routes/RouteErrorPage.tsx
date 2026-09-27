import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { canReloadForChunkError, reloadForChunkError } from '@/lib/chunkReload';

/** 라우트 에러 경계 — 새 배포 직후 옛 청크 실패는 한 번 자동 새로고침한다(W0 리뷰 M5). */
export function RouteErrorPage() {
  const error = useRouteError();
  // 판정은 첫 렌더에 한 번만(읽기 전용). 실행은 effect 에서.
  const [willReload] = useState(() => canReloadForChunkError(error));

  useEffect(() => {
    if (willReload) {
      reloadForChunkError();
    }
  }, [willReload]);

  if (willReload) {
    return null;
  }

  const status = isRouteErrorResponse(error) ? error.status : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">화면을 불러오지 못했어요</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {status ? `오류 코드 ${status}` : '잠시 후 다시 시도해 주세요.'}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 rounded-md border border-gray-300 px-4 text-sm dark:border-gray-700"
      >
        새로고침
      </button>
    </main>
  );
}
