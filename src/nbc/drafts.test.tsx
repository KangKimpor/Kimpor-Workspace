import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from './test-fixture'
import { startWeek } from './actions'
import { useActivityDraft } from './useActivityDraft'
import { clearActivityDraft, readActivityDraft, readUpdateForm, saveUpdateForm, writeActivityDraft } from './drafts'

beforeEach(()=>{localStorage.clear();useWorkspace.setState({...structuredClone(emptyContent),scope:'guest',projects:[fixtureProject],nbc_activities:fixtureActivities()});startWeek(fixtureProject.id,'2026-10-25')})
afterEach(()=>vi.useRealTimers())
function Editor(){const activity=useWorkspace((s)=>s.nbc_activities!.find((a)=>a.id==='nbc:1.6.1.2')!);const draft=useActivityDraft(activity,'sheet');return <><input aria-label="Progress" value={draft.text} onChange={(e)=>draft.changeText(e.target.value)}/><textarea aria-label="Remark" value={draft.remark} onChange={(e)=>draft.changeRemark(e.target.value)}/><button onClick={draft.cancel}>Cancel change</button><span>{activity.progress}</span><span>{draft.error}</span></>}

test('autosaves valid progress and remarks; Cancel restores the values before this edit',()=>{
 vi.useFakeTimers();render(<Editor/>);fireEvent.change(screen.getByLabelText('Progress'),{target:{value:'73.125%'}});fireEvent.change(screen.getByLabelText('Remark'),{target:{value:'Clearance ready'}})
 expect(readActivityDraft('guest',fixtureProject.id)?.text).toBe('73.125%')
 act(()=>vi.advanceTimersByTime(450))
 expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(0.73125)
 expect(useWorkspace.getState().nbc_activities![3]!.remark).toBe('Clearance ready')
 fireEvent.click(screen.getByRole('button',{name:'Cancel change'}))
 expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(0.25)
 expect(useWorkspace.getState().nbc_activities![3]!.remark).toBe('')
 expect(readActivityDraft('guest',fixtureProject.id)).toBeNull()
})
test('unfinished raw input survives an editor unmount/reopen without inventing a percentage',()=>{
 vi.useFakeTimers();const editor=render(<Editor/>);fireEvent.change(screen.getByLabelText('Progress'),{target:{value:'37.'}});editor.unmount()
 expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(0.25)
 render(<Editor/>);expect(screen.getByLabelText('Progress')).toHaveValue('37.')
 act(()=>vi.advanceTimersByTime(450));expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(0.37)
})
test('invalid text is recoverable, bounds clamp, and scope keys isolate private drafts',()=>{
 vi.useFakeTimers();render(<Editor/>);fireEvent.change(screen.getByLabelText('Progress'),{target:{value:'bad input'}});act(()=>vi.advanceTimersByTime(450));expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(0.25)
 expect(readActivityDraft('another-user',fixtureProject.id)).toBeNull()
 fireEvent.change(screen.getByLabelText('Progress'),{target:{value:'150%'}});act(()=>vi.advanceTimersByTime(450));expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(1)
 expect(screen.getByText('Progress must be between 0% and 100%.')).toBeInTheDocument()
})
test('restoring screen data does not mix editor modes or accounts',()=>{
 writeActivityDraft('guest',fixtureProject.id,{id:'a',mode:'sheet',text:'25',remark:'draft',originalProgress:0,originalRemark:''})
 clearActivityDraft('guest',fixtureProject.id,'a','remark');expect(readActivityDraft('guest',fixtureProject.id)?.remark).toBe('draft')
 saveUpdateForm('guest',fixtureProject.id,{date:'2026-11-01',note:'Keep this',step:'review'})
 expect(readUpdateForm('guest',fixtureProject.id).step).toBe('review')
 expect(readUpdateForm('another-user',fixtureProject.id)).toEqual({})
})
