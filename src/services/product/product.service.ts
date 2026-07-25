import type { Logger } from "@/processors/logger/logger";
import { asJson, stringOrNull } from "@/processors/helpers/payload";
import { BaseService } from "@/services/shared/base.service";
import type { IProductService } from "@/services/interfaces/product-service.interface";
import type { IProductRepository } from "@/services/interfaces/repositories";
import type { Product, ProductUpdate } from "@/types/database";
import type { VimeoProduct } from "@/types/vimeo";
import type { ProductListFilters, ResourceStatistics } from "@/types/common";
import type { ApiPageRequest, PaginatedResult } from "@/types/pagination";
import { toPaginateOptions } from "@/types/pagination";

export class ProductService extends BaseService implements IProductService {
  constructor(
    private readonly products: IProductRepository,
    logger: Logger,
  ) {
    super("ProductService", logger);
  }

  async upsertFromVimeoProduct(
    product: VimeoProduct,
    vimeoProductId: number,
  ): Promise<Product> {
    return this.timed("upsertFromVimeoProduct", async () => {
      try {
        const purchase = product.price?.purchase;
        const rental = product.price?.rental;
        const monthlyCents =
          typeof purchase?.cents === "number" ? purchase.cents : null;
        const yearlyCents =
          typeof rental?.cents === "number" ? rental.cents : null;

        const activeRaw = product.is_active;
        const active =
          typeof activeRaw === "boolean"
            ? activeRaw
            : typeof activeRaw === "string"
              ? activeRaw.toLowerCase() === "true" || activeRaw === "1"
              : null;

        return await this.products.upsertByVimeoId({
          vimeo_product_id: vimeoProductId,
          name: stringOrNull(product.name),
          description: stringOrNull(product.description),
          currency:
            stringOrNull(purchase?.currency) ??
            stringOrNull(rental?.currency),
          monthly_price_cents: monthlyCents,
          yearly_price_cents: yearlyCents,
          monthly_price_formatted: stringOrNull(purchase?.formatted),
          yearly_price_formatted: stringOrNull(rental?.formatted),
          active,
          product_created_at: stringOrNull(product.created_at),
          product_updated_at: stringOrNull(product.updated_at),
          raw_product: asJson(product),
        });
      } catch (error) {
        this.mapRepositoryError(error, "upsertFromVimeoProduct");
      }
    });
  }

  async updatePricing(
    id: string,
    patch: {
      currency?: string | null;
      monthly_price_cents?: number | null;
      yearly_price_cents?: number | null;
      monthly_price_formatted?: string | null;
      yearly_price_formatted?: string | null;
    },
  ): Promise<Product> {
    return this.updateMetadata(id, patch);
  }

  async updateFreeTrial(
    id: string,
    patch: {
      free_trial_enabled?: boolean | null;
      free_trial_days?: number | null;
    },
  ): Promise<Product> {
    return this.updateMetadata(id, patch);
  }

  async updateActiveStatus(
    id: string,
    active: boolean | null,
  ): Promise<Product> {
    return this.updateMetadata(id, { active });
  }

  async updateMetadata(id: string, patch: ProductUpdate): Promise<Product> {
    return this.timed("updateMetadata", async () => {
      try {
        return await this.products.update(id, patch);
      } catch (error) {
        this.mapRepositoryError(error, "updateMetadata");
      }
    });
  }

  async getById(id: string): Promise<Product> {
    return this.timed("getById", async () => {
      try {
        const row = await this.products.findById(id);
        return this.requireFound(row, "product", id);
      } catch (error) {
        this.mapRepositoryError(error, "getById");
      }
    });
  }

  async list(
    filters: ProductListFilters = {},
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<Product>> {
    return this.timed("list", async () => {
      try {
        if (filters.search || filters.name || filters.sku) {
          return this.search(filters, page);
        }
        if (filters.active === true) {
          const items = await this.products.findActive(200);
          return this.paginateCandidates(items, page);
        }
        if (filters.active === false) {
          const items = await this.products.findInactive(200);
          return this.paginateCandidates(items, page);
        }
        return await this.products.paginate({
          ...toPaginateOptions(page, "created_at"),
        });
      } catch (error) {
        this.mapRepositoryError(error, "list");
      }
    });
  }

  async search(
    filters: ProductListFilters,
    page: ApiPageRequest = {},
  ): Promise<PaginatedResult<Product>> {
    return this.timed("search", async () => {
      try {
        const candidates = await this.products.search({
          sku: filters.sku,
          name: filters.search ?? filters.name,
          limit: 200,
        });
        let filtered = candidates;
        if (filters.active !== undefined) {
          filtered = filtered.filter((p) => p.active === filters.active);
        }
        return this.paginateCandidates(filtered, page);
      } catch (error) {
        this.mapRepositoryError(error, "search");
      }
    });
  }

  async getStatistics(): Promise<ResourceStatistics> {
    return this.timed("getStatistics", async () => {
      try {
        const total = await this.products.count();
        const active = await this.products.count({ active: true });
        const inactive = await this.products.count({ active: false });
        return {
          total,
          byStatus: { active, inactive },
        };
      } catch (error) {
        this.mapRepositoryError(error, "getStatistics");
      }
    });
  }
}
