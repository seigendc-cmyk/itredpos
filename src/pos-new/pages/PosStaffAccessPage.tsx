import { useState } from "react";
import {
  readPosAuthContext,
  resolveNextAuthStage,
  savePosAuthContext
} from "../auth/posVendorAuthState";

export default function PosStaffAccessPage() {
  const context = readPosAuthContext();

  const [staffName, setStaffName] = useState("Owner");
  const [staffRole, setStaffRole] = useState("Owner");
  const [warehouseId, setWarehouseId] = useState(context?.warehouseId || "main-warehouse");
  const [pin, setPin] = useState("");

  function handleLogin() {
    if (pin !== "0000") {
      alert("Invalid access code. Default owner code is 0000.");
      return;
    }

    const nextContext = {
      ...(context || {}),
      staffId: "owner-staff",
      staffRole,
      warehouseId,
      message: `${staffName} signed into POS.`
    };

    nextContext.stage = resolveNextAuthStage(nextContext);

    savePosAuthContext(nextContext);
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-gray-300">
        <div className="border-b px-6 py-4">
          <h1 className="text-xl font-black uppercase text-[#1e222b]">
            Staff Access
          </h1>
          <p className="text-sm mt-2 text-slate-600">
            {context?.vendorName || "Vendor"} · Select staff profile and enter access code.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase">Staff Name</label>
            <select
              className="w-full border p-2"
              value={staffName}
              onChange={(event) => setStaffName(event.target.value)}
            >
              <option value="Owner">Owner</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase">Role</label>
            <select
              className="w-full border p-2"
              value={staffRole}
              onChange={(event) => setStaffRole(event.target.value)}
            >
              <option value="Owner">Owner</option>
              <option value="Manager">Manager</option>
              <option value="Cashier">Cashier</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase">Warehouse</label>
            <select
              className="w-full border p-2"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
              <option value="main-warehouse">Main Warehouse</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase">Access Code</label>
            <input
              className="w-full border p-2"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Default owner code: 0000"
            />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            className="w-full bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase py-3 rounded-none"
          >
            Open POS
          </button>
        </div>
      </div>
    </div>
  );
}
