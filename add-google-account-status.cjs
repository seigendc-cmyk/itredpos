const fs = require("fs");
const path = "src/sci-auth/VendorLandingPage.tsx";
let text = fs.readFileSync(path, "utf8");

// Add Google status display below the landing description
text = text.replace(
`          {authError && (
            <div className="mt-4 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-bold p-3">
              {authError}
            </div>
          )}`,
`          <div className="mt-5 mx-auto max-w-xl bg-white border border-slate-300 px-5 py-4 text-left">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Google Account Status
            </div>

            {googleProfile?.email ? (
              <div className="mt-2">
                <div className="text-sm font-black text-emerald-700 uppercase">
                  Signed in
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  <span className="font-bold">Name:</span> {googleProfile.displayName || "Google User"}
                </div>
                <div className="text-sm text-slate-700">
                  <span className="font-bold">Email:</span> {googleProfile.email}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm font-black text-slate-600 uppercase">
                Signed out
              </div>
            )}
          </div>

          {authError && (
            <div className="mt-4 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-bold p-3">
              {authError}
            </div>
          )}`
);

fs.writeFileSync(path, text, "utf8");
console.log("Google account status added to SCI vendor landing page.");
