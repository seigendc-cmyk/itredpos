import { useEffect, useState } from 'react';
import type { InventoryImportColumn, InventoryImportMappingTemplate } from '../types/posTypes';
import { applyMappingTemplate, createImportMappingTemplate, deleteImportMappingTemplate, getImportMappingTemplates, updateImportMappingTemplate } from '../services/inventoryImportService';

interface InventoryImportMappingTemplateModalProps {
  open: boolean;
  columns: InventoryImportColumn[];
  staffName: string;
  onClose: () => void;
  onApply: (columns: InventoryImportColumn[]) => void;
  onNotice: (message: string) => void;
}

export default function InventoryImportMappingTemplateModal({ open, columns, staffName, onClose, onApply, onNotice }: InventoryImportMappingTemplateModalProps) {
  const [templates, setTemplates] = useState<InventoryImportMappingTemplate[]>([]);
  const [name, setName] = useState('New Mapping Template');
  const [sector, setSector] = useState('General');

  const load = () => void getImportMappingTemplates().then(setTemplates);
  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  const saveCurrent = async () => {
    await createImportMappingTemplate({
      templateName: name,
      sector,
      createdBy: staffName,
      mappings: columns.filter((column) => !column.ignored && column.mappedFieldKey).map((column) => ({ sourceColumnName: column.sourceColumnName, targetFieldKey: column.mappedFieldKey || '' }))
    });
    onNotice('Inventory import mapping template saved locally.');
    load();
  };

  const applyTemplate = async (templateId: string) => {
    onApply(await applyMappingTemplate(templateId, columns));
    onNotice('Mapping template applied locally.');
    onClose();
  };

  return (
    <div className="a5-tool-backdrop" role="dialog" aria-modal="true">
      <section className="a5-tool-modal a5-tool-modal--max">
        <header className="a5-tool-header">
          <div><span>Inventory Import</span><strong>Mapping Templates</strong></div>
          <div className="a5-tool-controls"><button type="button" onClick={onClose}>X</button></div>
        </header>
        <div className="a5-tool-body">
          <div className="a5-tool-grid">
            <label className="a5-field"><span>Template Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="a5-field"><span>Sector</span><input value={sector} onChange={(event) => setSector(event.target.value)} /></label>
          </div>
          <div className="a5-tool-actions">
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void saveCurrent()}>Save Current Mapping</button>
          </div>
          <div className="sci-pos-table-wrap">
            <table className="sci-pos-table">
              <thead><tr><th>Name</th><th>Sector</th><th>Mappings</th><th>Default</th><th>Action</th></tr></thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.templateId}>
                    <td>{template.templateName}</td>
                    <td>{template.sector}</td>
                    <td>{template.mappings.length}</td>
                    <td>{template.defaultTemplate ? 'Yes' : 'No'}</td>
                    <td className="pos-approval-actions">
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void applyTemplate(template.templateId)}>Apply</button>
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void updateImportMappingTemplate(template.templateId, { defaultTemplate: true }).then(load)}>Set Default</button>
                      <button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => void deleteImportMappingTemplate(template.templateId).then(load)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
