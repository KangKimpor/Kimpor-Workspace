import { beforeEach, expect, test } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
const initial=useWorkspace.getState()
beforeEach(()=>{localStorage.clear();useWorkspace.setState({...initial,...structuredClone(emptyContent),scope:'guest'})})
test('task deletion and undo include its notes page; empty Trash preserves active tasks and pages',()=>{
 const state=useWorkspace.getState(),project=state.addProject('Workspace'),id=state.addTask({title:'Delete me',projectId:project,notes:'Task notes'}),keep=state.addTask({title:'Keep me',projectId:project})
 const pageId=useWorkspace.getState().tasks.find((task)=>task.id===id)!.pageId!
 state.trashTask(id);expect(useWorkspace.getState().tasks.find((task)=>task.id===id)?.deletedAt).toBeTruthy();expect(useWorkspace.getState().pages.find((page)=>page.id===pageId)?.deletedAt).toBeTruthy()
 state.updateTask(id,{deletedAt:null});expect(useWorkspace.getState().pages.find((page)=>page.id===pageId)?.deletedAt).toBeNull()
 state.trashTask(id);state.emptyTrash()
 expect(useWorkspace.getState().tasks.some((task)=>task.id===id)).toBe(false);expect(useWorkspace.getState().pages.some((page)=>page.id===pageId)).toBe(false);expect(useWorkspace.getState().tasks.some((task)=>task.id===keep)).toBe(true)
 const saved=JSON.parse(localStorage.getItem('kw-workspace-v1')!);expect(saved.tasks.some((task:{id:string})=>task.id===id)).toBe(false)
})
test('empty Trash detaches surviving task/page children instead of deleting them',()=>{
 const state=useWorkspace.getState(),project=state.addProject('Workspace'),parent=state.addTask({title:'Parent',projectId:project}),child=state.addTask({title:'Child',projectId:project,parentId:parent}),page=state.addPage('Parent page'),childPage=state.addPage('Child page',page)
 state.trashTask(parent);state.updatePage(page,{deletedAt:new Date().toISOString()});state.emptyTrash()
 expect(useWorkspace.getState().tasks.find((task)=>task.id===child)?.parentId).toBeNull()
 expect(useWorkspace.getState().pages.find((p)=>p.id===childPage)?.parentId).toBeNull()
})
