<script lang="ts">
import { onMount } from "svelte";

import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { getPostUrlBySlug } from "../utils/url-utils";

export let tags: string[] = [];
export let categories: string[] = [];
export let sortedPosts: Post[] = [];

const params = new URLSearchParams(window.location.search);
tags = params.has("tag") ? params.getAll("tag") : [];
categories = params.has("category") ? params.getAll("category") : [];
const uncategorized = params.get("uncategorized");

interface Post {
	slug: string;
	data: {
		title: string;
		tags: string[];
		category?: string | null;
		published: Date;
	};
}

interface Group {
	year: number;
	posts: Post[];
}

let groups: Group[] = [];
let totalPosts = 0;
let activeFilters: string[] = [];

function formatDate(date: Date) {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${month}.${day}`;
}

function getPostCountText(count: number) {
	return `${count} ${i18n(count === 1 ? I18nKey.postCount : I18nKey.postsCount)}`;
}

onMount(async () => {
	let filteredPosts: Post[] = sortedPosts;

	if (tags.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) =>
				Array.isArray(post.data.tags) &&
				post.data.tags.some((tag) => tags.includes(tag)),
		);
	}

	if (categories.length > 0) {
		filteredPosts = filteredPosts.filter(
			(post) => post.data.category && categories.includes(post.data.category),
		);
	}

	if (uncategorized) {
		filteredPosts = filteredPosts.filter((post) => !post.data.category);
	}

	totalPosts = filteredPosts.length;
	activeFilters = [
		...tags.map((tag) => `#${tag}`),
		...categories,
		...(uncategorized ? ["未分类"] : []),
	];

	const grouped = filteredPosts.reduce(
		(acc, post) => {
			const year = post.data.published.getFullYear();
			if (!acc[year]) {
				acc[year] = [];
			}
			acc[year].push(post);
			return acc;
		},
		{} as Record<number, Post[]>,
	);

	const groupedPostsArray = Object.keys(grouped).map((yearStr) => ({
		year: Number.parseInt(yearStr, 10),
		posts: grouped[Number.parseInt(yearStr, 10)],
	}));

	groupedPostsArray.sort((a, b) => b.year - a.year);

	groups = groupedPostsArray;
});
</script>

