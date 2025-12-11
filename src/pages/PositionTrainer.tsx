import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";

type Position = { x: number; y: number };
type PlayerRole = "LW" | "RW" | "LD" | "RD";
type FaceoffWing = "LW" | "RW";
type TeamSide = "left" | "right";

type PlayerState = {
  role: PlayerRole;
  pos: Position;
};

type Narrative = {
  title: string;
  zone: string;
  points: string[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const mix = (start: Position, target: Position, bias: number): Position => ({
  x: start.x + (target.x - start.x) * bias,
  y: start.y + (target.y - start.y) * bias,
});

const defaultPuck: Position = { x: 0.5, y: 0.5 };

const neutralFaceoffLayout = (
  faceoffWing: FaceoffWing
): Record<PlayerRole, Position> => {
  if (faceoffWing === "LW") {
    return {
      LW: { x: 0.49, y: 0.5 },
      RW: { x: 0.45, y: 0.67 },
      LD: { x: 0.27, y: 0.4 },
      RD: { x: 0.27, y: 0.64 },
    };
  }

  return {
    RW: { x: 0.49, y: 0.5 },
    LW: { x: 0.45, y: 0.33 },
    LD: { x: 0.27, y: 0.36 },
    RD: { x: 0.27, y: 0.6 },
  };
};

const strategyForLeftTeam = (
  puck: Position,
  faceoffWing: FaceoffWing
): Record<PlayerRole, Position> => {
  const base = neutralFaceoffLayout(faceoffWing);

  const inOffense = puck.x > 0.55;
  const inDefense = puck.x < 0.45;
  const nearTop = puck.y < 0.5;
  const neutralBoard =
    !inOffense && !inDefense && (puck.y < 0.33 || puck.y > 0.67);

  if (!inOffense && !inDefense && !neutralBoard) {
    return base;
  }

  if (neutralBoard) {
    const chasing: PlayerRole = nearTop ? "LW" : "RW";
    const supportWing: PlayerRole = chasing === "LW" ? "RW" : "LW";
    const strongSideD: PlayerRole = nearTop ? "LD" : "RD";
    const weakSideD: PlayerRole = strongSideD === "LD" ? "RD" : "LD";

    return {
      ...base,
      [chasing]: {
        x: clamp(puck.x + 0.02, 0.42, 0.58),
        y: clamp(puck.y, 0.08, 0.92),
      },
      [supportWing]: {
        x: 0.52,
        y: 0.5,
      },
      [strongSideD]: {
        x: 0.34,
        y: clamp(puck.y, 0.16, 0.84),
      },
      [weakSideD]: {
        x: 0.32,
        y: 0.5,
      },
    };
  }

  if (inOffense) {
    const puckTarget: Position = {
      x: clamp(puck.x, 0.72, 0.95),
      y: clamp(puck.y, 0.12, 0.88),
    };

    const chasing: PlayerRole = nearTop ? "LW" : "RW";
    const supportWing: PlayerRole = chasing === "LW" ? "RW" : "LW";
    const netFront: Position = { x: 0.9, y: 0.5 };
    const strongX = 0.7;
    const weakX = 0.62;
    const strongSide: PlayerRole = nearTop ? "LD" : "RD";
    const weakSide: PlayerRole = strongSide === "LD" ? "RD" : "LD";
    const nearNet = puckTarget.x > 0.88 && Math.abs(puckTarget.y - 0.5) < 0.2;

    const entering = puck.x >= 0.55 && puck.x <= 0.72;

    if (entering) {
      const wingHighLane = 0.3;
      const wingLowLane = 0.7;
      const wingEntryX = clamp(puck.x + 0.04, 0.6, 0.78);
      const puckSideWing: PlayerRole = nearTop ? "LW" : "RW";
      const offWing: PlayerRole = puckSideWing === "LW" ? "RW" : "LW";

      return {
        ...base,
        [puckSideWing]: {
          x: clamp(puck.x, 0.55, 0.82),
          y: clamp(puck.y, 0.1, 0.9),
        },
        [offWing]: { x: wingEntryX - 0.05, y: 0.5 },
        LD: { x: wingEntryX - 0.1, y: wingHighLane },
        RD: { x: wingEntryX - 0.1, y: wingLowLane },
      };
    }

    const defensePositions = nearNet
      ? {
          LD: { x: strongX, y: 0.36 },
          RD: { x: strongX, y: 0.64 },
        }
      : {
          [strongSide]: {
            x: strongX,
            y: clamp(puckTarget.y, 0.2, 0.8),
          },
          [weakSide]: {
            x: weakX,
            y: clamp(
              mix(puckTarget, { x: puckTarget.x, y: 0.5 }, 0.6).y,
              0.22,
              0.78
            ),
          },
        };

    return {
      ...base,
      [chasing]: mix(
        base[chasing],
        { x: puckTarget.x - 0.015, y: puckTarget.y },
        0.9
      ),
      [supportWing]: mix(
        base[supportWing],
        {
          x: netFront.x,
          y: mix(puckTarget, { x: puckTarget.x, y: 0.5 }, 0.35).y,
        },
        0.9
      ),
      ...defensePositions,
    };
  }

  // Defensive posture
  const corner = puck.x < 0.18 && (puck.y < 0.32 || puck.y > 0.68);
  const primaryDefense: PlayerRole = nearTop ? "LD" : "RD";
  const secondaryDefense: PlayerRole = primaryDefense === "LD" ? "RD" : "LD";
  const engageSpot: Position = {
    x: clamp(puck.x + 0.03, 0.08, 0.3),
    y: clamp(puck.y, 0.12, 0.88),
  };

  const secondarySpot: Position = corner
    ? {
        x: clamp(engageSpot.x + 0.05, 0.12, 0.32),
        y: mix(engageSpot, { x: engageSpot.x, y: 0.5 }, 0.6).y,
      }
    : { x: 0.12, y: 0.5 };
  const wingCenterY = clamp(puck.y, 0.15, 0.85);
  const wingOffset = 0.14;

  return {
    ...base,
    [primaryDefense]: engageSpot,
    [secondaryDefense]: secondarySpot,
    LW: { x: 0.3, y: clamp(wingCenterY - wingOffset, 0.12, 0.88) },
    RW: { x: 0.3, y: clamp(wingCenterY + wingOffset, 0.12, 0.88) },
  };
};

const getTeamPositions = (
  side: TeamSide,
  puck: Position,
  faceoffWing: FaceoffWing
): PlayerState[] => {
  const neutralBoardGlobal =
    puck.x >= 0.45 && puck.x <= 0.55 && (puck.y < 0.33 || puck.y > 0.67);
  const mirror = (pos: Position): Position => ({ x: 1 - pos.x, y: pos.y });
  const apply = strategyForLeftTeam(
    side === "left" ? puck : mirror(puck),
    faceoffWing
  );

  return (Object.keys(apply) as PlayerRole[]).map((role) => ({
    role,
    pos: (() => {
      const base = side === "left" ? apply[role] : mirror(apply[role]);
      if (!neutralBoardGlobal || (role !== "LW" && role !== "RW")) return base;
      return { ...base, x: 1 - base.x };
    })(),
  }));
};

const goaliePosition = (side: TeamSide, puck: Position): Position => {
  const baseX = side === "left" ? 0.061 : 0.939;
  const y = clamp(puck.y, 0.43, 0.57);
  return {
    x: baseX,
    y,
  };
};

const boardLabel = (y: number) => {
  if (y < 0.33) return "left boards";
  if (y > 0.67) return "right boards";
  return "slot/center lane";
};

const zoneLabel = (x: number) => {
  if (x > 0.55) return "Offense";
  if (x < 0.45) return "Defense";
  return "Neutral ice";
};

const getNarrative = (
  side: TeamSide,
  puck: Position,
  faceoffWing: FaceoffWing
): Narrative => {
  const team = side === "left" ? "Green" : "Red";
  const local = side === "left" ? puck : { x: 1 - puck.x, y: puck.y };
  const inOffense = local.x > 0.55;
  const inDefense = local.x < 0.45;
  const entering = local.x >= 0.55 && local.x <= 0.72;
  const nearTop = local.y < 0.5;
  const neutralBoard =
    !inOffense && !inDefense && (local.y < 0.33 || local.y > 0.67);
  const puckSideWing: PlayerRole = nearTop ? "LW" : "RW";
  const offWing: PlayerRole = puckSideWing === "LW" ? "RW" : "LW";
  const strongSideD: PlayerRole = nearTop ? "LD" : "RD";
  const weakSideD: PlayerRole = strongSideD === "LD" ? "RD" : "LD";
  const sideText = boardLabel(local.y);

  const points: string[] = [];

  if (entering) {
    points.push(
      `${team} ${puckSideWing}: entering wide on the ${sideText}, carrying speed.`
    );
    points.push(
      `${team} ${offWing}: fills the opposite lane, ready for a cross or rebound.`
    );
    points.push(
      `${team} ${strongSideD}: trails just outside the puck-side lane to hold the line.`
    );
    points.push(
      `${team} ${weakSideD}: trails inside the off-lane for support and middle coverage.`
    );
  } else if (inOffense) {
    points.push(`${team} ${puckSideWing}: presses puck on the ${sideText}.`);
    points.push(`${team} ${offWing}: sets net-front for tips/rebounds.`);
    points.push(
      `${team} ${strongSideD}: at the blue, pinching the wall to keep it in.`
    );
    points.push(
      `${team} ${weakSideD}: blue-line middle, ready to slide or retrieve clears.`
    );
  } else if (neutralBoard) {
    points.push(
      `${team} ${puckSideWing}: jumps to the puck on the ${sideText} in neutral ice.`
    );
    points.push(
      `${team} ${offWing}: holds center ice as an outlet or to cut off the middle.`
    );
    points.push(
      `${team} ${strongSideD}: shifts toward the ${sideText} to support and hold the wall.`
    );
    points.push(
      `${team} ${weakSideD}: stays middle for back-up and quick retrievals.`
    );
  } else if (inDefense) {
    points.push(
      `${team} ${strongSideD}: engages puck on the ${sideText}, winning possession.`
    );
    points.push(
      `${team} ${weakSideD}: close support, staying inside the dots.`
    );
    points.push(
      `${team} ${puckSideWing}: protects slot and is an outlet up the wall.`
    );
    points.push(`${team} ${offWing}: guards middle ice, ready to spring out.`);
  } else {
    points.push(
      `${team} ${faceoffWing}: taking the draw; opposite wing ready to crash or cover.`
    );
    points.push(
      `${team} ${offWing}: staggered behind, ready to jump to their side.`
    );
    points.push(`${team} LD/RD: halfway back, balanced to either blue line.`);
    points.push(
      `${team} goalie: set in the crease, tracking the puck side-to-side.`
    );
  }

  return {
    title: `${team} positioning`,
    zone: zoneLabel(local.x),
    points,
  };
};

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
  );
};

