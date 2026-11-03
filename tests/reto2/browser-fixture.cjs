const base=require('@playwright/test');
const test=base.test.extend({
  isolatedDatabase:[async({request},use)=>{
    const response=await request.post('/_test/reset',{headers:{'X-Test-Reset':process.env.PHARMACY_BROWSER_RESET_KEY},data:{}});
    base.expect(response.status(),'La base temporal se restablece antes de cada caso').toBe(204);
    await use();
  },{auto:true}],
});
async function apiToken(request,email,password){const response=await request.post('/api/auth/login',{data:{email,password}});base.expect(response.status()).toBe(200);const token=(await response.json()).data.token;base.expect(typeof token).toBe('string');return token;}
module.exports={...base,test,apiToken};
