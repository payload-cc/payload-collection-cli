import { defineConfig } from 'vitepress'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig({
  title: "Payload Collection CLI",
  description: "Functional CLI for Payload 3.0 collection management",
  base: '/payload-collection-cli/',
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/payload-collection-cli/logo.png' }]
  ],
    markdown: {
      config: (md) => {
        // Internal rule to bundle documentation into ai.md during compilation
        const originalRender = md.render;
        md.render = function (this: any, src, env) {
          if (env.path && env.path.endsWith('ai.md')) {
            // Find placeholder and replace with resolved content from the pages list
            src = src.replace('[[AI_CONTEXT_BUNDLE]]', () => {
              const rootDir = process.cwd()
              const pages = [
                'README.md',
                'docs/examples.md',
                'docs/references/specs_detail.md'
              ]
              
              return pages
                .map(file => {
                  const filePath = path.resolve(rootDir, file)
                  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
                })
                .join('\n\n---\n\n')
                .replace(/\(docs\//g, '(/')
            })
          }
          return originalRender.call(this, src, env);
        };
      }
    },
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/examples' },
      { text: 'Specs', link: '/references/specs_detail' },
      { text: 'AI Context', link: '/ai' }
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is this?', link: '/' },
          { text: 'Examples & Use Cases', link: '/examples' },
          { text: 'AI Coding Context', link: '/ai' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Detailed Specs', link: '/references/specs_detail' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/payload-cc/payload-collection-cli' }
    ]
  }
})
