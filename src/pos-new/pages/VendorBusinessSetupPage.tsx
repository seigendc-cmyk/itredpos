import { useState } from "react";
import {
  readPosAuthContext,
  resolveNextAuthStage,
  savePosAuthContext
} from "../auth/posVendorAuthState";
import {
  VendorBootstrapProfile,
  createEmptyVendorBootstrap
} from "../vendor/vendorBootstrapModel";

export default function VendorBusinessSetupPage() {

  const [profile, setProfile] =
    useState<VendorBootstrapProfile>(
      createEmptyVendorBootstrap()
    );

  function update<K extends keyof VendorBootstrapProfile>(
    field: K,
    value: VendorBootstrapProfile[K]
  ) {
    setProfile(previous => ({
      ...previous,
      [field]: value
    }));
  }


  function handleSaveProfile() {
    if (!profile.businessName.trim()) {
      alert("Business Name is required.");
      return;
    }

    if (!profile.ownerName.trim()) {
      alert("Owner Name is required.");
      return;
    }

    if (!profile.ownerPin.trim()) {
      alert("Owner PIN is required.");
      return;
    }

    const existing = readPosAuthContext();

    const vendorId =
      profile.vendorId ||
      `vendor_${Date.now()}`;

    const demoExpiresAt = new Date(
      Date.now() + profile.trialDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const nextContext = {
      ...(existing || {}),
      stage: "staffAccessRequired" as const,
      googleUid: existing?.googleUid || `demo-google-${Date.now()}`,
      googleEmail: existing?.googleEmail || profile.ownerEmail || "owner@example.com",
      vendorId,
      vendorName: profile.businessName,
      branchId: "main-branch",
      warehouseId: "main-warehouse",
      licenseStatus: "Demo" as const,
      demoExpiresAt,
      message: "Business profile created. Continue with staff access."
    };

    nextContext.stage = resolveNextAuthStage(nextContext);

    savePosAuthContext(nextContext);

    window.location.reload();
  }

  return (

<div className="min-h-screen bg-[#f7f5ef] p-8">

<div className="max-w-5xl mx-auto bg-white border border-gray-300">

<div className="border-b px-6 py-4">

<h1 className="text-xl font-black uppercase">
Business Setup Wizard
</h1>

<p className="text-sm mt-2">
Complete your business profile to activate your POS.
</p>

</div>

<div className="grid grid-cols-2 gap-6 p-6">

<div>

<label className="text-xs font-bold uppercase">
Business Name
</label>

<input
className="w-full border p-2"
value={profile.businessName}
onChange={e=>update("businessName",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Trading Name
</label>

<input
className="w-full border p-2"
value={profile.tradingName}
onChange={e=>update("tradingName",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Owner Name
</label>

<input
className="w-full border p-2"
value={profile.ownerName}
onChange={e=>update("ownerName",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Owner Email
</label>

<input
className="w-full border p-2"
value={profile.ownerEmail}
readOnly
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Phone
</label>

<input
className="w-full border p-2"
value={profile.phone}
onChange={e=>update("phone",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
WhatsApp
</label>

<input
className="w-full border p-2"
value={profile.whatsapp}
onChange={e=>update("whatsapp",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Business Type
</label>

<input
className="w-full border p-2"
value={profile.businessType}
onChange={e=>update("businessType",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
City
</label>

<input
className="w-full border p-2"
value={profile.city}
onChange={e=>update("city",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Default Branch
</label>

<input
className="w-full border p-2"
value={profile.defaultBranchName}
onChange={e=>update("defaultBranchName",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Default Warehouse
</label>

<input
className="w-full border p-2"
value={profile.defaultWarehouseName}
onChange={e=>update("defaultWarehouseName",e.target.value)}
/>

</div>

<div>

<label className="text-xs font-bold uppercase">
Owner PIN
</label>

<input
className="w-full border p-2"
value={profile.ownerPin}
onChange={e=>update("ownerPin",e.target.value)}
/>

</div>

<div className="flex items-end">

<button
type="button"
onClick={handleSaveProfile}
className="bg-orange-500 text-white px-6 py-3 font-bold uppercase w-full"
>

Continue ?

</button>

</div>

</div>

</div>

</div>

);

}

