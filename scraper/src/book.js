'use strict';

const cheerio = require('cheerio');

const collapse = (value) => value.replace(/\s+/g, ' ').trim();

function extractBook(html, { productUrl, sourcePage }, fetchedAt) {
  const $ = cheerio.load(html);
  const product = $('.product_main').first();
  const ratingClasses = (product.find('p.star-rating').attr('class') || '').split(/\s+/);
  const ratingText = ratingClasses.find((name) => ['One', 'Two', 'Three', 'Four', 'Five'].includes(name)) || null;
  const description = $('#product_description').next('p').first().text();
  return {
    title: collapse(product.find('h1').first().text()),
    product_url: productUrl,
    price_text: collapse(product.find('p.price_color').first().text()),
    availability_text: collapse(product.find('p.instock.availability').first().text()),
    rating_text: ratingText,
    description: description ? collapse(description) : null,
    source_page: sourcePage,
    fetched_at: fetchedAt,
  };
}

module.exports = { extractBook };
