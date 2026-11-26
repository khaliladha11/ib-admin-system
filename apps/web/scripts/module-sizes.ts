// Plugin build opsional (ANALYZE=1 pnpm build): ukuran per paket/folder di chunk yang dimuat
// saat aplikasi dibuka. Dipakai untuk laporan docs/BUNDLE.md.
import type { Plugin } from 'vite';

const label = (id: string) => {
  const pkg = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(id);
  if (pkg?.[1]) return pkg[1];
  return id.replace(/^.*?\/(apps|packages)\//, '$1/').replace(/\/[^/]+$/, '');
};

export function moduleSizes(): Plugin {
  return {
    name: 'ib-module-sizes',
    apply: 'build',
    generateBundle(_options, bundle) {
      const initialNames = new Set<string>();
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          initialNames.add(file.fileName);
          for (const imp of file.imports) initialNames.add(imp);
        }
      }
      const sizes = new Map<string, number>();
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk' || !initialNames.has(file.fileName)) continue;
        for (const [id, mod] of Object.entries(file.modules)) {
          sizes.set(label(id), (sizes.get(label(id)) ?? 0) + mod.renderedLength);
        }
      }
      const rows = [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 25);
      console.log('\nIsi bundel awal (sebelum minify, per paket/folder):');
      for (const [name, size] of rows) {
        console.log(`${(size / 1024).toFixed(1).padStart(8)} KB  ${name}`);
      }
    },
  };
}
