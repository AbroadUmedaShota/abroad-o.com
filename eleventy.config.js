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
  eleventyConfig.addCollection('newsArticles', (collectionApi) =>
    collectionApi
      .getFilteredByTag('newsArticle')
      .sort((left, right) => right.data.newsOrder.localeCompare(left.data.newsOrder))
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
