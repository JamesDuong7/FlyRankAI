'use strict';

const { Fetcher, BASE_URL } = require('./fetcher');

if (require.main === module) {
  new Fetcher().get(BASE_URL).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
