// Linear + Maven Hybrid Design Tokens

export const tokens = {
  colors: {
    background: {
      default: '#0f172a', // Deep slate midnight
      subtle: '#1e293b',   // Surface card slate
      elevated: '#334155', // Popover / modal slate
      active: '#1e293b',
    },
    borders: {
      subtle: 'rgba(255, 255, 255, 0.08)',
      default: 'rgba(255, 255, 255, 0.12)',
      strong: 'rgba(255, 255, 255, 0.20)',
      accent: '#008D98',
    },
    brand: {
      primary: '#008D98',
      hover: '#00adb5',
      light: '#e6fffa',
      muted: 'rgba(0, 141, 152, 0.15)',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      muted: '#64748b',
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    pill: '9999px',
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'Geist', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
  },
} as const;

export type DesignTokens = typeof tokens;
