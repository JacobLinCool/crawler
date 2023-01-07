import type { LaunchOptions, Page, BrowserContextOptions } from "playwright-core";
import type { RateLimiter } from "@jacoblincool/rate-limiter";

export interface CrawlerOptions {
	browser: "chromium" | "firefox" | "webkit";
	options?: LaunchOptions;
}

export interface CrawlerStrategy<A extends { [key: string]: CrawlerActor<unknown> }> {
	/** An absolute URL, the entry point. */
	entry: string;
	/** The maximum depth. */
	depth: number;
	/** The actors that will be used to crawl. */
	actors: A;
	/** The rate limiter to use, including concurrency control. */
	limiter?: RateLimiter;
	/** Pre-pruning function. Return `true` to skip crawling a URL before it is loaded. */
	prune?: (url: string) => boolean;
	/** Do something to the page before a task is run. */
	pre?: (page: Page) => void | Promise<void>;
	/** Do something to the page after a task is run. */
	post?: (page: Page) => void | Promise<void>;
	/** Do something to the page when it is created. */
	init?: (page: Page) => void | Promise<void>;
	/** The context options to use. */
	context?: BrowserContextOptions;
}

export type CrawlerResult<A extends { [key: string]: CrawlerActor<unknown> }> = {
	[key in keyof A]: Map<string, Awaited<ReturnType<A[key]["action"]>>>;
};

export type CrawlerAction<T> = ({
	page,
	targets,
	path,
}: {
	/** The current page. */
	page: Page;
	/** The bucket of targets that should be crawled in the next iteration. */
	targets: Set<string>;
	/** The path that was taken to get to this page. */
	path: string[];
}) => Promise<T>;

export interface CrawlerActor<T> {
	/** The URL matcher to use to determine if the actor should be triggered on a page. */
	match: RegExp;

	/** The function that will be called when the actor is triggered. */
	action: CrawlerAction<T>;
}
