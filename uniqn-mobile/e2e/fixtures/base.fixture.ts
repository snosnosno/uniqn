/**
 * 확장된 test 객체 — Page Objects 및 헬퍼 제공
 */
import { test as base } from '@playwright/test';
import { BasePage } from '../pages/base.page';
import { ToastComponent } from '../pages/components/toast.component';
import { ModalComponent } from '../pages/components/modal.component';
import { LoadingComponent } from '../pages/components/loading.component';

interface E2EFixtures {
  basePage: BasePage;
  toast: ToastComponent;
  modal: ModalComponent;
  loading: LoadingComponent;
}

export const test = base.extend<E2EFixtures>({
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },
  toast: async ({ page }, use) => {
    await use(new ToastComponent(page));
  },
  modal: async ({ page }, use) => {
    await use(new ModalComponent(page));
  },
  loading: async ({ page }, use) => {
    await use(new LoadingComponent(page));
  },
});

export { expect } from '@playwright/test';
