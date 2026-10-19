import type { ReactNode } from 'react'
import type { Block, Inline } from './markdown'

function renderInlines(inlines: Inline[]): ReactNode[] {
  return inlines.map((inline, index) => {
    switch (inline.type) {
      case 'text':
        return inline.value
      case 'strong':
        return <strong key={index}>{renderInlines(inline.children)}</strong>
      case 'em':
        return <em key={index}>{renderInlines(inline.children)}</em>
      case 'code':
        return <code key={index}>{inline.value}</code>
    }
  })
}

export function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <div className="help-md">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading': {
            const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
            return <Tag key={index}>{renderInlines(block.children)}</Tag>
          }
          case 'paragraph':
            return <p key={index}>{renderInlines(block.children)}</p>
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul'
            return (
              <Tag key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlines(item)}</li>
                ))}
              </Tag>
            )
          }
        }
      })}
    </div>
  )
}
