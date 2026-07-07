const fs = require("fs");
const path = "src/pos-new/auth/posActivationCodeService.ts";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
`    const features = (data.features && typeof data.features === 'object') ? data.features as Record<string, boolean> : {};`,
`    const features = (data.features && typeof data.features === 'object') ? data.features as Record<string, boolean> : {};
    const tokenCode = text(data.tokenCode || data.code);
    const hasPosAccess =
      features.posAccess === true ||
      data.posAccess === true ||
      tokenCode.startsWith('POS-');`
);

text = text.replace(
`    if (!features.posAccess) {`,
`    if (!hasPosAccess) {`
);

text = text.replace(
`        posAccess: Boolean(features.posAccess),`,
`        posAccess: hasPosAccess,`
);

fs.writeFileSync(path, text, "utf8");
console.log("POS activation token compatibility patch applied.");
