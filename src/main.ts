import './style.css'
import { initPWA } from './pwa.ts'

const app = document.querySelector<HTMLDivElement>('#app')!

// ── Types ──────────────────────────────────────────────────────────────────────
interface Rank {
  id: string
  label: string
  icon: string
  days: number
  tier: string
  desc: string
}

interface AppState {
  startTime: number | null
  bestStreak: number
}

interface HistoryEntry {
  startTime: number
  endTime: number
  days: number
  hours: number
  minutes: number
  rankLabel: string
  rankIcon: string
}

interface ExportData {
  state: AppState
  history: HistoryEntry[]
  exportedAt: string
}

// ── Constants ──────────────────────────────────────────────────────────────────
const RANKS: Rank[] = [
  { id: 'clown',    label: 'CLOWN',        icon: '🤡', days: 0,   tier: 'CLOWN',    desc: 'Your a freaking clown bro' },
  { id: 'lilbro',   label: 'LIL BRO',      icon: '👶', days: 1,   tier: 'LIL BRO',  desc: 'A day is nothing' },
  { id: 'average',  label: 'AVERAGE',      icon: '🤫', days: 3,   tier: 'AVERAGE',  desc: 'Keep going bro' },
  { id: 'expert',   label: 'EXPERT',       icon: '😤', days: 7,   tier: 'EXPERT',   desc: 'One full week. yes sir dont quite now' },
  { id: 'master',   label: 'MASTER',       icon: '😠', days: 15,  tier: 'MASTER',   desc: '15 days is impressive' },
  { id: 'sigma',    label: 'SIGMA',        icon: '😎', days: 30,  tier: 'SIGMA',    desc: 'You can pull bitches now' },
  { id: 'chad',     label: 'GIGACHAD',     icon: '🗿', days: 120, tier: 'GIGACHAD', desc: 'nothing can beat you anymore' },
  { id: 'galactic', label: 'GALACTIC MEN', icon: '🌌', days: 365, tier: 'GALACTIC', desc: 'you reached the peak every one desiers' },
]

// ── Storage ────────────────────────────────────────────────────────────────────
function getState(): AppState {
  try {
    const raw = localStorage.getItem('quitclock')
    return raw ? (JSON.parse(raw) as AppState) : { startTime: null, bestStreak: 0 }
  } catch {
    return { startTime: null, bestStreak: 0 }
  }
}

function saveState(s: AppState): void {
  localStorage.setItem('quitclock', JSON.stringify(s))
}

function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem('quitclock_history')
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(hist: HistoryEntry[]): void {
  localStorage.setItem('quitclock_history', JSON.stringify(hist))
}

// ── State ──────────────────────────────────────────────────────────────────────
let state: AppState = getState()
let intervalId: ReturnType<typeof setInterval> | null = null

// ── DOM refs ───────────────────────────────────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`#${id} not found`)
  return node as T
}

const $days        = el<HTMLSpanElement>('days')
const $hours       = el<HTMLSpanElement>('hours')
const $minutes     = el<HTMLSpanElement>('minutes')
const $seconds     = el<HTMLSpanElement>('seconds')
const $rankIcon    = el<HTMLSpanElement>('rank-icon')
const $rankName    = el<HTMLSpanElement>('rank-name')
const $progress    = el<HTMLDivElement>('progress-fill')
const $progLabel   = el<HTMLSpanElement>('progress-label')
const $progPct     = el<HTMLSpanElement>('progress-pct')
const $statusPill  = el<HTMLDivElement>('status-pill')
const $statStreak  = el<HTMLSpanElement>('stat-streak')
const $statSessions = el<HTMLSpanElement>('stat-sessions')
const $achGrid     = el<HTMLDivElement>('achievements-grid')
const $histList    = el<HTMLDivElement>('history-list')
const $btnStart    = el<HTMLButtonElement>('btn-start')
const $btnReset    = el<HTMLButtonElement>('btn-reset')
const $btnBackdate = el<HTMLButtonElement>('btn-backdate')

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string, type: 'success' | 'error' = 'success'): void {
  const t = el<HTMLDivElement>('app-toast')
  t.textContent = msg
  t.className = `app-toast ${type} show`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    t.className = `app-toast ${type}`
  }, 2800)
}

// ── Rank helpers ───────────────────────────────────────────────────────────────
function getRank(days: number): Rank {
  let rank: Rank = RANKS[0]
  for (const r of RANKS) {
    if (days >= r.days) rank = r
  }
  return rank
}

function getNextRank(rank: Rank): Rank | null {
  const idx = RANKS.findIndex(r => r.id === rank.id)
  return RANKS[idx + 1] ?? null
}

