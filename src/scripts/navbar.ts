export function bindSiteNav() {
	const BOUND_ATTRIBUTE = "data-site-nav-bound";

	document
		.querySelectorAll<HTMLElement>("[data-navbar-root]")
		.forEach((root) => {
			const dropdowns = Array.from(
				root.querySelectorAll<HTMLElement>("[data-nav-dropdown]"),
			);
			const mobileButton = root.querySelector<HTMLButtonElement>(
				"[data-nav-menu-switch]",
			);
			const mobilePanel = root.querySelector<HTMLElement>(
				"[data-nav-menu-panel]",
			);
			const settingsButton = root.querySelector<HTMLElement>(
				"[data-display-settings-switch]",
			);
			const settingsPanel = root.querySelector<HTMLElement>(
				"[data-display-settings-panel]",
			);
			const hueSlider = root.querySelector<HTMLInputElement>("#colorSlider");
			const hueValue = root.querySelector<HTMLElement>("#hueValue");

			if (!settingsPanel) {
				window.setTimeout(bindSiteNav, 50);
				return;
			}

			if (root.getAttribute(BOUND_ATTRIBUTE) === "true") return;
			root.setAttribute(BOUND_ATTRIBUTE, "true");

			const closeDropdowns = () => {
				dropdowns.forEach((dropdown) => {
					dropdown.classList.remove("is-open");
					dropdown
						.querySelector<HTMLElement>("[data-nav-dropdown-trigger]")
						?.setAttribute("aria-expanded", "false");
				});
			};

			const setMobileOpen = (open: boolean) => {
				mobilePanel?.classList.toggle("is-open", open);
				mobileButton?.setAttribute("aria-expanded", String(open));
			};

			const setSettingsOpen = (open: boolean) => {
				settingsPanel?.setAttribute("data-open", String(open));
				settingsPanel?.classList.toggle("is-open", open);
				settingsPanel?.classList.toggle("float-panel-closed", !open);
			};

			const setHueValue = (value: string | number) => {
				const parsedHue = Number.parseInt(String(value), 10);
				const normalizedHue = ((parsedHue % 360) + 360) % 360;
				if (Number.isNaN(normalizedHue)) return;

				localStorage.setItem("hue", String(normalizedHue));
				document.documentElement.style.setProperty(
					"--hue",
					`${normalizedHue}deg`,
				);
				document.documentElement.style.setProperty(
					"--hue-20",
					`${(normalizedHue + 20) % 360}deg`,
				);
				document.documentElement.style.setProperty(
					"--hue-40",
					`${(normalizedHue + 40) % 360}deg`,
				);
				document.documentElement.style.setProperty(
					"--hue-45",
					`${(normalizedHue + 45) % 360}deg`,
				);
				document.documentElement.style.setProperty(
					"--hue-120",
					`${(normalizedHue + 120) % 360}deg`,
				);

				if (hueSlider) hueSlider.value = String(normalizedHue);
				if (hueValue) hueValue.textContent = String(normalizedHue);
			};

			const handleHueInput = (event: Event) => {
				if (event.target !== hueSlider) return;
				const target = event.target as HTMLInputElement;
				setHueValue(target.value);
			};

			const closeAll = () => {
				closeDropdowns();
				setMobileOpen(false);
				setSettingsOpen(false);
			};

			for (const dropdown of dropdowns) {
				const trigger = dropdown.querySelector<HTMLButtonElement>(
					"[data-nav-dropdown-trigger]",
				);
				if (!trigger) continue;

				const setDropdownOpen = (open: boolean) => {
					closeDropdowns();
					setMobileOpen(false);
					setSettingsOpen(false);
					dropdown.classList.toggle("is-open", open);
					trigger.setAttribute("aria-expanded", String(open));
				};

				trigger.addEventListener("click", (event) => {
					event.stopPropagation();
					setDropdownOpen(!dropdown.classList.contains("is-open"));
				});
			}

			mobileButton?.addEventListener("click", (event) => {
				event.stopPropagation();
				const shouldOpen = !mobilePanel?.classList.contains("is-open");
				closeDropdowns();
				setSettingsOpen(false);
				setMobileOpen(shouldOpen);
			});

			settingsButton?.addEventListener("click", (event) => {
				event.stopPropagation();
				const shouldOpen = settingsPanel?.getAttribute("data-open") !== "true";
				closeDropdowns();
				setMobileOpen(false);
				setSettingsOpen(shouldOpen);
			});

			settingsPanel?.addEventListener("input", handleHueInput);
			settingsPanel?.addEventListener("change", handleHueInput);

			root.addEventListener("keydown", (event) => {
				if (event.key === "Escape") closeAll();
			});

			document.addEventListener("click", (event) => {
				if (!(event.target instanceof Node)) return;
				if (!root.contains(event.target)) closeAll();
			});

			const updateScroll = () => {
				if (window.scrollY > 20) {
					root.classList.add("is-scrolled");
				} else {
					root.classList.remove("is-scrolled");
				}
			};
			window.addEventListener("scroll", updateScroll, { passive: true });
			updateScroll();
		});
}
