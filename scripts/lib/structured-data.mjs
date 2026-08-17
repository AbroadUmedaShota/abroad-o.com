const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function reference(id) {
  return { '@id': id };
}

function organization(site) {
  return {
    '@type': 'Organization',
    '@id': site.organizationId,
    name: site.name,
    legalName: site.legalName,
    url: `${site.origin}/`,
    logo: {
      '@type': 'ImageObject',
      url: site.logoUrl
    },
    address: {
      '@type': 'PostalAddress',
      ...site.address
    },
    telephone: site.telephone,
    email: site.email
  };
}

function website(site) {
  return {
    '@type': 'WebSite',
    '@id': site.websiteId,
    url: `${site.origin}/`,
    name: site.name,
    inLanguage: site.language,
    publisher: reference(site.organizationId)
  };
}

export function assertStructuredDataSource(data) {
  if (data.noindex === true) return;
  for (const field of ['title', 'description', 'canonicalUrl']) {
    if (!data[field]) throw new Error(`Structured data source is missing ${field}`);
  }
  if (data.schemaType === 'NewsArticle') {
    if (!ISO_DATE.test(data.datePublished || '')) throw new Error('NewsArticle requires an ISO datePublished');
    if (data.dateModified && !ISO_DATE.test(data.dateModified)) throw new Error('NewsArticle dateModified must be an ISO date');
  }
  if (data.schemaType === 'Service' && !data.serviceType) {
    throw new Error('Service requires serviceType');
  }
}

export function buildStructuredData(data) {
  if (data.noindex === true || !data.canonicalUrl) return null;
  assertStructuredDataSource(data);
  const site = data.site;
  if (!site?.organizationId || !site?.websiteId) throw new Error('Site structured data configuration is missing');

  const pageId = `${data.canonicalUrl}#webpage`;
  const pageNode = {
    '@type': 'WebPage',
    '@id': pageId,
    url: data.canonicalUrl,
    name: data.title,
    description: data.description,
    inLanguage: site.language,
    isPartOf: reference(site.websiteId)
  };
  const graph = [pageNode];

  if (data.schemaType === 'HomePage') {
    graph.unshift(organization(site), website(site));
    pageNode.about = reference(site.organizationId);
  } else if (data.schemaType === 'Service') {
    const serviceId = `${data.canonicalUrl}#service`;
    pageNode.mainEntity = reference(serviceId);
    graph.push({
      '@type': 'Service',
      '@id': serviceId,
      url: data.canonicalUrl,
      name: data.serviceType,
      description: data.description,
      serviceType: data.serviceType,
      areaServed: 'JP',
      provider: reference(site.organizationId)
    });
  } else if (data.schemaType === 'ServiceList') {
    const listId = `${data.canonicalUrl}#service-list`;
    pageNode.mainEntity = reference(listId);
    graph.push({
      '@type': 'ItemList',
      '@id': listId,
      name: 'サービス一覧',
      itemListElement: site.serviceItems.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url
      }))
    });
  } else if (data.schemaType === 'NewsArticle') {
    const articleId = `${data.canonicalUrl}#article`;
    pageNode.mainEntity = reference(articleId);
    const article = {
      '@type': 'NewsArticle',
      '@id': articleId,
      headline: data.summaryTitle || data.title,
      description: data.description,
      datePublished: data.datePublished,
      mainEntityOfPage: reference(pageId),
      author: reference(site.organizationId),
      publisher: reference(site.organizationId)
    };
    if (data.dateModified) article.dateModified = data.dateModified;
    if (data.schemaImage) article.image = data.schemaImage;
    graph.push(article);
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

export function serializeStructuredData(data) {
  const graph = buildStructuredData(data);
  if (!graph) return '';
  return JSON.stringify(graph)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

export function validateStructuredData(graph, source) {
  if (!graph || graph['@context'] !== 'https://schema.org' || !Array.isArray(graph['@graph'])) {
    throw new Error('Invalid JSON-LD graph');
  }
  const nodes = graph['@graph'];
  const page = nodes.find((node) => node['@type'] === 'WebPage');
  if (!page || page['@id'] !== `${source.canonicalUrl}#webpage` || page.url !== source.canonicalUrl || page.name !== source.title || page.description !== source.description || page.inLanguage !== 'ja') {
    throw new Error('WebPage does not match the canonical metadata');
  }
  const serviceNodes = nodes.filter((node) => node['@type'] === 'Service');
  if (source.schemaType !== 'Service' && serviceNodes.length) throw new Error('Unrelated Service structured data');
  if (source.schemaType === 'Service' && (serviceNodes.length !== 1 || serviceNodes[0].serviceType !== source.serviceType || serviceNodes[0].areaServed !== 'JP')) {
    throw new Error('Service structured data does not match its source');
  }
  const articles = nodes.filter((node) => node['@type'] === 'NewsArticle');
  if (source.schemaType === 'NewsArticle') {
    if (articles.length !== 1 || articles[0].datePublished !== source.datePublished) throw new Error('NewsArticle datePublished does not match its source');
    if (articles[0].dateModified !== source.dateModified) throw new Error('NewsArticle dateModified was invented or omitted');
  } else if (articles.length) {
    throw new Error('Unrelated NewsArticle structured data');
  }
  for (const forbiddenType of ['BreadcrumbList', 'FAQPage', 'Review']) {
    if (nodes.some((node) => node['@type'] === forbiddenType)) throw new Error(`Unsupported structured data type: ${forbiddenType}`);
  }
}

export function assertUniqueSearchMetadata(pages) {
  for (const field of ['title', 'description']) {
    const values = new Map();
    for (const page of pages) {
      const prior = values.get(page[field]);
      if (prior) throw new Error(`Duplicate ${field}: ${prior} and ${page.canonicalUrl}`);
      values.set(page[field], page.canonicalUrl);
    }
  }
}

export function assertRobotsPolicy(robots) {
  const expected = [
    'User-agent: GPTBot',
    'Disallow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: *',
    'Disallow:',
    '',
    'Sitemap: https://www.abroad-o.com/sitemap.xml'
  ].join('\n');
  if (robots.replaceAll('\r\n', '\n').trimEnd() !== expected) throw new Error('robots.txt SEO/AIO policy mismatch');
}