// ── Elapsed ────────────────────────────────────────────────────────────────────
function elapsedSeconds(): number {
  if (state.startTime === null) return 0
  return Math.max(0, Math.floor((Date.now() - state.startTime) / 1000))
}

// ── Display ────────────────────────────────────────────────────────────────────
let lastSec = -1

function renderDisplay(totalSec: number): void {
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (s !== lastSec) {
    $seconds.classList.remove('tick')
    void $seconds.offsetWidth
    $seconds.classList.add('tick')
    lastSec = s
  }

  $days.textContent    = String(d).padStart(3, '0')
  $hours.textContent   = String(h).padStart(2, '0')
  $minutes.textContent = String(m).padStart(2, '0')
  $seconds.textContent = String(s).padStart(2, '0')

  const rank = getRank(d)
  const nextRank = getNextRank(rank)
  $rankIcon.textContent = rank.icon
  $rankName.textContent = rank.label

  if (nextRank) {
    const from = rank.days * 86400
    const to   = nextRank.days * 86400
    const pct  = Math.min(100, ((totalSec - from) / (to - from)) * 100)
    $progress.style.width    = `${pct}%`
    $progLabel.textContent   = `Next: ${nextRank.label}`
    $progPct.textContent     = `${Math.floor(pct)}%`
  } else {
    $progress.style.width  = '100%'
    $progLabel.textContent = 'MAX RANK'
    $progPct.textContent   = '100%'
  }

  // Update best streak live
  if (state.startTime !== null && d > state.bestStreak) {
    state.bestStreak = d
    saveState(state)
  }

  $statStreak.textContent   = String(state.bestStreak)
  $statSessions.textContent = String(getHistory().length)
}

function tick(): void {
  renderDisplay(elapsedSeconds())
}

// ── Sync UI state ──────────────────────────────────────────────────────────────
function syncUI(): void {
  const running = state.startTime !== null

  $btnStart.style.display    = running ? 'none' : 'block'
  $btnBackdate.style.display = running ? 'none' : 'block'
  $btnReset.style.display    = running ? 'block' : 'none'

  $statusPill.textContent = running ? '● TRACKING' : '● STOPPED'
  $statusPill.classList.toggle('stopped', !running)
}

// ── Start ──────────────────────────────────────────────────────────────────────
function startTimer(fromTime?: number): void {
  if (state.startTime !== null) return

  state.startTime = fromTime ?? Date.now()
  saveState(state)

  syncUI()
  tick()
  intervalId = setInterval(tick, 1000)
}

// ── Reset ──────────────────────────────────────────────────────────────────────
function resetTimer(): void {
  if (state.startTime === null) return

  const totalSec = elapsedSeconds()
  const d    = Math.floor(totalSec / 86400)
  const h    = Math.floor((totalSec % 86400) / 3600)
  const m    = Math.floor((totalSec % 3600) / 60)
  const rank = getRank(d)

  const hist = getHistory()
  hist.push({
    startTime: state.startTime,
    endTime:   Date.now(),
    days: d, hours: h, minutes: m,
    rankLabel: rank.label,
    rankIcon:  rank.icon,
  })
  saveHistory(hist)

  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }

  state.startTime = null
  saveState(state)

  lastSec = -1
  syncUI()
  renderDisplay(0)
}

// ── Achievements ───────────────────────────────────────────────────────────────
function renderAchievements(): void {
  const bestD = Math.max(Math.floor(elapsedSeconds() / 86400), state.bestStreak)
  $achGrid.innerHTML = ''

  for (const r of RANKS) {
    const unlocked = bestD >= r.days
    const card = document.createElement('div')
    card.className = `achievement-card ${unlocked ? 'unlocked' : 'locked'}`
    card.innerHTML = `
      <div class="ach-icon">${r.icon}</div>
      <div class="ach-info">
        <div class="ach-tier">TIER — ${r.tier}</div>
        <div class="ach-name">${r.label}</div>
        <div class="ach-desc">${r.desc} (${r.days === 0 ? 'Start' : `${r.days} days`})</div>
      </div>
      <div class="ach-status ${unlocked ? 'done' : 'pending'}">${unlocked ? '✓ UNLOCKED' : `${r.days}d`}</div>
    `
    $achGrid.appendChild(card)
  }
}

// ── History ────────────────────────────────────────────────────────────────────
function renderHistory(): void {
  const hist = getHistory()

  if (!hist.length) {
    $histList.innerHTML = '<div class="empty-state">No history yet.<br/>Start your first streak.</div>'
    return
  }

  $histList.innerHTML = ''
  ;[...hist].reverse().forEach((entry: HistoryEntry) => {
    const card = document.createElement('div')
    card.className = 'history-entry'
    const startDate = new Date(entry.startTime).toLocaleString()
    const endDate   = new Date(entry.endTime).toLocaleString()
    card.innerHTML = `
      <div class="he-left">
        <div class="he-date">STARTED ${startDate}</div>
        <div class="he-date">ENDED &nbsp;&nbsp;${endDate}</div>
        <div class="he-streak">${entry.days}d ${entry.hours}h ${entry.minutes}m <span>duration</span></div>
      </div>
      <div class="he-rank">${entry.rankIcon} ${entry.rankLabel}</div>
    `
    $histList.appendChild(card)
  })
}

