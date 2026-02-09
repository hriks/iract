import { Plugin } from 'vite';

export interface IractPluginOptions {
  /**
   * Auto-inject iRact import in JSX files
   * @default true
   */
  jsxInject?: boolean;
}

/**
 * Vite plugin for iRact - enables JSX support without configuration
 */
declare function iract(options?: IractPluginOptions): Plugin;

export default iract;
export { iract };
