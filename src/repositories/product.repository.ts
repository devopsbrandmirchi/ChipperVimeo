import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/repositories/base.repository";
import type { Product, ProductInsert, ProductUpdate } from "@/types/database";
import type { ProductSearchOptions } from "@/types/repository";

const TABLE = "products";

export class ProductRepository extends BaseRepository<
  Product,
  ProductInsert,
  ProductUpdate
> {
  constructor(client?: SupabaseClient) {
    super(TABLE, client);
  }

  async findByVimeoProductId(
    vimeoProductId: number,
  ): Promise<Product | null> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("vimeo_product_id", vimeoProductId)
      .maybeSingle();

    if (error) this.throwMapped(error, "findByVimeoProductId");
    return (data as Product | null) ?? null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select("*")
      .eq("sku", sku)
      .maybeSingle();

    if (error) this.throwMapped(error, "findBySku");
    return (data as Product | null) ?? null;
  }

  async upsertByVimeoId(row: ProductInsert): Promise<Product> {
    return this.upsert(row, "vimeo_product_id");
  }

  async findActive(limit = 100): Promise<Product[]> {
    return this.findAll({
      filters: { active: true },
      sortBy: "name",
      sortDirection: "asc",
      limit,
    });
  }

  async findInactive(limit = 100): Promise<Product[]> {
    return this.findAll({
      filters: { active: false },
      sortBy: "name",
      sortDirection: "asc",
      limit,
    });
  }

  async search(options: ProductSearchOptions): Promise<Product[]> {
    const limit = Math.min(options.limit ?? 50, 200);
    let query = this.db().from(TABLE).select("*");

    if (options.sku) {
      query = query.ilike("sku", `%${options.sku}%`);
    }
    if (options.name) {
      query = query.ilike("name", `%${options.name}%`);
    }

    const { data, error } = await query
      .order("name", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) this.throwMapped(error, "search");
    return (data ?? []) as Product[];
  }
}
