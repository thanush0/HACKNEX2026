const c = n => `rgb(var(--${n}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg-primary'), bg2: c('bg-secondary'), panel: c('panel'), line: c('border'),
        accent: c('accent'), violet: c('accent-2'), magenta: c('magenta'),
        ok: c('success'), warn: c('warning'), bad: c('danger'),
        ink: c('text-primary'), dim: c('text-secondary'), mute: c('text-muted'),
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
}
