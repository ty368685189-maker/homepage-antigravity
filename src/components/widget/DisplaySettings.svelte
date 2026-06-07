<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { getDefaultHue, getHue, setHue } from "@utils/setting-utils";
import { onMount } from "svelte";

let { ...props }: Record<string, unknown> = $props();
let hue = $state(getHue());
const defaultHue = getDefaultHue();
let eyeCare = $state(false);
let sliderElement: HTMLInputElement | undefined;
const presets = [
	{ label: "冰蓝", value: 210 },
	{ label: "青绿", value: 165 },
	{ label: "紫电", value: 275 },
	{ label: "金橙", value: 55 },
	{ label: "赤红", value: 20 },
];

function resetHue() {
	hue = getDefaultHue();
}

function updateHue(event: Event) {
	const target = event.currentTarget as HTMLInputElement;
	hue = Number.parseInt(target.value, 10);
}

function toggleEyeCare() {
	eyeCare = !eyeCare;
	if (eyeCare) {
		document.documentElement.classList.add("eye-care");
		localStorage.setItem("eye-care", "true");
	} else {
		document.documentElement.classList.remove("eye-care");
		localStorage.setItem("eye-care", "false");
	}
}

onMount(() => {
	eyeCare = localStorage.getItem("eye-care") === "true";

	if (!sliderElement) return;

	const handleSliderInput = () => {
		hue = Number.parseInt(sliderElement?.value || String(defaultHue), 10);
	};

	sliderElement.addEventListener("input", handleSliderInput);
	sliderElement.addEventListener("change", handleSliderInput);

	return () => {
		sliderElement?.removeEventListener("input", handleSliderInput);
		sliderElement?.removeEventListener("change", handleSliderInput);
	};
});

$effect(() => {
	if (hue || hue === 0) {
		setHue(hue);
	}
});
</script>

<div
	id="display-setting"
	data-display-settings-panel
	data-open="false"
	class="display-settings-panel float-panel-closed absolute transition-all w-80 right-4 px-4 py-4 flex flex-col gap-4"
>
    <!-- Theme Color Slider -->
    <div>
        <div class="flex flex-row gap-2 mb-3 items-center justify-between">
            <div class="setting-title flex gap-2 font-bold text-lg transition relative ml-3
                before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)]
                before:absolute before:-left-3 before:top-[0.33rem]"
            >
                {i18n(I18nKey.themeColor)}
                <button aria-label="Reset to Default" class="btn-regular w-7 h-7 rounded-md active:scale-90 will-change-transform"
                        class:opacity-0={hue === defaultHue} class:pointer-events-none={hue === defaultHue} onclick={resetHue}>
                    <div class="text-[var(--btn-content)]">
                        <Icon icon="fa6-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                    </div>
                </button>
            </div>
            <div class="flex gap-1">
                <div id="hueValue" class="hue-value transition w-10 h-7 rounded-md flex justify-center
                font-bold text-sm items-center">
                    {hue}
                </div>
            </div>
        </div>
        <div class="slider-shell w-full h-6 px-1 rounded select-none">
            <input aria-label={i18n(I18nKey.themeColor)} type="range" min="0" max="360" bind:value={hue}
                   bind:this={sliderElement}
                   oninput={updateHue} onchange={updateHue}
                   class="slider" id="colorSlider" step="5" style="width: 100%">
        </div>
        <div class="preset-grid mt-3">
            {#each presets as preset}
                <button
                    type="button"
                    class:active-preset={Math.abs(hue - preset.value) <= 2}
                    aria-label={`切换到${preset.label}主题`}
                    onclick={() => (hue = preset.value)}
                    style={`--preset-hue: ${preset.value}`}
                >
                    <span></span>
                    {preset.label}
                </button>
            {/each}
        </div>
    </div>

    <!-- Divider -->
    <div class="h-[1px] bg-black/5 dark:bg-white/5 w-full"></div>

    <!-- Eye Care Switch -->
    <div class="flex flex-row items-center justify-between">
        <div class="setting-title flex gap-2 font-bold text-lg transition relative ml-3
            before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)]
            before:absolute before:-left-3 before:top-[0.33rem]"
        >
            {i18n(I18nKey.eyeCare)}
        </div>
        <button 
            aria-label={i18n(I18nKey.eyeCare)}
            onclick={toggleEyeCare}
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none"
            class:bg-[var(--primary)]={eyeCare}
            class:bg-[var(--btn-regular-bg)]={!eyeCare}
        >
            <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm"
                class:translate-x-6={eyeCare}
                class:translate-x-1={!eyeCare}
            ></span>
        </button>
    </div>
