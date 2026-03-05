(() => {
  function initThemeToggle() {
    const root = document.documentElement;
    const toggle = document.querySelector('[data-theme-toggle]');
    const storageKey = 'chief_fafa_theme';
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function getStoredTheme() {
      try {
        const value = window.localStorage.getItem(storageKey);
        if (value === 'dark' || value === 'light') return value;
      } catch {
        // no-op
      }
      return '';
    }

    function hasStoredTheme() {
      return Boolean(getStoredTheme());
    }

    function resolveTheme() {
      const stored = getStoredTheme();
      if (stored) return stored;
      return mediaQuery && mediaQuery.matches ? 'dark' : 'light';
    }

    function getLabel(which) {
      if (!toggle) return which === 'light' ? 'Light mode' : 'Dark mode';
      const raw = which === 'light' ? toggle.dataset.labelLight : toggle.dataset.labelDark;
      return String(raw || '').trim() || (which === 'light' ? 'Light mode' : 'Dark mode');
    }

    function applyTheme(theme, persist = false) {
      const normalized = theme === 'dark' ? 'dark' : 'light';
      root.setAttribute('data-theme', normalized);
      root.style.colorScheme = normalized;

      if (toggle) {
        const toLight = getLabel('light');
        const toDark = getLabel('dark');
        const nextText = normalized === 'dark' ? `☀ ${toLight}` : `🌙 ${toDark}`;
        toggle.textContent = nextText;
        toggle.setAttribute('aria-pressed', String(normalized === 'dark'));
        toggle.dataset.currentTheme = normalized;
      }

      if (persist) {
        try {
          window.localStorage.setItem(storageKey, normalized);
        } catch {
          // no-op
        }
      }
    }

    applyTheme(resolveTheme(), false);

    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark', true);
    });

    if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', (event) => {
        if (hasStoredTheme()) return;
        applyTheme(event.matches ? 'dark' : 'light', false);
      });
    }
  }

  function initHeroCoverCycle() {
    const heroCover = document.querySelector('[data-hero-cover]');
    const heroVideo = heroCover ? heroCover.querySelector('[data-hero-video]') : null;
    const heroVideoSource = heroVideo ? heroVideo.querySelector('source') : null;
    const audioToggle = heroCover ? heroCover.querySelector('[data-hero-audio-toggle]') : null;
    if (!heroCover || !heroVideo) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      if (audioToggle) {
        audioToggle.hidden = true;
        audioToggle.setAttribute('aria-hidden', 'true');
      }
      return;
    }

    function audioLabel(which) {
      if (!audioToggle) return which === 'mute' ? 'Mute video' : 'Unmute video';
      const raw = which === 'mute' ? audioToggle.dataset.labelMute : audioToggle.dataset.labelUnmute;
      return String(raw || '').trim() || (which === 'mute' ? 'Mute video' : 'Unmute video');
    }

    function setAudioToggleDisabled(isDisabled) {
      if (!audioToggle) return;
      audioToggle.disabled = Boolean(isDisabled);
    }

    function isMutedState() {
      return heroVideo.muted || heroVideo.volume === 0;
    }

    function updateAudioToggle() {
      if (!audioToggle) return;
      const muted = isMutedState();
      const label = muted ? audioLabel('unmute') : audioLabel('mute');
      audioToggle.textContent = label;
      audioToggle.setAttribute('aria-pressed', String(!muted));
      audioToggle.dataset.audioState = muted ? 'muted' : 'unmuted';
    }

    function setMutedState(muted) {
      const normalized = Boolean(muted);
      heroVideo.muted = normalized;
      heroVideo.defaultMuted = normalized;
      if (!normalized && heroVideo.volume === 0) {
        heroVideo.volume = 1;
      }
      updateAudioToggle();
    }

    // Ensure mobile Safari treats this as an inline muted video.
    setMutedState(true);
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
    setAudioToggleDisabled(false);

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
          setAudioToggleDisabled(true);
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
      setAudioToggleDisabled(true);
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

    if (audioToggle) {
      audioToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;

        const nextMuted = !isMutedState();
        setMutedState(nextMuted);

        if (!nextMuted) {
          waitingForInteraction = false;
          playCycle(true);
        }
      });
      updateAudioToggle();
    }

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

  initThemeToggle();
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
  const stateKeys = ['cuisine', 'type'];
  const filterValueSets = {
    cuisine: new Set(['all']),
    type: new Set(['all'])
  };

  filters.forEach((button) => {
    const group = button.dataset.filterGroup;
    const value = button.dataset.filterValue;
    if (!group || !value) return;
    if (!filterValueSets[group]) filterValueSets[group] = new Set(['all']);
    filterValueSets[group].add(value);
  });

  function normalizeFilterValue(group, value) {
    const fallback = 'all';
    const normalized = String(value || '').trim();
    if (!normalized) return fallback;
    const allowedValues = filterValueSets[group];
    if (!allowedValues) return fallback;
    return allowedValues.has(normalized) ? normalized : fallback;
  }

  function restoreStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get('q') || '';
    state.cuisine = normalizeFilterValue('cuisine', params.get('cuisine'));
    state.type = normalizeFilterValue('type', params.get('type'));
  }

  function persistStateToUrl() {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    const params = new URLSearchParams(window.location.search);
    const normalizedQuery = state.query.trim();

    if (normalizedQuery) params.set('q', normalizedQuery);
    else params.delete('q');

    stateKeys.forEach((key) => {
      const value = state[key];
      if (value && value !== 'all') params.set(key, value);
      else params.delete(key);
    });

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    window.history.replaceState(window.history.state, '', nextUrl);
  }

  function setActiveButton(group, value) {
    filters.forEach((button) => {
      if (button.dataset.filterGroup !== group) return;
      button.classList.toggle('is-active', button.dataset.filterValue === value);
    });
  }

  function syncControlsFromState() {
    stateKeys.forEach((key) => setActiveButton(key, state[key]));
    if (searchInput && searchInput.value !== state.query) {
      searchInput.value = state.query;
    }
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
      persistStateToUrl();
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.currentTarget.value = '';
      state.query = '';
      applyFilters();
      persistStateToUrl();
    });
  }

  filters.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const group = button.dataset.filterGroup;
      const value = button.dataset.filterValue;
      if (!group || !value) return;
      state[group] = value;
      setActiveButton(group, value);
      applyFilters();
      persistStateToUrl();
    });
  });

  function applyUrlState() {
    restoreStateFromUrl();
    syncControlsFromState();
    applyFilters();
  }

  window.addEventListener('pageshow', () => {
    applyUrlState();
  });

  window.addEventListener('popstate', () => {
    applyUrlState();
  });

  applyUrlState();
})();
