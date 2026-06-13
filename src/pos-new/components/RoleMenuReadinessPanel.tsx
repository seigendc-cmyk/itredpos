import { useState } from 'react';
import { getRoleActionAccessRecords } from '../auth/roleActionPermissions';
import { getRoleMenuAccessRecords } from '../auth/roleMenuDefinitions';
import type { StaffGateRole } from '../auth/staffPinTypes';

const roles: StaffGateRole[] = ['Owner', 'Manager', 'Supervisor', 'Cashier', 'Stock Controller', 'Delivery Staff', 'Accountant', 'Viewer'];

export default function RoleMenuReadinessPanel() {
  const [role, setRole] = useState<StaffGateRole>('Owner');
  const menus = getRoleMenuAccessRecords(role);
  const actions = getRoleActionAccessRecords(role);

  return (
    <section className="bg-white border-2 border-[#b1b5c2] text-[#1e222b]">
      <div className="bg-[#1e222b] text-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <p className="text-[9px] text-orange-400 uppercase font-black">Role Menu Preview</p>
          <h2 className="text-sm font-black uppercase">Role Menu Readiness</h2>
        </div>
        <label className="text-[9px] uppercase font-black text-slate-200">Role Selector<select className="ml-2 p-2 border border-[#b1b5c2] bg-white text-[#1e222b] text-xs" value={role} onChange={(event) => setRole(event.target.value as StaffGateRole)}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Table title="Allowed Menus" headers={['Menu Key', 'Menu Label', 'Group', 'Access']}>
          {menus.map((row) => <tr key={row.menuKey}><Td strong>{row.menuKey}</Td><Td>{row.menuLabel}</Td><Td>{row.group}</Td><Td><Badge value={row.access} /></Td></tr>)}
        </Table>
        <Table title="Allowed Actions" headers={['Permission Key', 'Area', 'Access']}>
          {actions.map((row) => <tr key={row.permissionKey}><Td strong>{row.permissionKey}</Td><Td>{row.area}</Td><Td><Badge value={row.access} /></Td></tr>)}
        </Table>
      </div>
    </section>
  );
}

function Table({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return <div className="border border-[#b1b5c2] overflow-x-auto"><div className="p-2 text-[9px] uppercase font-black text-slate-600 bg-slate-50">{title}</div><table className="w-full text-left text-[10px]"><thead className="bg-[#1e222b] text-white uppercase"><tr>{headers.map((header) => <th key={header} className="p-2 whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#d6d9e0]">{children}</tbody></table></div>;
}

function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`p-2 align-top ${strong ? 'font-black text-[#1e222b]' : 'font-semibold text-slate-700'}`}>{children}</td>;
}

function Badge({ value }: { value: string }) {
  return <span className={`px-2 py-1 border text-[9px] font-black uppercase whitespace-nowrap ${value === 'Allowed' ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-orange-50 border-orange-400 text-orange-900'}`}>{value}</span>;
}
