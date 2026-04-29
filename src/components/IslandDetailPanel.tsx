"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { IslandData } from "@/lib/cloud-island";
import { getCategoryById } from "@/lib/aws-categories";

interface IslandDetailPanelProps {
  islandLabel: string;
  islandData: IslandData;
  onClose: () => void;
  actionSlot?: ReactNode;
}

export default function IslandDetailPanel({
  islandLabel,
  islandData,
  onClose,
  actionSlot,
}: IslandDetailPanelProps) {
  const categories = [...islandData.categories]
    .filter((category) => category.apiCallCount > 0)
    .sort((left, right) => right.apiCallCount - left.apiCallCount);

  const errorRate =
    islandData.totalApiCalls > 0
      ? ((islandData.totalErrors / islandData.totalApiCalls) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="panel-premium absolute right-4 top-20 z-40 max-h-[calc(100vh-6.5rem)] w-[23.5rem] overflow-hidden rounded-[1.8rem] text-white">
      <div className="flex items-start justify-between gap-4 border-b border-white/8 px-4 pb-4 pt-5">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/35">
            Selected Planet
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {islandLabel}
          </h2>
          <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/46">
            Account {islandData.accountId}
          </div>
        </div>
        <button
          onClick={onClose}
          className="btn-glass rounded-full p-2 text-white/55"
        >
          <X size={18} className="text-white/55" />
        </button>
      </div>

      <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-4 pb-4 pt-4">
        {actionSlot && <div className="mb-4">{actionSlot}</div>}

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="stat-card-premium rounded-2xl p-3">
            <div className="text-xl font-semibold text-white">
              {islandData.totalApiCalls.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/42">
              API Calls
            </div>
          </div>
          <div className="stat-card-premium rounded-2xl p-3">
            <div className="text-xl font-semibold text-rose-200">
              {islandData.totalErrors.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/42">
              Errors
            </div>
          </div>
          <div className="stat-card-premium rounded-2xl p-3">
            <div className="text-xl font-semibold text-emerald-200">{errorRate}%</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/42">
              Error Rate
            </div>
          </div>
        </div>

        <div className="panel-section mb-4 rounded-2xl px-3 py-2 text-[11px] text-white/48">
          {new Date(islandData.dateRange.start).toLocaleString()} to{" "}
          {new Date(islandData.dateRange.end).toLocaleString()}
        </div>

        <div className="space-y-2 pr-1">
          {categories.map((category) => {
            const categoryMeta = getCategoryById(category.categoryId);
            if (!categoryMeta) return null;

            const activityRatio =
              islandData.totalApiCalls > 0
                ? (category.apiCallCount / islandData.totalApiCalls) * 100
                : 0;

            return (
              <div
                key={category.categoryId}
                className="panel-section rounded-2xl p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
                      style={{ backgroundColor: categoryMeta.color, color: categoryMeta.color }}
                    />
                    <div className="text-sm font-medium text-white/86">{categoryMeta.label}</div>
                  </div>
                  <div className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[11px] text-white/45">
                    {category.apiCallCount.toLocaleString()} calls
                  </div>
                </div>

                <div className="mb-3 h-2 rounded-full bg-white/10 shadow-inner shadow-black/30">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${activityRatio}%`,
                      boxShadow: `0 0 18px ${categoryMeta.color}66`,
                      backgroundColor: categoryMeta.color,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-xl border border-white/6 bg-black/10 px-2 py-2 text-white/58">
                    Resources {category.resourceCount.toLocaleString()}
                  </div>
                  <div className="rounded-xl border border-white/6 bg-black/10 px-2 py-2 text-white/58">
                    Errors {category.errorCount.toLocaleString()}
                  </div>
                  <div className="rounded-xl border border-white/6 bg-black/10 px-2 py-2 text-white/58">
                    Top {category.topServices[0]?.service.replace(".amazonaws.com", "") ?? "-"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
