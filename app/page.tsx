'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { readContract } from '@/lib/genlayer'
import { CONTRACT_ADDRESS, STARTING_POINTS, MIN_STAKE, MAX_STAKE, APPEAL_COST } from '@/lib/config'

interface Player {
  address: string; username: string; points: string
  wins: string; losses: string; draws: string
  win_streak: string; best_streak: string; total_debates: string
  points_earned: string; points_lost: string; registered: string
}
interface Debate {
  debate_id: string; creator: string; opponent: string
  topic: string; stake: string; status: string
  creator_argument: string; opponent_argument: string
  creator_score: string; opponent_score: string
  winner: string; reasoning: string
  creator_score_breakdown: string; opponent_score_breakdown: string
  appeal_grounds: string; appeal_verdict: string; appeal_reasoning: string
  claimed: string; created_at: string; category: string
}
type Tab = 'arena' | 'battles' | 'hall' | 'profile'
const CATEGORIES = ['General', 'Technology', 'Politics', 'Philosophy', 'Science', 'Sports', 'Entertainment', 'Economics']

// ── Colosseum Design Tokens ──────────────────────────────────────────────────
const BG = '#080608'
const STONE = '#12100E'
const CARD = '#16130F'
const BORDER = '#2A2118'
const FIRE = '#F97316'
const EMBER = '#EF4444'
const GOLD = '#F59E0B'
const SILVER = '#94A3B8'
const TORCH = '#FCD34D'
const TEXT = '#F5F0E8'
const MUTED = '#78716C'
const VICTORY = '#10B981'
const DEFEAT = '#EF4444'
const PURPLE = '#A855F7'

function shortAddr(a: string) {
  if (!a || a === '0x0000000000000000000000000000000000000000') return '—'
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  OPEN:      { label: 'Seeking Challenger', color: VICTORY,  icon: '⚔️' },
  ACTIVE:    { label: 'Battle in Progress', color: FIRE,     icon: '🔥' },
  JUDGING:   { label: 'Judges Deliberate', color: GOLD,     icon: '⚖️' },
  FINISHED:  { label: 'Verdict Delivered', color: PURPLE,   icon: '📜' },
  CLAIMED:   { label: 'Glory Claimed',     color: MUTED,    icon: '🏆' },
  FINAL:     { label: 'Battle Complete',   color: MUTED,    icon: '✓' },
  CANCELLED: { label: 'Abandoned',         color: DEFEAT,   icon: '💀' },
}

const inp: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`,
  borderRadius: '8px', padding: '11px 14px', color: TEXT, fontSize: '14px',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
}

// ── Decorative fire line ─────────────────────────────────────────────────────
function FireLine() {
  return (
    <div style={{ position: 'relative', height: '2px', margin: '0', overflow: 'visible' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${FIRE}88, ${GOLD}CC, ${FIRE}88, transparent)` }} />
      <div style={{ position: 'absolute', left: '50%', top: '-3px', transform: 'translateX(-50%)', width: '8px', height: '8px', backgroundColor: GOLD, borderRadius: '50%', boxShadow: `0 0 12px ${GOLD}, 0 0 24px ${FIRE}` }} />
    </div>
  )
}

// ── Scroll/parchment card ─────────────────────────────────────────────────────
function ScrollCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', position: 'relative', overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${FIRE}66, transparent)` }} />
      {children}
    </div>
  )
}

// ── Gladiator avatar ──────────────────────────────────────────────────────────
function GladiatorAvatar({ name, size = 44, color = FIRE }: { name: string; size?: number; color?: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${color}44, ${color}11)`, border: `2px solid ${color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 900, color, flexShrink: 0, boxShadow: `0 0 ${size * 0.3}px ${color}33`, letterSpacing: '-0.02em' }}>
      {name ? name[0].toUpperCase() : '⚔'}
    </div>
  )
}

// ── Points badge ──────────────────────────────────────────────────────────────
function PointsBadge({ points }: { points: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: `linear-gradient(135deg, ${GOLD}22, ${FIRE}11)`, border: `1px solid ${GOLD}55`, borderRadius: '20px', padding: '5px 13px' }}>
      <span style={{ fontSize: '13px' }}>🔥</span>
      <span style={{ fontSize: '14px', fontWeight: 800, color: GOLD, letterSpacing: '-0.01em' }}>{points}</span>
      <span style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>glory</span>
    </div>
  )
}

