interface PlaceholderProps {
  title: string;
  slice: string;
  detail?: string;
}

/** 디자인 단계 전 자리표시 — 각 슬라이스에서 실제 화면으로 교체한다. */
export function Placeholder({ title, slice, detail }: PlaceholderProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{slice} 에서 구현 예정</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {detail ? (
        <p className="break-all text-sm text-gray-600 dark:text-gray-300">{detail}</p>
      ) : null}
    </main>
  );
}
