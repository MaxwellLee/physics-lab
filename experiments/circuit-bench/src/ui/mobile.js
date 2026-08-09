// 手机端外壳：竖屏引导、横屏/全屏请求与一次性触控教程。
const $ = id => document.getElementById(id);

export const isMobileLab = () =>
  (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches) &&
  matchMedia('(max-width: 1000px)').matches;

export function attachMobileExperience() {
  const gate = $('orientation-gate');
  const enter = $('enter-landscape');
  const tutorial = $('mobile-tutorial');
  const tutorialOk = $('tutorial-ok');
  const fullscreen = $('fullscreen-button');
  const fullscreenCoach = $('fullscreen-coach');
  const fullscreenCoachDismiss = $('fullscreen-coach-dismiss');
  const more = $('more-button');
  const moreControls = $('more-controls');
  const tutorialKey = 'physics-lab:circuit-mobile-tutorial-v1';
  let tutorialDismissed = false;
  let fullscreenCoachDismissed = false;

  try { tutorialDismissed = localStorage.getItem(tutorialKey) === 'done'; } catch {}

  const isPortraitPhone = () =>
    isMobileLab() && matchMedia('(orientation: portrait)').matches && innerWidth < 720;

  const closeMore = () => {
    moreControls?.classList.remove('open');
    more?.setAttribute('aria-expanded', 'false');
  };

  const activeFullscreenElement = () =>
    document.fullscreenElement || document.webkitFullscreenElement;

  const dismissFullscreenCoach = () => {
    fullscreenCoachDismissed = true;
    if (fullscreenCoach) fullscreenCoach.hidden = true;
    fullscreen?.classList.remove('coach-highlight');
  };

  const sync = () => {
    const mobile = isMobileLab();
    const blocked = isPortraitPhone();
    document.body.classList.toggle('mobile-lab', mobile);
    document.body.classList.toggle('portrait-blocked', blocked);
    if (gate) gate.hidden = !blocked;
    if (tutorial) tutorial.hidden = blocked || !mobile || tutorialDismissed;
    const coachActive = mobile && !blocked && !activeFullscreenElement() && !fullscreenCoachDismissed;
    fullscreen?.classList.toggle('coach-highlight', coachActive);
    if (fullscreenCoach) fullscreenCoach.hidden = !coachActive || !tutorial?.hidden;
    if (!mobile) closeMore();
  };

  const requestFullscreenLandscape = async () => {
    try {
      if (!activeFullscreenElement()) {
        if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else await document.documentElement.webkitRequestFullscreen?.();
      }
    } catch {}
    try {
      await screen.orientation?.lock?.('landscape');
    } catch {
      if (enter) enter.textContent = '请手动旋转手机';
    }
    sync();
  };

  enter?.addEventListener('click', requestFullscreenLandscape);
  fullscreen?.addEventListener('click', async () => {
    dismissFullscreenCoach();
    if (activeFullscreenElement()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await document.webkitExitFullscreen?.();
    }
    else await requestFullscreenLandscape();
    closeMore();
  });
  fullscreenCoachDismiss?.addEventListener('click', event => {
    event.stopPropagation();
    dismissFullscreenCoach();
  });
  tutorialOk?.addEventListener('click', () => {
    tutorialDismissed = true;
    tutorial.hidden = true;
    try { localStorage.setItem(tutorialKey, 'done'); } catch {}
    sync();
  });
  more?.addEventListener('click', () => {
    const open = !moreControls.classList.contains('open');
    moreControls.classList.toggle('open', open);
    more.setAttribute('aria-expanded', String(open));
  });
  addEventListener('resize', sync);
  screen.orientation?.addEventListener?.('change', sync);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('pointerdown', event => {
    if (moreControls?.classList.contains('open') && !event.target.closest('.transport')) closeMore();
  });
  sync();

  return { isActive: isMobileLab, sync, closeMore };
}
