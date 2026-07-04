import { Fragment, useMemo, useState } from 'react';
import {
  calculatePermissionCell,
  getPermissionMatrix,
  getPermissionMatrixActivityEvents,
  recordSecurityMatrixEvent,
  resetAllRolesToDefault,
  resetRoleToDefault,
  togglePermissionForRole
} from '../auth/permissionMatrixService';
import { getEffectiveMenuKeysForRole, roleHasEffectivePermission } from '../auth/effectivePermissionService';
import { runPermissionMatrixSelfTest } from '../auth/permissionMatrixSelfTest';
import { roleMenuDefinitions } from '../auth/roleMenuDefinitions';
import { securityPermissionAreas } from '../auth/securityRightsCatalog';
import type {
  PermissionArea,
  SecurityPermissionMatrix,
  SecurityPermissionMatrixCell,
  SecurityPermissionRight,
  SecurityRightsFilterState,
  SecurityRoleKey
} from '../auth/permissionMatrixTypes';

const staffId = 'BUILD-OWNER';

export default function SecurityRightsMatrix() {
  const [matrix, setMatrix] = useState<SecurityPermissionMatrix>(() => getPermissionMatrix());
  const [filter, setFilter] = useState<SecurityRightsFilterState>({ area: 'ALL', view: 'All Rights', search: '' });
  const [selected, setSelected] = useState<SecurityPermissionRight>(matrix.rows[0]?.permission);
  const [checkRole, setCheckRole] = useState<SecurityRoleKey>('Cashier');
  const [checkPermission, setCheckPermission] = useState('settings.permissions.edit');
  const [checkMenu, setCheckMenu] = useState('settings');
  const [notice, setNotice] = useState('');
  const activity = getPermissionMatrixActivityEvents().slice(0, 4);
  const selfTest = useMemo(() => runPermissionMatrixSelfTest(), [matrix.updatedAt]);
  const resolutionCell = calculatePermissionCell(checkPermission, checkRole);
  const canOpenMenu = getEffectiveMenuKeysForRole(checkRole).includes(checkMenu);
  const hasPermission = roleHasEffectivePermission(checkRole, checkPermission);

  const filteredRows = useMemo(() => {
    const search = filter.search.trim().toLowerCase();
    return matrix.rows.filter((row) => {
      const matchesArea = filter.area === 'ALL' || row.permission.area === filter.area;
      const matchesSearch = !search || row.permission.permissionKey.toLowerCase().includes(search) || row.permission.label.toLowerCase().includes(search) || row.permission.description.toLowerCase().includes(search);
      const matchesView = filter.view === 'All Rights'
        || (filter.view === 'Allowed Only' && row.cells.some((cell) => cell.allowed))
        || (filter.view === 'High Risk' && (row.permission.riskLevel === 'High' || row.permission.riskLevel === 'Critical'))
        || (filter.view === 'Overrides' && row.cells.some((cell) => cell.changedAt));
      return matchesArea && matchesSearch && matchesView;
    });
  }, [matrix, filter]);

  const groupedRows = useMemo(() => {
    return securityPermissionAreas
      .map((area) => ({ area, rows: filteredRows.filter((row) => row.permission.area === area) }))
      .filter((group) => group.rows.length > 0);
  }, [filteredRows]);

  const reload = () => setMatrix(getPermissionMatrix());

  const toggle = (cell: SecurityPermissionMatrixCell, permission: SecurityPermissionRight) => {
    if (cell.locked) {
      setNotice('Owner rights are locked during build-development.');
      return;
    }
    if (permission.riskLevel === 'High' || permission.riskLevel === 'Critical') {
      setNotice(`${permission.riskLevel} risk right changed locally: ${permission.label}. Add a reason in production activation builds.`);
    }
    togglePermissionForRole(permission.permissionKey, cell.roleKey, staffId);
    reload();
  };

  const searched = (value: string) => {
    setFilter({ ...filter, search: value });
    recordSecurityMatrixEvent({ eventType: 'SECURITY_RIGHT_SEARCHED', label: 'Security Right Searched', message: value ? `Search filter changed to "${value}".` : 'Search filter cleared.', staffId });
  };

  const selectRight = (permission: SecurityPermissionRight) => {
    setSelected(permission);
    recordSecurityMatrixEvent({ eventType: 'SECURITY_RIGHT_SELECTED', label: 'Security Right Selected', message: `${permission.permissionKey} selected.`, staffId, permissionKey: permission.permissionKey });
  };

  const resetAll = () => {
    if (!window.confirm('Reset all local security rights overrides to defaults?')) return;
    setMatrix(resetAllRolesToDefault(staffId));
    setNotice('Local security rights overrides reset to defaults.');
  };

  const roleLabels = matrix.roles.map((role) => role.roleLabel);

  return (
    <section className="bg-white border-2 border-[#b1b5c2] text-[#1e222b]">
      <div className="bg-[#1e222b] text-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <p className="text-[9px] text-orange-400 uppercase font-black">Security Groups</p>
          <h2 className="text-sm font-black uppercase">Staff Access Rights</h2>
          <p className="text-[10px] text-slate-200 font-bold uppercase">Manage role-based POS permissions using security groups and logical hierarchy.</p>
        </div>
        <span className="border border-orange-500 text-orange-300 px-2 py-1 text-[9px] font-black uppercase">Local Preview</span>
      </div>

      <div className="p-3 space-y-3">
        {notice && <div className="border border-orange-400 bg-orange-50 p-2 text-[10px] text-orange-950 font-bold uppercase">{notice}</div>}
        <div className="border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-950 font-bold uppercase">
          Role hierarchy is applied from top to bottom. Higher roles inherit approved lower-role rights where appropriate, while specialized roles such as Stock Controller and Delivery Staff receive area-specific access without inheriting unrelated cashier or finance rights.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Select label="View Filter" value={filter.view} options={['All Rights', 'Allowed Only', 'High Risk', 'Overrides']} onChange={(value) => setFilter({ ...filter, view: value as SecurityRightsFilterState['view'] })} />
          <Select label="Area Filter" value={filter.area} options={['ALL', ...securityPermissionAreas]} onChange={(value) => setFilter({ ...filter, area: value as PermissionArea | 'ALL' })} />
          <label className="md:col-span-2 text-[9px] uppercase font-black text-slate-500">Search Security Right<input className="w-full p-2 border border-[#b1b5c2] text-xs" value={filter.search} onChange={(event) => searched(event.target.value)} /></label>
          <Action label="Find Security Right" onClick={() => setNotice(`${filteredRows.length} matching security right(s).`)} />
          <Action label="Reset Defaults" onClick={resetAll} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Action label="New Group" onClick={() => setNotice('Custom security groups will be enabled after repository activation.')} />
          <Action label="Copy Group" onClick={() => { recordSecurityMatrixEvent({ eventType: 'SECURITY_GROUP_COPY_PLACEHOLDER', label: 'Security Group Copy', message: 'Role permissions copied into draft override.', staffId }); setNotice('Selected role permissions copied into a draft override.'); }} />
          <Action label="Print" onClick={() => { recordSecurityMatrixEvent({ eventType: 'SECURITY_GROUP_PRINT_PLACEHOLDER', label: 'Security Group Print', message: 'Permission matrix print prepared.', staffId }); setNotice('Permission matrix print prepared.'); }} />
          <Action label="Save Changes" primary onClick={() => setNotice('Permission matrix changes saved for review.')} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-3">
          <div className="border border-[#b1b5c2] overflow-auto max-h-[720px]">
            <table className="w-full text-left text-[10px] min-w-[1160px]">
              <thead className="bg-[#1e222b] text-white uppercase sticky top-0 z-10">
                <tr>
                  <th className="p-2 sticky left-0 bg-[#1e222b] min-w-[270px]">Security Right</th>
                  {roleLabels.map((role) => <th key={role} className="p-2 text-center min-w-[92px]">{role}</th>)}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <Fragment key={group.area}>
                    <tr key={`${group.area}-group`} className="bg-slate-100">
                      <td colSpan={matrix.roles.length + 1} className="p-2 text-[9px] font-black uppercase text-slate-600 border-y border-[#b1b5c2]">{group.area}</td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.permission.permissionKey} className={`border-b border-[#d6d9e0] ${selected?.permissionKey === row.permission.permissionKey ? 'bg-orange-50' : 'bg-white'}`}>
                        <td className="p-2 sticky left-0 bg-inherit border-r border-[#d6d9e0] align-top">
                          <button type="button" className="text-left w-full" onClick={() => selectRight(row.permission)}>
                            <strong className="block text-[10px] uppercase text-[#1e222b]">{row.permission.label}</strong>
                            <span className="block text-[9px] text-slate-500 normal-case">{row.permission.permissionKey}</span>
                          </button>
                        </td>
                        {row.cells.map((cell) => <MatrixCell key={`${cell.permissionKey}-${cell.roleKey}`} cell={cell} permission={row.permission} onToggle={() => toggle(cell, row.permission)} />)}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="border border-[#b1b5c2] bg-slate-50 p-3 space-y-3">
            <div className="border border-[#b1b5c2] bg-white p-2 space-y-2">
              <div>
                <p className="text-[9px] text-orange-600 uppercase font-black">Permission Resolution Check</p>
                <h3 className="text-sm font-black uppercase text-[#1e222b]">Effective Access</h3>
              </div>
              <Select label="Role" value={checkRole} options={matrix.roles.map((role) => role.roleKey)} onChange={(value) => setCheckRole(value as SecurityRoleKey)} />
              <Select label="Permission Key" value={checkPermission} options={matrix.rows.map((row) => row.permission.permissionKey)} onChange={setCheckPermission} />
              <Select label="Menu Key" value={checkMenu} options={roleMenuDefinitions.map((menu) => menu.menuKey)} onChange={setCheckMenu} />
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Has Permission" value={hasPermission ? 'Allowed' : 'Denied'} />
                <Metric label="Can Open Menu" value={canOpenMenu ? 'Allowed' : 'Denied'} />
                <Metric label="Source" value={resolutionCell.inheritanceMode} />
                <Metric label="Inherited From" value={resolutionCell.inheritedFrom || 'None'} />
              </div>
              <div className="border border-[#d6d9e0] bg-slate-50 p-2 text-[9px] font-bold uppercase text-slate-700">{resolutionCell.reason}</div>
            </div>

            <div className="border border-[#b1b5c2] bg-white p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] text-orange-600 uppercase font-black">Matrix Self Test</p>
                  <h3 className="text-sm font-black uppercase text-[#1e222b]">Permission Checks</h3>
                </div>
                <span className={`px-2 py-1 border text-[9px] font-black uppercase ${selfTest.passed ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-red-50 border-red-400 text-red-800'}`}>{selfTest.passed ? 'Passed' : 'Failed'}</span>
              </div>
              <div className="max-h-56 overflow-auto border border-[#d6d9e0]">
                <table className="w-full text-left text-[9px]">
                  <thead className="bg-[#1e222b] text-white uppercase sticky top-0">
                    <tr><th className="p-2">Case</th><th className="p-2">Result</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#d6d9e0]">
                    {selfTest.results.map((result) => (
                      <tr key={`${result.roleKey}-${result.permissionKey}`}>
                        <td className="p-2">
                          <strong className="block uppercase">{result.label}</strong>
                          <span className="block text-slate-500">{result.roleKey} / {result.permissionKey}</span>
                        </td>
                        <td className={`p-2 font-black uppercase ${result.passed ? 'text-emerald-700' : 'text-red-700'}`}>{result.passed ? 'Pass' : `Fail ${String(result.actual)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-[9px] text-orange-600 uppercase font-black">Permission Help</p>
              <h3 className="text-sm font-black uppercase text-[#1e222b]">{selected?.label || 'Select a Right'}</h3>
            </div>
            {selected && (
              <div className="space-y-2 text-[10px] font-semibold text-slate-700">
                <Metric label="Area" value={selected.area} />
                <Metric label="Risk Level" value={selected.riskLevel} />
                <Metric label="Default Roles" value={selected.defaultRoles.join(', ')} />
                <p>{selected.description}</p>
                {selected.warningNote && <div className="border border-orange-400 bg-orange-50 p-2 text-orange-950 font-bold uppercase">{selected.warningNote}</div>}
                <p>Tick or clear checkboxes to allow or deny a right for a role. Inherited rights come from the role hierarchy. Owner rights are locked during build-development.</p>
              </div>
            )}
            <div className="border-t border-[#b1b5c2] pt-2">
              <div className="text-[9px] text-slate-500 uppercase font-black mb-2">Recent Activity</div>
              <div className="space-y-2">
                {activity.map((event) => <div key={event.eventId} className="border border-[#d6d9e0] bg-white p-2 text-[9px] uppercase"><strong>{event.label}</strong><p className="text-slate-600 font-semibold">{event.message}</p></div>)}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function MatrixCell({ cell, permission, onToggle }: { cell: SecurityPermissionMatrixCell; permission: SecurityPermissionRight; onToggle: () => void }) {
  const danger = permission.riskLevel === 'High' || permission.riskLevel === 'Critical';
  return (
    <td className="p-2 text-center align-middle">
      <label className="inline-flex flex-col items-center gap-1 cursor-pointer" title={`${cell.inheritanceMode}${cell.inheritedFrom ? ` from ${cell.inheritedFrom}` : ''}`}>
        <input type="checkbox" checked={cell.allowed} disabled={cell.locked} onChange={onToggle} className="w-4 h-4 accent-orange-600" />
        <span className={`text-[8px] font-black uppercase ${cell.locked ? 'text-slate-500' : danger ? 'text-orange-700' : cell.inheritanceMode === 'Inherited' ? 'text-blue-700' : 'text-slate-600'}`}>
          {cell.locked ? 'Locked' : cell.inheritanceMode === 'Inherited' ? 'Inh' : cell.inheritanceMode === 'Direct' ? 'Direct' : 'Denied'}
        </span>
      </label>
    </td>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<select className="w-full p-2 border border-[#b1b5c2] text-xs bg-white" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Action({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" className={`px-3 py-2 border text-[9px] font-black uppercase ${primary ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b1b5c2] text-[#1e222b] hover:bg-orange-50'}`} onClick={onClick}>{label}</button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#d6d9e0] bg-white p-2"><span className="block text-[8px] uppercase font-black text-slate-500">{label}</span><strong className="block text-[10px] uppercase text-[#1e222b] break-words">{value}</strong></div>;
}
