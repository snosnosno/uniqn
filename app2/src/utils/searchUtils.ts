// Search utility functions for job postings

/**
 * Generate search index from title and description
 * Converts text to lowercase and splits into searchable keywords
 */
export const generateSearchIndex = (title: string, description: string): string[] => {
  const text = `${title} ${description}`.toLowerCase();
  // Remove special characters and split by whitespace
  const words = text
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1); // Filter out single characters

  // Remove duplicates
  return Array.from(new Set(words));
};

/**
 * Prepare search terms from user input
 * Splits search query into individual terms
 */
export const prepareSearchTerms = (searchQuery: string): string[] => {
  if (!searchQuery.trim()) return [];

  return searchQuery
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 1); // Filter out single characters
};

/**
 * Highlight search terms in text
 * Returns text with highlighted search terms wrapped in <mark> tags
 */
export const highlightSearchTerms = (text: string, searchTerms: string[]): string => {
  if (!searchTerms.length) return text;

  let highlightedText = text;
  searchTerms.forEach((term) => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  });

  return highlightedText;
};

/**
 * Check if any search terms match the search index
 * Used for client-side filtering as backup
 */
export const matchesSearchTerms = (searchIndex: string[], searchTerms: string[]): boolean => {
  if (!searchTerms.length) return true;

  return searchTerms.some((term) => searchIndex.some((indexTerm) => indexTerm.includes(term)));
};
