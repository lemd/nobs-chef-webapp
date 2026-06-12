export function parseTimingToSeconds(str: string | null | undefined): number | null {
  if (!str) return null
  let secs = 0
  const h = str.match(/(\d+)\s*h(?:our|r)?s?/i)
  if (h) secs += parseInt(h[1]) * 3600
  const m = str.match(/(?:\d+[–\-])?((\d+))\s*min/i)
  if (m) secs += parseInt(m[1]) * 60
  const s = str.match(/(\d+)\s*sec/i)
  if (s) secs += parseInt(s[1])
  return secs > 0 ? secs : null
}

export function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function parseFraction(str: string | null | undefined): number | null {
  if (!str) return null
  const s = String(str).trim()
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return parseInt(frac[1]) / parseInt(frac[2])
  const range = s.match(/^(\d+(?:\.\d+)?)[–\-](\d+(?:\.\d+)?)$/)
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

export function formatFraction(val: number | null): string {
  if (val === null || val <= 0) return '0'
  const eighths = Math.round(val * 8)
  if (eighths === 0) return '0'
  const whole = Math.floor(eighths / 8)
  const rem = eighths % 8
  const f: Record<number, string> = { 0: '', 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' }
  const fStr = f[rem] ?? `${rem}/8`
  if (whole === 0) return fStr
  return fStr ? `${whole} ${fStr}` : `${whole}`
}

export function scaleQty(qty: string | null | undefined, factor: number): string | null | undefined {
  if (!qty || factor === 1) return qty
  const val = parseFraction(qty)
  if (val === null) return qty
  return formatFraction(val * factor)
}

export function parseServingsNum(str: string | null | undefined): number | null {
  if (!str) return null
  const m = String(str).match(/\d+/)
  return m ? parseInt(m[0]) : null
}

export function splitInstruction(instruction: string | null | undefined): string[] {
  if (!instruction) return []
  return instruction
    .split('\n')
    .flatMap((line) => line.trim().split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((l) => l.trim())
    .filter(Boolean)
}
