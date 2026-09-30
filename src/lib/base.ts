/** Where the app is served from. '/' locally; '/<repo>/' on GitHub Pages (set at build time through BASE_PATH, see
 *  rspack.config.mjs). Use withBase() for every fetch and plain <a href>; react-router links get the basename from main.tsx. */
export const BASE: string = (typeof __BASE_PATH__ === 'string' && __BASE_PATH__ ? __BASE_PATH__ : '/').replace(/\/?$/, '/');
/** Basename for the router: '' at the root, '/repo' under a sub-path. */
export const ROUTER_BASE = BASE === '/' ? '' : BASE.replace(/\/$/, '');
export const withBase = (path: string): string => BASE + path.replace(/^\//, '');
