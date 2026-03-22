import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Payload Collection CLI",
  description: "Functional CLI for Payload 3.0 collection management",
  base: '/payload-collection-cli/',
  head: [
    ['link', { rel: 'icon', href: '/payload-collection-cli/logo.png' }]
  ],
  markdown: {
    config: (md) => {
      const originalRender = md.render;
      md.render = function (this: any, src, env) {
        if (env.path && env.path.endsWith('ai.md')) {
          src = src.replace(/\(docs\//g, '(/');
        }
        return originalRender.call(this, src, env);
      };
    }
  },
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Specs', link: '/references/specs_detail' },
      { text: 'AI Context', link: '/ai' }
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is this?', link: '/' },
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
