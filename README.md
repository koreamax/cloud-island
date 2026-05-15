# Cloud Island

AWS CloudTrail 활동 로그를 3D 클라우드 군도와 우주 탐험 인터페이스로 시각화하는 서비스입니다.

- 배포 URL: https://d3lxec0zrny29n.cloudfront.net/
- 기술 스택: Next.js 16, React 19, TypeScript, Three.js, React Three Fiber, Tailwind CSS v4, AWS SDK v3, Terraform
- 배포 구조: S3 정적 호스팅, CloudFront CDN, API Gateway, Lambda, DynamoDB

## Problem 정의

AWS 계정의 인프라 활동은 CloudTrail에 자세히 기록되지만, 일반적인 로그 테이블이나 콘솔 화면만으로는 전체 사용 패턴을 직관적으로 파악하기 어렵습니다. 어떤 서비스 카테고리가 많이 쓰이는지, 에러가 어디에 집중되는지, 여러 계정 또는 팀의 활동량 차이가 어떤지 한눈에 비교하기 힘듭니다.

Cloud Island는 CloudTrail 이벤트를 서비스 카테고리별로 집계하고, 이를 3D 공간의 섬과 궤도, 색상, 이펙트로 변환합니다. 사용자는 숫자 중심 로그를 직접 뒤지는 대신, AWS 계정의 활동 상태를 시각적으로 탐색할 수 있습니다.

## 서비스 개요

Cloud Island는 AWS 인프라 활동을 “섬”으로 표현합니다. 각 섬은 하나의 AWS 계정 또는 프리셋 환경을 나타내고, 섬의 크기와 구성은 API 호출량, 에러 수, 서비스 카테고리 분포에 따라 달라집니다.

현재 공개 배포 버전은 다음 흐름을 제공합니다.

- 기본 프리셋 섬 5종: 스타트업, 데이터팀, ML팀, 엔터프라이즈, 보안팀
- 7개 AWS 서비스 카테고리: Compute, Storage, Database, Networking, Security, Management, AI/ML
- `Simulator`: 카테고리별 활동량과 에러율을 조정해 즉시 3D 결과 확인
- `Connect AWS`: AWS Role ARN을 입력해 실제 CloudTrail 기반 데이터 동기화
- `Space Explore`: 사용자가 우주 공간을 직접 비행하며 섬을 탐색
- `Leaderboard`: 전체 섬을 총 API 호출량 기준으로 정렬

공개 페이지의 기본 카테고리 활동량은 다음과 같습니다.

| 카테고리 | 기본 활동량 |
| --- | ---: |
| Compute | 12.0k |
| Storage | 8.0k |
| Database | 3.0k |
| Networking | 2.0k |
| Security | 4.0k |
| Management | 1.5k |
| AI/ML | 1.2k |

## 아키텍처 설계

![Cloud Island Architecture](docs/image.png)

Cloud Island는 정적 프론트엔드와 서버리스 백엔드로 구성됩니다.

- 프론트엔드는 Next.js static export 결과물인 `out/`을 S3에 업로드하고 CloudFront로 제공합니다.
- Terraform은 배포 시 `runtime-config.json`을 생성해 API Gateway URL을 프론트엔드에 주입합니다.
- API Gateway는 Lambda 함수와 연결되어 CloudTrail 동기화, 저장된 섬 조회, 플레이어 상태 동기화를 처리합니다.
- `sync` Lambda는 입력받은 Role ARN으로 STS AssumeRole을 수행하고 CloudTrail `LookupEvents`를 호출합니다.
- CloudTrail 이벤트는 7개 서비스 카테고리로 집계된 뒤 DynamoDB에 최신 스냅샷으로 저장됩니다.
- `island` Lambda는 저장된 섬 목록, 특정 계정의 섬 데이터, Space Explore 플레이어 상태를 제공합니다.

핵심 API는 다음과 같습니다.

| 경로 | 역할 |
| --- | --- |
| `POST /sync` | Role ARN 기반 CloudTrail 동기화 및 스냅샷 저장 |
| `GET /island?accountId=...` | 특정 AWS 계정의 최신 섬 데이터 조회 |
| `GET /islands` | 저장된 섬 목록 조회 |
| `GET /players` | 현재 활성화된 Space Explore 플레이어 조회 |
| `POST /players` | 플레이어 위치와 상태 업데이트 |

## 주요 기능 설명

### 1. CloudTrail 기반 시각화

AWS Role ARN을 입력하면 백엔드가 해당 역할을 AssumeRole하고 최근 CloudTrail 이벤트를 조회합니다. 이벤트 소스는 Compute, Storage, Database, Networking, Security, Management, AI/ML 카테고리로 분류되며, API 호출량과 에러 수에 따라 3D 섬의 형태와 이펙트가 달라집니다.

### 2. 3D 클라우드 군도 렌더링

Three.js와 React Three Fiber를 사용해 여러 섬을 하나의 우주 공간에 배치합니다. 섬은 활동량 기준으로 배치되고, 선택한 섬의 상세 정보와 카테고리별 활동 내역을 패널에서 확인할 수 있습니다.

### 3. Simulator

실제 AWS 연결 없이도 카테고리별 API 호출량과 에러율을 조정해 섬이 어떻게 변하는지 확인할 수 있습니다. 데모, 발표, 테스트 환경에서 빠르게 서비스 컨셉을 보여주기 위한 기능입니다.

### 4. Space Explore

`Space Explore` 모드에서는 사용자가 3D 공간을 직접 비행하며 섬을 탐색합니다. WASD, 방향키, Space/E, Shift/Q 조작을 통해 섬 사이를 이동할 수 있고, 다른 활성 플레이어의 위치도 공유됩니다.

### 5. 저장된 섬과 리더보드

성공적으로 동기화된 AWS 계정은 DynamoDB에 최신 스냅샷으로 저장됩니다. 프론트엔드는 저장된 섬을 불러와 군도에 추가하고, 총 API 호출량 기준으로 상위 섬을 리더보드에 표시합니다.

## 실행 방법

```bash
npm install
npm run dev
```

로컬에서는 http://localhost:3000 에서 확인할 수 있습니다.

## 배포 방법

```bash
npm run build:deploy
cd aws
terraform init
terraform plan
terraform apply
```

자세한 배포 절차는 `docs/deployment.md`를 참고하세요.
