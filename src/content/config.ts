import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	schema: z.object({}),
});

const favoritesCollection = defineCollection({
	type: "data",
	schema: z.object({
		title: z.string(),
		creator: z.string().optional().default(""),
		status: z.string().optional().default(""),
		rating: z.number().min(0).max(10).optional().default(0),
		year: z.number().optional(),
		progress: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		featured: z.boolean().optional().default(false),
	}),
});

const diaryCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		date: z.date(),
		mood: z.string().optional().default(""),
		weather: z.string().optional().default(""),
		excerpt: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
	}),
});

const albumCollection = defineCollection({
	type: "data",
	schema: z.object({
		title: z.string(),
		date: z.date().optional(),
		location: z.string().optional().default(""),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		featured: z.boolean().optional().default(false),
	}),
});

export const collections = {
	posts: postsCollection,
	spec: specCollection,
	novels: favoritesCollection,
	anime: favoritesCollection,
	diary: diaryCollection,
	album: albumCollection,
};