<section class="archive-shell" aria-label={i18n(I18nKey.archive)}>
	<header class="archive-hero">
		<div>
			<p class="eyebrow">Archive</p>
			<h1>{i18n(I18nKey.archive)}</h1>
		</div>
		<div class="archive-summary">
			<strong>{totalPosts}</strong>
			<span>{i18n(totalPosts === 1 ? I18nKey.postCount : I18nKey.postsCount)}</span>
		</div>
	</header>

	{#if activeFilters.length > 0}
		<div class="filter-row" aria-label="当前筛选">
			{#each activeFilters as filter}
				<span>{filter}</span>
			{/each}
		</div>
	{/if}

	<div class="year-stack">
		{#each groups as group}
			<section class="year-section" aria-labelledby={`archive-year-${group.year}`}>
				<div class="year-heading">
					<h2 id={`archive-year-${group.year}`}>{group.year}</h2>
					<span>{getPostCountText(group.posts.length)}</span>
				</div>

				<div class="post-list">
					{#each group.posts as post}
						<a
							href={getPostUrlBySlug(post.slug)}
							aria-label={post.data.title}
							class="post-row"
						>
							<time datetime={post.data.published.toISOString()}>
								{formatDate(post.data.published)}
							</time>
							<div class="post-main">
								<h3>{post.data.title}</h3>
								{#if post.data.tags?.length}
									<div class="tag-list" aria-label="标签">
										{#each post.data.tags.slice(0, 3) as tag}
											<span>#{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
							<span class="arrow" aria-hidden="true">›</span>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</section>

<style>
	.archive-shell {
		width: 100%;
		padding: clamp(1rem, 2.5vw, 1.4rem);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: 0 24px 70px oklch(0.26 0.08 var(--hue) / 0.12);
	}

	:global(.dark) .archive-shell {
		box-shadow: none;
	}

	.archive-hero {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1.15rem;
		border-bottom: 1px solid var(--color-border);
	}

	.eyebrow {
		margin: 0 0 0.45rem;
		color: var(--primary);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3 {
		margin: 0;
		letter-spacing: 0;
		color: var(--color-text);
	}

	h1 {
		font-size: clamp(2rem, 4vw, 3.2rem);
		line-height: 1;
		font-weight: 850;
	}

	.archive-summary {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		min-width: max-content;
		color: var(--color-muted);
		font-weight: 750;
	}

	.archive-summary strong {
		color: var(--primary);
		font-size: clamp(2rem, 4vw, 3.25rem);
		line-height: 1;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		padding-top: 1rem;
	}

	.filter-row span,
	.tag-list span {
		border-radius: 999px;
		background: var(--color-surface-strong);
		color: var(--primary);
		border: 1px solid rgba(14, 165, 233, 0.18);
		font-size: 0.82rem;
		font-weight: 750;
		display: inline-flex;
		align-items: center;
		transition: all 0.2s ease;
	}

	:global(.dark) .filter-row span,
	:global(.dark) .tag-list span {
		border-color: rgba(56, 189, 248, 0.25);
	}

	.filter-row span {
		padding: 0.42rem 0.72rem;
	}

	.tag-list span {
		padding: 0.24rem 0.55rem;
	}

	.year-stack {
		display: grid;
		gap: 1.15rem;
		margin-top: 1.25rem;
	}

	.year-section {
		display: grid;
		grid-template-columns: minmax(5.8rem, 0.22fr) minmax(0, 1fr);
		gap: clamp(1rem, 3vw, 1.8rem);
		align-items: start;
		padding: 1.1rem 0 1.25rem;
		border-bottom: 1px solid var(--color-border);
	}

	.year-section:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}

	.year-heading {
		position: sticky;
		top: 5.5rem;
	}

	.year-heading h2 {
		color: var(--primary);
		font-size: clamp(1.9rem, 4vw, 3rem);
		font-weight: 850;
		line-height: 1;
	}

	.year-heading span {
		display: block;
		margin-top: 0.45rem;
		color: var(--color-muted);
		font-size: 0.88rem;
		font-weight: 750;
	}

	.post-list {
		display: grid;
	}

	.post-row {
		display: grid;
		grid-template-columns: 4.4rem minmax(0, 1fr) 1.4rem;
		gap: 0.9rem;
		align-items: center;
		min-height: 4.25rem;
		padding: 0.8rem 0.65rem;
		border-top: 1px solid var(--color-border);
		border-radius: 8px;
		color: inherit;
	}

	.post-row:first-child {
		border-top: 0;
	}

	time {
		color: var(--color-muted);
		font-family: "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 0.86rem;
		font-weight: 750;
	}

	.post-main {
		min-width: 0;
	}

	.post-main h3 {
		overflow: hidden;
		font-size: 1rem;
		font-weight: 800;
		line-height: 1.45;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: color 0.2s ease;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.38rem;
		margin-top: 0.42rem;
	}

	.tag-list span {
		padding: 0.24rem 0.48rem;
		font-size: 0.76rem;
	}

	.arrow {
		color: var(--color-muted);
		font-size: 1.45rem;
		line-height: 1;
		text-align: right;
		transition:
			color 0.2s ease,
			transform 0.2s ease;
	}

	.post-row:hover h3,
	.post-row:hover .arrow {
		color: var(--primary);
	}

	.post-row:hover {
		background: var(--color-surface-soft);
	}

	.post-row:hover .arrow {
		transform: translateX(0.18rem);
	}

	@media (max-width: 720px) {
		.archive-hero {
			align-items: start;
			flex-direction: column;
		}

		.year-section {
			grid-template-columns: 1fr;
		}

		.year-heading {
			position: static;
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 1rem;
			padding-bottom: 0.85rem;
			border-bottom: 1px solid var(--color-border);
		}

		.year-heading span {
			margin-top: 0;
		}

		.post-row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.65rem;
		}

		time {
			grid-column: 1 / -1;
		}

		.post-main h3 {
			white-space: normal;
		}

		.tag-list {
			display: none;
		}
	}
</style>
