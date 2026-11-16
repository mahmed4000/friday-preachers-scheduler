import React, { createContext, useCallback, useContext, useState } from 'react';
import { Button, Modal } from './kit.tsx';

interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmText?: string;
  danger?: boolean;
}

const Ctx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>رجوع</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.confirmText ?? 'تأكيد'}</Button>
          </>
        }
      >
        <div className="text-ink">{state?.body}</div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  return useContext(Ctx);
}
