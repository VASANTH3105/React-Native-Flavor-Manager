import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true, // Inject CJS/ESM shims like __dirname
  minify: false,
  sourcemap: true,
  target: 'node20',
});
