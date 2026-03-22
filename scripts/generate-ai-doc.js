import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const docsDir = path.resolve(rootDir, 'docs')

function resolveIncludes(content, baseDir) {
  return content.replace(/@include:\s*([^\n\s]+)/g, (match, filePath) => {
    const fullPath = path.resolve(baseDir, filePath)
    if (fs.existsSync(fullPath)) {
      let includedContent = fs.readFileSync(fullPath, 'utf-8')
      // Recursively resolve includes if any
      return resolveIncludes(includedContent, path.dirname(fullPath))
    }
    return match
  })
}

function generate() {
  const templatePath = path.resolve(docsDir, 'ai.template.md')
  const outputPath = path.resolve(docsDir, 'ai.md')

  if (!fs.existsSync(templatePath)) {
    // If template doesn't exist, create a default one from current ai.md content
    fs.writeFileSync(templatePath, `# AI Coding Context

> [!TIP]
> This page consolidates the entire project documentation into a single Markdown block for easy copying into AI coding assistants. Use the **copy button** at the top right of the code block below.

\`\`\`\`markdown
@include: ../README.md

---

@include: ./references/specs_detail.md
\`\`\`\`
`)
  }

  const template = fs.readFileSync(templatePath, 'utf-8')
  let resolved = resolveIncludes(template, docsDir)

  // Apply the same link transformation we had in config.ts
  resolved = resolved.replace(/\(docs\//g, '(/')

  fs.writeFileSync(outputPath, resolved)
  console.log('✅ Generated docs/ai.md with resolved inclusions.')
}

generate()
