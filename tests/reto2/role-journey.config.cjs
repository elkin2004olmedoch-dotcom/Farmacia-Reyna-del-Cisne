const {defineConfig}=require('@playwright/test'),base=require('./playwright.config.cjs');
// Isolated accounts/GPS with real map tiles and routing; never production records.
process.env.PHARMACY_JOURNEY_PAY_FIRST='true';
process.env.PHARMACY_BROWSER_LIVE_ROUTING='true';
process.env.PHARMACY_DEMO_LIVE_MAP='true';
module.exports=defineConfig({...base,testMatch:'role-journey.spec.cjs',outputDir:'test-results/recorrido-presentacion',use:{...base.use,video:'on',launchOptions:{slowMo:60}},webServer:{...base.webServer,command:'node tests/reto2/browser-payment-server.cjs'}});
