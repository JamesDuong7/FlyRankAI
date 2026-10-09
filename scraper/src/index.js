'use strict';

const { Fetcher } = require('./fetcher');
const { discover } = require('./catalogue');

if (require.main === module) {
  discover(new Fetcher()).then(({ pages, books, discovered }) => {
    console.log(`catalogue_pages=${pages.length} discovered=${discovered} unique_urls=${books.length}`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
