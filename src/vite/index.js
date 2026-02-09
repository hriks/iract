import { transformWithEsbuild } from 'vite';

/**
 * Vite plugin for iRact
 * Enables JSX support without manual configuration
 */

/**
 * @typedef {Object} IractPluginOptions
 * @property {boolean} [jsxInject=true] - Auto-inject iRact import in JSX files
 */

/**
 * Vite plugin for iRact - enables JSX support
 * @param {IractPluginOptions} [options]
 * @returns {import('vite').Plugin}
 */
export default function iract(options = {}) {
  const { jsxInject = true } = options;

  return {
    name: 'vite-plugin-iract',
    enforce: 'pre',

    config() {
      return {
        esbuild: {
          jsxFactory: 'iRact.h',
          jsxFragment: 'iRact.Fragment',
          jsxInject: jsxInject ? `import iRact from 'iract'` : undefined
        },
        optimizeDeps: {
          esbuildOptions: {
            loader: {
              '.js': 'jsx'
            }
          }
        }
      };
    },

    async transform(code, id) {
      if (!id.match(/src\/.*\.js$/)) return null;

      return transformWithEsbuild(code, id, {
        loader: 'jsx',
        jsxFactory: 'iRact.h',
        jsxFragment: 'iRact.Fragment'
      });
    }
  };
}

export { iract };
