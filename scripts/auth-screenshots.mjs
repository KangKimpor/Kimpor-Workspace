import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const folder = 'docs/screenshots/accounts'
await mkdir(folder,{recursive:true})
const browser = await chromium.launch()
for (const [name,width,height] of [['desktop',1920,1080],['tablet',820,1180],['phone',393,852]]) {
  const page = await browser.newPage({viewport:{width,height}})
  await page.goto('http://localhost:4173/settings/account')
  await page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor()
  await page.evaluate(()=>document.fonts.ready)
  await page.screenshot({path:`${folder}/signin-${name}.png`,fullPage:true})
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.screenshot({path:`${folder}/signup-${name}.png`,fullPage:true})
  await page.close()
}
await browser.close()