</div>

<style lang="stylus">
    .display-settings-panel
      top calc(100% + 0.75rem)
      z-index 80
      max-height calc(100vh - 6.5rem)
      overflow-y auto
      opacity 0
      pointer-events none
      visibility hidden
      transform translateY(-0.35rem)
      border unquote("1px solid rgba(15, 23, 42, 0.08)")
      border-radius 0.9rem
      color rgba(15, 23, 42, 0.86)
      backdrop-filter blur(18px)
      -webkit-backdrop-filter blur(18px)
      background rgba(255, 255, 255, 0.96)
      box-shadow unquote("0 20px 48px rgba(15, 23, 42, 0.18)")
      transition opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease

      :global(.dark) &
        border-color rgba(255, 255, 255, 0.1)
        color rgba(255, 255, 255, 0.86)
        background rgba(18, 20, 30, 0.96)
        box-shadow unquote("0 20px 48px rgba(0, 0, 0, 0.42)")

      &:global(.is-open)
        opacity 1
        pointer-events auto
        visibility visible
        transform translateY(0)

      &.float-panel-closed
        opacity 0
        pointer-events none
        visibility hidden
        transform translateY(-0.35rem)

      .setting-title
        color inherit

      .hue-value
        background var(--btn-regular-bg)
        color var(--btn-content)

      .slider-shell
        position relative
        display flex
        align-items center
        background-image unquote("linear-gradient(to right, hsl(0 90% 60%), hsl(30 90% 60%), hsl(60 90% 55%), hsl(120 70% 48%), hsl(180 80% 48%), hsl(240 85% 62%), hsl(300 85% 60%), hsl(360 90% 60%))")
        overflow hidden

      input[type="range"]
        -webkit-appearance none
        appearance none
        width 100%
        height 1.5rem
        background transparent
        border 0
        cursor pointer
        transition background-image 0.15s ease-in-out

        &::-webkit-slider-runnable-track
          height 1.5rem
          border 0
          background transparent

        &::-moz-range-track
          height 1.5rem
          border 0
          background transparent

        &::-moz-range-progress
          height 1.5rem
          border 0
          background transparent

        /* Input Thumb */
        &::-webkit-slider-thumb
          -webkit-appearance none
          height 1rem
          width 0.5rem
          border-radius 0.125rem
          background rgba(255, 255, 255, 0.7)
          box-shadow unquote("0 0 0 1px rgba(0, 0, 0, 0.18), 0 0 0 999px transparent")
          &:hover
            background rgba(255, 255, 255, 0.8)
          &:active
            background rgba(255, 255, 255, 0.6)

        &::-moz-range-thumb
          appearance none
          height 1rem
          width 0.5rem
          border-radius 0.125rem
          border 1px solid rgba(0, 0, 0, 0.18)
          background rgba(255, 255, 255, 0.7)
          box-shadow none
          &:hover
            background rgba(255, 255, 255, 0.8)
          &:active
            background rgba(255, 255, 255, 0.6)

        &::-ms-thumb
          appearance none
          height 1rem
          width 0.5rem
          border-radius 0.125rem
          background rgba(255, 255, 255, 0.7)
          box-shadow none
          &:hover
            background rgba(255, 255, 255, 0.8)
          &:active
            background rgba(255, 255, 255, 0.6)

      .preset-grid
        display grid
        grid-template-columns repeat(5, minmax(0, 1fr))
        gap 0.4rem

        button
          display inline-flex
          min-width 0
          height 2.25rem
          align-items center
          justify-content center
          gap 0.25rem
          border unquote("1px solid oklch(0.7 0.08 var(--preset-hue) / 0.24)")
          border-radius 0.5rem
          background unquote("oklch(0.92 0.04 var(--preset-hue) / 0.62)")
          color oklch(0.3 0.07 var(--preset-hue))
          font-size 0.75rem
          font-weight 800
          transition all 0.16s ease

          :global(.dark) &
            background unquote("oklch(0.3 0.065 var(--preset-hue) / 0.72)")
            color oklch(0.9 0.035 var(--preset-hue))

          &:hover,
          &.active-preset
            border-color unquote("oklch(0.72 0.14 var(--preset-hue) / 0.72)")
            background unquote("oklch(0.78 0.12 var(--preset-hue) / 0.34)")
            transform translateY(-1px)

          span
            width 0.5rem
            height 0.5rem
            border-radius 999px
            background oklch(0.72 0.16 var(--preset-hue))
            box-shadow unquote("0 0 0.8rem oklch(0.72 0.16 var(--preset-hue) / 0.5)")

</style>
