import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";

type LineSlot = "none" | "line1" | "line2" | "bench";
type Tier = "top" | "mid" | "low";

type PlayerRow = {
  present: boolean;
  goalie: boolean;
  line: LineSlot;
  sog: number;
  goals: number;
  assists: number;
  benchCount: number;
  shotsAgainst: number;
  goalsAgainst: number;
  tier: Tier;
};

type Scoreboard = {
  usGoals: number;
  themGoals: number;
  usSOG: number;
  themSOG: number;
};

const roster: { name: string; tier: Tier }[] = [
  { name: "June", tier: "mid" },
  { name: "Charles", tier: "mid" },
  { name: "Kiyan", tier: "low" },
  { name: "Kiana", tier: "top" },
  { name: "Amelia", tier: "top" },
  { name: "JJ", tier: "mid" },
  { name: "Gwen", tier: "low" },
  { name: "Shae", tier: "top" },
  { name: "Anika", tier: "top" },
  { name: "Dylan", tier: "low" },
];

const tierValue: Record<Tier, number> = { top: 0, mid: 1, low: 2 };

const StatsBoard = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [score, setScore] = useState<Scoreboard>(() => {
    const saved = sessionStorage.getItem("stats_score");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return { usGoals: 0, themGoals: 0, usSOG: 0, themSOG: 0 };
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [players, setPlayers] = useState<Record<string, PlayerRow>>(() => {
    const saved = sessionStorage.getItem("stats_players");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* fallthrough */
      }
    }
    const initial: Record<string, PlayerRow> = {};
    roster.forEach(({ name, tier }) => {
      initial[name] = {
        present: true,
        goalie: false,
        line: "none",
        sog: 0,
        goals: 0,
        assists: 0,
        benchCount: 0,
        shotsAgainst: 0,
        goalsAgainst: 0,
        tier,
      };
    });
    return initial;
  });

  const goalie = useMemo(
    () => Object.entries(players).find(([, p]) => p.goalie)?.[0] ?? null,
    [players]
  );

  const eligibleSkaters = useMemo(
    () =>
      Object.entries(players)
        .filter(([, p]) => p.present && !p.goalie)
        .sort(
          ([, a], [, b]) =>
            tierValue[a.tier] - tierValue[b.tier] || a.benchCount - b.benchCount
        ),
    [players]
  );
  const hideBenchTurns = eligibleSkaters.length <= 8 && eligibleSkaters.length > 0;

  const suggestedBench = useMemo(() => {
    if (!eligibleSkaters.length || eligibleSkaters.length === 8 || eligibleSkaters.length === 7)
      return [];
    const minBenches = Math.min(...eligibleSkaters.map(([, p]) => p.benchCount));
    return eligibleSkaters
      .filter(([, p]) => p.benchCount === minBenches)
      .map(([name]) => name);
  }, [eligibleSkaters]);

  const extraShiftNext = useMemo(() => {
    const skaterCount = eligibleSkaters.length;
    if (skaterCount === 0 || skaterCount > 7 || skaterCount === 8) return [];
    const sorted = [...eligibleSkaters].sort(
      ([, a], [, b]) => a.benchCount - b.benchCount || tierValue[a.tier] - tierValue[b.tier]
    );
    // pick top 2 to double-shift if only 7 skaters, top 1 if 6
    const take = skaterCount >= 7 ? 2 : 1;
    return sorted.slice(0, take).map(([name]) => name);
  }, [eligibleSkaters]);

  const setPlayer = (name: string, updater: (row: PlayerRow) => PlayerRow) => {
    setPlayers((prev) => ({ ...prev, [name]: updater(prev[name]) }));
  };

  const togglePresent = (name: string) => {
    setPlayer(name, (row) => ({
      ...row,
      present: !row.present,
      goalie: row.present ? false : row.goalie,
      line: row.present ? "none" : row.line,
    }));
  };

  const setGoalie = (name: string) => {
    setPlayers((prev) => {
      const next: Record<string, PlayerRow> = {};
      Object.entries(prev).forEach(([n, row]) => {
        next[n] = { ...row, goalie: n === name, line: n === name ? "none" : row.line };
      });
      return next;
    });
  };

  const setLine = (name: string, line: LineSlot) => {
    setPlayer(name, (row) => ({
      ...row,
      line: row.goalie ? "none" : line,
    }));
  };

  const bump = (name: string, key: "sog" | "goals" | "assists" | "benchCount", delta: number) =>
    setPlayer(name, (row) => ({ ...row, [key]: Math.max(0, (row as any)[key] + delta) }));

  useEffect(() => {
    sessionStorage.setItem("stats_players", JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    sessionStorage.setItem("stats_score", JSON.stringify(score));
  }, [score]);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const resetAll = () => {
    setShowResetModal(false);
    sessionStorage.removeItem("stats_players");
    sessionStorage.removeItem("stats_score");
    const initial: Record<string, PlayerRow> = {};
    roster.forEach(({ name, tier }) => {
      initial[name] = {
        present: true,
        goalie: false,
        line: "none",
        sog: 0,
        goals: 0,
        assists: 0,
        benchCount: 0,
        shotsAgainst: 0,
        goalsAgainst: 0,
        tier,
      };
    });
    setPlayers(initial);
    setScore({ usGoals: 0, themGoals: 0, usSOG: 0, themSOG: 0 });
  };

  const recordAgainst = (type: "shot" | "goal") => {
    if (!goalie) return;
    setPlayer(goalie, (row) => ({
      ...row,
      shotsAgainst: row.shotsAgainst + 1,
      goalsAgainst: row.goalsAgainst + (type === "goal" ? 1 : 0),
    }));
    setScore((s) => ({
      ...s,
      themSOG: s.themSOG + 1,
      themGoals: s.themGoals + (type === "goal" ? 1 : 0),
    }));
  };

  const balanceLines = () => {
    const skaters = eligibleSkaters.map(([name]) => name);
    const nextLines: Record<string, LineSlot> = {};
    const line1: string[] = [];
    const line2: string[] = [];
    const bench: string[] = [];

    const getTier = (name: string) => players[name].tier;
    const tierScore = (t: Tier) => tierValue[t];

    const lineStats = {
      topCount: { line1: 0, line2: 0 },
      skillSum: { line1: 0, line2: 0 },
    };

    const place = (name: string, lineKey: "line1" | "line2") => {
      (lineKey === "line1" ? line1 : line2).push(name);
      if (players[name].tier === "top") lineStats.topCount[lineKey] += 1;
      lineStats.skillSum[lineKey] += tierScore(players[name].tier);
      nextLines[name] = lineKey;
    };

    // Keep Shae and Amelia on different lines when both present
    const special = ["Shae", "Amelia"];
    const presentSpecial = special.filter((n) => skaters.includes(n));
    if (presentSpecial.length === 2) {
      place("Shae", "line1");
      place("Amelia", "line2");
    }

    const remaining = skaters.filter((n) => !nextLines[n]);

    const chooseLine = (name: string): "line1" | "line2" => {
      const tier = players[name].tier;
      const capacity1 = line1.length < 4;
      const capacity2 = line2.length < 4;
      const skill1 = lineStats.skillSum.line1 + tierScore(tier);
      const skill2 = lineStats.skillSum.line2 + tierScore(tier);
      if (tier === "top") {
        if (lineStats.topCount.line1 !== lineStats.topCount.line2) {
          return lineStats.topCount.line1 < lineStats.topCount.line2 ? "line1" : "line2";
        }
      }
      if (line1.length !== line2.length) {
        return line1.length < line2.length ? "line1" : "line2";
      }
      if (skill1 !== skill2) return skill1 < skill2 ? "line1" : "line2";
      if (capacity1 && !capacity2) return "line1";
      if (capacity2 && !capacity1) return "line2";
      return "line1";
    };

    remaining.forEach((name) => {
      if (line1.length >= 4 && line2.length >= 4) {
        bench.push(name);
        nextLines[name] = "bench";
        return;
      }
      const lineKey = chooseLine(name);
      if ((lineKey === "line1" && line1.length >= 4) || (lineKey === "line2" && line2.length >= 4)) {
        const other = lineKey === "line1" ? "line2" : "line1";
        place(name, other);
      } else {
        place(name, lineKey);
      }
    });

    // any overflow after lines filled goes to bench
    [...line1, ...line2].forEach((name) => {
      nextLines[name] = nextLines[name] ?? "line1";
    });
    skaters
      .filter((n) => !nextLines[n])
      .forEach((n) => {
        bench.push(n);
        nextLines[n] = "bench";
      });

    setPlayers((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((name) => {
        copy[name] = { ...copy[name], line: copy[name].goalie ? "none" : nextLines[name] ?? "none" };
      });
      return copy;
    });
  };

  const grouped = useMemo(() => {
    const buckets: Record<LineSlot | "goalie", string[]> = {
      line1: [],
      line2: [],
      bench: [],
      none: [],
      goalie: [],
    };
    roster.forEach(({ name }) => {
      if (players[name].goalie) {
        buckets.goalie.push(name);
      } else {
        const line = players[name].line;
        buckets[line].push(name);
      }
    });
    const presentNames = roster.filter((r) => players[r.name].present).map((r) => r.name);
    const notPresent = roster.filter((r) => !players[r.name].present).map((r) => r.name);
    buckets.none = [...buckets.none.filter((n) => presentNames.includes(n)), ...notPresent];
    return buckets;
  }, [players]);

  const renderRow = (name: string) => {
    const row = players[name];
    return (
      <div key={name} className="stats-row">
        <span className="stats-name">{name}</span>
        <span>
          <input type="checkbox" checked={row.present} onChange={() => togglePresent(name)} />
        </span>
        <span>
          <input
            type="radio"
            name="goalie"
            checked={row.goalie}
            onChange={() => setGoalie(name)}
            disabled={!row.present}
          />
        </span>
          <span>
            <select
              value={row.line}
              onChange={(e) => setLine(name, e.target.value as LineSlot)}
              disabled={!row.present || row.goalie}
            >
              <option value="none">None</option>
              <option value="line1">Line 1</option>
              <option value="line2">Line 2</option>
              <option value="bench">Bench</option>
            </select>
          </span>
          {!hideBenchTurns && (
            <span className="counter">
              <button onClick={() => bump(name, "benchCount", -1)} disabled={row.benchCount === 0}>
                -
              </button>
              <span>{row.benchCount}</span>
              <button onClick={() => bump(name, "benchCount", 1)}>+ Bench</button>
            </span>
          )}
          <span className="counter">
            <button onClick={() => bump(name, "sog", -1)} disabled={row.sog === 0}>
              -
            </button>
            <span>{row.sog}</span>
          <button onClick={() => bump(name, "sog", 1)}>+</button>
        </span>
        <span className="counter">
          <button onClick={() => bump(name, "goals", -1)} disabled={row.goals === 0}>
            -
          </button>
          <span>{row.goals}</span>
          <button onClick={() => bump(name, "goals", 1)}>+</button>
        </span>
        <span className="counter">
          <button onClick={() => bump(name, "assists", -1)} disabled={row.assists === 0}>
            -
          </button>
          <span>{row.assists}</span>
          <button onClick={() => bump(name, "assists", 1)}>+</button>
        </span>
        <span className="goalie-stats">
          <span>{row.goalsAgainst} GA</span>
          <span>{row.shotsAgainst} SA</span>
        </span>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`page stats-page ${isFullscreen ? "stats-fullscreen" : ""}`}>
      <header className="page-hero">
        {!isFullscreen && (
          <div>
            <p className="eyebrow">Game tracker</p>
            <h1>Lines, attendance, and stats</h1>
            <p className="hero-subline">
              Track who&apos;s here, lines, goalie, bench turns, and live stats.
            </p>
          </div>
        )}
        <div className="controls">
          <button className="ghost" onClick={balanceLines}>
            Balance lines
          </button>
          <button className="ghost" onClick={() => recordAgainst("shot")} disabled={!goalie}>
            Shot against goalie
          </button>
          <button className="ghost" onClick={() => recordAgainst("goal")} disabled={!goalie}>
            Goal against goalie
          </button>
          <button
            className={`ghost ${isFullscreen ? "ghost-on" : ""}`}
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
          <button className="ghost" onClick={() => setShowResetModal(true)}>
            Reset data
          </button>
        </div>
      </header>

      <section className="info stats-callout">
        <div>
          <strong>Bench next:</strong>{" "}
          {suggestedBench.length ? suggestedBench.join(", ") : "No eligible skaters"}
        </div>
        <div>
          <strong>Goalie:</strong> {goalie ?? "None set"}
        </div>
        {extraShiftNext.length > 0 && (
          <div>
            <strong>Extra shift:</strong> {extraShiftNext.join(", ")}
          </div>
        )}
        <div className="scoreboard inline-score">
          <div className="score-chip">
            <span className="score-label">Us</span>
            <span className="score-num">{score.usGoals}</span>
            <span className="score-abbr">G</span>
            <div className="score-mini-btns">
              <button onClick={() => setScore((s) => ({ ...s, usGoals: Math.max(0, s.usGoals - 1) }))}>
                -
              </button>
              <button onClick={() => setScore((s) => ({ ...s, usGoals: s.usGoals + 1 }))}>+</button>
            </div>
            <span className="score-num">{score.usSOG}</span>
            <span className="score-abbr">S</span>
            <div className="score-mini-btns">
              <button onClick={() => setScore((s) => ({ ...s, usSOG: Math.max(0, s.usSOG - 1) }))}>
                -
              </button>
              <button onClick={() => setScore((s) => ({ ...s, usSOG: s.usSOG + 1 }))}>+</button>
            </div>
          </div>
          <div className="score-chip">
            <span className="score-label">Them</span>
            <span className="score-num">{score.themGoals}</span>
            <span className="score-abbr">G</span>
            <div className="score-mini-btns">
              <button onClick={() => setScore((s) => ({ ...s, themGoals: Math.max(0, s.themGoals - 1) }))}>
                -
              </button>
              <button onClick={() => setScore((s) => ({ ...s, themGoals: s.themGoals + 1 }))}>+</button>
            </div>
            <span className="score-num">{score.themSOG}</span>
            <span className="score-abbr">S</span>
            <div className="score-mini-btns">
              <button onClick={() => setScore((s) => ({ ...s, themSOG: Math.max(0, s.themSOG - 1) }))}>
                -
              </button>
              <button onClick={() => setScore((s) => ({ ...s, themSOG: s.themSOG + 1 }))}>+</button>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-table">
        <div className="stats-row stats-head">
          <span>Player</span>
          <span>Here</span>
          <span>Goalie</span>
          <span>Line</span>
          {!hideBenchTurns && <span>Bench turns</span>}
          <span>SOG</span>
          <span>G</span>
          <span>A</span>
          <span>GA/SvA</span>
        </div>
        {(
          [
            "line1",
            "line2",
            ...(grouped.bench.length ? (["bench"] as const) : []),
            "goalie",
            "none",
          ] as (LineSlot | "goalie")[]
        ).map((lineKey) => (
          <div key={lineKey}>
            <div className="stats-group-title">
              {lineKey === "line1"
                ? "Line 1"
                : lineKey === "line2"
                ? "Line 2"
                : lineKey === "bench"
                ? "Bench / alternate"
                : lineKey === "goalie"
                ? "Goalie"
                : "Unassigned"}
            </div>
            {grouped[lineKey].map((name) => {
              const row = players[name];
              return (
                <div key={name} className="stats-row">
                  <span className="stats-name">{name}</span>
                  <span>
                    <input type="checkbox" checked={row.present} onChange={() => togglePresent(name)} />
                  </span>
                  <span>
                    <input
                      type="radio"
                      name="goalie"
                      checked={row.goalie}
                      onChange={() => setGoalie(name)}
                      disabled={!row.present}
                    />
                  </span>
                  <span>
                    <select
                      value={row.line}
                      onChange={(e) => setLine(name, e.target.value as LineSlot)}
                      disabled={!row.present || row.goalie}
                    >
                      <option value="none">None</option>
                      <option value="line1">Line 1</option>
                      <option value="line2">Line 2</option>
                      <option value="bench">Bench</option>
                    </select>
                  </span>
                  <span className="counter">
                    <button onClick={() => bump(name, "benchCount", -1)} disabled={row.benchCount === 0}>
                      -
                    </button>
                    <span>{row.benchCount}</span>
                    <button onClick={() => bump(name, "benchCount", 1)}>+ Bench</button>
                  </span>
                  <span className="counter">
                    <button onClick={() => bump(name, "sog", -1)} disabled={row.sog === 0}>
                      -
                    </button>
                    <span>{row.sog}</span>
                    <button onClick={() => bump(name, "sog", 1)}>+</button>
                  </span>
                  <span className="counter">
                    <button onClick={() => bump(name, "goals", -1)} disabled={row.goals === 0}>
                      -
                    </button>
                    <span>{row.goals}</span>
                    <button onClick={() => bump(name, "goals", 1)}>+</button>
                  </span>
                  <span className="counter">
                    <button onClick={() => bump(name, "assists", -1)} disabled={row.assists === 0}>
                      -
                    </button>
                    <span>{row.assists}</span>
                    <button onClick={() => bump(name, "assists", 1)}>+</button>
                  </span>
                  <span className="goalie-stats">
                    <span>{row.goalsAgainst} GA</span>
                    <span>{row.shotsAgainst} SA</span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {showResetModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Reset all data?</h3>
            <p>This will clear attendance, lines, stats, and the scoreboard for this session.</p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
              <button className="ghost danger" onClick={resetAll}>
                Reset now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsBoard;
