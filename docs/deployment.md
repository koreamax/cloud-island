# 배포 문서

Cloud Island는 S3와 CloudFront를 통해 정적 Next.js 프론트엔드를 제공하고, API Gateway와 Lambda로 CloudTrail 동기화, 저장된 섬 조회, Space Explore 플레이어 상태 동기화를 처리합니다.

배포 URL:

https://d3lxec0zrny29n.cloudfront.net/

## 인프라 구성

- 프론트엔드: Next.js static export 결과물인 `out/`을 S3에 업로드합니다.
- CDN: CloudFront가 S3를 Origin으로 사용하며, Origin Access Control로 비공개 버킷 접근을 제어합니다.
- SPA 라우팅: CloudFront의 403/404 응답을 `index.html`로 돌려 단일 페이지 앱 라우팅을 지원합니다.
- 런타임 설정: Terraform이 `runtime-config.json`을 생성하고 API Gateway URL을 주입합니다.
- API: API Gateway HTTP API가 Lambda 함수와 연결됩니다.
- Lambda: Node.js 20 런타임으로 `backend/lambdas/*`의 컴파일 결과를 실행합니다.
- 데이터 저장소: DynamoDB가 섬 스냅샷과 활성 플레이어 상태를 저장합니다.
- AWS 동기화: `sync` Lambda가 `CelestaReadOnly` 역할을 AssumeRole하고 CloudTrail `LookupEvents`를 호출합니다.

## 빌드

Terraform 적용 전에 배포용 빌드를 먼저 실행합니다.

```bash
npm run build:deploy
```

이 명령은 다음 산출물을 생성합니다.

- `out/`: S3에 업로드할 정적 프론트엔드 파일
- `dist/`: Lambda 실행에 필요한 컴파일된 JavaScript 파일
- `dist/lambda-bundle.zip`: Terraform archive provider가 생성하는 Lambda 번들

## Terraform 변수

로컬에 `aws/terraform.tfvars`를 생성합니다.

```hcl
frontend_bucket_name = "your-unique-s3-bucket-name"
```

선택 가능한 기본 변수는 `aws/variables.tf`에 정의되어 있습니다.

```hcl
aws_region             = "ap-northeast-2"
aws_profile            = "roomeya"
project_name           = "cloud-island"
frontend_artifact_path = "../out"
```

`aws/terraform.tfvars`는 환경별 로컬 설정이므로 커밋하지 않습니다.

## 배포

```bash
cd aws
terraform init
terraform plan
terraform apply
```

배포 후 Terraform은 다음 값을 출력합니다.

- `cloudfront_domain_name`: 공개 프론트엔드 도메인
- `api_base_url`: `runtime-config.json`에 기록되는 API Gateway 기본 URL
- `role_arn`: Connect AWS 흐름에서 사용할 Role ARN
- `account_id`: Terraform이 적용된 AWS 계정 ID

## API 경로

| 경로 | Lambda | 역할 |
| --- | --- | --- |
| `POST /sync` | `sync` | Role ARN으로 CloudTrail을 동기화하고 최신 스냅샷 저장 |
| `GET /island?accountId=...` | `island` | 특정 계정의 최신 섬 데이터 조회 |
| `GET /islands` | `island` | 저장된 최신 섬 목록 조회 |
| `GET /players` | `island` | 활성 Space Explore 플레이어 목록 조회 |
| `POST /players` | `island` | 플레이어 위치와 상태 업데이트 |

## 배포 검증

1. CloudFront URL에 접속해 앱이 정상 로드되는지 확인합니다.
2. `https://<cloudfront-domain>/runtime-config.json`에 `apiBaseUrl`이 들어 있는지 확인합니다.
3. Terraform 출력의 `role_arn`을 `Connect AWS`에 입력해 동기화를 테스트합니다.
4. 동기화 성공 후 `/islands`에서 저장된 스냅샷이 반환되는지 확인합니다.
5. 커밋 전 `npm run lint`를 실행해 문서 외 코드 상태도 함께 확인합니다.
