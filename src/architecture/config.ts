import type { DiagramColors } from '../theme.ts'
import { DEFAULTS, THEMES } from '../theme.ts'
import type { MermaidFrontmatterMap, MermaidConfigValue } from '../mermaid-source.ts'
import type { RenderOptions } from '../types.ts'

export interface ArchitectureVisualConfig {
  groupHeaderHeight: number
  groupFontSize: number
  groupFontWeight: number
  serviceFontSize: number
  serviceFontWeight: number
  edgeFontSize: number
  edgeFontWeight: number
  iconSize: number
  serviceIconSize: number
  junctionOuterRadius: number
  junctionInnerRadius: number
  groupSurface?: string
  groupBorder?: string
  serviceSurface?: string
  serviceBorder?: string
}

export interface ResolvedArchitectureRenderConfig {
  renderOptions: RenderOptions
  colors: DiagramColors
  font: string
  transparent: boolean
  visual: ArchitectureVisualConfig
}

const MERMAID_THEME_COLORS: Record<string, DiagramColors> = {
  default: {
    bg: '#ffffff',
    fg: '#1f2937',
    line: '#64748b',
    accent: '#2563eb',
    muted: '#6b7280',
    surface: '#f6f8fc',
    border: '#cbd5e1',
  },
  base: {
    bg: '#ffffff',
    fg: '#1f2937',
    line: '#64748b',
    accent: '#2563eb',
    muted: '#6b7280',
    surface: '#f6f8fc',
    border: '#cbd5e1',
  },
  neutral: {
    bg: THEMES['zinc-light']!.bg,
    fg: THEMES['zinc-light']!.fg,
    line: '#737373',
    accent: '#525252',
    muted: '#71717a',
    surface: '#fafafa',
    border: '#a3a3a3',
  },
  dark: {
    bg: THEMES['github-dark']!.bg,
    fg: THEMES['github-dark']!.fg,
    line: '#6b7280',
    accent: '#60a5fa',
    muted: '#9ca3af',
    surface: '#111827',
    border: '#4b5563',
  },
  forest: {
    bg: '#f6fff7',
    fg: '#243b2f',
    line: '#5b8c66',
    accent: '#2f855a',
    muted: '#667d6f',
    surface: '#edf7ef',
    border: '#9bb8a3',
  },
}

export const DEFAULT_ARCHITECTURE_VISUAL: ArchitectureVisualConfig = {
  groupHeaderHeight: 28,
  groupFontSize: 12,
  groupFontWeight: 600,
  serviceFontSize: 13,
  serviceFontWeight: 500,
  edgeFontSize: 11,
  edgeFontWeight: 400,
  iconSize: 16,
  serviceIconSize: 18,
  junctionOuterRadius: 8,
  junctionInnerRadius: 4.5,
}