export default function Home() {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('arena')
  const [debates, setDebates] = useState<Debate[]>([])
  const [player, setPlayer] = useState<Player | null>(null)
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [stats, setStats] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [activeDebate, setActiveDebate] = useState<Debate | null>(null)
  const [catFilter, setCatFilter] = useState('ALL')

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const dr = await readContract('get_all_debates')
      try { setDebates(JSON.parse(dr as string)) } catch {}
      await delay(700)
      const sr = await readContract('get_platform_stats')
      try { setStats(JSON.parse(sr as string)) } catch {}
      await delay(700)
      const lr = await readContract('get_leaderboard')
      try { setLeaderboard(JSON.parse(lr as string)) } catch {}
    } catch {}
    finally { setRefreshing(false) }
  }, [])

  const fetchPlayer = useCallback(async (addr: string) => {
    try { const r = await readContract('get_player', [addr]); setPlayer(JSON.parse(r as string)) } catch {}
  }, [])

  const fetchDebateDetail = useCallback(async (id: string, viewer: string): Promise<Debate | null> => {
    try { return JSON.parse(await readContract('get_debate_for_participant', [id, viewer]) as string) } catch { return null }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { if (address) fetchPlayer(address) }, [address, fetchPlayer])

  const showMsg = (text: string, error = false) => {
    setMsg({ text, error })
    if (!error) setTimeout(() => setMsg(null), 12000)
  }

  async function callWrite(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet to enter the arena.', true); return false }
    if (!player || player.registered !== 'true') { setShowRegister(true); return false }
    setLoading(true)
    showMsg(method === 'submit_argument' ? '⚔️ Your argument has been sent to the judges. Deliberation takes 1–3 minutes. Stay in the arena.' : `Processing ${method}…`)
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const result = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (result.success) {
        showMsg(`✓ ${method} succeeded!`)
        await fetchAll(); if (address) await fetchPlayer(address)
        return true
      }
      showMsg(`Failed: ${result.error}`, true); return false
    } catch (e: any) { setLoading(false); showMsg(e?.message ?? String(e), true); return false }
  }

  async function callWriteNoCheck(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet first.', true); return false }
    setLoading(true); showMsg(`Processing…`)
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const result = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (result.success) { showMsg(`✓ Done!`); await fetchAll(); if (address) await fetchPlayer(address); return true }
      showMsg(`Failed: ${result.error}`, true); return false
    } catch (e: any) { setLoading(false); showMsg(e?.message ?? String(e), true); return false }
  }

  const openDebates = debates.filter(d => d.status === 'OPEN' && (catFilter === 'ALL' || d.category === catFilter))
  const myDebates = debates.filter(d => d.creator === address || d.opponent === address)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: `${STONE}F0`, backdropFilter: 'blur(16px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', height: '58px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginRight: '8px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: `0 0 20px ${FIRE}55` }}>⚔️</div>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '17px', letterSpacing: '-0.03em', lineHeight: 1, background: `linear-gradient(135deg, ${TORCH}, ${FIRE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DeBattle</div>
              <div style={{ fontSize: '8px', color: MUTED, letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1 }}>On-Chain Colosseum</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: '2px', flex: 1, overflowX: 'auto' }}>
            {([['arena', '🏟 Arena'], ['battles', '⚔️ My Battles'], ['hall', '🏆 Hall of Fame'], ['profile', '🛡 My Record']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: tab === t ? 700 : 400, background: tab === t ? `${FIRE}22` : 'transparent', color: tab === t ? FIRE : MUTED, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit', borderBottom: tab === t ? `2px solid ${FIRE}` : '2px solid transparent' }}>
                {label}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {player?.registered === 'true' && <PointsBadge points={player.points} />}
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
          </div>
        </div>
        <FireLine />
      </header>

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {msg && (
        <div onClick={() => setMsg(null)} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: msg.error ? '#1A0808' : STONE, borderTop: `2px solid ${msg.error ? EMBER : FIRE}`, padding: '14px 20px', cursor: 'pointer' }}>
          <pre style={{ fontSize: '12px', fontFamily: 'monospace', color: msg.error ? '#FCA5A5' : TORCH, whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</pre>
          <p style={{ fontSize: '10px', color: MUTED, marginTop: '4px' }}>Tap to dismiss</p>
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {showCreate && player && (
        <CreateModal player={player} onClose={() => setShowCreate(false)}
          onSubmit={(t, s, c) => { callWrite('create_debate', [t, s, c]); setShowCreate(false) }} loading={loading} />
      )}
      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)}
          onSubmit={u => { callWriteNoCheck('register', [u]); setShowRegister(false) }} loading={loading} />
      )}
      {activeDebate && address && (
        <BattleModal debate={activeDebate} address={address} player={player}
          onClose={() => setActiveDebate(null)} onAction={callWrite}
          fetchDetail={id => fetchDebateDetail(id, address)} loading={loading} />
      )}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 80px' }}>

        {/* ════ ARENA ════════════════════════════════════════════════════════ */}
        {tab === 'arena' && (
          <div>
            {/* Hero — Colosseum Banner */}
            <div style={{ margin: '24px 0', position: 'relative', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              {/* Background texture */}
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 50%, ${FIRE}18 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, ${EMBER}11 0%, transparent 40%), radial-gradient(ellipse at 60% 90%, ${GOLD}0A 0%, transparent 40%)` }} />
              {/* Stone pattern overlay */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, ${BORDER}44 39px, ${BORDER}44 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, ${BORDER}22 39px, ${BORDER}22 40px)`, opacity: 0.3 }} />

              <div style={{ position: 'relative', padding: 'clamp(28px,5vw,64px)' }}>
                {/* Tagline */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '16px' }}>🔥</span>
                  <span style={{ fontSize: '11px', color: FIRE, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>GenLayer On-Chain Colosseum</span>
                  <span style={{ fontSize: '16px' }}>🔥</span>
                </div>

                <h1 style={{ fontSize: 'clamp(32px,7vw,68px)', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: '8px' }}>
                  <span style={{ background: `linear-gradient(135deg, ${TEXT}, ${SILVER})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Words are your</span>
                  <br />
                  <span style={{ background: `linear-gradient(135deg, ${TORCH}, ${FIRE}, ${EMBER})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 0 30px ${FIRE}55)` }}>weapons.</span>
                </h1>
                <p style={{ color: MUTED, fontSize: 'clamp(14px,2vw,17px)', maxWidth: '480px', lineHeight: 1.7, marginBottom: '28px' }}>
                  Stake glory points. Enter the arena. Argue your case before 5 AI judges. The strongest argument wins all.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
                  <button onClick={() => player?.registered === 'true' ? setShowCreate(true) : setShowRegister(true)}
                    style={{ background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '13px 28px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 24px ${FIRE}55`, letterSpacing: '-0.01em' }}>
                    ⚔️ Enter the Arena
                  </button>
                  {(!player || player.registered !== 'true') && (
                    <button onClick={() => setShowRegister(true)}
                      style={{ background: 'transparent', color: TORCH, border: `1px solid ${FIRE}55`, borderRadius: '10px', padding: '13px 28px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Join as Gladiator
                    </button>
                  )}
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {[
                    { icon: '⚔️', label: 'Total Battles', value: stats.total_debates ?? '0', color: FIRE },
                    { icon: '🏟', label: 'Open Arenas', value: stats.open_debates ?? '0', color: VICTORY },
                    { icon: '🛡', label: 'Gladiators', value: stats.total_players ?? '0', color: GOLD },
                    { icon: '🏆', label: 'Completed', value: stats.completed_debates ?? '0', color: SILVER },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: `${STONE}CC`, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px 18px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{s.icon}</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: '10px', color: MUTED, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rules of Combat */}
            <ScrollCard style={{ marginBottom: '24px', padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '20px' }}>📜</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: TORCH, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rules of Combat</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {[
                  { n: 'I', title: 'Issue Challenge', desc: 'Name your topic. Stake your glory. AI judges validate it is a fair fight.' },
                  { n: 'II', title: 'Accept Battle', desc: 'A challenger matches your stake. The gates of the arena open.' },
                  { n: 'III', title: 'Deliver Arguments', desc: 'Both fighters argue in secret. Neither sees the other until the judges speak.' },
                  { n: 'IV', title: 'Judges Deliberate', desc: '5 GenLayer AI validators score logic, evidence, persuasion, and clarity.' },
                  { n: 'V', title: 'Claim Glory', desc: 'The victor claims both stakes. The defeated may appeal — once.' },
                ].map((r, i) => (
                  <div key={i} style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: FIRE, fontFamily: 'serif', letterSpacing: '0.05em', marginBottom: '6px' }}>RULE {r.n}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: TEXT, marginBottom: '5px' }}>{r.title}</div>
                    <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.55 }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </ScrollCard>

            {/* Category filters */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
              {['ALL', ...CATEGORIES].map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${catFilter === c ? FIRE : BORDER}`, background: catFilter === c ? `${FIRE}18` : 'transparent', color: catFilter === c ? FIRE : MUTED, fontSize: '12px', fontWeight: catFilter === c ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>
                  {c}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <button onClick={fetchAll} style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {refreshing ? '↻ Loading…' : '↻ Refresh'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>Open Arenas</h2>
              <span style={{ fontSize: '13px', color: MUTED }}>{openDebates.length} battles awaiting challengers</span>
            </div>

            {openDebates.length === 0 ? (
              <ScrollCard style={{ padding: '64px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px', filter: `drop-shadow(0 0 20px ${FIRE}55)` }}>⚔️</div>
                <p style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: TORCH }}>The arena stands empty</p>
                <p style={{ color: MUTED, fontSize: '14px', marginBottom: '24px' }}>No gladiator has dared to issue a challenge. Will you be first?</p>
                <button onClick={() => player?.registered === 'true' ? setShowCreate(true) : setShowRegister(true)}
                  style={{ background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 28px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 20px ${FIRE}44` }}>
                  ⚔️ Issue First Challenge
                </button>
              </ScrollCard>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px,100%), 1fr))', gap: '12px' }}>
                {openDebates.map(d => (
                  <BattleCard key={d.debate_id} debate={d} address={address}
                    onJoin={() => callWrite('join_debate', [d.debate_id])}
                    onClick={() => setActiveDebate(d)} loading={loading} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ MY BATTLES ═══════════════════════════════════════════════════ */}
        {tab === 'battles' && (
          <div style={{ paddingTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>⚔️ My Battles</h2>
                <p style={{ color: MUTED, fontSize: '13px', marginTop: '3px' }}>{myDebates.length} battles fought</p>
              </div>
              <button onClick={fetchAll} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {refreshing ? '↻' : '↻ Refresh'}
              </button>
            </div>
            {!address ? (
              <EmptyArena icon="🛡" title="Connect your wallet" sub="Your battle history awaits" />
            ) : myDebates.length === 0 ? (
              <EmptyArena icon="🗡" title="No battles yet" sub="Step into the arena and prove your worth">
                <button onClick={() => setTab('arena')} style={{ marginTop: '16px', background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Enter Arena</button>
              </EmptyArena>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myDebates.map(d => (
                  <BattleCard key={d.debate_id} debate={d} address={address}
                    onJoin={() => {}} onClick={() => setActiveDebate(d)} loading={loading} detailed />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ HALL OF FAME ═════════════════════════════════════════════════ */}
        {tab === 'hall' && (
          <div style={{ paddingTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>🏆 Hall of Fame</h2>
                <p style={{ color: MUTED, fontSize: '13px', marginTop: '3px' }}>The greatest gladiators of the colosseum</p>
              </div>
              <button onClick={fetchAll} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {refreshing ? '↻' : '↻ Refresh'}
              </button>
            </div>
            {leaderboard.length === 0 ? (
              <EmptyArena icon="🏛" title="No legends yet" sub="Register and claim your place in history" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leaderboard.map((p, i) => {
                  const isTop = i === 0
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                  const rankColor = i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? '#CD7F32' : MUTED
                  return (
                    <ScrollCard key={p.address} style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* Rank */}
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: medal ? `${rankColor}22` : BG, border: `1px solid ${medal ? rankColor + '55' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: medal ? '22px' : '13px', fontWeight: 700, color: rankColor, flexShrink: 0 }}>
                          {medal ?? `#${i + 1}`}
                        </div>
                        {/* Avatar */}
                        <GladiatorAvatar name={p.username || '?'} size={42} color={isTop ? GOLD : FIRE} />
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontWeight: 800, fontSize: '15px', color: isTop ? GOLD : TEXT }}>{p.username || shortAddr(p.address)}</p>
                            {p.address === address && <span style={{ fontSize: '10px', color: FIRE, background: `${FIRE}18`, border: `1px solid ${FIRE}33`, borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>YOU</span>}
                            {parseInt(p.win_streak) >= 3 && <span style={{ fontSize: '10px', color: TORCH, background: `${TORCH}18`, border: `1px solid ${TORCH}33`, borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>🔥 {p.win_streak} streak</span>}
                          </div>
                          <p style={{ fontSize: '11px', color: MUTED, fontFamily: 'monospace', marginTop: '2px' }}>{shortAddr(p.address)}</p>
                        </div>
                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontWeight: 800, color: VICTORY, fontSize: '18px', lineHeight: 1 }}>{p.wins}</p>
                            <p style={{ fontSize: '9px', color: MUTED, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wins</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontWeight: 800, color: DEFEAT, fontSize: '18px', lineHeight: 1 }}>{p.losses}</p>
                            <p style={{ fontSize: '9px', color: MUTED, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Losses</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontWeight: 800, color: GOLD, fontSize: '18px', lineHeight: 1 }}>{p.points}</p>
                            <p style={{ fontSize: '9px', color: MUTED, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Glory</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontWeight: 800, color: FIRE, fontSize: '18px', lineHeight: 1 }}>{p.best_streak}</p>
                            <p style={{ fontSize: '9px', color: MUTED, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best</p>
                          </div>
                        </div>
                      </div>
                    </ScrollCard>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ MY RECORD ════════════════════════════════════════════════════ */}
        {tab === 'profile' && (
          <div style={{ paddingTop: '28px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '20px' }}>🛡 My Record</h2>
            {!address ? (
              <EmptyArena icon="🔌" title="Connect your wallet" sub="Your gladiator record lives here" />
            ) : !player || player.registered !== 'true' ? (
              <ScrollCard style={{ padding: '56px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '60px', marginBottom: '16px', filter: `drop-shadow(0 0 28px ${FIRE}66)` }}>⚔️</div>
                <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '10px', color: TORCH }}>You are not yet a gladiator</h3>
                <p style={{ color: MUTED, fontSize: '15px', marginBottom: '28px', maxWidth: '360px', margin: '0 auto 28px', lineHeight: 1.65 }}>
                  Register to receive <strong style={{ color: GOLD }}>{STARTING_POINTS} glory points</strong> and enter the colosseum.
                </p>
                <button onClick={() => setShowRegister(true)} style={{ background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '14px 32px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 24px ${FIRE}44` }}>
                  ⚔️ Enter as Gladiator — {STARTING_POINTS} Points Free
                </button>
              </ScrollCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Gladiator card */}
                <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 90% 50%, ${FIRE}18 0%, transparent 55%), radial-gradient(ellipse at 10% 80%, ${EMBER}0A 0%, transparent 45%)` }} />
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, ${BORDER}33 39px, ${BORDER}33 40px)`, opacity: 0.2 }} />
                  <div style={{ position: 'relative', padding: '28px', display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <GladiatorAvatar name={player.username || '?'} size={80} color={FIRE} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <h3 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.02em', color: TORCH }}>{player.username || 'Anonymous'}</h3>
                        {parseInt(player.wins) >= 5 && <span style={{ fontSize: '11px', background: `${GOLD}22`, border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '2px 8px', color: GOLD, fontWeight: 700 }}>⭐ Veteran</span>}
                        {parseInt(player.win_streak) >= 3 && <span style={{ fontSize: '11px', background: `${FIRE}22`, border: `1px solid ${FIRE}44`, borderRadius: '6px', padding: '2px 8px', color: FIRE, fontWeight: 700 }}>🔥 On Fire</span>}
                      </div>
                      <p style={{ color: MUTED, fontFamily: 'monospace', fontSize: '11px', marginBottom: '14px' }}>{address}</p>
                      <PointsBadge points={player.points} />
                    </div>
                  </div>
                </div>

                {/* Battle record */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'Victories', value: player.wins, color: VICTORY, icon: '⚔️' },
                    { label: 'Defeats', value: player.losses, color: DEFEAT, icon: '💀' },
                    { label: 'Draws', value: player.draws, color: SILVER, icon: '🤝' },
                  ].map(s => (
                    <ScrollCard key={s.label} style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>
                      <p style={{ fontSize: '28px', fontWeight: 900, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
                      <p style={{ fontSize: '10px', color: MUTED, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                    </ScrollCard>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  {[
                    { label: 'Total Battles', value: player.total_debates, color: TEXT, icon: '🏟' },
                    { label: 'Best Streak', value: player.best_streak, color: FIRE, icon: '🔥' },
                    { label: 'Glory Earned', value: player.points_earned, color: GOLD, icon: '📈' },
                    { label: 'Glory Lost', value: player.points_lost, color: DEFEAT, icon: '📉' },
                  ].map(s => (
                    <ScrollCard key={s.label} style={{ padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
                      <p style={{ fontSize: '22px', fontWeight: 800, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
                      <p style={{ fontSize: '10px', color: MUTED, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                    </ScrollCard>
                  ))}
                </div>

                {/* Win rate */}
                {parseInt(player.total_debates) > 0 && (
                  <ScrollCard style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: TEXT }}>Victory Rate</span>
                      <span style={{ fontSize: '14px', color: FIRE, fontWeight: 800 }}>
                        {Math.round((parseInt(player.wins) / parseInt(player.total_debates)) * 100)}%
                      </span>
                    </div>
                    <div style={{ backgroundColor: BG, borderRadius: '4px', height: '10px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                      <div style={{ width: `${Math.round((parseInt(player.wins) / parseInt(player.total_debates)) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${FIRE}, ${TORCH})`, borderRadius: '4px', boxShadow: `0 0 10px ${FIRE}66`, transition: 'width 0.8s ease' }} />
                    </div>
                  </ScrollCard>
                )}

                {/* Contract info */}
                <div style={{ backgroundColor: STONE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '11px', color: MUTED, lineHeight: 2 }}>
                  <div>Contract: <span style={{ color: TEXT }}>{CONTRACT_ADDRESS}</span></div>
                  <div>Network: <span style={{ color: TEXT }}>GenLayer Bradbury · Chain 4221</span></div>
                  <div><a href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener" style={{ color: FIRE }}>View on Explorer ↗</a></div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Empty arena ──────────────────────────────────────────────────────────────
function EmptyArena({ icon, title, sub, children }: { icon: string; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <ScrollCard style={{ padding: '64px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '52px', marginBottom: '16px' }}>{icon}</div>
      <p style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: TORCH }}>{title}</p>
      <p style={{ color: MUTED, fontSize: '14px' }}>{sub}</p>
      {children}
    </ScrollCard>
  )
}

// ─── Battle Card ──────────────────────────────────────────────────────────────
function BattleCard({ debate, address, onJoin, onClick, loading, detailed = false }: {
  debate: Debate; address?: string; onJoin: () => void; onClick: () => void; loading: boolean; detailed?: boolean
}) {
  const isCreator = debate.creator === address
  const isOpponent = debate.opponent === address
  const isWinner = debate.winner === address
  const isDraw = debate.winner === 'DRAW'
  const cfg = STATUS_CONFIG[debate.status] ?? { label: debate.status, color: MUTED, icon: '•' }

  return (
    <div onClick={onClick} style={{ backgroundColor: CARD, border: `1px solid ${isWinner ? GOLD + '55' : BORDER}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: isWinner ? `0 0 24px ${GOLD}18, inset 0 0 24px ${GOLD}08` : 'none', position: 'relative', overflow: 'hidden' }}>
      {/* Fire top border for active battles */}
      {debate.status === 'ACTIVE' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${FIRE}, transparent)` }} />}
      {isWinner && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: MUTED, background: STONE, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>{debate.category}</span>
            <span style={{ fontSize: '10px', color: GOLD, background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: '4px', padding: '2px 7px', fontWeight: 700 }}>🔥 {debate.stake} glory each</span>
          </div>
          <p style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.3, color: TEXT, letterSpacing: '-0.01em' }}>{debate.topic}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, background: `${cfg.color}15`, border: `1px solid ${cfg.color}33`, borderRadius: '20px', padding: '4px 10px' }}>
          <span style={{ fontSize: '12px' }}>{cfg.icon}</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
        </div>
      </div>

      {/* Combatants */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: STONE, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '4px 10px' }}>
          <span style={{ fontSize: '12px' }}>🗡</span>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isCreator ? FIRE : TEXT }}>{shortAddr(debate.creator)}{isCreator ? ' (you)' : ''}</span>
        </div>
        {debate.opponent !== '0x0000000000000000000000000000000000000000' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: STONE, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '4px 10px' }}>
            <span style={{ fontSize: '12px' }}>⚔️</span>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isOpponent ? FIRE : TEXT }}>{shortAddr(debate.opponent)}{isOpponent ? ' (you)' : ''}</span>
          </div>
        )}
      </div>

      {/* Verdict */}
      {['FINISHED', 'CLAIMED', 'FINAL'].includes(debate.status) && debate.reasoning && (
        <div style={{ background: `${STONE}`, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 12px', borderLeft: `3px solid ${isWinner ? GOLD : isDraw ? SILVER : (isCreator || isOpponent) ? DEFEAT : MUTED}` }}>
          {isDraw ? <p style={{ fontSize: '12px', color: SILVER, fontWeight: 700, marginBottom: '4px' }}>⚔️ Honorable Draw — stakes returned</p>
            : isWinner ? <p style={{ fontSize: '12px', color: GOLD, fontWeight: 700, marginBottom: '4px' }}>🏆 Victory! {debate.claimed !== 'true' ? '— Claim your glory →' : 'Glory claimed ✓'}</p>
            : (isCreator || isOpponent) ? <p style={{ fontSize: '12px', color: DEFEAT, fontWeight: 700, marginBottom: '4px' }}>💀 Defeat</p>
            : <p style={{ fontSize: '12px', color: SILVER, fontWeight: 700, marginBottom: '4px' }}>Verdict: {shortAddr(debate.winner)} wins</p>}
          <p style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{debate.reasoning.slice(0, 120)}{debate.reasoning.length > 120 ? '…' : ''}</p>
        </div>
      )}

      {/* Join button */}
      {debate.status === 'OPEN' && !isCreator && address && (
        <button disabled={loading} onClick={e => { e.stopPropagation(); onJoin() }}
          style={{ width: '100%', background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit', boxShadow: `0 4px 16px ${FIRE}44` }}>
          ⚔️ Accept Challenge — Stake {debate.stake} Glory
        </button>
      )}

      {debate.status !== 'OPEN' && (
        <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>Tap to view full battle →</p>
      )}
    </div>
  )
}

// ─── Battle Modal ─────────────────────────────────────────────────────────────
function BattleModal({ debate: init, address, player, onClose, onAction, fetchDetail, loading }: {
  debate: Debate; address: string; player: Player | null
  onClose: () => void; onAction: (m: string, a: unknown[]) => Promise<boolean>
  fetchDetail: (id: string) => Promise<Debate | null>; loading: boolean
}) {
  const [debate, setDebate] = useState(init)
  const [arg, setArg] = useState('')
  const [showAppeal, setShowAppeal] = useState(false)
  const [appealText, setAppealText] = useState('')

  useEffect(() => {
    fetchDetail(init.debate_id).then(d => { if (d) setDebate(d) })
  }, [init.debate_id])

  const isCreator = debate.creator === address
  const isOpponent = debate.opponent === address
  const isParty = isCreator || isOpponent
  const isWinner = debate.winner === address
  const isDraw = debate.winner === 'DRAW'
  const hasMyArg = isCreator ? !!debate.creator_argument : !!debate.opponent_argument
  const cfg = STATUS_CONFIG[debate.status] ?? { label: debate.status, color: MUTED, icon: '•' }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,6,8,0.92)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '16px' }} onClick={onClose}>
      <div style={{ backgroundColor: STONE, border: `1px solid ${BORDER}`, borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
        {/* Fire top border */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <FireLine />
        </div>

        <div style={{ padding: '24px 22px 32px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div style={{ flex: 1, paddingRight: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px' }}>{cfg.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
                <span style={{ fontSize: '10px', color: MUTED }}>·</span>
                <span style={{ fontSize: '10px', color: MUTED }}>{debate.category}</span>
                <span style={{ fontSize: '10px', color: GOLD, fontWeight: 700 }}>· 🔥 {debate.stake} each · Winner gets {parseInt(debate.stake) * 2}</span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1.3, letterSpacing: '-0.02em', color: TEXT }}>{debate.topic}</h2>
            </div>
            <button onClick={onClose} style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED, fontSize: '16px', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}>✕</button>
          </div>

          {/* Combatants vs display */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'stretch', marginBottom: '16px' }}>
            {[
              { label: 'Challenger', addr: debate.creator, arg: debate.creator_argument, score: debate.creator_score, breakdown: debate.creator_score_breakdown, isMe: isCreator },
              { label: 'Defender', addr: debate.opponent, arg: debate.opponent_argument, score: debate.opponent_score, breakdown: debate.opponent_score_breakdown, isMe: isOpponent },
            ].map((p, i) => (
              <React.Fragment key={i}>
                {i === 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    <div style={{ fontSize: '20px', filter: `drop-shadow(0 0 8px ${FIRE})` }}>⚔️</div>
                  </div>
                )}
                <div style={{ backgroundColor: CARD, border: `1px solid ${debate.winner === p.addr && !isDraw ? GOLD + '55' : BORDER}`, borderRadius: '10px', padding: '14px', boxShadow: debate.winner === p.addr && !isDraw ? `0 0 20px ${GOLD}22` : 'none' }}>
                  <p style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '8px' }}>{p.label}</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '11px', color: p.isMe ? FIRE : TEXT, marginBottom: '8px' }}>{shortAddr(p.addr)}{p.isMe ? ' (you)' : ''}</p>
                  {p.score && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '30px', fontWeight: 900, color: TORCH, letterSpacing: '-0.03em', lineHeight: 1 }}>{p.score}</span>
                      <span style={{ fontSize: '14px', color: MUTED }}>/100</span>
                    </div>
                  )}
                  {debate.winner === p.addr && !isDraw && <p style={{ fontSize: '12px', color: GOLD, fontWeight: 700 }}>🏆 Victor</p>}
                  {isDraw && p.addr !== '0x0000000000000000000000000000000000000000' && <p style={{ fontSize: '12px', color: SILVER, fontWeight: 700 }}>⚔️ Draw</p>}
                  {!p.score && debate.status === 'ACTIVE' && p.addr !== '0x0000000000000000000000000000000000000000' && (
                    <p style={{ fontSize: '11px', color: FIRE }}>⏳ Awaiting argument…</p>
                  )}
                  {p.arg && isParty && (
                    <p style={{ fontSize: '11px', color: MUTED, marginTop: '8px', lineHeight: 1.55, borderTop: `1px solid ${BORDER}`, paddingTop: '8px' }}>{p.arg.slice(0, 120)}{p.arg.length > 120 ? '…' : ''}</p>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Verdict scroll */}
          {debate.reasoning && (
            <div style={{ background: `${BG}`, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px 18px', marginBottom: '16px', borderLeft: `3px solid ${FIRE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px' }}>📜</span>
                <span style={{ fontSize: '11px', color: TORCH, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Verdict of the Judges</span>
              </div>
              <p style={{ fontSize: '14px', color: TEXT, lineHeight: 1.7 }}>{debate.reasoning}</p>
              {debate.creator_score_breakdown && isParty && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
                  <p style={{ fontSize: '11px', color: MUTED, fontWeight: 600, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Detailed Breakdown</p>
                  <p style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6 }}>Challenger: {debate.creator_score_breakdown}</p>
                  <p style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6, marginTop: '4px' }}>Defender: {debate.opponent_score_breakdown}</p>
                </div>
              )}
              {debate.appeal_reasoning && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
                  <p style={{ fontSize: '11px', color: GOLD, fontWeight: 700, marginBottom: '4px' }}>Appeal Ruling: {debate.appeal_verdict}</p>
                  <p style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6 }}>{debate.appeal_reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Join */}
            {debate.status === 'OPEN' && !isCreator && (
              <button disabled={loading} onClick={() => { onAction('join_debate', [debate.debate_id]); onClose() }}
                style={{ background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit', boxShadow: `0 4px 20px ${FIRE}44` }}>
                ⚔️ Accept Challenge — Stake {debate.stake} Glory
              </button>
            )}

            {/* Submit argument */}
            {debate.status === 'ACTIVE' && isParty && !hasMyArg && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: `${FIRE}0A`, border: `1px solid ${FIRE}22`, borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: TORCH, lineHeight: 1.6 }}>
                  📜 Deliver your argument to the judges. When both fighters have spoken, deliberation begins. 1–3 minutes.
                </div>
                <textarea value={arg} onChange={e => setArg(e.target.value)}
                  placeholder="State your case. Judges score on logic (35pts), evidence (25pts), persuasiveness (25pts), and clarity (15pts). Make every word count."
                  style={{ ...inp, minHeight: '140px', resize: 'vertical', borderColor: arg.length > 0 ? FIRE + '55' : BORDER }} />
                <button disabled={loading || arg.trim().length < 20} onClick={() => { onAction('submit_argument', [debate.debate_id, arg]); onClose() }}
                  style={{ background: arg.trim().length >= 20 ? `linear-gradient(135deg, ${FIRE}, ${EMBER})` : CARD, color: arg.trim().length >= 20 ? '#fff' : MUTED, border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: 800, cursor: arg.trim().length >= 20 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: arg.trim().length >= 20 ? `0 4px 20px ${FIRE}44` : 'none' }}>
                  ⚔️ Deliver Argument to the Judges
                </button>
                <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>{arg.length} characters · minimum 20</p>
              </div>
            )}

            {/* Waiting for opponent */}
            {debate.status === 'ACTIVE' && isParty && hasMyArg && (
              <div style={{ background: `${VICTORY}0A`, border: `1px solid ${VICTORY}33`, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: VICTORY, fontWeight: 700 }}>✓ Your argument stands before the judges</p>
                <p style={{ fontSize: '12px', color: MUTED, marginTop: '4px' }}>Awaiting your opponent…</p>
              </div>
            )}

            {/* Claim glory */}
            {(debate.status === 'FINISHED' || debate.status === 'FINAL') && isWinner && !isDraw && debate.claimed !== 'true' && (
              <button disabled={loading} onClick={() => { onAction('claim_winnings', [debate.debate_id]); onClose() }}
                style={{ background: `linear-gradient(135deg, ${GOLD}, #D97706)`, color: '#000', border: 'none', borderRadius: '10px', padding: '16px', fontSize: '16px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit', boxShadow: `0 4px 24px ${GOLD}55`, letterSpacing: '-0.01em' }}>
                🏆 Claim {parseInt(debate.stake) * 2} Glory Points
              </button>
            )}

            {/* Cancel */}
            {debate.status === 'OPEN' && isCreator && (
              <button disabled={loading} onClick={() => { onAction('cancel_debate', [debate.debate_id]); onClose() }}
                style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '11px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Abandon Challenge (refunds stake)
              </button>
            )}

            {/* Appeal */}
            {(debate.status === 'FINISHED') && isParty && !isWinner && !isDraw && !debate.appeal_grounds && (
              !showAppeal ? (
                <button onClick={() => setShowAppeal(true)} style={{ background: 'transparent', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '10px', padding: '11px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  📜 Appeal to the High Court (costs {APPEAL_COST} glory)
                </button>
              ) : (
                <div style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}33`, borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ fontSize: '12px', color: GOLD, fontWeight: 600 }}>The High Court upholds verdicts unless clear error is shown:</p>
                  <textarea value={appealText} onChange={e => setAppealText(e.target.value)} placeholder="What specific error did the judges make? Present your evidence clearly." style={{ ...inp, minHeight: '80px', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button disabled={loading || !appealText.trim()} onClick={() => { onAction('appeal_verdict', [debate.debate_id, appealText]); setShowAppeal(false); onClose() }}
                      style={{ flex: 1, background: `linear-gradient(135deg, ${GOLD}, #D97706)`, color: '#000', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', opacity: appealText.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>
                      File Appeal
                    </button>
                    <button onClick={() => setShowAppeal(false)} style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({ player, onClose, onSubmit, loading }: {
  player: Player; onClose: () => void; onSubmit: (t: string, s: string, c: string) => void; loading: boolean
}) {
  const [topic, setTopic] = useState('')
  const [stake, setStake] = useState('10')
  const [cat, setCat] = useState('General')
  const max = Math.min(MAX_STAKE, parseInt(player.points))
  const ok = topic.trim().length >= 10 && parseInt(stake) >= MIN_STAKE && parseInt(stake) <= max

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,6,8,0.92)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div style={{ backgroundColor: STONE, border: `1px solid ${BORDER}`, borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ position: 'sticky', top: 0 }}><FireLine /></div>
        <div style={{ padding: '24px 22px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>⚔️ Issue a Challenge</h2>
              <p style={{ fontSize: '12px', color: MUTED, marginTop: '3px' }}>Name your battleground. Set the stakes.</p>
            </div>
            <button onClick={onClose} style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED, fontSize: '16px', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
          </div>
          <div style={{ background: `${FIRE}0A`, border: `1px solid ${FIRE}22`, borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: TORCH, marginBottom: '20px', lineHeight: 1.6 }}>
            📜 The judges will verify your topic is fair before the challenge goes live.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: MUTED, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>The Challenge *</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Remote work is more productive than office work" style={{ ...inp, borderColor: topic.length >= 10 ? FIRE + '44' : BORDER }} />
              <p style={{ fontSize: '11px', color: MUTED, marginTop: '5px' }}>{topic.length} characters · minimum 10</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: MUTED, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Glory at Stake <span style={{ color: GOLD }}>· {player.points} available</span></label>
                <input type="number" min={MIN_STAKE} max={max} value={stake} onChange={e => setStake(e.target.value)} style={{ ...inp, borderColor: ok ? FIRE + '44' : BORDER }} />
                <p style={{ fontSize: '11px', color: MUTED, marginTop: '5px' }}>Victor claims {parseInt(stake || '0') * 2} glory</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: MUTED, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Battle Category</label>
                <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <button disabled={loading || !ok} onClick={() => onSubmit(topic, stake, cat)}
              style={{ background: ok ? `linear-gradient(135deg, ${FIRE}, ${EMBER})` : CARD, color: ok ? '#fff' : MUTED, border: 'none', borderRadius: '10px', padding: '15px', fontSize: '15px', fontWeight: 800, cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: ok ? `0 4px 20px ${FIRE}44` : 'none' }}>
              ⚔️ Issue Challenge
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Register Modal ───────────────────────────────────────────────────────────
function RegisterModal({ onClose, onSubmit, loading }: {
  onClose: () => void; onSubmit: (u: string) => void; loading: boolean
}) {
  const [username, setUsername] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,6,8,0.94)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div style={{ backgroundColor: STONE, border: `1px solid ${FIRE}44`, borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: `0 0 60px ${FIRE}22, 0 0 120px ${EMBER}11` }} onClick={e => e.stopPropagation()}>
        <FireLine />
        <div style={{ padding: '36px 28px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', filter: `drop-shadow(0 0 30px ${FIRE}88)` }}>⚔️</div>
          <h2 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '10px', background: `linear-gradient(135deg, ${TORCH}, ${FIRE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Enter the Colosseum
          </h2>
          <p style={{ color: MUTED, fontSize: '15px', lineHeight: 1.65, marginBottom: '28px' }}>
            Register as a gladiator and receive<br /><strong style={{ color: GOLD }}>50 glory points</strong> to enter your first battle.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: MUTED, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gladiator Name <span style={{ color: MUTED, fontWeight: 400, textTransform: 'none' }}>(optional · max 20)</span></label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. IronTongue, LogicBlade…" maxLength={20} style={inp} />
            </div>
            <button disabled={loading} onClick={() => onSubmit(username)}
              style={{ background: `linear-gradient(135deg, ${FIRE}, ${EMBER})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '15px', fontSize: '16px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit', boxShadow: `0 4px 24px ${FIRE}55` }}>
              ⚔️ Enter as Gladiator — {STARTING_POINTS} Glory Free
            </button>
            <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>Signs a transaction on GenLayer Bradbury Testnet</p>
          </div>
        </div>
      </div>
    </div>
  )
}
