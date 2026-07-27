import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomNav } from '../../src/components/navigation/BottomNav';
import { GameRail } from '../../src/components/navigation/GameRail';
import {
  ServiceGrid,
  type ServiceName,
} from '../../src/components/controls/ServiceGrid';
import { ExperimentalPlaceholder } from '../../src/components/controls/ExperimentalPlaceholder';
import { App } from '../../src/App';

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

function installDialogApi() {
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    if (this.open) throw new DOMException('Dialog is already open');
    this.open = true;
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: close,
  });
  return { close, showModal };
}

afterEach(() => {
  cleanup();
  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: originalShowModal,
    });
  } else {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  }
  if (originalClose) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: originalClose,
    });
  } else {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  }
  vi.restoreAllMocks();
});

describe('home controls', () => {
  it('renders four games and only the selected game logo', () => {
    render(<GameRail mode="real" selectedGame="delta" onSelect={vi.fn()} />);
    const rail = screen.getByRole('navigation', { name: '游戏切换' });
    const games = within(rail).getAllByRole('button');
    expect(games).toHaveLength(4);
    expect(games.map((button) => button.textContent)).toEqual([
      '三角洲行动',
      'CS2',
      'Valorant',
      'Steam 游戏',
    ]);
    expect(
      within(screen.getByRole('button', { name: '三角洲行动' })).getByTestId(
        'game-logo',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('game-logo')).toHaveLength(1);
  });

  it('marks the controlled selected game as pressed', () => {
    render(<GameRail mode="real" selectedGame="delta" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: '三角洲行动' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'CS2' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('renders six varied service buttons with 44px targets', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(service: ServiceName) => void>();
    render(<ServiceGrid mode="real" onSelect={onSelect} />);
    const region = screen.getByRole('region', { name: '服务入口' });
    const services = within(region).getAllByRole('button');
    expect(services.map((button) => button.textContent)).toEqual([
      '趣味单',
      '小时单',
      '自助下单',
      '客服接待',
      '活动专区',
      '全部服务',
    ]);
    services.forEach((button) => expect(button).toHaveClass('tap-target'));
    await user.click(screen.getByRole('button', { name: '趣味单' }));
    expect(onSelect).toHaveBeenCalledWith('趣味单');
  });

  it('marks 首页 current and renders all five bottom items', () => {
    render(<BottomNav mode="real" selectedItem="home" onSelect={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: '主要导航' });
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: '首页' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows and closes the Experimental / Mock dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { showModal } = installDialogApi();
    render(<ExperimentalPlaceholder service="趣味单" onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: '趣味单' });

    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByText('Experimental / Mock')).toBeVisible();
    const closeButton = within(dialog).getByRole('button', { name: '关闭' });
    expect(closeButton).toHaveFocus();
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes the modal on cancel without letting the browser close it first', () => {
    const onClose = vi.fn();
    installDialogApi();
    render(<ExperimentalPlaceholder service="趣味单" onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: '趣味单' });
    const cancelEvent = new Event('cancel', { bubbles: false, cancelable: true });
    dialog.dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('supports StrictMode effect replay without reopening an open dialog', () => {
    const { close, showModal } = installDialogApi();

    render(
      <StrictMode>
        <ExperimentalPlaceholder service="趣味单" onClose={vi.fn()} />
      </StrictMode>,
    );

    expect(showModal).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: '趣味单' })).toHaveAttribute('open');
  });
});

describe('HomeScreen', () => {
  it('renders the approved 朗世乐 composition without checkpoint copy', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent('朗世乐');
    expect(screen.queryByText('工程基础检查点')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '游戏切换' })).toBeVisible();
    expect(screen.getByRole('region', { name: '服务入口' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: '主要导航' })).toBeVisible();
    expect(screen.getByTestId('character-layer')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('opens the selected service and restores home state when closed', async () => {
    const user = userEvent.setup();
    installDialogApi();
    render(<App />);
    const opener = screen.getByRole('button', { name: '客服接待' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: '客服接待' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '服务入口' })).toBeVisible();
    expect(opener).toHaveFocus();
  });

  it('updates selected game and bottom item without duplicating the page', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'CS2' }));
    expect(screen.getByRole('button', { name: 'CS2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByTestId('game-logo')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '挑选' }));
    expect(screen.getByRole('button', { name: '挑选' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
