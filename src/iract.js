/**
 * @license iRact
 * A lightweight React-like framework (no React dependency)
 *
 * MIT License
 */

'use strict';

// --- Internal Symbols ---
const IRACT_ELEMENT = Symbol.for("iract.element");
const IRACT_FRAGMENT = Symbol.for("iract.fragment");

// --- Namespaces for SVG ---
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

// --- Current container (for hook closures / Suspense wakeups) ---
let currentContainer = null;

// --- Dispatcher for hooks for the *current function component render* ---
let currentDispatcher = null;

const isText = v => typeof v === "string" || typeof v === "number";

// ---------- Utilities ----------
function makeRange() {
    const start = document.createComment("iract:start");
    const end = document.createComment("iract:end");
    return { start, end };
}

function mountRange(parent, start, end, nodes) {
    parent.appendChild(start);
    nodes.forEach(n => parent.appendChild(n));
    parent.appendChild(end);
}

function removeRange(parent, start, end) {
    // Safety: only attempt removal if markers belong to parent
    if (!start || !end) return;
    if (start.parentNode !== parent || end.parentNode !== parent) return;

    let n = start;
    while (n) {
        const next = n.nextSibling;
        if (n.parentNode === parent) { try { parent.removeChild(n); } catch (e) {} }
        if (n === end) break;
        n = next;
    }
}

function getStartNode(inst) {
    return inst ? (inst._range ? inst._range.start : inst.dom) : null;
}

function insertCreatedBefore(parent, created, beforeNode) {
    if (!created) return;
    // Safety check: ensure beforeNode is actually a child of parent
    // If not, use null to append at the end
    const safeBeforeNode = (beforeNode && beforeNode.parentNode === parent) ? beforeNode : null;
    if (created._mountNodes && created._range) {
        parent.insertBefore(created._range.start, safeBeforeNode);
        created._mountNodes.forEach(n => parent.insertBefore(n, safeBeforeNode));
        parent.insertBefore(created._range.end, safeBeforeNode);
        delete created._mountNodes;
    } else if (created.dom) {
        parent.insertBefore(created.dom, safeBeforeNode);
    }
}

// Drop null/false and whitespace-only text nodes
function normalizeChildren(children) {
    const arr = Array.isArray(children) ? children : [children];
    const flat = arr.flat();
    const out = [];
    for (const c of flat) {
        if (c == null || c === false) continue;
        if (isText(c) && String(c).trim() === "") continue;
        out.push(c);
    }
    return out;
}

// ---------- Element creation ----------
function createElement(type, props, ...children) {
    const normalizedProps = { ...(props || {}), children: children.flat() };
    return { $typeof: IRACT_ELEMENT, type, props: normalizedProps };
}

function cloneElement(element, props, ...children) {
    return createElement(
        element.type,
        { ...element.props, ...props },
        ...(children.length ? children : element.props.children || [])
    );
}

function isValidElement(object) {
    return typeof object === "object" && object !== null && object.$typeof === IRACT_ELEMENT;
}

// ---------- Context ----------
function createContext(defaultValue) {
    const context = { _currentValue: defaultValue };
    context.Provider = function Provider({ value, children }) {
        context._currentValue = value;
        return children;
    };
    context.Consumer = function Consumer({ children }) {
        return children(context._currentValue);
    };
    return context;
}

