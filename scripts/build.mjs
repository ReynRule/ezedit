// public/ → dist/ 복사 + ffmpeg.wasm 파일을 같은 도메인(dist/vendor)으로 복사
// (Worker는 다른 도메인 CDN에서 불러올 수 없어서 직접 호스팅해야 합니다)
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';

const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('public', out, { recursive: true });

const vendor = [
  ['node_modules/@ffmpeg/ffmpeg/dist/umd', `${out}/vendor/ffmpeg`],
  ['node_modules/@ffmpeg/util/dist/umd', `${out}/vendor/util`],
  ['node_modules/@ffmpeg/core/dist/umd', `${out}/vendor/core`],
];
for (const [from, to] of vendor) {
  if (!existsSync(from)) {
    console.error(`없음: ${from}  → 먼저 npm install 을 실행하세요.`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true });
}
console.log('빌드 완료 → dist/');
