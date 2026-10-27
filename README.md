# GGHF · 최경환의 게임 작업실

개발자 소개와 프로젝트 목록, 3D 섬, `kmm adventure`, 스터디 및 연락 경로를 제공하는 GitHub Pages 정적 사이트입니다. 별도의 패키지 설치나 빌드 과정이 없습니다.

## 운영 원칙

GitHub Pages 정적 호스팅만 사용합니다. 자체 백엔드와 로컬 개발 서버는 만들거나 실행하지 않습니다. 문의와 게임 의견은 이메일 링크로 안내합니다. 코드 검증은 아래 Node.js 명령으로 서버 없이 실행합니다.

## 콘텐츠 수정

- `assets/data/content.js`: 프로젝트, 스터디, 공개 연락처. 홈페이지 카드와 섬의 건물·NPC가 같은 데이터를 사용합니다.
- `index.html`: 소개, 탐색, 게임·문의 화면과 공유 메타데이터.
- `assets/css/site.css`, `game.css`, `island.css`: 홈페이지, 게임, 섬 스타일.
- `assets/js/hub.js`: 프로젝트 표시와 3D·AI SDK의 선택적 로딩.
- `assets/js/game.js`: 게임 규칙, 입력과 준비/실행/정지/종료 상태.
- `assets/js/island.js`: 기존 Three.js 작은 행성·NPC·우주·조이스틱.
- `vibecoders/index.html`: 기존 스터디 링크를 현재 서울인디게임즈 안내로 연결.

게임은 시작 버튼을 눌러야 진행됩니다. 방향키/WASD와 방향 버튼의 클릭·Enter·Space로 이동하고, P/Esc로 정지합니다. 탭을 벗어나거나 섬을 열거나 보드가 화면 밖으로 나가면 정지합니다. 재개는 명시적으로 선택해야 합니다.

## 검증

Node.js 22에서 다음 명령을 실행합니다.

```sh
node scripts/check-site.mjs
node --test tests/*.test.mjs
```

테스트는 게임의 시간·승패·스테이지·입력 보호를 검증합니다. 브라우저에서 화면과 실제 입력도 별도로 확인해야 합니다. GitHub Actions는 위 검사를 실행하며 사이트 배포 설정을 변경하지 않습니다.

## 문의와 게임 의견

공개 업무 이메일 `team.gghf@gmail.com`으로 연결합니다. 방문자는 자신의 메일 앱에서 내용을 작성하고 직접 보냅니다. 홈페이지 문의 영역과 섬의 제보 드론은 같은 연락 경로를 안내합니다. 별도 수신 서버, API 키, 데이터베이스 또는 자동 접수 기능이 필요하지 않습니다.

## 콘텐츠 출처와 확인 범위

- NEMO_D.O: GGHF의 Google Play 및 itch.io 공개 스토어 이미지. 스토어 확인일 2026-10-27. Steam은 Early Access 표시를 유지합니다. 기존 홈페이지의 본인 소개에 있는 게임 기획 역할을 사용하며, 확인되지 않은 엔진이나 평점은 추가하지 않습니다.
- PAPER HEROES: 사용자가 확인한 `https://gghf.itch.io/paperers`를 연결합니다. 이미지는 공개 프로젝트 소개 페이지이며 게임 화면이 아닙니다. Godot·HTML5·개발 중 표기는 그 페이지의 정보입니다. 공개 iframe의 제목은 기존 홈페이지 설명과 달라, 이를 라인 디펜스의 검증된 플레이 화면이라고 주장하지 않습니다. 개인 담당 역할은 추가 확인이 필요합니다.
- kmm adventure와 섬: 이 저장소의 실제 로컬 실행 화면.
- 스터디: `https://emptypizza.github.io/seoulindies/`의 공개 안내.
- 공개 업무 연락처: NEMO_D.O Google Play의 앱 지원 정보.

## 배포

기존 GitHub Pages를 유지합니다. 변경 브랜치의 검증을 통과시킨 뒤 검토된 변경을 게시 브랜치에 반영합니다. 이 작업에는 Sites 이전이나 별도 서버 프레임워크가 필요하지 않습니다.