// ---------- Public rendering ----------
function render(component, props, container, options = {}) {
    if (typeof container === "string") container = document.querySelector(container);
    if (!container) throw new Error("iRact.render: container not found");

    // Handle options - can be boolean (useShadow) or object
    const opts = typeof options === "boolean" ? { useShadow: options } : options;
    const { useShadow = false, styles = null } = opts;

    // Determine render target (shadow root or container)
    let renderTarget = container;
    let shadowRoot = null;

    if (useShadow) {
        // Create or reuse shadow root
        if (!container._iractShadowRoot) {
            shadowRoot = container.attachShadow({ mode: 'open' });
            container._iractShadowRoot = shadowRoot;
        } else {
            shadowRoot = container._iractShadowRoot;
        }
        renderTarget = shadowRoot;

        // Inject styles if provided
        if (styles && !shadowRoot._iractStylesInjected) {
            const styleEl = document.createElement('style');
            styleEl.textContent = Array.isArray(styles) ? styles.join('\n') : styles;
            shadowRoot.appendChild(styleEl);
            shadowRoot._iractStylesInjected = true;
        }
    }

    const element = createElement(component, props);

    if (!container._iractRoot) {
        if (useShadow) {
            // Clear shadow root content except styles
            const styleEl = shadowRoot.querySelector('style');
            shadowRoot.innerHTML = '';
            if (styleEl) shadowRoot.appendChild(styleEl);
        } else {
            container.innerHTML = "";
        }
    }

    currentContainer = renderTarget;

    // Store back-reference from shadow root to container for rerender
    if (shadowRoot) {
        shadowRoot._iractHostContainer = container;
    }

    const instance = reconcile(renderTarget, container._iractRoot?.instance || null, element);

    container._iractRoot = {
        container,
        renderTarget,
        shadowRoot,
        instance,
        unmount: () => {
            if (shadowRoot) {
                shadowRoot.innerHTML = "";
                delete container._iractShadowRoot;
            } else {
                container.innerHTML = "";
            }
            delete container._iractRoot;
        }
    };

    return container._iractRoot;
}

function renderLegacy(component, container, props, onRendered) {
    const root = render(component, props, container);
    if (onRendered && typeof onRendered === "function") {
        requestAnimationFrame(() => requestAnimationFrame(onRendered));
    }
    return root;
}

function unmount(container) {
    if (typeof container === "string") container = document.querySelector(container);
    if (!container || !container._iractRoot) return;
    container._iractRoot.unmount();
}

// ---------- Unmount helper (run cleanups) ----------
function unmountInstance(instance) {
    if (!instance) return;

    if (instance.childInstances) instance.childInstances.forEach(unmountInstance);
    if (instance.childInstance) unmountInstance(instance.childInstance);

    if (instance.hooks) {
        for (const h of instance.hooks) {
            if (h && typeof h.cleanup === "function") {
                try { h.cleanup(); } catch {}
            }
        }
    }
}

function removeInstance(parent, instance) {
    if (!instance) return;
    unmountInstance(instance); // run cleanups
    if (instance._range) {
        removeRange(parent, instance._range.start, instance._range.end);
    } else if (instance.dom && instance.dom.parentNode === parent) {
        parent.removeChild(instance.dom);
    }
}

// ---------- Rerender batching ----------
let pending = new Set();
let scheduled = false;

function scheduleRerender(container) {
    pending.add(container);
    if (!scheduled) {
        scheduled = true;
        (typeof queueMicrotask === "function" ? queueMicrotask : (fn => Promise.resolve().then(fn)))(() => {
            scheduled = false;
            const list = Array.from(pending);
            pending.clear();
            for (const c of list) rerender(c);
        });
    }
}

