// Local browser profile only. No cloud requests and no changes to existing project records.
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
const datasets = await Promise.all(['nbc-bp03','nbc-bp04'].map(async id => JSON.parse(await readFile(`.private/${id}/initial.json`, 'utf8'))))
const env = loadEnv('production', process.cwd(), 'VITE_')
const key = `sb-${new URL(env.VITE_SUPABASE_URL || 'http://localhost').hostname.split('.')[0]}-auth-token`
const headless = process.argv.includes('--headless')
const context = await chromium.launchPersistentContext('.private/nbc-local-profile', { headless, viewport: {width:1440,height:1000} })
await context.route('**/*', route => new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort())
await context.addInitScript(({datasets,key}) => {
  localStorage.setItem(key, JSON.stringify({ access_token:'workspace-ui-test', refresh_token:'workspace-ui-test', expires_at:4102444800, expires_in:3600, token_type:'bearer', user:{id:'guest',aud:'authenticated',email:'ui@example.invalid',user_metadata:{}} }))
  const storageKey = 'kw-workspace-v1'
  const state = JSON.parse(localStorage.getItem(storageKey) || 'null') || {pages:[],tasks:[],events:[],projects:[],nbc_activities:[],nbc_submissions:[],nbc_summaries:[],scratchpad:'',taskViews:[]}
  for (const dataset of datasets) if (!state.projects.some(p => p.id === dataset.project.id)) {
    state.projects.push(dataset.project)
    state.nbc_activities = [...(state.nbc_activities || []), ...dataset.activities]
  }
  localStorage.setItem(storageKey, JSON.stringify(state))
}, {datasets,key})
const page = context.pages()[0] || await context.newPage()
await page.goto('http://localhost:4173/projects-progress')
await page.getByRole('heading', {name:'Projects Progress', exact:true}).waitFor()
if (headless) {
  await page.screenshot({path:'.private/nbc-local-preview.png',fullPage:true})
  await context.close()
  console.log('Local project profile initialized. No cloud requests were allowed.')
  process.exit(0)
}
console.log('Local BP03/BP04 workspace opened. Close the browser to finish; local edits survive relaunch.')
await new Promise(resolve => context.on('close', resolve))