export function resolveArchitectureRenderConfig(
  mermaidConfig: MermaidFrontmatterMap,
  options: RenderOptions = {},
): ResolvedArchitectureRenderConfig {
  const themeVariables = getMap(mermaidConfig, 'themeVariables')
  const architecture = getMap(mermaidConfig, 'architecture')
  const palette = resolveThemePalette(mermaidConfig, themeVariables)
  const explicitBackground = pickString(themeVariables, 'background')
  const explicitText = pickString(themeVariables, 'primaryTextColor', 'textColor')
  const explicitMuted = pickString(themeVariables, 'secondaryTextColor', 'textColor')
  const background = options.bg ?? explicitBackground ?? palette.bg ?? DEFAULTS.bg
  const foreground = options.fg ?? explicitText ?? readableTextColor(background, palette.fg ?? DEFAULTS.fg)

  const colors: DiagramColors = {
    bg: background,
    fg: foreground,
    line: options.line ?? pickString(themeVariables, 'lineColor') ?? palette.line,
    accent: options.accent ?? pickString(themeVariables, 'primaryColor', 'tertiaryColor') ?? palette.accent,
    muted: options.muted ?? explicitMuted ?? (explicitBackground ? undefined : palette.muted),
    surface: options.surface ?? pickString(themeVariables, 'mainBkg', 'secondaryColor') ?? palette.surface,
    border: options.border ?? pickString(themeVariables, 'primaryBorderColor') ?? palette.border,
  }

  const font = options.font
    ?? getString(mermaidConfig, 'fontFamily')
    ?? pickString(themeVariables, 'fontFamily')
    ?? 'Inter'

  const baseFontSize = clamp(
    getNumber(architecture, 'fontSize')
      ?? getNumber(mermaidConfig, 'fontSize')
      ?? getNumber(themeVariables, 'fontSize')
      ?? DEFAULT_ARCHITECTURE_VISUAL.serviceFontSize,
    10,
    24,
  )

  const serviceIconSize = clamp(
    getNumber(architecture, 'iconSize') ?? DEFAULT_ARCHITECTURE_VISUAL.serviceIconSize,
    12,
    40,
  )

  const iconSize = clamp(Math.round(serviceIconSize * (DEFAULT_ARCHITECTURE_VISUAL.iconSize / DEFAULT_ARCHITECTURE_VISUAL.serviceIconSize)), 10, 36)
  const groupFontSize = clamp(Math.round(baseFontSize * 0.92), 10, 22)
  const edgeFontSize = clamp(Math.round(baseFontSize * 0.85), 10, 20)
  const groupHeaderHeight = Math.max(
    DEFAULT_ARCHITECTURE_VISUAL.groupHeaderHeight,
    Math.round(Math.max(groupFontSize, iconSize) + 12),
  )
  const junctionOuterRadius = clamp(Math.round(serviceIconSize * 0.44), 8, 18)
  const junctionInnerRadius = Number((junctionOuterRadius * 0.56).toFixed(1))

  const visual: ArchitectureVisualConfig = {
    groupHeaderHeight,
    groupFontSize,
    groupFontWeight: DEFAULT_ARCHITECTURE_VISUAL.groupFontWeight,
    serviceFontSize: baseFontSize,
    serviceFontWeight: DEFAULT_ARCHITECTURE_VISUAL.serviceFontWeight,
    edgeFontSize,
    edgeFontWeight: DEFAULT_ARCHITECTURE_VISUAL.edgeFontWeight,
    iconSize,
    serviceIconSize,
    junctionOuterRadius,
    junctionInnerRadius,
    groupSurface: pickString(themeVariables, 'clusterBkg') ?? colors.surface,
    groupBorder: pickString(themeVariables, 'clusterBorder') ?? colors.border,
    serviceSurface: pickString(themeVariables, 'mainBkg', 'secondaryColor') ?? colors.surface,
    serviceBorder: pickString(themeVariables, 'primaryBorderColor') ?? colors.border,
  }

  const transparent = options.transparent ?? false
  const renderOptions: RenderOptions = {
    ...options,
    bg: colors.bg,
    fg: colors.fg,
    line: colors.line,
    accent: colors.accent,
    muted: colors.muted,
    surface: colors.surface,
    border: colors.border,
    font,
    padding: options.padding ?? getNumber(architecture, 'padding'),
    transparent,
  }

  return { renderOptions, colors, font, transparent, visual }
}

function resolveThemePalette(
  mermaidConfig: MermaidFrontmatterMap,
  themeVariables: MermaidFrontmatterMap | undefined,
): DiagramColors {
  const themeName = getString(mermaidConfig, 'theme')?.toLowerCase()
  const themedPalette = themeName ? MERMAID_THEME_COLORS[themeName] : undefined
  if (themedPalette) {
    return themedPalette
  }

  if (getBoolean(themeVariables, 'darkMode')) {
    return MERMAID_THEME_COLORS.dark!
  }

  return MERMAID_THEME_COLORS.default!
}

function pickString(map: MermaidFrontmatterMap | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(map, key)
    if (value) return value
  }
  return undefined
}

function getString(map: MermaidFrontmatterMap | undefined, key: string): string | undefined {
  const value = map?.[key]
  return typeof value === 'string' ? value : undefined
}

function getBoolean(map: MermaidFrontmatterMap | undefined, key: string): boolean | undefined {
  const value = map?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function getNumber(map: MermaidFrontmatterMap | undefined, key: string): number | undefined {
  return toNumber(map?.[key])
}

function getMap(map: MermaidFrontmatterMap | undefined, key: string): MermaidFrontmatterMap | undefined {
  const value = map?.[key]
  return isMap(value) ? value : undefined
}

function toNumber(value: MermaidConfigValue | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined

  const normalized = value.trim()
  const match = normalized.match(/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/i)
  return match ? Number.parseFloat(normalized) : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isMap(value: MermaidConfigValue | undefined): value is MermaidFrontmatterMap {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readableTextColor(background: string, preferred: string): string {
  const bg = parseHexColor(background)
  const fg = parseHexColor(preferred)
  if (!bg || !fg) return preferred

  if (contrastRatio(bg, fg) >= 3.2) {
    return preferred
  }

  return relativeLuminance(bg) < 0.36 ? '#F8FAFC' : '#0F172A'
}

function parseHexColor(value: string): { r: number; g: number; b: number } | undefined {
  const normalized = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(normalized)) return undefined

  if (normalized.length === 3) {
    return {
      r: Number.parseInt(normalized[0]! + normalized[0]!, 16),
      g: Number.parseInt(normalized[1]! + normalized[1]!, 16),
      b: Number.parseInt(normalized[2]! + normalized[2]!, 16),
    }
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b))
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (light + 0.05) / (dark + 0.05)
}

function relativeLuminance(color: { r: number; g: number; b: number }): number {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  )
}
