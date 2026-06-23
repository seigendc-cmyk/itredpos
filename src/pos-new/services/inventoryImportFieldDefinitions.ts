import type { InventoryImportFieldDefinition } from '../types/posTypes';

const field = (
  fieldKey: string,
  fieldLabel: string,
  fieldType: InventoryImportFieldDefinition['fieldType'],
  required: boolean,
  validationType: InventoryImportFieldDefinition['validationType'],
  targetDomain: InventoryImportFieldDefinition['targetDomain'],
  acceptedAliases: string[],
  sampleValue: string,
  description: string
): InventoryImportFieldDefinition => ({
  fieldKey,
  fieldLabel,
  fieldType,
  required,
  validationType,
  targetDomain,
  acceptedAliases,
  sampleValue,
  description
});

export const inventoryImportFieldDefinitions: InventoryImportFieldDefinition[] = [
  field('productName', 'Product Name', 'Required', true, 'Text', 'Product', ['Item Name', 'Product Name', 'Description', 'Item Description', 'Name'], 'Brake Pads Toyota GD6 Front', 'Product display and search name.'),
  field('sku', 'SKU / Product Code', 'Required', true, 'Text', 'Product', ['SKU', 'Item Number', 'Item #', 'Product Code', 'Code', 'Part No', 'Part Number'], 'BP-GD6-F', 'Primary product identifier.'),
  field('productCode', 'Product Code', 'Required', true, 'Text', 'Product', ['Product Code', 'Code', 'Item Code', 'Stock Code'], 'BP-GD6-F', 'Alternate product code when SKU differs.'),
  field('sellingPrice', 'Selling Price', 'Required', true, 'Money', 'Pricing', ['Regular Price', 'Price', 'Sale Price', 'Retail Price', 'Selling Price'], '28.00', 'Default selling price.'),
  field('qty', 'Qty / Opening Quantity', 'Required', true, 'Quantity', 'Stock', ['Qty 1', 'On Hand', 'O/H Qty', 'Quantity', 'Stock Qty', 'Qty', 'openingQuantity', 'Opening Stock', 'qtyOnHand', 'Available Stock'], '4', 'Opening stock quantity preview.'),
  field('costPrice', 'Cost Price', 'Recommended', false, 'Money', 'Pricing', ['Average Unit Cost', 'Unit Cost', 'Cost', 'Buy Price', 'Purchase Price', 'Cost Price', 'unitCost', 'buyingPrice'], '16.00', 'Default cost used for stock value.'),
  field('category', 'Category', 'Recommended', false, 'Text', 'Product', ['Department', 'Category', 'Product Group', 'Product Category'], 'Braking', 'Product category.'),
  field('department', 'Department', 'Recommended', false, 'Text', 'Product', ['Department', 'Dept'], 'Motor Spares', 'Retail department.'),
  field('supplierName', 'Supplier Name', 'Recommended', false, 'Text', 'Supplier', ['Supplier', 'Supplier Name', 'Vendor', 'Vendor Name'], 'Motor Spares Wholesalers', 'Supplier placeholder name.'),
  field('barcode', 'Barcode', 'Recommended', false, 'Text', 'Product', ['Barcode', 'UPC', 'EAN'], '6001234567890', 'Barcode or scan code.'),
  field('description', 'Description', 'Optional', false, 'Text', 'Product', ['Description', 'Long Description', 'Item Description'], 'Front brake pad set', 'Extended product description.'),
  field('shelfLocation', 'Shelf / Bin', 'Recommended', false, 'Text', 'Location', ['Attribute', 'Shelf', 'Shelf Location', 'Location', 'Bin', 'Bin Location', 'Rack', 'shelfLocation'], 'A1-S4', 'Shelf or bin location.'),
  field('taxCode', 'Tax Code', 'Recommended', false, 'Enum', 'Tax', ['Tax Code', 'VAT Code', 'Tax Category'], 'VAT15', 'Tax mapping placeholder.'),
  field('reorderPoint', 'Reorder Point', 'Optional', false, 'Quantity', 'Stock', ['Reorder Point', 'Min Stock', 'Minimum Qty'], '2', 'Minimum stock trigger.'),
  field('brand', 'Brand', 'Recommended', false, 'Text', 'Product', ['Brand', 'Make Brand'], 'Toyota', 'Brand or label.'),
  field('partNumber', 'Part Number', 'MotorSpares', false, 'Text', 'MotorSpares', ['Part Number', 'Part No', 'OEM No', 'OEM Number'], '04465-0K290', 'Motor spares part number.'),
  field('alternatePartNumber', 'Alternate Part Number', 'MotorSpares', false, 'Text', 'MotorSpares', ['Alternate Part Number', 'Alt Part No', 'Cross Ref'], 'BP-GD6-F-ALT', 'Alternate part reference.'),
  field('vehicleMake', 'Vehicle Make', 'MotorSpares', false, 'Text', 'MotorSpares', ['Make', 'Vehicle Make'], 'Toyota', 'Compatible vehicle make.'),
  field('vehicleModel', 'Vehicle Model', 'MotorSpares', false, 'Text', 'MotorSpares', ['Model', 'Vehicle Model'], 'Hilux GD6', 'Compatible vehicle model.'),
  field('yearFrom', 'Year From', 'MotorSpares', false, 'Number', 'MotorSpares', ['Year From', 'From Year'], '2016', 'Compatibility start year.'),
  field('yearTo', 'Year To', 'MotorSpares', false, 'Number', 'MotorSpares', ['Year To', 'To Year'], '2024', 'Compatibility end year.'),
  field('side', 'Side', 'MotorSpares', false, 'Enum', 'MotorSpares', ['Side', 'LH/RH', 'Position'], 'Front', 'Vehicle side or position.'),
  field('condition', 'Condition', 'MotorSpares', false, 'Enum', 'MotorSpares', ['Condition', 'New Used'], 'New', 'Product condition.'),
  field('compatibilityTags', 'Compatibility Tags', 'MotorSpares', false, 'Tags', 'MotorSpares', ['Compatibility', 'Fitment Tags', 'Tags'], 'Hilux|GD6', 'Fitment tag list.'),
  field('engineCode', 'Engine Code', 'MotorSpares', false, 'Text', 'MotorSpares', ['Engine Code', 'Engine'], '1GD', 'Engine compatibility.'),
  field('chassisCode', 'Chassis Code', 'MotorSpares', false, 'Text', 'MotorSpares', ['Chassis Code', 'Chassis'], 'GUN125', 'Chassis compatibility.'),
  field('cogsAccount', 'COGS Account', 'Financial', false, 'Text', 'Financial', ['COGS Account', 'Cost Account'], '5000', 'COA COGS account placeholder.'),
  field('inventoryAssetAccount', 'Inventory Asset Account', 'Financial', false, 'Text', 'Financial', ['Inventory Asset Account', 'Asset Account'], '1200', 'COA inventory asset account placeholder.'),
  field('salesAccount', 'Sales Account', 'Financial', false, 'Text', 'Financial', ['Sales Account', 'Revenue Account'], '4000', 'COA sales account placeholder.'),
  field('taxCategory', 'Tax Category', 'Financial', false, 'Enum', 'Tax', ['Tax Category', 'VAT Category'], 'Standard', 'Tax category.'),
  field('marginPercent', 'Margin Percent', 'Financial', false, 'Number', 'Pricing', ['Margin %', 'Markup', 'Margin Percent'], '30', 'Margin indicator.'),
  field('stockValue', 'Stock Value', 'Financial', false, 'Money', 'Financial', ['Stock Value', 'Inventory Value'], '64.00', 'Imported stock value.'),
  field('size', 'Size', 'Optional', false, 'Text', 'Product', ['Size'], 'M10', 'Size descriptor.'),
  field('color', 'Color', 'Optional', false, 'Text', 'Product', ['Color', 'Colour'], 'Black', 'Color descriptor.'),
  field('unitOfMeasure', 'Unit of Measure', 'Optional', false, 'Text', 'Stock', ['Unit', 'UOM', 'Unit Of Measure'], 'pcs', 'Selling/count unit.'),
  field('manufacturer', 'Manufacturer', 'Optional', false, 'Text', 'Product', ['Manufacturer', 'Mfr'], 'Brembo', 'Manufacturer.'),
  field('warranty', 'Warranty', 'Optional', false, 'Text', 'Product', ['Warranty'], '6 months', 'Warranty note.'),
  field('notes', 'Notes', 'Optional', false, 'Text', 'System', ['Notes', 'Comment'], 'Imported from supplier sheet', 'Internal import notes.'),
  field('imageUrlPlaceholder', 'Image URL Placeholder', 'Optional', false, 'Text', 'Product', ['Image URL', 'Image', 'Photo'], 'https://example/image.jpg', 'Image placeholder only.'),
  field('tags', 'Tags', 'Optional', false, 'Tags', 'Product', ['Tags', 'Keywords'], 'brake|toyota', 'Search tags.')
];

export function getInventoryImportFieldDefinitions(): InventoryImportFieldDefinition[] {
  return inventoryImportFieldDefinitions;
}
