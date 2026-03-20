import { describe, it, expect, beforeEach, vi } from 'vitest';
import iRact, { render, unmount, createElement, createPortal, useState, useEffect, useContext, createContext } from '../src/iract.js';

const h = createElement;
const Fragment = iRact.Fragment;

describe('createPortal', () => {
    let container;
    let portalTarget;

    beforeEach(() => {
        container = document.createElement('div');
        portalTarget = document.createElement('div');
        document.body.appendChild(container);
        document.body.appendChild(portalTarget);
    });

    it('renders children into the portal target, not the parent', () => {
        function App() {
            return h('div', null,
                h('span', null, 'parent content'),
                createPortal(h('p', null, 'portal content'), portalTarget)
            );
        }
        render(App, null, container);
        expect(container.textContent).toBe('parent content');
        expect(portalTarget.querySelector('p').textContent).toBe('portal content');
    });

    it('places a placeholder comment in the parent DOM', () => {
        function App() {
            return h('div', null,
                createPortal(h('span', null, 'hello'), portalTarget)
            );
        }
        render(App, null, container);
        const div = container.querySelector('div');
        const comments = [];
        for (const node of div.childNodes) {
            if (node.nodeType === Node.COMMENT_NODE) comments.push(node);
        }
        expect(comments.some(c => c.nodeValue === 'iract:portal')).toBe(true);
    });

    it('supports state updates inside portal children', async () => {
        let setter;
        function Counter() {
            const [count, setCount] = useState(0);
            setter = setCount;
            return h('span', null, `count:${count}`);
        }
        function App() {
            return h('div', null,
                createPortal(h(Counter, null), portalTarget)
            );
        }
        render(App, null, container);
        expect(portalTarget.textContent).toBe('count:0');

        setter(1);
        await new Promise(r => queueMicrotask(r));
        expect(portalTarget.textContent).toBe('count:1');
    });

    it('runs useEffect in portal children', () => {
        const effectFn = vi.fn();
        function Child() {
            useEffect(effectFn, []);
            return h('div', null, 'effect child');
        }
        function App() {
            return createPortal(h(Child, null), portalTarget);
        }
        render(App, null, container);
        expect(effectFn).toHaveBeenCalledTimes(1);
        expect(portalTarget.textContent).toBe('effect child');
    });

    it('cleans up portal children when portal is removed', async () => {
        let toggle;
        const cleanupFn = vi.fn();
        function PortalChild() {
            useEffect(() => cleanupFn, []);
            return h('span', null, 'portal child');
        }
        function App() {
            const [show, setShow] = useState(true);
            toggle = setShow;
            return h('div', null,
                show ? createPortal(h(PortalChild, null), portalTarget) : null
            );
        }
        render(App, null, container);
        expect(portalTarget.textContent).toBe('portal child');

        toggle(false);
        await new Promise(r => queueMicrotask(r));
        expect(portalTarget.textContent).toBe('');
        expect(cleanupFn).toHaveBeenCalledTimes(1);
    });

    it('propagates context through portal', () => {
        const ThemeCtx = createContext('light');
        function PortalChild() {
            const theme = useContext(ThemeCtx);
            return h('span', null, `theme:${theme}`);
        }
        function App() {
            return h(ThemeCtx.Provider, { value: 'dark' },
                h('div', null,
                    createPortal(h(PortalChild, null), portalTarget)
                )
            );
        }
        render(App, null, container);
        expect(portalTarget.textContent).toBe('theme:dark');
    });

    it('handles portal container change', async () => {
        const target1 = document.createElement('div');
        const target2 = document.createElement('div');
        document.body.appendChild(target1);
        document.body.appendChild(target2);

        let setTarget;
        function App() {
            const [target, _setTarget] = useState(target1);
            setTarget = _setTarget;
            return h('div', null,
                createPortal(h('p', null, 'moved'), target)
            );
        }
        render(App, null, container);
        expect(target1.querySelector('p').textContent).toBe('moved');
        expect(target2.querySelector('p')).toBeNull();

        setTarget(target2);
        await new Promise(r => queueMicrotask(r));
        expect(target1.querySelector('p')).toBeNull();
        expect(target2.querySelector('p').textContent).toBe('moved');
    });

    it('supports nested portals', () => {
        const inner = document.createElement('div');
        document.body.appendChild(inner);

        function App() {
            return h('div', null,
                createPortal(
                    h('div', null,
                        'outer portal',
                        createPortal(h('span', null, 'inner portal'), inner)
                    ),
                    portalTarget
                )
            );
        }
        render(App, null, container);
        expect(portalTarget.textContent).toBe('outer portal');
        expect(inner.textContent).toBe('inner portal');
    });

    it('supports fragment children in portal', () => {
        function App() {
            return h('div', null,
                createPortal(
                    h(Fragment, null,
                        h('span', null, 'a'),
                        h('span', null, 'b')
                    ),
                    portalTarget
                )
            );
        }
        render(App, null, container);
        const spans = portalTarget.querySelectorAll('span');
        expect(spans.length).toBe(2);
        expect(spans[0].textContent).toBe('a');
        expect(spans[1].textContent).toBe('b');
    });

    it('throws on invalid container', () => {
        expect(() => createPortal(h('div', null), null)).toThrow('container must be a DOM element');
        expect(() => createPortal(h('div', null), 'not-a-dom')).toThrow('container must be a DOM element');
        expect(() => createPortal(h('div', null), {})).toThrow('container must be a DOM element');
    });

    it('cleans up portal children from target on unmount', () => {
        function App() {
            return h('div', null,
                createPortal(h('p', null, 'portal content'), portalTarget)
            );
        }
        render(App, null, container);
        expect(portalTarget.querySelector('p').textContent).toBe('portal content');

        unmount(container);
        expect(portalTarget.querySelector('p')).toBeNull();
    });

    it('cleans up fragment-returning component in portal on unmount', () => {
        function FragList() {
            return h(Fragment, null,
                h('span', null, 'x'),
                h('span', null, 'y')
            );
        }
        function App() {
            return h('div', null,
                createPortal(h(FragList, null), portalTarget)
            );
        }
        render(App, null, container);
        expect(portalTarget.querySelectorAll('span').length).toBe(2);

        unmount(container);
        expect(portalTarget.querySelectorAll('span').length).toBe(0);
    });

    it('renders multiple children in portal', () => {
        function App() {
            return h('div', null,
                createPortal(
                    [h('span', null, 'first'), h('span', null, 'second')],
                    portalTarget
                )
            );
        }
        render(App, null, container);
        const spans = portalTarget.querySelectorAll('span');
        expect(spans.length).toBe(2);
        expect(spans[0].textContent).toBe('first');
        expect(spans[1].textContent).toBe('second');
    });
});
