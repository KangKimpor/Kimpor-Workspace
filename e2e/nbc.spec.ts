import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'
import { existsSync, readFileSync } from 'node:fs'

async function setup(page:Page) {
  await page.addInitScript(({activities,project})=>{if(!localStorage.getItem('kw-workspace-v1'))localStorage.setItem('kw-workspace-v1',JSON.stringify({pages:[],tasks:[],events:[],projects:[project,{id:'standard',name:'Standard project',workspace:'personal',color:'blue',description:'',target:'',progress:0}],nbc_activities:activities,nbc_reports:[],scratchpad:'',taskViews:[]}))},{activities:fixtureActivities(),project:fixtureProject})
}
async function start(page:Page){await page.goto('/projects-progress/nbc-bp03/update');await page.getByRole('combobox',{name:'Your handler',exact:true}).click();await page.getByRole('option',{name:'Tola',exact:true}).click();await page.getByLabel('Reporting date',{exact:true}).fill('2026-10-25');await page.getByRole('button',{name:'Start update',exact:true}).click();await expect(page.getByText('Update · 25 Oct 2026',{exact:true})).toBeVisible()}
async function edit(page:Page,value:string){await page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/}).click();const input=page.getByLabel('Actual % for 1.6.1.2',{exact:true});await input.fill(value);await input.press('Enter')}

