import { HelpArticle, helpArticles } from './helpDeskContent';

export interface HelpSearchFilters {
  chapter?: string;
  relationshipGroup?: string;
}

export function normalizeHelpSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function articleSearchText(article: HelpArticle): string {
  return normalizeHelpSearchText([
    article.title,
    article.chapter,
    article.relationshipGroup,
    article.summary,
    article.bodySections.map((section) => `${section.heading} ${section.text}`).join(' '),
    article.steps.join(' '),
    article.bestPractices.join(' '),
    article.warnings.join(' '),
    article.relatedMenus.join(' '),
    article.relatedFunctions.map((item) => `${item.label} ${item.description} ${item.targetPage} ${item.targetTab || ''} ${item.targetAction || ''}`).join(' '),
    article.relatedArticles.join(' '),
    article.tags.join(' '),
    article.searchKeywords.join(' '),
    article.buildModeNote || ''
  ].join(' '));
}

export function matchesAnyOrderHelpSearch(article: HelpArticle, query: string): boolean {
  const terms = normalizeHelpSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = articleSearchText(article);
  return terms.every((term) => haystack.includes(term));
}

export function searchHelpArticles(
  articles: HelpArticle[],
  query: string,
  filters: HelpSearchFilters = {}
): HelpArticle[] {
  return articles
    .filter((article) => !filters.chapter || filters.chapter === 'All' || article.chapter === filters.chapter)
    .filter((article) => !filters.relationshipGroup || filters.relationshipGroup === 'All' || article.relationshipGroup === filters.relationshipGroup)
    .filter((article) => matchesAnyOrderHelpSearch(article, query))
    .sort((a, b) => {
      const normalizedQuery = normalizeHelpSearchText(query);
      if (!normalizedQuery) return a.title.localeCompare(b.title);
      const aTitle = normalizeHelpSearchText(a.title).includes(normalizedQuery) ? 0 : 1;
      const bTitle = normalizeHelpSearchText(b.title).includes(normalizedQuery) ? 0 : 1;
      return aTitle - bTitle || a.title.localeCompare(b.title);
    });
}

export function getRelatedHelpArticles(articleId: string): HelpArticle[] {
  const article = getHelpArticleById(articleId);
  if (!article) return [];
  const explicit = article.relatedArticles
    .map((id) => getHelpArticleById(id))
    .filter((row): row is HelpArticle => Boolean(row));
  const implicit = helpArticles
    .filter((candidate) => candidate.articleId !== articleId)
    .filter((candidate) => candidate.relationshipGroup === article.relationshipGroup || candidate.relatedMenus.some((menu) => article.relatedMenus.includes(menu)))
    .slice(0, 6);
  return Array.from(new Map([...explicit, ...implicit].map((row) => [row.articleId, row])).values()).slice(0, 8);
}

export function getHelpArticleById(articleId: string): HelpArticle | undefined {
  return helpArticles.find((article) => article.articleId === articleId);
}
