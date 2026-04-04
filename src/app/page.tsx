"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { generateOrbitalLayout } from "@/lib/orbital-layout";
import type { IslandData, ArchipelagoIsland, OrbitalLayout } from "@/lib/cloud-island";
import AccountInput from "@/components/AccountInput";
import CategoryLegend from "@/components/CategoryLegend";
import CategoryDetailPanel from "@/components/CategoryDetailPanel";
import LoadingScreen, { type LoadingStage } from "@/components/LoadingScreen";
import SimulatorPanel from "@/components/SimulatorPanel";
import PresetSelector from "@/components/PresetSelector";
import { X } from "lucide-react";

const IslandCanvas = dynamic(() => import("@/components/IslandCanvas"), {
  ssr: false,
});

type TabMode = "simulator" | "presets" | "connect";

function SpaceBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(60,40,120,0.12),_transparent_50%),linear-gradient(180deg,_rgba(5,5,16,0.9),_rgba(8,6,20,0.95)_45%,_rgba(3,3,10,1))]" />
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
  >([]);
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

  const islands = useMemo(() => arrangeIslands(islandEntries), [islandEntries]);

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

  const fetchIsland = useCallback(
    async (roleArn: string) => {
      setLoading(true);
      setShowLoading(true);
      setLoadingStage("fetching");
      setLoadingProgress(20);
      setLoadingError(null);

      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleArn }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to sync AWS data");
        }

        setLoadingStage("generating");
        setLoadingProgress(50);

        const data: IslandData = await response.json();

        setLoadingStage("rendering");
        setLoadingProgress(80);

        const accountId = roleArn.split(":")[4];
        upsertIsland(`aws-${accountId}`, `AWS ${accountId}`, data);

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
    [upsertIsland]
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

  const handleCategoryClick = useCallback((categoryId: string) => {
    if (balloonMode) return;
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId));
  }, [balloonMode]);

  const handleSimulatorChange = useCallback(
    (data: IslandData) => {
      upsertIsland("simulator", "Simulator", data);
    },
    [upsertIsland]
  );

  const handlePresetSelect = useCallback(
    (data: IslandData, presetLabel: string) => {
      upsertIsland(data.accountId, presetLabel, data);
      setSelectedIslandId(data.accountId);
    },
    [upsertIsland]
  );

  const selectedActivity = useMemo(() => {
    if (!selectedCategory || islands.length === 0) return null;

    for (const island of islands) {
      const found = island.data.categories.find(
        (category) => category.categoryId === selectedCategory
      );
      if (found && found.apiCallCount > 0) return found;
    }

    return null;
  }, [selectedCategory, islands]);

  const legendSectors = useMemo(() => {
    if (islands.length === 0) return [];
    return (islands[0].layout as OrbitalLayout).sectors;
  }, [islands]);

  const tabs: { key: TabMode; label: string }[] = [
    { key: "simulator", label: "Simulator" },
    { key: "presets", label: "Presets" },
    { key: "connect", label: "Connect AWS" },
  ];

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
          onClick={() => setBalloonMode((prev) => !prev)}
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
            onIslandSelect={setSelectedIslandId}
            onCategoryClick={handleCategoryClick}
            balloonMode={balloonMode}
            activeCategoryId={selectedCategory}
          />

          {!balloonMode && (
            <CategoryLegend
              sectors={legendSectors}
              onCategoryClick={handleCategoryClick}
              activeCategoryId={selectedCategory}
            />
          )}

          {!balloonMode && selectedActivity && (
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
              onClick={() => setSelectedIslandId(entry.id)}
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
          {activeTab === "presets" && <PresetSelector onSelect={handlePresetSelect} activePresetId={null} />}
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


