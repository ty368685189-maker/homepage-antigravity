import "overlayscrollbars/overlayscrollbars.css";
import { OverlayScrollbars } from "overlayscrollbars";
import { siteConfig } from "../config";
import { BANNER_HEIGHT, BANNER_HEIGHT_EXTEND } from "../constants/constants";
import {
	getHue,
	getStoredTheme,
	setHue,
	setTheme,
} from "../utils/setting-utils";
import { pathsEqual, url } from "../utils/url-utils";

const bannerEnabled = !!document.getElementById("banner-wrapper");

function loadTheme() {
	setTheme(getStoredTheme());
}

function loadHue() {
	setHue(getHue());
}

function initCustomScrollbar() {
	const katexElements = document.querySelectorAll(
		".katex-display",
	) as NodeListOf<HTMLElement>;
	const katexObserverOptions = {
		root: null,
		rootMargin: "100px",
		threshold: 0.1,
	};

	const processKatexElement = (element: HTMLElement) => {
		if (!element.parentNode) return;
		if (element.hasAttribute("data-scrollbar-initialized")) return;

		const container = document.createElement("div");
		container.className = "katex-display-container";
		container.setAttribute("aria-label", "scrollable container for formulas");

		element.parentNode.insertBefore(container, element);
		container.appendChild(element);

		OverlayScrollbars(container, {
			scrollbars: {
				theme: "scrollbar-base scrollbar-auto",
				autoHide: "leave",
				autoHideDelay: 500,
				autoHideSuspend: false,
			},
		});

		element.setAttribute("data-scrollbar-initialized", "true");
	};

	const katexObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				processKatexElement(entry.target as HTMLElement);
				observer.unobserve(entry.target);
			}
		});
	}, katexObserverOptions);

	katexElements.forEach((element) => {
		katexObserver.observe(element);
	});
}

function showBanner() {
	if (!siteConfig.banner.enable) return;
	const banner = document.getElementById("banner");
	if (banner) {
		banner.classList.remove("opacity-0", "scale-105");
	}
}

export function initMain() {
	loadTheme();
	loadHue();
	initCustomScrollbar();
	showBanner();
}

export function setupSwupHooks() {
	const swup = window.swup;
	if (!swup) return;

	swup.hooks.on("link:click", () => {
		document.documentElement.style.setProperty("--content-delay", "0ms");
	});

	swup.hooks.on("content:replace", initCustomScrollbar);

	swup.hooks.on("visit:start", (visit: { to: { url: string } }) => {
		const bodyElement = document.querySelector("body");
		if (pathsEqual(visit.to.url, url("/"))) {
			bodyElement?.classList.add("lg:is-home");
		} else {
			bodyElement?.classList.remove("lg:is-home");
		}

		const heightExtend = document.getElementById("page-height-extend");
		heightExtend?.classList.remove("hidden");

		const toc = document.getElementById("toc-wrapper");
		toc?.classList.add("toc-not-ready");
	});

	swup.hooks.on("page:view", () => {
		const heightExtend = document.getElementById("page-height-extend");
		heightExtend?.classList.remove("hidden");
	});

	swup.hooks.on("visit:end", () => {
		setTimeout(() => {
			const heightExtend = document.getElementById("page-height-extend");
			heightExtend?.classList.add("hidden");

			const toc = document.getElementById("toc-wrapper");
			toc?.classList.remove("toc-not-ready");
		}, 200);
	});
}

export function setupScrollListener() {
	const backToTopBtn = document.getElementById("back-to-top-btn");
	const toc = document.getElementById("toc-wrapper");

	window.addEventListener("scroll", () => {
		const bannerHeight = window.innerHeight * (BANNER_HEIGHT / 100);

		if (backToTopBtn) {
			if (
				document.body.scrollTop > bannerHeight ||
				document.documentElement.scrollTop > bannerHeight
			) {
				backToTopBtn.classList.remove("hide");
			} else {
				backToTopBtn.classList.add("hide");
			}
		}

		if (bannerEnabled && toc) {
			if (
				document.body.scrollTop > bannerHeight ||
				document.documentElement.scrollTop > bannerHeight
			) {
				toc.classList.remove("toc-hide");
			} else {
				toc.classList.add("toc-hide");
			}
		}
	});
}

export function setupResizeListener() {
	window.addEventListener("resize", () => {
		let offset = Math.floor(window.innerHeight * (BANNER_HEIGHT_EXTEND / 100));
		offset = offset - (offset % 4);
		document.documentElement.style.setProperty(
			"--banner-height-extend",
			`${offset}px`,
		);
	});
}
