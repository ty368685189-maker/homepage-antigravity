import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "双持金枪客",
	subtitle: "小说、国漫、技术与长期钻研的个人记录",
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 210, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: true,
		src: "/wallpaper.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		// {
		//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
		//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
		//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		// }
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.About,
		LinkPreset.Archive,
		{
			name: "内容收藏",
			children: [
				{ name: "动漫", url: "/anime/" },
				{ name: "日记", url: "/diary/" },
				{ name: "相册", url: "/album/" },
				{ name: "小说", url: "/novels/" },
			],
		},
		{
			name: "联系方式",
			children: [
				{
					name: "Email",
					icon: "fa6-regular:envelope",
					url: "mailto:ty368685189@gmail.com",
					external: true,
				},
				{
					name: "抖音 (Douyin)",
					icon: "fa6-brands:tiktok",
					url: "https://v.douyin.com/SZAvfU7kPxk/",
					external: true,
				},
				{
					name: "小红书",
					icon: "fa6-solid:book-open",
					url: "https://xhslink.com/m/7LIUBOh9QZJ",
					external: true,
				},
				{
					name: "今日头条",
					icon: "fa6-regular:newspaper",
					url: "https://www.toutiao.com/c/user/token/CizGmNa3i8pDMqiA6ALm_pW_ex-L2eqrUoN-frh2sQTinhZfUNtBSDouFwEkfBpJCjwAAAAAAAAAAAAAUHEuYlGhb3aYT3-y13jpfV6hrVMcqjHTOluRTZwDVR6Jd6T3_-LbS2mV5GWFnkdOPXAQsv2RDhjDxYPqBCIBAzcwHZc=/?source=mine_profile",
					external: true,
				},
			],
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "双持金枪客",
	bio: "把小说、国漫、技术实践和长期思考慢慢写清楚。",
	links: [
		{
			name: "Email",
			icon: "fa6-regular:envelope",
			url: "mailto:ty368685189@gmail.com",
		},
		{
			name: "抖音 (Douyin)",
			icon: "fa6-brands:tiktok",
			url: "https://v.douyin.com/SZAvfU7kPxk/",
		},
		{
			name: "小红书",
			icon: "fa6-solid:book-open",
			url: "https://xhslink.com/m/7LIUBOh9QZJ",
		},
		{
			name: "今日头条",
			icon: "fa6-regular:newspaper",
			url: "https://www.toutiao.com/c/user/token/CizGmNa3i8pDMqiA6ALm_pW_ex-L2eqrUoN-frh2sQTinhZfUNtBSDouFwEkfBpJCjwAAAAAAAAAAAAAUHEuYlGhb3aYT3-y13jpfV6hrVMcqjHTOluRTZwDVR6Jd6T3_-LbS2mV5GWFnkdOPXAQsv2RDhjDxYPqBCIBAzcwHZc=/?source=mine_profile",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
