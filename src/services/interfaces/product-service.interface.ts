import type { Product, ProductUpdate } from "@/types/database";
import type { VimeoProduct } from "@/types/vimeo";

export interface IProductService {
  upsertFromVimeoProduct(
    product: VimeoProduct,
    vimeoProductId: number,
  ): Promise<Product>;
  updatePricing(
    id: string,
    patch: {
      currency?: string | null;
      monthly_price_cents?: number | null;
      yearly_price_cents?: number | null;
      monthly_price_formatted?: string | null;
      yearly_price_formatted?: string | null;
    },
  ): Promise<Product>;
  updateFreeTrial(
    id: string,
    patch: {
      free_trial_enabled?: boolean | null;
      free_trial_days?: number | null;
    },
  ): Promise<Product>;
  updateActiveStatus(id: string, active: boolean | null): Promise<Product>;
  updateMetadata(id: string, patch: ProductUpdate): Promise<Product>;
}