// ---------- Shared list reconciler (non-keyed, insertion-first) ----------
function reconcileList(parent, oldChildren, nextChildren, endAnchor /* Node|null */) {
    const sameType = (oldInst, newEl) => {
        if (!oldInst || !newEl) return false;
        if (isText(newEl)) return oldInst.dom && oldInst.dom.nodeType === Node.TEXT_NODE;
        if (Array.isArray(newEl)) return Array.isArray(oldInst.element);
        if (isValidElement(newEl)) return oldInst.element?.type === newEl.type;
        return false;
    };

    const newList = [];
    let iOld = 0;
    let iNew = 0;

    while (iOld < oldChildren.length && iNew < nextChildren.length) {
        const oldInst = oldChildren[iOld];
        const newEl = nextChildren[iNew];

        if (sameType(oldInst, newEl)) {
            const updated = reconcile(parent, oldInst, newEl);
            if (updated) newList.push(updated);
            iOld++; iNew++;
            continue;
        }

        const nextNew = nextChildren[iNew + 1];
        const nextOld = oldChildren[iOld + 1];

        if (sameType(oldInst, nextNew)) {
            const created = instantiate(newEl, parent.namespaceURI === SVG_NS ? "svg" : "html");
            if (created) {
                const beforeNode = getStartNode(oldInst) || endAnchor || null;
                insertCreatedBefore(parent, created, beforeNode);
                newList.push(created);
            }
            iNew++;
            continue;
        }

        if (sameType(nextOld, newEl)) {
            removeInstance(parent, oldInst);
            iOld++;
            continue;
        }

        const created = instantiate(newEl, parent.namespaceURI === SVG_NS ? "svg" : "html");
        if (created) {
            const beforeNode = getStartNode(oldInst) || endAnchor || null;
            insertCreatedBefore(parent, created, beforeNode);
            newList.push(created);
        }
        removeInstance(parent, oldInst);
        iOld++;
        iNew++;
    }

    const beforeNode = getStartNode(oldChildren[iOld]) || endAnchor || null;
    for (; iNew < nextChildren.length; iNew++) {
        const created = instantiate(nextChildren[iNew], parent.namespaceURI === SVG_NS ? "svg" : "html");
        if (created) {
            insertCreatedBefore(parent, created, beforeNode);
            newList.push(created);
        }
    }

    for (; iOld < oldChildren.length; iOld++) {
        removeInstance(parent, oldChildren[iOld]);
    }

    return newList;
}

// ---------- Reconciler ----------
function reconcile(parentDom, instance, element) {
    if (instance == null) {
        const newInstance = instantiate(element, parentDom.namespaceURI === SVG_NS ? "svg" : "html");
        if (newInstance?._mountNodes && newInstance._range) {
            mountRange(parentDom, newInstance._range.start, newInstance._range.end, newInstance._mountNodes);
            delete newInstance._mountNodes;
        } else if (newInstance?.dom) {
            parentDom.appendChild(newInstance.dom);
        }
        return newInstance;
    }

    if (element == null) {
        removeInstance(parentDom, instance);
        return null;
    }

    const beforeNodeOfOld = getStartNode(instance);

    if (isText(element)) {
        if (instance.dom && instance.dom.nodeType === Node.TEXT_NODE) {
            const prev = String(instance.element);
            const next = String(element);
            if (prev !== next) instance.dom.nodeValue = next;
            instance.element = element;
            instance.childInstances = [];
            return instance;
        }
        const newInstance = instantiate(element, parentDom.namespaceURI === SVG_NS ? "svg" : "html");
        insertCreatedBefore(parentDom, newInstance, beforeNodeOfOld);
        removeInstance(parentDom, instance);
        return newInstance;
    }

    if (Array.isArray(element)) {
        const newInstance = instantiate(element, parentDom.namespaceURI === SVG_NS ? "svg" : "html");
        insertCreatedBefore(parentDom, newInstance, beforeNodeOfOld);
        removeInstance(parentDom, instance);
        return newInstance;
    }

    if (instance.element?.type !== element.type) {
        const newInstance = instantiate(element, parentDom.namespaceURI === SVG_NS ? "svg" : "html");
        insertCreatedBefore(parentDom, newInstance, beforeNodeOfOld);
        removeInstance(parentDom, instance);
        return newInstance;
    }

    if (typeof element.type === "string") {
        updateDomProperties(instance.dom, instance.element.props, element.props);
        instance.childInstances = reconcileChildren(instance, element);
        instance.element = element;
        return instance;
    }

    if (typeof element.type === "function") {
        const prevDispatcher = currentDispatcher;
        const dispatcher = {
            hooks: instance.hooks || [],
            i: 0,
            commitEffects: [],
            container: currentContainer
        };
        currentDispatcher = dispatcher;

        const childElement = element.type(element.props);
        const childInstance = reconcile(parentDom, instance.childInstance, childElement);

        const effects = dispatcher.commitEffects.slice();
        currentDispatcher = prevDispatcher;
        try { effects.forEach(fn => fn && fn()); } catch {}

        instance.dom = childInstance.dom || (childInstance._range ? childInstance._range.start : null);
        instance.childInstance = childInstance;
        instance.element = element;
        instance.hooks = dispatcher.hooks;
        instance._range = childInstance._range || null;

        if (childInstance && childInstance._mountNodes) {
            instance._mountNodes = childInstance._mountNodes;
        } else {
            delete instance._mountNodes;
        }

        return instance;
    }

    if (element.type === IRACT_FRAGMENT) {
        const range = instance._range;
        if (!range || !range.start || !range.end) {
            const newInstance = instantiate(element, parentDom.namespaceURI === SVG_NS ? "svg" : "html");
            insertCreatedBefore(parentDom, newInstance, beforeNodeOfOld);
            removeInstance(parentDom, instance);
            return newInstance;
        }

        const { end } = range;
        const parent = parentDom;
        const nextEls = normalizeChildren(element.props.children);
        const oldChildren = instance.childInstances || [];

        const newChildren = reconcileList(parent, oldChildren, nextEls, end);

        instance.element = element;
        instance.childInstances = newChildren;
        return instance;
    }

    console.error("iRact.reconcile: invalid element", element);
    return null;
}

