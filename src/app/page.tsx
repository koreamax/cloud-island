"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  fetchActivePlayers,
  fetchSavedIslands,
  syncIsland,
  updatePlayerPresence,
} from "@/lib/api-gateway";
import { generateOrbitalLayout } from "@/lib/orbital-layout";
import type {
  IslandData,
  ArchipelagoIsland,
  MultiplayerPlayerState,
  OrbitalLayout,
} from "@/lib/cloud-island";
import CategoryLegend from "@/components/CategoryLegend";
import CategoryDetailPanel from "@/components/CategoryDetailPanel";
import IslandDetailPanel from "@/components/IslandDetailPanel";
import LoadingScreen, { type LoadingStage } from "@/components/LoadingScreen";
import { PRESET_DATA } from "@/lib/mock-data";

const IslandCanvas = dynamic(() => import("@/components/IslandCanvas"), {
  ssr: false,
});

type BalloonPresenceState = {
  active: boolean;
  position: [number, number, number];
  forward: [number, number, number];
};

function SpaceBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_42%,_rgba(76,58,162,0.18),_transparent_22%),radial-gradient(circle_at_50%_46%,_rgba(15,16,34,0.92),_rgba(5,5,14,0)_30%),radial-gradient(circle_at_center,_rgba(60,40,120,0.12),_transparent_50%),linear-gradient(180deg,_rgba(5,5,16,0.88),_rgba(8,6,20,0.96)_42%,_rgba(3,3,10,1))]" />
      <div className="absolute inset-x-0 bottom-0 z-[2] h-40 bg-[linear-gradient(180deg,rgba(2,2,8,0),rgba(2,2,8,0.82)_70%,rgba(0,0,0,0.96))]" />
    </div>
  );
}

