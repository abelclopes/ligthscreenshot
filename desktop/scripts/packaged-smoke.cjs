const { spawnSync } = require('node:child_process');
const path = require('node:path');
const executable = process.platform === 'darwin'
  ? `dist/mac${process.arch === 'arm64' ? '-arm64' : ''}/ligthscreenshot.app/Contents/MacOS/ligthscreenshot`
  : process.platform === 'win32' ? 'dist/win-unpacked/ligthscreenshot.exe'
  : 'dist/linux-unpacked/io.github.abelclopes.ligthscreenshot';
const args = ['--smoke-test'];
// This is used only on isolated Linux CI runners, never in shipped launchers.
if (process.platform === 'linux' && process.env.CI) args.push('--no-sandbox');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(path.resolve(executable), args, { timeout: 90000, encoding: 'utf8', env });
console.log(result.stdout || '');
console.error(result.stderr || '');
if (result.error || result.status !== 0 || !result.stdout?.includes('SMOKE_OK')) {
  console.error(result.error || `Packaged smoke failed: ${result.status}`);
  process.exit(1);
}
