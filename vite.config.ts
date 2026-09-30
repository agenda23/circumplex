import { defineConfig } from 'vite';

export default defineConfig({
  // ref/ は参考用のクローン。依存解決・監視の対象から外す
  server: { watch: { ignored: ['**/ref/**'] } },
});
