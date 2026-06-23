import { Product } from '../types/posTypes';
import { matchesFreeOrderSearch } from '../utils/searchUtils';
import { loadLocalProducts } from '../utils/localProductStore';

export const productService = {
  getProducts: async (): Promise<Product[]> => {
    return loadLocalProducts();
  },

  getProductsByBranch: async (branchId: string): Promise<Product[]> => {
    return loadLocalProducts().filter((product) => !branchId || product.branchId === branchId || product.branch === branchId);
  },

  searchProducts: async (query: string): Promise<Product[]> => {
    return loadLocalProducts().filter((product) => matchesFreeOrderSearch(product, query, [
      'name',
      'code',
      'category',
      'productNumericNumber',
      'sku',
      'barcode',
      'alu',
      'brand',
      'manufacturer',
      'supplierName',
      'shelfLocation',
      'binLocation',
      'serialNumber',
      'industrialSector',
      'productCategory',
      'productSubCategory'
    ]));
  },

  getProductBySku: async (sku: string): Promise<Product | null> => {
    return loadLocalProducts().find((product) => (
      product.code.toLowerCase() === sku.toLowerCase() ||
      product.sku?.toLowerCase() === sku.toLowerCase()
    )) || null;
  }
};
