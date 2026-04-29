"use client";

import { useState, useCallback, useEffect } from "react";
import { AWS_CATEGORIES } from "@/lib/aws-categories";
import type { IslandData } from "@/lib/cloud-island";

interface SimulatorPanelProps {
  onDataChange: (data: IslandData) => void;
}

interface SliderState {
  [categoryId: string]: number;
}

const MAX_CALLS = 20000;
const MAX_ERROR_RATE = 20;

function buildIslandData(sliders: SliderState, errorRate: number): IslandData {
  const categories = AWS_CATEGORIES.map((cat) => {
    const apiCallCount = sliders[cat.id] ?? 0;
    const errorCount = Math.round(apiCallCount * (errorRate / 100));
    return {
      categoryId: cat.id,
      apiCallCount,
      errorCount,
      resourceCount: Math.round(apiCallCount / 200) + 1,
      topServices: cat.services.slice(0, 3).map((svc, i) => ({
        service: svc,
        count: Math.round(apiCallCount * (i === 0 ? 0.5 : i === 1 ? 0.3 : 0.2)),
      })),
      principals: [
        { principal: "simulator-user", count: Math.round(apiCallCount * 0.7) },
        { principal: "simulator-role", count: Math.round(apiCallCount * 0.3) },
      ],
    };
  });

  const totalApiCalls = categories.reduce((s, c) => s + c.apiCallCount, 0);
  const totalErrors = categories.reduce((s, c) => s + c.errorCount, 0);

  return {
    accountId: "simulator",
    dateRange: { start: "2026-01-01", end: "2026-03-01" },
    totalApiCalls,
    totalErrors,
    categories,
  };
}

export default function SimulatorPanel({ onDataChange }: SimulatorPanelProps) {
  const [sliders, setSliders] = useState<SliderState>(() => {
    const init: SliderState = {};
    for (const cat of AWS_CATEGORIES) {
      init[cat.id] = 3000;
    }
    return init;
  });
  const [errorRate, setErrorRate] = useState(2);

  const handleSliderChange = useCallback((categoryId: string, value: number) => {
    setSliders((prev) => ({ ...prev, [categoryId]: value }));
  }, []);

  // Emit data on every change
  useEffect(() => {
    onDataChange(buildIslandData(sliders, errorRate));
  }, [sliders, errorRate, onDataChange]);

  return (
    <div className="panel-premium flex w-80 flex-col gap-4 rounded-[1.6rem] p-4 text-white">
      <div>
        <div className="text-[10px] uppercase tracking-[0.34em] text-cyan-100/38">
          Command Deck
        </div>
        <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/72">
          Simulator
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card-premium rounded-2xl px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
            Total Calls
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {Object.values(sliders)
              .reduce((sum, value) => sum + value, 0)
              .toLocaleString()}
          </div>
        </div>
        <div className="stat-card-premium rounded-2xl px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
            Error Rate
          </div>
          <div className="mt-2 text-lg font-semibold text-rose-200">
            {errorRate}%
          </div>
        </div>
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-white/44">
        Sector Controls
      </h3>

      {AWS_CATEGORIES.map((cat) => (
        <div key={cat.id} className="panel-section rounded-2xl px-3 py-3">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
              style={{ backgroundColor: cat.color, color: cat.color }}
            />
            <span className="text-xs font-medium text-white/74">{cat.label}</span>
            <span className="ml-auto rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/38">
              {(sliders[cat.id] ?? 0).toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={MAX_CALLS}
            step={100}
            value={sliders[cat.id] ?? 0}
            onChange={(e) => handleSliderChange(cat.id, Number(e.target.value))}
            className="range-premium w-full cursor-pointer"
          />
        </div>
      ))}

      <div className="panel-section mt-1 rounded-2xl px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-rose-200/68">
            Error Rate
          </span>
          <span className="ml-auto rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/38">
            {errorRate}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_ERROR_RATE}
          step={0.5}
          value={errorRate}
          onChange={(e) => setErrorRate(Number(e.target.value))}
          className="range-premium w-full cursor-pointer"
        />
      </div>
    </div>
  );
}
