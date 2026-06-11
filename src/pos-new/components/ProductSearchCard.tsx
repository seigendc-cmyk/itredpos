import React, { useMemo, useState } from 'react';
import { LayoutGrid, List, RotateCcw, Search, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

interface ProductSearchCardProps {
  products: Product[];
  branchName: string;
  warehouseName?: string;
  onAddProduct: (product: Product) => void;
  onBlockedProduct?: (product: Product) => void;
  onBlockedStockAttempt?: (product: Product) => void;
}

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
type ViewMode = 'list' | 'grid';
type QuickCategory = 'ALL' | 'Motor Spares' | 'Hardware' | 'Grocery' | 'Agriculture' | 'Clothing' | 'Furniture' | 'Electronics' | 'Lubricants';
type ProductFieldKey =
  | 'sku'
  | 'productName'
  | 'brand'
  | 'manufacturer'
  | 'supplier'
  | 'shelf'
  | 'qty'
  | 'price'
  | 'stockStatus'
  | 'sector'
  | 'category'
  | 'alu'
  | 'productNo'
  | 'barcode';

interface ProductFieldConfig {
  key: ProductFieldKey;
  label: string;
  className?: string;
  value: (product: Product) => string;
}

const VIEW_MODE_KEY = 'itredpos.sales.productViewMode';
const VISIBLE_FIELDS_KEY = 'itredpos.sales.productVisibleFields';
const defaultVisibleFields: ProductFieldKey[] = ['sku', 'productName', 'brand', 'shelf', 'qty', 'price', 'stockStatus'];

const quickCategories: QuickCategory[] = [
  'ALL',
  'Motor Spares',
  'Hardware',
  'Grocery',
  'Agriculture',
  'Clothing',
  'Furniture',
  'Electronics',
  'Lubricants'
];

function readStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    return stored === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function readStoredFields(): ProductFieldKey[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISIBLE_FIELDS_KEY) || '[]') as ProductFieldKey[];
    const allowed = new Set<ProductFieldKey>(fieldConfigs.map((field) => field.key));
    const clean = parsed.filter((field) => allowed.has(field));
    return clean.length > 0 ? clean : defaultVisibleFields;
  } catch {
    return defaultVisibleFields;
  }
}

function savePreference(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Preference persistence is optional.
  }
}

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

