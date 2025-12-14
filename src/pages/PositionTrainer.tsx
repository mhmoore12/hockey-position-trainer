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
    const puckSideWing: PlayerRole = nearTop ? "LW" : "RW";
    const supportWing: PlayerRole = puckSideWing === "LW" ? "RW" : "LW";
    const isRightLane = puck.y >= 0.5;
    const wingLaneY =
      puckSideWing === "LW"
        ? clamp(puck.y, 0.22, 0.48)
        : clamp(puck.y, 0.52, 0.78);
    const supportY =
      puckSideWing === "RW" && isRightLane
        ? 0.41 // halfway between center (~0.5) and boards (~0.33) for LW support when puck right
        : supportWing === "LW"
        ? 0.32
        : 0.68;
    return {
      ...base,
      [puckSideWing]: {
        x: clamp(puck.x + 0.015, 0.46, 0.58),
        y: wingLaneY,
      },
      [supportWing]: {
        x: 0.62,
        y: supportY,
      },
      LD: { ...base.LD, x: 0.34 },
      RD: { ...base.RD, x: 0.34 },
    };
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
    const strongX = 0.66;
    const weakX = 0.58;
    const strongSide: PlayerRole = nearTop ? "LD" : "RD";
    const weakSide: PlayerRole = strongSide === "LD" ? "RD" : "LD";
    const nearNet = puckTarget.x > 0.88 && Math.abs(puckTarget.y - 0.5) < 0.2;

    const entering = puck.x >= 0.55 && puck.x <= 0.72;
    const lowPuck = puckTarget.x > 0.88 || puckTarget.y < 0.2 || puckTarget.y > 0.8;
    const cornerPuck = puckTarget.x > 0.9 && (puckTarget.y < 0.22 || puckTarget.y > 0.78);

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
        LD: { x: wingEntryX - 0.15, y: wingHighLane },
        RD: { x: wingEntryX - 0.15, y: wingLowLane },
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
        {
          x: clamp(puckTarget.x, 0, 1),
          y: puckTarget.y,
        },
        cornerPuck ? 0.98 : lowPuck ? 0.97 : 0.95
      ),
      [supportWing]: mix(
        base[supportWing],
        {
          x: netFront.x,
          y: mix(puckTarget, { x: puckTarget.x, y: 0.5 }, 0.45).y,
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
    x: clamp(puck.x - 0.02, 0.1, 0.22),
    y: clamp(puck.y * 0.9 + 0.05, 0.1, 0.82),
  };

  const secondarySpot: Position = corner
    ? {
        x: clamp(engageSpot.x + 0.05, 0.12, 0.32),
        y: mix(engageSpot, { x: engageSpot.x, y: 0.5 }, 0.6).y,
      }
    : { x: 0.12, y: 0.5 };
  const wingCenterY = clamp(puck.y, 0.15, 0.85);
  const wingOffset = 0.18;
  const wingX = 0.36;

  return {
    ...base,
    [primaryDefense]: engageSpot,
    [secondaryDefense]: secondarySpot,
    LW: { x: wingX, y: clamp(wingCenterY - wingOffset, 0.12, 0.88) },
    RW: { x: wingX, y: clamp(wingCenterY + wingOffset, 0.12, 0.88) },
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

const goaliePosition = (
  side: TeamSide,
  puck: Position,
  _isFullscreen: boolean
): Position => {
  // Crease centers for the SVG (viewBox 1400 x 1000)
  const centerX = side === "left" ? 103 / 1400 : 1315 / 1400;
  const centerY = 0.5;
  const radiusX = 72 / 1400; // horizontal radius
  const radiusY = 72 / 1000; // vertical radius

  // If puck is at/behind goal line, pin goalie to goal line segment
  const puckIsBehindGoal =
    (side === "left" && puck.x <= centerX + 0.01) ||
    (side === "right" && puck.x >= centerX - 0.01);
  if (puckIsBehindGoal) {
    return {
      x: centerX,
      y: clamp(puck.y, centerY - radiusY, centerY + radiusY),
    };
  }

  // Project puck direction onto the crease semi-circle
  const dx = (puck.x - centerX) * (side === "left" ? 1 : -1); // mirror for right
  const dy = puck.y - centerY;
  const angle = Math.atan2(dy, dx || 1e-5); // avoid zero
  // Keep angle within front-facing half-circle (-pi/2 to pi/2)
  const clampedAngle = clamp(angle, -Math.PI / 2, Math.PI / 2);
  const arcX = centerX + Math.cos(clampedAngle) * radiusX * (side === "left" ? 1 : -1);
  const arcY = centerY + Math.sin(clampedAngle) * radiusY;

  return {
    x: arcX,
    y: arcY,
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
    <path
      d="M103 428 A72 72 0 0 1 103 572 L103 428 Z"
      fill="rgba(52, 152, 219, 0.2)"
      stroke="#1d4ed8"
      strokeWidth="4"
      opacity="0.8"
    />
    <path
      d="M1315 428 A72 72 0 0 0 1315 572 L1315 428 Z"
      fill="rgba(52, 152, 219, 0.2)"
      stroke="#1d4ed8"
      strokeWidth="4"
      opacity="0.8"
    />
  </svg>
);

const PositionTrainerPage = () => {
  const [puck, setPuck] = useState<Position>(defaultPuck);
  const [isDragging, setIsDragging] = useState(false);
  const [faceoffWing, setFaceoffWing] = useState<FaceoffWing>("LW");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPast, setShowPast] = useState(true);
  const [history, setHistory] = useState<
    { puck: Position; faceoffWing: FaceoffWing }[]
  >([]);
  const [previousPlayers, setPreviousPlayers] = useState<{
    home: PlayerState[];
    away: PlayerState[];
  } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const rinkRef = useRef<HTMLDivElement | null>(null);
  const dragSnapshotTaken = useRef(false);

  const home = useMemo(
    () => getTeamPositions("left", puck, faceoffWing),
    [puck, faceoffWing]
  );
  const away = useMemo(
    () => getTeamPositions("right", puck, faceoffWing),
    [puck, faceoffWing]
  );
  const homeGoalie = useMemo(
    () => goaliePosition("left", puck, isFullscreen),
    [puck, isFullscreen]
  );
  const awayGoalie = useMemo(
    () => goaliePosition("right", puck, isFullscreen),
    [puck, isFullscreen]
  );
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
    const resetDragSnapshot = () => {
      dragSnapshotTaken.current = false;
    };
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointerup", resetDragSnapshot);
    return () => {
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointerup", resetDragSnapshot);
    };
  }, []);


  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            // @ts-ignore
            document.webkitFullscreenElement
        )
      );
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    // @ts-ignore
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      // @ts-ignore
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const board = boardRef.current;
    if (!board) return;
    const fsElement =
      document.fullscreenElement ||
      // @ts-ignore
      document.webkitFullscreenElement;
    if (!fsElement) {
      const req =
        board.requestFullscreen ||
        // @ts-ignore
        board.webkitRequestFullscreen;
      req?.call(board);
    } else {
      (
        document.exitFullscreen ||
        // @ts-ignore
        document.webkitExitFullscreen ||
        (() => {})
      )?.call(document);
    }
  };

  const updatePuckFromPointer = (clientX: number, clientY: number) => {
    const rink = rinkRef.current;
    if (!rink) return;
    const rect = rink.getBoundingClientRect();
    const inset = isFullscreen ? 0.09 : 0.06;
    const x = clamp((clientX - rect.left) / rect.width, inset, 1 - inset);
    const y = clamp((clientY - rect.top) / rect.height, inset, 1 - inset);
    setPuck({ x, y });
  };

  const pushSnapshot = () => {
    // Capture current player locations for trail start points
    setPreviousPlayers({
      home: home.map((p) => ({ ...p, pos: { ...p.pos } })),
      away: away.map((p) => ({ ...p, pos: { ...p.pos } })),
    });
    setHistory((prev) => [...prev, { puck, faceoffWing }]);
  };

  const handleUndo = () => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const target = prev[prev.length - 1];
      setPreviousPlayers(null);
      setPuck(target.puck);
      setFaceoffWing(target.faceoffWing);
      return prev.slice(0, -1);
    });
  };

  const prevHome = useMemo(() => {
    if (!previousPlayers || !showPast) return null;
    return previousPlayers.home;
  }, [previousPlayers, showPast]);
  const prevAway = useMemo(() => {
    if (!previousPlayers || !showPast) return null;
    return previousPlayers.away;
  }, [previousPlayers, showPast]);
  const prevHomeMap = useMemo(() => {
    if (!prevHome) return null;
    return Object.fromEntries(prevHome.map((p) => [p.role, p.pos]));
  }, [prevHome]);
  const prevAwayMap = useMemo(() => {
    if (!prevAway) return null;
    return Object.fromEntries(prevAway.map((p) => [p.role, p.pos]));
  }, [prevAway]);

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
              onChange={(e) => {
                pushSnapshot();
                setFaceoffWing(e.target.value as FaceoffWing);
              }}
            >
              <option value="LW">Left Wing</option>
              <option value="RW">Right Wing</option>
            </select>
          </label>
          <button
            className="ghost"
            onClick={() => {
              setHistory([]);
              setPreviousPlayers(null);
              setPuck(defaultPuck);
            }}
          >
            Reset
          </button>
          <button
            className="ghost"
            onClick={handleUndo}
            disabled={history.length === 0}
          >
            Undo
          </button>
          <label className="control control-inline">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
            />
            Show Past Positions
          </label>
          <button
            className={`ghost ${isFullscreen ? "ghost-on" : ""}`}
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
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

        <section
          ref={boardRef}
          className={`board-panel ${isFullscreen ? "board-panel-fullscreen" : ""}`}
        >
          {isFullscreen && showPast && (
            <>
              <button
                className="floating-undo"
                onClick={handleUndo}
                disabled={history.length === 0}
              >
                Undo
              </button>
              <button
                className="floating-reset"
                onClick={() => {
                  setHistory([]);
                  setPreviousPlayers(null);
                  setPuck(defaultPuck);
                }}
              >
                Reset
              </button>
            </>
          )}
          <div
            ref={rinkRef}
            className={`rink ${isFullscreen ? "rink-fullscreen" : ""}`}
            onPointerMove={(e) =>
              isDragging && updatePuckFromPointer(e.clientX, e.clientY)
            }
            onPointerDown={(e) => {
              if (!dragSnapshotTaken.current) {
                pushSnapshot();
                dragSnapshotTaken.current = true;
              }
              updatePuckFromPointer(e.clientX, e.clientY);
              setIsDragging(true);
            }}
          >
            <RinkGraphic />
            {showPast && !isDragging && prevHomeMap && prevAwayMap && (
              <svg
                className="movement-layer"
                viewBox="0 0 1400 1000"
                preserveAspectRatio="xMidYMid meet"
              >
                {home.map((p) => {
                  const prev = prevHomeMap[p.role];
                  if (!prev) return null;
                  return (
                    <g key={`home-move-${p.role}`}>
                      <line
                        x1={prev.x * 1400}
                        y1={prev.y * 1000}
                        x2={p.pos.x * 1400}
                        y2={p.pos.y * 1000}
                        className="movement-line movement-line-home"
                      />
                      <circle
                        cx={prev.x * 1400}
                        cy={prev.y * 1000}
                        r="34"
                        className="movement-dot movement-dot-home"
                      />
                      <text
                        x={prev.x * 1400}
                        y={prev.y * 1000}
                        className="movement-label"
                      >
                        {p.role}
                      </text>
                    </g>
                  );
                })}
                {away.map((p) => {
                  const prev = prevAwayMap[p.role];
                  if (!prev) return null;
                  return (
                    <g key={`away-move-${p.role}`}>
                      <line
                        x1={prev.x * 1400}
                        y1={prev.y * 1000}
                        x2={p.pos.x * 1400}
                        y2={p.pos.y * 1000}
                        className="movement-line movement-line-away"
                      />
                      <circle
                        cx={prev.x * 1400}
                        cy={prev.y * 1000}
                        r="34"
                        className="movement-dot movement-dot-away"
                      />
                      <text
                        x={prev.x * 1400}
                        y={prev.y * 1000}
                        className="movement-label"
                      >
                        {p.role}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
            <div
              className={`puck ${isDragging ? "active" : ""}`}
              style={{ left: `${puck.x * 100}%`, top: `${puck.y * 100}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!dragSnapshotTaken.current) {
                  pushSnapshot();
                  dragSnapshotTaken.current = true;
                }
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
