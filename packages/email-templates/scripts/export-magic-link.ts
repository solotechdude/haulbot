import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAGIC_LINK_EMAIL_PLACEHOLDER,
  MAGIC_LINK_PORTAL_PLACEHOLDER,
} from "../src/placeholders";
import { renderMagicLinkEmail } from "../src/render-magic-link";

const outDir = join(import.meta.dir, "../out");
mkdirSync(outDir, { recursive: true });

const { html, text } = await renderMagicLinkEmail({
  portalUrl: MAGIC_LINK_PORTAL_PLACEHOLDER,
  driverEmail: MAGIC_LINK_EMAIL_PLACEHOLDER,
});

writeFileSync(join(outDir, "magic-link.html"), html);
writeFileSync(join(outDir, "magic-link.txt"), text);

console.log("Wrote packages/email-templates/out/magic-link.{html,txt}");
