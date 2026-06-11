import { Product } from '../types/posTypes';
import { mockProducts } from '../mock/mockPosData';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

export const productService = {
  getProducts: async (): Promise<Product[]> => {
    return mockProducts;
  },

  getProductsByBranch: async (branchId: string): Promise<Product[]> => {
    // In low-fidelity local mock, return all parts
    return mockProducts;
  },

  searchProducts: async (query: string): Promise<Product[]> => {
    return mockProducts.filter((product) => matchesFreeOrderSearch(product, query, [
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
    return mockProducts.find(p => p.code.toLowerCase() === sku.toLowerCase()) || null;
  }
};
