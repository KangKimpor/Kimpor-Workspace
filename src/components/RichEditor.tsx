import { GlassSelect } from '@/components/glass/GlassSelect'
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from '@blocknote/core'
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import { useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/data'
import { useShallow } from 'zustand/react/shallow'
import type { WorkspacePage } from '@/data'
import { useTheme } from '@/lib/theme'
import { uploadWorkspaceFile, resolveFile } from '@/data/files'
import { TaskRow } from './TaskRow'
import { useWorkspaceUI } from '@/shell/workspace'
import '@blocknote/ariakit/style.css'
import './rich-editor.css'

const Callout = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: { tone: { default: 'blue' } },
    content: 'inline',
  },
  {
    render: (props) => (
      <aside className="editor-callout">
        <span aria-hidden="true">ⓘ</span>
        <div ref={props.contentRef} />
      </aside>
    ),
  },
)()
const Columns = createReactBlockSpec(
  {
    type: 'columns',
    propSchema: { count: { default: 2 } },
    content: 'none',
    layoutOnly: true,
  },
  {
    renderFrame: (props) => (
      <div
        className="editor-columns"
        data-count={props.block.props.count}
        ref={props.slotRef}
      />
    ),
  },
)()
const Bookmark = createReactBlockSpec(
  { type: 'bookmark', propSchema: { url: { default: '' } }, content: 'none' },
  {
    render: (props) => (
      <div className="editor-bookmark">
        <input
          aria-label="Bookmark URL"
          type="url"
          placeholder="https://example.com"
          value={props.block.props.url}
          onChange={(e) =>
            props.editor.updateBlock(props.block, {
              props: { url: e.target.value },
            })
          }
        />
        {/^https?:\/\//i.test(props.block.props.url) && (
          <a
            href={props.block.props.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open bookmark ↗
          </a>
        )}
      </div>
    ),
  },
)()
function EmbeddedTasks({
  projectId,
  onChange,
}: {
  projectId: string
  onChange: (id: string) => void
}) {
  const { tasks, projects } = useWorkspace(
    useShallow((s) => ({ tasks: s.tasks, projects: s.projects })),
  )
  return (
    <div className="embedded-tasks" contentEditable={false}>
      <GlassSelect
        aria-label="Embedded task project"
        value={projectId}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </GlassSelect>
      {tasks
        .filter(
          (t) => !t.deletedAt && (!projectId || t.projectId === projectId),
        )
        .map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
    </div>
  )
}
const TasksBlock = createReactBlockSpec(
  {
    type: 'tasksView',
    propSchema: { projectId: { default: '' } },
    content: 'none',
  },
  {
    render: (props) => (
      <EmbeddedTasks
        projectId={props.block.props.projectId}
        onChange={(projectId) =>
          props.editor.updateBlock(props.block, { props: { projectId } })
        }
      />
    ),
  },
)()
const Mention = createReactInlineContentSpec(
  {
    type: 'pageMention',
    propSchema: { id: { default: '' }, title: { default: '' } },
    content: 'none',
  },
  {
    render: (props) => (
      <Link className="page-mention" to={`/p/${props.inlineContent.props.id}`}>
        @{props.inlineContent.props.title}
      </Link>
    ),
  },
)
const { audio: _audio, video: _video, ...blocks } = defaultBlockSpecs
const checklistRender = blocks.checkListItem.implementation.render!
blocks.checkListItem = {
  ...blocks.checkListItem,
  implementation: {
    ...blocks.checkListItem.implementation,
    render: function (...args: Parameters<typeof checklistRender>) {
      const rendered = checklistRender.apply(this, args)
      // BlockNote's checkbox has no accessible name in this release.
      rendered.dom
        .querySelector('input[type="checkbox"]')
        ?.setAttribute('aria-label', 'Toggle checklist item')
      return rendered
    },
  },
}
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...blocks,
    callout: Callout,
    bookmark: Bookmark,
    columns: Columns,
    tasksView: TasksBlock,
  },
  inlineContentSpecs: { ...defaultInlineContentSpecs, pageMention: Mention },
})
const blockType = {
  heading: 'heading',
  paragraph: 'paragraph',
  bullet: 'bulletListItem',
  todo: 'checkListItem',
  quote: 'quote',
  code: 'codeBlock',
} as const
export function RichEditor({
  page,
  onExportReady,
}: {
  page: WorkspacePage
  onExportReady: (exporter: () => Promise<string>) => void
}) {
  const updatePage = useWorkspace((s) => s.updatePage)
  const theme = useTheme((s) => s.resolved)
  const initialContent = useMemo(
    () =>
      page.content !== undefined
        ? page.content.length
          ? (page.content as (typeof schema.PartialBlock)[])
          : undefined
        : page.blocks.length
          ? (page.blocks.map((b) => ({
              id: b.id,
              type: blockType[b.kind],
              content: b.text,
              props: b.kind === 'todo' ? { checked: !!b.checked } : {},
            })) as (typeof schema.PartialBlock)[])
          : undefined,
    [page.content, page.blocks],
  )
  const editor = useCreateBlockNote(
    {
      schema,
      initialContent,
      uploadFile: uploadWorkspaceFile,
      resolveFileUrl: resolveFile,
      domAttributes: { editor: { 'aria-label': 'Page content' } },
    },
    [page.id],
  )
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const applyingRemote = useRef(false)
  const acceptedContent = useRef(JSON.stringify(page.content ?? page.blocks))
  useEffect(() => {
    const serialized = JSON.stringify(page.content ?? page.blocks)
    if (serialized === acceptedContent.current) return
    acceptedContent.current = serialized
    if (JSON.stringify(editor.document) === JSON.stringify(page.content)) return
    clearTimeout(timer.current)
    if (dirty.current) {
      const state = useWorkspace.getState()
      const recovered = state.addPage(
        `Recovered draft · ${page.title || 'Untitled'}`,
      )
      state.updatePage(recovered, { content: editor.document })
      useWorkspaceUI
        .getState()
        .notify(
          'A newer saved page arrived. Your unsaved text is kept in Pages as a Recovered draft.',
        )
    }
    dirty.current = false
    applyingRemote.current = true
    editor.replaceBlocks(
      editor.document,
      initialContent?.length ? initialContent : [{ type: 'paragraph' }],
    )
    applyingRemote.current = false
  }, [editor, page.id, page.content, page.blocks, page.title, initialContent])
  useEffect(() => {
    const save = () => {
      clearTimeout(timer.current)
      if (dirty.current) {
        dirty.current = false
        updatePage(page.id, { content: editor.document })
      }
    }
    onExportReady(async () => editor.blocksToMarkdownLossy(editor.document))
    addEventListener('pagehide', save)
    return () => {
      removeEventListener('pagehide', save)
      save()
    }
  }, [editor, page.id, updatePage, onExportReady])
  const extras = [
    { title: 'Callout', type: 'callout' as const, aliases: ['notice', 'tip'] },
    { title: 'Bookmark', type: 'bookmark' as const, aliases: ['link'] },
    {
      title: 'Tasks view',
      type: 'tasksView' as const,
      aliases: ['project', 'todo'],
    },
  ]
  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      slashMenu={false}
      onChange={() => {
        if (applyingRemote.current) return
        dirty.current = true
        useWorkspace.setState({ sync: { kind: 'saving' } })
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          dirty.current = false
          updatePage(page.id, { content: editor.document })
        }, 600)
      }}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [
              ...getDefaultReactSlashMenuItems(editor),
              ...extras.map((item) => ({
                title: item.title,
                aliases: item.aliases,
                group: 'Workspace',
                onItemClick: () =>
                  insertOrUpdateBlockForSlashMenu(editor, { type: item.type }),
              })),
              ...[2, 3].map((count) => ({
                title: `${count} columns`,
                aliases: ['columns', 'layout'],
                group: 'Layout',
                onItemClick: () =>
                  insertOrUpdateBlockForSlashMenu(editor, {
                    type: 'columns',
                    props: { count },
                    children: Array.from({ length: count }, () => ({
                      type: 'paragraph' as const,
                      content: '',
                    })),
                  }),
              })),
            ],
            query,
          )
        }
      />
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={async (query) =>
          filterSuggestionItems(
            [
              ...useWorkspace
                .getState()
                .pages.filter((p) => !p.deletedAt)
                .map((p) => ({
                  title: p.title || 'Untitled',
                  group: 'Pages',
                  onItemClick: () =>
                    editor.insertInlineContent([
                      {
                        type: 'pageMention',
                        props: { id: p.id, title: p.title },
                      },
                      ' ',
                    ]),
                })),
              {
                title: 'Today',
                group: 'Dates',
                onItemClick: () =>
                  editor.insertInlineContent(new Date().toLocaleDateString()),
              },
            ],
            query,
          )
        }
      />
    </BlockNoteView>
  )
}
