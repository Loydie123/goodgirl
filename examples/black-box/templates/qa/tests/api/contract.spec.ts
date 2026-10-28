import {test,expect} from '@playwright/test';
test('health contract',async({request})=>{const r=await request.get('/api/health');expect(r.status()).toBe(200);expect(await r.json()).toEqual({status:'ok',service:'independent'})});
test('auth contract',async({request})=>{expect((await request.get('/api/me')).status()).toBe(401);expect((await request.post('/api/login',{data:{user:'qa',password:'local-test-only'}})).status()).toBe(200);expect((await request.get('/api/me')).status()).toBe(200)});
