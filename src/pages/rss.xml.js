import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getSortedPosts } from "../utils/posts";

export async function GET(context) {
	const posts = await getSortedPosts();
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
