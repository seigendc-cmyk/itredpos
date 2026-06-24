import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List, RotateCcw, Search, ShoppingCart, SlidersHorizontal, X } from 'lucide-react';
import { Product } from '../types';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

interface ProductSearchCardProps {
  products: Product[];
  branchName: string;
  warehouseName?: string;
  onAddProduct: (product: Product) => void;
  onBlockedProduct?: (product: Product) => void;
  onBlockedStockAttempt?: (product: Product) => void;
  onActivity?: (eventType: string, message: string) => void;
  canSellInventoryItems?: boolean;
  inventoryBlockedMessage?: string;
  canAddMiscellaneousSale?: boolean;
  onNavigateShiftControl?: () => void;
  onActivateTerminal?: () => void;
  onOpenShift?: () => void;
  onAssignDrawer?: () => void;
  onAddMiscellaneousSale?: () => void;
  collapseFieldsSignal?: number;
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
const defaultVisibleFields: ProductFieldKey[] = ['sku', 'productName', 'brand', 'qty', 'price', 'stockStatus'];

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
  { key: 'qty', label: 'Qty', className: 'pos-field-number pos-field-qty', value: (product) => String(productQty(product)) },
  { key: 'price', label: 'Price', className: 'pos-field-number pos-field-price', value: (product) => productPrice(product).toFixed(2) },
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
  onBlockedStockAttempt,
  onActivity,
  canSellInventoryItems = true,
  inventoryBlockedMessage = 'Terminal is not active or shift is not ready. Activate terminal and open shift before selling inventory items.',
  canAddMiscellaneousSale = false,
  onNavigateShiftControl,
  onActivateTerminal,
  onOpenShift,
  onAssignDrawer,
  onAddMiscellaneousSale,
  collapseFieldsSignal = 0
}: ProductSearchCardProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [subcategory, setSubcategory] = useState('ALL');
  const [sector, setSector] = useState('ALL');
  const [branch, setBranch] = useState('ALL');
  const [warehouse, setWarehouse] = useState('ALL');
  const [brand, setBrand] = useState('ALL');
  const [supplier, setSupplier] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [message, setMessage] = useState('');
  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredViewMode);
  const [visibleFields, setVisibleFieldsState] = useState<ProductFieldKey[]>(readStoredFields);
  const [filterCabinetOpen, setFilterCabinetOpen] = useState(false);
  const [isFieldsCardExpanded, setIsFieldsCardExpanded] = useState(false);
  const fieldsCardRef = useRef<HTMLDivElement | null>(null);

  const selectedFields = useMemo(
    () => fieldConfigs.filter((field) => visibleFields.includes(field.key)),
    [visibleFields]
  );
  const selectedFieldsSummary = selectedFields.map((field) => field.label).join(', ');

  const categories = useMemo(
    () => distinct(products.map((product) => product.productCategory || product.category)),
    [products]
  );
  const subcategories = useMemo(
    () => distinct(products.map((product) => product.productSubCategory || textMeta(product, 'subcategory'))),
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
  const brands = useMemo(
    () => distinct(products.map((product) => product.brand || '')),
    [products]
  );
  const suppliers = useMemo(
    () => distinct(products.map((product) => product.supplierName || textMeta(product, 'supplier'))),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const productCategory = product.productCategory || product.category;
      const productSubcategory = product.productSubCategory || textMeta(product, 'subcategory');
      const productSector = product.industrialSector || textMeta(product, 'sector');
      const productBranch = product.branch || product.branchId || branchName;
      const productWarehouse = product.warehouse || product.warehouseId || warehouseName;
      const productBrand = product.brand || '';
      const productSupplier = product.supplierName || textMeta(product, 'supplier');
      const qty = productQty(product);

      const matchesCategory = category === 'ALL' ||
        productCategory === category ||
        product.productSubCategory === category ||
        productSector === category;
      const matchesSubcategory = subcategory === 'ALL' || productSubcategory === subcategory;
      const matchesSector = sector === 'ALL' || productSector === sector;
      const matchesBranch = branch === 'ALL' || productBranch === branch;
      const matchesWarehouse = warehouse === 'ALL' || productWarehouse === warehouse;
      const matchesBrand = brand === 'ALL' || productBrand === brand;
      const matchesSupplier = supplier === 'ALL' || productSupplier === supplier;
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
        (item) => textMeta(item, 'supplier'),
        (item) => item.shelfLocation,
        (item) => item.binLocation,
        (item) => item.serialNumber,
        (item) => item.industrialSector,
        (item) => textMeta(item, 'sector'),
        (item) => item.productCategory,
        (item) => item.category,
        (item) => item.productSubCategory,
        (item) => textMeta(item, 'branchName'),
        (item) => textMeta(item, 'warehouseName'),
        (item) => item.branch,
        (item) => item.warehouse,
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

      return matchesCategory && matchesSubcategory && matchesSector && matchesBranch && matchesWarehouse && matchesBrand && matchesSupplier && matchesStock && matchesQuery;
    });
  }, [branch, branchName, brand, category, products, query, sector, stockFilter, subcategory, supplier, warehouse, warehouseName]);

  const collapseFieldsCard = (eventType = 'SALES_FIELDS_CARD_COLLAPSED') => {
    setIsFieldsCardExpanded((current) => {
      if (current) onActivity?.(eventType, 'Sales product Fields card collapsed.');
      return false;
    });
  };

  const toggleFieldsCard = () => {
    setIsFieldsCardExpanded((current) => {
      const next = !current;
      onActivity?.(next ? 'SALES_FIELDS_CARD_OPENED' : 'SALES_FIELDS_CARD_COLLAPSED', next ? 'Sales product Fields card opened.' : 'Sales product Fields card collapsed.');
      return next;
    });
  };

  useEffect(() => {
    collapseFieldsCard('SALES_FIELDS_CARD_COLLAPSED');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseFieldsSignal]);

  useEffect(() => {
    if (!isFieldsCardExpanded) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (fieldsCardRef.current?.contains(event.target as Node)) return;
      collapseFieldsCard();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapseFieldsCard();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFieldsCardExpanded]);

  const setViewMode = (nextMode: ViewMode) => {
    collapseFieldsCard();
    setViewModeState(nextMode);
    savePreference(VIEW_MODE_KEY, nextMode);
  };

  const setVisibleFields = (nextFields: ProductFieldKey[]) => {
    const safeFields = nextFields.length > 0 ? nextFields : defaultVisibleFields;
    setVisibleFieldsState(safeFields);
    savePreference(VISIBLE_FIELDS_KEY, safeFields);
    onActivity?.('SALES_PRODUCT_FIELDS_UPDATED', `Product fields updated: ${safeFields.join(', ')}.`);
  };

  const toggleField = (field: ProductFieldKey) => {
    setVisibleFields(
      visibleFields.includes(field)
        ? visibleFields.filter((item) => item !== field)
        : [...visibleFields, field]
    );
  };

  const clearSearch = () => {
    collapseFieldsCard();
    setQuery('');
    setCategory('ALL');
    setSubcategory('ALL');
    setSector('ALL');
    setBranch('ALL');
    setWarehouse('ALL');
    setBrand('ALL');
    setSupplier('ALL');
    setStockFilter('ALL');
    setMessage('');
  };

  const handleAdd = (product: Product) => {
    collapseFieldsCard();
    if (!canSellInventoryItems) {
      setMessage('Inventory browsing is read-only while terminal is inactive.');
      onBlockedProduct?.(product);
      onActivity?.('TERMINAL_INVENTORY_SALES_BLOCKED', inventoryBlockedMessage);
      return;
    }
    if (productQty(product) <= 0) {
      setMessage('Cannot add product. Stock is not available.');
      (onBlockedStockAttempt || onBlockedProduct)?.(product);
      return;
    }
    setMessage('');
    onAddProduct(product);
  };

  const handleQuickCategory = (nextCategory: QuickCategory) => {
    collapseFieldsCard();
    setSector(nextCategory === 'ALL' ? 'ALL' : nextCategory);
    setMessage('');
  };

  const applyFilterCabinet = () => {
    collapseFieldsCard();
    setFilterCabinetOpen(false);
    setMessage('Product filters applied.');
    onActivity?.('SALES_PRODUCT_FILTERS_APPLIED', `${filteredProducts.length} product result(s) after filters.`);
  };

  const renderFieldValue = (product: Product, field: ProductFieldConfig) => {
    if (field.key === 'stockStatus') {
      const disabled = productQty(product) <= 0;
      return (
        <span className={`sales-status-text sales-status-text--${disabled ? 'danger' : isLowStock(product) ? 'warning' : 'success'}`}>
          {stockLabel(product)}
        </span>
      );
    }
    const value = field.value(product);
    const className = field.key === 'sku' ? 'pos-product-value sales-sku' : field.key === 'productName' ? 'pos-product-value sales-product-name' : 'pos-product-value';
    return <span className={className} title={value}>{value}</span>;
  };

  const renderCartIcon = (product: Product) => {
    const disabled = !canSellInventoryItems || productQty(product) <= 0;
    return (
      <button
        type="button"
        className="cart-icon-cta"
        onClick={() => handleAdd(product)}
        disabled={disabled}
        title={!canSellInventoryItems ? 'Inventory selling blocked until terminal is ready' : disabled ? 'Out of stock' : 'Add to cart'}
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

      <div className="sales-product-tools">
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { collapseFieldsCard(); setFilterCabinetOpen(true); }} disabled={!canSellInventoryItems}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filter Cabinet
        </button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={clearSearch}>
          <RotateCcw size={16} aria-hidden="true" />
          Clear Search
        </button>
      </div>

      <div ref={fieldsCardRef} className={`pos-field-chooser sales-fields-card ${isFieldsCardExpanded ? 'sales-fields-card--expanded' : 'sales-fields-card--collapsed'}`}>
        <div className="sales-fields-card-header">
          <div>
            <div className="pos-field-chooser__title">Fields</div>
            <p className="sales-fields-summary">Fields: {visibleFields.length} selected - {selectedFieldsSummary}</p>
          </div>
          <button type="button" className="sales-fields-toggle" onClick={toggleFieldsCard} aria-expanded={isFieldsCardExpanded}>
            {isFieldsCardExpanded ? 'Collapse' : 'Manage Fields'}
          </button>
        </div>
        {isFieldsCardExpanded && (
          <>
            <div className="sales-fields-grid">
              {[
                { title: 'Core', keys: ['sku', 'productName', 'brand', 'qty', 'price', 'stockStatus'] as ProductFieldKey[] },
                { title: 'Optional', keys: ['manufacturer', 'supplier', 'shelf', 'sector', 'category', 'alu', 'productNo', 'barcode'] as ProductFieldKey[] }
              ].map((group) => (
                <div key={group.title} className="sales-field-group">
                  <span>{group.title}</span>
                  <div className="pos-field-chooser__options">
                    {group.keys.map((key) => {
                      const field = fieldConfigs.find((item) => item.key === key);
                      if (!field) return null;
                      return (
                        <label key={field.key} className={visibleFields.includes(field.key) ? 'is-selected' : undefined}>
                          <input
                            type="checkbox"
                            checked={visibleFields.includes(field.key)}
                            onChange={() => toggleField(field.key)}
                          />
                          <span>{field.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="sales-fields-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => collapseFieldsCard()}>Apply Fields</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { setVisibleFields(defaultVisibleFields); onActivity?.('SALES_FIELDS_DEFAULTS_RESTORED', 'Default product fields restored.'); }}>Reset Default Fields</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => collapseFieldsCard()}>Collapse</button>
            </div>
          </>
        )}
      </div>

      <div className="pos-search-controls sales-search-row">
        <label className="pos-search-input sales-search-bubble">
          <span className="sr-only">Search products</span>
          <input
            className="sales-search-input"
            value={query}
            onFocus={() => collapseFieldsCard()}
            onKeyDown={(event) => { if (event.key === 'Enter') collapseFieldsCard(); }}
            onChange={(event) => { collapseFieldsCard(); setQuery(event.target.value); }}
            disabled={!canSellInventoryItems}
            placeholder="Search by product, SKU, barcode, ALU, brand, supplier, shelf, sector, category, make, model, or part number..."
          />
          <Search className="sales-search-icon" size={18} aria-hidden="true" />
        </label>
      </div>

      {!canSellInventoryItems && (
        <div className="sales-inventory-blocked-panel" role="status">
          <strong>Inventory Product Sales Blocked</strong>
          <span>{inventoryBlockedMessage}</span>
          <div>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onNavigateShiftControl}>Go to Shift Control</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onActivateTerminal}>Activate Terminal</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onOpenShift}>Open Shift</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onAssignDrawer}>Assign Drawer</button>
            {canAddMiscellaneousSale && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onAddMiscellaneousSale}>Add Miscellaneous Sale</button>}
          </div>
        </div>
      )}

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
                  <span>{productPrice(product).toFixed(2)}</span>
                  <span title={productShelf(product)}>{productShelf(product)}</span>
                </div>
                <div>
                  <span className={`sales-status-text sales-status-text--${disabled ? 'danger' : isLowStock(product) ? 'warning' : 'success'}`}>
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
      {filterCabinetOpen && (
        <div className="sales-drawer-backdrop" onClick={() => setFilterCabinetOpen(false)}>
          <aside className="sales-drawer sales-filter-cabinet" onClick={(event) => event.stopPropagation()} aria-label="Product Filter Cabinet">
            <div className="sales-drawer-header">
              <div>
                <p className="sci-pos-eyebrow">Filters</p>
                <h3>Product Filter Cabinet</h3>
              </div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setFilterCabinetOpen(false)} aria-label="Close filter cabinet">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="sales-drawer-body">
              <section className="sales-drawer-section">
                <h4>Location</h4>
                <label>Branch<select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="ALL">All Branches</option>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label>Warehouse<select value={warehouse} onChange={(event) => setWarehouse(event.target.value)}><option value="ALL">All Warehouses</option>{warehouses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label>Shelf / Location<input value="" placeholder="Shelf search uses the main product search" readOnly /></label>
              </section>
              <section className="sales-drawer-section">
                <h4>Sector / Category</h4>
                <div className="sales-sector-button-grid" aria-label="Sector quick filters">
                  {quickCategories.map((item) => {
                    const isActive = item === 'ALL' ? sector === 'ALL' : sector === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        className={isActive ? 'active' : undefined}
                        onClick={() => handleQuickCategory(item)}
                      >
                        {item === 'ALL' ? 'All' : item}
                      </button>
                    );
                  })}
                </div>
                <label>Industrial Sector<select value={sector} onChange={(event) => setSector(event.target.value)}><option value="ALL">All Industrial Sectors</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All Categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label>Subcategory<select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="ALL">All Subcategories</option>{subcategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label>Stock Status<select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)}><option value="ALL">All Stock</option><option value="IN_STOCK">In Stock</option><option value="LOW_STOCK">Low Stock</option><option value="OUT_OF_STOCK">Out of Stock</option></select></label>
              </section>
              <section className="sales-drawer-section">
                <h4>Supplier / Brand</h4>
                <label>Brand<select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="ALL">All Brands</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label>Supplier<select value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="ALL">All Suppliers</option>{suppliers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              </section>
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={applyFilterCabinet}>Apply Filters</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { clearSearch(); setFilterCabinetOpen(false); }}>Clear Filters</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setFilterCabinetOpen(false)}>Close</button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
