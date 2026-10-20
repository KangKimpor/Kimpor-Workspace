import { afterEach, expect, test, vi } from 'vitest'
import handler from '../../api/google/[action].js'

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
test('calendar proxy validates method, origin, authentication and body before forwarding',async()=>{
  const upstream=vi.fn(async(_input:string,_init?:RequestInit)=>new Response('{"configured":true}',{status:200}))
  vi.stubGlobal('fetch',upstream)
  vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co')
  async function request(action:string,method:string,headers:Record<string,string>={},body:unknown={}){
    const result={status:0,body:'',headers:{} as Record<string,string>}
    const response={setHeader:(key:string,value:string)=>{result.headers[key]=value},writeHead:(code:number)=>{result.status=code;return response},end:(value='')=>{result.body=value;return response}}
    await handler({query:{action},method,headers:{host:'workspace.example',...headers},body} as unknown as Parameters<typeof handler>[0],response as unknown as Parameters<typeof handler>[1])
    return result
  }
  expect((await request('unknown','POST')).status).toBe(404)
  expect((await request('info','POST')).status).toBe(405)
  expect((await request('token','POST',{origin:'https://wrong.example'})).status).toBe(403)
  expect((await request('token','POST',{origin:'invalid'})).status).toBe(403)
  expect((await request('token','POST')).status).toBe(401)
  expect((await request('token','POST',{authorization:'Bearer test-token'},'x'.repeat(4097))).status).toBe(413)
  expect(upstream).not.toHaveBeenCalled()
  const result=await request('info','GET')
  expect(result.status).toBe(200)
  expect(result.headers['Cache-Control']).toBe('no-store')
  expect(upstream.mock.calls[0]?.[0]).toBe('https://example.supabase.co/functions/v1/kw-google/info')
})