// ---------- Children reconciler ----------
function reconcileChildren(instance, element) {
    const parent = instance.dom;
    const oldChildren = instance.childInstances || [];
    const nextChildren = normalizeChildren(element.props.children);
    return reconcileList(parent, oldChildren, nextChildren, null);
}

function fixSelectValue(dom, props) {
    if (dom.tagName === "SELECT" && props && "value" in props) {
        try {
            dom.value = props.value;
        } catch {}
    }
}

// ---------- Instantiation ----------
function instantiate(element, ns = "html") {
    if (element == null || typeof element === "boolean") return null;

    if (isText(element)) {
        const dom = document.createTextNode(String(element));
        return { dom, element, childInstances: [] };
    }

    if (Array.isArray(element)) {
        const range = makeRange();
        const childInstances = element.map(el => instantiate(el, ns)).filter(Boolean);
        const mountNodes = [];
        childInstances.forEach(ci => {
            if (ci._mountNodes && ci._range) {
                mountNodes.push(ci._range.start, ...ci._mountNodes, ci._range.end);
                delete ci._mountNodes;
            } else {
                mountNodes.push(ci.dom);
            }
        });
        return { element, childInstances, _range: range, _mountNodes: mountNodes };
    }

    if (typeof element.type === "string") {
        const isSvgElement = ns === "svg" || element.type === "svg";
        const dom = isSvgElement
            ? document.createElementNS(SVG_NS, element.type)
            : document.createElement(element.type);

        updateDomProperties(dom, {}, element.props);
        const children = normalizeChildren(element.props.children);
        const childNS = (isSvgElement && element.type !== "foreignObject") ? "svg" : "html";
        const childInstances = children.map(el => instantiate(el, childNS)).filter(Boolean);
        childInstances.forEach(ci => {
            if (ci._mountNodes && ci._range) {
                mountRange(dom, ci._range.start, ci._range.end, ci._mountNodes);
                delete ci._mountNodes;
            } else {
                dom.appendChild(ci.dom);
            }
        });

        fixSelectValue(dom, element.props);

        return { dom, element, childInstances };
    }

    if (element.type === IRACT_FRAGMENT) {
        const range = makeRange();
        const children = normalizeChildren(element.props.children);
        const childInstances = children.map(el => instantiate(el, ns)).filter(Boolean);
        const mountNodes = [];
        childInstances.forEach(ci => {
            if (ci._mountNodes && ci._range) {
                mountNodes.push(ci._range.start, ...ci._mountNodes, ci._range.end);
                delete ci._mountNodes;
            } else {
                mountNodes.push(ci.dom);
            }
        });
        return { element, childInstances, _range: range, _mountNodes: mountNodes };
    }

    if (typeof element.type === "function") {
        const prevDispatcher = currentDispatcher;
        const dispatcher = { hooks: [], i: 0, commitEffects: [], container: currentContainer };
        currentDispatcher = dispatcher;

        const childElement = element.type(element.props || {});
        const childInstance = instantiate(childElement, ns);

        const effects = dispatcher.commitEffects.slice();
        const hooks = dispatcher.hooks;

        currentDispatcher = prevDispatcher;
        try { effects.forEach(fn => fn && fn()); } catch {}

        const dom = childInstance?.dom || (childInstance?._range ? childInstance._range.start : null);

        const inst = {
            dom,
            element,
            childInstance,
            hooks,
            _range: childInstance?._range || null
        };
        if (childInstance && childInstance._mountNodes) {
            inst._mountNodes = childInstance._mountNodes;
        }
        return inst;
    }

    console.error("iRact.instantiate: invalid element", element);
    return null;
}

