import { Crawler } from "../src";

test("crawler", async () => {
	const crawler = new Crawler();
	const result = await crawler.start({
		entry: "https://www.google.com/",
		depth: 1,
		actors: {
			title: {
				match: /google.com/,
				action: async ({ page }) => page.title(),
			},
		},
	});
	expect(result.title.get("https://www.google.com/")).toBe("Google");
	await crawler.stop();
});
