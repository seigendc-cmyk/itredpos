import React, { useMemo, useState } from 'react';
import { Ban, RotateCcw, Search, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

interface ProductSearchCardProps {
  products: Product[];
  branchName: string;
  warehouseName?: string;
  onAddProduct: (product: Product) => void;
  onBlockedProduct: (product: Product) => void;
}

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

function asRecord(product: Product): Record<string, unknown> {
  return product as unknown as Record<string, unknown>;
}

function textMeta(product: Product, key: string): string {
  const value = asRecord(product)[key];
  if (Array.isArray(value)) return value.join(' ');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function productName(product: Product): string {
  return product.productName || product.name;
}

function productSku(product: Product): string {
  return product.sku || product.code;
}

function productPrice(product: Product): number {
  return product.sellingPrice ?? product.price;
}

function productQty(product: Product): number {
  return product.qtyOnHand ?? product.stock;
}

function isLowStock(product: Product): boolean {
  const qty = productQty(product);
  const threshold = product.reorderLevel ?? product.minStock;
  return qty > 0 && qty <= threshold;
}

function stockLabel(product: Product): string {
  const qty = productQty(product);
  if (qty <= 0) return 'Out of Stock';
  if (isLowStock(product)) return 'Low Stock';
  return 'In Stock';
}

function distinct(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export default function ProductSearchCard({
  products,
  branchName,
  warehouseName = 'Main Warehouse',
  onAddProduct,
  onBlockedProduct
}: ProductSearchCardProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [sector, setSector] = useState('ALL');
  const [branch, setBranch] = useState('ALL');
  const [warehouse, setWarehouse] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');

  const categories = useMemo(
    () => distinct(products.map((product) => product.productCategory || product.category)),
    [products]
  );
  const sectors = useMemo(
    () => distinct(products.map((product) => product.industrialSector || textMeta(product, 'sector'))),
    [products]
  );
  const branches = useMemo(
    () => distinct([branchName, ...products.map((product) => product.branch || product.branchId || '')]),
    [branchName, products]
  );
  const warehouses = useMemo(
    () => distinct([warehouseName, ...products.map((product) => product.warehouse || product.warehouseId || '')]),
    [warehouseName, products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const productCategory = product.productCategory || product.category;
      const productSector = product.industrialSector || textMeta(product, 'sector');
      const productBranch = product.branch || product.branchId || branchName;
      const productWarehouse = product.warehouse || product.warehouseId || warehouseName;
      const qty = productQty(product);

      const matchesCategory = category === 'ALL' || productCategory === category;
      const matchesSector = sector === 'ALL' || productSector === sector;
      const matchesBranch = branch === 'ALL' || productBranch === branch;
      const matchesWarehouse = warehouse === 'ALL' || productWarehouse === warehouse;
      const matchesStock =
        stockFilter === 'ALL' ||
        (stockFilter === 'IN_STOCK' && qty > 0 && !isLowStock(product)) ||
        (stockFilter === 'LOW_STOCK' && isLowStock(product)) ||
        (stockFilter === 'OUT_OF_STOCK' && qty <= 0);
      const matchesQuery = matchesFreeOrderSearch(product, query, [
        (item) => productName(item),
        (item) => productSku(item),
        (item) => item.code,
        (item) => item.barcode,
        (item) => item.alu,
        (item) => item.productNumericNumber,
        (item) => item.brand,
        (item) => item.manufacturer,
        (item) => item.supplierName,
        (item) => item.shelfLocation,
        (item) => item.serialNumber,
        (item) => item.industrialSector,
        (item) => item.productCategory,
        (item) => item.productSubCategory,
        (item) => textMeta(item, 'tags'),
        (item) => textMeta(item, 'description'),
        (item) => textMeta(item, 'make'),
        (item) => textMeta(item, 'model'),
        (item) => textMeta(item, 'year'),
        (item) => textMeta(item, 'side')
      ]);

      return matchesCategory && matchesSector && matchesBranch && matchesWarehouse && matchesStock && matchesQuery;
    });
  }, [branch, branchName, category, products, query, sector, stockFilter, warehouse, warehouseName]);

  const clearSearch = () => {
    setQuery('');
    setCategory('ALL');
    setSector('ALL');
    setBranch('ALL');
    setWarehouse('ALL');
    setStockFilter('ALL');
  };

  const handleAdd = (product: Product) => {
    if (productQty(product) <= 0) {
      onBlockedProduct(product);
      return;
    }
    onAddProduct(product);
  };

  return (
    <section className="sci-pos-card pos-product-search-card" aria-labelledby="product-search-title">
      <div className="sci-pos-card__bar">
        <div>
          <p className="sci-pos-eyebrow">Product Search</p>
          <h2 id="product-search-title">Product Search</h2>
        </div>
        <span className="sci-pos-card__count">{filteredProducts.length} results</span>
      </div>

      <div className="pos-search-controls">
        <label className="pos-search-input">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search products</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU, ALU, barcode, brand, shelf, make, model..."
          />
        </label>

        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category filter">
          <option value="ALL">All Categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={sector} onChange={(event) => setSector(event.target.value)} aria-label="Sector filter">
          <option value="ALL">All Sectors</option>
          {sectors.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={branch} onChange={(event) => setBranch(event.target.value)} aria-label="Branch filter">
          <option value="ALL">All Branches</option>
          {branches.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={warehouse} onChange={(event) => setWarehouse(event.target.value)} aria-label="Warehouse filter">
          <option value="ALL">All Warehouses</option>
          {warehouses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)} aria-label="Stock filter">
          <option value="ALL">All Stock</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={clearSearch}>
          <RotateCcw size={16} aria-hidden="true" />
          Clear Search
        </button>
      </div>

      <div className="sci-pos-table-wrap pos-product-results">
        <table className="sci-pos-table">
          <thead>
            <tr>
              <th>Numeric No.</th>
              <th>SKU</th>
              <th>ALU</th>
              <th>Product Name</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Shelf/Location</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const qty = productQty(product);
              const disabled = qty <= 0;
              return (
                <tr
                  key={product.id}
                  className={disabled ? 'is-disabled-row' : undefined}
                  onDoubleClick={() => handleAdd(product)}
                >
                  <td>{product.productNumericNumber || product.id}</td>
                  <td>{productSku(product)}</td>
                  <td>{product.alu || '-'}</td>
                  <td className="sci-pos-table__strong">{productName(product)}</td>
                  <td>{product.brand || product.manufacturer || '-'}</td>
                  <td>{product.productCategory || product.category}</td>
                  <td>{product.shelfLocation || product.binLocation || product.warehouse || '-'}</td>
                  <td>{qty}</td>
                  <td>USD {productPrice(product).toFixed(2)}</td>
                  <td>
                    <span className={`sci-status-pill sci-status-pill--${disabled ? 'danger' : isLowStock(product) ? 'warning' : 'success'}`}>
                      {stockLabel(product)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="sci-pos-icon-button"
                      onClick={() => handleAdd(product)}
                      disabled={disabled}
                      title={disabled ? 'Cannot add product. Stock is not available.' : 'Add product'}
                    >
                      {disabled ? <Ban size={16} aria-hidden="true" /> : <ShoppingCart size={16} aria-hidden="true" />}
                      <span className="sr-only">{disabled ? 'Stock unavailable' : 'Add product'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={11} className="sci-pos-empty-cell">No products match the current search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