/* =========================
   ONLY CHANGE BELOW: Props/Attr support
   ========================= */

const SPECIAL_ATTR_MAP = { className: "class", htmlFor: "for" };
const isDashedAttr = name => name.includes("-") || name.startsWith("data-") || name.startsWith("aria-");
const isAttrLike = name => name === "role" || isDashedAttr(name);
const isPropertyLike = (dom, name) => (name in dom) && !isAttrLike(name);

// SVG-specific aliases
const SVG_ATTR_ALIASES = {
    className: "class",
    htmlFor: "for",
    viewBox: "viewBox",
    preserveAspectRatio: "preserveAspectRatio",
    patternContentUnits: "patternContentUnits",
    patternUnits: "patternUnits"
};

function setSvgAttr(dom, name, value) {
    if (name === "xlinkHref") {
        if (value == null || value === false) dom.removeAttributeNS(XLINK_NS, "href");
        else dom.setAttributeNS(XLINK_NS, "xlink:href", String(value));
        return true;
    }
    if (name === "xmlnsXlink") {
        if (value == null || value === false) dom.removeAttribute("xmlns:xlink");
        else dom.setAttribute("xmlns:xlink", String(value));
        return true;
    }
    const attr = SVG_ATTR_ALIASES[name] || name;
    if (value == null || value === false) dom.removeAttribute(attr);
    else if (value === true) dom.setAttribute(attr, "");
    else dom.setAttribute(attr, String(value));
    return true;
}

function setDomAttribute(dom, name, value) {
    const attr = SPECIAL_ATTR_MAP[name] || name;
    if (value == null || value === false) {
        dom.removeAttribute(attr);
        return;
    }
    if (value === true) {
        dom.setAttribute(attr, "");
        return;
    }
    dom.setAttribute(attr, String(value));
}

function diffStyle(dom, prev, next) {
    if (typeof next === "string") {
        dom.style.cssText = next;
        return;
    }
    const prevObj = (prev && typeof prev === "object") ? prev : {};
    const nextObj = (next && typeof next === "object") ? next : {};
    for (const k in prevObj) {
        if (!(k in nextObj)) dom.style[k] = "";
    }
    for (const k in nextObj) {
        dom.style[k] = nextObj[k];
    }
}

function diffDataset(dom, prev, next) {
    const prevObj = (prev && typeof prev === "object") ? prev : {};
    const nextObj = (next && typeof next === "object") ? next : {};
    for (const k in prevObj) {
        if (!(k in nextObj)) delete dom.dataset[k];
    }
    for (const k in nextObj) {
        const val = nextObj[k];
        if (val == null) delete dom.dataset[k];
        else dom.dataset[k] = String(val);
    }
}

