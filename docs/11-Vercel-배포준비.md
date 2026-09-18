# Vercel 공개 배포

사용자 요청으로 GitHub 저장소를 공개했고 Vercel의 기존 Hobby 계정에 운영 사이트를 연결합니다. 새 유료 요금제나 별도 데이터 저장 서비스를 추가하지 않습니다.

## 프로젝트 설정

| 항목 | 값 |
|---|---|
| GitHub | dlrmsals1425-dotcom/ai-environment-safety-guide |
| Framework | Vite |
| Root Directory | `app` |
| Install Command | `npm ci` |
| Build Command | `npm run build:vercel` |
| Output Directory | `dist` |
| Production Branch | `main` |
| 지도/API 비밀키 | 필요 없음 |

`app/vercel.json`이 빌드 명령을 지정합니다. 저장소 공개 전환으로 전체 데이터 릴리스도 공개 다운로드가 가능합니다.

## 운영 데이터 준비

`prepare-vercel-data.mjs`는 `app/config/data-release.json`에 고정된 Release ZIP을 다운로드하고 크기·SHA256을 확인한 뒤 서울 전체 런타임 자료를 준비합니다. 경로와 필수 파일을 확인하며 검증이 실패하면 빌드를 중단합니다. 그 다음 데이터 검사와 Vite 빌드를 수행합니다. 최초 연결에는 비밀 토큰이 필요하지 않습니다.

- 건물 695,752개 / 666타일
- 수목 435,922개 / 592타일
- 제설전진기지 86개
- 추정 지면 3,241×2,341셀

브라우저는 필요한 건물/수목 타일을 읽고, 고도 격자는 현재 전체 파일을 읽습니다. 서비스 이용량이 커지면 고도 분할 로딩과 데이터 CDN/캐시를 별도 최적화합니다. 배포가 끝나도 정밀 DTM이나 수목 차폐 기능을 확보한 것은 아닙니다.

로컬 `npm run dev/build`는 기존 자료를 보존하며, 새 Clone에서는 작은 3개 구역 시연 자료를 준비합니다. `build:vercel`은 전체 자료를 준비하는 명시적인 별도 명령입니다.

## 자동 배포와 협업

GitHub와 연결한 프로젝트의 `main` 변경이 운영 배포 기준입니다. 팀원은 작업 브랜치의 PR을 검토·검사 후 main에 합칩니다. 외부 기여자의 PR 미리보기 등은 Vercel의 기본 보안·권한 정책을 따릅니다. 공개 코드 읽기와 직접 수정 권한, 사이트 접근 권한은 서로 구분합니다.

공식 안내: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Git 배포](https://vercel.com/docs/git), [사용량 제한](https://vercel.com/docs/limits).

## 남아 있는 점검

- `docs/12`와 GitHub 이슈 #5의 전이 의존성 알림.
- 현재 기상·수목 차폐·위험도 모델은 미구현.
- 실제 현장 정확도는 별도 기준 자료와 비교 필요.
- 무료 사용량 범위를 벗어나는 운영 확대와 유료 전환은 별도 결정.
