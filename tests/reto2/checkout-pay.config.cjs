const {defineConfig}=require('@playwright/test'),base=require('./playwright.config.cjs');
module.exports=defineConfig({...base,testMatch:'checkout-pay.payments.cjs',outputDir:'test-results/checkout-pay',webServer:{...base.webServer,command:'node tests/reto2/browser-payment-server.cjs'}});
