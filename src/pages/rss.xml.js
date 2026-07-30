import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
	const posts = await getCollection("blog");
	const [siteSettings] = await getCollection("siteSettings");
	return rss({
		title: siteSettings?.data.title ?? "",
		description: siteSettings?.data.description ?? "",
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: `/blog/${post.id}/`,
		})),
	});
}
