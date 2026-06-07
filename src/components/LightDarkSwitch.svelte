<script lang="ts">
import { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants.ts";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import {
	applyThemeToDocument,
	getStoredTheme,
	setTheme,
} from "@utils/setting-utils.ts";
import { onMount } from "svelte";
import type { LIGHT_DARK_MODE } from "@/types/config.ts";

const seq: LIGHT_DARK_MODE[] = [LIGHT_MODE, DARK_MODE, AUTO_MODE];
let {
	compact = false,
	...props
}: { compact?: boolean; [key: string]: unknown } = $props();
let mode: LIGHT_DARK_MODE = $state(AUTO_MODE);

onMount(() => {
	mode = getStoredTheme();
	const darkModePreference = window.matchMedia("(prefers-color-scheme: dark)");
	const changeThemeWhenSchemeChanged: Parameters<
		typeof darkModePreference.addEventListener<"change">
	>[1] = (_e) => {
		applyThemeToDocument(mode);
	};
	darkModePreference.addEventListener("change", changeThemeWhenSchemeChanged);
	return () => {
		darkModePreference.removeEventListener(
			"change",
			changeThemeWhenSchemeChanged,
		);
	};
});

function switchScheme(newMode: LIGHT_DARK_MODE) {
	mode = newMode;
	setTheme(newMode);
}

function cycleTheme(event: MouseEvent) {
	event.stopPropagation();
	const nextMode = {
		[AUTO_MODE]: LIGHT_MODE,
		[LIGHT_MODE]: DARK_MODE,
		[DARK_MODE]: AUTO_MODE,
	}[mode];
	switchScheme(nextMode);
}
</script>

<div class="scheme-root">
    <button aria-label="Light/Dark Mode" class="scheme-switch" id="scheme-switch" onclick={cycleTheme}>
        <div class="scheme-icon-layer" class:opacity-0={mode !== LIGHT_MODE}>
            <Icon icon="material-symbols:wb-sunny-outline-rounded" class="text-[1.25rem]"></Icon>
        </div>
        <div class="scheme-icon-layer" class:opacity-0={mode !== DARK_MODE}>
            <Icon icon="material-symbols:dark-mode-outline-rounded" class="text-[1.25rem]"></Icon>
        </div>
        <div class="scheme-icon-layer" class:opacity-0={mode !== AUTO_MODE}>
            <Icon icon="material-symbols:radio-button-partial-outline" class="text-[1.25rem]"></Icon>
        </div>
    </button>
</div>

<style>
	.scheme-root {
		position: relative;
		z-index: 90;
		display: inline-flex;
	}

	.scheme-switch {
		position: relative;
		display: inline-flex;
		width: 2.75rem;
		height: 2.75rem;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: rgba(15, 23, 42, 0.82);
		cursor: pointer;
		transition:
			background-color 0.18s ease,
			color 0.18s ease,
			transform 0.18s ease;
	}

	:global(.dark) .scheme-switch {
		color: rgba(255, 255, 255, 0.86);
	}

	.scheme-switch:hover,
	.scheme-switch[aria-expanded="true"] {
		background: var(--btn-plain-bg-hover);
		color: var(--primary);
	}

	.scheme-switch:active {
		transform: scale(0.92);
	}

	.scheme-icon-layer {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity 0.16s ease;
	}

	.scheme-icon-layer :global(svg) {
		display: block;
		font-size: 1.25rem;
		color: currentColor;
	}

	.scheme-panel {
		position: absolute;
		top: calc(100% + 0.75rem);
		right: 0;
		z-index: 120;
		width: max-content;
		min-width: 10.5rem;
	}

	.scheme-card {
		display: grid;
		gap: 0.25rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 0.9rem;
		background: rgba(255, 255, 255, 0.96);
		padding: 0.45rem;
		box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
	}

	:global(.dark) .scheme-card {
		border-color: rgba(255, 255, 255, 0.1);
		background: rgba(18, 20, 30, 0.96);
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.42);
	}

	.scheme-option {
		display: flex;
		width: 100%;
		min-height: 2.45rem;
		align-items: center;
		gap: 0.65rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		padding: 0 0.8rem;
		color: rgba(15, 23, 42, 0.82);
		font: inherit;
		font-weight: 800;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;
	}

	:global(.dark) .scheme-option {
		color: rgba(255, 255, 255, 0.84);
	}

	.scheme-option:hover,
	.scheme-option.current-theme-btn {
		background: var(--btn-plain-bg-hover);
		color: var(--primary);
	}

	.scheme-option:active {
		transform: scale(0.98);
	}

	.scheme-option-icon {
		flex: 0 0 auto;
		font-size: 1.2rem;
		color: currentColor;
	}
</style>
