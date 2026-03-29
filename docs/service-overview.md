# Cloud Island (Celesta) — 중간 발표 제출

---

- **팀명** : Stelloude
- **기여자** : 고동현, 이민형
- **역할 분담** :
    - 고동현 : 아이디어, AWS CloudTrail 로그 파싱
    - 이민형 : 이벤트 기반 파티클 트리거
- **서비스 개요** :
    Git City(thegitcity.com)를 벤치마크한 프로젝트로, GitHub 커밋 활동을 3D 빌딩으로 시각화하는 Git City의 컨셉을 AWS 인프라에 적용했습니다. AWS CloudTrail 로그를 수집·집계하여 계정의 API 활동을 3D 복셀 구름 섬(라퓨타 스타일)으로 시각화하는 웹 플랫폼입니다. API 호출 수는 구름 두께로, 리소스 수는 구름 면적으로, 에러율은 빨간 파티클과 파손 블록으로 매핑되며, AWS 공식 카테고리 색상 7개를 사용해 서비스 종류를 직관적으로 구분합니다.

- **서비스 시스템 아키텍처** :

```
[유저 AWS 계정]                         [Cloud Island 서버 (Next.js)]
      │                                          │
      │  CloudFormation 원클릭                     │
      │  → IAM Role 1개 생성 (비용 $0)             │
      │  → cloudtrail:LookupEvents 권한만          │
      │                                          │
      ├──── Role ARN 입력 ──────────────────────►│
      │                                          │
      │         STS AssumeRole ◄─────────────────│
      │                                          │
      │  CloudTrail LookupEvents ───────────────►│  카테고리별 집계
      │  (최근 90일 API 이벤트)                    │  (원본 저장 안 함)
      │                                          │
      │                                          ▼
      │                                ┌──────────────────┐
      │                                │ Three.js + R3F   │
      │                                │ 3D 복셀 구름 섬   │
      │                                │ 렌더링            │
      │                                └──────────────────┘
```

기술 스택: Next.js 16, React 19, TypeScript, Three.js + R3F, Tailwind CSS v4, AWS SDK (CloudTrail, STS)
