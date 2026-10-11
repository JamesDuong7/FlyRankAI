'use strict';

const { getReportData } = require('./report-data');

console.log(JSON.stringify(getReportData(), null, 2));
