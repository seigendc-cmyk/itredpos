const fs = require("fs");
const path = "src/pos-new/PosPrototypeApp.tsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("SCI DEMO MODE WATERMARK")) {
  text = text.replace(
`    >
      {licenseNotice && (`,
`    >
      {/* SCI DEMO MODE WATERMARK */}
      <div
        style={{
          position: "fixed",
          top: "45%",
          left: "55%",
          transform: "translate(-50%, -50%) rotate(-18deg)",
          zIndex: 9999,
          pointerEvents: "none",
          fontSize: "64px",
          fontWeight: 900,
          letterSpacing: "0.12em",
          color: "rgba(255, 102, 0, 0.10)",
          border: "4px solid rgba(255, 102, 0, 0.10)",
          padding: "20px 36px",
          textTransform: "uppercase"
        }}
      >
        DEMO MODE
      </div>

      {licenseNotice && (`
  );
}

fs.writeFileSync(path, text, "utf8");
console.log("Demo watermark added.");
