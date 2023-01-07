import type { Page } from "playwright-core";

export async function hyperlinks(page: Page): Promise<string[]> {
	const locators = await page.getByRole("link").all();
	const links = await Promise.all(locators.map((locator) => locator.getAttribute("href")));
	return links.filter((link) => link !== null) as string[];
}