test('locked baseline, compact header, five views and standard projects unchanged',async({page})=>{
  await setup(page);await page.goto('/projects-progress/nbc-bp03/overview')
  await expect(page.getByLabel('Project indicators')).toContainText('35.00%')
  await expect(page.getByText('Initial baseline (undated)',{exact:true})).toBeVisible()
  const kpis=page.locator('.nbc-kpi');await expect(kpis).toHaveCount(6);await expect(kpis.nth(1).locator('strong')).toHaveText('—')
  await page.getByRole('link',{name:'Project Progress',exact:true}).click()
  await expect(page.getByText('Start an update to edit progress.',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveCount(0)
  await page.getByRole('link',{name:'Start update',exact:true}).click();await expect(page.getByLabel('Reporting date')).toBeVisible()
  await page.goto('/projects/standard/table');await expect(page.getByRole('link',{name:'All Tasks',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Project Progress',exact:true})).toHaveCount(0)
})

test('treegrid keyboard, percent input, filters, remarks, assignments, reporting and audited corrections',async({page})=>{
  await setup(page);await start(page);await page.goto('/projects-progress/nbc-bp03/progress')
  await expect(page.getByRole('treegrid',{name:'BOQ progress'})).toBeVisible()
  await page.getByRole('button',{name:'Collapse 1.6.1',exact:true}).click();await expect(page.locator('[data-wbs="1.6.1.2"]')).toHaveCount(0)
  const parent=page.locator('[data-wbs="1.6.1"]');await parent.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-wbs="1.6.1.2"]')).toBeVisible()
  await page.locator('[data-wbs="1.6.1.2"]').focus();await page.keyboard.press('Enter');await page.getByLabel('Actual % for 1.6.1.2').fill('80');await page.keyboard.press('Escape')
  await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('25.00%')
  await edit(page,'37.5%');await expect(page.locator('[data-wbs="1.6.1"] .nbc-number')).toHaveText('53.13%')
  await page.locator('[data-wbs="1.6.1.2"]').focus();await page.keyboard.press('r');const remark=page.getByLabel('Site remark for 1.6.1.2');await remark.fill('Waiting for clearance');await remark.press('Tab')
  await expect(page.locator('.nbc-history')).toContainText('37.50%')
  await page.getByRole('button',{name:/^Assign handler for 1\.6\.1\.2:/}).click();await page.getByRole('combobox',{name:'Handler for 1.6.1.2',exact:true}).click();await page.getByRole('option',{name:'Sitha',exact:true}).click();await page.keyboard.press('Escape')
  await page.keyboard.press('/');await expect(page.getByLabel('Search BOQ')).toBeFocused();await page.getByLabel('Search BOQ').fill('Install board');await expect(page.locator('[data-wbs="1.6.1"]')).toBeVisible();await expect(page.locator('[data-wbs="1.6.1.1"]')).toHaveCount(0)
  await page.getByRole('button',{name:'Remove Search: Install board filter'}).click();await page.getByRole('button',{name:'Sitha',exact:true}).click();await expect(page.getByRole('button',{name:'Remove Sitha filter'})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('37.50%')
  await page.getByRole('link',{name:'Update Progress',exact:true}).click();await page.getByRole('button',{name:'Continue to review',exact:true}).click();await page.getByRole('button',{name:'Finalize update',exact:true}).click();await expect(page.getByRole('dialog')).toContainText("Finalized updates stay preserved. Later corrections are logged.");await page.getByRole('dialog').getByRole('button',{name:'Finalize update',exact:true}).click()
  await expect(page.getByRole('heading',{name:'No open update',exact:true})).toBeVisible();await page.getByRole('button',{name:'Past updates 1',exact:true}).click();await page.locator('.nbc-report-open').first().click();await expect(page.getByText('Read only',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveCount(0)
  await page.getByRole('button',{name:'Request correction',exact:true}).click();const sheet=page.getByRole('dialog');await sheet.getByLabel('New reporting date').fill('2026-11-01');await sheet.getByLabel('Find correction activities').fill('Install board');await sheet.getByRole('checkbox').check();await sheet.getByLabel('Corrected % for 1.6.1.2').fill('25');await sheet.getByLabel('Reason',{exact:true}).fill('Revised site measurement');await sheet.getByRole('button',{name:'Create audited correction',exact:true}).click()
  await expect(page.getByRole('cell',{name:'▼ −12.50',exact:true})).toBeVisible();await page.getByRole('button',{name:'Finalize update',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Finalize update',exact:true}).click();await page.getByRole('button',{name:'Past updates 2',exact:true}).click();await expect(page.getByText('Corrected',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'Back to Project Progress',exact:true}).click();await page.getByRole('button',{name:'NBC project actions',exact:true}).click();await page.getByRole('link',{name:'Corrections log',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Revised site measurement');await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Back to Project Progress',exact:true}).click();await page.getByRole('link',{name:'By Area / Handler',exact:true}).click();await expect(page.locator('.nbc-handler-card')).toHaveCount(6);await page.getByRole('button',{name:'By Area',exact:true}).click();await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('link',{name:'Issues & Actions',exact:true}).click();await page.getByRole('button',{name:'New action',exact:true}).click();await page.getByRole('button',{name:'Link WBS for New site action',exact:true}).click();await page.getByLabel('Search WBS activity').fill('Install board');await page.getByRole('button',{name:'1.6.1.2 · Install board',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('combobox',{name:'Status for New site action',exact:true})).toHaveText('Not started')
})

for(const viewport of [{width:1920,height:1080},{width:1980,height:1080},{width:820,height:1180},{width:1180,height:820},{width:393,height:852}])for(const theme of ['light','dark'])test(`plan layout ${viewport.width}x${viewport.height} ${theme}`,async({page})=>{
  await setup(page);await page.setViewportSize(viewport);await start(page);await page.goto('/projects-progress/nbc-bp03/progress');await page.evaluate((value)=>document.documentElement.setAttribute('data-theme',value),theme)
  if(viewport.width<768){await page.getByRole('button',{name:'Filters',exact:true}).click();const sheet=page.getByRole('dialog');await sheet.getByRole('combobox',{name:'Assigned handler',exact:true}).click();await page.getByRole('option',{name:'Tola',exact:true}).click();await sheet.getByRole('button',{name:'Show activities',exact:true}).click();await expect(page.getByRole('button',{name:'Remove Tola filter'})).toBeVisible();await page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/}).click();const editSheet=page.getByRole('dialog');await editSheet.getByLabel('Actual % for 1.6.1.2').fill('62.375%');await page.screenshot({path:`test-results/nbc-plan-edit-sheet-${theme}.png`});await page.setViewportSize({width:393,height:520});await editSheet.getByRole('button',{name:'Done',exact:true}).scrollIntoViewIfNeeded();await expect(editSheet.getByRole('button',{name:'Done',exact:true})).toBeInViewport();await editSheet.getByRole('button',{name:'Done',exact:true}).click();await page.setViewportSize(viewport);await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('62.38%');const size=await page.locator('[data-wbs="1.6.1.2"]').boundingBox();expect(size!.width).toBeGreaterThan(320)}
  else await edit(page,'62.375')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  const results=await new AxeBuilder({page}).include('.nbc-project').analyze();expect(results.violations).toEqual([])
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0)})
  await page.screenshot({path:`test-results/nbc-plan-boq-${viewport.width}-${theme}.png`,fullPage:true})
  await page.getByRole('link',{name:'Overview',exact:true}).click();await expect(page.getByLabel('Project indicators')).toContainText('57.43%')
  const overview=await new AxeBuilder({page}).include('.nbc-project').analyze();expect(overview.violations).toEqual([])
  await page.screenshot({path:`test-results/nbc-plan-overview-${viewport.width}-${theme}.png`,fullPage:true})
  await page.getByRole('link',{name:'Update Progress',exact:true}).click();await expect(page.locator('.nbc-boq[data-updating=true]')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  const update=await new AxeBuilder({page}).include('.nbc-project').analyze();expect(update.violations).toEqual([])
  await page.screenshot({path:`test-results/nbc-plan-update-${viewport.width}-${theme}.png`,fullPage:true})
})

test('private workbook reconciles, virtualizes and preserves sticky columns',async({page})=>{
  const path='.private/nbc-bp03/initial.json';test.skip(!existsSync(path),'Private dataset excluded from Git')
  const {activities,project}=JSON.parse(readFileSync(path,'utf8'))
  await page.addInitScript(({activities,project})=>localStorage.setItem('kw-workspace-v1',JSON.stringify({pages:[],tasks:[],events:[],projects:[project],nbc_activities:activities,nbc_reports:[],scratchpad:'',taskViews:[]})),{activities,project})
  await page.goto('/projects-progress/nbc-bp03/overview');await expect(page.getByLabel('Project indicators')).toContainText('42.02%');await expect(page.getByLabel('Project indicators')).toContainText('561');await page.getByRole('link',{name:'Project Progress',exact:true}).click();for(const handler of ['Sitha','Lychhinh','Chhorvaon','Srun','Kheng','Tola']) {
    await page.getByRole('button',{name:handler,exact:true}).click()
    const root=page.locator('[data-parent=true][aria-expanded=true]').first(),wbs=await root.getAttribute('data-wbs')
    await page.getByRole('button',{name:`Collapse ${wbs}`,exact:true}).click();await expect(page.locator(`[data-wbs="${wbs}"]`)).toHaveAttribute('aria-expanded','false');await expect(page.locator(`[data-wbs^="${wbs}."]`)).toHaveCount(0)
    await page.getByRole('button',{name:`Expand ${wbs}`,exact:true}).click();await expect(page.locator(`[data-wbs="${wbs}"]`)).toHaveAttribute('aria-expanded','true')
    await page.getByRole('button',{name:'Collapse all',exact:true}).click();await expect(page.locator('[data-parent=false]')).toHaveCount(0)
  }
  await page.getByRole('button',{name:'All handlers',exact:true}).click();await page.getByRole('button',{name:'Expand all',exact:true}).click();await expect(page.getByText('790 WBS rows',{exact:false})).toBeVisible();expect(await page.locator('[data-wbs]').count()).toBeLessThan(80);await page.locator('.nbc-grid-scroll').evaluate((el)=>{el.scrollTop=el.scrollHeight});await expect(page.locator('[data-wbs="1.6.10.10.3"]')).toBeVisible()
})

for(const width of [1920,393])test(`200 percent text zoom ${width}`,async({page})=>{
  await setup(page);await page.setViewportSize({width,height:1080});await start(page);await page.goto('/projects-progress/nbc-bp03/progress');await page.evaluate(()=>{document.documentElement.style.fontSize='200%'});await expect(page.getByRole('treegrid')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.getByRole('button',{name:width<768?'Details for 1.6.1.2':'Details for 1.6.1.2 Install board',exact:true}).click();await expect(page.getByLabel('Site remark for 1.6.1.2')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
})

test('autosaved update resumes after reload, Cancel undoes one edit, Back preserves the draft',async({page})=>{
 await setup(page);await start(page);await expect(page.locator('.nbc-boq[data-updating=true]')).toBeVisible()
 await page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/}).click();const input=page.getByLabel('Actual % for 1.6.1.2',{exact:true});await input.fill('73.125')
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kw-workspace-v1')!).nbc_activities.find((a:{wbs:string})=>a.wbs==='1.6.1.2').progress)).toBe(0.73125)
 await input.fill('74.');await page.reload();await expect(input).toHaveValue('74.');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('25.00%')
 await edit(page,'50');await page.getByRole('button',{name:'Cancel & go back',exact:true}).click();await page.getByRole('button',{name:'Keep draft & go back',exact:true}).click();await expect(page).toHaveURL(/\/progress$/);await page.getByRole('link',{name:'Update Progress',exact:true}).click();await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('50.00%')
 await page.getByRole('button',{name:'Continue to review',exact:true}).click();await page.reload();await expect(page.getByRole('table')).toContainText('50.00%');await expect(page.getByRole('button',{name:'Back to update',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Finalize update',exact:true}).click();await page.getByLabel('Note (optional)',{exact:true}).fill('Ready for the report');await page.reload();await page.getByRole('button',{name:'Finalize update',exact:true}).click();await expect(page.getByLabel('Note (optional)',{exact:true})).toHaveValue('Ready for the report');await page.getByRole('dialog').getByRole('button',{name:'Finalize update',exact:true}).click()
 await page.getByLabel('Reporting date',{exact:true}).fill('2026-11-01');await page.getByRole('button',{name:'Start update',exact:true}).click();await expect(page.locator('.nbc-boq[data-updating=true]')).toBeVisible();await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('50.00%')
 const results=await new AxeBuilder({page}).include('.nbc-project').analyze();expect(results.violations).toEqual([])
 await page.screenshot({path:'test-results/nbc-large-update-desktop.png',fullPage:true})
})

test('mobile autosave reopens the large editor and Cancel change restores the original',async({page})=>{
 await setup(page);await page.setViewportSize({width:393,height:852});await start(page)
 await page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Actual % for 1.6.1.2').fill('81.25');await dialog.getByLabel('Site remark',{exact:true}).fill('Saved while working')
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kw-workspace-v1')!).nbc_activities.find((a:{wbs:string})=>a.wbs==='1.6.1.2').remark)).toBe('Saved while working')
 await page.reload();dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Actual % for 1.6.1.2')).toHaveValue('81.25');await expect(dialog.getByLabel('Site remark',{exact:true})).toHaveValue('Saved while working');await dialog.getByRole('button',{name:'Cancel change',exact:true}).click();await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('25.00%')
 await page.getByRole('button',{name:'Cancel & go back',exact:true}).click();await page.getByRole('button',{name:'Keep draft & go back',exact:true}).click();await expect(page).toHaveURL(/\/progress$/);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
})

test('Projects Progress is separate; workspace tasks can be restored or permanently emptied',async({page})=>{
 await setup(page);await page.goto('/projects?workspace=team');await expect(page.getByRole('list',{name:'Team projects',exact:true}).getByText(fixtureProject.name)).toHaveCount(0);await expect(page.locator('.project-grid').getByText(fixtureProject.name)).toHaveCount(0);await expect(page.getByRole('link',{name:'Design system',exact:true})).toHaveCount(0)
 await page.goto('/projects-progress');await expect(page.getByRole('heading',{name:'Projects Progress',exact:true})).toBeVisible();await expect(page.locator('.project-grid')).toContainText(fixtureProject.name)
 await page.goto('/projects/standard/table');await page.getByRole('button',{name:'New task',exact:true}).click();await page.getByLabel('Title for New task',{exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Delete task New task',exact:true}).click();await page.goto('/trash');await expect(page.getByRole('button',{name:'Restore task',exact:true})).toBeVisible();await page.getByRole('button',{name:'Restore task',exact:true}).click();await page.goto('/projects/standard/table');await page.getByLabel('Title for New task',{exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Delete task New task',exact:true}).click()
 await page.goto('/trash');await page.getByRole('button',{name:'Empty Trash',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Restore task',exact:true})).toBeVisible();await page.getByRole('button',{name:'Empty Trash',exact:true}).click();await page.getByRole('button',{name:'Delete everything',exact:true}).click();await expect(page.getByText('Your trash is empty.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Your trash is empty.',{exact:true})).toBeVisible()
})

for(const width of [1920,1536,1440,1366,820,393])test(`update retains normal shell and a scrolling grid at ${width}`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:width===393?852:width===1366?768:900});await start(page)
 await expect(page.getByRole('banner')).toBeVisible();await expect(page.locator('.nbc-project-header')).toBeVisible();await expect(page.getByRole('navigation',{name:'Project views'})).toBeVisible()
 if(width>=1280)await expect(page.getByRole('complementary',{name:'Sidebar'})).toBeVisible()
 if(width===393)await expect(page.getByRole('navigation',{name:'Tabs',exact:true})).toBeVisible()
 expect(await page.locator('.nbc-edit-number').first().evaluate((el)=>parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(16)
 const grid=await page.locator('.nbc-grid-scroll').boundingBox();expect(grid!.height).toBeGreaterThanOrEqual(420)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
 if(width>=1280)expect(await page.locator('.nbc-grid-scroll').evaluate((el)=>el.scrollWidth>el.clientWidth)).toBe(false)
})

test('leaving an update offers keep, continue editing or delete and undo; finalized history survives',async({page})=>{
 await setup(page);await start(page);await edit(page,'50')
 await page.getByRole('button',{name:'Continue to review',exact:true}).click();await page.getByRole('button',{name:'Finalize update',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Finalize update',exact:true}).click()
 await page.getByLabel('Reporting date',{exact:true}).fill('2026-11-01');await page.getByRole('button',{name:'Start update',exact:true}).click();await edit(page,'87.5')
 await page.getByRole('button',{name:'Back to Project Progress',exact:true}).click();const exit=page.getByRole('dialog',{name:'Leave this update?',exact:true});await expect(exit.getByRole('button',{name:'Keep draft & go back',exact:true})).toBeVisible();await exit.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByRole('button',{name:/^Edit progress for 1\.6\.1\.2:/})).toHaveText('87.50%')
 await page.getByRole('button',{name:'Back to Project Progress',exact:true}).click();await exit.getByRole('button',{name:'Delete update',exact:true}).click();await expect(page).toHaveURL(/\/progress$/)
 await expect(page.locator('[data-wbs="1.6.1.2"] .nbc-number')).toHaveText('50.00%')
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kw-workspace-v1')!));expect(saved.nbc_reports).toHaveLength(1);expect(saved.nbc_reports[0].status).toBe('final');expect(saved.nbc_reports[0].entries.find((e:{wbs:string})=>e.wbs==='1.6.1.2').progress).toBe(0.5)
 await page.reload();await expect(page.locator('[data-wbs="1.6.1.2"] .nbc-number')).toHaveText('50.00%')
})

for(const width of [1440,393])for(const theme of ['light','dark'])test(`past updates sheet keyboard, export and snapshot ${width} ${theme}`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});await page.addInitScript((value)=>localStorage.setItem('kw-theme',value),theme);await start(page)
 const button=page.getByRole('button',{name:'Past updates 0',exact:true});await button.click();const history=page.getByRole('dialog',{name:'Past updates',exact:true})
 await expect(history).toContainText('No finalized updates. Initial baseline (undated).');await expect(page.locator('.nbc-history-button')).toHaveAttribute('aria-expanded','true')
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
 await page.keyboard.press('Escape');await expect(history).toHaveCount(0);await expect(button).toBeFocused()
 await page.getByRole('button',{name:'Continue to review',exact:true}).click();await page.getByRole('button',{name:'Finalize update',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Finalize update',exact:true}).click()
 await page.getByRole('button',{name:'Past updates 1',exact:true}).click();await expect(history.getByRole('button',{name:'Open update 2026-10-25',exact:true})).toBeVisible()
 const download=page.waitForEvent('download');await history.getByRole('button',{name:'Export week 2026-10-25',exact:true}).click();expect((await download).suggestedFilename()).toContain('2026-10-25')
 await history.getByRole('button',{name:'Open update 2026-10-25',exact:true}).click();await expect(history).toHaveCount(0);await expect(page.getByText('Read only',{exact:true})).toBeVisible();await expect(page).toHaveURL(/report=/)
})

for(const viewport of [{width:1920,height:1080},{width:1536,height:864},{width:1440,height:900},{width:1366,height:768},{width:820,height:1180},{width:393,height:852}])for(const theme of ['light','dark'])test(`update design QA ${viewport.width} ${theme}`,async({page,browserName})=>{
 const activities=fixtureActivities(), template=activities[3]!
 activities.splice(3,1,...Array.from({length:24},(_,i)=>({...template,id:`nbc:1.6.1.${i+2}`,wbs:`1.6.1.${i+2}`,name:i===2?'Installation and coordination of ceiling finishes along the main hotel corridor with a long activity description':`Install finish — zone ${i+1}`,relativeWeight:0.75/24,globalWeight:0.6/24,order:i+3,handler:['Tola','Sitha','Lychhinh','Chhorvaon','Srun','Kheng'][i%6]!,progress:(i%5)/4,baseline:(i%5)/4})))
 await page.addInitScript(({activities,project,theme})=>{localStorage.setItem('kw-theme',theme);localStorage.setItem('kw-workspace-v1',JSON.stringify({pages:[],tasks:[],events:[],projects:[project],nbc_activities:activities,nbc_reports:[],scratchpad:'',taskViews:[]}))},{activities,project:fixtureProject,theme})
 await page.setViewportSize(viewport);await start(page)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
 const scroll=page.locator('.nbc-grid-scroll');if(viewport.width>=1280){expect(await scroll.evaluate((el)=>el.scrollWidth>el.clientWidth)).toBe(false)
 const headers=await page.locator('.nbc-grid-header').boundingBox();await scroll.evaluate((el)=>{el.scrollTop=300});const sticky=await page.locator('.nbc-grid-header').boundingBox();expect(sticky!.y).toBeCloseTo(headers!.y,0);await scroll.evaluate((el)=>{el.scrollTop=0})}
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:browserName==='chromium'?`docs/screenshots/update-progress/${viewport.width}x${viewport.height}-${theme}.png`:`test-results/update-${viewport.width}-${theme}-webkit.png`,animations:'disabled'})
 if(browserName==='chromium'&&viewport.width>=1280){await scroll.scrollIntoViewIfNeeded();await page.screenshot({path:`docs/screenshots/update-progress/${viewport.width}x${viewport.height}-${theme}-editing.png`,animations:'disabled'})}
})
