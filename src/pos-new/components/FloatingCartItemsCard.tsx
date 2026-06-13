import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CartItem } from '../types';

interface FloatingCartItemsCardProps {
  open: boolean;
  cart: CartItem[];
  subtotal: number;
  onClose: () => void;
  onQuantitySet: (productId: string, quantity: number) => void;
  onQuantityChange: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyLineDiscount: (productId: string) => void;
  onHoldSale: () => void;
  canHoldSale: boolean;
  onCheckout: () => void;
  flowIndicator?: ReactNode;
  onNotice?: (message: string) => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function unitPrice(item: CartItem): number {
  return item.overriddenPrice ?? item.product.sellingPrice ?? item.product.price;
}

function lineTotal(item: CartItem): number {
  const gross = unitPrice(item) * item.quantity;
  return gross - gross * (item.discount / 100);
}

function stockStatus(item: CartItem): { label: string; tone: string } {
  if (item.lineType === 'MiscellaneousItem' || item.isInventoryAsset === false) return { label: 'Non-Inventory / BI Flagged', tone: 'warning' };
  const qty = item.product.availableStock ?? item.product.qtyOnHand ?? item.product.stock;
  if (qty <= 0) return { label: 'Out of Stock', tone: 'danger' };
  if (qty <= (item.product.reorderLevel ?? item.product.minStock)) return { label: 'Low Stock', tone: 'warning' };
  return { label: 'In Stock', tone: 'success' };
}

export default function FloatingCartItemsCard({
  open,
  cart,
  subtotal,
  onClose,
  onQuantitySet,
  onQuantityChange,
  onRemoveItem,
  onApplyLineDiscount,
  onHoldSale,
  canHoldSale,
  onCheckout,
  flowIndicator,
  onNotice
}: FloatingCartItemsCardProps) {
  if (!open) return null;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="floating-cart-backdrop" onClick={onClose}>
      <section className="floating-cart-card" onClick={(event) => event.stopPropagation()} aria-label="Cart Items">
        <header className="floating-cart-card-header">
          <div>
            <p className="sci-pos-eyebrow">Cart Items</p>
            <h3><ShoppingCart size={18} aria-hidden="true" /> Cart Items</h3>
            <span>Review quantities, prices, discounts, and line totals before completing sale.</span>
          </div>
          <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close cart items">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="floating-cart-card-summary">
          <span>Items <strong>{itemCount}</strong></span>
          <span>Cart Total <strong>{money(subtotal)}</strong></span>
        </div>
        {flowIndicator}

        <div className="floating-cart-card-body">
          {cart.length === 0 ? (
            <div className="industrial-empty-state">Cart is empty. Add products from the Product Search card.</div>
          ) : (
            <table className="floating-cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Discount</th>
                  <th>Line Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => {
                  const status = stockStatus(item);
                  return (
                    <tr key={item.product.id}>
                      <td>
                        <strong>{item.product.productName || item.product.name}</strong>
                        <span className={`sales-status-text sales-status-text--${status.tone}`}>{status.label}</span>
                      </td>
                      <td className={`sales-sku ${item.lineType === 'MiscellaneousItem' ? 'sales-sku--misc' : ''}`}>{item.sku || item.product.sku || item.product.code}</td>
                      <td>
                        <div className="floating-cart-qty">
                          <button type="button" onClick={() => onQuantityChange(item.product.id, -1)} disabled={item.quantity <= 1} aria-label="Decrease quantity"><Minus size={13} /></button>
                          <input type="number" min={1} value={item.quantity} onChange={(event) => onQuantitySet(item.product.id, Number(event.target.value) || 1)} />
                          <button type="button" onClick={() => onQuantityChange(item.product.id, 1)} aria-label="Increase quantity"><Plus size={13} /></button>
                        </div>
                      </td>
                      <td>{money(unitPrice(item))}</td>
                      <td><button type="button" className="sci-pos-link-button" onClick={() => onApplyLineDiscount(item.product.id)}>{item.discount > 0 ? `${item.discount}%` : 'Apply Discount'}</button></td>
                      <td><strong>{money(lineTotal(item))}</strong></td>
                      <td>
                        <div className="floating-cart-actions">
                          <button type="button" className="sci-pos-link-button" onClick={() => onNotice?.(`Product detail opened locally for ${item.product.productName || item.product.name}.`)}>View Product</button>
                          <button type="button" className="sci-pos-link-button" onClick={() => onNotice?.(`Line note editor opened locally for ${item.product.productName || item.product.name}.`)}>Line Note</button>
                          <button type="button" className="cart-icon-cta pos-cart-remove" onClick={() => onRemoveItem(item.product.id)} aria-label="Remove item"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="floating-cart-card-footer">
          <span>Subtotal <strong>{money(subtotal)}</strong></span>
          <span>Item Count <strong>{itemCount}</strong></span>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onHoldSale} disabled={!canHoldSale || cart.length === 0}>Hold Sale</button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onCheckout}>Checkout</button>
        </footer>
      </section>
    </div>
  );
}