const RinkGraphic = () => (
  <svg
    className="rink-svg"
    viewBox="0 0 1400 1000"
    role="presentation"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="ice" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f6fbff" />
        <stop offset="100%" stopColor="#e7f1fb" />
      </linearGradient>
    </defs>
    <rect
      x="10"
      y="10"
      width="1380"
      height="980"
      rx="140"
      fill="url(#ice)"
      stroke="#0d1b2a"
      strokeWidth="12"
    />
    <line x1="700" y1="40" x2="700" y2="960" stroke="#ba0c2f" strokeWidth="8" />
    <line
      x1="70"
      y1="500"
      x2="1330"
      y2="500"
      stroke="#1d4ed8"
      strokeWidth="6"
      opacity="0.4"
    />
    <line x1="466" y1="40" x2="466" y2="960" stroke="#5ec8c2" strokeWidth="4" strokeDasharray="18 10" opacity="0.6" />
    <line x1="934" y1="40" x2="934" y2="960" stroke="#5ec8c2" strokeWidth="4" strokeDasharray="18 10" opacity="0.6" />
    <circle
      cx="700"
      cy="500"
      r="90"
      fill="none"
      stroke="#ba0c2f"
      strokeWidth="6"
      opacity="0.7"
    />
    <circle cx="700" cy="500" r="10" fill="#0b0b0b" opacity="0.6" />
    <rect
      x="67"
      y="428"
      width="36"
      height="144"
      rx="9"
      fill="none"
      stroke="#ba0c2f"
      strokeWidth="6"
      opacity="0.7"
    />
    <rect
      x="1297"
      y="428"
      width="36"
      height="144"
      rx="9"
      fill="none"
      stroke="#ba0c2f"
      strokeWidth="6"
      opacity="0.7"
    />
    <circle
      cx="120"
      cy="500"
      r="24"
      fill="none"
      stroke="#1d4ed8"
      strokeWidth="4"
      opacity="0.6"
    />
    <circle
      cx="1280"
      cy="500"
      r="24"
      fill="none"
      stroke="#1d4ed8"
      strokeWidth="4"
      opacity="0.6"
    />
  </svg>
);

