import { ClockStrip } from '@/components/ops/ClockStrip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { useTheme } from '@/lib/theme';
import { ConsoleDemo } from './ConsoleDemo';
import { SAMPLE_CLOCK, TOKEN_SWATCHES } from './sampleData';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label text-[12px]">{title}</h2>
      {children}
    </section>
  );
}

/** 디자인 시스템 견본(D1) — 운영 빌드에는 라우트가 없다. 정본은 DESIGN.md. */
export function Component() {
  const { theme, setTheme } = useTheme();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <div className="label">UNIQN OPS · DESIGN SYSTEM</div>
          <h1 className="text-[28px] font-bold">피트월</h1>
        </div>
        <Button variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '라이트로' : '다크로'}
        </Button>
      </header>

      <Section title="콘솔 — 참가자를 누르고 X 또는 [탈락] → Enter">
        <div className="overflow-hidden border">
          <ClockStrip data={SAMPLE_CLOCK} />
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Input
              className="num h-9 flex-1"
              placeholder="7-3 x · +이름 · lv+ · 좌석이나 이름으로 찾기"
              aria-label="명령줄"
            />
            <Kbd>/</Kbd>
            <Button>
              ＋ 참가 등록 <Kbd>N</Kbd>
            </Button>
          </div>
          <ConsoleDemo />
        </div>
      </Section>

      <Section title="색 토큰">
        <div className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-5">
          {TOKEN_SWATCHES.map(([token, label]) => (
            <div key={token} className="bg-card p-3">
              <div className="h-10 border" style={{ background: `var(--${token})` }} />
              <div className="mt-2 text-[13px] font-semibold">{label}</div>
              <div className="num text-[11px] text-muted-foreground">--{token}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="글꼴">
        <div className="grid gap-px border bg-border md:grid-cols-3">
          <div className="bg-card p-4">
            <div className="label">SUIT · UI·본문</div>
            <div className="mt-1 text-[28px] font-bold">참가자 47명 진행 중</div>
            <p className="mt-1 text-muted-foreground">
              등록데스크에서 이름이나 좌석으로 찾아 한 번에 처리합니다.
            </p>
          </div>
          <div className="bg-card p-4">
            <div className="label">GEIST MONO · 표 숫자</div>
            <div className="num mt-1 text-xl">142,300 · T7·3 · #061</div>
            <div className="num text-xl text-prize">36,000,000</div>
          </div>
          <div className="bg-card p-4">
            <div className="label">BIG SHOULDERS · 클럭</div>
            <div className="clock mt-1 text-[88px]">14:32</div>
          </div>
        </div>
      </Section>

      <Section title="버튼 · 배지">
        <div className="flex flex-wrap items-center gap-2">
          <Button>실행</Button>
          <Button variant="outline">보조</Button>
          <Button variant="ghost">고스트</Button>
          <Button variant="destructive">탈락</Button>
          <Button size="lg">주 액션 52px</Button>
          <Badge>진행</Badge>
          <Badge variant="outline">대기 2</Badge>
          <Badge variant="destructive">탈락</Badge>
        </div>
      </Section>
    </main>
  );
}
