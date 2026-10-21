const {defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({
  testDir:__dirname,testMatch:'pages.spec.cjs',workers:1,fullyParallel:false,timeout:60000,
  outputDir:path.join(__dirname,'test-results/pages-artifacts'),
  reporter:[['list'],['json',{outputFile:'test-results/pages-browser-results.json'}]],
  use:{baseURL:'http://127.0.0.1:3301',channel:'chrome',headless:true,serviceWorkers:'block',screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{command:'node tests/reto2/pages-server.cjs',cwd:path.resolve(__dirname,'../..'),url:'http://127.0.0.1:3301/',reuseExistingServer:false,timeout:60000},
  projects:[{name:'escritorio',use:{viewport:{width:1440,height:1000}}},{name:'movil',use:{viewport:{width:375,height:900}}}],
});
