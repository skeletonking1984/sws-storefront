import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';

/**
 * Stamps app/data/build-info.json (see scripts/stamp-build.mjs) from a Vite
 * `buildStart` hook, not just the npm `prebuild`/`predev` lifecycle hooks.
 *
 * Why, 2026-09-27: `/api/version` on production reported commit 4c3bd96
 * while production was actually serving 076fb36+ code -- the stamp was
 * stale relative to what was live. `npm run build`/`npm run dev` both
 * already ran `scripts/stamp-build.mjs` via `prebuild`/`predev` (see
 * package.json), which stamps correctly when either of THOSE exact npm
 * scripts runs. But Oxygen deploys via `@shopify/cli-hydrogen`'s own
 * `hydrogen deploy`, which calls into this same Vite config's build
 * directly rather than shelling out to `npm run build` -- so the npm
 * lifecycle hook never fires for a real deploy, and build-info.json ships
 * whatever a developer's local `npm run dev`/`build` last happened to
 * stamp on their own machine, potentially commits behind. A Vite plugin's
 * `buildStart` fires for every build Vite itself performs, dev or
 * production, regardless of which CLI entry point triggered it, so this is
 * the one hook that cannot be bypassed by a deploy path that skips npm's
 * own script runner. The npm hooks stay too (cheap, and correct for a
 * plain local `npm run build`), this is belt and suspenders, not a
 * replacement.
 */
function stampBuildInfo() {
  return {
    name: 'sws-stamp-build-info',
    buildStart() {
      try {
        execFileSync('node', ['scripts/stamp-build.mjs'], {
          cwd: fileURLToPath(new URL('.', import.meta.url)),
          stdio: 'inherit',
        });
      } catch (error) {
        // Same "never fail the build over a stamp" contract as
        // scripts/stamp-build.mjs's own git failures degrade to 'unknown'.
        console.warn(
          '[stamp-build] failed, build-info.json left as-is:',
          error,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    stampBuildInfo(),
    tailwindcss(),
    hydrogen(),
    oxygen(),
    reactRouter(),
  ],
  resolve: {
    alias: {
      // Vite's native tsconfig path resolver does not cover JavaScript
      // projects that use jsconfig.json, so define Hydrogen's app alias here.
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
    tsconfigPaths: true,
  },
  build: {
    // Allow a strict Content-Security-Policy
    // without inlining assets as base64:
    assetsInlineLimit: 0,
  },
  ssr: {
    optimizeDeps: {
      /**
       * Include dependencies here if they throw CJS<>ESM errors.
       * For example, for the following error:
       *
       * > ReferenceError: module is not defined
       * >   at /path/to/project/node_modules/example-dep/index.js:1:1
       *
       * Include 'example-dep' in the array below.
       * @see https://vitejs.dev/config/dep-optimization-options
       */
      include: [
        'react-router > set-cookie-parser',
        'react-router > cookie',
        'react-router',
      ],
    },
  },
  server: {
    allowedHosts: ['.tryhydrogen.dev'],
  },
});