function arrangeIslands(
  entries: { id: string; label: string; data: IslandData }[]
): ArchipelagoIsland[] {
  if (entries.length === 0) return [];

  const layouts = entries.map((entry) => ({
    ...entry,
    layout: generateOrbitalLayout(entry.data),
  }));

  if (entries.length === 1) {
    const entry = layouts[0];
    return [
      {
        id: entry.id,
        label: entry.label,
        data: entry.data,
        layout: entry.layout,
        position: [0, 0, 0] as [number, number, number],
      },
    ];
  }

  // Each island's exclusion radius = outerRadius + padding
  const PADDING = 30;
  const radii = layouts.map((entry) => {
    const orbital = entry.layout as import("@/lib/cloud-island").OrbitalLayout;
    return (orbital.outerRadius ?? 40) + PADDING;
  });

  // Place islands with rejection sampling — no overlap within exclusion radii
  const positions: [number, number, number][] = [];
  const seeded = (i: number) => {
    let s = i * 7919 + 1;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 4294967296;
    };
  };

  for (let i = 0; i < layouts.length; i++) {
    if (i === 0) {
      positions.push([0, 0, 0]);
      continue;
    }

    const rand = seeded(i);
    // Sphere radius grows with island count to give more room
    const sphereRadius = radii.reduce((a, b) => a + b, 0) * 0.6;
    let placed = false;

    for (let attempt = 0; attempt < 500; attempt++) {
      // Random point in 3D sphere (uniform distribution)
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const r = sphereRadius * Math.cbrt(rand());
      const sinU = Math.sqrt(1 - u * u);
      const x = r * sinU * Math.cos(theta);
      const y = r * u * 0.4; // flatten Y axis a bit
      const z = r * sinU * Math.sin(theta);

      // Check minimum distance against all placed islands
      let tooClose = false;
      for (let j = 0; j < positions.length; j++) {
        const dx = x - positions[j][0];
        const dy = y - positions[j][1];
        const dz = z - positions[j][2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = radii[i] + radii[j];
        if (dist < minDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        positions.push([x, y, z]);
        placed = true;
        break;
      }
    }

    // Fallback: place far out if rejection sampling fails
    if (!placed) {
      const fallbackAngle = (i / layouts.length) * Math.PI * 2;
      const fallbackR = sphereRadius * 1.5;
      positions.push([
        Math.cos(fallbackAngle) * fallbackR,
        (rand() - 0.5) * 40,
        Math.sin(fallbackAngle) * fallbackR,
      ]);
    }
  }

  return layouts.map((entry, index) => ({
    id: entry.id,
    label: entry.label,
    data: entry.data,
    layout: entry.layout,
    position: positions[index],
  }));
}

export default function Home() {
  const [islandEntries, setIslandEntries] = useState<
    { id: string; label: string; data: IslandData }[]
  >(() =>
    PRESET_DATA.map((preset) => ({
      id: preset.id,
      label: preset.label,
      data: preset.data,
    }))
  );
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("init");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lastRoleArn, setLastRoleArn] = useState<string | null>(null);
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(
    PRESET_DATA[0]?.id ?? null
  );
  const [balloonMode, setBalloonMode] = useState(false);
  const [cameraFocusNonce, setCameraFocusNonce] = useState(0);
  const [spaceBattleActive, setSpaceBattleActive] = useState(false);
  const [spaceBattleNonce, setSpaceBattleNonce] = useState(0);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<MultiplayerPlayerState[]>([]);
  const balloonPresenceRef = useRef<BalloonPresenceState>({
    active: false,
    position: [0, 0, 0],
    forward: [0, 0, -1],
  });

  const islands = useMemo(() => arrangeIslands(islandEntries), [islandEntries]);
  const topIslandEntries = useMemo(
    () =>
      [...islandEntries]
        .sort((left, right) => right.data.totalApiCalls - left.data.totalApiCalls)
        .slice(0, 5),
    [islandEntries]
  );
  const selectedIsland = useMemo(
    () => islands.find((island) => island.id === selectedIslandId) ?? null,
    [islands, selectedIslandId]
  );
  const playerIsland = useMemo(
    () =>
      islands.find((island) => island.id.startsWith("aws-")) ??
      islands.find((island) => island.id === "simulator") ??
      islands[0] ??
      null,
    [islands]
  );

  const upsertIsland = useCallback((id: string, label: string, data: IslandData) => {
    setIslandEntries((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { id, label, data };
        return next;
      }
      return [...prev, { id, label, data }];
    });
  }, []);

  const removeIsland = useCallback((id: string) => {
    setIslandEntries((prev) => prev.filter((entry) => entry.id !== id));
    setSelectedIslandId((prev) => (prev === id ? null : prev));
  }, []);

  const focusIsland = useCallback((id: string | null) => {
    setSelectedIslandId(id);
    if (id) {
      setCameraFocusNonce((prev) => prev + 1);
    }
  }, []);

  const fetchIsland = useCallback(
    async (roleArn: string) => {
      setLoading(true);
      setShowLoading(true);
      setLoadingStage("fetching");
      setLoadingProgress(20);
      setLoadingError(null);

      try {
        setLoadingStage("generating");
        setLoadingProgress(50);

        const data: IslandData = await syncIsland(roleArn);

        setLoadingStage("rendering");
        setLoadingProgress(80);

        const accountId = roleArn.split(":")[4];
        const islandId = `aws-${accountId}`;
        upsertIsland(islandId, `AWS ${accountId}`, data);
        focusIsland(islandId);

        setTimeout(() => {
          setLoadingProgress(100);
          setLoadingStage("ready");
        }, 500);
      } catch (error) {
        setLoadingStage("error");
        setLoadingError(
          error instanceof Error ? error.message : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    },
    [focusIsland, upsertIsland]
  );

  const handleRetry = useCallback(() => {
    if (lastRoleArn) {
      fetchIsland(lastRoleArn);
    }
  }, [lastRoleArn, fetchIsland]);

  const handleFadeComplete = useCallback(() => {
    setShowLoading(false);
    setLoadingStage("done");
  }, []);

  useEffect(() => {
    const storageKey = "cloud-island-player-id";
    const existing =
      window.localStorage.getItem(storageKey) ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `player-${Math.random().toString(36).slice(2, 12)}`);

    window.localStorage.setItem(storageKey, existing);
    setPlayerId(existing);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSavedIslands() {
      try {
        const savedIslands = await fetchSavedIslands();
        if (!active) return;

        if (savedIslands.length > 0) {
          setIslandEntries((prev) => {
            const next = [...prev];
            for (const island of savedIslands) {
              const id = `aws-${island.accountId}`;
              const existingIndex = next.findIndex((entry) => entry.id === id);
              const nextEntry = {
                id,
                label: island.label,
                data: island.data,
              };

              if (existingIndex >= 0) {
                next[existingIndex] = nextEntry;
              } else {
                next.push(nextEntry);
              }
            }
            return next;
          });
        }

        setSelectedIslandId((prev) => {
          if (savedIslands[0]) return `aws-${savedIslands[0].accountId}`;
          return prev ?? PRESET_DATA[0]?.id ?? null;
        });
      } catch (error) {
        console.error("Failed to load saved islands:", error);
        setSelectedIslandId((prev) => prev ?? PRESET_DATA[0]?.id ?? null);
      }
    }

    void loadSavedIslands();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!playerId) return;
    let active = true;

    const loadPlayers = async () => {
      try {
        const players = await fetchActivePlayers();
        if (!active) return;
        setRemotePlayers(players.filter((player) => player.playerId !== playerId));
      } catch (error) {
        console.error("Failed to load active players:", error);
      }
    };

    void loadPlayers();
    const intervalId = window.setInterval(() => {
      void loadPlayers();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [playerId]);

  useEffect(() => {
    if (!playerId || !playerIsland) return;

    const publishPresence = async (active: boolean) => {
      try {
        const snapshot = balloonPresenceRef.current;
        await updatePlayerPresence({
          playerId,
          label: playerIsland.label,
          islandId: playerIsland.id,
          active,
          balloonMode: active,
          position: snapshot.position,
          forward: snapshot.forward,
        });
      } catch (error) {
        console.error("Failed to update player presence:", error);
      }
    };

    if (!balloonMode) {
      void publishPresence(false);
      return;
    }

    void publishPresence(true);
    const intervalId = window.setInterval(() => {
      void publishPresence(true);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
      void publishPresence(false);
    };
  }, [balloonMode, playerId, playerIsland]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    if (balloonMode) return;
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId));
  }, [balloonMode]);

  const handleBalloonStateChange = useCallback((state: BalloonPresenceState) => {
    balloonPresenceRef.current = state;
  }, []);

  const selectedActivity = useMemo(() => {
    if (!selectedCategory || !selectedIsland) return null;

    return (
      selectedIsland.data.categories.find(
        (category) =>
          category.categoryId === selectedCategory && category.apiCallCount > 0
      ) ?? null
    );
  }, [selectedCategory, selectedIsland]);

  const legendSectors = useMemo(() => {
    if (islands.length === 0) return [];
    return (islands[0].layout as OrbitalLayout).sectors;
  }, [islands]);

  useEffect(() => {
    if (!balloonMode || !selectedIsland || !playerIsland || selectedIsland.id === playerIsland.id) {
      setSpaceBattleActive(false);
    }
  }, [balloonMode, playerIsland, selectedIsland]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a14]">
      <SpaceBackdrop />

      {showLoading && (
        <LoadingScreen
          stage={loadingStage}
          progress={loadingProgress}
          error={loadingError}
          onRetry={handleRetry}
          onFadeComplete={handleFadeComplete}
        />
      )}

      <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
        <button
          onClick={() => {
            setBalloonMode((prev) => !prev);
          }}
          disabled={islands.length === 0}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md ${
            islands.length === 0
              ? "btn-glass cursor-not-allowed text-white/35"
              : balloonMode
                ? "btn-glass"
                : "btn-premium"
          }`}
        >
          {balloonMode ? "Exit Explorer" : "Space Explore"}
        </button>
        {balloonMode && (
          <div className="rounded-full border border-white/15 bg-[#12121a]/75 px-3 py-2 text-xs text-white/65 backdrop-blur-md">
            Space explorer: WASD, arrows, Space/E, Shift/Q
          </div>
        )}
      </div>

      {islands.length > 0 && (
        <>
          <IslandCanvas
            islands={islands}
            selectedIslandId={selectedIslandId}
            onIslandSelect={focusIsland}
            onCategoryClick={handleCategoryClick}
            balloonMode={balloonMode}
            activeCategoryId={selectedCategory}
            focusRequestKey={cameraFocusNonce}
            playerIslandId={playerIsland?.id ?? null}
            battleActive={spaceBattleActive}
            battleSessionKey={spaceBattleNonce}
            battlePlayerIslandId={playerIsland?.id ?? null}
            battleTargetIslandId={selectedIsland?.id ?? null}
            onBattleFinished={() => setSpaceBattleActive(false)}
            remotePlayers={remotePlayers}
            onBalloonStateChange={handleBalloonStateChange}
          />

          {!balloonMode && (
            <CategoryLegend
              sectors={legendSectors}
              onCategoryClick={handleCategoryClick}
              activeCategoryId={selectedCategory}
            />
          )}

          {selectedIsland && (
            <IslandDetailPanel
              islandLabel={selectedIsland.label}
              islandData={selectedIsland.data}
              actionSlot={
                balloonMode && playerIsland && selectedIsland.id !== playerIsland.id ? (
                  <button
                    onClick={() => {
                      setSpaceBattleNonce((prev) => prev + 1);
                      setSpaceBattleActive(true);
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-rose-300/25 bg-gradient-to-r from-rose-500/18 via-orange-400/14 to-amber-300/12 px-4 py-3 text-left text-white transition hover:from-rose-500/24 hover:via-orange-400/18 hover:to-amber-300/16"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.28em] text-rose-100/55">
                        Space Explore
                      </div>
                      <div className="mt-1 text-sm font-semibold text-rose-50">
                        공격
                      </div>
                    </div>
                    <div className="rounded-full border border-rose-200/20 bg-black/20 px-3 py-1 text-[11px] text-rose-100/75">
                      Launch Attack
                    </div>
                  </button>
                ) : null
              }
              onClose={() => {
                setSelectedIslandId(null);
                setSelectedCategory(null);
                setSpaceBattleActive(false);
              }}
            />
          )}

          {!balloonMode && selectedIsland && selectedActivity && (
            <CategoryDetailPanel
              activity={selectedActivity}
              onClose={() => setSelectedCategory(null)}
            />
          )}
        </>
      )}

      {islandEntries.length > 0 && !balloonMode && (
        <div className="panel-premium absolute left-4 top-4 z-40 flex w-[16.75rem] flex-col gap-2 rounded-[1.4rem] p-2.5 text-white">
          <div className="px-1">
            <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-100/36">
              Leaderboard
            </div>
            <div className="mt-1.5 text-sm font-semibold tracking-[0.08em] text-white/84">
              Top Islands
            </div>
            <div className="mt-0.5 text-[10px] text-white/32">
              Ranked by total API calls
            </div>
          </div>
          {topIslandEntries.map((entry, index) => (
            (() => {
              const rank = index + 1;
              const rankTone =
                rank === 1
                  ? "from-amber-200/30 via-yellow-200/16 to-white/6 border-amber-200/24 text-amber-100"
                  : rank === 2
                    ? "from-slate-100/22 via-cyan-100/10 to-white/6 border-slate-100/16 text-slate-100"
                    : rank === 3
                      ? "from-orange-200/24 via-rose-100/10 to-white/6 border-orange-200/18 text-orange-100"
                      : "from-white/10 via-white/4 to-white/[0.02] border-white/8 text-white/74";

              const rankLabel = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`;

              return (
                <button
                  key={entry.id}
                  onClick={() => focusIsland(entry.id)}
                  className={`flex min-w-0 items-center gap-2.5 rounded-[1.15rem] border bg-gradient-to-r px-2.5 py-2.5 text-left text-xs transition-all ${
                    selectedIslandId === entry.id
                      ? "border-cyan-200/24 from-cyan-300/20 via-indigo-300/12 to-white/6 text-cyan-50 shadow-[0_14px_24px_rgba(66,120,255,0.18)]"
                      : `${rankTone} hover:-translate-y-[1px] hover:border-white/16`
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border bg-black/16 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${
                      rank === 1
                        ? "border-amber-200/30 text-amber-100"
                        : rank === 2
                          ? "border-slate-100/20 text-slate-100"
                          : rank === 3
                            ? "border-orange-200/24 text-orange-100"
                            : "border-white/10 text-white/68"
                    }`}
                  >
                    {rankLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[12px]">{entry.label}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/34">
                      {entry.data.totalApiCalls.toLocaleString()} calls
                    </div>
                  </div>
                </button>
              );
            })()
          ))}
        </div>
      )}

      {islands.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-[0.15em] text-indigo-400 sm:text-5xl">
              CLOUD ORBIT
            </h1>
            <p className="mt-2 text-sm text-white/30">AWS Infrastructure Orbital Visualizer</p>
            <p className="mt-4 text-xs text-white/15">Select a planet or enter explorer mode to begin</p>
          </div>
        </div>
      )}
    </div>
  );
}


