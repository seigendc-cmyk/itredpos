import React, { useEffect, useRef } from 'react';
import { MoreVertical } from 'lucide-react';

export interface RowActionMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

interface RowActionMenuProps {
  ariaLabel?: string;
  open: boolean;
  align?: 'top' | 'bottom';
  items: RowActionMenuItem[];
  onOpenChange: (open: boolean) => void;
}

export default function RowActionMenu({
  ariaLabel = 'Product actions',
  open,
  align = 'bottom',
  items,
  onOpenChange
}: RowActionMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="row-action-menu" ref={menuRef} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="row-action-trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className={`row-action-panel ${align === 'top' ? 'row-action-panel--top' : ''}`} role="menu">
          {items.length === 0 ? (
            <div className="row-action-item row-action-item--disabled">No actions available</div>
          ) : items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`row-action-item ${item.danger ? 'row-action-item--danger' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                if (item.disabled) return;
                onOpenChange(false);
                item.onClick();
              }}
            >
              {item.icon && <span className="row-action-item-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
