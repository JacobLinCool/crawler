import { Crawler } from "./src";

(async () => {
	const crawler = new Crawler();

	const result = await crawler.start({
		entry: "https://jacoblin.cool/",
		depth: 3,
		actors: {
			images: {
				match: /^https:\/\/jacoblin.cool/,
				action: async ({ page, targets, path }) => {
					const hyperlinks = await page.getByRole("link").all();
					for (const link of hyperlinks) {
						const href = await link.getAttribute("href");
						if (href !== null) {
							targets.add(href);
						}
					}

					const images = await page.getByRole("img").all();
					const urls = await Promise.all(
						images.map((image) => image.getAttribute("src")),
					);

					return [...new Set(urls.filter((url) => url !== null))];
				},
			},
		},
	});

	console.log(result);
	crawler.stop();
})();
