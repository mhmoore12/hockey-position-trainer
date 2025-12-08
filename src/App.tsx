import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Position = { x: number; y: number }
type PlayerRole = 'LW' | 'RW' | 'LD' | 'RD'
type FaceoffWing = 'LW' | 'RW'
type TeamSide = 'left' | 'right'

type PlayerState = {
  role: PlayerRole
  pos: Position
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const mix = (start: Position, target: Position, bias: number): Position => ({
  x: start.x + (target.x - start.x) * bias,
  y: start.y + (target.y - start.y) * bias,
})

const defaultPuck: Position = { x: 0.5, y: 0.5 }

const neutralFaceoffLayout = (faceoffWing: FaceoffWing): Record<PlayerRole, Position> => {
  if (faceoffWing === 'LW') {
    return {
      LW: { x: 0.49, y: 0.5 },
      RW: { x: 0.45, y: 0.67 },
      LD: { x: 0.27, y: 0.4 },
      RD: { x: 0.27, y: 0.64 },
    }
  }

  return {
    RW: { x: 0.49, y: 0.5 },
    LW: { x: 0.45, y: 0.33 },
    LD: { x: 0.27, y: 0.36 },
    RD: { x: 0.27, y: 0.6 },
  }
}

const strategyForLeftTeam = (
  puck: Position,
  faceoffWing: FaceoffWing,
): Record<PlayerRole, Position> => {
  const base = neutralFaceoffLayout(faceoffWing)

  const inOffense = puck.x > 0.55
  const inDefense = puck.x < 0.45
  const nearTop = puck.y < 0.5

  if (!inOffense && !inDefense) {
    return base
  }

  if (inOffense) {
    const puckTarget: Position = {
      x: clamp(puck.x, 0.72, 0.95),
      y: clamp(puck.y, 0.12, 0.88),
    }

    const chasing: PlayerRole = nearTop ? 'LW' : 'RW'
    const supportWing: PlayerRole = chasing === 'LW' ? 'RW' : 'LW'
    const netFront: Position = { x: 0.9, y: 0.5 }
    const defenseLineX = 0.68
    const strongSide: PlayerRole = nearTop ? 'LD' : 'RD'
    const weakSide: PlayerRole = strongSide === 'LD' ? 'RD' : 'LD'

    const entering = puck.x >= 0.55 && puck.x <= 0.72

    if (entering) {
      const wingHighLane = 0.3
      const wingLowLane = 0.7
      const wingEntryX = clamp(puck.x + 0.04, 0.6, 0.78)
      const puckSideWing: PlayerRole = nearTop ? 'LW' : 'RW'
      const offWing: PlayerRole = puckSideWing === 'LW' ? 'RW' : 'LW'
      const puckSideLane = nearTop ? wingHighLane : wingLowLane
      const offLane = nearTop ? wingLowLane : wingHighLane

      return {
        ...base,
        [puckSideWing]: { x: wingEntryX, y: puckSideLane },
        [offWing]: { x: wingEntryX - 0.05, y: offLane },
        LD: { x: wingEntryX - 0.1, y: wingHighLane },
        RD: { x: wingEntryX - 0.1, y: wingLowLane },
      }
    }

    return {
      ...base,
      [chasing]: mix(base[chasing], { x: puckTarget.x - 0.015, y: puckTarget.y }, 0.9),
      [supportWing]: mix(
        base[supportWing],
        { x: netFront.x, y: mix(puckTarget, { x: puckTarget.x, y: 0.5 }, 0.35).y },
        0.9,
      ),
      LD: { x: defenseLineX, y: clamp(puckTarget.y - 0.12, 0.22, 0.82) },
      RD: { x: defenseLineX, y: clamp(puckTarget.y + 0.12, 0.18, 0.78) },
      [strongSide]: {
        x: defenseLineX + 0.012,
        y: clamp(puckTarget.y, 0.1, 0.9),
      },
      [weakSide]: {
        x: defenseLineX - 0.02,
        y: clamp(mix(puckTarget, { x: puckTarget.x, y: 0.5 }, 0.55).y, 0.24, 0.76),
      },
    }
  }

  // Defensive posture
  const corner = puck.x < 0.18 && (puck.y < 0.32 || puck.y > 0.68)
  const primaryDefense: PlayerRole = nearTop ? 'LD' : 'RD'
  const secondaryDefense: PlayerRole = primaryDefense === 'LD' ? 'RD' : 'LD'
  const engageSpot: Position = {
    x: clamp(puck.x + 0.03, 0.08, 0.3),
    y: clamp(puck.y, 0.12, 0.88),
  }

  const secondarySpot: Position = corner
    ? { x: clamp(engageSpot.x + 0.05, 0.12, 0.32), y: mix(engageSpot, { x: engageSpot.x, y: 0.5 }, 0.6).y }
    : { x: 0.12, y: 0.5 }

  return {
    ...base,
    [primaryDefense]: engageSpot,
    [secondaryDefense]: secondarySpot,
    LW: { x: 0.3, y: 0.38 },
    RW: { x: 0.3, y: 0.62 },
  }
}

const getTeamPositions = (
  side: TeamSide,
  puck: Position,
  faceoffWing: FaceoffWing,
): PlayerState[] => {
  const mirror = (pos: Position): Position => ({ x: 1 - pos.x, y: pos.y })
  const apply = strategyForLeftTeam(
    side === 'left' ? puck : mirror(puck),
    faceoffWing,
  )

  return (Object.keys(apply) as PlayerRole[]).map((role) => ({
    role,
    pos: side === 'left' ? apply[role] : mirror(apply[role]),
  }))
}

const goaliePosition = (side: TeamSide, puck: Position): Position => {
  const baseX = side === 'left' ? 0.061 : 0.939 // centers align with smaller creases
  const y = clamp(puck.y, 0.43, 0.57) // keep inside reduced crease height
  return {
    x: baseX,
    y,
  }
}

const Player = ({ player, color }: { player: PlayerState; color: string }) => {
  return (
    <div
      className="player"
      style={{
        left: `${player.pos.x * 100}%`,
        top: `${player.pos.y * 100}%`,
        background: color,
      }}
    >
      {player.role}
    </div>
  )
}

const RinkGraphic = () => (
  <svg className="rink-svg" viewBox="0 0 1400 1000" role="presentation" aria-hidden="true">
    <defs>
      <linearGradient id="ice" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f6fbff" />
        <stop offset="100%" stopColor="#e7f1fb" />
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="1380" height="980" rx="140" fill="url(#ice)" stroke="#0d1b2a" strokeWidth="12" />
    <line x1="700" y1="40" x2="700" y2="960" stroke="#ba0c2f" strokeWidth="8" />
    <line x1="70" y1="500" x2="1330" y2="500" stroke="#1d4ed8" strokeWidth="6" opacity="0.4" />
    <circle cx="700" cy="500" r="90" fill="none" stroke="#ba0c2f" strokeWidth="6" opacity="0.7" />
    <circle cx="700" cy="500" r="10" fill="#0b0b0b" opacity="0.6" />
    <circle cx="350" cy="500" r="70" fill="none" stroke="#1d4ed8" strokeWidth="6" opacity="0.5" />
    <circle cx="1050" cy="500" r="70" fill="none" stroke="#1d4ed8" strokeWidth="6" opacity="0.5" />
    <circle cx="350" cy="500" r="6" fill="#ba0c2f" opacity="0.8" />
    <circle cx="1050" cy="500" r="6" fill="#ba0c2f" opacity="0.8" />
    <rect x="67" y="428" width="36" height="144" rx="9" fill="none" stroke="#ba0c2f" strokeWidth="6" opacity="0.7" />
    <rect x="1297" y="428" width="36" height="144" rx="9" fill="none" stroke="#ba0c2f" strokeWidth="6" opacity="0.7" />
    <circle cx="120" cy="500" r="24" fill="none" stroke="#1d4ed8" strokeWidth="4" opacity="0.6" />
    <circle cx="1280" cy="500" r="24" fill="none" stroke="#1d4ed8" strokeWidth="4" opacity="0.6" />
  </svg>
)

function App() {
  const [puck, setPuck] = useState<Position>(defaultPuck)
  const [isDragging, setIsDragging] = useState(false)
  const [faceoffWing, setFaceoffWing] = useState<FaceoffWing>('LW')
  const rinkRef = useRef<HTMLDivElement | null>(null)

  const home = useMemo(() => getTeamPositions('left', puck, faceoffWing), [puck, faceoffWing])
  const away = useMemo(() => getTeamPositions('right', puck, faceoffWing), [puck, faceoffWing])
  const homeGoalie = useMemo(() => goaliePosition('left', puck), [puck])
  const awayGoalie = useMemo(() => goaliePosition('right', puck), [puck])

  useEffect(() => {
    const handleUp = () => setIsDragging(false)
    window.addEventListener('pointerup', handleUp)
    return () => window.removeEventListener('pointerup', handleUp)
  }, [])

  const updatePuckFromPointer = (clientX: number, clientY: number) => {
    const rink = rinkRef.current
    if (!rink) return
    const rect = rink.getBoundingClientRect()
    const x = clamp((clientX - rect.left) / rect.width, 0.02, 0.98)
    const y = clamp((clientY - rect.top) / rect.height, 0.04, 0.96)
    setPuck({ x, y })
  }

  return (
    <div className="page">
      <header className="bar">
        <div>
          <h1>Half-Rink 4v4 Trainer</h1>
          <p>Drag the puck to see both squads react using the EU Dragons rules.</p>
        </div>
        <div className="controls">
          <label className="control">
            Faceoff taker
            <select
              value={faceoffWing}
              onChange={(e) => setFaceoffWing(e.target.value as FaceoffWing)}
            >
              <option value="LW">Left Wing</option>
              <option value="RW">Right Wing</option>
            </select>
          </label>
          <button
            className="ghost"
            onClick={() => {
              setPuck(defaultPuck)
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="board-panel">
          <div
            ref={rinkRef}
            className="rink"
            onPointerMove={(e) => isDragging && updatePuckFromPointer(e.clientX, e.clientY)}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).classList.contains('puck')) {
                setIsDragging(true)
              }
            }}
          >
            <RinkGraphic />
            <div
              className={`puck ${isDragging ? 'active' : ''}`}
              style={{ left: `${puck.x * 100}%`, top: `${puck.y * 100}%` }}
              onPointerDown={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
            />
            <div
              className="goalie goalie-home"
              style={{ left: `${homeGoalie.x * 100}%`, top: `${homeGoalie.y * 100}%` }}
            >
              G
            </div>
            <div
              className="goalie goalie-away"
              style={{ left: `${awayGoalie.x * 100}%`, top: `${awayGoalie.y * 100}%` }}
            >
              G
            </div>
            {home.map((p) => (
              <Player key={`home-${p.role}`} player={p} color="#2f9e44" />
            ))}
            {away.map((p) => (
              <Player key={`away-${p.role}`} player={p} color="#e03131" />
            ))}
            <div className="legend legend-home">Home / Green</div>
            <div className="legend legend-away">Away / Red</div>
          </div>
        </section>
        <section className="info">
      <h3>How they move</h3>
      <ul>
        <li>Faceoff: set whether LW or RW takes the draw; both teams mirror that.</li>
        <li>
          Offense: corner puck = wing on that side goes; other wing net-front; D holds blue line
          and shifts to puck lane.
        </li>
        <li>
          Defense: corner puck = both D battle; wings protect slot/outlet.
        </li>
        <li>Reset brings the puck to center ice and re-centers everyone.</li>
      </ul>
      <p className="note">Rules pulled from Positions.pdf (EU Dragons practice plan).</p>
    </section>
      </main>
    </div>
  )
}

export default App
