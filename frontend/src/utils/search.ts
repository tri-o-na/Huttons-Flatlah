export type PropertiesSearchFilters = {
  q?: string;
  flatType?: string;
  town?: string;
  minPrice?: string;
  maxPrice?: string;
  storeyRange?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
};

export function buildPropertiesSearchParams(filters: PropertiesSearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', filters.q);
  if (filters.flatType) params.set('flatType', filters.flatType);
  if (filters.town) params.set('town', filters.town);
  if (filters.minPrice) params.set('minPrice', filters.minPrice);
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
  if (filters.storeyRange) params.set('storeyRange', filters.storeyRange);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (typeof filters.page === 'number') params.set('page', String(filters.page));
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));

  return params;
}
