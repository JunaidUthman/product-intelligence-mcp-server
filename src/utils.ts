import { z } from "zod";

// Zod schemas for tool input validation
export const SearchProductsSchema = z.object({
  max_price: z.number().optional(),
  category: z.string().optional(),
  min_rating: z.number().optional(),
  store: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().optional(), // How many results to return (default 10, max 100)
});

// Maps common user terms to database category values
export const CATEGORY_ALIASES: Record<string, string[]> = {
  phones: ["phones", "phone", "mobile", "smartphone", "mobiles"],
  pcs: ["pcs", "pc", "laptop", "laptops", "computer", "computers", "notebook"],
  chargers: ["chargers", "charger", "cable", "cables", "accessory", "accessories", "accessoire"],
};

/**
 * Resolves a user-facing category term (e.g. "laptops") to the DB category
 * values it maps to (e.g. ["pcs"]). Returns an array for use in Prisma `in`.
 */
export function resolveCategoryFilter(userCategory: string): string[] {
  const lower = userCategory.toLowerCase();
  for (const [dbCat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.includes(lower)) {
      return [dbCat];
    }
  }
  // Fallback: pass the raw value through as-is
  return [userCategory];
}

export const GetProductByIdSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
});

