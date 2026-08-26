import { parseFeed } from '@fitcheck/affiliates';
import type { CatalogCategory, Product } from '@fitcheck/affiliates';
import { DEMO_IMAGE_KEYS, FEATURED_PRODUCTS } from './featured';
import { generateProducts } from './generate';

// Every seeded row goes through feed ingestion so the app only ever sees
// schema-valid products; a bad seed fails fast at module init.
const feed = parseFeed([...FEATURED_PRODUCTS, ...generateProducts()]);
if (feed.errors.length > 0) {
  throw new Error(
    `catalog seed failed validation: ${feed.errors.map((e) => `#${e.index}: ${e.message}`).join(' | ')}`,
  );
}

export const products: Product[] = feed.products;

export const categories: { id: CatalogCategory; label: string }[] = [
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'dress', label: 'Dresses' },
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(category: CatalogCategory | 'all'): Product[] {
  if (category === 'all') return [...products];
  return products.filter((p) => p.category === category);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured === true);
}

export { DEMO_IMAGE_KEYS };
