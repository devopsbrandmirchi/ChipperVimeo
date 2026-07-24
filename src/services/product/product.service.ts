import type { Logger } from "@/processors/logger/logger";
import { asJson, stringOrNull } from "@/processors/helpers/payload";
import { BaseService } from "@/services/shared/base.service";
import type { IProductService } from "@/services/interfaces/product-service.interface";
import type { IProductRepository } from "@/services/interfaces/repositories";
import type { Product, ProductUpdate } from "@/types/database";
import type { VimeoProduct } from "@/types/vimeo";

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
}
