import { serializeStructuredData } from './scripts/lib/structured-data.mjs';

export default function (eleventyConfig) {
  for (const path of [
    '.htaccess',
    'css',
    'fonts',
    'image',
    'js',
    { 'pdfjs/1c_abroad.pdf': 'pdfjs/1c_abroad.pdf' },
    { 'pdfjs/2c_abroad.pdf': 'pdfjs/2c_abroad.pdf' },
    { 'pdfjs/4c_abroad.pdf': 'pdfjs/4c_abroad.pdf' },
    'slick',
    'global.css',
    'style.css',
    'style2.css',
    'style3.css'
  ]) {
    eleventyConfig.addPassthroughCopy(path);
  }
  eleventyConfig.addPassthroughCopy({
    'node_modules/@fontsource/crimson-text/files/crimson-text-latin-400-normal.woff2': 'fonts/google/crimson-text-latin-400-normal.woff2',
    'node_modules/@fontsource/crimson-text/LICENSE': 'fonts/google/crimson-text-OFL.txt',
    'node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2': 'fonts/google/roboto-latin-400-normal.woff2',
    'node_modules/@fontsource/roboto/files/roboto-latin-500-normal.woff2': 'fonts/google/roboto-latin-500-normal.woff2',
    'node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2': 'fonts/google/roboto-latin-700-normal.woff2',
    'node_modules/@fontsource/roboto/LICENSE': 'fonts/google/roboto-OFL.txt',
    'node_modules/bootstrap/dist/css/bootstrap.min.css': 'vendor/bootstrap/bootstrap.min.css',
    'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js': 'vendor/bootstrap/bootstrap.bundle.min.js',
    'node_modules/bootstrap/LICENSE': 'vendor/bootstrap/LICENSE',
    'node_modules/@popperjs/core/LICENSE.md': 'vendor/bootstrap/POPPER-LICENSE.txt',
    'node_modules/jquery/dist/jquery.min.js': 'vendor/jquery/jquery.min.js',
    'node_modules/jquery/LICENSE.txt': 'vendor/jquery/LICENSE.txt'
  });
  eleventyConfig.addPassthroughCopy({
    'node_modules/bootstrap3/dist/css/bootstrap.min.css': 'vendor/bootstrap3/css/bootstrap.min.css',
    'node_modules/bootstrap3/dist/js/bootstrap.min.js': 'vendor/bootstrap3/js/bootstrap.min.js',
    'node_modules/bootstrap3/fonts': 'vendor/bootstrap3/fonts',
    'node_modules/bootstrap3/LICENSE': 'vendor/bootstrap3/LICENSE',
    'node_modules/@fortawesome/fontawesome-free/css/all.min.css': 'vendor/fontawesome/css/all.min.css',
    'node_modules/@fortawesome/fontawesome-free/css/v4-shims.min.css': 'vendor/fontawesome/css/v4-shims.min.css',
    'node_modules/@fortawesome/fontawesome-free/webfonts': 'vendor/fontawesome/webfonts',
    'node_modules/@fortawesome/fontawesome-free/LICENSE.txt': 'vendor/fontawesome/LICENSE.txt',
    'node_modules/lightbox2/dist/css/lightbox.min.css': 'vendor/lightbox2/css/lightbox.min.css',
    'node_modules/lightbox2/dist/js/lightbox.min.js': 'vendor/lightbox2/js/lightbox.min.js',
    'node_modules/lightbox2/dist/images': 'vendor/lightbox2/images',
    'node_modules/lightbox2/LICENSE': 'vendor/lightbox2/LICENSE'
  });
  eleventyConfig.addCollection('newsArticles', (collectionApi) =>
    collectionApi
      .getFilteredByTag('newsArticle')
      .sort((left, right) => right.data.newsOrder.localeCompare(left.data.newsOrder))
  );
  eleventyConfig.addGlobalData('eleventyComputed.structuredData', () =>
    (data) => serializeStructuredData(data)
  );

  return {
    dir: {
      input: 'site',
      includes: '_includes',
      output: '_site'
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: false,
    templateFormats: ['njk']
  };
}
