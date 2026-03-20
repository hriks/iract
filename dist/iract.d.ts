// Type definitions for iRact

export type IRactElement<P = any> = {
    $typeof: symbol;
    type: string | Function | symbol;
    props: P & { children?: IRactNode };
};

export type IRactNode =
    | IRactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | IRactNode[];

export type FC<P = {}> = (props: P & { children?: IRactNode }) => IRactNode;

export type SetStateAction<S> = S | ((prevState: S) => S);
export type Dispatch<A> = (action: A) => void;
export type Reducer<S, A> = (prevState: S, action: A) => S;

export interface MutableRefObject<T> {
    current: T;
}

export interface Context<T> {
    Provider: FC<{ value: T; children?: IRactNode }>;
    Consumer: FC<{ children: (value: T) => IRactNode }>;
    _currentValue: T;
}

export interface IRactRoot {
    container: Element;
    instance: any;
    unmount: () => void;
}

// Element creation
export function createElement<P>(
    type: string | FC<P>,
    props?: P | null,
    ...children: IRactNode[]
): IRactElement<P>;

export function cloneElement<P>(
    element: IRactElement<P>,
    props?: Partial<P> | null,
    ...children: IRactNode[]
): IRactElement<P>;

export function isValidElement(object: any): object is IRactElement;

// Portals
export function createPortal(children: IRactNode, container: Element): IRactElement;

// Context
export function createContext<T>(defaultValue: T): Context<T>;

// Rendering
export function render<P>(
    component: FC<P>,
    props: P | null,
    container: Element | string
): IRactRoot;

export function renderLegacy<P>(
    component: FC<P>,
    container: Element | string,
    props?: P | null,
    onRendered?: () => void
): IRactRoot;

export function unmount(container: Element | string): void;

// Hooks
export function useState<S>(
    initialState: S | (() => S)
): [S, Dispatch<SetStateAction<S>>];

export function useEffect(
    effect: () => void | (() => void),
    deps?: readonly any[]
): void;

export function useReducer<S, A>(
    reducer: Reducer<S, A>,
    initialArg: S,
    init?: (arg: S) => S
): [S, Dispatch<A>];

export function useRef<T>(initialValue: T): MutableRefObject<T>;
export function useRef<T>(initialValue: T | null): MutableRefObject<T | null>;
export function useRef<T = undefined>(): MutableRefObject<T | undefined>;

export function useMemo<T>(factory: () => T, deps: readonly any[]): T;

export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: readonly any[]
): T;

export function useContext<T>(context: Context<T>): T;

// Higher-order components
export function memo<P>(
    component: FC<P>,
    areEqual?: (prevProps: P, nextProps: P) => boolean
): FC<P>;

export function forwardRef<P, R>(
    render: (props: P, ref: MutableRefObject<R>) => IRactNode
): FC<P & { ref?: MutableRefObject<R> }>;

export function lazy<P>(
    loader: () => Promise<{ default: FC<P> }>
): FC<P>;

// Components
export const Suspense: FC<{ fallback: IRactNode; children?: IRactNode }>;
export const StrictMode: FC<{ children?: IRactNode }>;
export const Profiler: FC<{ children?: IRactNode }>;
export const Fragment: symbol;

// Default export
declare const iRact: {
    h: typeof createElement;
    Fragment: symbol;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useMemo: typeof useMemo;
    useCallback: typeof useCallback;
    useContext: typeof useContext;
    createContext: typeof createContext;
    useReducer: typeof useReducer;
    useRef: typeof useRef;
    memo: typeof memo;
    forwardRef: typeof forwardRef;
    lazy: typeof lazy;
    Suspense: typeof Suspense;
    StrictMode: typeof StrictMode;
    Profiler: typeof Profiler;
    render: typeof render;
    renderLegacy: typeof renderLegacy;
    unmount: typeof unmount;
    cloneElement: typeof cloneElement;
    isValidElement: typeof isValidElement;
    createPortal: typeof createPortal;
    version: string;
};

export default iRact;
