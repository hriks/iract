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
  }
];
