document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const closeMobileMenuButton = document.getElementById('close-mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const networkInformation =
        navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const enableDynamicNavigation = Boolean(
        contentArea && contentArea.hasAttribute('data-dynamic-navigation'),
    );

    if (enableDynamicNavigation && 'scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    const shouldReduceMotion = () => {
        if (prefersReducedMotion.matches) {
            return true;
        }
        if (networkInformation) {
            if (networkInformation.saveData) {
                return true;
            }
            const effectiveType = networkInformation.effectiveType || '';
            if (/^(slow-2g|2g)$/i.test(effectiveType)) {
                return true;
            }
        }
        return false;
    };

    const shouldUseLightweightMode = () => {
        if (shouldReduceMotion()) {
            return true;
        }
        if (networkInformation) {
            const effectiveType = networkInformation.effectiveType || '';
            if (/^(slow-2g|2g|3g)$/i.test(effectiveType)) {
                return true;
            }
        }
        return window.innerWidth < 768;
    };

    let reduceMotionActive = shouldReduceMotion();
    let lightweightModeActive = shouldUseLightweightMode();

    const isReduceMotion = () => reduceMotionActive;
    const isLightweightMode = () => lightweightModeActive;
    const magnetizedElements = new Map();
    const colorProperties = ['--scene-color-1', '--scene-color-2', '--scene-color-3'];
    const parallaxPalettes = [
        [
            [37, 99, 235],
            [12, 74, 110],
            [96, 165, 250],
        ],
        [
            [30, 64, 175],
            [17, 94, 120],
            [80, 130, 214],
        ],
        [
            [24, 78, 174],
            [20, 83, 136],
            [125, 211, 252],
        ],
    ];
    let currentSceneColors = parallaxPalettes[0].map((color) => [...color]);
    let sceneAnimationFrame = null;
    let ambientPointerCleanup = null;
    let parallaxCleanup = null;

    if (mobileMenuOverlay && !mobileMenuOverlay.dataset.menuState) {
        mobileMenuOverlay.dataset.menuState = 'closed';
    }

    if (document.body) {
        document.body.style.setProperty('--pointer-x', '50%');
        document.body.style.setProperty('--pointer-y', '50%');
    }

    function applyMagneticHover(element, { intensity = 10 } = {}) {
        if (!element || magnetizedElements.has(element) || isLightweightMode() || isReduceMotion()) {
            return;
        }

        let rafId = null;

        const resetPosition = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            element.style.setProperty('--magnet-x', '0px');
            element.style.setProperty('--magnet-y', '0px');
            element.style.setProperty('--magnet-tilt-x', '0deg');
            element.style.setProperty('--magnet-tilt-y', '0deg');
            element.style.setProperty('--magnet-light', '0');
            element.classList.remove('is-magnet-active');
        };

        const handlePointerMove = (event) => {
            if (isReduceMotion() || isLightweightMode() || event.pointerType === 'touch') {
                return;
            }

            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return;
            }

            const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
            const relativeY = (event.clientY - rect.top) / rect.height - 0.5;

            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                element.style.setProperty('--magnet-x', `${(relativeX * intensity).toFixed(2)}px`);
                element.style.setProperty('--magnet-y', `${(relativeY * intensity).toFixed(2)}px`);
                const tiltIntensity = Math.min(Math.max(intensity / 6, 0.75), 3.2);
                const tiltX = (relativeX * 10 * tiltIntensity).toFixed(2);
                const tiltY = (relativeY * -10 * tiltIntensity).toFixed(2);
                const glow = Math.min(Math.hypot(relativeX, relativeY) * 2.4, 1);
                element.style.setProperty('--magnet-tilt-x', `${tiltX}deg`);
                element.style.setProperty('--magnet-tilt-y', `${tiltY}deg`);
                element.style.setProperty('--magnet-light', glow.toFixed(3));
                element.classList.add('is-magnet-active');
                rafId = null;
            });
        };

        const handlePointerLeave = () => {
            resetPosition();
        };

        element.addEventListener('pointermove', handlePointerMove);
        element.addEventListener('pointerleave', handlePointerLeave);
        element.addEventListener('pointerup', handlePointerLeave);
        element.addEventListener('blur', handlePointerLeave);

        element.classList.add('magnetic-hover');

        magnetizedElements.set(element, {
            handlePointerMove,
            handlePointerLeave,
            resetPosition,
        });
    }

    function clearMagneticHover() {
        magnetizedElements.forEach(({ handlePointerMove, handlePointerLeave, resetPosition }, element) => {
            element.removeEventListener('pointermove', handlePointerMove);
            element.removeEventListener('pointerleave', handlePointerLeave);
            element.removeEventListener('pointerup', handlePointerLeave);
            element.removeEventListener('blur', handlePointerLeave);
            resetPosition();
        });
        magnetizedElements.clear();
    }

    function ensureParallaxCanvas() {
        if (!document.body) {
            return null;
        }

        let canvas = document.querySelector('.parallax-canvas');
        if (!canvas) {
            canvas = document.createElement('div');
            canvas.className = 'parallax-canvas';
            const baseLayer = document.createElement('div');
            baseLayer.className = 'parallax-layer parallax-layer--base';
            const accentLayer = document.createElement('div');
            accentLayer.className = 'parallax-layer parallax-layer--accent';
            const sparkLayer = document.createElement('div');
            sparkLayer.className = 'parallax-layer parallax-layer--spark';
            canvas.append(baseLayer, accentLayer, sparkLayer);
            document.body.insertBefore(canvas, document.body.firstChild || null);
        } else if (!canvas.querySelector('.parallax-layer')) {
            const baseLayer = document.createElement('div');
            baseLayer.className = 'parallax-layer parallax-layer--base';
            const accentLayer = document.createElement('div');
            accentLayer.className = 'parallax-layer parallax-layer--accent';
            const sparkLayer = document.createElement('div');
            sparkLayer.className = 'parallax-layer parallax-layer--spark';
            canvas.append(baseLayer, accentLayer, sparkLayer);
        }

        return canvas;
    }

    function setSceneColorStyles(colors) {
        if (!document.body || !Array.isArray(colors)) {
            return;
        }

        colors.slice(0, colorProperties.length).forEach((color, index) => {
            const value = Array.isArray(color) ? color.join(', ') : color;
            document.body.style.setProperty(colorProperties[index], value);
        });
    }

    function colorsAreEqual(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            return false;
        }

        return a.every((color, index) => {
            const other = b[index];
            if (!Array.isArray(color) || !Array.isArray(other) || color.length !== other.length) {
                return false;
            }
            return color.every((channel, channelIndex) => channel === other[channelIndex]);
        });
    }

    function animateSceneColors(nextColors) {
        if (!document.body || !Array.isArray(nextColors) || !nextColors.length) {
            return;
        }

        const normalized = nextColors.map((color) => color.map((channel) => Math.round(channel)));
        if (colorsAreEqual(currentSceneColors, normalized)) {
            return;
        }

        const startColors = currentSceneColors.map((color) => [...color]);
        const endColors = normalized.map((color) => [...color]);
        const duration = 680;
        const startTime = performance.now();

        if (sceneAnimationFrame) {
            cancelAnimationFrame(sceneAnimationFrame);
            sceneAnimationFrame = null;
        }

        const step = (now) => {
            const rawProgress = Math.min((now - startTime) / duration, 1);
            const eased = rawProgress < 0.5 ? 2 * rawProgress * rawProgress : -1 + (4 - 2 * rawProgress) * rawProgress;
            const blended = startColors.map((color, index) =>
                color.map((channel, channelIndex) =>
                    Math.round(channel + (endColors[index][channelIndex] - channel) * eased),
                ),
            );

            setSceneColorStyles(blended);

            if (rawProgress < 1) {
                sceneAnimationFrame = requestAnimationFrame(step);
            } else {
                currentSceneColors = endColors.map((color) => [...color]);
                sceneAnimationFrame = null;
            }
        };

        sceneAnimationFrame = requestAnimationFrame(step);
    }

    function collectSceneElements(root) {
        const container = root && root.nodeType === 1 ? root : contentArea;
        if (!container) {
            return [];
        }

        const candidates = new Set();
        candidates.add(container);

        Array.from(container.children).forEach((child) => {
            if (child && child.nodeType === 1 && !child.matches('script, style')) {
                candidates.add(child);
            }
        });

        container
            .querySelectorAll(
                '[data-parallax-scene], section, article, .event-display-container, .grid, .partners-grid, .shadow-lg',
            )
            .forEach((element) => {
                if (!element.closest('nav, footer')) {
                    candidates.add(element);
                }
            });

        const filtered = Array.from(candidates).filter((element) => {
            if (!element || element.closest('nav, footer') || element.dataset.disableParallax === 'true') {
                return false;
            }
            if (element === container) {
                return true;
            }
            const height = element.offsetHeight || 0;
            if (height > 80) {
                return true;
            }
            return Boolean(element.querySelector('h2, h3, .shadow-lg, .project-card, .event-description'));
        });

        if (!filtered.length) {
            filtered.push(container);
        }

        return filtered.slice(0, 9);
    }

    function initializeParallaxBackdrop(scope = contentArea) {
        if (parallaxCleanup) {
            parallaxCleanup();
            parallaxCleanup = null;
        }

        if (!document.body || isLightweightMode() || isReduceMotion()) {
            return;
        }

        const root = scope && scope.nodeType === 1 ? scope : contentArea;
        if (!root) {
            return;
        }

        const scenes = collectSceneElements(root);
        if (!scenes.length) {
            return;
        }

        const canvas = ensureParallaxCanvas();
        if (!canvas) {
            return;
        }

        canvas.classList.add('is-active');

        const observer = new IntersectionObserver(
            (entries) => {
                let dominantEntry = null;
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }
                    if (!dominantEntry || entry.intersectionRatio > dominantEntry.intersectionRatio) {
                        dominantEntry = entry;
                    }
                });

                if (!dominantEntry) {
                    return;
                }

                const target = dominantEntry.target;
                const paletteIndex = Number(target.dataset.scenePaletteIndex || 0);
                const palette = parallaxPalettes[paletteIndex % parallaxPalettes.length];
                if (!palette) {
                    return;
                }

                animateSceneColors(palette);

                const position = scenes.indexOf(target);
                const progress = scenes.length > 1 && position >= 0 ? position / (scenes.length - 1) : 0;
                document.body.style.setProperty('--scene-progress', progress.toFixed(3));
            },
            {
                threshold: [0.2, 0.55],
                rootMargin: '-18% 0px -32%',
            },
        );

        scenes.forEach((element, index) => {
            const paletteIndex = index % parallaxPalettes.length;
            element.dataset.scenePaletteIndex = String(paletteIndex);
            observer.observe(element);
        });

        const initialPaletteIndex = Number(scenes[0]?.dataset.scenePaletteIndex || 0);
        const initialPalette = parallaxPalettes[initialPaletteIndex % parallaxPalettes.length];
        if (initialPalette) {
            currentSceneColors = initialPalette.map((color) => [...color]);
            setSceneColorStyles(currentSceneColors);
            document.body.style.setProperty('--scene-progress', '0');
        }

        let scrollRaf = null;

        const updateScrollDepth = () => {
            const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
            const depth = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
            document.body.style.setProperty('--scroll-depth', depth.toFixed(4));
            scrollRaf = null;
        };

        const handleScroll = () => {
            if (scrollRaf) {
                return;
            }
            scrollRaf = requestAnimationFrame(updateScrollDepth);
        };

        updateScrollDepth();
        window.addEventListener('scroll', handleScroll, { passive: true });

        parallaxCleanup = () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollRaf) {
                cancelAnimationFrame(scrollRaf);
                scrollRaf = null;
            }
            observer.disconnect();
            scenes.forEach((element) => {
                delete element.dataset.scenePaletteIndex;
            });
            if (sceneAnimationFrame) {
                cancelAnimationFrame(sceneAnimationFrame);
                sceneAnimationFrame = null;
            }
            canvas.classList.remove('is-active');
            document.body.style.setProperty('--scroll-depth', '0');
            document.body.style.setProperty('--scene-progress', '0');
        };
    }

    function initializeNavigationAnimations(root = document) {
        const targetRoot = root === document || root === document.body ? document : root;
        const navLinks = targetRoot.querySelectorAll('.navbar-link');

        navLinks.forEach((link, index) => {
            if (!isReduceMotion() && !isLightweightMode()) {
                link.style.setProperty('--nav-anim-delay', `${index * 90}ms`);
                applyMagneticHover(link, { intensity: 9 });
            } else {
                link.style.removeProperty('--nav-anim-delay');
            }
        });

        const overlayLinks = document.querySelectorAll('#mobile-menu-overlay .page-link');
        overlayLinks.forEach((link, index) => {
            if (!isReduceMotion() && !isLightweightMode()) {
                link.style.setProperty('--nav-anim-delay', `${index * 70}ms`);
                applyMagneticHover(link, { intensity: 7 });
            } else {
                link.style.removeProperty('--nav-anim-delay');
            }
        });
    }

    function initializeContentDecorations(root) {
        const target = root && root.nodeType === 1 ? root : contentArea;
        if (!target) {
            return;
        }

        if (!isReduceMotion() && !isLightweightMode()) {
            target.querySelectorAll('.glow-button').forEach((button) => {
                applyMagneticHover(button, { intensity: 10 });
            });
            target.querySelectorAll('.slider-nav button').forEach((button) => {
                applyMagneticHover(button, { intensity: 8 });
            });
            target.querySelectorAll('.social-links-container a').forEach((link) => {
                applyMagneticHover(link, { intensity: 6 });
            });
        }

        target.querySelectorAll('.shadow-lg').forEach((card, index) => {
            card.style.setProperty('--card-anim-delay', `${(index % 6) * 120}ms`);
        });
    }

    function initializeInteractiveDecorations(scope = document) {
        if (isLightweightMode() || isReduceMotion()) {
            clearMagneticHover();
        }

        if (scope === document || scope === document.body || scope === window) {
            initializeNavigationAnimations(document);
            initializeContentDecorations(contentArea);
            initializeParallaxBackdrop(contentArea);
        } else {
            initializeContentDecorations(scope);
            initializeParallaxBackdrop(scope);
        }
    }

    function initializeAmbientPointer() {
        if (!document.body || ambientPointerCleanup || isReduceMotion() || isLightweightMode()) {
            return;
        }

        let rafId = null;

        const resetPointer = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            document.body.style.setProperty('--pointer-x', '50%');
            document.body.style.setProperty('--pointer-y', '50%');
            document.body.classList.remove('pointer-active');
        };

        const handlePointerMove = (event) => {
            if (isReduceMotion() || isLightweightMode() || event.pointerType === 'touch') {
                return;
            }

            const ratioX = event.clientX / window.innerWidth;
            const ratioY = event.clientY / window.innerHeight;

            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                document.body.style.setProperty('--pointer-x', `${(ratioX * 100).toFixed(2)}%`);
                document.body.style.setProperty('--pointer-y', `${(ratioY * 100).toFixed(2)}%`);
                document.body.classList.add('pointer-active');
                rafId = null;
            });
        };

        const handlePointerLeave = () => {
            resetPointer();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                resetPointer();
            }
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerleave', handlePointerLeave);
        window.addEventListener('blur', handlePointerLeave);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        ambientPointerCleanup = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerleave', handlePointerLeave);
            window.removeEventListener('blur', handlePointerLeave);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            resetPointer();
            ambientPointerCleanup = null;
        };
    }

    function openMobileMenu() {
        if (!mobileMenuOverlay || mobileMenuOverlay.dataset.menuState === 'open') {
            return;
        }

        mobileMenuOverlay.dataset.menuState = 'open';
        mobileMenuOverlay.classList.remove('hidden', 'is-closing');
        mobileMenuOverlay.classList.add('flex');
        void mobileMenuOverlay.offsetWidth; // force reflow for animation restart
        mobileMenuOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        initializeNavigationAnimations(document);
        document.querySelectorAll('#mobile-menu-overlay .page-link').forEach((link) => {
            link.style.animation = 'none';
            void link.offsetWidth;
            link.style.animation = '';
        });
    }

    function closeMobileMenu({ immediate = false } = {}) {
        if (!mobileMenuOverlay) {
            return;
        }

        const finalize = () => {
            mobileMenuOverlay.classList.remove('flex', 'is-open', 'is-closing');
            mobileMenuOverlay.classList.add('hidden');
            mobileMenuOverlay.dataset.menuState = 'closed';
        };

        if (immediate || isReduceMotion() || mobileMenuOverlay.dataset.menuState !== 'open') {
            finalize();
        } else {
            mobileMenuOverlay.dataset.menuState = 'closing';
            mobileMenuOverlay.classList.remove('is-open');
            mobileMenuOverlay.classList.add('is-closing');
            mobileMenuOverlay.addEventListener(
                'animationend',
                () => {
                    finalize();
                },
                { once: true },
            );
        }

        document.body.style.overflow = '';
    }

    function initializeFormHandler() {
        const form = document.querySelector("form[action^='https://formspree.io/f/']");
        if (!form || form.dataset.neuronautsBound === 'true') return;

        form.dataset.neuronautsBound = 'true';

        function prepareStatusElement() {
            let statusEl = form.querySelector('[data-form-status]');
            if (!statusEl) {
                statusEl = document.createElement('p');
                statusEl.classList.add('mt-2', 'text-sm');
                statusEl.dataset.formStatus = 'true';
                form.appendChild(statusEl);
            }

            statusEl.textContent = '';
            statusEl.classList.remove('text-green-400', 'text-red-400', 'text-yellow-400');

            return statusEl;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const statusEl = prepareStatusElement();
            const data = new FormData(form);

            try {
                const response = await fetch(form.action, {
                    method: form.method,
                    body: data,
                    headers: { Accept: 'application/json' },
                });

                if (response.ok) {
                    statusEl.textContent = '✅ Mesajınız başarıyla gönderildi!';
                    statusEl.classList.add('text-green-400');
                    form.reset();
                } else {
                    statusEl.textContent = '❌ Bir hata oluştu. Tekrar deneyin.';
                    statusEl.classList.add('text-red-400');
                }
            } catch (error) {
                statusEl.textContent = '⚠️ Sunucuya ulaşılamadı.';
                statusEl.classList.add('text-yellow-400');
            }
        });
    }

    function applyTypingEffect(elementId, textToType, speed = 50) {
        const textElement = document.getElementById(elementId);
        if (!textElement) return;

        textElement.innerHTML = '';

        let charIndex = 0;
        const cursorSpan = document.createElement('span');
        cursorSpan.classList.add('typing-cursor');
        textElement.appendChild(cursorSpan);

        function typeWriter() {
            if (charIndex < textToType.length) {
                const charNode = document.createTextNode(textToType.charAt(charIndex));
                textElement.insertBefore(charNode, cursorSpan);
                charIndex += 1;
                setTimeout(typeWriter, speed);
            }
        }

        typeWriter();
    }

    function replaceContent(target, sourceElement) {
        if (!target || !sourceElement) return false;

        const fragment = document.createDocumentFragment();
        while (sourceElement.firstChild) {
            fragment.appendChild(sourceElement.firstChild);
        }

        target.replaceChildren(fragment);
        return true;
    }

    function normalizePath(url) {
        try {
            return new URL(url, window.location.origin).pathname;
        } catch (error) {
            return url;
        }
    }

    function initializeEventSlider() {
        const slider = document.getElementById('event-slider');
        const prevButton = document.getElementById('prev-event');
        const nextButton = document.getElementById('next-event');
        const eventDescriptionArea = document.getElementById('event-description');

        if (!slider || !prevButton || !nextButton || !eventDescriptionArea) {
            return;
        }

        const slides = Array.from(slider.children);
        let currentIndex = 0;
        let sliderTrailTimeout = null;

        slider.style.setProperty('--slider-direction', '1');

        const eventDetails = [
            {
                title: 'Ataköy Gençlik Merkezindeyiz',
                description:
                    "Ataköy Gençlik Merkezi'nde, üniversiteye yeni başlayan gençlere yönelik bir yapay zeka dersi verdik ve takımımızı tanıttık. Bu etkinlik sayesinde yapay zekanın sunduğu fırsatları gençlere aktarma şansı bulduk.",
            },
            {
                title: 'YTÜ Savunma Sanayi Zirvesindeyiz',
                description:
                    'Yıldız Teknik Üniversitesi Savunma Sanayi Zirvesi\'ne katılarak sektördeki son gelişmeleri yakından takip ettik. Bu zirve, gelecekteki projelerimiz için bize önemli bir vizyon kazandırdı.',
            },
            {
                title: 'Bilişim Vadisi Etkinliğindeyiz',
                description:
                    'Bilişim Vadisi\'nde düzenlenen etkinliğe katılarak teknoloji ve inovasyon dünyasının önde gelen isimleriyle bir araya geldik. Yeni fikirler ve potansiyel iş birlikleri için harika bir platform oldu.',
            },
            {
                title: 'İstinye Üniversitesi DatamedX Etkinliğindeyiz',
                description:
                    'İstinye Üniversitesi\'nin DatamedX etkinliğine katıldık ve burada birincilik elde etmenin gururunu yaşadık. Bu başarı, medikal alanda yapay zeka çözümlerine olan hakimiyetimizi bir kez daha kanıtladı.',
            },
            {
                title: 'Geleceğimiz Türkiye Etkinliğindeyiz',
                description:
                    'Geleceğimiz Türkiye etkinliğinde, teknoloji ve geleceğe dair vizyonumuzu paylaştık. Bu etkinlik, toplumun farklı kesimleriyle etkileşim kurarak farkındalık yaratmamız için önemli bir fırsattı.',
            },
            {
                title: 'İstanbul Teknik Üniversitesindeyiz',
                description:
                    'İstanbul Teknik Üniversitesi\'nde düzenlenen derslere katılarak üniversite öğrencileriyle bir araya geldik. Bu deneyim, akademik bilgi ve pratik tecrübeyi birleştirerek öğrenci arkadaşlara ilham vermemizi sağladı.',
            },
            {
                title: 'İTÜ Mostra Hackathonundayız',
                description:
                    'İTÜ Mostra Hackathonu\'na katıldık ve jüri özel ödülü kazanarak yeteneklerimizi gösterdik. Bu ödül, inovatif yaklaşımımızın ve ekip çalışmamızın bir göstergesi oldu.',
            },
            {
                title: 'Dr. Sadi Konuk Eğitim ve Araştırma Hastanesindeyiz',
                description:
                    'Mentörümüzle Dr. Sadi Konuk Eğitim ve Araştırma Hastanesi\'nde buluşarak projelerimiz hakkında geri bildirimler aldık. Bu buluşma, sağlık teknolojileri alanındaki çalışmalarımızı daha da ileriye taşımamız için yol gösterici oldu.',
            },
            {
                title: 'Neuronauts Yapay Zeka Söyleşisi',
                description:
                    'Neuronauts olarak bir yapay zeka söyleşisi düzenleyerek bilgi birikimimizi paylaştık. Katılımcılarla interaktif bir ortamda yapay zekanın geleceğini tartıştık.',
            },
        ];

        function animateSliderTrail(direction = 0) {
            if (isReduceMotion() || isLightweightMode()) {
                return;
            }

            if (direction === 0) {
                slider.classList.remove('is-sliding', 'is-sliding-forward', 'is-sliding-backward');
                return;
            }

            const directionClass = direction > 0 ? 'is-sliding-forward' : 'is-sliding-backward';
            slider.style.setProperty('--slider-direction', direction > 0 ? '1' : '-1');
            slider.classList.remove('is-sliding', 'is-sliding-forward', 'is-sliding-backward');
            void slider.offsetWidth;
            slider.classList.add('is-sliding', directionClass);

            if (sliderTrailTimeout) {
                clearTimeout(sliderTrailTimeout);
            }

            sliderTrailTimeout = window.setTimeout(() => {
                slider.classList.remove('is-sliding', 'is-sliding-forward', 'is-sliding-backward');
                sliderTrailTimeout = null;
            }, 720);
        }

        function updateSlider(direction = 0) {
            const offset = -currentIndex * 100;
            slider.style.transform = `translateX(${offset}%)`;
            animateSliderTrail(direction);
            updateEventDescription();
        }

        function updateEventDescription() {
            const currentEvent = eventDetails[currentIndex];

            eventDescriptionArea.classList.add('is-fading-out-text');

            setTimeout(() => {
                eventDescriptionArea.innerHTML = `
                    <h2>${currentEvent.title}</h2>
                    <p>${currentEvent.description}</p>
                `;
                eventDescriptionArea.classList.remove('is-fading-out-text');
                eventDescriptionArea.classList.add('is-fading-in-text');

                eventDescriptionArea.addEventListener(
                    'animationend',
                    () => {
                        eventDescriptionArea.classList.remove('is-fading-in-text');
                    },
                    { once: true },
                );
            }, 300);
        }

        function handlePrevClick() {
            currentIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1;
            updateSlider(-1);
        }

        function handleNextClick() {
            currentIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
            updateSlider(1);
        }

        function addUniqueEventListener(element, handler) {
            if (!element) return;

            const handlerKey = '_neuronautsHandler';
            if (element[handlerKey]) {
                element.removeEventListener('click', element[handlerKey]);
            }

            element.addEventListener('click', handler);
            element[handlerKey] = handler;
        }

        addUniqueEventListener(prevButton, handlePrevClick);
        addUniqueEventListener(nextButton, handleNextClick);

        updateSlider(0);
    }

    let scrollObserver = null;

    function ensureScrollObserver() {
        if (scrollObserver) {
            return scrollObserver;
        }

        scrollObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const element = entry.target;
                    if (entry.isIntersecting) {
                        element.classList.add('is-visible');
                        if (element.dataset.animateOnce !== 'false') {
                            scrollObserver.unobserve(element);
                        }
                    } else if (element.dataset.animateOnce === 'false') {
                        element.classList.remove('is-visible');
                    }
                });
            },
            {
                threshold: 0.18,
                rootMargin: '0px 0px -8% 0px',
            },
        );

        return scrollObserver;
    }

    function primeScrollAnimation(element) {
        if (!element || element.dataset.scrollAnimateReady === 'true') {
            return;
        }

        const effect = element.dataset.animate || 'fade-up';
        element.classList.add('scroll-animate', `scroll-animate--${effect}`);

        const delay = element.dataset.animateDelay || element.style.getPropertyValue('--scroll-animate-delay');
        if (delay) {
            element.style.setProperty('--scroll-animate-delay', delay);
        }

        element.dataset.scrollAnimateReady = 'true';

        if (!isReduceMotion()) {
            ensureScrollObserver().observe(element);
        } else {
            element.classList.add('is-visible');
        }
    }

    function setSequentialDelays(elements, step = 80) {
        elements.forEach((el, index) => {
            if (el.dataset.animateDelay || el.style.getPropertyValue('--scroll-animate-delay')) {
                return;
            }
            el.dataset.animateDelay = `${Math.min(index * step, 600)}ms`;
        });
    }

    function initializeScrollAnimations(scope = contentArea) {
        const context =
            scope && scope.id === 'content-area'
                ? scope
                : scope
                ? scope.querySelector('#content-area')
                : null;
        const targetRoot = context || contentArea;

        if (!targetRoot) {
            return;
        }

        const candidates = new Set();

        targetRoot.querySelectorAll('[data-animate]').forEach((el) => candidates.add(el));

        targetRoot.querySelectorAll('.grid').forEach((grid) => {
            if (grid.dataset.disableAutoAnimate === 'true') {
                return;
            }

            const children = Array.from(grid.children).filter(
                (child) => child.nodeType === 1 && child.dataset.disableAutoAnimate !== 'true',
            );

            children.forEach((child, index) => {
                candidates.add(child);
                if (!child.dataset.animate) {
                    if (grid.dataset.childAnimate) {
                        child.dataset.animate = grid.dataset.childAnimate;
                    } else {
                        child.dataset.animate = index % 2 === 0 ? 'slide-curve' : 'rotate-in';
                    }
                }
                if (!child.dataset.animateDelay && !child.style.getPropertyValue('--scroll-animate-delay')) {
                    child.dataset.animateDelay = `${Math.min(index * 80, 480)}ms`;
                }
            });
        });

        targetRoot
            .querySelectorAll(
                '.shadow-lg, .rounded-xl, .video-container, .iframe-container, .slider-container, .event-description, .map-container',
            )
            .forEach((element) => {
                if (element.closest('nav, footer') || element.dataset.disableAutoAnimate === 'true') {
                    return;
                }
                candidates.add(element);
                if (!element.dataset.animate) {
                    if (element.matches('.video-container, .iframe-container, .slider-container, .map-container, img, video')) {
                        element.dataset.animate = 'zoom-in';
                    } else if (element.matches('.event-description')) {
                        element.dataset.animate = 'slide-curve';
                    } else {
                        element.dataset.animate = 'drift-up';
                    }
                }
            });

        targetRoot.querySelectorAll('img, video').forEach((media) => {
            if (media.closest('nav, footer') || media.dataset.disableAutoAnimate === 'true') {
                return;
            }
            candidates.add(media);
            if (!media.dataset.animate) {
                media.dataset.animate = 'zoom-in';
            }
        });

        targetRoot
            .querySelectorAll('h1, h2, h3, h4, p, li, blockquote')
            .forEach((element) => {
                if (
                    element.closest('nav, footer') ||
                    element.closest('.grid, .shadow-lg, .video-container, .iframe-container, .map-container') ||
                    element.dataset.disableAutoAnimate === 'true'
                ) {
                    return;
                }
                candidates.add(element);
                if (!element.dataset.animate) {
                    if (element.matches('h1, h2')) {
                        element.dataset.animate = 'slide-curve';
                    } else if (element.matches('h3, h4')) {
                        element.dataset.animate = 'rotate-in';
                    } else if (element.matches('blockquote')) {
                        element.dataset.animate = 'drift-up';
                    } else {
                        element.dataset.animate = 'fade-up';
                    }
                }
            });

        const orderedCandidates = Array.from(candidates);
        setSequentialDelays(orderedCandidates, 70);

        if (isReduceMotion() && scrollObserver) {
            scrollObserver.disconnect();
        }

        orderedCandidates.forEach((element) => {
            primeScrollAnimation(element);
        });
    }

    function setupVideoAutoplay({ scope = document } = {}) {
        const root = scope instanceof Element ? scope : document;
        const video = root.querySelector('[data-video-autoplay]');

        if (!video) {
            return;
        }

        if (typeof video._autoplayCleanup === 'function') {
            video._autoplayCleanup();
        }

        if (video.dataset.autoplayManaged === 'true') {
            return;
        }

        video.dataset.autoplayManaged = 'true';
        video.playsInline = true;

        if (!('IntersectionObserver' in window) || shouldReduceMotion()) {
            return;
        }

        const resetOnExit = video.dataset.resetOnExit !== 'false';

        const pauseVideo = (reset = false) => {
            if (!video.paused) {
                video.pause();
            }
            if (reset && resetOnExit) {
                video.currentTime = 0;
            }
        };

        const tryPlay = () => {
            if (!video.paused) {
                return;
            }
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    video.muted = true;
                    video.play().catch(() => {});
                });
            }
        };

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.target !== video) {
                        return;
                    }
                    if (entry.isIntersecting) {
                        tryPlay();
                    } else {
                        pauseVideo(true);
                    }
                });
            },
            {
                threshold: 0.6,
                rootMargin: '0px 0px -10%',
            },
        );

        observer.observe(video);

        const handleVisibilityChange = () => {
            if (document.hidden) {
                pauseVideo();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const handleVideoEnded = () => {
            if (resetOnExit) {
                video.currentTime = 0;
            }
        };

        video.addEventListener('ended', handleVideoEnded);

        let cleanupCalled = false;
        const handlePageHide = () => cleanup();

        const cleanup = () => {
            if (cleanupCalled) {
                return;
            }
            cleanupCalled = true;
            observer.disconnect();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            video.removeEventListener('ended', handleVideoEnded);
            window.removeEventListener('pagehide', handlePageHide);
            delete video.dataset.autoplayManaged;
            delete video._autoplayCleanup;
        };

        window.addEventListener('pagehide', handlePageHide, { once: true });

        video._autoplayCleanup = cleanup;
    }

    function applyInteractionMode({ scope = document, force = false } = {}) {
        const nextReduce = shouldReduceMotion();
        const nextLightweight = shouldUseLightweightMode();
        const reduceChanged = nextReduce !== reduceMotionActive;
        const lightweightChanged = nextLightweight !== lightweightModeActive;

        reduceMotionActive = nextReduce;
        lightweightModeActive = nextLightweight;

        if (reduceChanged || lightweightChanged || force) {
            if (isReduceMotion() || isLightweightMode()) {
                if (ambientPointerCleanup) {
                    ambientPointerCleanup();
                }
                if (parallaxCleanup) {
                    parallaxCleanup();
                    parallaxCleanup = null;
                }
                const canvas = document.querySelector('.parallax-canvas');
                if (canvas) {
                    canvas.classList.remove('is-active');
                }
                if (document.body) {
                    document.body.style.setProperty('--scroll-depth', '0');
                    document.body.style.setProperty('--scene-progress', '0');
                }
                clearMagneticHover();
                if (lightweightChanged) {
                    closeMobileMenu({ immediate: true });
                }
            }
        }

        initializeInteractiveDecorations(scope);
        initializeScrollAnimations(scope);
        setupVideoAutoplay({ scope });

        if (!isLightweightMode() && !isReduceMotion()) {
            initializeAmbientPointer();
        }
    }

    const pageBehaviors = [
        {
            matchers: [
                (path) => path === '/',
                (path) => path.includes('index.html'),
            ],
            typing: {
                id: 'typing-text',
                dynamicText: 'Yapay Zeka ile Geleceği Kodluyoruz',
            },
        },
        {
            matchers: [(path) => path.includes('about.html')],
            typing: {
                id: 'typing-text-about',
                dynamicText: 'Hakkımızda: Yapay Zeka Dünyasındaki Yolculuğumuz',
            },
        },
        {
            matchers: [(path) => path.includes('egitim-cozumleri.html')],
            typing: {
                id: 'typing-text-egitim',
                dynamicText: 'Eğitimde Yenilikçi Çözümler: Yapay Zeka Destekli Öğrenme Uygulaması',
            },
        },
        {
            matchers: [(path) => path.includes('beyin-mri-detay.html')],
            typing: {
                id: 'typing-text-beyin-mri',
                dynamicText: 'Beyin MRI Görüntülerine Göre Hastalık Tespiti ve Kişiselleştirilmiş Tedavi',
            },
        },
        {
            matchers: [(path) => path.includes('teknofest-detay.html')],
            typing: {
                id: 'typing-text-teknofest',
                dynamicText: 'Teknofest Yapay Zeka Projeleri',
            },
        },
        {
            matchers: [(path) => path.includes('teknofest-yarismalar-detay.html')],
            typing: {
                id: 'typing-text-teknofest-yarismalar',
                dynamicText: 'Teknofest Yarışma Detayları: Başarı Hikayemiz',
            },
        },
        {
            matchers: [(path) => path.includes('mersin-arge.html')],
            typing: {
                id: 'typing-text-teknofest-ideathon',
                dynamicText: 'Teknofest Travelx Ideathon: Rötar Süresi Tahmini',
                initialText: 'Kardiyomegali Tespiti: Mersin Ar-Ge Yarışması',
            },
        },
        {
            matchers: [(path) => path.includes('istinye-hackathon-detay.html')],
            typing: {
                id: 'typing-text-istinye-hackathon',
                dynamicText: 'İstinye Üniversitesi DataMedX: Metin Tabanlı Kanser Türü Tespiti',
            },
        },
        {
            matchers: [(path) => path.includes('itu-hackathon-detay.html')],
            typing: {
                id: 'typing-text-itu-hackathon',
                dynamicText: 'İTÜ Mostra Hackathon: Kişiselleştirilmiş Reklamcılık',
            },
        },
        {
            matchers: [(path) => path.includes('yemek-tarifi-detay.html')],
            typing: {
                id: 'typing-text-yemek-tarifi',
                dynamicText: 'Yapay Zeka Destekli Yemek Tarifi Projesi',
            },
        },
        {
            matchers: [(path) => path.includes('akciger-pnonomoni-detay.html')],
            typing: {
                id: 'typing-text-akciger-pnonomoni',
                dynamicText: 'Akciğer X-Ray Görüntülerine Göre Pnömoni Tespiti',
            },
        },
        {
            matchers: [(path) => path.includes('genetik-diyabet-detay.html')],
            typing: {
                id: 'typing-text-genetik-diyabet',
                dynamicText: 'Genetik Dizilimlere Göre Mutasyon Tespiti',
            },
        },
        {
            matchers: [(path) => path.includes('join-us.html')],
            typing: {
                id: 'typing-text-join-us',
                dynamicText: 'Bize Katılın: Geleceği Birlikte İnşa Edelim',
            },
        },
        {
            matchers: [(path) => path.includes('events.html')],
            init: initializeEventSlider,
        },
        {
            matchers: [(path) => path.includes('air-pollution-detay.html')],
            typing: {
                id: 'typing-text-air-pollution',
                dynamicText: 'Hava Kirliliği Tahmini Yarışması',
            },
        },
        {
            matchers: [(path) => path.includes('cmi-yarismasi-detay.html')],
            typing: {
                id: 'typing-text-cmi',
                dynamicText: 'Tekrarlayan Davranış Tespiti',
            },
        },
        {
            matchers: [(path) => path.includes('landslide-detay.html')],
            typing: {
                id: 'typing-text-landslide',
                dynamicText: 'Heyelan Tespiti Yarışması',
            },
        },
        {
            matchers: [(path) => path.includes('libribrain-detay.html')],
            typing: {
                id: 'typing-text-libribrain',
                dynamicText: 'Felçli Beyin Analizi',
            },
        },
        {
            matchers: [(path) => path.includes('epilepsi.html')],
            typing: {
                id: 'typing-text-epilepsi',
                dynamicText: 'Epilepsi Projemiz',
            },
        },
        {
            matchers: [(path) => path.includes('genetikprojesii.html')],
            typing: {
                id: 'typing-text-genetik',
                dynamicText: 'Genetik Projemiz',
            },
        },
        {
            matchers: [(path) => path.includes('ultrasonprojesi.html')],
            typing: {
                id: 'typing-text-ultrason',
                dynamicText: 'Ultrason projemiz',
            },
        },
        {
            matchers: [(path) => path.includes('rotar-detay.html')],
            typing: {
                id: 'typing-text-teknofest-ideathon',
                dynamicText: 'Rötar Süresi Tahmini Projemiz',
            },
        },
        {
            matchers: [(path) => path.includes('fire.html')],
            typing: {
                id: 'typing-text-yangin-tespiti',
                dynamicText: 'Yangın Tespiti Projemiz',
            },
        },
    ];

    function runPageBehaviors(url, context = 'dynamic') {
        const path = normalizePath(url);

        pageBehaviors.forEach(({ matchers, typing, init }) => {
            const matches = matchers.some((match) => {
                try {
                    return match(path);
                } catch (error) {
                    return false;
                }
            });

            if (!matches) return;

            if (typing) {
                const textToUse = context === 'initial' && typing.initialText ? typing.initialText : typing.dynamicText;
                applyTypingEffect(typing.id, textToUse);
            }

            if (typeof init === 'function') {
                init();
            }
        });
    }

    let pendingLoadTimeout = null;
    let currentAbortController = null;
    let activeLoadToken = 0;

    const loadContent = async (url) => {
        if (pendingLoadTimeout) {
            clearTimeout(pendingLoadTimeout);
            pendingLoadTimeout = null;
        }

        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }

        const abortController = new AbortController();
        currentAbortController = abortController;
        const loadToken = ++activeLoadToken;

        if (contentArea) {
            contentArea.classList.add('is-fading-out');
        }

        pendingLoadTimeout = setTimeout(async () => {
            pendingLoadTimeout = null;
            try {
                const response = await fetch(url, { signal: abortController.signal });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newContentElement = doc.getElementById('content-area');

                if (abortController.signal.aborted || loadToken !== activeLoadToken) {
                    return;
                }

                if (contentArea && newContentElement) {
                    replaceContent(contentArea, newContentElement);
                } else if (contentArea) {
                    console.warn('Could not find #content-area in the fetched HTML. Loading full body content.');
                    replaceContent(contentArea, doc.body);
                }

                if (contentArea) {
                    contentArea.classList.remove('is-fading-out');
                    contentArea.classList.add('is-fading-in');

                    contentArea.addEventListener(
                        'animationend',
                        () => {
                            contentArea.classList.remove('is-fading-in');
                        },
                        { once: true },
                    );
                }

                runPageBehaviors(url, 'dynamic');
                initializeFormHandler();
                applyInteractionMode({ scope: contentArea, force: true });
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }
                console.error('Error loading page content:', error);
                if (contentArea) {
                    contentArea.classList.remove('is-fading-out');
                }
            } finally {
                if (currentAbortController === abortController) {
                    currentAbortController = null;
                }
            }
        }, 300);
    };

    const resetScrollPosition = () => {
        if (typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    };

    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('.page-link');
        if (!link) {
            return;
        }

        if (!enableDynamicNavigation) {
            closeMobileMenu();
            return;
        }

        e.preventDefault();
        const targetUrl = link.href;

        closeMobileMenu();

        resetScrollPosition();

        history.pushState(null, '', targetUrl);
        loadContent(targetUrl);
    });

    if (enableDynamicNavigation) {
        window.addEventListener('popstate', () => {
            resetScrollPosition();
            loadContent(window.location.href);
        });
    }

    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            openMobileMenu();
        });
    }

    if (closeMobileMenuButton) {
        closeMobileMenuButton.addEventListener('click', () => {
            closeMobileMenu();
        });
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', (e) => {
            if (e.target === mobileMenuOverlay) {
                closeMobileMenu();
            }
        });
    }

    let resizeEvaluationTimeout = null;
    window.addEventListener('resize', () => {
        if (mobileMenuOverlay && window.innerWidth >= 768) {
            closeMobileMenu({ immediate: true });
        }

        if (resizeEvaluationTimeout) {
            clearTimeout(resizeEvaluationTimeout);
        }

        resizeEvaluationTimeout = window.setTimeout(() => {
            resizeEvaluationTimeout = null;
            applyInteractionMode();
        }, 220);
    });

    runPageBehaviors(window.location.href, 'initial');
    initializeFormHandler();
    applyInteractionMode({ force: true });

    const handlePreferenceChange = () => {
        applyInteractionMode({ force: true });
    };

    if (typeof prefersReducedMotion.addEventListener === 'function') {
        prefersReducedMotion.addEventListener('change', handlePreferenceChange);
    } else if (typeof prefersReducedMotion.addListener === 'function') {
        prefersReducedMotion.addListener(handlePreferenceChange);
    }

    if (networkInformation) {
        const networkChangeHandler = () => {
            applyInteractionMode();
        };

        if (typeof networkInformation.addEventListener === 'function') {
            networkInformation.addEventListener('change', networkChangeHandler);
        } else if (typeof networkInformation.addListener === 'function') {
            networkInformation.addListener(networkChangeHandler);
        }
    }
});
