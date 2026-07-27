import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	// Obsidian template/scratch files and empty drafts are excluded so they
	// don't break the build (they're missing required frontmatter).
	loader: glob({
		base: "./src/content/blog",
		pattern: [
			"**/*.{md,mdx}",
			"!模板/**",
			// Draft convention: put unfinished notes in a folder named with
			// half-width parentheses, e.g. "(隱藏發佈)/", to keep them out of
			// the build without editing this file each time.
			"!\\(隱藏發佈\\)/**",
			"!標題練習.md",
			"!露營車系列指南/關於我看的第一台車.md",
			"!露營車系列指南/紐西蘭購車眉角.md",
		],
	}),
	// Type-check frontmatter using a schema.
	// heroImage uses the `image()` helper so the cover photo works exactly
	// like any other photo dragged into Obsidian: a relative path (e.g.
	// "Pic/my-photo.jpg") next to the note, not a separate public/ upload.
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
		}),
});

export const collections = { blog };
