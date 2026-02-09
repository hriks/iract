# iRact

A lightweight React-like framework with hooks, context, and virtual DOM. No dependencies.

## Installation

```bash
npm install iract
```

## Usage

### With Vite (Recommended)

The easiest way to use iRact with JSX:

```js
// vite.config.js
import { defineConfig } from 'vite';
import iract from 'iract/vite';

export default defineConfig({
  plugins: [iract()]
});
```

Then JSX just works - no additional configuration needed:

```jsx
// App.jsx
import { useState, render } from 'iract';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}

render(App, null, '#root');
```

### ES Modules

```js
import iRact, { useState, useEffect, render } from 'iract';

function Counter() {
  const [count, setCount] = useState(0);

  return iRact.h('div', null,
    iRact.h('p', null, `Count: ${count}`),
    iRact.h('button', { onClick: () => setCount(c => c + 1) }, 'Increment')
  );
}

render(Counter, null, document.getElementById('root'));
```

### Browser (UMD)

```html
<script src="https://unpkg.com/iract"></script>
<script>
  const { useState, render, h } = iRact;

  function App() {
    const [name, setName] = useState('World');
    return h('h1', null, `Hello, ${name}!`);
  }

  render(App, null, '#root');
</script>
```

### With JSX (Babel)

Configure Babel to use iRact:

```json
{
  "plugins": [
    ["@babel/plugin-transform-react-jsx", {
      "pragma": "iRact.h",
      "pragmaFrag": "iRact.Fragment"
    }]
  ]
}
```

Then use JSX:

```jsx
import iRact, { useState, render } from 'iract';

function App() {
  const [items, setItems] = useState(['Apple', 'Banana']);

  return (
    <ul>
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
}

render(App, null, '#root');
```

## API

### Rendering

#### `render(component, props, container, options?)`

Renders a component into a DOM container.

```js
render(App, { title: 'My App' }, document.getElementById('root'));
render(App, null, '#root'); // selector string also works
```

**With Shadow DOM** (for CSS isolation):

```js
// With styles
import styles from './styles.css?inline';
render(App, null, '#root', { useShadow: true, styles });

// Without styles
render(App, null, '#root', { useShadow: true });

// Shorthand
render(App, null, '#root', true);
```

#### `unmount(container)`

Unmounts and cleans up a rendered component.

```js
unmount('#root');
```

### Hooks

#### `useState(initialState)`

```js
const [state, setState] = useState(0);
const [state, setState] = useState(() => expensiveComputation());

setState(newValue);
setState(prev => prev + 1);
```

#### `useEffect(effect, deps)`

```js
useEffect(() => {
  console.log('Mounted or updated');
  return () => console.log('Cleanup');
}, [dependency]);

useEffect(() => {
  console.log('Run once on mount');
}, []);
```

#### `useReducer(reducer, initialArg, init?)`

```js
const [state, dispatch] = useReducer(
  (state, action) => {
    switch (action.type) {
      case 'increment': return { count: state.count + 1 };
      default: return state;
    }
  },
  { count: 0 }
);

dispatch({ type: 'increment' });
```

#### `useRef(initialValue)`

```js
const inputRef = useRef(null);

// Access: inputRef.current
```

#### `useMemo(factory, deps)`

```js
const computed = useMemo(() => expensiveCalculation(a, b), [a, b]);
```

#### `useCallback(callback, deps)`

```js
const handleClick = useCallback(() => {
  console.log(value);
}, [value]);
```

#### `useContext(context)`

```js
const value = useContext(MyContext);
```

### Context

#### `createContext(defaultValue)`

```js
const ThemeContext = createContext('light');

function App() {
  return iRact.h(ThemeContext.Provider, { value: 'dark' },
    iRact.h(Child, null)
  );
}

function Child() {
  const theme = useContext(ThemeContext);
  return iRact.h('div', null, `Theme: ${theme}`);
}
```

### Components

#### `Fragment`

Group elements without adding extra DOM nodes.

```js
iRact.h(iRact.Fragment, null,
  iRact.h('li', null, 'Item 1'),
  iRact.h('li', null, 'Item 2')
);
```

#### `Suspense`

```js
const LazyComponent = lazy(() => import('./LazyComponent.js'));

iRact.h(Suspense, { fallback: iRact.h('div', null, 'Loading...') },
  iRact.h(LazyComponent, null)
);
```

### Higher-Order Components

#### `memo(component, areEqual?)`

Memoize a component to prevent unnecessary re-renders.

```js
const MemoizedComponent = memo(MyComponent);
const MemoizedComponent = memo(MyComponent, (prev, next) => prev.id === next.id);
```

#### `forwardRef(render)`

```js
const Input = forwardRef((props, ref) => {
  return iRact.h('input', { ref, ...props });
});
```

#### `lazy(loader)`

```js
const LazyComponent = lazy(() => import('./Component.js'));
```

### Utilities

#### `createElement(type, props, ...children)`

Create a virtual DOM element. Aliased as `iRact.h`.

```js
const element = createElement('div', { className: 'box' }, 'Hello');
```

#### `cloneElement(element, props, ...children)`

Clone and modify an element.

```js
const cloned = cloneElement(element, { className: 'new-class' });
```

#### `isValidElement(object)`

Check if an object is a valid iRact element.

```js
isValidElement(element); // true or false
```

## Shadow DOM

iRact supports rendering components inside Shadow DOM for complete CSS isolation. This is useful when embedding components in third-party pages or when you need styles that won't leak in or out.

```js
import { render, useState } from 'iract';
import styles from './widget.css?inline';  // Vite's ?inline imports as string

function Widget() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onclick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

// Render with Shadow DOM and scoped styles
render(Widget, null, '#widget-root', { useShadow: true, styles });
```

**Note:** When using Shadow DOM, global CSS (via `import './styles.css'`) won't apply inside the shadow root. Use the `?inline` suffix to import CSS as a string and pass it via the `styles` option.

| Approach | Global CSS works? | CSS isolated? |
|----------|------------------|---------------|
| `render(C, null, '#app')` | Yes | No |
| `render(C, null, '#app', { useShadow: true, styles })` | No | Yes |

## Features

- Virtual DOM with efficient reconciliation
- Hooks API (useState, useEffect, useReducer, useRef, useMemo, useCallback, useContext)
- Context API for state management
- Shadow DOM support for CSS isolation
- Fragments for grouping elements
- SVG support
- Refs (callback and object refs)
- memo, forwardRef, lazy, Suspense
- Event handling
- Controlled inputs
- dangerouslySetInnerHTML support
- Small bundle size (~12KB minified)

## Browser Support

Works in all modern browsers (ES2015+).

## License

MIT
