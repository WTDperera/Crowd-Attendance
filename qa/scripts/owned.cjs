const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { root } = require('./command.cjs');
async function services(task, web = false, withApi = true) {
  const children = [];
  function start(action) {
    fs.mkdirSync(path.join(root,'qa/.cache/p11'),{recursive:true});
    const log=fs.openSync(path.join(root,`qa/.cache/p11/owned-${action}.log`),'w');
    const child = spawn(process.execPath, ['scripts/run.cjs', action], { cwd: path.join(root,'qa'), env: process.env, windowsHide: true, stdio: ['ignore',log,log] });
    fs.closeSync(log);
    child.on('error', () => {}); children.push(child);
  }
  function stop() {
    for (const child of children.reverse()) if (child.exitCode === null && child.pid) {
      if (process.platform === 'win32') {
        const stopped=spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:5000});
        if(stopped.status!==0)child.kill();
      }
      else child.kill('SIGTERM');
    }
  }
  const interrupt = () => { stop(); process.exitCode=1; };
  process.once('SIGINT',interrupt); process.once('SIGTERM',interrupt);
  try {
    // Never reuse a listener owned by another process, even on loopback.
    const net = require('node:net');
    for (const port of [...(withApi?[5000]:[]),...(web?[5173]:[])]) {
      await new Promise((resolve,reject) => { const probe=net.createServer(); probe.once('error',()=>reject(Error(`Required QA port ${port} is occupied`))); probe.listen(port,'127.0.0.1',()=>probe.close(resolve)); });
    }
    if (withApi) start('api'); if (web) start('web');
    for (const url of ['http://127.0.0.1:5000/api/attendance/test', ...(web?['http://127.0.0.1:5173']:[])]) {
      let ready=false;
      for (let attempt=0;attempt<40;attempt++) {
        if (children.some(c=>c.exitCode!==null || !c.pid)) throw Error('Owned service exited during startup');
        try { if ((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok) {ready=true;break;} } catch {}
        await new Promise(resolve=>setTimeout(resolve,500));
      }
      if(!ready) throw Error('Owned local service readiness failed');
    }
    return await task();
  } finally { stop(); process.removeListener('SIGINT',interrupt); process.removeListener('SIGTERM',interrupt); }
}
module.exports={services};
