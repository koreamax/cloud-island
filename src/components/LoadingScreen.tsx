"use client";

import { useState, useEffect, useCallback } from "react";

export type LoadingStage =
  | "init"
  | "fetching"
  | "generating"
  | "rendering"
  | "ready"
  | "done"
  | "error";

interface LoadingScreenProps {
  stage: LoadingStage;
  progress: number;
  error: string | null;
  onRetry: () => void;
  onFadeComplete: () => void;
}

const STAGE_MESSAGES: Record<string, string> = {
  init: "Initializing...",
  fetching: "Fetching cloud data...",
  generating: "Generating island terrain...",
  rendering: "Rendering voxels...",
  ready: "Welcome to Cloud Island",
};

const TIPS = [
  "Click any cloud sector to see service details",
  "Larger sectors = more API activity",
  "Red particles indicate error hotspots",
  "Drag to rotate, scroll to zoom",
  "Each color represents an AWS service category",
];

export default function LoadingScreen({
  stage,
  progress,
  error,
  onRetry,
  onFadeComplete,
}: LoadingScreenProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const shouldFade = stage === "ready";
  if (shouldFade && !fading) {
    setFading(true);
  }

  const handleTransitionEnd = useCallback(() => {
    if (fading) onFadeComplete();
  }, [fading, onFadeComplete]);

  const isError = stage === "error";
  const message = isError ? error : STAGE_MESSAGES[stage] ?? "";

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a14] transition-opacity duration-[600ms] ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Cloud decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-indigo-500"
            style={{
              width: 80 + i * 40,
              height: 30 + i * 15,
              left: `${10 + i * 15}%`,
              top: `${60 + (i % 3) * 10}%`,
              filter: "blur(20px)",
            }}
          />
        ))}
      </div>

      <h1 className="text-3xl font-bold tracking-[0.15em] text-indigo-400 sm:text-4xl">
        CLOUD ISLAND
      </h1>
      <p className="mt-1 text-xs tracking-wider text-white/30">
        AWS Infrastructure Visualizer
      </p>

      <p className="mt-6 text-sm tracking-wider text-white/50">{message}</p>

      {!isError && (
        <div className="mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-white/10 sm:w-72">
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}

      {isError && (
        <button
          onClick={onRetry}
          className="btn-premium mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
        >
          Retry
        </button>
      )}

      {!isError && (
        <p className="mt-8 max-w-xs text-center text-xs leading-relaxed text-white/25">
          {TIPS[tipIndex]}
        </p>
      )}
    </div>
  );
}
