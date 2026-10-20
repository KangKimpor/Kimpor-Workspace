import { expect,test } from 'vitest'
import { contentText,searchRank } from '@/data/text'
import { useWorkspace } from '@/data'
test('search matches body text, accents and abbreviated page names with exact titles first',()=>{
  expect(searchRank('weekly plan','Weekly plan')).toBe(0)
  expect(searchRank('cafe','Café ideas')).toBe(1)
  expect(searchRank('wpl','Weekly plan')).toBeGreaterThan(3)
  expect(searchRank('budget','Quarterly plan','Review the budget')).toBe(3)
  expect(searchRank('zzzzz','Weekly plan')).toBe(Infinity)
})
test('rich task notes produce a consistent searchable preview',()=>{
  const state=useWorkspace.getState(),id=state.addTask({title:'Notes test',projectId:'website'})
  const task=useWorkspace.getState().tasks.find(task=>task.id===id)!
  const blocks=[{type:'paragraph',content:[{type:'text',text:'Review budget'}],children:[{type:'paragraph',content:[{type:'pageMention',props:{title:'Finance'}}]}]}]
  expect(contentText(blocks)).toBe('Review budget Finance')
  state.updatePage(task.pageId!,{content:blocks})
  expect(useWorkspace.getState().tasks.find(task=>task.id===id)?.notes).toBe('Review budget Finance')
})
