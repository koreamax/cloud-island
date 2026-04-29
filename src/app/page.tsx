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
import AccountInput from "@/components/AccountInput";
import CategoryLegend from "@/components/CategoryLegend";
import CategoryDetailPanel from "@/components/CategoryDetailPanel";
import IslandDetailPanel from "@/components/IslandDetailPanel";
import LoadingScreen, { type LoadingStage } from "@/components/LoadingScreen";
import SimulatorPanel from "@/components/SimulatorPanel";
import { PRESET_DATA } from "@/lib/mock-data";
import { X } from "lucide-react";

const IslandCanvas = dynamic(() => import("@/components/IslandCanvas"), {
  ssr: false,
});

type TabMode = "simulator" | "connect";
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
  const [activeTab, setActiveTab] = useState<TabMode>("simulator");
  const [lastRoleArn, setLastRoleArn] = useState<string | null>(null);
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
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

  const handleSimulatorChange = useCallback(
    (data: IslandData) => {
      upsertIsland("simulator", "Simulator", data);
      focusIsland("simulator");
      setSelectedCategory(null);
    },
    [focusIsland, upsertIsland]
  );

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

  const tabs: { key: TabMode; label: string }[] = [
    { key: "simulator", label: "Simulator" },
    { key: "connect", label: "Connect AWS" },
  ];

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
          className={`rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md transition ${
            islands.length === 0
              ? "cursor-not-allowed border-white/10 bg-[#12121a]/50 text-white/30"
              : balloonMode
                ? "border-orange-200/60 bg-orange-300/25 text-orange-50"
                : "border-white/15 bg-[#12121a]/80 text-white/80 hover:bg-[#1b1b28]"
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
        <div className="absolute left-4 top-4 z-40 flex flex-col gap-1 rounded-lg border border-white/10 bg-[#12121a]/80 p-2 backdrop-blur-md">
          <div className="px-1 text-[10px] uppercase tracking-widest text-white/30">
            Islands ({islandEntries.length})
          </div>
          {islandEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => focusIsland(entry.id)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                selectedIslandId === entry.id
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "text-white/70 hover:bg-white/5"
              }`}
            >
              <span className="max-w-[180px] truncate font-mono">{entry.label}</span>
              <span className="text-[10px] text-white/30">
                {entry.data.totalApiCalls.toLocaleString()}
              </span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  removeIsland(entry.id);
                }}
                className="text-white/20 transition-colors hover:text-red-400"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!balloonMode && (
        <div className="absolute left-4 bottom-4 z-40 flex flex-col gap-3">
          <div className="flex gap-1 rounded-lg border border-white/10 bg-[#12121a]/80 p-1 backdrop-blur-md">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "simulator" && <SimulatorPanel onDataChange={handleSimulatorChange} />}
          {activeTab === "connect" && (
            <div className="flex w-80 flex-col gap-3 rounded-xl border border-white/10 bg-[#12121a]/90 p-4 backdrop-blur-md">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Connect AWS Account
              </h3>
              <AccountInput
                onSubmit={(roleArn) => {
                  setLastRoleArn(roleArn);
                  fetchIsland(roleArn);
                }}
                loading={loading}
              />
              <div className="mt-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="text-[11px] text-white/20">
                  Create a CelestaReadOnly role with Terraform, then paste the Role ARN here.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {islands.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-[0.15em] text-indigo-400 sm:text-5xl">
              CLOUD ORBIT
            </h1>
            <p className="mt-2 text-sm text-white/30">AWS Infrastructure Orbital Visualizer</p>
            <p className="mt-4 text-xs text-white/15">Use the panel on the left to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}


