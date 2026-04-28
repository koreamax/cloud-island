/**
 * Mock CloudTrail aggregation data for frontend development.
 */

import type { IslandData } from "./cloud-island";

export const MOCK_ISLAND_DATA: IslandData = {
  accountId: "123456789012",
  dateRange: { start: "2025-12-01", end: "2026-02-28" },
  totalApiCalls: 48720,
  totalErrors: 312,
  categories: [
    {
      categoryId: "compute",
      apiCallCount: 15200,
      errorCount: 89,
      resourceCount: 42,
      topServices: [
        { service: "ec2.amazonaws.com", count: 8400 },
        { service: "lambda.amazonaws.com", count: 5100 },
        { service: "ecs.amazonaws.com", count: 1700 },
      ],
      principals: [
        { principal: "admin-user", count: 7600 },
        { principal: "deploy-role", count: 5200 },
        { principal: "ci-cd-pipeline", count: 2400 },
      ],
    },
    {
      categoryId: "storage",
      apiCallCount: 9800,
      errorCount: 23,
      resourceCount: 85,
      topServices: [
        { service: "s3.amazonaws.com", count: 8900 },
        { service: "efs.amazonaws.com", count: 600 },
        { service: "glacier.amazonaws.com", count: 300 },
      ],
      principals: [
        { principal: "app-service", count: 6200 },
        { principal: "backup-role", count: 2400 },
        { principal: "admin-user", count: 1200 },
      ],
    },
    {
      categoryId: "database",
      apiCallCount: 6500,
      errorCount: 45,
      resourceCount: 12,
      topServices: [
        { service: "dynamodb.amazonaws.com", count: 3800 },
        { service: "rds.amazonaws.com", count: 2200 },
        { service: "elasticache.amazonaws.com", count: 500 },
      ],
      principals: [
        { principal: "app-service", count: 4500 },
        { principal: "admin-user", count: 2000 },
      ],
    },
    {
      categoryId: "networking",
      apiCallCount: 4200,
      errorCount: 12,
      resourceCount: 28,
      topServices: [
        { service: "elasticloadbalancing.amazonaws.com", count: 1800 },
        { service: "cloudfront.amazonaws.com", count: 1200 },
        { service: "route53.amazonaws.com", count: 800 },
        { service: "apigateway.amazonaws.com", count: 400 },
      ],
      principals: [
        { principal: "infra-team", count: 2800 },
        { principal: "admin-user", count: 1400 },
      ],
    },
    {
      categoryId: "security",
      apiCallCount: 8900,
      errorCount: 120,
      resourceCount: 15,
      topServices: [
        { service: "iam.amazonaws.com", count: 4200 },
        { service: "sts.amazonaws.com", count: 3500 },
        { service: "kms.amazonaws.com", count: 800 },
        { service: "guardduty.amazonaws.com", count: 400 },
      ],
      principals: [
        { principal: "admin-user", count: 5000 },
        { principal: "security-audit", count: 2900 },
        { principal: "ci-cd-pipeline", count: 1000 },
      ],
    },
    {
      categoryId: "management",
      apiCallCount: 3200,
      errorCount: 18,
      resourceCount: 8,
      topServices: [
        { service: "cloudwatch.amazonaws.com", count: 1500 },
        { service: "cloudtrail.amazonaws.com", count: 800 },
        { service: "ssm.amazonaws.com", count: 600 },
        { service: "config.amazonaws.com", count: 300 },
      ],
      principals: [
        { principal: "monitoring-role", count: 2000 },
        { principal: "admin-user", count: 1200 },
      ],
    },
    {
      categoryId: "aiml",
      apiCallCount: 920,
      errorCount: 5,
      resourceCount: 6,
      topServices: [
        { service: "sagemaker.amazonaws.com", count: 400 },
        { service: "bedrock.amazonaws.com", count: 350 },
        { service: "glue.amazonaws.com", count: 170 },
      ],
      principals: [
        { principal: "ml-pipeline", count: 600 },
        { principal: "data-scientist", count: 320 },
      ],
    },
  ],
};

