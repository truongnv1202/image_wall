/** Domain triển lãm (production). Dev: `http://localhost:5000`. */
export const SITE_DOMAIN = "trienlam.gamegiaoduc.co" as const;

export const SITE_ORIGIN_HTTPS = `https://${SITE_DOMAIN}` as const;

/** Cổng dev local (khớp `package.json` script `dev`). */
export const DEV_PORT = 5000 as const;
