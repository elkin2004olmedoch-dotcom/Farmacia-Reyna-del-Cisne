const fs=require('node:fs'),{defineConfig}=require('@playwright/test'),base=require('./playwright.config.cjs');
const brave='C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
module.exports=defineConfig({...base,testMatch:'mascot-browser.motion.cjs',outputDir:'test-results/mascot-browser',projects:[{name:'chrome',use:{channel:'chrome',viewport:{width:1440,height:1000}}},...(fs.existsSync(brave)?[{name:'brave',use:{channel:undefined,launchOptions:{executablePath:brave},viewport:{width:1440,height:1000}}}]:[])]});
