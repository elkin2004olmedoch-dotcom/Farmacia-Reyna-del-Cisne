const {defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({
  testDir:__dirname,testMatch:'*.spec.cjs',workers:1,fullyParallel:false,timeout:60000,
  reporter:[['list'],['json',{outputFile:'test-results/reto2-browser-results.json'}]],
  use:{baseURL:'http://localhost:3300',channel:'chrome',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{command:'node tests/reto2/browser-server.cjs',cwd:path.resolve(__dirname,'../..'),url:'http://localhost:3300/api/salud',reuseExistingServer:false,timeout:60000},
  projects:[{name:'escritorio',use:{viewport:{width:1440,height:1000}}},{name:'movil',use:{viewport:{width:375,height:900}}}],
});
