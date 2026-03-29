# Celesta — AWS Cloud Island

AWS CloudTrail 로그를 3D 복셀 구름 섬으로 시각화하는 플랫폼.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Three.js](https://img.shields.io/badge/Three.js-r183-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

---

## 중간 발표 제출 정보

| 항목 | 내용 |
|------|------|
| **팀명** | Stelloude |
| **기여자** | 고동현 (Gosorasora), 이민형 (koreamax)|
| **역할 분담** | 고동현 — 기획, 3D 시각화 엔진, 백엔드 API, AWS 인프라 설계 / 이민형 — 날씨 효과, 풍선 오브젝트, 카메라 줌 수정

### 서비스 개요

AWS CloudTrail 로그를 수집·집계하여, AWS 계정의 인프라 활동을 **3D 복셀 구름 섬(라퓨타 스타일)**으로 시각화하는 웹 플랫폼입니다.

- AWS 서비스 7개 카테고리(Compute, Storage, Networking, Security, Management, Database, AI/ML)를 AWS 공식 색상으로 구분
- API 호출 수 → 구름 두께, 리소스 수 → 구름 면적, 에러율 → 빨간 파티클로 매핑
- **시뮬레이터 모드**: AWS 계정 없이 슬라이더로 섬 변화를 실시간 체험
- **프리셋 모드**: 스타트업, 데이터팀, ML팀, 엔터프라이즈, 보안팀 등 5종 샘플
- **실제 연결 모드**: IAM Role ARN 입력으로 실제 CloudTrail 데이터를 연결하여 시각화

### 서비스 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js 16 (App Router)                      │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │   │
│  │  │ Simulator  │  │  Presets   │  │   Connect AWS      │  │   │
│  │  │ (슬라이더) │  │ (샘플 5종) │  │ (Role ARN 입력)    │  │   │
│  │  └─────┬──────┘  └─────┬──────┘  └────────┬───────────┘  │   │
│  │        └───────────────┼───────────────────┘              │   │
│  │                        ▼                                  │   │
│  │        ┌──────────────────────────────┐                   │   │
│  │        │  Three.js + R3F + Drei       │                   │   │
│  │        │  3D 복셀 구름 섬 렌더링 엔진  │                   │   │
│  │        │  (InstancedMesh + GLSL 셰이더 │                   │
│  │        │   + Bloom 후처리)             │                   │   │
│  │        └──────────────────────────────┘                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    API Routes (Next.js)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      /api/island        /api/sync       /api/connect
      (Mock 데이터)    (CloudTrail 동기화)  (Role 등록)
                              │
                              ▼
                   ┌─────────────────────┐
                   │  AWS STS            │
                   │  AssumeRole         │
                   │  (ExternalId 검증)  │
                   └────────┬────────────┘
                            ▼
                   ┌─────────────────────┐
                   │  AWS CloudTrail     │
                   │  LookupEvents       │
                   │  (90일 무료 로그)    │
                   └────────┬────────────┘
                            ▼
                   메모리에서 카테고리별 집계
                   (원본 이벤트 저장 안 함)
                            ▼
                   ┌─────────────────────┐
                   │  Supabase           │
                   │  (Auth + PostgreSQL) │
                   │  숫자만 DB 저장      │
                   └─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  유저 AWS 계정 (IAM Role만 생성, Lambda 없음, 비용 $0)           │
│  ┌─────────────────────────────────────────┐                    │
│  │  CloudFormation 원클릭 배포              │                    │
│  │  → CelestaReadOnly IAM Role 1개         │                    │
│  │  → cloudtrail:LookupEvents 읽기 권한만   │                    │
│  └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

**기술 스택 요약**

| 구분 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4 |
| 3D 렌더링 | Three.js r183, @react-three/fiber, @react-three/drei, postprocessing |
| 백엔드 | Next.js API Routes, AWS SDK (STS, CloudTrail) |
| 인프라 | AWS CloudFormation (IAM Role), Terraform |
| DB/Auth | Supabase (PostgreSQL + GitHub OAuth) |
| 배포 | Vercel (예정) |

**현재 구현 상태**

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 단일 섬 + Mock 데이터 + 시뮬레이터 모드 | 완료 |
| Phase 2 | 프리셋 5종 + 3탭 UI | 완료 |
| Phase 3 | CloudFormation 연결 플로우 + Supabase | 진행 예정 |
| Phase 4 | 멀티유저 군도(Archipelago) 뷰 | 진행 예정 |
| Phase 5 | 자동 동기화 + 실시간 트리거 | 진행 예정 |

---

## 컨셉

AWS 계정의 API 활동을 **라퓨타 스타일 하늘섬**으로 표현합니다.

- API 호출 수 → 구름 두께 (층 수)
- 리소스 수 → 구름 면적 (반경)
- 정상 이벤트 비율 → 발광(glow) 강도
- 에러/경고 → 빨간 파티클 효과

AWS 공식 카테고리 색상 7개를 사용:

| 색상 | 카테고리 | 대표 서비스 |
|------|---------|-----------|
| 🟠 `#ED7100` | Compute | EC2, Lambda, ECS |
| 🟢 `#7AA116` | Storage | S3, EBS, EFS |
| 🟣 `#8C4FFF` | Networking | VPC, CloudFront, API Gateway |
| 🔴 `#DD344C` | Security | IAM, GuardDuty, WAF |
| 🩷 `#E7157B` | Management | CloudWatch, SNS, SQS |
| 🔵 `#3334B9` | Database | RDS, DynamoDB, Aurora |
| 🩵 `#01A88D` | AI/ML | SageMaker, Bedrock |

## 시작하기

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인.

## 세 가지 진입점

```
┌────────────┐  ┌──────────┐  ┌──────────┐
│ Simulator  │  │ Presets  │  │ Real AWS │
│ (슬라이더) │  │ (샘플5종) │  │ (연결)   │
└─────┬──────┘  └────┬─────┘  └────┬─────┘
      └──────────────┼─────────────┘
                     ▼
           ┌────────────────┐
           │  3D 섬 렌더링  │
           │  (동일 엔진)   │
           └────────────────┘
```

- **Simulator** — 슬라이더로 카테고리별 활동량 조절, 섬이 실시간 변화 (AWS 계정 불필요)
- **Presets** — 원클릭 샘플 5종 (스타트업, 데이터팀, ML팀, 엔터프라이즈, 보안팀)
- **Connect AWS** — IAM Role ARN 입력으로 실제 CloudTrail 데이터 연결

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 메인 (3탭 UI)
│   ├── api/island/route.ts         # 섬 데이터 API (mock)
│   └── api/sync/route.ts           # CloudTrail 동기화
├── components/
│   ├── IslandCanvas.tsx            # R3F Canvas + Sky + Bloom + Controls
│   ├── IslandScene.tsx             # 단일 섬 씬 (베이스 + 복셀 + 파티클)
│   ├── IslandBase.tsx              # 라퓨타 스타일 플로팅 베이스
│   ├── InstancedVoxels.tsx         # 복셀 인스턴스 렌더링 + 커스텀 셰이더
│   ├── FallingParticles.tsx        # 범용 파티클 시스템 (떨어지는/떠오르는)
│   ├── ErrorParticles.tsx          # 에러 파티클 (FallingParticles 래퍼)
│   ├── CategoryLabels.tsx          # 카테고리 구역 라벨
│   ├── CategoryLegend.tsx          # 색상 범례 (UI 오버레이)
│   ├── CategoryDetailPanel.tsx     # 카테고리 상세 패널
│   ├── SimulatorPanel.tsx          # 슬라이더 시뮬레이터
│   ├── PresetSelector.tsx          # 프리셋 선택
│   ├── AccountInput.tsx            # AWS 계정 입력
│   └── LoadingScreen.tsx           # 로딩 화면
├── lib/
│   ├── cloud-island.ts             # 타입 정의 (IslandData, CloudVoxel 등)
│   ├── island-layout.ts            # 섬 레이아웃 알고리즘
│   ├── aws-categories.ts           # 7개 카테고리 정의
│   └── mock-data.ts                # 모의 데이터 + 프리셋 5종
aws/
├── main.tf                         # Terraform (IAM Role)
```

## 기술 스택

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Three.js** + @react-three/fiber + @react-three/drei + postprocessing
- **Tailwind CSS v4**
- **AWS SDK** (CloudTrail, STS)
- **Terraform** (IAM Role 프로비저닝)

## 개발 로드맵

```
Phase 1: 단일 섬 + mock 데이터 + 시뮬레이터 모드     ✅ 완료
Phase 2: 프리셋 5종 + 3탭 UI + 군도 배치             ✅ 완료
Phase 3: CloudFormation 연결 플로우 (Level 1 + 2)    ⬜ 다음
Phase 4: Supabase Auth + DB + 멀티유저 공개 설정      ⬜
Phase 5: 자동 동기화 (Cron) + 실시간 (EventBridge)   ⬜
```

### Phase 3 TODO

- [ ] CloudFormation 템플릿 (`role.yaml`) — IAM Role 1개, 비용 $0
- [ ] `/api/connect` — Role ARN 등록 API
- [ ] `/api/sync` — 실제 CloudTrail LookupEvents 연동
- [ ] QuickCreate URL 생성 (웹 원클릭 연결)
- [ ] CLI 설치 스크립트 (`aws/install.sh`)
- [ ] Supabase 테이블 생성 (`aws_connections`, `island_data`)

### Phase 4 TODO

- [ ] GitHub OAuth (Supabase Auth)
- [ ] 섬 공개 설정 (Private / Public / Shape Only)
- [ ] 군도(Archipelago) 뷰 — 멀티유저 섬 배치
- [ ] 개별 섬 상세 페이지 (`/island/[userId]`)

### Phase 5 TODO

- [ ] 6시간 자동 동기화 (Cron)
- [ ] EventBridge 실시간 트리거 (선택)
- [ ] 주간 스냅샷 히스토리

## AWS 연결 방법

유저 계정에 **IAM Role 1개만 생성** (Lambda 없음, 비용 $0).
`cloudtrail:LookupEvents` 읽기 권한만 부여.

```bash
# Terraform으로 Role 생성
cd aws/
terraform init && terraform apply

# 또는 CloudFormation (Phase 3 구현 후)
aws cloudformation deploy \
  --template-url https://celesta-templates.s3.amazonaws.com/role.yaml \
  --stack-name celesta \
  --capabilities CAPABILITY_NAMED_IAM
```

## 테스트용 이벤트 생성

```bash
cd aws/
chmod +x generate-events.sh
./generate-events.sh
# 읽기 전용 API만 호출 — 과금 $0, 리소스 생성 없음
```

## 커맨드

```bash
npm run dev      # 개발 서버 (Turbopack)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
```
