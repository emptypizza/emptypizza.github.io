// Public portfolio content shared by the homepage and the island.
// Keep credentials in the receiving service, never in this file.
window.GGHF_CONTENT = {
  profile: { name: '최경환', studio: 'GGHF', email: 'team.gghf@gmail.com', github: 'https://github.com/emptypizza', itch: 'https://gghf.itch.io' },
  study: { name: '서울인디게임즈', url: 'https://emptypizza.github.io/seoulindies/', description: '게임을 만드는 사람들이 모여 AI 도구의 시행착오와 실제 개발 경험을 나눕니다.' },
  feedback: { endpoint: 'https://gghf-trello-inbox.netlify.app/trello-inbox', enabled: false },
  checkedAt: '2026-10-27',
  projects: [
    { id: 'nemo', title: 'NEMO_D.O', category: 'PUZZLE / ACTION', status: '스토어 공개', description: '하나의 조작으로 움직이는 두 로봇. 서로 다른 공간의 퍼즐을 함께 풀어가는 듀얼 퍼즐 액션입니다.', role: '게임 기획', technology: 'Android · PC', technologyLabel: '플랫폼', image: 'assets/images/nemo-gameplay.jpg', imageAlt: 'NEMO_D.O의 두 로봇과 분할된 퍼즐 스테이지', imageCaption: 'NEMO_D.O · 실제 게임 화면', url: 'https://play.google.com/store/apps/details?id=com.GGHF.Nemo_DO', action: 'Google Play에서 보기', secondaryUrl: 'https://store.steampowered.com/app/575060/', secondaryAction: 'Steam · Early Access', sources: ['https://play.google.com/store/apps/details?id=com.GGHF.Nemo_DO'] },
    { id: 'paper', title: 'PAPER HEROES', category: 'PROTOTYPE / IN DEVELOPMENT', status: '개발 중', description: '개발 중인 게임 프로젝트입니다. 공개 페이지에서 프로토타입과 프로젝트 소식을 확인할 수 있습니다.', role: 'GGHF 프로젝트', technology: 'Godot · HTML5', technologyLabel: '공개 페이지 표기', image: 'assets/images/paper-project-page.png', imageAlt: 'PAPER HEROES itch.io 프로젝트 소개 페이지', imageCaption: 'PAPER HEROES · 공개 프로젝트 페이지', url: 'https://gghf.itch.io/paperers', action: 'itch.io에서 보기', sources: ['https://gghf.itch.io/paperers'] },
    { id: 'kmm', title: 'kmm adventure', category: 'WEB / PLAYABLE', status: '여기서 플레이', description: '적을 피하며 보드를 칠하세요. 70%의 영역을 채우고, 다음 스테이지에서는 사라지는 열쇠까지 모으는 짧은 도전입니다.', role: '홈페이지 통합 · 게임 개선', technology: 'HTML · CSS · JavaScript', technologyLabel: '기술', image: 'assets/images/kmm-gameplay.png', imageAlt: 'kmm adventure의 색칠한 보드와 플레이어, 적', imageCaption: 'kmm adventure · 실제 게임 화면', url: '#play', action: '게임으로 이동', sources: ['https://github.com/emptypizza/emptypizza.github.io'] }
  ]
};
