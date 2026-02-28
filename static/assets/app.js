(() => {
  function initHeroCoverCycle() {
    const heroCover = document.querySelector('[data-hero-cover]');
    const heroVideo = heroCover ? heroCover.querySelector('[data-hero-video]') : null;
    if (!heroCover || !heroVideo) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const configuredMs = Number.parseInt(heroCover.dataset.heroInterval || '9000', 10);
    const intervalMs = Number.isFinite(configuredMs) ? Math.max(4000, configuredMs) : 9000;

    let disabled = false;
    let isPlaying = false;
    let timer = null;

    function clearTimer() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function resetPlayback() {
      heroCover.classList.remove('is-playing');
      isPlaying = false;
      try {
        heroVideo.pause();
        heroVideo.currentTime = 0;
      } catch {
        // no-op
      }
    }

    function scheduleNextCycle() {
      clearTimer();
      if (disabled) return;
      timer = window.setTimeout(playCycle, intervalMs);
    }

    function playCycle() {
      if (disabled || isPlaying || document.hidden) {
        scheduleNextCycle();
        return;
      }

      isPlaying = true;
      heroCover.classList.add('is-playing');

      try {
        heroVideo.currentTime = 0;
      } catch {
        // no-op
      }

      const playPromise = heroVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          disabled = true;
          clearTimer();
          resetPlayback();
        });
      }
    }

    heroVideo.addEventListener('ended', () => {
      heroCover.classList.remove('is-playing');
      isPlaying = false;
      scheduleNextCycle();
    });

    heroVideo.addEventListener('error', () => {
      disabled = true;
      clearTimer();
      resetPlayback();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimer();
        resetPlayback();
        return;
      }
      if (!disabled) {
        scheduleNextCycle();
      }
    });

    scheduleNextCycle();
  }

  initHeroCoverCycle();

  const searchInput = document.querySelector('#recipe-search');
  const cards = Array.from(document.querySelectorAll('.recipe-card'));
  const filters = Array.from(document.querySelectorAll('.filter-btn'));
  const countEl = document.querySelector('#result-count');
  const emptyState = document.querySelector('#empty-state');

  if (!cards.length) return;

  const state = {
    query: '',
    cuisine: 'all',
    type: 'all'
  };

  function setActiveButton(group, value) {
    filters.forEach((button) => {
      if (button.dataset.filterGroup !== group) return;
      button.classList.toggle('is-active', button.dataset.filterValue === value);
    });
  }

  function matches(card) {
    const searchBlob = (card.dataset.search || '').toLowerCase();
    const cuisine = card.dataset.cuisine || '';
    const type = card.dataset.type || '';

    const normalizedQuery = state.query.trim().toLowerCase();
    const queryMatch = !normalizedQuery || searchBlob.includes(normalizedQuery);
    const cuisineMatch = state.cuisine === 'all' || cuisine === state.cuisine;
    const typeMatch = state.type === 'all' || type === state.type;

    return queryMatch && cuisineMatch && typeMatch;
  }

  function applyFilters() {
    let visibleCount = 0;

    cards.forEach((card) => {
      const visible = matches(card);
      card.classList.toggle('is-hidden', !visible);
      if (visible) visibleCount += 1;
    });

    if (countEl) countEl.textContent = String(visibleCount);
    if (emptyState) emptyState.classList.toggle('is-hidden', visibleCount !== 0);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.query = event.currentTarget.value;
      applyFilters();
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.currentTarget.value = '';
      state.query = '';
      applyFilters();
    });
  }

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.dataset.filterGroup;
      const value = button.dataset.filterValue;
      if (!group || !value) return;
      state[group] = value;
      setActiveButton(group, value);
      applyFilters();
    });
  });

  applyFilters();
})();
