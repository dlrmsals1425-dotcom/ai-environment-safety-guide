# 팀 협업 방법

GitHub를 처음 사용해도 아래 순서로 참여할 수 있습니다.

1. **초대 수락:** 저장소 관리자가 보내는 GitHub 초대를 수락합니다.
2. **아이디어 공유:** Issues → New issue → `아이디어 / 기능 제안`. 해결할 문제와 예시 화면을 적습니다. 가벼운 질문과 토론은 Discussions를 사용합니다.
3. **할 일 정하기:** 관련 이슈에 담당자와 범위를 남깁니다. 두 사람이 같은 파일을 동시에 크게 바꾸지 않습니다.
4. **브랜치 만들기:** `develop`에서 `feature/작업명` 또는 `fix/오류명` 브랜치를 만듭니다.
5. **수정·확인:** 변경하고 앱의 테스트·빌드를 실행합니다.
6. **Pull Request:** 내 브랜치 → `develop`으로 PR을 열고 문제·변경 동작·검증 방법을 적습니다.
7. **검토 후 합치기:** 담당자가 검토하고 합칩니다. 공유할 버전이 되면 `develop` → `main` PR을 만들어 반영합니다.

## 용어

| 용어 | 이 프로젝트에서의 의미 |
|---|---|
| Repository(저장소, 레포) | 코드·문서·변경 이력을 모아놓은 프로젝트 공간 |
| Branch(브랜치) | 다른 사람의 작업을 바로 바꾸지 않고 수정할 수 있는 작업 갈래 |
| Commit(커밋) | 설명을 붙여 저장한 변경 묶음 |
| Pull Request(PR) | 내 변경을 함께 검토하고 기준 브랜치에 합치자는 요청 |
| Issue(이슈) | 아이디어, 오류, 할 일, 논의 기록 |
| Release(릴리스) | 팀에 공유할 기준 버전과 내려받을 자료 |

## 브랜치 규칙

- `main`: 공유·배포 기준. Vercel Production에 연결할 브랜치입니다.
- `develop`: 다음 버전 개발 내용이 모이는 브랜치입니다.
- `feature/*`, `fix/*`, `docs/*`: 개별 작업 브랜치입니다.
- 직접 `main`에 밀어 넣기보다 PR로 변경 이유와 검증을 남깁니다. 실제 강제 여부는 저장소 규칙/요금제 설정에 따릅니다.
- `develop` → `main` 릴리스 PR은 merge commit으로 합쳐 공통 이력을 유지합니다. 개인 작업 PR은 squash merge를 권장합니다.
- 현재 비공개 저장소는 플랜 제한으로 브랜치 보호가 활성화되지 않았습니다. PR 절차는 팀 운영 규칙이며, 코드 수정 권한이 있는 팀원의 직접 push를 시스템이 막지는 않습니다.

## GitHub Desktop으로 시작하기

GitHub Desktop에서 File → Clone repository로 이 저장소를 내려받습니다. Current branch에서 `develop`을 선택한 뒤 New branch를 만듭니다. 수정 후 Summary에 변경 이유를 적어 Commit → Publish branch/Push origin → Create Pull Request 순서로 진행합니다.

## 터미널로 시작하기

```sh
git clone https://github.com/dlrmsals1425-dotcom/ai-environment-safety-guide.git
cd ai-environment-safety-guide
git switch develop
git switch -c feature/my-idea
cd app
npm ci
npm run dev
# 수정 후
npm test -- --run
npm run build
cd ..
git add 수정한파일
git commit -m "feat: 무엇을 바꿨는지"
git push -u origin feature/my-idea
```

## 남겨야 할 내용

- 사용자에게 어떤 동작이 달라지는지, 관련 이슈 번호, 확인 방법.
- 계산 변경은 합성 기준 사례와 기존 결과의 차이. 실제 현장 정확도와 소프트웨어 검증을 구분합니다.
- 데이터 변경은 출처, 기준일, 좌표계, 높이 기준, 누락/추정 여부.
- 완성된 변경은 `CHANGELOG.md`, 설계 판단은 `docs/`에 기록합니다.
- API 키, `.env`, 개인 계정 정보, 로컬 원천 자료/대용량 가공 자료는 커밋하지 않습니다.
