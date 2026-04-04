# Cloud Island

AWS CloudTrail 로그를 3D 우주 궤도 시스템으로 시각화하는 웹 플랫폼.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Three.js](https://img.shields.io/badge/Three.js-r183-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

---

## 팀 정보

- **팀명** : Stelloud
- **기여자** : 고동현, 이민형
- **역할 분담** :
    - 고동현 : 아이디어, AWS CloudTrail 로그 파싱, 3D 시각화
    - 이민형 : 이벤트 기반 파티클 트리거

---

## 서비스 개요

[Git City](http://thegitcity.com/)를 벤치마크한 프로젝트로, GitHub 커밋 활동을 3D 빌딩으로 시각화하는 Git City의 컨셉을 AWS 인프라에 적용했습니다.

AWS CloudTrail 로그를 수집·집계하여 계정의 API 활동을 **3D 우주 궤도 시스템**으로 시각화합니다.

- **중앙 별** = AWS 계정 (전체 활동량에 따라 크기와 맥동 변화)
- **궤도 링 7개** = AWS 서비스 카테고리 (원자 모델처럼 3D 기울기)
- **위성** = 리소스 (활동량에 비례하는 크기, 코멧 트레일로 카테고리 색상 표현)
- **에러** = 빨간 오라 + 파편 궤도

| 색상 | 카테고리 | 대표 서비스 |
|------|---------|-----------|
| `#ED7100` | Compute | EC2, Lambda, ECS |
| `#7AA116` | Storage | S3, EBS, EFS |
| `#8C4FFF` | Networking | VPC, CloudFront, API Gateway |
| `#DD344C` | Security | IAM, GuardDuty, WAF |
| `#E7157B` | Management | CloudWatch, SNS, SQS |
| `#3334B9` | Database | RDS, DynamoDB, Aurora |
| `#01A88D` | AI/ML | SageMaker, Bedrock |

---

## 세 가지 진입점

```
┌────────────┐  ┌──────────┐  ┌──────────┐
│ Simulator  │  │ Presets  │  │ Real AWS │
│ (슬라이더) │  │ (샘플5종) │  │ (연결)   │
└─────┬──────┘  └────┬─────┘  └────┬─────┘
      └──────────────┼─────────────┘
                     ▼
          ┌─────────────────┐
          │  3D 궤도 렌더링  │
          │  (동일 엔진)     │
          └─────────────────┘
```

- **시뮬레이터** : 슬라이더로 카테고리별 활동량 조절 → 궤도가 실시간 변화
- **프리셋** : 원클릭 샘플 (스타트업, 데이터팀, ML팀, 엔터프라이즈, 보안팀)
- **실제 연결** : AWS 계정 Role ARN 입력 → CloudTrail 데이터로 시각화

---

## 서비스 시스템 아키텍처

**기술 스택**: Next.js 16, React 19, TypeScript, Three.js + R3F, Tailwind CSS v4, AWS SDK (CloudTrail, STS)

---

## 시작하기

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인.

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 메인 (3탭 UI: Simulator | Presets | Connect AWS)
│   ├── api/island/route.ts         # 섬 데이터 API (mock)
│   └── api/sync/route.ts           # CloudTrail 동기화
├── components/
│   ├── IslandCanvas.tsx            # R3F Canvas + Bloom + Controls + 배경
│   ├── OrbitalScene.tsx            # 궤도 전체 씬 (별 + 위성 + 트레일 + 에러)
│   ├── CentralStar.tsx             # 중앙 발광 별 (계정 대표)
│   ├── InstancedSatellites.tsx     # 위성 인스턴스 렌더링
│   ├── SatelliteTrails.tsx         # 코멧 트레일 셰이더 (카테고리 색상)
│   ├── SatelliteErrors.tsx         # 에러 오라 + 파편
│   ├── CategoryLabels.tsx          # 카테고리 라벨
│   ├── CategoryLegend.tsx          # 색상 범례
│   ├── CategoryDetailPanel.tsx     # 카테고리 상세 패널
│   ├── SimulatorPanel.tsx          # 슬라이더 시뮬레이터
│   ├── PresetSelector.tsx          # 프리셋 선택
│   ├── AccountInput.tsx            # AWS 계정 입력
│   └── LoadingScreen.tsx           # 로딩 화면
├── lib/
│   ├── orbital-layout.ts           # 궤도 레이아웃 알고리즘
│   ├── orbital-math.ts             # 3D 기울어진 궤도 수학 유틸
│   ├── cloud-island.ts             # 타입 정의
│   ├── aws-categories.ts           # 7개 카테고리 정의
│   └── mock-data.ts                # 모의 데이터 + 프리셋 5종
```

## 커맨드

```bash
npm run dev      # 개발 서버 (Turbopack)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
```
