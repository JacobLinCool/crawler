import os from "node:os";
import { RateLimiter } from "@jacoblincool/rate-limiter";
import EventEmitter from "eventemitter3";
import type { Browser, Page } from "playwright-core";
import * as pw from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { CrawlerActor, CrawlerOptions, CrawlerStrategy, CrawlerResult } from "./types";

export class Crawler extends EventEmitter {
	protected options: CrawlerOptions;
	protected _browser: Promise<Browser> | null = null;

	constructor(options?: Partial<CrawlerOptions>) {
		super();

		this.options = {
			browser: "chromium",
			...options,
		};
	}

	public async start<A extends { [key: string]: CrawlerActor<unknown> }>(
		strategy: CrawlerStrategy<A>,
	): Promise<CrawlerResult<A>> {
		const limiter =
			strategy.limiter ??
			new RateLimiter({ concurrency: os.cpus().length, limit: 10, interval: 1000 });
		const actors = Object.entries(strategy.actors);

		const browser = await this.browser;
		const ctx = await browser.newContext();
		const pages = await Promise.all(
			Array.from({ length: limiter.space }).map(() => ctx.newPage()),
		);

		const results = {} as any;

		const visited = new Set<string>([strategy.entry]);
		const next: [path: string[], targets: string[]][] = [[[], [strategy.entry]]];

		const crawl = async (page: Page, url: string, path: string[]) => {
			this.emit("page-start", { page, url, path });
			if (strategy.pre) {
				await strategy.pre(page);
			}
			await page.goto(url);
			const resolved_url = page.url();

			const targets = new Set<string>();

			for (const [key, actor] of actors) {
				if (actor.match.test(resolved_url)) {
					this.emit("actor-triggered", { page, url, path, actor: key });
					const result = await actor.action({ page, targets, path });
					if (results[key] === undefined) {
						results[key] = new Map();
					}
					results[key].set(resolved_url, result);
				}
			}

			if (strategy.post) {
				await strategy.post(page);
			}

			if (path.length < strategy.depth) {
				const normalized = [...targets]
					.map((url) => new URL(url, resolved_url))
					.filter((url) => url.protocol === "http:" || url.protocol === "https:")
					.map((url) => url.href);
				const unvisited = normalized.filter((url) => !visited.has(url));
				if (unvisited.length > 0) {
					next.push([[...path, resolved_url], unvisited]);
					unvisited.forEach((url) => visited.add(url));
				}
			}
			this.emit("page-done", { page, url, path });
		};

		let finalize: () => void;
		const finalized = new Promise<void>((resolve) => (finalize = resolve));
		let [running, done] = [0, 0];
		const run = async () => {
			if (next.length > 0) {
				const [path, targets] = next.shift()!;

				for (const url of targets) {
					running++;
					if (typeof strategy.prune === "function" && strategy.prune(url)) {
						done++;
						if (next.length === 0 && done === running) {
							finalize();
						}
						continue;
					}
					await limiter.lock();
					const page = pages.shift()!;
					crawl(page, url, path)
						.catch((err) => this.emit("warning", err))
						.finally(() => {
							pages.push(page);
							limiter.unlock();
							done++;
							if (next.length === 0 && done === running) {
								finalize();
							}
							run();
						});
				}
			}
		};
		run();

		await finalized;
		await ctx.close();

		return results;
	}

	protected get browser() {
		if (this._browser === null) {
			const browser = pw[this.options.browser];
			browser.use(StealthPlugin());
			this._browser = browser.launch(this.options.options);
		}

		return this._browser;
	}

	public async stop() {
		if (this._browser !== null) {
			const browser = await this._browser;
			this._browser = null;
			await browser.close();
		}
	}

	public on(
		event: "page-start",
		listener: (data: { page: Page; url: string; path: string[] }) => void,
	): this;
	public on(
		event: "page-done",
		listener: (data: { page: Page; url: string; path: string[] }) => void,
	): this;
	public on(
		event: "actor-triggered",
		listener: (data: { page: Page; url: string; path: string[]; actor: string }) => void,
	): this;
	public on(event: "warning", listener: (err: Error) => void): this;
	public on(event: string, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}

	public once(
		event: "page-start",
		listener: (data: { page: Page; url: string; path: string[] }) => void,
	): this;
	public once(
		event: "page-done",
		listener: (data: { page: Page; url: string; path: string[] }) => void,
	): this;
	public once(
		event: "actor-triggered",
		listener: (data: { page: Page; url: string; path: string[]; actor: string }) => void,
	): this;
	public once(event: "warning", listener: (err: Error) => void): this;
	public once(event: string, listener: (...args: any[]) => void): this {
		return super.once(event, listener);
	}

	public off(
		event: "page-start",
		listener: (data: { page: Page; url: string; path: string[] }) => void,
	): this;
	public off(
		event: "page-done",
		listener: (data: { page: Page; url: string; path: string[] }) => void,
	): this;
	public off(
		event: "actor-triggered",
		listener: (data: { page: Page; url: string; path: string[]; actor: string }) => void,
	): this;
	public off(event: "warning", listener: (err: Error) => void): this;
	public off(event: string, listener: (...args: any[]) => void): this {
		return super.off(event, listener);
	}

	public emit(event: "page-start", data: { page: Page; url: string; path: string[] }): boolean;
	public emit(event: "page-done", data: { page: Page; url: string; path: string[] }): boolean;
	public emit(
		event: "actor-triggered",
		data: { page: Page; url: string; path: string[]; actor: string },
	): boolean;
	public emit(event: "warning", err: Error): boolean;
	public emit(event: string, ...args: any[]): boolean {
		return super.emit(event, ...args);
	}
}
