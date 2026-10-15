import test from "node:test";
import assert from "node:assert/strict";
import { resolveCategoryFilter, SearchProductsSchema, GetProductByIdSchema } from "../dist/utils.js";

test("Category alias resolution", async (t) => {
  await t.test("maps phone aliases to phones", () => {
    assert.deepEqual(resolveCategoryFilter("phone"), ["phones"]);
    assert.deepEqual(resolveCategoryFilter("smartphone"), ["phones"]);
    assert.deepEqual(resolveCategoryFilter("Mobiles"), ["phones"]);
  });

  await t.test("maps laptop and PC aliases to pcs", () => {
    assert.deepEqual(resolveCategoryFilter("laptop"), ["pcs"]);
    assert.deepEqual(resolveCategoryFilter("Laptops"), ["pcs"]);
    assert.deepEqual(resolveCategoryFilter("computer"), ["pcs"]);
  });

  await t.test("maps charger and accessory aliases to chargers", () => {
    assert.deepEqual(resolveCategoryFilter("charger"), ["chargers"]);
    assert.deepEqual(resolveCategoryFilter("cable"), ["chargers"]);
    assert.deepEqual(resolveCategoryFilter("accessory"), ["chargers"]);
  });

  await t.test("passes through unknown categories", () => {
    assert.deepEqual(resolveCategoryFilter("furniture"), ["furniture"]);
  });
});

test("SearchProductsSchema validation", async (t) => {
  await t.test("validates valid search params", () => {
    const valid = {
      max_price: 150,
      category: "pcs",
      min_rating: 4.0,
      store: "ShopifyStore",
      query: "dell",
      limit: 20
    };
    const parsed = SearchProductsSchema.parse(valid);
    assert.equal(parsed.max_price, 150);
    assert.equal(parsed.category, "pcs");
    assert.equal(parsed.limit, 20);
  });

  await t.test("fails on invalid price type", () => {
    assert.throws(() => {
      SearchProductsSchema.parse({ max_price: "not-a-number" });
    });
  });
});

test("GetProductByIdSchema validation", async (t) => {
  await t.test("accepts numeric and string product_id", () => {
    assert.equal(GetProductByIdSchema.parse({ product_id: 42 }).product_id, 42);
    assert.equal(GetProductByIdSchema.parse({ product_id: "42" }).product_id, "42");
  });

  await t.test("fails on missing or invalid product_id", () => {
    assert.throws(() => {
      GetProductByIdSchema.parse({});
    });
    assert.throws(() => {
      GetProductByIdSchema.parse({ product_id: {} });
    });
  });
});

