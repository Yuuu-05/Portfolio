(function () {
  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const supportsMotion = !reduceMotionQuery.matches;
  const revealSelector = [
    ".page-title-card",
    ".hero-collage",
    ".stage-board",
    ".info-card",
    ".research-card",
    ".evidence-card",
    ".sketch-card",
    ".option-card",
    ".screenshot-card",
    ".requirement-summary-card",
    ".asset-figure",
    ".external-card",
    ".evolution-card",
    ".brand-direction-card",
    ".iteration-insight",
    ".journey-grid-board",
    ".roadmap-node",
    ".member-card",
    ".brief-card"
  ].join(",");

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const revealed = new WeakSet();
  let homeModuleTransitionRunning = false;
  const homeModuleTransitionStorageKey = "holdlight-home-module-transition";

  const parseCSSTime = (value, fallback) => {
    const trimmedValue = String(value || "").trim();
    const numericValue = Number.parseFloat(trimmedValue);

    if (!Number.isFinite(numericValue)) return fallback;
    if (trimmedValue.endsWith("ms")) return numericValue;
    if (trimmedValue.endsWith("s")) return numericValue * 1000;
    return numericValue;
  };

  const getSiteVisualScale = () => {
    const bodyScale = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--site-visual-scale"));
    if (Number.isFinite(bodyScale) && bodyScale > 0) return bodyScale;

    const scale = Number.parseFloat(getComputedStyle(root).getPropertyValue("--site-visual-scale"));
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  };

  const initSiteScaleWrapper = () => {
    if (document.body.classList.contains("site-scale-enabled")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "site-scale-wrapper";

    while (document.body.firstChild) {
      wrapper.appendChild(document.body.firstChild);
    }

    document.body.appendChild(wrapper);
    document.body.classList.add("site-scale-enabled");

    let frameId = 0;
    const syncScaledHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const scale = getSiteVisualScale();
        const scaledHeight = Math.max(window.innerHeight, Math.ceil(wrapper.scrollHeight * scale));
        document.body.style.setProperty("--site-scaled-height", `${scaledHeight}px`);
      });
    };

    syncScaledHeight();
    window.addEventListener("load", syncScaledHeight, { once: true });
    window.addEventListener("resize", syncScaledHeight, { passive: true });

    if ("ResizeObserver" in window) {
      wrapper.siteScaleResizeObserver = new ResizeObserver(syncScaledHeight);
      wrapper.siteScaleResizeObserver.observe(wrapper);
    }

    if ("MutationObserver" in window) {
      wrapper.siteScaleMutationObserver = new MutationObserver(syncScaledHeight);
      wrapper.siteScaleMutationObserver.observe(wrapper, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  };

  const getHomeModuleTransitionDuration = () => {
    const variableName = supportsMotion ? "--home-module-transition-duration" : "--home-module-reduced-duration";
    const fallback = supportsMotion ? 550 : 160;
    return parseCSSTime(getComputedStyle(root).getPropertyValue(variableName), fallback);
  };

  const getHomeModuleTransitionHoldDuration = () => {
    const fallback = supportsMotion ? 60 : 30;
    return parseCSSTime(getComputedStyle(root).getPropertyValue("--home-module-transition-hold-duration"), fallback);
  };

  const getHomeModuleRevealDuration = () => {
    const variableName = supportsMotion ? "--home-module-reveal-duration" : "--home-module-reduced-duration";
    const fallback = supportsMotion ? 110 : 160;
    return parseCSSTime(getComputedStyle(root).getPropertyValue(variableName), fallback);
  };

  const currentFile = () => window.location.pathname.split("/").pop() || "index.html";

  const moduleSubSections = {
    "why-gap.html": [
      { id: "the-why", label: "The Why", panelIds: ["motivation", "problem-space"] },
      { id: "gap-analysis", label: "The Gap", panelIds: ["academic-gap", "commercial-gap", "gap-references"] },
      { id: "stakeholders", label: "The Stakeholders" }
    ],
    "user-requirements.html": [
      { id: "journey-map", label: "User Journey Map" },
      { id: "requirements-traceability", label: "Requirements List", panelIds: ["requirements-list", "traceability"] },
      { id: "evidence", label: "Evidence of Life" }
    ],
    "iteration-alternatives.html": [
      { id: "crazy-eights", label: "Crazy Eights", panelIds: ["crazy-eights-panel"] },
      { id: "design-alternatives", label: "Design Alternatives", panelIds: ["design-alternatives-panel", "mid-hi-prototype-evolution", "why-changed", "final-design-direction"] },
      { id: "low-fi-prototype", label: "Low-Fi Prototype", panelIds: ["low-fi-prototype-links", "low-fi-prototype-panel"] }
    ],
    "implementation.html": [
      { id: "architecture", label: "System Architecture", panelIds: ["architecture", "technical-notes"] },
      { id: "high-fi", label: "High-Fi Prototype", panelIds: ["high-fi", "core-features"] },
      { id: "squad", label: "Individual Contributions" }
    ],
    "evaluation-reflection.html": [
      { id: "testing-overview", label: "Usability Testing", panelIds: ["testing-overview", "participants-study-phases", "testing-tasks", "results"] },
      { id: "refinement", label: "Iterative Refinement" },
      { id: "final-reflection", label: "Final Reflection", panelIds: ["final-reflection", "ai-reflection", "ai-tool-used"] }
    ]
  };

  const setCurrentNavigation = () => {
    const current = currentFile();

    document.querySelectorAll(".page-link, .menu-item").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      const linkFile = href.split("#")[0].split("/").pop() || "index.html";
      const isCurrent = linkFile === current;

      if (isCurrent) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const initReveal = () => {
    const immediateShow = (element) => element.classList.add("is-visible");

    if (!supportsMotion || !("IntersectionObserver" in window)) {
      document.querySelectorAll(revealSelector).forEach((element) => {
        element.classList.add("ux-reveal", "is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.12
    });

    const observeReveal = (element, index = 0) => {
      if (revealed.has(element)) return;
      revealed.add(element);
      element.classList.add("ux-reveal");
      element.style.setProperty("--ux-delay", `${Math.min(index % 7, 6) * 35}ms`);

      if (element.getBoundingClientRect().top < window.innerHeight * 0.92) {
        immediateShow(element);
      } else {
        observer.observe(element);
      }
    };

    document.querySelectorAll(revealSelector).forEach(observeReveal);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;

          if (node.matches(revealSelector)) observeReveal(node);
          node.querySelectorAll(revealSelector).forEach(observeReveal);
        });
      });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
  };

  const bindCopyFeedback = () => {
    document.querySelectorAll("[data-copy]").forEach((button) => {
      if (button.dataset.copyBound === "true") return;
      button.dataset.copyBound = "true";

      button.addEventListener("click", async () => {
        const originalLabel = button.textContent;

        try {
          await navigator.clipboard.writeText(button.getAttribute("data-copy") || "");
          button.textContent = "Copied";
        } catch {
          button.textContent = "Copy failed";
        }

        window.setTimeout(() => {
          button.textContent = originalLabel;
        }, 1300);
      });
    });
  };

  const initEvidenceCarousels = () => {
    document.querySelectorAll("[data-evidence-carousel]").forEach((carousel) => {
      if (carousel.dataset.carouselBound === "true") return;
      carousel.dataset.carouselBound = "true";

      const track = carousel.querySelector("[data-evidence-track]");
      const cards = Array.from(carousel.querySelectorAll("[data-evidence-card]"));
      const dots = Array.from(carousel.querySelectorAll("[data-evidence-dot]"));
      const previousButton = carousel.querySelector(".evidence-carousel-arrow--prev");
      const nextButton = carousel.querySelector(".evidence-carousel-arrow--next");

      if (!track || cards.length === 0) return;

      let activeIndex = Math.max(0, cards.findIndex((card) => card.classList.contains("is-active")));
      let scrollTimer = 0;
      let isDragging = false;
      let didDrag = false;
      let pointerStartX = 0;
      let scrollStartX = 0;

      const scrollToCard = (index, behavior = supportsMotion ? "smooth" : "auto") => {
        const card = cards[index];
        if (!card) return;

        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const nextScroll = clamp(card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, 0, maxScroll);

        if (typeof track.scrollTo === "function") {
          track.scrollTo({ left: nextScroll, behavior });
        } else {
          track.scrollLeft = nextScroll;
        }
      };

      const closeTouchPanels = (exceptCard = null) => {
        cards.forEach((card) => {
          if (card !== exceptCard) card.classList.remove("is-touch-open");
        });
      };

      const setActive = (index, shouldScroll = false, behavior) => {
        activeIndex = Math.round(clamp(index, 0, cards.length - 1));

        cards.forEach((card, cardIndex) => {
          const distance = Math.abs(cardIndex - activeIndex);
          const isActive = cardIndex === activeIndex;

          card.classList.toggle("is-active", isActive);
          card.classList.toggle("is-neighbor", distance === 1);
          card.classList.toggle("is-distant", distance > 1);

          if (isActive) {
            card.setAttribute("aria-current", "true");
          } else {
            card.removeAttribute("aria-current");
          }
        });

        dots.forEach((dot, dotIndex) => {
          const isActive = dotIndex === activeIndex;
          dot.classList.toggle("is-active", isActive);

          if (isActive) {
            dot.setAttribute("aria-current", "true");
          } else {
            dot.removeAttribute("aria-current");
          }
        });

        if (previousButton) previousButton.disabled = activeIndex === 0;
        if (nextButton) nextButton.disabled = activeIndex === cards.length - 1;
        if (shouldScroll) scrollToCard(activeIndex, behavior);
      };

      const closestCardIndex = () => {
        const trackCenter = track.scrollLeft + track.clientWidth / 2;

        return cards.reduce((closestIndex, card, cardIndex) => {
          const cardCenter = card.offsetLeft + card.offsetWidth / 2;
          const closestCenter = cards[closestIndex].offsetLeft + cards[closestIndex].offsetWidth / 2;
          return Math.abs(cardCenter - trackCenter) < Math.abs(closestCenter - trackCenter)
            ? cardIndex
            : closestIndex;
        }, 0);
      };

      const syncActiveFromScroll = () => {
        setActive(closestCardIndex());
      };

      previousButton?.addEventListener("click", () => {
        closeTouchPanels();
        setActive(activeIndex - 1, true);
      });

      nextButton?.addEventListener("click", () => {
        closeTouchPanels();
        setActive(activeIndex + 1, true);
      });

      dots.forEach((dot, dotIndex) => {
        dot.addEventListener("click", () => {
          closeTouchPanels();
          setActive(dotIndex, true);
        });
      });

      cards.forEach((card, cardIndex) => {
        card.addEventListener("focus", () => {
          setActive(cardIndex, true);
        });

        card.addEventListener("pointerup", (event) => {
          if (didDrag || event.pointerType === "mouse") return;
          closeTouchPanels(card);
          setActive(cardIndex, true);
          card.classList.toggle("is-touch-open");
        });

        card.addEventListener("keydown", (event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            closeTouchPanels();
            setActive(activeIndex + (event.key === "ArrowRight" ? 1 : -1), true);
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            closeTouchPanels(card);
            card.classList.toggle("is-touch-open");
          }

          if (event.key === "Escape") {
            card.classList.remove("is-touch-open");
          }
        });

        card.addEventListener("blur", () => {
          card.classList.remove("is-touch-open");
        });
      });

      track.addEventListener("scroll", () => {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(syncActiveFromScroll, 80);
      }, { passive: true });

      track.addEventListener("wheel", (event) => {
        const hasHorizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
        if (!hasHorizontalIntent) return;

        const delta = event.deltaX || event.deltaY;
        if (!delta) return;

        const maxScroll = track.scrollWidth - track.clientWidth;
        const nextScroll = clamp(track.scrollLeft + delta, 0, maxScroll);

        if (nextScroll === track.scrollLeft) return;
        event.preventDefault();
        closeTouchPanels();
        track.scrollLeft = nextScroll;
      }, { passive: false });

      track.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "mouse") return;

        isDragging = true;
        didDrag = false;
        pointerStartX = event.clientX;
        scrollStartX = track.scrollLeft;
        track.classList.add("is-dragging");
        track.setPointerCapture(event.pointerId);
      });

      track.addEventListener("pointermove", (event) => {
        if (!isDragging || event.pointerType !== "mouse") return;

        const dragDelta = event.clientX - pointerStartX;
        if (Math.abs(dragDelta) > 4) didDrag = true;
        track.scrollLeft = scrollStartX - dragDelta;
      });

      ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
        track.addEventListener(type, () => {
          if (!isDragging) return;

          isDragging = false;
          track.classList.remove("is-dragging");
          syncActiveFromScroll();
          window.setTimeout(() => {
            didDrag = false;
          }, 0);
        });
      });

      track.addEventListener("dragstart", (event) => event.preventDefault());
      window.addEventListener("resize", () => scrollToCard(activeIndex, "auto"), { passive: true });

      setActive(activeIndex);
      window.requestAnimationFrame(() => scrollToCard(activeIndex, "auto"));
    });
  };

  const initTestingEvidenceGalleries = () => {
    document.querySelectorAll("[data-testing-evidence-gallery]").forEach((gallery) => {
      if (gallery.dataset.testingEvidenceBound === "true") return;
      gallery.dataset.testingEvidenceBound = "true";

      const slider = gallery.querySelector(".testing-evidence-slider");
      const slides = Array.from(gallery.querySelectorAll("[data-testing-evidence-slide]"));
      const panels = Array.from(gallery.querySelectorAll("[data-testing-evidence-panel]"));
      const itemCount = Math.min(slides.length, panels.length);

      if (!slider || !itemCount) return;

      const galleryStyles = getComputedStyle(gallery);
      const clickDuration = parseCSSTime(galleryStyles.getPropertyValue("--testing-evidence-click-duration"), 900);
      const enterDelay = parseCSSTime(galleryStyles.getPropertyValue("--testing-evidence-enter-delay"), 430);
      let activeIndex = Math.max(0, panels.findIndex((panel) => panel.classList.contains("is-active")));
      let enterTimer = 0;
      let animationTimer = 0;
      let isAnimating = false;

      const updatePanels = (index = activeIndex) => {
        const panelActiveIndex = (Math.round(index) + itemCount) % itemCount;

        panels.forEach((panel, panelIndex) => {
          const isActive = panelIndex === panelActiveIndex;
          panel.classList.toggle("is-active", isActive);

          if (supportsMotion) {
            panel.setAttribute("aria-hidden", isActive ? "false" : "true");
          } else {
            panel.removeAttribute("aria-hidden");
          }
        });
      };

      const setInitialState = (index = activeIndex) => {
        activeIndex = (Math.round(index) + itemCount) % itemCount;
        const nextIndex = (activeIndex + 1) % itemCount;

        slides.forEach((slide, slideIndex) => {
          const isActive = slideIndex === activeIndex;
          const isNext = itemCount > 1 && slideIndex === nextIndex;

          slide.classList.remove("is-active", "is-leaving", "is-entering", "is-next");
          slide.classList.toggle("is-active", isActive);
          slide.classList.toggle("is-next", isNext);

          if (isActive) {
            slide.setAttribute("aria-current", "true");
            slide.removeAttribute("aria-hidden");
          } else {
            slide.removeAttribute("aria-current");
            if (supportsMotion) {
              slide.setAttribute("aria-hidden", "true");
            } else {
              slide.removeAttribute("aria-hidden");
            }
          }
        });

        updatePanels();
      };

      const showNext = () => {
        if (isAnimating || itemCount < 2) return;

        if (!supportsMotion) {
          activeIndex = (activeIndex + 1) % itemCount;
          setInitialState();
          return;
        }

        isAnimating = true;
        const leavingIndex = activeIndex;
        const enteringIndex = (activeIndex + 1) % itemCount;
        const nextPreviewIndex = (activeIndex + 2) % itemCount;

        slides.forEach((slide) => {
          slide.classList.remove("is-active", "is-leaving", "is-entering", "is-next");
          slide.removeAttribute("aria-current");
          slide.setAttribute("aria-hidden", "true");
        });

        slides[leavingIndex].classList.add("is-leaving");
        slides[leavingIndex].setAttribute("aria-current", "true");
        slides[leavingIndex].removeAttribute("aria-hidden");
        slides[enteringIndex].classList.add("is-next");
        updatePanels(enteringIndex);

        window.clearTimeout(enterTimer);
        window.clearTimeout(animationTimer);
        enterTimer = window.setTimeout(() => {
          slides[enteringIndex].classList.remove("is-next");
          slides[enteringIndex].classList.add("is-entering");

          if (nextPreviewIndex !== leavingIndex && nextPreviewIndex !== enteringIndex) {
            slides[nextPreviewIndex].classList.add("is-next");
          }
        }, enterDelay);

        animationTimer = window.setTimeout(() => {
          activeIndex = enteringIndex;
          setInitialState();
          isAnimating = false;
        }, clickDuration);
      };

      slider.addEventListener("click", showNext);
      gallery.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowRight") return;

        event.preventDefault();
        showNext();
      });

      setInitialState();

      if (!supportsMotion) {
        gallery.classList.add("is-reduced-motion");
      }
    });
  };

  const initVibeProcessTimeline = () => {
    const board = document.querySelector(".evaluation-page .vibe-process-board");
    if (!board || board.dataset.vibeProcessBound === "true") return;

    const header = board.previousElementSibling?.classList.contains("vibe-process-header")
      ? board.previousElementSibling
      : null;
    const timeline = board.querySelector(".vibe-timeline");
    const layout = board.querySelector(".vibe-process-layout");
    const routeMain = board.querySelector(".route-main");
    const steps = Array.from(board.querySelectorAll(".timeline-step"));
    const shots = Array.from(board.querySelectorAll(".vibe-process-shot"));

    if (!layout || !timeline || !routeMain || !steps.length || !shots.length) return;

    board.dataset.vibeProcessBound = "true";
    board.style.setProperty("--vibe-step-count", String(steps.length));

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const baseTimelineWidth = 780;
    let routeLength = 1;
    let stepRouteProgresses = [];
    let stepCenters = [];
    let activeIndex = -1;
    let frameId = 0;
    let visualFrameId = 0;
    let desktopEnabled = false;
    let progress = 0;
    let isPinned = false;
    let hasCompletedForward = false;
    let finishScrollDebt = 0;
    const scrollSensitivity = 12000;
    const finishReleaseThreshold = 950;

    const getStageScale = () => clamp(timeline.clientWidth / baseTimelineWidth, 0.58, 1);

    const getRouteViewportMapper = () => {
      const svg = routeMain.ownerSVGElement;
      const rect = svg?.getBoundingClientRect();
      const viewBox = svg?.viewBox?.baseVal;

      if (!svg || !rect || !viewBox || rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      return (point) => ({
        x: rect.left + ((point.x - viewBox.x) / viewBox.width) * rect.width,
        y: rect.top + ((point.y - viewBox.y) / viewBox.height) * rect.height
      });
    };

    const resetTilt = (shot) => {
      shot.style.setProperty("--vibe-tilt-x", "0deg");
      shot.style.setProperty("--vibe-tilt-y", "0deg");
    };

    const syncRouteLength = () => {
      try {
        routeLength = Math.max(1, routeMain.getTotalLength());
      } catch {
        routeLength = 1;
      }

      board.style.setProperty("--vibe-route-length", routeLength.toFixed(2));
      board.style.setProperty("--vibe-route-offset", (routeLength * (1 - clamp(progress, 0, 1))).toFixed(2));
    };

    const hasTimelineLayout = () => timeline.offsetWidth > 0 && timeline.offsetHeight > 0;

    const syncStepRouteProgresses = () => {
      if (!hasTimelineLayout()) {
        stepCenters = [];
        stepRouteProgresses = [];
        return false;
      }

      const routeViewportPoint = getRouteViewportMapper();

      if (!routeViewportPoint) {
        stepCenters = [];
        stepRouteProgresses = [];
        return false;
      }

      stepCenters = steps.map((step) => {
        const circle = step.querySelector(".step-circle");

        if (!circle) {
          return {
            x: step.offsetLeft + (step.offsetWidth / 2),
            y: step.offsetTop + (step.offsetHeight / 2),
            viewportX: 0,
            viewportY: 0,
            viewportRadius: 0
          };
        }

        const circleRect = circle.getBoundingClientRect();
        const routeRect = routeMain.ownerSVGElement.getBoundingClientRect();
        const viewBox = routeMain.ownerSVGElement.viewBox.baseVal;
        const viewportX = circleRect.left + (circleRect.width / 2);
        const viewportY = circleRect.top + (circleRect.height / 2);

        return {
          x: ((viewportX - routeRect.left) / routeRect.width) * viewBox.width,
          y: ((viewportY - routeRect.top) / routeRect.height) * viewBox.height,
          radius: Math.min(circle.offsetWidth, circle.offsetHeight) / 2,
          viewportX,
          viewportY,
          viewportRadius: Math.min(circleRect.width, circleRect.height) / 2
        };
      });

      if (!routeLength || routeLength <= 1) {
        stepRouteProgresses = steps.map((_, index) => index / Math.max(1, steps.length - 1));
        return true;
      }

      const sampleCount = 2400;
      const routeSamples = Array.from({ length: sampleCount + 1 }, (_, sampleIndex) => {
        const length = (routeLength * sampleIndex) / sampleCount;
        const point = routeMain.getPointAtLength(length);
        const viewportPoint = routeViewportPoint(point);
        return {
          length,
          x: point.x,
          y: point.y,
          viewportX: viewportPoint.x,
          viewportY: viewportPoint.y
        };
      });
      const findRouteProgressAtCircle = (center, minimumProgress = 0) => {
        const radius = Math.max(10, (center.viewportRadius ?? 0) - 3);
        const minimumLength = routeLength * minimumProgress;
        let isInsideCircle = false;
        let closestInsideLength = 0;
        let closestInsideDistance = Infinity;

        for (let sampleIndex = 1; sampleIndex < routeSamples.length; sampleIndex += 1) {
          const current = routeSamples[sampleIndex];
          if (current.length < minimumLength) continue;

          const currentDistance = Math.hypot(
            current.viewportX - center.viewportX,
            current.viewportY - center.viewportY
          );

          if (currentDistance <= radius) {
            isInsideCircle = true;

            if (currentDistance < closestInsideDistance) {
              closestInsideDistance = currentDistance;
              closestInsideLength = current.length;
            }
          } else if (isInsideCircle) {
            return closestInsideLength / routeLength;
          }
        }

        return isInsideCircle ? closestInsideLength / routeLength : null;
      };
      const findRouteProgressAtViewportY = (targetY, minimumProgress = 0) => {
        const minimumLength = routeLength * minimumProgress;
        const firstSample = routeSamples.find((sample) => sample.length >= minimumLength) ?? routeSamples[0];

        if (targetY <= firstSample.viewportY) return minimumProgress;

        for (let sampleIndex = 1; sampleIndex < routeSamples.length; sampleIndex += 1) {
          const previous = routeSamples[sampleIndex - 1];
          const current = routeSamples[sampleIndex];

          if (current.length < minimumLength) continue;

          if (previous.viewportY <= targetY && current.viewportY >= targetY) {
            const spanY = Math.max(0.0001, current.viewportY - previous.viewportY);
            const blend = clamp((targetY - previous.viewportY) / spanY, 0, 1);
            return (previous.length + ((current.length - previous.length) * blend)) / routeLength;
          }
        }

        return 1;
      };

      stepRouteProgresses = stepCenters.reduce((progresses, center, index) => {
        const previous = index > 0 ? progresses[index - 1] : 0;
        let routeProgress = findRouteProgressAtCircle(center, previous);

        if (routeProgress === null) {
          const targetY = center.viewportY + ((center.viewportRadius ?? 0) * 0.55);
          routeProgress = findRouteProgressAtViewportY(targetY, previous);
        }

        progresses.push(clamp(
          Math.max(routeProgress, previous + (index > 0 ? 0.001 : 0)),
          0,
          1
        ));

        return progresses;
      }, []);

      return true;
    };

    const getStepCenterY = (index) => {
      const center = stepCenters[index];
      const step = steps[index];
      return center?.y ?? (step ? step.offsetTop + (step.offsetHeight / 2) : 0);
    };

    const getTouchedStepIndex = (routeProgress, progressStops) => {
      let touchedIndex = -1;

      progressStops.forEach((stop, stopIndex) => {
        if (routeProgress >= stop) {
          touchedIndex = stopIndex;
        }
      });

      return touchedIndex;
    };

    const getFocusPositionFromRouteProgress = (routeProgress, progressStops) => {
      if (!progressStops.length) return 0;
      if (routeProgress <= progressStops[0]) return 0;

      for (let stopIndex = 0; stopIndex < progressStops.length - 1; stopIndex += 1) {
        const currentStop = progressStops[stopIndex];
        const nextStop = progressStops[stopIndex + 1];

        if (routeProgress <= nextStop) {
          const span = Math.max(0.0001, nextStop - currentStop);
          return stopIndex + clamp((routeProgress - currentStop) / span, 0, 1);
        }
      }

      return progressStops.length - 1;
    };

    const getDisplayedRouteProgress = () => {
      const computedOffset = Number.parseFloat(getComputedStyle(routeMain).strokeDashoffset);

      if (!Number.isFinite(computedOffset) || routeLength <= 0) {
        return clamp(progress, 0, 1);
      }

      return clamp(1 - (computedOffset / routeLength), 0, 1);
    };

    const setShotStack = (focusPosition, index) => {
      shots.forEach((shot, shotIndex) => {
        const distance = shotIndex - focusPosition;
        const absDistance = Math.abs(distance);
        let x = distance * 62;
        let y = 18 + absDistance * 34;
        let scale = clamp(1 - absDistance * 0.13, 0.7, 1);
        let opacity = clamp(1 - absDistance * 0.46, 0, 1);
        let rotation = clamp(distance * 3.4, -6, 6);
        let zIndex = Math.max(1, Math.round(30 - absDistance * 7));

        if (shotIndex === index) {
          x = 0;
          y = absDistance * 10;
          scale = clamp(1 - absDistance * 0.04, 0.96, 1);
          opacity = clamp(1 - absDistance * 0.18, 0.86, 1);
          rotation = 0;
          zIndex = 30;
        } else if (absDistance > 2.4) {
          x = distance < 0 ? -138 : 154;
          y = 96;
          scale = 0.7;
          opacity = 0;
          rotation = distance < 0 ? -6 : 6;
        }

        shot.classList.toggle("is-active", shotIndex === index);
        shot.classList.toggle("is-before", distance < 0);
        shot.classList.toggle("is-after", distance > 0);
        shot.style.setProperty("--vibe-card-x", `${x}px`);
        shot.style.setProperty("--vibe-card-y", `${y}px`);
        shot.style.setProperty("--vibe-card-scale", scale.toFixed(2));
        shot.style.setProperty("--vibe-card-opacity", opacity.toFixed(2));
        shot.style.setProperty("--vibe-card-rotate", `${rotation}deg`);
        shot.style.zIndex = String(zIndex);

        if (shotIndex === index) {
          shot.setAttribute("aria-current", "true");
          shot.removeAttribute("aria-hidden");
        } else {
          shot.removeAttribute("aria-current");
          shot.setAttribute("aria-hidden", "true");
          resetTilt(shot);
        }
      });
    };

    const setActive = (index) => {
      if (index === activeIndex) return;
      activeIndex = index;

      steps.forEach((step, stepIndex) => {
        const isActive = stepIndex === activeIndex;
        step.classList.toggle("is-active", isActive);
        step.classList.toggle("is-before", stepIndex < activeIndex);
        step.classList.toggle("is-after", stepIndex > activeIndex);

        if (isActive) {
          step.setAttribute("aria-current", "step");
        } else {
          step.removeAttribute("aria-current");
        }
      });

      const isAiPhase = activeIndex >= 4;
      board.classList.toggle("is-ai-phase", isAiPhase);
      header?.classList.toggle("is-ai-phase", isAiPhase);
    };

    const syncPinMetrics = () => {
      const rect = board.getBoundingClientRect();
      const pinTop = clamp(window.innerHeight * 0.03, 16, 34);

      board.style.setProperty("--vibe-pin-left", `${rect.left.toFixed(1)}px`);
      board.style.setProperty("--vibe-pin-width", `${rect.width.toFixed(1)}px`);
      board.style.setProperty("--vibe-pin-top", `${pinTop.toFixed(1)}px`);

      return { rect, pinTop };
    };

    const syncActiveState = (activeRouteProgress = getDisplayedRouteProgress()) => {
      const progressStops = stepRouteProgresses.length === steps.length
        ? stepRouteProgresses
        : steps.map((_, stepIndex) => stepIndex / Math.max(1, steps.length - 1));
      const maxFocusPosition = Math.max(0, steps.length - 1);
      const focusPosition = clamp(
        getFocusPositionFromRouteProgress(activeRouteProgress, progressStops),
        0,
        maxFocusPosition
      );
      const index = getTouchedStepIndex(activeRouteProgress, progressStops);
      const shotFocusPosition = index >= 0 ? index : 0;

      steps.forEach((step, stepIndex) => {
        const distance = Math.abs(stepIndex - focusPosition);
        const opacity = clamp(1 - distance * 0.58, 0.34, 1);
        step.style.setProperty("--vibe-step-opacity", opacity.toFixed(3));
        step.style.setProperty("--vibe-step-scale", "1");
      });

      setActive(index);
      setShotStack(shotFocusPosition, index);
    };

    const scheduleVisualSync = () => {
      if (visualFrameId) return;

      visualFrameId = window.requestAnimationFrame(() => {
        visualFrameId = 0;
        if (!desktopEnabled || stepRouteProgresses.length !== steps.length) return;

        const displayedProgress = getDisplayedRouteProgress();
        syncActiveState(displayedProgress);

        if (Math.abs(displayedProgress - progress) > 0.001) {
          scheduleVisualSync();
        }
      });
    };

    const render = () => {
      if (stepRouteProgresses.length !== steps.length && !syncStepRouteProgresses()) return;

      const stageScale = getStageScale();
      const routeProgress = clamp(progress, 0, 1);
      const routeFocusPosition = clamp(
        getFocusPositionFromRouteProgress(routeProgress, stepRouteProgresses),
        0,
        Math.max(0, steps.length - 1)
      );
      const lowerIndex = Math.floor(routeFocusPosition);
      const upperIndex = Math.min(steps.length - 1, lowerIndex + 1);
      const blend = routeFocusPosition - lowerIndex;
      let activeCenter = getStepCenterY(lowerIndex);

      try {
        activeCenter = routeMain.getPointAtLength(routeLength * routeProgress).y;
      } catch {
        const lowerCenter = getStepCenterY(lowerIndex);
        const upperCenter = getStepCenterY(upperIndex);
        activeCenter = lowerCenter + (upperCenter - lowerCenter) * blend;
      }

      const trackY = (timeline.clientHeight * 0.52) - (activeCenter * stageScale);
      const routeOffset = Math.max(0, routeLength * (1 - routeProgress));

      board.style.setProperty("--vibe-stage-scale", stageScale.toFixed(4));
      board.style.setProperty("--vibe-progress", progress.toFixed(4));
      board.style.setProperty("--vibe-route-offset", routeOffset.toFixed(2));
      timeline.style.setProperty("--vibe-track-y", `${trackY.toFixed(1)}px`);
      scheduleVisualSync();
    };

    const releasePin = () => {
      isPinned = false;
      board.classList.remove("is-vibe-pinned");
      document.documentElement.classList.remove("is-vibe-scroll-locked");
    };

    const reset = () => {
      releasePin();
      board.classList.remove("is-vibe-story", "is-ai-phase");
      header?.classList.remove("is-ai-phase");
      board.style.removeProperty("--vibe-pin-left");
      board.style.removeProperty("--vibe-pin-width");
      board.style.removeProperty("--vibe-pin-top");
      timeline.style.removeProperty("--vibe-track-y");
      board.style.setProperty("--vibe-stage-scale", "1");
      board.style.setProperty("--vibe-progress", "0");
      board.style.setProperty("--vibe-route-offset", routeLength.toFixed(2));
      progress = 0;
      hasCompletedForward = false;
      finishScrollDebt = 0;
      activeIndex = -1;

      if (visualFrameId) {
        window.cancelAnimationFrame(visualFrameId);
        visualFrameId = 0;
      }

      steps.forEach((step) => {
        step.classList.remove("is-active", "is-before", "is-after");
        step.removeAttribute("aria-current");
        step.style.removeProperty("--vibe-step-opacity");
        step.style.removeProperty("--vibe-step-scale");
      });

      shots.forEach((shot) => {
        shot.classList.remove("is-active", "is-before", "is-after");
        shot.removeAttribute("aria-current");
        shot.removeAttribute("aria-hidden");
        shot.style.removeProperty("--vibe-card-x");
        shot.style.removeProperty("--vibe-card-y");
        shot.style.removeProperty("--vibe-card-scale");
        shot.style.removeProperty("--vibe-card-opacity");
        shot.style.removeProperty("--vibe-card-rotate");
        shot.style.removeProperty("z-index");
        resetTilt(shot);
      });
    };

    const pin = (startProgress = progress) => {
      if (isPinned) return;

      const { rect, pinTop } = syncPinMetrics();
      window.scrollTo({
        top: window.scrollY + rect.top - pinTop,
        left: window.scrollX,
        behavior: "auto"
      });

      syncPinMetrics();
      progress = clamp(startProgress, 0, 1);
      finishScrollDebt = 0;
      isPinned = true;
      board.classList.add("is-vibe-story", "is-vibe-pinned");
      document.documentElement.classList.add("is-vibe-scroll-locked");
      render();
    };

    const scrollPastBoard = () => {
      const nextSection = board.nextElementSibling;
      const pinTop = clamp(window.innerHeight * 0.03, 16, 34);
      const targetTop = nextSection
        ? window.scrollY + nextSection.getBoundingClientRect().top - pinTop
        : window.scrollY + board.getBoundingClientRect().bottom - pinTop;

      window.scrollTo({
        top: Math.max(0, targetTop),
        left: window.scrollX,
        behavior: "auto"
      });
    };

    const update = () => {
      frameId = 0;

      if (!desktopQuery.matches) {
        if (desktopEnabled) {
          desktopEnabled = false;
          reset();
        }
        return;
      }

      desktopEnabled = true;
      board.classList.add("is-vibe-story");
      syncPinMetrics();

      if (!isPinned) {
        const rect = board.getBoundingClientRect();
        if (rect.top > window.innerHeight) {
          progress = 0;
          hasCompletedForward = false;
        } else if (rect.bottom < 0) {
          progress = 1;
          hasCompletedForward = true;
        }
        render();
      }
    };

    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(update);
    };

    const handleWheel = (event) => {
      if (!desktopQuery.matches) return;

      const delta = event.deltaY;
      if (!delta) return;

      if (delta < 0) finishScrollDebt = 0;

      if (!isPinned) {
        const { rect, pinTop } = syncPinMetrics();
        const isEnteringFromTop = delta > 0 && rect.top <= pinTop && rect.bottom > pinTop;
        const isReturningFromBelow = delta < 0 && rect.top < pinTop && rect.bottom >= pinTop;

        if (hasCompletedForward && delta > 0) return;
        if (!isEnteringFromTop && !isReturningFromBelow) return;
        event.preventDefault();
        hasCompletedForward = false;
        pin(isReturningFromBelow ? 1 : 0);
      }

      if (progress <= 0 && delta < 0) {
        releasePin();
        return;
      }

      if (progress >= 1 && delta > 0) {
        event.preventDefault();
        finishScrollDebt += Math.abs(delta);

        if (finishScrollDebt >= finishReleaseThreshold) {
          hasCompletedForward = true;
          releasePin();
          scrollPastBoard();
        }

        return;
      }

      const nextProgress = clamp(progress + (delta / scrollSensitivity), 0, 1);

      event.preventDefault();
      progress = nextProgress;
      if (progress < 1) finishScrollDebt = 0;
      syncPinMetrics();
      render();
    };

    shots.forEach((shot) => {
      shot.addEventListener("pointermove", (event) => {
        if (!desktopQuery.matches || !shot.classList.contains("is-active") || event.pointerType !== "mouse") return;

        const rect = shot.getBoundingClientRect();
        const xRatio = ((event.clientX - rect.left) / rect.width) - 0.5;
        const yRatio = ((event.clientY - rect.top) / rect.height) - 0.5;
        shot.style.setProperty("--vibe-tilt-x", `${(xRatio * 7).toFixed(2)}deg`);
        shot.style.setProperty("--vibe-tilt-y", `${(-yRatio * 5).toFixed(2)}deg`);
      });

      shot.addEventListener("pointerleave", () => resetTilt(shot));
    });

    const syncMeasurementsAndUpdate = () => {
      syncRouteLength();
      syncStepRouteProgresses();
      scheduleUpdate();
    };

    syncRouteLength();
    syncStepRouteProgresses();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("resize", syncMeasurementsAndUpdate, { passive: true });
    desktopQuery.addEventListener?.("change", scheduleUpdate);
    if ("ResizeObserver" in window) {
      const layoutObserver = new ResizeObserver(syncMeasurementsAndUpdate);
      layoutObserver.observe(board);
      layoutObserver.observe(timeline);
      board.vibeProcessLayoutObserver = layoutObserver;
    }
    scheduleUpdate();
  };

  const isDisabledEntry = (element) => (
    element.matches("[disabled], [aria-disabled='true'], .disabled, .is-disabled")
    || element.dataset.disabled === "true"
  );

  const shouldUseNativeNavigation = (event, anchor) => {
    const href = anchor.getAttribute("href");

    return (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || anchor.hasAttribute("download")
      || (anchor.target && anchor.target !== "_self")
      || !href
      || href.startsWith("#")
      || href.startsWith("mailto:")
      || href.startsWith("tel:")
      || href.startsWith("javascript:")
      || isDisabledEntry(anchor)
    );
  };

  const markHomeModuleTransitionReveal = (targetHref) => {
    try {
      window.sessionStorage.setItem(homeModuleTransitionStorageKey, JSON.stringify({
        href: new URL(targetHref, window.location.href).pathname,
        startedAt: Date.now()
      }));
    } catch {
      // If sessionStorage is unavailable, the same-page overlay still prevents the home flash.
    }
  };

  const consumeHomeModuleTransitionReveal = () => {
    if (document.body.classList.contains("home-page")) return false;

    try {
      const rawValue = window.sessionStorage.getItem(homeModuleTransitionStorageKey);
      if (!rawValue) return false;

      window.sessionStorage.removeItem(homeModuleTransitionStorageKey);
      const payload = JSON.parse(rawValue);
      return !payload.startedAt || Date.now() - payload.startedAt < 10000;
    } catch {
      return false;
    }
  };

  const buildHomeModuleTransition = (phase = "departing") => {
    const existingOverlay = document.querySelector(".home-module-transition");
    if (existingOverlay) {
      existingOverlay.classList.add(`home-module-transition--${phase}`);
      return existingOverlay;
    }

    const overlay = document.createElement("div");
    overlay.className = `home-module-transition home-module-transition--${phase}${supportsMotion ? "" : " is-reduced-motion"}`;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="home-module-transition__sky"></div>
      <div class="home-module-transition__stars home-module-transition__stars--far"></div>
      <div class="home-module-transition__stars home-module-transition__stars--near"></div>
      <div class="home-module-transition__wall" aria-hidden="true"></div>
      <svg class="home-module-transition__trail" viewBox="0 0 420 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M24 218 C 118 150, 156 188, 218 110 S 324 34, 396 52"></path>
        <circle cx="88" cy="176" r="7"></circle>
        <circle cx="219" cy="108" r="6"></circle>
        <circle cx="336" cy="42" r="7"></circle>
      </svg>
    `;

    document.body.appendChild(overlay);
    return overlay;
  };

  const finishHomeModuleReveal = () => {
    if (!consumeHomeModuleTransitionReveal()) return;

    document.body.classList.add("is-home-module-transitioning");
    document.body.setAttribute("aria-busy", "true");

    const overlay = buildHomeModuleTransition("reveal");
    window.setTimeout(() => {
      overlay.remove();
      document.body.classList.remove("is-home-module-transitioning");
      document.body.removeAttribute("aria-busy");
    }, getHomeModuleRevealDuration());
  };

  const startHomeModuleTransition = (targetHref, sourceEntry) => {
    if (homeModuleTransitionRunning) return;
    homeModuleTransitionRunning = true;

    sourceEntry?.classList.add("is-transition-pressed");
    document.body.classList.add("is-home-module-transitioning");
    document.body.setAttribute("aria-busy", "true");
    buildHomeModuleTransition("departing");
    markHomeModuleTransitionReveal(targetHref);

    window.setTimeout(() => {
      try {
        window.location.assign(targetHref);
      } catch {
        window.location.href = targetHref;
      }
    }, getHomeModuleTransitionDuration() + getHomeModuleTransitionHoldDuration());
  };

  const bindHomeModuleTransition = () => {
    if (!document.body.classList.contains("home-page")) return;

    document.querySelectorAll(".home-model-menu .menu-item[href], .home-nav-grid .module-card[href], [data-home-module][href], [data-module-route]").forEach((entry) => {
      if (entry.dataset.homeModuleTransitionBound === "true") return;
      entry.dataset.homeModuleTransitionBound = "true";

      entry.addEventListener("click", (event) => {
        const anchor = entry.matches("a[href]") ? entry : entry.closest("a[href]");
        const targetHref = entry.dataset.moduleRoute || anchor?.href;

        if (!targetHref || isDisabledEntry(entry) || (anchor && shouldUseNativeNavigation(event, anchor))) return;

        event.preventDefault();
        if (homeModuleTransitionRunning) return;

        startHomeModuleTransition(targetHref, entry);
      });
    });
  };

  const initModuleSubSections = () => {
    if (!document.body.classList.contains("module-page")) return;

    const sections = (moduleSubSections[currentFile()] || [])
      .map((section) => {
        const panelIds = section.panelIds || [section.id];
        const panels = panelIds.map((id) => document.getElementById(id)).filter(Boolean);
        return { ...section, panelIds, panels };
      })
      .filter((section) => section.panels.length);

    if (sections.length <= 1 || document.querySelector(".module-subsection-nav")) return;

    const titleCard = document.querySelector(".page-title-card");
    const pageHero = titleCard?.closest(".page-hero");
    if (!titleCard || !pageHero) return;

    const nav = document.createElement("nav");
    nav.className = "module-subsection-nav";
    nav.setAttribute("aria-label", "Current module sections");
    nav.innerHTML = `
      <div class="module-subsection-scroll" role="tablist" aria-orientation="horizontal">
        ${sections.map((section, index) => `
          <span class="module-subsection-item" role="presentation">
            <span class="module-subsection-button-borders" role="presentation">
              <button
                class="module-subsection-button"
                type="button"
                role="tab"
                id="subsection-tab-${section.id}"
                aria-controls="${section.panelIds.join(" ")}"
                aria-selected="${index === 0 ? "true" : "false"}"
                data-section-target="${section.id}"
              >${section.label}</button>
            </span>
          </span>
        `).join("")}
      </div>
    `;

    const heroCollage = pageHero.querySelector(".hero-collage");
    if (heroCollage) {
      pageHero.insertBefore(nav, heroCollage);
    } else {
      titleCard.insertAdjacentElement("afterend", nav);
    }

    const tabs = Array.from(nav.querySelectorAll(".module-subsection-button"));
    const tabList = nav.querySelector("[role='tablist']");
    const findSectionForHash = () => {
      const hashId = decodeURIComponent(window.location.hash.slice(1));
      if (!hashId) return null;
      return sections.find((section) => section.id === hashId || section.panelIds.includes(hashId)) || null;
    };
    let selectedSubSection = findSectionForHash()?.id || sections[0].id;

    sections.forEach((section) => {
      section.panels.forEach((panel) => {
        const currentLabel = panel.getAttribute("aria-labelledby");
        panel.classList.add("module-subsection-panel");
        panel.setAttribute("aria-labelledby", currentLabel ? `${currentLabel} subsection-tab-${section.id}` : `subsection-tab-${section.id}`);
        panel.setAttribute("role", "tabpanel");
      });
    });

    const setActive = (sectionId) => {
      if (!sectionId || !sections.some((section) => section.id === sectionId)) return;
      selectedSubSection = sectionId;

      tabs.forEach((tab) => {
        const isActive = tab.dataset.sectionTarget === selectedSubSection;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      sections.forEach((section) => {
        const isActive = section.id === selectedSubSection;
        section.panels.forEach((panel) => {
          panel.hidden = !isActive;
          panel.classList.toggle("is-active", isActive);
          panel.setAttribute("aria-hidden", isActive ? "false" : "true");
        });
      });

      window.dispatchEvent(new Event("resize"));
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setActive(tab.dataset.sectionTarget);

        if (tab.dataset.sectionTarget === "development-timeline") {
          const timeline = document.getElementById("development-timeline");
          if (!timeline) return;

          if (window.history?.replaceState) {
            window.history.replaceState(null, "", "#development-timeline");
          }

          timeline.scrollIntoView({
            block: "start",
            behavior: supportsMotion ? "smooth" : "auto"
          });
        }
      });
    });

    tabList?.addEventListener("keydown", (event) => {
      const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true"));
      const keyMap = {
        ArrowRight: 1,
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowUp: -1
      };

      if (event.key === "Home" || event.key === "End" || keyMap[event.key]) {
        event.preventDefault();
      } else {
        return;
      }

      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (activeIndex + keyMap[event.key] + tabs.length) % tabs.length;

      const nextTab = tabs[nextIndex];
      nextTab.focus();
      setActive(nextTab.dataset.sectionTarget);
    });

    setActive(selectedSubSection);
  };

  const initAiToolsSummary = () => {
    const aiToolContent = {
      chatgpt: {
        title: "ChatGPT",
        text: "I used ChatGPT to structure early ideas, summarize the UI logic, organize the front-end framework, and turn rough design thoughts into clearer prompts and implementation instructions."
      },
      gemini: {
        title: "Gemini",
        text: "I used Gemini to analyze the interaction style and visual direction I wanted, including layout mood, motion feeling, aesthetic references, and possible code approaches for achieving similar effects."
      },
      pinterest: {
        title: "Pinterest",
        text: "I used Pinterest to collect visual references for different UI styles, sports app layouts, color moods, and interaction inspiration. Selected reference images were then passed to Gemini for further analysis of visual direction and design patterns."
      },
      uiverse: {
        title: "Uiverse",
        text: "I used Uiverse to explore already implemented UI component examples, such as buttons, cards, hover effects, and icon-based interactions. Some component ideas were rewritten into my own code, while others were reused as visual references in Figma."
      },
      figma: {
        title: "Figma",
        text: "I used Figma during the prototyping stage to organize interface ideas, explore low-fidelity layouts, and convert references and generated suggestions into clearer visual structures."
      },
      studio: {
        title: "Google AI Studio",
        text: "I used Google AI Studio to generate early front-end UI prototypes from my design direction and documents. This helped me quickly test the basic layout, visual style, and page structure before deeper coding."
      },
      codex: {
        title: "Codex",
        text: "I used Codex inside VS Code to build and refine the code framework. It helped me improve page navigation, component structure, UI consistency, and the connection between the prototype and the actual front-end implementation."
      }
    };

    const sections = document.querySelectorAll(".ai-tools-section");
    sections.forEach((section) => {
      const icons = section.querySelectorAll(".ai-icon");
      const descriptionCard = section.querySelector("#aiDescription");
      const aiTitle = section.querySelector("#aiTitle");
      const aiText = section.querySelector("#aiText");

      if (!icons.length || !descriptionCard || !aiTitle || !aiText) return;

      icons.forEach((icon) => {
        icon.addEventListener("click", () => {
          const tool = icon.dataset.tool;
          const content = aiToolContent[tool];
          if (!content) return;

          icons.forEach((item) => item.classList.remove("active"));
          icon.classList.add("active");

          descriptionCard.classList.remove("show");

          setTimeout(() => {
            aiTitle.textContent = content.title;
            aiText.textContent = content.text;
            descriptionCard.classList.add("show");
          }, 180);
        });
      });
    });
  };

  const bindOverviewLaunch = () => {
    const launchButton = document.querySelector("[data-overview-target]");
    if (!launchButton || launchButton.dataset.overviewLaunchBound === "true") return;

    launchButton.dataset.overviewLaunchBound = "true";
    launchButton.addEventListener("click", () => {
      if (launchButton.dataset.overviewLaunching === "true") return;

      const targetHref = launchButton.dataset.overviewTarget || "modules.html";
      const delay = supportsMotion ? 120 : 0;

      launchButton.dataset.overviewLaunching = "true";
      launchButton.setAttribute("aria-busy", "true");
      launchButton.disabled = true;
      document.body.classList.add("is-overview-launching");

      window.setTimeout(() => {
        try {
          window.location.assign(targetHref);
        } catch {
          window.location.href = targetHref;
        }
      }, delay);
    });
  };

  const init = () => {
    initSiteScaleWrapper();
    root.classList.add("ux-ready");
    finishHomeModuleReveal();
    setCurrentNavigation();
    initReveal();
    bindCopyFeedback();
    bindHomeModuleTransition();
    initModuleSubSections();
    initEvidenceCarousels();
    initTestingEvidenceGalleries();
    initVibeProcessTimeline();
    initAiToolsSummary();
    bindOverviewLaunch();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());

document.addEventListener("DOMContentLoaded", () => {
  const timeline = document.querySelector("#holdlightTimeline");

  if (!timeline) {
    return;
  }

  const milestones = timeline.querySelectorAll(".milestone");

  milestones.forEach((item) => {
    const button = item.querySelector(".milestone-dot");

    if (!button) {
      return;
    }

    button.addEventListener("click", () => {
      milestones.forEach((milestone) => milestone.classList.remove("is-active"));
      item.classList.add("is-active");
    });

    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        button.click();
      }
    });
  });
});