/** Helper to build IslandData from category call/error arrays */
function buildPreset(
  name: string,
  calls: [number, number, number, number, number, number, number],
  errors: [number, number, number, number, number, number, number],
): IslandData {
  const categoryIds = ["compute", "storage", "database", "networking", "security", "management", "aiml"] as const;
  const serviceExamples: Record<string, { service: string; count: number }[]> = {
    compute: [
      { service: "ec2.amazonaws.com", count: 0 },
      { service: "lambda.amazonaws.com", count: 0 },
    ],
    storage: [
      { service: "s3.amazonaws.com", count: 0 },
      { service: "efs.amazonaws.com", count: 0 },
    ],
    database: [
      { service: "dynamodb.amazonaws.com", count: 0 },
      { service: "rds.amazonaws.com", count: 0 },
    ],
    networking: [
      { service: "elasticloadbalancing.amazonaws.com", count: 0 },
      { service: "cloudfront.amazonaws.com", count: 0 },
    ],
    security: [
      { service: "iam.amazonaws.com", count: 0 },
      { service: "sts.amazonaws.com", count: 0 },
    ],
    management: [
      { service: "cloudwatch.amazonaws.com", count: 0 },
      { service: "cloudtrail.amazonaws.com", count: 0 },
    ],
    aiml: [
      { service: "sagemaker.amazonaws.com", count: 0 },
      { service: "bedrock.amazonaws.com", count: 0 },
    ],
  };

  const categories = categoryIds.map((id, i) => {
    const apiCallCount = calls[i];
    const svcs = serviceExamples[id].map((s, j) => ({
      ...s,
      count: j === 0 ? Math.round(apiCallCount * 0.6) : Math.round(apiCallCount * 0.4),
    }));
    return {
      categoryId: id,
      apiCallCount,
      errorCount: errors[i],
      resourceCount: Math.round(apiCallCount / 200) + 1,
      topServices: svcs,
      principals: [
        { principal: "primary-user", count: Math.round(apiCallCount * 0.7) },
        { principal: "secondary-user", count: Math.round(apiCallCount * 0.3) },
      ],
    };
  });

  return {
    accountId: `preset-${name}`,
    dateRange: { start: "2026-01-01", end: "2026-03-01" },
    totalApiCalls: calls.reduce((a, b) => a + b, 0),
    totalErrors: errors.reduce((a, b) => a + b, 0),
    categories,
  };
}

export interface PresetInfo {
  id: string;
  label: string;
  description: string;
  data: IslandData;
}

export const PRESET_DATA: PresetInfo[] = [
  {
    id: "startup",
    label: "스타트업",
    description: "Compute + Storage 중심, AI/ML 약간",
    data: buildPreset("startup",
      [12000, 8000, 3000, 2000, 4000, 1500, 1200],
      [60, 20, 15, 5, 40, 8, 5],
    ),
  },
  {
    id: "data-team",
    label: "데이터팀",
    description: "Database + AI/ML 강세, Storage 높음",
    data: buildPreset("data-team",
      [5000, 11000, 14000, 2500, 3000, 2000, 12000],
      [30, 45, 70, 10, 25, 12, 55],
    ),
  },
  {
    id: "ml-team",
    label: "ML팀",
    description: "AI/ML 압도적, Compute 높음",
    data: buildPreset("ml-team",
      [14000, 6000, 4000, 2000, 3500, 1800, 18000],
      [70, 25, 20, 8, 30, 10, 90],
    ),
  },
  {
    id: "enterprise",
    label: "엔터프라이즈",
    description: "모든 카테고리 균일하게 높음",
    data: buildPreset("enterprise",
      [15000, 13000, 12000, 11000, 14000, 10000, 9000],
      [75, 55, 60, 45, 80, 50, 40],
    ),
  },
  {
    id: "security-team",
    label: "보안팀",
    description: "Security + Management 압도적, 에러 많음",
    data: buildPreset("security-team",
      [4000, 2000, 1500, 3000, 18000, 16000, 800],
      [80, 15, 12, 30, 450, 320, 5],
    ),
  },
];

/** Generate random variation of mock data for testing */
export function generateRandomIslandData(accountId: string): IslandData {
  const categories = MOCK_ISLAND_DATA.categories.map((cat) => {
    const multiplier = 0.3 + Math.random() * 2;
    const apiCallCount = Math.round(cat.apiCallCount * multiplier);
    const errorCount = Math.round(cat.errorCount * multiplier * (0.5 + Math.random()));
    return {
      ...cat,
      apiCallCount,
      errorCount,
      topServices: cat.topServices.map((s) => ({
        ...s,
        count: Math.round(s.count * multiplier),
      })),
      principals: cat.principals.map((p) => ({
        ...p,
        count: Math.round(p.count * multiplier),
      })),
    };
  });

  return {
    accountId,
    dateRange: MOCK_ISLAND_DATA.dateRange,
    totalApiCalls: categories.reduce((s, c) => s + c.apiCallCount, 0),
    totalErrors: categories.reduce((s, c) => s + c.errorCount, 0),
    categories,
  };
}