// ── Backdate modal ─────────────────────────────────────────────────────────────
$btnBackdate.addEventListener('click', () => {
  // Default the picker to right now, capped at current time
  const now   = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
  const input = el<HTMLInputElement>('backdate-input')
  input.max   = local
  input.value = local
  el<HTMLDivElement>('modal-backdate').classList.remove('hidden')
})

el<HTMLButtonElement>('modal-cancel').addEventListener('click', () => {
  el<HTMLDivElement>('modal-backdate').classList.add('hidden')
})

el<HTMLButtonElement>('modal-confirm').addEventListener('click', () => {
  const val = el<HTMLInputElement>('backdate-input').value
  if (!val) {
    showToast('PICK A DATE FIRST', 'error')
    return
  }
  const ts = new Date(val).getTime()
  if (isNaN(ts) || ts > Date.now()) {
    showToast('DATE MUST BE IN THE PAST', 'error')
    return
  }
  el<HTMLDivElement>('modal-backdate').classList.add('hidden')
  startTimer(ts)
  showToast('STREAK STARTED FROM PAST DATE')
})

// Close modals on overlay click
el<HTMLDivElement>('modal-backdate').addEventListener('click', (e) => {
  if (e.target === el('modal-backdate')) el<HTMLDivElement>('modal-backdate').classList.add('hidden')
})
el<HTMLDivElement>('modal-import').addEventListener('click', (e) => {
  if (e.target === el('modal-import')) el<HTMLDivElement>('modal-import').classList.add('hidden')
})

// ── Export ─────────────────────────────────────────────────────────────────────
el<HTMLButtonElement>('btn-export').addEventListener('click', () => {
  const data: ExportData = {
    state:      getState(),
    history:    getHistory(),
    exportedAt: new Date().toISOString(),
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `fappachino-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('DATA EXPORTED')
})

// ── Import ─────────────────────────────────────────────────────────────────────
el<HTMLButtonElement>('btn-import').addEventListener('click', () => {
  el<HTMLTextAreaElement>('import-textarea').value = ''
  el<HTMLDivElement>('modal-import').classList.remove('hidden')
})

el<HTMLButtonElement>('import-cancel').addEventListener('click', () => {
  el<HTMLDivElement>('modal-import').classList.add('hidden')
})

el<HTMLButtonElement>('import-confirm').addEventListener('click', () => {
  const raw = el<HTMLTextAreaElement>('import-textarea').value.trim()
  if (!raw) {
    showToast('PASTE JSON FIRST', 'error')
    return
  }
  try {
    const data = JSON.parse(raw) as ExportData
    if (!data.state || !Array.isArray(data.history)) {
      showToast('INVALID FORMAT', 'error')
      return
    }
    // Stop any running timer first
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    saveState(data.state)
    saveHistory(data.history)
    state  = getState()
    lastSec = -1
    syncUI()
    if (state.startTime !== null) {
      tick()
      intervalId = setInterval(tick, 1000)
    } else {
      renderDisplay(0)
    }
    renderHistory()
    el<HTMLDivElement>('modal-import').classList.add('hidden')
    showToast('DATA IMPORTED ✓')
  } catch {
    showToast('INVALID JSON', 'error')
  }
})

// ── Other buttons ──────────────────────────────────────────────────────────────
$btnStart.addEventListener('click', () => startTimer())

$btnReset.addEventListener('click', () => {
  if (!confirm('Reset the timer? This session will be saved to history.')) return
  resetTimer()
})

el<HTMLButtonElement>('btn-clear-history').addEventListener('click', () => {
  if (!confirm('Clear all history?')) return
  saveHistory([])
  renderHistory()
  $statSessions.textContent = '0'
  showToast('HISTORY CLEARED')
})

// ── Tab switching ──────────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('.nav-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.classList.remove('active'))
    btn.classList.add('active')

    const tabId = btn.dataset['tab']
    if (!tabId) return
    el<HTMLElement>(`tab-${tabId}`).classList.add('active')

    if (tabId === 'achievements') renderAchievements()
    if (tabId === 'history') renderHistory()
  })
})

// ── Init ───────────────────────────────────────────────────────────────────────
syncUI()

if (state.startTime !== null) {
  tick()
  intervalId = setInterval(tick, 1000)
} else {
  renderDisplay(0)
}

initPWA(app)