import { describe, it, expect, beforeEach } from 'vitest';
import { render, createElement } from '../src/iract.js';

describe('SVG rendering', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders SVG element', () => {
    function App() {
      return createElement('svg', { width: 100, height: 100 },
        createElement('circle', { cx: 50, cy: 50, r: 40 })
      );
    }
    render(App, null, container);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('renders SVG children in correct namespace', () => {
    function App() {
      return createElement('svg', { width: 100, height: 100 },
        createElement('circle', { cx: 50, cy: 50, r: 40 }),
        createElement('rect', { x: 10, y: 10, width: 20, height: 20 })
      );
    }
    render(App, null, container);
    const circle = container.querySelector('circle');
    const rect = container.querySelector('rect');
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(rect.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('does not add children attribute to SVG elements', () => {
    function App() {
      return createElement('svg', { width: 100, height: 100 },
        createElement('path', { d: 'M10 10 L20 20' })
      );
    }
    render(App, null, container);
    const svg = container.querySelector('svg');
    const path = container.querySelector('path');
    expect(svg.getAttribute('children')).toBeNull();
    expect(path.getAttribute('children')).toBeNull();
  });

  it('handles viewBox attribute', () => {
    function App() {
      return createElement('svg', { viewBox: '0 0 100 100' });
    }
    render(App, null, container);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  it('handles stroke and fill attributes', () => {
    function App() {
      return createElement('svg', { width: 100, height: 100 },
        createElement('circle', { cx: 50, cy: 50, r: 40, fill: 'red', stroke: 'blue', strokeWidth: 2 })
      );
    }
    render(App, null, container);
    const circle = container.querySelector('circle');
    expect(circle.getAttribute('fill')).toBe('red');
    expect(circle.getAttribute('stroke')).toBe('blue');
  });
});
