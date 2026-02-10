import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, createElement, useState } from '../src/iract.js';

describe('Event handling', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('handles onClick', () => {
    const handler = vi.fn();
    function App() {
      return createElement('button', { onClick: handler }, 'Click me');
    }
    render(App, null, container);
    container.querySelector('button').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles onInput', () => {
    const handler = vi.fn();
    function App() {
      return createElement('input', { onInput: handler });
    }
    render(App, null, container);
    const input = container.querySelector('input');
    input.dispatchEvent(new Event('input'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles onChange', () => {
    const handler = vi.fn();
    function App() {
      return createElement('input', { onChange: handler });
    }
    render(App, null, container);
    const input = container.querySelector('input');
    input.dispatchEvent(new Event('change'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes old event listeners when handler changes', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    function App() {
      const [useSecond, setUseSecond] = useState(false);
      return createElement('div', null,
        createElement('button', { id: 'target', onClick: useSecond ? handler2 : handler1 }, 'Target'),
        createElement('button', { id: 'toggle', onClick: () => setUseSecond(true) }, 'Toggle')
      );
    }
    render(App, null, container);

    // Click with first handler
    container.querySelector('#target').click();
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(0);

    // Switch handler
    container.querySelector('#toggle').click();
    await new Promise(r => setTimeout(r, 10));

    // Click with second handler
    container.querySelector('#target').click();
    expect(handler1).toHaveBeenCalledTimes(1); // Still 1
    expect(handler2).toHaveBeenCalledTimes(1); // Now 1
  });

  it('handles onSubmit with preventDefault', () => {
    const handler = vi.fn(e => e.preventDefault());
    function App() {
      return createElement('form', { onSubmit: handler },
        createElement('button', { type: 'submit' }, 'Submit')
      );
    }
    render(App, null, container);
    const form = container.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles multiple events on same element', () => {
    const clickHandler = vi.fn();
    const mouseEnterHandler = vi.fn();
    function App() {
      return createElement('button', { onClick: clickHandler, onMouseEnter: mouseEnterHandler }, 'Button');
    }
    render(App, null, container);
    const button = container.querySelector('button');
    button.click();
    button.dispatchEvent(new Event('mouseenter'));
    expect(clickHandler).toHaveBeenCalledTimes(1);
    expect(mouseEnterHandler).toHaveBeenCalledTimes(1);
  });

  it('handles onClick in Shadow DOM', () => {
    const handler = vi.fn();
    function App() {
      return createElement('button', { onClick: handler }, 'Click me');
    }
    render(App, null, container, { useShadow: true });
    const shadowRoot = container.shadowRoot;
    const button = shadowRoot.querySelector('button');
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles state updates with events in Shadow DOM', async () => {
    function App() {
      const [count, setCount] = useState(0);
      return createElement('div', null,
        createElement('span', { id: 'count' }, String(count)),
        createElement('button', { onClick: () => setCount(c => c + 1) }, 'Increment')
      );
    }
    render(App, null, container, { useShadow: true });
    const shadowRoot = container.shadowRoot;

    expect(shadowRoot.querySelector('#count').textContent).toBe('0');

    shadowRoot.querySelector('button').click();
    await new Promise(r => setTimeout(r, 10));

    expect(shadowRoot.querySelector('#count').textContent).toBe('1');
  });
});
