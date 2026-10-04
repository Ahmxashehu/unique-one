const SEARCH_SYNONYMS: Record<string, string[]> = {
  tv: ['television'], television: ['tv'],
  phone: ['mobile', 'smartphone'], mobile: ['phone', 'smartphone'], smartphone: ['phone', 'mobile'],
  cement: ['building', 'construction'], rice: ['food', 'groceries'],
  clothes: ['fashion', 'clothing'], clothing: ['fashion', 'clothes'],
  car: ['vehicle', 'vehicles', 'auto'], vehicle: ['car', 'vehicles', 'auto'],
  repair: ['repairs', 'maintenance', 'service'], repairs: ['repair', 'maintenance', 'service'],
  service: ['services'], services: ['service'],
};

const normalizeSearchText = (value: unknown) =>
  String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const expandSearchTerms = (input: string) => {
  const terms = normalizeSearchText(input).split(/\s+/).filter(Boolean);
  return Array.from(new Set(terms.flatMap(term => [term, ...(SEARCH_SYNONYMS[term] || [])])));
};

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
};

const fuzzyTokenMatch = (queryTerm: string, fieldValue: string) => {
  if (!queryTerm || !fieldValue) return false;
  const tokens = fieldValue.split(/\s+/).filter(Boolean);
  return tokens.some(token => {
    if (token.startsWith(queryTerm) || queryTerm.startsWith(token)) return true;
    const maxDistance = queryTerm.length >= 7 ? 2 : queryTerm.length >= 4 ? 1 : 0;
    return maxDistance > 0 && levenshteinDistance(queryTerm, token) <= maxDistance;
  });
};

export const scoreSearchMatch = (input: string, fields: unknown[]) => {
  const queryText = normalizeSearchText(input);
  if (!queryText) return 1;
  const queryTerms = expandSearchTerms(input);
  const fieldText = fields.map(normalizeSearchText).filter(Boolean);
  if (!fieldText.length) return 0;
  const combined = fieldText.join(' ');
  let score = 0;
  if (fieldText.some(value => value === queryText)) score += 600;
  if (fieldText.some(value => value.startsWith(queryText))) score += 360;
  if (combined.includes(queryText)) score += 220;
  for (const term of queryTerms) {
    if (fieldText.some(value => value === term)) score += 140;
    if (fieldText.some(value => value.startsWith(term))) score += 90;
    if (combined.includes(term)) score += 35;
    if (fieldText.some(value => fuzzyTokenMatch(term, value))) score += 45;
  }
  return score;
};

export const normalizeSearchQuery = normalizeSearchText;
