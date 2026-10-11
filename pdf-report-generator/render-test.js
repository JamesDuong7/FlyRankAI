'use strict';

const path = require('node:path');
const { getReportData } = require('./report-data');
const { renderPdf } = require('./render');

const output = path.join(__dirname, 'reports', 'test.pdf');
renderPdf(getReportData(), output)
  .then(() => console.log(`Rendered ${output}`))
  .catch((error) => { console.error(error); process.exitCode = 1; });
