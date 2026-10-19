import { animate } from 'motion';
import type { ContextMenuItem } from './types';

/**
 * Minimal built-in context menu rendered as an HTML popover. Kept dependency
 * free so the embeddable bundle stays small; apps with their own menu system
 * can disable it through `contextMenu: false` and use the `onContextMenu` hook.
 */
export class ContextMenu {
  private el: HTMLDivElement | null = null;
  private readonly onDocDown = (e: PointerEvent) => {
    if (this.el && !this.el.contains(e.target as Node)) this.close();
  };
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  constructor(private readonly animated: () => boolean) {}

  open(clientX: number, clientY: number, items: ContextMenuItem[]): void {
    this.close();
    if (items.length === 0) return;

    const el = document.createElement('div');
    el.className = 'fp-context-menu';
    el.setAttribute('role', 'menu');
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fp-context-menu__item' + (item.danger ? ' fp-context-menu__item--danger' : '');
      btn.setAttribute('role', 'menuitem');
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        this.close();
        item.action();
      });
      el.appendChild(btn);
    }
    document.body.appendChild(el);

    // Keep the menu on screen.
    const rect = el.getBoundingClientRect();
    const x = Math.min(clientX, window.innerWidth - rect.width - 8);
    const y = Math.min(clientY, window.innerHeight - rect.height - 8);
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;

    if (this.animated()) {
      animate(el, { opacity: [0, 1], scale: [0.92, 1], y: [-4, 0] }, { duration: 0.16, ease: 'easeOut' });
    }

    this.el = el;
    // Defer so the opening pointerdown/contextmenu doesn't immediately close it.
    setTimeout(() => {
      document.addEventListener('pointerdown', this.onDocDown, true);
      document.addEventListener('keydown', this.onKey, true);
    }, 0);
  }

  close(): void {
    document.removeEventListener('pointerdown', this.onDocDown, true);
    document.removeEventListener('keydown', this.onKey, true);
    const el = this.el;
    this.el = null;
    if (!el) return;
    if (this.animated()) {
      animate(el, { opacity: 0, scale: 0.96 }, { duration: 0.1 }).then(() => el.remove());
    } else {
      el.remove();
    }
  }

  destroy(): void {
    this.close();
  }
}
