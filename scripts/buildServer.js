import esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['api/server.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    external: ['pg-native'],
    outfile: 'api/index.js',
  });
  console.log('Successfully bundled api/index.js with esbuild!');
}

build().catch((err) => {
  console.error('Build server error:', err);
  process.exit(1);
});