function updateDomProperties(dom, prevProps = {}, nextProps = {}) {
    const isEvent = name => name.startsWith("on");
    const isProperty = name =>
        name !== "children" &&
        name !== "ref" &&
        name !== "dangerouslySetInnerHTML";
    const inSvg = dom.namespaceURI === SVG_NS;

    // Handle event listeners - consolidate add/remove logic
    const allEventNames = new Set([
        ...Object.keys(prevProps).filter(isEvent),
        ...Object.keys(nextProps).filter(isEvent)
    ]);
    allEventNames.forEach(name => {
        const eventName = name.toLowerCase().substring(2);
        const oldHandler = prevProps[name];
        const newHandler = nextProps[name];
        if (oldHandler !== newHandler) {
            if (oldHandler) dom.removeEventListener(eventName, oldHandler);
            if (newHandler) dom.addEventListener(eventName, newHandler);
        }
    });

    Object.keys(prevProps).forEach(name => {
        if (!isProperty(name)) return;
        if (name in nextProps) return;
        if (name === "style") { diffStyle(dom, prevProps.style, {}); return; }
        if (name === "dataset") { diffDataset(dom, prevProps.dataset, {}); return; }
        if (name === "value" && dom.tagName === "INPUT" && dom.type === "file") return;
        if (inSvg) { setSvgAttr(dom, name, null); return; }
        if (name === "className") { setDomAttribute(dom, "className", null); dom.className = ""; return; }
        if (name === "htmlFor") { setDomAttribute(dom, "htmlFor", null); return; }
        if (isAttrLike(name)) { setDomAttribute(dom, name, null); }
        else if (isPropertyLike(dom, name)) {
            try { dom[name] = ""; } catch { setDomAttribute(dom, name, null); }
        } else { setDomAttribute(dom, name, null); }
    });

    Object.keys(nextProps).forEach(name => {
        if (name === "children") return;
        if (isEvent(name)) return; // Already handled above
        const value = nextProps[name];
        if (name === "dangerouslySetInnerHTML") {
            const prev = prevProps?.dangerouslySetInnerHTML?.__html;
            const next = value && typeof value === "object" ? value.__html ?? "" : "";
            if (prev !== next) dom.innerHTML = next;
            return;
        }
        if (name === "ref") {
            const oldRef = prevProps.ref;
            if (oldRef) {
                if (typeof oldRef === "function") oldRef(null);
                else if (typeof oldRef === "object") oldRef.current = null;
            }
            if (value) {
                if (typeof value === "function") value(dom);
                else if (typeof value === "object") value.current = dom;
            }
            return;
        }
        if (name === "style") { diffStyle(dom, prevProps.style, value); return; }
        if (name === "dataset") { diffDataset(dom, prevProps.dataset, value); return; }
        if (name === "value" && dom.tagName === "INPUT" && dom.type === "file") return;
        if (inSvg) { setSvgAttr(dom, name, value); return; }
        if (name === "className") {
            const prev = prevProps.className;
            if (prev !== value) {
                dom.className = value || "";
                setDomAttribute(dom, "className", value);
            }
            return;
        }
        if (name === "htmlFor") { setDomAttribute(dom, "htmlFor", value); return; }
        if (typeof value === "boolean" && !isPropertyLike(dom, name)) {
            setDomAttribute(dom, name, value);
            if (name in dom) { try { dom[name] = value; } catch {} }
            return;
        }
        if (isAttrLike(name) || !isPropertyLike(dom, name)) { setDomAttribute(dom, name, value); }
        else {
            try { dom[name] = value; } catch { setDomAttribute(dom, name, value); }
        }
    });
}

// ---------- Hooks ----------
function rerender(container) {
    // Handle case where container is actually a shadow root (from useState in shadow DOM)
    const actualContainer = container?._iractHostContainer || container;
    if (!actualContainer?._iractRoot) return;
    const { instance, renderTarget } = actualContainer._iractRoot;
    const element = instance.element;
    // Use renderTarget (shadow root) if available, otherwise container
    const target = renderTarget || actualContainer;
    currentContainer = target;
    const updated = reconcile(target, instance, element);
    actualContainer._iractRoot.instance = updated;
}

function useState(initial) {
    const i = currentDispatcher.i++;
    let hook = currentDispatcher.hooks[i];
    if (!hook) {
        hook = { state: typeof initial === "function" ? initial() : initial };
        currentDispatcher.hooks[i] = hook;
    }
    const container = currentDispatcher.container;
    const setState = action => {
        const next = typeof action === "function" ? action(hook.state) : action;
        if (Object.is(next, hook.state)) return;
        hook.state = next;
        scheduleRerender(container);
    };
    return [hook.state, setState];
}

