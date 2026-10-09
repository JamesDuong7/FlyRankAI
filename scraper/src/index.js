'use strict';

const { Fetcher } = require('./fetcher');
const { discover } = require('./catalogue');
const { extractBook } = require('./book');

if (require.main === module) {
  const fetcher = new Fetcher();
  discover(fetcher).then(async ({ pages, books, discovered }) => {
    console.log(`catalogue_pages=${pages.length} discovered=${discovered} unique_urls=${books.length}`);
    const records = [];
    for (const book of books) {
      const { html, fetchedAt } = await fetcher.get(book.productUrl);
      records.push(extractBook(html, book, fetchedAt));
    }
    console.log(JSON.stringify(records[0], null, 2));
    console.log(`detail_pages=${records.length}`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
