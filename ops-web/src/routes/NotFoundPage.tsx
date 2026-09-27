import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">페이지를 찾을 수 없어요</h1>
      <Link to="/tournaments" className="text-sm underline underline-offset-4">
        대회 목록으로
      </Link>
    </main>
  );
}
