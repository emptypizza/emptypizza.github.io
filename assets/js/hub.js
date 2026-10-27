(() => {
  'use strict';
  const content = window.GGHF_CONTENT;
  const scriptUrl = new URL(document.currentScript.src);
  const scriptBase = new URL('.', scriptUrl);
  const islandUrl = new URL('island.js', scriptBase);
  islandUrl.search = scriptUrl.search;
  const list = document.getElementById('project-list');
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const link = (url, label) => {
    const node = element('a', '', label + ' ↗');
    node.href = url;
    if (url.startsWith('https://')) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    return node;
  };
  for (const project of content.projects) {
    const article = element('article', 'project');
    article.id = 'project-' + project.id;
    const figure = element('figure', 'project-image');
    const image = element('img');
    Object.assign(image, { src: project.image, alt: project.imageAlt, loading: 'lazy', width: 800, height: 500 });
    figure.append(image, element('figcaption', '', project.imageCaption));
    const info = element('div', 'project-info');
    const kicker = element('div', 'project-kicker');
    kicker.append(element('span', '', project.category), element('span', 'project-status', project.status));
    info.append(kicker, element('h3', '', project.title), element('p', 'project-description', project.description));
    const facts = element('dl');
    facts.append(element('dt', '', project.id === 'paper' ? '제작' : '작업'), element('dd', '', project.role), element('dt', '', project.technologyLabel), element('dd', '', project.technology));
    const actions = element('div', 'project-actions');
    actions.append(link(project.url, project.action));
    if (project.secondaryUrl) actions.append(link(project.secondaryUrl, project.secondaryAction));
    info.append(facts, actions);
    article.append(figure, info);
    list.append(article);
  }
  document.querySelectorAll('[data-study-link]').forEach(a => { a.href = content.study.url; });
  let islandPromise;
  let islandTrigger;
  async function openIsland(event) {
    islandTrigger = event?.currentTarget || document.querySelector('[data-open-island]');
    window.GGHF_GAME?.pause('island');
    const status = document.getElementById('island-status');
    const buttons = [...document.querySelectorAll('[data-open-island]')];
    buttons.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); });
    status.textContent = '작은 섬을 불러오고 있습니다…';
    try {
      if (window.GGHF_ISLAND) window.GGHF_ISLAND.enter();
      else {
        islandPromise ||= import(islandUrl.href);
        await islandPromise;
      }
      if (!window.GGHF_ISLAND) throw new Error('Island did not initialize');
      status.textContent = '';
    } catch (_) {
      islandPromise = null;
      document.body.classList.remove('in-village');
      status.textContent = '이 환경에서는 3D 섬을 열지 못했습니다. 소개와 게임은 이 페이지에서 계속 볼 수 있습니다.';
      status.scrollIntoView({ block: 'center' });
    } finally {
      buttons.forEach(button => { button.disabled = false; button.removeAttribute('aria-busy'); });
    }
  }
  document.querySelectorAll('[data-open-island]').forEach(button => button.addEventListener('click', openIsland));
  document.querySelectorAll('[data-leave-island]').forEach(button => button.addEventListener('click', () => window.GGHF_ISLAND?.leave(button.dataset.leaveIsland)));
  let aiPromise;
  function loadAi() {
    if (window.puter?.ai?.chat) return Promise.resolve(window.puter);
    if (aiPromise) return aiPromise;
    aiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => { script.remove(); aiPromise = null; reject(new Error('AI service timeout')); }, 15000);
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      script.onload = () => { clearTimeout(timeout); if (window.puter?.ai?.chat) resolve(window.puter); else { aiPromise = null; reject(new Error('AI service unavailable')); } };
      script.onerror = () => { clearTimeout(timeout); script.remove(); aiPromise = null; reject(new Error('AI service unavailable')); };
      document.head.append(script);
    });
    return aiPromise;
  }
  window.GGHF_HUB = {
    loadAi,
    restoreFocus(target) {
      if (target) {
        const section = document.getElementById(target);
        section?.scrollIntoView({ block: 'start', behavior: 'instant' });
        const heading = section?.querySelector('h1,h2,h3');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      } else islandTrigger?.focus({ preventScroll: true });
    }
  };
  window.render_game_to_text = () => document.body.classList.contains('in-village') && window.GGHF_ISLAND
    ? JSON.stringify(window.GGHF_ISLAND.getState())
    : JSON.stringify(window.GGHF_GAME.getState());
  if (location.hash === '#island') openIsland();
})();
