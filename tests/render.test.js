import { describe, it, expect, beforeEach } from 'vitest';
import iRact, { render, unmount, createElement, useState } from '../src/iract.js';

describe('render', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders a simple element', () => {
    function App() {
      return createElement('div', null, 'Hello World');
    }
    render(App, null, container);
    expect(container.textContent).toBe('Hello World');
  });

  it('renders nested elements', () => {
    function App() {
      return createElement('div', null,
        createElement('h1', null, 'Title'),
        createElement('p', null, 'Paragraph')
      );
    }
    render(App, null, container);
    expect(container.querySelector('h1').textContent).toBe('Title');
    expect(container.querySelector('p').textContent).toBe('Paragraph');
  });

  it('renders with props', () => {
    function App({ name }) {
      return createElement('div', null, `Hello ${name}`);
    }
    render(App, { name: 'iRact' }, container);
    expect(container.textContent).toBe('Hello iRact');
  });

  it('renders with className', () => {
    function App() {
      return createElement('div', { className: 'test-class' }, 'Content');
    }
    render(App, null, container);
    expect(container.querySelector('.test-class')).not.toBeNull();
  });

  it('renders with style object', () => {
    function App() {
      return createElement('div', { style: { color: 'red', fontSize: '20px' } }, 'Styled');
    }
    render(App, null, container);
    const div = container.querySelector('div');
    expect(div.style.color).toBe('red');
    expect(div.style.fontSize).toBe('20px');
  });

  it('unmounts correctly', () => {
    function App() {
      return createElement('div', null, 'Content');
    }
    render(App, null, container);
    expect(container.textContent).toBe('Content');
    unmount(container);
    expect(container.textContent).toBe('');
  });

  it('renders fragments', () => {
    function App() {
      return createElement(iRact.Fragment, null,
        createElement('span', null, 'One'),
        createElement('span', null, 'Two')
      );
    }
    render(App, null, container);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('One');
    expect(spans[1].textContent).toBe('Two');
  });

  it('renders lists', () => {
    function App() {
      const items = ['A', 'B', 'C'];
      return createElement('ul', null,
        items.map(item => createElement('li', null, item))
      );
    }
    render(App, null, container);
    const lis = container.querySelectorAll('li');
    expect(lis.length).toBe(3);
    expect(lis[0].textContent).toBe('A');
    expect(lis[1].textContent).toBe('B');
    expect(lis[2].textContent).toBe('C');
  });

  it('handles conditional rendering', () => {
    function App({ show }) {
      return createElement('div', null,
        show && createElement('span', null, 'Visible')
      );
    }
    render(App, { show: true }, container);
    expect(container.querySelector('span')).not.toBeNull();

    render(App, { show: false }, container);
    expect(container.querySelector('span')).toBeNull();
  });

  it('clears style when transitioning to empty string', async () => {
    function App() {
      const [hidden, setHidden] = useState(true);
      return createElement('div', null,
        createElement('div', {
          id: 'target',
          style: hidden ? 'display:none' : ''
        }, 'Content'),
        createElement('button', { id: 'toggle', onClick: () => setHidden(false) }, 'Show')
      );
    }
    render(App, null, container);

    const target = container.querySelector('#target');
    expect(target.style.display).toBe('none');

    container.querySelector('#toggle').click();
    await new Promise(r => setTimeout(r, 10));

    expect(target.style.display).toBe('');
  });
});
