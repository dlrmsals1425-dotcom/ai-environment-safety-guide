# Vercel 배포 준비

현재 저장소는 **Vercel에 연결해 빌드할 수 있도록 준비한 상태**입니다. 이 작업에서 Vercel 프로젝트를 만들거나 유료 요금제를 구매한 것은 아닙니다.

## 기본 연결 설정

Vercel에서 Add New → Project → 이 GitHub 저장소 Import 후:

| 항목 | 값 |
|---|---|
| Framework Preset | Vite |
| Root Directory | `app` |
| Node.js | 22.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production Branch | `main` |
| 환경변수 | 현재 시연 버전은 없음 |

`app/vercel.json`에 빌드 설정을 넣었습니다. `prebuild`가 저장소에 포함된 서울숲·남산·여의도 시연 자료를 준비합니다. 지도 계산은 브라우저 워커에서 실행되므로 현재 서울 기능에는 별도 서버나 지도 API 키가 필요하지 않습니다. 레거시 네이버 지오코딩 개발용 프록시는 이 정적 배포의 기능에 포함되지 않습니다.

공식 안내: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## 비공개 저장소의 팀 배포

GitHub 팀 초대와 Vercel 팀 권한은 별개입니다. Vercel 공식 문서 기준으로 Hobby는 비공개 저장소의 팀 협업 배포를 지원하지 않고 커밋 작성자 접근도 확인합니다. 팀원마다 자동 Preview 배포를 사용하려면 Pro 팀 구성을 검토해야 합니다. 이 저장소의 `develop`/PR이 자동 배포될 것이라고 가정하지 마세요.

커밋 작성자를 바꿔 권한 제한을 우회하지 않습니다. 실제 연결 전에 계정·요금제·협업 범위를 정합니다. 공식 근거: [프로젝트 협업 배포 제한](https://vercel.com/docs/deployments/troubleshoot-project-collaboration).

## 서울 전체 자료를 공개 서비스에 반영하기 전

기본 배포는 3개 구역의 공유 시연입니다. 서울 전체 런타임 자료는 Releases에서 별도 설치하는 구조이며, 현재 프로덕션 빌드가 private Release를 자동 다운로드하도록 비밀 토큰을 넣어두지 않았습니다.

전체 서비스를 만들 때는 데이터 버전별 정적 저장소/CDN 또는 보호된 빌드 다운로드 방식 중 하나를 정해야 합니다. 데이터 경로, 접근 권한, 사용량·비용, 캐시 버전을 함께 검토합니다. 비밀 토큰을 `VITE_*` 환경변수에 넣으면 브라우저에 포함될 수 있으므로 사용하지 않습니다.

Vercel의 CLI 소스 업로드 한도와 Git 연동 빌드/산출물은 서로 다른 제한입니다. 전체 607MiB를 Git에 넣거나 CLI로 무조건 올리는 식으로 처리하지 않습니다. 최신 제한은 [Vercel Limits](https://vercel.com/docs/limits)를 확인합니다.

## 배포 전 확인

- GitHub Actions의 `Test and build` 성공.
- 샘플 범위 밖 계산 차단과 데이터 출처/한계 표시 확인.
- 시간 변경 → 미리보기 → 경계 보정, 날짜·구역 변경 시 이전 결과 정리 확인.
- 브라우저/모바일 성능, OSM 공개 타일 정책과 예상 이용량 확인.
- 수목 차폐·기상·위험도 기능이 미구현임을 서비스 설명에 유지.
- 저장소가 비공개여도 Vercel 사이트는 별도 공개 범위를 가지므로 사이트 접근 정책을 결정.
