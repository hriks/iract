# How iRact Works

A deep dive into the internals of iRact - a lightweight React-like framework.

## Table of Contents

1. [Overview](#overview)
2. [Virtual DOM](#virtual-dom)
3. [Rendering Pipeline](#rendering-pipeline)
4. [Reconciliation Algorithm](#reconciliation-algorithm)
5. [Hooks System](#hooks-system)
6. [Event Handling](#event-handling)
7. [Shadow DOM Support](#shadow-dom-support)
8. [Key Differences from React](#key-differences-from-react)

---

## Overview

iRact is a ~12KB React-like framework that implements:
- Virtual DOM with efficient diffing
- Hooks (useState, useEffect, useReducer, useRef, useMemo, useCallback, useContext)
- Context API
- Fragment support
- Shadow DOM for CSS isolation
- JSX support via Vite plugin

```
┌─────────────────────────────────────────────────────────┐
│                      Your App                           │
│  function App() { return <div>Hello</div> }             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   createElement (h)                      │
│  Transforms JSX to Virtual DOM elements                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      render()                            │
│  Entry point - mounts app to container                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   instantiate()                          │
│  Creates DOM nodes from virtual elements                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   reconcile()                            │
│  Diffs old vs new, applies minimal updates              │
└─────────────────────────────────────────────────────────┘
```

---

## Virtual DOM

### Element Structure

Every iRact element is a plain JavaScript object:

```javascript
{
  $typeof: Symbol.for("iract.element"),  // Type identifier
  type: "div" | Function | Fragment,      // Element type
  props: {
    children: [...],                       // Child elements
    className: "...",                      // Other props
    onClick: () => {}
  }
}
```

### createElement Function

```javascript
function createElement(type, props, ...children) {
  return {
    $typeof: IRACT_ELEMENT,
    type,
    props: { ...props, children: children.flat() }
  };
}
```

JSX like `<div className="box">Hello</div>` compiles to:

```javascript
createElement('div', { className: 'box' }, 'Hello')
```

---

## Rendering Pipeline

### 1. Initial Render

```javascript
render(App, props, container, options)
```

1. **Create element**: Wraps component in a virtual element
2. **Setup container**: Clears container or creates Shadow DOM
3. **Instantiate**: Creates actual DOM nodes
4. **Store root**: Saves reference for future updates

### 2. Instance Structure

Each rendered element creates an "instance" that tracks:

```javascript
{
  dom: HTMLElement,           // The actual DOM node
  element: VirtualElement,    // The virtual element
  childInstances: [...],      // Children instances
  hooks: [...],               // Hook states (for function components)
  _range: { start, end }      // Fragment markers (for fragments)
}
```

### 3. Re-renders

When state changes:

```javascript
setState(newValue)
    │
    ▼
scheduleRerender(container)
    │
    ▼
queueMicrotask(() => {
  reconcile(container, oldInstance, newElement)
})
```

Uses `queueMicrotask` for batching multiple state updates.

---

## Reconciliation Algorithm

The reconciler compares old and new virtual trees, applying minimal DOM updates.

### Core Logic

```javascript
function reconcile(parentDom, instance, element) {
  // Case 1: No previous instance - create new
  if (instance == null) {
    return instantiate(element);
  }

  // Case 2: Element removed
  if (element == null) {
    removeInstance(parentDom, instance);
    return null;
  }

  // Case 3: Type changed - replace entirely
  if (instance.element.type !== element.type) {
    const newInstance = instantiate(element);
    replaceInstance(parentDom, instance, newInstance);
    return newInstance;
  }

  // Case 4: Same type - update in place
  if (typeof element.type === "string") {
    // DOM element: update props, reconcile children
    updateDomProperties(instance.dom, oldProps, newProps);
    instance.childInstances = reconcileChildren(instance, element);
    return instance;
  }

  if (typeof element.type === "function") {
    // Function component: re-run and reconcile result
    const childElement = element.type(element.props);
    instance.childInstance = reconcile(parentDom, instance.childInstance, childElement);
    return instance;
  }
}
```

### Children Reconciliation

Uses a simple forward-matching algorithm:

```
Old: [A, B, C, D]
New: [A, X, C]

Step 1: A matches A → update in place
Step 2: B doesn't match X → insert X before B, remove B
Step 3: C matches C → update in place
Step 4: D has no match → remove D

Result: [A, X, C]
```

---

## Hooks System

### Dispatcher Pattern

Hooks work via a "dispatcher" that tracks the current component:

```javascript
let currentDispatcher = null;

function useState(initial) {
  const i = currentDispatcher.i++;           // Hook index
  let hook = currentDispatcher.hooks[i];     // Get existing hook

  if (!hook) {
    hook = { state: initial };               // Initialize on first render
    currentDispatcher.hooks[i] = hook;
  }

  const container = currentDispatcher.container;

  const setState = (action) => {
    const next = typeof action === "function"
      ? action(hook.state)
      : action;

    if (!Object.is(next, hook.state)) {      // Only update if changed
      hook.state = next;
      scheduleRerender(container);            // Trigger re-render
    }
  };

  return [hook.state, setState];
}
```

### Hook Rules

Hooks must be called:
1. At the top level of function components
2. In the same order every render

This is why hooks use an index (`i++`) - they rely on call order.

### useEffect Implementation

```javascript
function useEffect(effect, deps) {
  const i = currentDispatcher.i++;
  let hook = currentDispatcher.hooks[i];

  if (!hook) {
    hook = { deps: undefined, cleanup: undefined };
    currentDispatcher.hooks[i] = hook;
  }

  const depsChanged = !hook.deps ||
    deps.some((d, i) => !Object.is(d, hook.deps[i]));

  if (depsChanged) {
    // Schedule effect to run after render
    currentDispatcher.commitEffects.push(() => {
      if (hook.cleanup) hook.cleanup();      // Run previous cleanup
      hook.cleanup = effect();                // Run effect, store cleanup
    });
    hook.deps = deps;
  }
}
```

---

## Event Handling

### Event Binding

Events are attached directly to DOM elements:

```javascript
function updateDomProperties(dom, prevProps, nextProps) {
  // Find all event props (onClick, onInput, etc.)
  const eventNames = Object.keys(nextProps)
    .filter(name => name.startsWith("on"));

  eventNames.forEach(name => {
    const eventName = name.toLowerCase().substring(2); // "onClick" → "click"
    const oldHandler = prevProps[name];
    const newHandler = nextProps[name];

    if (oldHandler !== newHandler) {
      if (oldHandler) dom.removeEventListener(eventName, oldHandler);
      if (newHandler) dom.addEventListener(eventName, newHandler);
    }
  });
}
```

### Why Direct Binding?

Unlike React's synthetic event system, iRact binds directly to DOM:
- **Simpler**: No event pooling or delegation complexity
- **Smaller**: No synthetic event code needed
- **Native**: Full access to native event properties

---

## Shadow DOM Support

### How It Works

```javascript
render(App, null, container, { useShadow: true, styles: cssString })
```

1. **Create Shadow Root**:
```javascript
const shadowRoot = container.attachShadow({ mode: 'open' });
```

2. **Inject Styles**:
```javascript
const styleEl = document.createElement('style');
styleEl.textContent = styles;
shadowRoot.appendChild(styleEl);
```

3. **Render Inside**:
```javascript
// All DOM operations happen inside shadowRoot
instantiate(element) // → shadowRoot
```

### Benefits

- **CSS Isolation**: Styles don't leak in or out
- **Encapsulation**: Component is self-contained
- **No Conflicts**: Safe to embed in any page

### Gotchas

- `position: fixed` inside Shadow DOM still works relative to viewport
- Events bubble through shadow boundary
- Global styles (fonts, reset) need to be included in shadow styles

---

## Key Differences from React

| Feature | React | iRact |
|---------|-------|-------|
| Size | ~40KB min | ~12KB min |
| Event System | Synthetic events | Native events |
| Concurrent Mode | Yes | No |
| Server Rendering | Yes | No |
| Fiber Architecture | Yes | No (simpler recursion) |
| DevTools | Yes | No |
| Error Boundaries | Yes | No |
| Portals | Yes | No (use Shadow DOM) |
| Strict Mode | Yes | Basic |

### When to Use iRact

- Embeddable widgets (Shopify, WordPress, etc.)
- Size-critical applications
- Simple interactive components
- Learning how React-like frameworks work

### When to Use React

- Large applications
- Need ecosystem (React Router, Redux DevTools, etc.)
- Server-side rendering
- Complex state management

---

## File Structure

```
src/
├── iract.js          # Main library (~900 lines)
│   ├── createElement  # Virtual DOM creation
│   ├── render         # Entry point
│   ├── instantiate    # DOM creation
│   ├── reconcile      # Diffing algorithm
│   ├── hooks          # useState, useEffect, etc.
│   └── context        # createContext
│
└── vite/
    └── index.js       # Vite plugin for JSX
```

---

## Example: Complete Flow

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}

render(Counter, null, '#app');
```

### What Happens:

1. **render()** creates element `{ type: Counter, props: {} }`

2. **instantiate()** calls `Counter()` with dispatcher set up

3. **useState(0)** returns `[0, setState]`, stores hook at index 0

4. **Counter returns** virtual tree:
   ```javascript
   { type: 'div', props: { children: [
     { type: 'p', props: { children: ['Count: ', 0] } },
     { type: 'button', props: { onClick: fn, children: ['+'] } }
   ]}}
   ```

5. **instantiate()** creates real DOM:
   ```html
   <div>
     <p>Count: 0</p>
     <button>+</button>
   </div>
   ```

6. **Click button** → `setCount(c => c + 1)`

7. **scheduleRerender()** queues microtask

8. **reconcile()** re-runs Counter, gets new tree with count=1

9. **Diff finds** only text node changed: "Count: 0" → "Count: 1"

10. **Updates** just that text node: `textNode.nodeValue = "Count: 1"`

---

## Contributing

See the test files in `/tests` for examples of expected behavior. Run tests with:

```bash
npm test
```
