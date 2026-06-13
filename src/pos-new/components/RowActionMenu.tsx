import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedMenuHeight = Math.max(44, items.length * 34 + 10);
    const viewportPadding = 8;
    const opensUp = align === 'top' || rect.bottom + estimatedMenuHeight + viewportPadding > window.innerHeight;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding
    );
    const top = opensUp
      ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 4)
      : Math.min(window.innerHeight - viewportPadding, rect.bottom + 4);

    setMenuStyle({
      left,
      top,
      width: menuWidth,
      maxHeight: Math.max(160, window.innerHeight - viewportPadding * 2),
      overflowY: 'auto'
    });
  }, [align, items.length, open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    };
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) {
        return;
      }
      onOpenChange(false);
    };
    const handleResize = () => {
        onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, onOpenChange]);

  const panel = open ? createPortal(
    <div
      className={`row-action-panel row-action-panel--portal inventory-row-menu-panel inventory-row-menu-portal product-list-row-action-menu ${align === 'top' ? 'row-action-panel--top' : ''}`}
      ref={menuRef}
      role="menu"
      style={menuStyle}
      onClick={(event) => event.stopPropagation()}
    >
      {items.length === 0 ? (
        <div className="row-action-item row-action-item--disabled inventory-row-menu-item">No actions available</div>
      ) : items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={`row-action-item inventory-row-menu-item ${item.danger ? 'row-action-item--danger' : ''}`}
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
    </div>,
    document.body
  ) : null;

  return (
    <div className="row-action-menu" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        ref={triggerRef}
        className="row-action-trigger inventory-row-menu-trigger product-list-row-action-trigger"
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
      {panel}
    </div>
  );
}
