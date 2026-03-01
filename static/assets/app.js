(() => {
  function initHeroCoverCycle() {
    const heroCover = document.querySelector('[data-hero-cover]');
    const heroVideo = heroCover ? heroCover.querySelector('[data-hero-video]') : null;
    const heroVideoSource = heroVideo ? heroVideo.querySelector('source') : null;
    if (!heroCover || !heroVideo) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    // Ensure mobile Safari treats this as an inline muted video.
    heroVideo.muted = true;
    heroVideo.defaultMuted = true;
    heroVideo.playsInline = true;
    heroVideo.setAttribute('playsinline', '');
    heroVideo.setAttribute('webkit-playsinline', '');

    const configuredMs = Number.parseInt(heroCover.dataset.heroInterval || '3000', 10);
    const intervalMs = Number.isFinite(configuredMs) ? Math.max(3000, configuredMs) : 3000;
    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const parsedVideoList = String(heroCover.dataset.heroVideos || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const videoList = parsedVideoList.length > 0
      ? parsedVideoList
      : [heroVideoSource?.getAttribute('src') || heroVideo.getAttribute('src') || ''].filter(Boolean);
    let nextVideoIndex = 0;

    let disabled = false;
    let waitingForInteraction = false;
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

    function selectNextVideo() {
      if (!videoList.length) return;
      const src = videoList[nextVideoIndex];
      nextVideoIndex = (nextVideoIndex + 1) % videoList.length;
      if (!src) return;

      if (heroVideoSource) {
        if (heroVideoSource.getAttribute('src') === src) return;
        heroVideoSource.setAttribute('src', src);
        heroVideo.load();
        return;
      }

      if (heroVideo.getAttribute('src') === src) return;
      heroVideo.setAttribute('src', src);
      heroVideo.load();
    }

    function scheduleNextCycle() {
      clearTimer();
      if (disabled || supportsHover) return;
      timer = window.setTimeout(playCycle, intervalMs);
    }

    function playCycle(force = false) {
      if (disabled || isPlaying || document.hidden) {
        scheduleNextCycle();
        return;
      }
      if (waitingForInteraction && !force) {
        scheduleNextCycle();
        return;
      }

      isPlaying = true;
      heroCover.classList.add('is-playing');
      selectNextVideo();

      try {
        heroVideo.currentTime = 0;
      } catch {
        // no-op
      }

      const playPromise = heroVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
          const message = String(error?.message || '').toLowerCase();
          const name = String(error?.name || '');
          const blockedByAutoplay =
            name === 'NotAllowedError' ||
            name === 'AbortError' ||
            message.includes('notallowed') ||
            message.includes('user gesture') ||
            message.includes('interact');

          if (blockedByAutoplay) {
            waitingForInteraction = true;
            resetPlayback();
            scheduleNextCycle();
            return;
          }

          disabled = true;
          clearTimer();
          resetPlayback();
        });
      }
    }

    heroVideo.addEventListener('ended', () => {
      heroCover.classList.remove('is-playing');
      isPlaying = false;
      if (!supportsHover) {
        scheduleNextCycle();
      }
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
      if (!disabled && !supportsHover) {
        scheduleNextCycle();
      }
    });

    const onInteraction = () => {
      if (disabled) return;
      if (!waitingForInteraction) return;
      waitingForInteraction = false;
      playCycle(true);
    };

    document.addEventListener('touchstart', onInteraction, { passive: true });
    document.addEventListener('click', onInteraction, { passive: true });
    document.addEventListener('keydown', onInteraction, { passive: true });

    if (supportsHover) {
      heroCover.addEventListener('mouseenter', () => {
        if (disabled) return;
        playCycle(true);
      });

      heroCover.addEventListener('mouseleave', () => {
        clearTimer();
        resetPlayback();
      });
    } else {
      scheduleNextCycle();
    }
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
