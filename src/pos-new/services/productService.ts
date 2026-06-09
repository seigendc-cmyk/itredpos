import { Product } from '../types/posTypes';
import { mockProducts } from '../mock/mockPosData';

export const productService = {
  getProducts: async (): Promise<Product[]> => {
    return mockProducts;
  },

  getProductsByBranch: async (branchId: string): Promise<Product[]> => {
    // In low-fidelity local mock, return all parts
    return mockProducts;
  },

  searchProducts: async (query: string): Promise<Product[]> => {
    const term = query.toLowerCase();
    return mockProducts.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.code.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  },

  getProductBySku: async (sku: string): Promise<Product | null> => {
    return mockProducts.find(p => p.code.toLowerCase() === sku.toLowerCase()) || null;
  }
};
