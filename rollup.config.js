import terser from '@rollup/plugin-terser';

const input = 'src/iract.js';
const name = 'iRact';

export default [
  // ESM build
  {
    input,
    output: {
      file: 'dist/iract.esm.js',
      format: 'esm',
      sourcemap: true
    }
  },
  // CJS build
  {
    input,
    output: {
      file: 'dist/iract.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    }
  },
  // UMD build (minified, for browsers)
  {
    input,
    output: {
      file: 'dist/iract.umd.js',
      format: 'umd',
      name,
      sourcemap: true,
      exports: 'named'
    },
    plugins: [terser()]
  },
  // Vite plugin - ESM
  {
    input: 'src/vite/index.js',
    output: {
      file: 'dist/vite.js',
      format: 'esm',
      sourcemap: true
    },
    external: ['vite']
  },
  // Vite plugin - CJS
  {
    input: 'src/vite/index.js',
    output: {
      file: 'dist/vite.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    external: ['vite']
  }
];
