import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { Crawler, RateLimiter, Response } from "@jacoblincool/crawler";
import { program } from "commander";
import ora from "ora";
import { find_chrome } from "./chrome";

program
	.name("crawler")
	.argument("<entry>", "The entry URL")
	.option("-d, --depth <depth>", "The maximum depth", Number, 2)
	.option(
		"-c, --concurrency <limit>",
		"The maximum number of concurrent requests",
		Number,
		os.cpus().length,
	)
	.option("--browser <browser>", "The browser to use", "chromium")
	.option("--head", "Show the browser window")
	.option("--dry", "Dry run")
	.action(
		async (
			entry: string,
			options: {
				depth: number;
				concurrency: number;
				browser: string;
				head: boolean;
				dry: boolean;
			},
		) => {
			if (
				options.browser !== "chromium" &&
				options.browser !== "firefox" &&
				options.browser !== "webkit"
			) {
				console.error("Invalid browser");
				process.exit(1);
			}

			const crawler = new Crawler({
				browser: options.browser,
				options: {
					headless: !options.head,
					executablePath:
						options.browser === "chromium" ? find_chrome() || undefined : undefined,
				},
			});

			const spinner = ora();

			crawler.on("page-start", ({ url, path }) =>
				spinner.start(`Start crawling ${url} [${path.join(" -> ")}]`),
			);
			crawler.on("page-done", ({ url, path }) =>
				spinner.succeed(`Done crawling ${url} [${path.join(" -> ")}]`).start(),
			);
			crawler.on("actor-triggered", ({ url, path, actor }) =>
				spinner.info(`Triggered actor ${actor} on ${url} [${path}]`).start(),
			);
			crawler.on("warning", (err) => {
				spinner.warn(err.message).start();
			});

			const entrypoint = new URL(entry);
			const root = path.resolve(entrypoint.host);
			spinner.info(`Destination: ${root}`).start();

			const rewrites = new Map<string, string>();

			function save(url: string, content: string | Buffer) {
				let filename = url.replace(entrypoint.origin, ".");
				const ext = path.extname(filename);
				if (ext === "" && !filename.endsWith("/")) {
					filename += "/";
				}
				if (filename.endsWith("/")) {
					filename += "index.html";
				}

				if (typeof content === "string") {
					for (const [from, to] of rewrites) {
						content = content.replace(new RegExp(from, "g"), to);
					}
				}

				const filepath = path.join(root, filename);
				if (options.dry) {
					spinner.info(`[DRY] Save ${url} to ${filepath}`).start();
				} else {
					spinner.succeed(`Save ${url} to ${filepath}`).start();
					fs.mkdirSync(path.dirname(filepath), { recursive: true });
					fs.writeFileSync(filepath, content);
				}
			}

			const processed = new Set<string>();
			async function handler(res: Response) {
				const url = new URL(res.url());
				if (processed.has(url.href)) {
					return;
				}
				processed.add(url.href);
				if (url.origin === entrypoint.origin && res.ok()) {
					spinner.start(`Processing ${url.href}`);
					try {
						save(url.href, await res.body());
						spinner.succeed(`Processed ${url.href}`).start();
					} catch (err) {
						spinner.warn(`Failed to process ${url.href}`).start();
					}
				}
			}

			await crawler.start({
				entry: entrypoint.href,
				depth: options.depth,
				actors: {
					crawl: {
						match: new RegExp("^" + entrypoint.origin),
						action: async ({ page, targets, path }) => {
							await page.waitForLoadState("networkidle");
							const hyperlinks = await page.getByRole("link").all();
							for (const link of hyperlinks) {
								const href = await link.getAttribute("href");
								if (href !== null) {
									targets.add(href);
								}
							}
						},
					},
				},
				limiter: new RateLimiter({
					concurrency: options.concurrency,
					limit: 10,
					interval: 1000,
				}),
				prune(url) {
					try {
						return new URL(url).origin !== entrypoint.origin;
					} catch {
						return true;
					}
				},
				pre(page) {
					page.on("response", handler);
				},
				post(page) {
					page.off("response", handler);
				},
			});

			await crawler.stop();
			spinner.succeed("Done crawling");
		},
	);

export { program };
