/**
 * AWS Service Categories — 7 color-coded groups using official AWS palette.
 */

export interface AWSCategory {
  id: string;
  label: string;
  color: string; // hex color for voxel rendering
  services: string[];
}

export const AWS_CATEGORIES: AWSCategory[] = [
  {
    id: "compute",
    label: "Compute",
    color: "#FF6B2B", // neon orange
    services: [
      "ec2.amazonaws.com",
      "lambda.amazonaws.com",
      "ecs.amazonaws.com",
      "eks.amazonaws.com",
      "fargate.amazonaws.com",
      "lightsail.amazonaws.com",
      "batch.amazonaws.com",
      "elasticbeanstalk.amazonaws.com",
    ],
  },
  {
    id: "storage",
    label: "Storage",
    color: "#39FF14", // neon green
    services: [
      "s3.amazonaws.com",
      "ebs.amazonaws.com",
      "efs.amazonaws.com",
      "glacier.amazonaws.com",
      "fsx.amazonaws.com",
      "storagegateway.amazonaws.com",
      "backup.amazonaws.com",
    ],
  },
  {
    id: "database",
    label: "Database",
    color: "#4D7FFF", // electric blue
    services: [
      "rds.amazonaws.com",
      "dynamodb.amazonaws.com",
      "elasticache.amazonaws.com",
      "redshift.amazonaws.com",
      "neptune.amazonaws.com",
      "docdb.amazonaws.com",
      "keyspaces.amazonaws.com",
      "memorydb.amazonaws.com",
      "aurora.amazonaws.com",
    ],
  },
  {
    id: "networking",
    label: "Networking",
    color: "#B44DFF", // vivid violet
    services: [
      "elasticloadbalancing.amazonaws.com",
      "cloudfront.amazonaws.com",
      "route53.amazonaws.com",
      "apigateway.amazonaws.com",
      "vpc.amazonaws.com",
      "directconnect.amazonaws.com",
      "globalaccelerator.amazonaws.com",
      "transitgateway.amazonaws.com",
    ],
  },
  {
    id: "security",
    label: "Security",
    color: "#FF2D55", // hot crimson
    services: [
      "iam.amazonaws.com",
      "sts.amazonaws.com",
      "kms.amazonaws.com",
      "secretsmanager.amazonaws.com",
      "acm.amazonaws.com",
      "waf.amazonaws.com",
      "guardduty.amazonaws.com",
      "inspector.amazonaws.com",
      "securityhub.amazonaws.com",
      "macie.amazonaws.com",
      "cognito-idp.amazonaws.com",
      "cognito-identity.amazonaws.com",
    ],
  },
  {
    id: "management",
    label: "Management",
    color: "#FF0080", // hot magenta
    services: [
      "cloudtrail.amazonaws.com",
      "cloudwatch.amazonaws.com",
      "config.amazonaws.com",
      "ssm.amazonaws.com",
      "organizations.amazonaws.com",
      "cloudformation.amazonaws.com",
      "servicecatalog.amazonaws.com",
      "trustedadvisor.amazonaws.com",
      "health.amazonaws.com",
      "sns.amazonaws.com",
      "sqs.amazonaws.com",
      "events.amazonaws.com",
      "eventbridge.amazonaws.com",
    ],
  },
  {
    id: "aiml",
    label: "AI/ML",
    color: "#00FFD4", // neon cyan
    services: [
      "sagemaker.amazonaws.com",
      "bedrock.amazonaws.com",
      "comprehend.amazonaws.com",
      "rekognition.amazonaws.com",
      "textract.amazonaws.com",
      "translate.amazonaws.com",
      "polly.amazonaws.com",
      "transcribe.amazonaws.com",
      "dms.amazonaws.com",
      "glue.amazonaws.com",
      "athena.amazonaws.com",
      "emr.amazonaws.com",
      "kinesis.amazonaws.com",
    ],
  },
];

/** Map from service domain to category for O(1) lookup */
const SERVICE_TO_CATEGORY = new Map<string, string>();
for (const cat of AWS_CATEGORIES) {
  for (const svc of cat.services) {
    SERVICE_TO_CATEGORY.set(svc, cat.id);
  }
}

/** Categorize an AWS service domain into one of the 7 categories */
export function categorizeService(eventSource: string): string {
  return SERVICE_TO_CATEGORY.get(eventSource) ?? "management";
}

/** Get category definition by ID */
export function getCategoryById(id: string): AWSCategory | undefined {
  return AWS_CATEGORIES.find((c) => c.id === id);
}
