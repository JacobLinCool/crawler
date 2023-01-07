# Jacob's Crawler

## CLI Version

You can try the CLI version by installing the package globally:

```bash
pnpm i -g @jacoblincool/crawler-cli
```

Then you can run the crawler with the following command:

```bash
crawler --depth 3 https://jacoblin.cool/
```

It will dump the whole website into a directory named `jacoblin.cool` in the current working directory.

## Library Version

You can also use the library version in your own project:

```bash
pnpm i @jacoblincool/crawler
```

Then you can use it in your code:

```ts
import { Crawler } from "@jacoblincool/crawler";

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
    await crawler.stop();
})();
```

```ts
// console.log(result):
{
  images: Map(17) {
    'https://jacoblin.cool/' => [ '/logo.png' ],
    'https://jacoblin.cool/about' => [ '/logo.png' ],
    'https://jacoblin.cool/contact' => [ '/logo.png' ],
    'https://jacoblin.cool/blog' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/post/2022-12-26-2022-csie-mid-fair' => [ '/logo.png', 'https://i.imgur.com/a13S49l.png' ],
    'https://jacoblin.cool/blog/post/2022-12-25-christmas-short-trip' => [ '/logo.png', 'https://i.imgur.com/61taETM.jpg' ],
    'https://jacoblin.cool/blog/post/2022-12-25-new-blog' => [ '/logo.png', 'https://i.imgur.com/JMha02S.png' ],
    'https://jacoblin.cool/blog/tag/university' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/unicourse' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/travel' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/ntnu' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/school' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/project' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/christmas' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/sveltekit' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/svelte' => [ '/logo.png' ],
    'https://jacoblin.cool/blog/tag/web' => [ '/logo.png' ]
  }
}
```
