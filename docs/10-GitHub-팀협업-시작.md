# GitHub 팀 협업 시작

저장소: https://github.com/dlrmsals1425-dotcom/ai-environment-safety-guide

공개 범위는 **비공개**입니다. 사용자 요청에 따라 팀원 초대는 나중에 진행합니다.

## 관리자가 팀원 초대하기

1. 팀원이 GitHub 계정을 만들고 **GitHub 아이디**를 알려줍니다.
2. 저장소 → Settings → Collaborators(또는 Collaborators and teams) → Add people.
3. 아이디를 검색하고 초대를 보냅니다.
4. 팀원이 이메일 또는 GitHub 알림에서 수락하면 코드·Issues·PR에 접근할 수 있습니다.

개인 계정의 비공개 저장소에서 협업자는 코드 수정 권한을 갖습니다. 읽기 전용 등 세분화된 역할이 필요하면 조직 저장소 구성을 별도로 검토합니다. 안내 기준: [GitHub 초대 방법](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository), [개인 저장소 권한](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository).

## 팀원이 처음 실행하기

Node.js 22 LTS와 Git 또는 GitHub Desktop을 설치합니다. 저장소 접근 권한이 있는 계정으로 Clone한 후:

```sh
cd ai-environment-safety-guide/app
npm ci
npm run dev
```

명령 출력에 표시된 로컬 주소를 엽니다. 첫 실행에 시연 자료가 자동 준비됩니다. 서울숲·남산·여의도 프리셋을 사용하세요. 지도/API 키는 현재 구성에 필요하지 않습니다.

## 서울 전체 데이터 사용하기

기본 Git 저장소에는 약 28MB의 실제 공개자료 부분 묶음만 포함됩니다. 전체 지도 데이터는 약 607MiB이며 ZIP으로 압축해 Releases에 별도 제공합니다. 상위 프로젝트의 데이터나 개인 작업 파일을 포함하지 않습니다.

Python 3.11 이상과 GitHub CLI가 있다면 저장소 루트에서:

```sh
gh auth login
python tools/install_full_data.py
cd app
npm run data:check
npm run dev
```

macOS/Linux에서 `python` 명령이 없으면 `python3`를 사용합니다. GitHub CLI 대신 Releases에서 ZIP을 직접 내려받은 경우:

```sh
python tools/install_full_data.py --archive "다운로드한 ZIP 경로"
```

설치 도구는 SHA256을 확인하고 기존 샘플/자료를 `.artifacts/seoul-previous-*`에 보존한 다음 전체 자료로 바꿉니다. 다운로드·압축해제 공간이 필요합니다. 기존 전체 자료가 있는 개발자의 `npm run dev/build`는 데이터를 덮어쓰지 않습니다.

## 팀원들이 어디에 기록하나요?

| 내용 | 기록할 곳 |
|---|---|
| 새로운 아이디어·개선 제안 | Issues → 아이디어 / 기능 제안 |
| 오류 재현 방법·화면 | Issues → 오류 신고 |
| 가벼운 질문·방향 논의 | Discussions |
| 코드 변경 이유·테스트·전후 화면 | Pull Request |
| 버전별 완성 내용 | CHANGELOG.md / Releases |
| 계산 방식·자료 품질·설계 판단 | docs/ |

브랜치/PR 실습은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 따릅니다. GitHub에 코드를 올리는 것과 사이트를 인터넷 주소로 배포하는 것은 별개입니다. 사이트 공개는 Vercel 연결 단계에서 진행합니다.