const PositionTrainerPage = () => {
  const [puck, setPuck] = useState<Position>(defaultPuck);
  const [isDragging, setIsDragging] = useState(false);
  const [faceoffWing, setFaceoffWing] = useState<FaceoffWing>("LW");
  const rinkRef = useRef<HTMLDivElement | null>(null);

  const home = useMemo(
    () => getTeamPositions("left", puck, faceoffWing),
    [puck, faceoffWing]
  );
  const away = useMemo(
    () => getTeamPositions("right", puck, faceoffWing),
    [puck, faceoffWing]
  );
  const homeGoalie = useMemo(() => goaliePosition("left", puck), [puck]);
  const awayGoalie = useMemo(() => goaliePosition("right", puck), [puck]);
  const greenNarrative = useMemo(
    () => getNarrative("left", puck, faceoffWing),
    [puck, faceoffWing]
  );
  const redNarrative = useMemo(
    () => getNarrative("right", puck, faceoffWing),
    [puck, faceoffWing]
  );

  useEffect(() => {
    const handleUp = () => setIsDragging(false);
    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, []);

  const updatePuckFromPointer = (clientX: number, clientY: number) => {
    const rink = rinkRef.current;
    if (!rink) return;
    const rect = rink.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0.02, 0.98);
    const y = clamp((clientY - rect.top) / rect.height, 0.04, 0.96);
    setPuck({ x, y });
  };

  return (
    <div className="page position-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Half-rink 4v4 trainer</p>
          <h1>Position reactions</h1>
          <p className="hero-subline">
            Drag the puck to see both squads react. Faceoff side mirrors for
            each team.
          </p>
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
              setPuck(defaultPuck);
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="narrative narrative-green">
          <div className="narrative-header">
            <h3>{greenNarrative.title}</h3>
            <span
              className={`chip ${
                greenNarrative.zone === "Offense"
                  ? "chip-hot"
                  : greenNarrative.zone === "Defense"
                  ? "chip-cool"
                  : "chip-neutral"
              }`}
            >
              {greenNarrative.zone}
            </span>
          </div>
          <ul className="narrative-list">
            {greenNarrative.points.map((p, idx) => (
              <li key={idx}>{p}</li>
            ))}
          </ul>
        </section>

        <section className="narrative narrative-red">
          <div className="narrative-header">
            <h3>{redNarrative.title}</h3>
            <span
              className={`chip ${
                redNarrative.zone === "Offense"
                  ? "chip-hot"
                  : redNarrative.zone === "Defense"
                  ? "chip-cool"
                  : "chip-neutral"
              }`}
            >
              {redNarrative.zone}
            </span>
          </div>
          <ul className="narrative-list">
            {redNarrative.points.map((p, idx) => (
              <li key={idx}>{p}</li>
            ))}
          </ul>
        </section>

        <section className="board-panel">
          <div
            ref={rinkRef}
            className="rink"
            onPointerMove={(e) =>
              isDragging && updatePuckFromPointer(e.clientX, e.clientY)
            }
            onPointerDown={(e) => {
              updatePuckFromPointer(e.clientX, e.clientY);
              setIsDragging(true);
            }}
          >
            <RinkGraphic />
            <div
              className={`puck ${isDragging ? "active" : ""}`}
              style={{ left: `${puck.x * 100}%`, top: `${puck.y * 100}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
            />
            <div
              className="goalie goalie-home"
              style={{
                left: `${homeGoalie.x * 100}%`,
                top: `${homeGoalie.y * 100}%`,
              }}
            >
              G
            </div>
            <div
              className="goalie goalie-away"
              style={{
                left: `${awayGoalie.x * 100}%`,
                top: `${awayGoalie.y * 100}%`,
              }}
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
        <section className="info info-wide">
          <h3>How they move</h3>
          <ul>
            <li>
              Faceoff: set whether LW or RW takes the draw; both teams mirror
              that.
            </li>
            <li>
              Offense: corner puck = wing on that side goes; other wing
              net-front; D holds blue line and shifts to puck lane.
            </li>
            <li>
              Neutral boards: strong-side wing pressures; far wing holds center;
              D shifts strong side.
            </li>
            <li>
              Defense: corner puck = both D battle; wings protect slot/outlet.
            </li>
            <li>
              Reset brings the puck to center ice and re-centers everyone.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default PositionTrainerPage;
