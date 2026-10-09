const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
process.chdir(path.resolve(__dirname,'..'));
const folder='docs/pruebas/reto2';fs.mkdirSync(folder,{recursive:true});
const tasks=[
  ['node-tests',[process.execPath,['--test','--test-concurrency=1','tests/reto2/api.test.cjs','tests/reto2/resources.test.cjs']]],
  ['browser-tests',[process.execPath,['node_modules/@playwright/test/cli.js','test','--config','tests/reto2/playwright.config.cjs']]],
  ['npm-audit',[process.execPath,[process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js'),'audit','--json']]],
];
const summary={fecha:'2026-10-09',node:process.version,resultados:[]};
for(const [name,[command,args]] of tasks){
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:10*1024*1024});
  const output=(result.stdout || '')+(result.stderr || '');fs.writeFileSync(path.join(folder,name+(name==='npm-audit'?'.json':'.txt')),output);
  summary.resultados.push({prueba:name,exitCode:result.status});console.info(`${name}: ${result.status===0?'OK':'FALLO'}`);
  if(result.status!==0){console.error(output);process.exitCode=1;break;}
}
fs.writeFileSync(path.join(folder,'resumen.json'),JSON.stringify(summary,null,2)+'\n');
