const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
function requireFiles(files) {
  if (!files.length) throw Error('Required suite is empty');
  for (const file of files) if (!fs.existsSync(path.join(root, file)) || !fs.statSync(path.join(root, file)).isFile() || !fs.statSync(path.join(root, file)).size) throw Error(`Required file missing/empty: ${file}`);
}
function testCount(output, kind) {
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
  if (kind === 'flutter' || kind === 'flutter-drive') {
    const count=/All tests passed[!.]/.test(plain) ? Math.max(0, ...[...plain.matchAll(/\+(\d+)/g)].map(m => Number(m[1]))) : 0;
    return Math.max(0,count-(kind==='flutter-drive' && /\(tearDownAll\)/.test(plain)?1:0));
  }
  const passes=[...plain.matchAll(/^\s*[ℹ#]?\s*pass\s+(\d+)\s*$/gm)];
  return [...(passes.length?passes:plain.matchAll(/^\s*[ℹ#]?\s*tests\s+(\d+)\s*$/gm)), ...plain.matchAll(/Tests\s+(\d+)\s+passed/g), ...plain.matchAll(/(?:^|\n)\s*(\d+) passed\s*\(/g),
    ...plain.matchAll(/"observedTests":(\d+)/g)].reduce((n,m) => n + Number(m[1]), 0);
}
async function command(label, binary, args, { cwd = root, env = process.env, tests, accepted = [0], timeout = 600000 } = {}) {
  const logs = path.join(root, 'qa/.cache/p11'); const artifacts = path.join(root, 'qa/artifacts/p11');
  fs.mkdirSync(logs, { recursive: true }); fs.mkdirSync(artifacts, { recursive: true });
  const output = fs.createWriteStream(path.join(logs, `${label}.log`));
  let text = '', timedOut = false; const started = Date.now();
  let batch=false;
  if (process.platform === 'win32' && /\.bat$/i.test(binary)) {
    if ([binary,...args].some(a=>/["&|<>^%!\r\n]/.test(a))) throw Error('Unsafe batch invocation');
    args=['/d','/s','/c',`""${binary}" ${args.map(a=>`"${a}"`).join(' ')}"`]; binary=process.env.COMSPEC || 'cmd.exe'; batch=true;
  }
  const child = spawn(binary, args, { cwd, env, windowsHide: true, windowsVerbatimArguments:batch, stdio: ['ignore','pipe','pipe'] });
  // Raw child output can include emulator tokens/requests. Keep it local and
  // publish only this narrow summary, never stdout/stderr, traces or env values.
  for (const stream of [child.stdout, child.stderr]) stream.setEncoding('utf8').on('data', data => { output.write(data); text = (text + data).slice(-8000000); });
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform==='win32' && child.pid) {
      const stopped=spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:5000});
      if(stopped.status!==0)child.kill();
    } else child.kill();
  }, timeout);
  const code = await new Promise(resolve => { child.once('error', () => resolve(null)); child.once('close', resolve); });
  clearTimeout(timer); await new Promise(resolve => output.end(resolve));
  const count = tests ? testCount(text, tests) : null;
  const passed = !timedOut && accepted.includes(code) && (!tests || count > 0);
  const result = { label, node:process.version, passed, exitCode: code, observedTests: count, timedOut, durationMs: Date.now() - started };
  fs.writeFileSync(path.join(artifacts, `${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!passed) throw Error(`${label} failed${tests && !count ? ': no passing test result observed' : ''}; raw diagnostics are local under qa/.cache/p11`);
  return result;
}
module.exports = { root, requireFiles, command, testCount };
