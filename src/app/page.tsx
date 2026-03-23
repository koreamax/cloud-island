"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { generateIslandLayout } from "@/lib/island-layout";
import type { IslandData, ArchipelagoIsland } from "@/lib/cloud-island";
import AccountInput from "@/components/AccountInput";
import CategoryLegend from "@/components/CategoryLegend";
import CategoryDetailPanel from "@/components/CategoryDetailPanel";
import LoadingScreen, { type LoadingStage } from "@/components/LoadingScreen";
import SimulatorPanel from "@/components/SimulatorPanel";
import PresetSelector from "@/components/PresetSelector";
import { X } from "lucide-react";

// Dynamic import for R3F canvas (SSR disabled)
const IslandCanvas = dynamic(() => import("@/components/IslandCanvas"), {
  ssr: false,
});

type TabMode = "simulator" | "presets" | "connect";

/** Arrange islands in a circle with spacing */
function arrangeIslands(
  entries: { id: string; label: string; data: IslandData }[]
): ArchipelagoIsland[] {
  if (entries.length === 0) return [];

  const layouts = entries.map((e) => ({
    ...e,
    layout: generateIslandLayout(e.data),
  }));

  if (entries.length === 1) {
    const e = layouts[0];
    return [
      {
        id: e.id,
        label: e.label,
        data: e.data,
        layout: e.layout,
        position: [0, 0, 0] as [number, number, number],
      },
    ];
  }

  // 3D spiral arrangement — islands spread on XZ with Y variation
  const spacing = 70;
  const radius = (entries.length * spacing) / (2 * Math.PI);

  return layouts.map((e, i) => {
    const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // Alternate Y height: even islands go up, odd go down
    const y = (i % 3 === 0 ? 0 : i % 3 === 1 ? 15 : -12);
    return {
      id: e.id,
      label: e.label,
      data: e.data,
      layout: e.layout,
      position: [x, y, z] as [number, number, number],
    };
  });
}

export default function Home() {
  // Multiple islands: keyed by unique id
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

  // Build archipelago from entries
  const islands: ArchipelagoIsland[] = useMemo(
    () => arrangeIslands(islandEntries),
    [islandEntries]
  );

  // Add or replace an island entry
  const upsertIsland = useCallback(
    (id: string, label: string, data: IslandData) => {
      setIslandEntries((prev) => {
        const exists = prev.findIndex((e) => e.id === id);
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = { id, label, data };
          return next;
        }
        return [...prev, { id, label, data }];
      });
    },
    []
  );

  const removeIsland = useCallback((id: string) => {
    setIslandEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Sync real AWS data via Role ARN
  const fetchIsland = useCallback(
    async (roleArn: string) => {
      setLoading(true);
      setShowLoading(true);
      setLoadingStage("fetching");
      setLoadingProgress(20);
      setLoadingError(null);

      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleArn }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to sync AWS data");
        }

        setLoadingStage("generating");
        setLoadingProgress(50);

        const data: IslandData = await res.json();

        setLoadingStage("rendering");
        setLoadingProgress(80);

        const accountId = roleArn.split(":")[4];
        upsertIsland(`aws-${accountId}`, `AWS ${accountId}`, data);

        setTimeout(() => {
          setLoadingProgress(100);
          setLoadingStage("ready");
        }, 500);
      } catch (err) {
        setLoadingStage("error");
        setLoadingError(
          err instanceof Error ? err.message : "Something went wrong"
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
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId));
  }, []);

  // Simulator data change — upsert as "simulator" island
  const handleSimulatorChange = useCallback(
    (data: IslandData) => {
      upsertIsland("simulator", "Simulator", data);
      setSelectedIslandId((prev) => prev ?? "simulator");
    },
    [upsertIsland]
  );

  // Preset selection — upsert as preset island
  const handlePresetSelect = useCallback(
    (data: IslandData, presetLabel: string) => {
      const presetId = data.accountId; // "preset-startup" etc
      upsertIsland(presetId, presetLabel, data);
    },
    [upsertIsland]
  );

  // Find selected category activity from all islands combined
  const selectedActivity = useMemo(() => {
    if (!selectedCategory || islands.length === 0) return null;
    for (const island of islands) {
      const found = island.data.categories.find(
        (c) => c.categoryId === selectedCategory
      );
      if (found && found.apiCallCount > 0) return found;
    }
    return null;
  }, [selectedCategory, islands]);

  // Merged sectors for legend (from first island that has data)
  const legendSectors = useMemo(() => {
    if (islands.length === 0) return [];
    return islands[0].layout.sectors;
  }, [islands]);

  const tabs: { key: TabMode; label: string }[] = [
    { key: "simulator", label: "Simulator" },
    { key: "presets", label: "Presets" },
    { key: "connect", label: "Connect AWS" },
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a14]">
      {/* Loading screen */}
      {showLoading && (
        <LoadingScreen
          stage={loadingStage}
          progress={loadingProgress}
          error={loadingError}
          onRetry={handleRetry}
          onFadeComplete={handleFadeComplete}
        />
      )}

      {/* 3D Canvas — render when there are islands */}
      {islands.length > 0 && (
        <>
          <IslandCanvas
            islands={islands}
            selectedIslandId={selectedIslandId}
            onIslandSelect={setSelectedIslandId}
            onCategoryClick={handleCategoryClick}
          />

          {/* Category legend */}
          <CategoryLegend
            sectors={legendSectors}
            onCategoryClick={handleCategoryClick}
            activeCategoryId={selectedCategory}
          />

          {/* Detail panel */}
          {selectedActivity && (
            <CategoryDetailPanel
              activity={selectedActivity}
              onClose={() => setSelectedCategory(null)}
            />
          )}
        </>
      )}

      {/* Island list (top-left) */}
      {islandEntries.length > 0 && (
        <div className="absolute left-4 top-4 z-40 flex flex-col gap-1 rounded-lg border border-white/10 bg-[#12121a]/80 p-2 backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-widest text-white/30 px-1">
            Islands ({islandEntries.length})
          </div>
          {islandEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setSelectedIslandId(entry.id)}
              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors ${
                selectedIslandId === entry.id
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "text-white/70 hover:bg-white/5"
              }`}
            >
              <span className="font-mono truncate max-w-[180px]">
                {entry.label}
              </span>
              <span className="text-[10px] text-white/30">
                {entry.data.totalApiCalls.toLocaleString()}
              </span>
              <button
                onClick={() => removeIsland(entry.id)}
                className="text-white/20 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Left panel — tabs + content */}
      <div className="absolute left-4 bottom-4 z-40 flex flex-col gap-3">
        {/* Tab buttons */}
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

        {/* Tab content */}
        {activeTab === "simulator" && (
          <SimulatorPanel onDataChange={handleSimulatorChange} />
        )}

        {activeTab === "presets" && (
          <PresetSelector
            onSelect={handlePresetSelect}
            activePresetId={null}
          />
        )}

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
                Terraform으로 CelestaReadOnly Role을 생성한 후, Role ARN을
                입력하세요.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Title overlay when no islands */}
      {islands.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-[0.15em] text-indigo-400 sm:text-5xl">
              CLOUD ISLAND
            </h1>
            <p className="mt-2 text-sm text-white/30">
              AWS Infrastructure 3D Visualizer
            </p>
            <p className="mt-4 text-xs text-white/15">
              Use the panel on the left to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