function productShelf(product: Product): string {
  return product.shelfLocation || product.binLocation || '-';
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

const fieldConfigs: ProductFieldConfig[] = [
  { key: 'sku', label: 'SKU', className: 'pos-field-sku', value: productSku },
  { key: 'productName', label: 'Product Name', className: 'pos-field-product-name', value: productName },
  { key: 'brand', label: 'Brand', className: 'pos-field-compact', value: (product) => product.brand || '-' },
  { key: 'manufacturer', label: 'Manufacturer', className: 'pos-field-compact', value: (product) => product.manufacturer || '-' },
  { key: 'supplier', label: 'Supplier', className: 'pos-field-compact', value: (product) => product.supplierName || '-' },
  { key: 'shelf', label: 'Shelf / Location', className: 'pos-field-compact', value: productShelf },
  { key: 'qty', label: 'Qty', className: 'pos-field-number', value: (product) => String(productQty(product)) },
  { key: 'price', label: 'Price', className: 'pos-field-number', value: (product) => `USD ${productPrice(product).toFixed(2)}` },
  { key: 'stockStatus', label: 'Stock Status', className: 'pos-field-status', value: stockLabel },
  { key: 'sector', label: 'Sector', className: 'pos-field-compact', value: (product) => product.industrialSector || '-' },
  { key: 'category', label: 'Category', className: 'pos-field-compact', value: (product) => product.productCategory || product.category },
  { key: 'alu', label: 'ALU', className: 'pos-field-compact', value: (product) => product.alu || '-' },
  { key: 'productNo', label: 'Product No.', className: 'pos-field-compact', value: (product) => product.productNumericNumber || product.id },
  { key: 'barcode', label: 'Barcode', className: 'pos-field-compact', value: (product) => product.barcode || '-' }
];

export default function ProductSearchCard({
  products,
  branchName,
  warehouseName = 'Main Warehouse',
  onAddProduct,
  onBlockedProduct,
  onBlockedStockAttempt
}: ProductSearchCardProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [sector, setSector] = useState('ALL');
  const [branch, setBranch] = useState('ALL');
  const [warehouse, setWarehouse] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [message, setMessage] = useState('');
  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredViewMode);
  const [visibleFields, setVisibleFieldsState] = useState<ProductFieldKey[]>(readStoredFields);

  const selectedFields = useMemo(
    () => fieldConfigs.filter((field) => visibleFields.includes(field.key)),
    [visibleFields]
  );

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

      const matchesCategory = category === 'ALL' ||
        productCategory === category ||
        product.productSubCategory === category ||
        productSector === category;
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
        (item) => textMeta(item, 'partNumber'),
        (item) => textMeta(item, 'oemNumber'),
        (item) => textMeta(item, 'make'),
        (item) => textMeta(item, 'model'),
        (item) => textMeta(item, 'year'),
        (item) => textMeta(item, 'yearFrom'),
        (item) => textMeta(item, 'yearTo'),
        (item) => textMeta(item, 'side'),
        (item) => textMeta(item, 'condition'),
        (item) => textMeta(item, 'colour'),
        (item) => textMeta(item, 'color'),
        (item) => textMeta(item, 'vendorSku')
      ]);

      return matchesCategory && matchesSector && matchesBranch && matchesWarehouse && matchesStock && matchesQuery;
    });
  }, [branch, branchName, category, products, query, sector, stockFilter, warehouse, warehouseName]);

  const setViewMode = (nextMode: ViewMode) => {
    setViewModeState(nextMode);
    savePreference(VIEW_MODE_KEY, nextMode);
  };

  const setVisibleFields = (nextFields: ProductFieldKey[]) => {
    const safeFields = nextFields.length > 0 ? nextFields : defaultVisibleFields;
    setVisibleFieldsState(safeFields);
    savePreference(VISIBLE_FIELDS_KEY, safeFields);
  };

  const toggleField = (field: ProductFieldKey) => {
    setVisibleFields(
      visibleFields.includes(field)
        ? visibleFields.filter((item) => item !== field)
        : [...visibleFields, field]
    );
  };

  const clearSearch = () => {
    setQuery('');
    setCategory('ALL');
    setSector('ALL');
    setBranch('ALL');
    setWarehouse('ALL');
    setStockFilter('ALL');
    setMessage('');
  };

  const handleAdd = (product: Product) => {
    if (productQty(product) <= 0) {
      setMessage('Cannot add product. Stock is not available.');
      (onBlockedStockAttempt || onBlockedProduct)?.(product);
      return;
    }
    setMessage('');
    onAddProduct(product);
  };

  const handleQuickCategory = (nextCategory: QuickCategory) => {
    setCategory(nextCategory === 'ALL' ? 'ALL' : nextCategory);
    setMessage('');
  };

  const renderFieldValue = (product: Product, field: ProductFieldConfig) => {
    if (field.key === 'stockStatus') {
      const disabled = productQty(product) <= 0;
      return (
        <span className={`sci-status-pill sci-status-pill--${disabled ? 'danger' : isLowStock(product) ? 'warning' : 'success'}`}>
          {stockLabel(product)}
        </span>
      );
    }
    const value = field.value(product);
    return <span className="pos-product-value" title={value}>{value}</span>;
  };

  const renderCartIcon = (product: Product) => {
    const disabled = productQty(product) <= 0;
    return (
      <button
        type="button"
        className="cart-icon-cta"
        onClick={() => handleAdd(product)}
        disabled={disabled}
        title={disabled ? 'Out of stock' : 'Add to cart'}
        aria-label="Add product to cart"
      >
        <ShoppingCart size={18} aria-hidden="true" />
      </button>
    );
  };

  return (
    <section className="sci-pos-card pos-product-search-card" aria-labelledby="product-search-title">
      <div className="sci-pos-card__bar pos-product-card-bar">
        <div>
          <p className="sci-pos-eyebrow">Product Search</p>
          <h2 id="product-search-title">Product Search</h2>
        </div>
        <div className="pos-product-view-actions">
          <span className="sci-pos-card__count">{filteredProducts.length} results</span>
          <div className="pos-view-toggle" aria-label="Product result view mode">
            <button type="button" className={`industrial-tab ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <List size={14} aria-hidden="true" />
              List
            </button>
            <button type="button" className={`industrial-tab ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              <LayoutGrid size={14} aria-hidden="true" />
              Grid
            </button>
          </div>
        </div>
      </div>

      <div className="pos-search-controls">
        <label className="pos-search-input">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search products</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by product, SKU, barcode, ALU, brand, make, model, year, side, category..."
          />
        </label>

        <select value={sector} onChange={(event) => setSector(event.target.value)} aria-label="Industrial Sector filter">
          <option value="ALL">All Industrial Sectors</option>
          {sectors.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category filter">
          <option value="ALL">All Categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
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

      <div className="pos-quick-filter-row" aria-label="Category quick filters">
        {quickCategories.map((item) => {
          const isActive = item === 'ALL' ? category === 'ALL' : category === item;
          return (
            <button
              key={item}
              type="button"
              className={`industrial-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleQuickCategory(item)}
            >
              {item === 'ALL' ? 'All' : item}
            </button>
          );
        })}
      </div>

      <div className="pos-field-chooser">
        <div className="pos-field-chooser__title">Fields</div>
        <div className="pos-field-chooser__options">
          {fieldConfigs.map((field) => (
            <label key={field.key}>
              <input
                type="checkbox"
                checked={visibleFields.includes(field.key)}
                onChange={() => toggleField(field.key)}
              />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </div>

      {message && (
        <div className="sci-pos-alert pos-product-search-message" role="status">
          {message}
        </div>
      )}

      <div className="pos-section-heading">
        Product Results
      </div>

      {viewMode === 'list' ? (
        <div className="pos-product-results">
          <table className="pos-product-compact-table">
            <thead>
              <tr>
                {selectedFields.map((field) => (
                  <th key={field.key} className={field.className}>{field.label}</th>
                ))}
                <th className="pos-field-action">Cart</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const disabled = productQty(product) <= 0;
                return (
                  <tr
                    key={product.id}
                    className={disabled ? 'is-disabled-row' : undefined}
                    onDoubleClick={() => handleAdd(product)}
                  >
                    {selectedFields.map((field) => (
                      <td key={field.key} className={field.className}>
                        {renderFieldValue(product, field)}
                      </td>
                    ))}
                    <td className="pos-field-action">{renderCartIcon(product)}</td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={selectedFields.length + 1} className="sci-pos-empty-cell">No products match the current search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pos-product-grid-results">
          {filteredProducts.map((product) => {
            const disabled = productQty(product) <= 0;
            return (
              <article
                key={product.id}
                className={`pos-product-grid-card ${disabled ? 'is-disabled-row' : ''}`}
                onDoubleClick={() => handleAdd(product)}
              >
                <div className="pos-product-grid-card__header">
                  <strong title={productName(product)}>{productName(product)}</strong>
                  {renderCartIcon(product)}
                </div>
                <div className="pos-product-grid-card__meta">
                  <span title={productSku(product)}>{productSku(product)}</span>
                  <span title={product.brand || '-'}>{product.brand || '-'}</span>
                </div>
                <div className="pos-product-grid-card__details">
                  <span>Qty: <strong>{productQty(product)}</strong></span>
                  <span>{`USD ${productPrice(product).toFixed(2)}`}</span>
                  <span title={productShelf(product)}>{productShelf(product)}</span>
                </div>
                <div>
                  <span className={`sci-status-pill sci-status-pill--${disabled ? 'danger' : isLowStock(product) ? 'warning' : 'success'}`}>
                    {stockLabel(product)}
                  </span>
                </div>
              </article>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="industrial-empty-state">No products match the current search.</div>
          )}
        </div>
      )}
    </section>
  );
}
