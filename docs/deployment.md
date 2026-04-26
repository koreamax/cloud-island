# Deployment

## Architecture

- Frontend: static Next.js export uploaded to S3 and served through CloudFront
- Backend: Lambda functions behind API Gateway HTTP API
- Data: DynamoDB table reserved for snapshot storage

## Build artifacts

Run this before Terraform:

```bash
npm run build:deploy
```

It creates:

- `out/` for the static frontend
- `dist/backend/lambdas/*` for Lambda JavaScript output

Terraform zips the compiled Lambda folders and uploads the frontend files from `out/`.

## Terraform flow

Create a `terraform.tfvars` in `aws/`:

```hcl
frontend_bucket_name = "your-unique-bucket-name"
```

Then deploy:

```bash
cd aws
terraform init
terraform plan
terraform apply
```

## Important note

Terraform manages the infrastructure and can upload already-built frontend and Lambda artifacts.
The actual application build step still happens before `terraform apply`.

You can force Terraform to run local build commands with `local-exec`, but that is usually less reliable than keeping build and infrastructure as separate steps.
