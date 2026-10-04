/**
 * 이 기기 이름 — 이력에 "어느 기기에서 한 조작인지" 남기는 이름을 정한다(이 기기에만 저장).
 * 비워 두면 브라우저·OS 이름("Chrome · Windows")으로 기록된다.
 */
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEVICE_NAME_MAX, getCustomDeviceName, setCustomDeviceName } from '@/lib/deviceName';
import { Field } from '@/routes/auth/AuthShell';

export function DeviceNameDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        {/* 열 때마다 저장된 이름으로 다시 시작한다 */}
        {open ? <DeviceNameForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DeviceNameForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState(getCustomDeviceName);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setCustomDeviceName(name);
    onDone();
  };
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>이 기기 이름</DialogTitle>
        <DialogDescription>
          이 기기에서 한 조작이 이력에 이 이름으로 남아요. 이 기기에만 저장됩니다.
        </DialogDescription>
      </DialogHeader>
      <Field id="device-name" label="이름">
        <Input
          id="device-name"
          autoFocus
          maxLength={DEVICE_NAME_MAX}
          placeholder="예: 등록데스크 1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">비워 두면 브라우저와 기기 종류로 기록돼요.</p>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-11" onClick={onDone}>
          닫기
        </Button>
        <Button type="submit" size="lg">
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
