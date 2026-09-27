import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { ClockStrip } from './ClockStrip';
import { ConfirmDialog } from './ConfirmDialog';

const meta: Meta = { title: '운영/피트월' };
export default meta;

const CLOCK = {
  level: 12,
  smallBlind: 1500,
  bigBlind: 3000,
  ante: 3000,
  remaining: '14:32',
  playersLeft: 47,
  playersTotal: 120,
  averageStack: 76596,
  prizePool: 36000000,
  connected: true,
};

export const 클럭스트립: StoryObj = { render: () => <ClockStrip data={CLOCK} /> };

export const 클럭스트립_재연결중: StoryObj = {
  render: () => <ClockStrip data={{ ...CLOCK, connected: false }} />,
};

export const 버튼: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button>실행</Button>
      <Button variant="outline">보조</Button>
      <Button variant="ghost">고스트</Button>
      <Button variant="destructive">
        탈락 <Kbd>X</Kbd>
      </Button>
      <Button size="lg">주 액션 52px</Button>
      <Button disabled>비활성</Button>
    </div>
  ),
};

function ConfirmDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        탈락 확인창 열기
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="김민수 탈락 처리"
        confirmLabel="탈락"
        onConfirm={() => undefined}
      >
        T7 · 3번 좌석 · 칩 <b className="num text-foreground">12,400</b>
        <br />
        순위 <b className="num text-foreground">47위</b> · 상금{' '}
        <b className="text-foreground">없음</b>
      </ConfirmDialog>
    </>
  );
}

export const 확인창: StoryObj = { render: () => <ConfirmDemo /> };
