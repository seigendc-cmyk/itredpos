const fs = require("fs");
const path = "src/App.tsx";
let text = fs.readFileSync(path, "utf8");

text = text.replaceAll("window.history.pushState({}, '', '/pos-prototype');", "window.history.pushState({}, '', '/sci-auth-test');");
text = text.replaceAll("setCurrentPath('/pos-prototype');", "setCurrentPath('/sci-auth-test');");

text = text.replaceAll(
  "MANUAL ENTRYPOINT: ACCELERATED IP-FRAME PATH /POS-PROTOTYPE",
  "MANUAL ENTRYPOINT: ACCELERATED IP-FRAME PATH /SCI-AUTH-TEST"
);

fs.writeFileSync(path, text, "utf8");
console.log("BIOS gate now routes to SCI auth landing page.");
