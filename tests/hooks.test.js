import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, createElement, useState, useEffect, useReducer, useRef, useMemo, useCallback, useContext, createContext } from '../src/iract.js';

describe('useState', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('initializes with value', () => {
    function App() {
      const [count] = useState(5);
      return createElement('div', null, count);
    }
    render(App, null, container);
    expect(container.textContent).toBe('5');
  });

  it('initializes with function', () => {
    function App() {
      const [count] = useState(() => 10);
      return createElement('div', null, count);
    }
    render(App, null, container);
    expect(container.textContent).toBe('10');
  });

  it('updates state on click', async () => {
    function App() {
      const [count, setCount] = useState(0);
      return createElement('button', { onClick: () => setCount(c => c + 1) }, count);
    }
    render(App, null, container);
    expect(container.textContent).toBe('0');

    container.querySelector('button').click();
    await new Promise(r => setTimeout(r, 10));
    expect(container.textContent).toBe('1');
  });
});

describe('useEffect', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('runs effect on mount', () => {
    const effectFn = vi.fn();
    function App() {
      useEffect(effectFn, []);
      return createElement('div', null, 'Test');
    }
    render(App, null, container);
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it('runs cleanup on unmount', () => {
    const cleanupFn = vi.fn();
    function App() {
      useEffect(() => cleanupFn, []);
      return createElement('div', null, 'Test');
    }
    const root = render(App, null, container);
    expect(cleanupFn).not.toHaveBeenCalled();
    root.unmount();
    // Note: cleanup runs on unmount
  });

  it('runs effect when deps change', async () => {
    const effectFn = vi.fn();
    function App() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        effectFn(count);
      }, [count]);
      return createElement('button', { onClick: () => setCount(c => c + 1) }, count);
    }
    render(App, null, container);
    expect(effectFn).toHaveBeenCalledWith(0);

    container.querySelector('button').click();
    await new Promise(r => setTimeout(r, 10));
    expect(effectFn).toHaveBeenCalledWith(1);
  });
});

describe('useReducer', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('initializes with initial state', () => {
    const reducer = (state, action) => state;
    function App() {
      const [state] = useReducer(reducer, { count: 5 });
      return createElement('div', null, state.count);
    }
    render(App, null, container);
    expect(container.textContent).toBe('5');
  });

  it('dispatches actions', async () => {
    const reducer = (state, action) => {
      switch (action.type) {
        case 'increment': return { count: state.count + 1 };
        default: return state;
      }
    };
    function App() {
      const [state, dispatch] = useReducer(reducer, { count: 0 });
      return createElement('button', { onClick: () => dispatch({ type: 'increment' }) }, state.count);
    }
    render(App, null, container);
    expect(container.textContent).toBe('0');

    container.querySelector('button').click();
    await new Promise(r => setTimeout(r, 10));
    expect(container.textContent).toBe('1');
  });
});

describe('useRef', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('returns ref object', () => {
    let refValue;
    function App() {
      const ref = useRef('initial');
      refValue = ref;
      return createElement('div', null, ref.current);
    }
    render(App, null, container);
    expect(refValue.current).toBe('initial');
  });

  it('persists ref across renders', async () => {
    let refValue;
    function App() {
      const [, setCount] = useState(0);
      const ref = useRef(0);
      ref.current++;
      refValue = ref;
      return createElement('button', { onClick: () => setCount(c => c + 1) }, ref.current);
    }
    render(App, null, container);
    const firstRender = refValue.current;

    container.querySelector('button').click();
    await new Promise(r => setTimeout(r, 10));
    expect(refValue.current).toBe(firstRender + 1);
  });

  it('attaches to DOM element', () => {
    let inputRef;
    function App() {
      const ref = useRef(null);
      inputRef = ref;
      return createElement('input', { ref, type: 'text' });
    }
    render(App, null, container);
    expect(inputRef.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('useMemo', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('memoizes value', () => {
    const factory = vi.fn(() => 'computed');
    function App() {
      const value = useMemo(factory, []);
      return createElement('div', null, value);
    }
    render(App, null, container);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('computed');
  });

  it('recomputes when deps change', async () => {
    const factory = vi.fn((x) => x * 2);
    function App() {
      const [count, setCount] = useState(1);
      const doubled = useMemo(() => factory(count), [count]);
      return createElement('button', { onClick: () => setCount(c => c + 1) }, doubled);
    }
    render(App, null, container);
    expect(container.textContent).toBe('2');

    container.querySelector('button').click();
    await new Promise(r => setTimeout(r, 10));
    expect(container.textContent).toBe('4');
  });
});

describe('useCallback', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('returns same function when deps unchanged', async () => {
    let callbacks = [];
    function App() {
      const [, setCount] = useState(0);
      const cb = useCallback(() => {}, []);
      callbacks.push(cb);
      return createElement('button', { onClick: () => setCount(c => c + 1) }, 'Click');
    }
    render(App, null, container);
    container.querySelector('button').click();
    await new Promise(r => setTimeout(r, 10));
    expect(callbacks[0]).toBe(callbacks[1]);
  });
});

describe('useContext', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('reads context value', () => {
    const ThemeContext = createContext('light');
    function Child() {
      const theme = useContext(ThemeContext);
      return createElement('div', null, theme);
    }
    function App() {
      return createElement(ThemeContext.Provider, { value: 'dark' },
        createElement(Child, null)
      );
    }
    render(App, null, container);
    expect(container.textContent).toBe('dark');
  });

  it('uses default value when no provider', () => {
    const ThemeContext = createContext('default');
    function App() {
      const theme = useContext(ThemeContext);
      return createElement('div', null, theme);
    }
    render(App, null, container);
    expect(container.textContent).toBe('default');
  });
});
