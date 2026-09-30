// Rspack dev server + production build for the Word by word app (src/ → dist/).
// The dev server serves ./data (CSV collections, enrichment, stories) at /data and falls back to index.html for react-router paths.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';
import { buildDataIndex } from './scripts/data-index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';
// BASE_PATH='/repo/' builds for a sub-path (GitHub Pages project site); default '/'.
const basePath = (process.env.BASE_PATH || '/').replace(/^\/?/, '/').replace(/\/?$/, '/');

export default defineConfig({
  context: here,
  entry: { main: './src/main.tsx' },
  output: { path: path.resolve(here, 'dist'), publicPath: basePath, filename: isDev ? '[name].js' : '[name].[contenthash:8].js', clean: true },
  resolve: { extensions: ['.tsx', '.ts', '.mjs', '.js'], alias: { '@': path.resolve(here, 'src') } },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic', development: isDev, refresh: isDev } },
            target: 'es2017',
          },
        },
        type: 'javascript/auto',
      },
      {
        // Dependencies are transpiled too so the whole bundle stays at the es2017 floor (Safari ≤ 16.3 cannot parse ES2022 class static blocks).
        test: /\.m?js$/,
        include: /node_modules/,
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'ecmascript' }, target: 'es2017' } },
        type: 'javascript/auto',
      },
      { test: /\.css$/, use: ['postcss-loader'], type: 'css' },
    ],
  },
  experiments: { css: true },
  plugins: [
    new rspack.DefinePlugin({ __BASE_PATH__: JSON.stringify(basePath) }),
    new rspack.HtmlRspackPlugin({ template: './index.html' }),
    new rspack.HtmlRspackPlugin({ template: './index.html', filename: '404.html' }),   // GitHub Pages serves this for unknown paths: deep links still open the app
    isDev ? new ReactRefreshPlugin() : null,
  ].filter(Boolean),
  devServer: {
    port: 8767,
    host: '127.0.0.1',
    historyApiFallback: true,
    static: [{ directory: path.resolve(here, 'data'), publicPath: '/data', watch: false }, { directory: path.resolve(here, 'layers'), publicPath: '/layers', watch: false }],
    // /data/index.json is built from data/*/dataset.json on every request, so adding or deleting a data folder shows up on reload.
    setupMiddlewares: middlewares => {
      middlewares.unshift({ name: 'data-index', path: '/data/index.json', middleware: (_req, res) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache'); res.end(JSON.stringify(buildDataIndex(path.resolve(here, 'data')))); } });
      return middlewares;
    },
    headers: { 'Cache-Control': 'no-cache' },
  },
  devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',
});
