import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { hasSessionPermission } from '../auth/sessionPermissionBridge';

export interface RowActionMenuItem {
  id?: string;
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  hidden?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  permissionKey?: string;
}

interface RowActionMenuProps {
  rowId?: string;
  ariaLabel?: string;
  open?: boolean;
  align?: 'top' | 'bottom' | 'start' | 'end';
  items?: Array<RowActionMenuItem | false | null | undefined>;
  actions?: Array<RowActionMenuItem | false | null | undefined>;
  disabled?: boolean;
  buttonLabel?: string;
  onOpen?: (rowId?: string) => void;
  onClose?: (rowId?: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export default function RowActionMenu({
  rowId,
  ariaLabel = 'Product actions',
  open,
  align = 'bottom',
  items,
  actions,
  disabled = false,
  buttonLabel,
  onOpen,
  onClose,
  onOpenChange
}: RowActionMenuProps) {
  const generatedId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const instanceIdRef = useRef(`row-menu-${Math.random().toString(36).slice(2)}`);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = typeof open === 'boolean';
  const menuOpen = controlled ? Boolean(open) : internalOpen;
  const menuId = rowId || generatedId;
  const rawItems = actions || items || [];
  const visibleItems = useMemo(() => rawItems
    .filter((item): item is RowActionMenuItem => Boolean(item && !item.hidden))
    .filter((item) => !item.permissionKey || hasSessionPermission(item.permissionKey)), [rawItems]);

  const setOpen = (next: boolean) => {
    if (next) window.dispatchEvent(new CustomEvent('itred-row-action-menu-opened', { detail: { instanceId: instanceIdRef.current } }));
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
    if (next) onOpen?.(rowId);
    else onClose?.(rowId);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedMenuHeight = Math.min(Math.max(44, visibleItems.length * 38 + 10), 320);
    const viewportPadding = 8;
    const opensUp = align === 'top' || rect.bottom + estimatedMenuHeight + viewportPadding > window.innerHeight;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding
    );
    const top = opensUp
      ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 4)
      : Math.min(window.innerHeight - estimatedMenuHeight - viewportPadding, rect.bottom + 4);

    setMenuStyle({
      left,
      top,
      width: menuWidth,
      maxHeight: Math.min(320, window.innerHeight - viewportPadding * 2),
      overflowY: 'auto'
    });
  }, [align, menuOpen, visibleItems.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleResize = () => {
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
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
  }, [menuOpen]);

  useEffect(() => {
    const closeOtherMenu = (event: Event) => {
      const detail = (event as CustomEvent<{ instanceId?: string }>).detail;
      if (detail?.instanceId === instanceIdRef.current) return;
      if (menuOpen) setOpen(false);
    };
    window.addEventListener('itred-row-action-menu-opened', closeOtherMenu);
    return () => window.removeEventListener('itred-row-action-menu-opened', closeOtherMenu);
  }, [menuOpen]);

  const panel = menuOpen ? createPortal(
    <div
      id={`row-action-menu-${menuId}`}
      className={`row-action-menu-panel row-action-menu-portal row-action-panel row-action-panel--portal inventory-row-menu-panel inventory-row-menu-portal product-list-row-action-menu ${align === 'top' ? 'row-action-panel--top' : ''}`}
      ref={menuRef}
      role="menu"
      style={menuStyle}
      onClick={(event) => event.stopPropagation()}
    >
      {visibleItems.length === 0 ? (
        <div className="row-action-menu-item row-action-item row-action-item--disabled inventory-row-menu-item">No actions available</div>
      ) : visibleItems.map((item, index) => (
        <React.Fragment key={item.id || `${item.label}-${index}`}>
          {item.separatorBefore && index > 0 && <div className="row-action-menu-separator" role="separator" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled || typeof item.onClick !== 'function'}
            className={`row-action-menu-item row-action-item inventory-row-menu-item ${item.danger ? 'row-action-menu-item-danger row-action-item--danger' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              if (item.disabled || typeof item.onClick !== 'function') return;
              setOpen(false);
              item.onClick();
            }}
          >
            {item.icon && <span className="row-action-item-icon">{item.icon}</span>}
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className="row-action-menu" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        ref={triggerRef}
        className="row-action-menu-button row-action-trigger inventory-row-menu-trigger product-list-row-action-trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-controls={menuOpen ? `row-action-menu-${menuId}` : undefined}
        aria-expanded={menuOpen}
        disabled={disabled}
        title={buttonLabel || ariaLabel}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          setOpen(!menuOpen);
        }}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {panel}
    </div>
  );
}
