const fs = require("fs");
const path = "src/pos-new/PosPrototypeApp.tsx";
let text = fs.readFileSync(path, "utf8");

// 1. Disable full-screen runtime license block
text = text.replace(
`  if (runtimeLicense && !runtimeLicense.allowed) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] p-6">
        <UpgradeRequiredPanel
          featureName={licenseBlockTitle(runtimeLicense)}
          currentPlan={planAccess.planCode}
          requiredPlan={getNextPlanCode(planAccess.planCode)}
          vendor={upgradeVendorContext}
          detail={runtimeLicense.noticeDetail || 'Contact SCI support to restore POS access.'}
          onActivated={(result) => setPlanLimitNotice(result.message)}
        />
      </main>
    );
  }`,
`  // Demo mode: do not block POS with license screen.
  // License notices are shown as non-blocking watermark/chip inside the POS shell.`
);

// 2. Always show demo/pending watermark when licenseNotice exists
text = text.replace(
`      {licenseNotice && (
        SHOW_DEV_BADGES ? (
          <>
            <div className="pos-demo-watermark" aria-hidden="true">Diagnostics</div>
            <div className="pos-demo-mode-chip">`,
`      {licenseNotice && (
        <>
          <div className="pos-demo-watermark" aria-hidden="true">DEMO MODE</div>
          <div className="pos-demo-mode-chip">`
);

text = text.replace(
`          </>
        ) : (
          <div className={\`mb-4 border px-4 py-3 text-[10px] font-bold uppercase tracking-wider \${licenseNotice.kind === 'expired' || licenseNotice.kind === 'blocked' ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-amber-300 bg-amber-50 text-amber-700'}\`}>
            <span className="mr-2">{licenseNotice.title}</span>
            <span>{licenseNotice.detail}</span>
          </div>
        )
      )}`,
`        </>
      )}`
);

// 3. Disable dashboard upgrade panel in demo/pending mode
text = text.replace(
`      {!planLimitNotice && activePage === 'DASHBOARD' && licenseNotice && (licenseNotice.kind === 'trial' || licenseNotice.kind === 'pending') && (
        <UpgradeRequiredPanel
          featureName="Plan Upgrade"
          currentPlan={planAccess.planCode}
          requiredPlan={getNextPlanCode(planAccess.planCode)}
          vendor={upgradeVendorContext}
          detail={licenseNotice.detail}
          onActivated={(result) => setPlanLimitNotice(result.message)}
        />
      )}`,
`      {/* Demo mode: dashboard remains open; licensing is shown by watermark only. */}`
);

fs.writeFileSync(path, text, "utf8");
console.log("POS license blocking disabled; demo watermark enabled.");