function useEffect(effect, deps) {
    const i = currentDispatcher.i++;
    let hook = currentDispatcher.hooks[i];
    if (!hook) {
        hook = { deps: undefined, cleanup: undefined };
        currentDispatcher.hooks[i] = hook;
    }
    const hasChanged =
        !deps ||
        !hook.deps ||
        deps.length !== hook.deps.length ||
        deps.some((d, j) => d !== hook.deps[j]);
    if (hasChanged) {
        currentDispatcher.commitEffects.push(() => {
            if (hook.cleanup) { try { hook.cleanup(); } catch {} }
            hook.cleanup = effect() || undefined;
            hook.deps = deps;
        });
    }
}

function useReducer(reducer, initialArg, init) {
    const [state, setState] = useState(init ? init(initialArg) : initialArg);
    const dispatch = action => setState(prev => reducer(prev, action));
    return [state, dispatch];
}

function useRef(initial) {
    const i = currentDispatcher.i++;
    let hook = currentDispatcher.hooks[i];
    if (!hook) {
        hook = { ref: { current: initial } };
        currentDispatcher.hooks[i] = hook;
    }
    return hook.ref;
}

function useMemo(factory, deps) {
    const i = currentDispatcher.i++;
    let hook = currentDispatcher.hooks[i];
    if (!hook) {
        hook = { value: undefined, deps: undefined };
        currentDispatcher.hooks[i] = hook;
    }
    const hasChanged =
        !hook.deps ||
        deps.length !== hook.deps.length ||
        deps.some((d, j) => d !== hook.deps[j]);
    if (hasChanged) {
        hook.value = factory();
        hook.deps = deps;
    }
    return hook.value;
}

function useCallback(callback, deps) {
    return useMemo(() => callback, deps);
}

function useContext(context) {
    return context._currentValue;
}

// ---------- Extras ----------
function memo(component, areEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)) {
    return function Memoized(props) {
        const prevProps = Memoized._prevProps;
        if (prevProps && areEqual(prevProps, props)) {
            return Memoized._prevVNode;
        }
        Memoized._prevProps = props;
        Memoized._prevVNode = component(props);
        return Memoized._prevVNode;
    };
}

function forwardRef(renderFn) {
    return function Forwarded(props) {
        return renderFn(props, props.ref || null);
    };
}

function lazy(loader) {
    let Loaded = null;
    let loadError = null;
    let loadPromise = null;
    return function Lazy(props) {
        if (loadError) throw loadError;
        if (Loaded) return Loaded(props);
        if (!loadPromise) {
            loadPromise = loader()
                .then(m => { Loaded = m.default; })
                .catch(e => { loadError = e; });
        }
        throw loadPromise;
    };
}

function Suspense({ fallback, children }) {
    try {
        return children;
    } catch (promise) {
        if (promise && typeof promise.then === "function") {
            promise.then(() => scheduleRerender(currentContainer));
        }
        return fallback;
    }
}

function StrictMode({ children }) { return children; }
function Profiler({ children }) { return children; }

// ---------- API ----------
const iRact = {
    h: createElement,
    Fragment: IRACT_FRAGMENT,
    useState, useEffect, useMemo, useCallback, useContext, createContext, useReducer, useRef,
    memo, forwardRef, lazy, Suspense, StrictMode, Profiler,
    render, renderLegacy, unmount,
    cloneElement, isValidElement,
    version: "0.0.5"
};

export default iRact;
const h = createElement;

export {
    createElement,
    h,
    cloneElement,
    isValidElement,
    createContext,
    render,
    renderLegacy,
    unmount,
    useState,
    useEffect,
    useReducer,
    useRef,
    useMemo,
    useCallback,
    useContext,
    memo,
    forwardRef,
    lazy,
    Suspense,
    StrictMode,
    Profiler,
    IRACT_FRAGMENT as Fragment
};
