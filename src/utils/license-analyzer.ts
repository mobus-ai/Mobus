import type { LicenseInfo } from "../types.js";

export type UseCase = "commercial" | "academic" | "internal" | "redistribution";

const LICENSE_DB: Record<string, LicenseInfo> = {
  "cc0-1.0": {
    spdxId: "CC0-1.0",
    name: "Creative Commons Zero v1.0 Universal",
    commercialUse: true,
    attribution: false,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Dedicated to the public domain. No restrictions.",
  },
  "cc-by-4.0": {
    spdxId: "CC-BY-4.0",
    name: "Creative Commons Attribution 4.0",
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Free to use, share, and adapt with proper attribution.",
  },
  "cc-by-sa-4.0": {
    spdxId: "CC-BY-SA-4.0",
    name: "Creative Commons Attribution ShareAlike 4.0",
    commercialUse: true,
    attribution: true,
    shareAlike: true,
    redistribution: true,
    patentGrant: false,
    summary: "Free to use with attribution; derivatives must use the same license.",
  },
  "cc-by-nc-4.0": {
    spdxId: "CC-BY-NC-4.0",
    name: "Creative Commons Attribution NonCommercial 4.0",
    commercialUse: false,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Free for non-commercial use with attribution.",
  },
  "cc-by-nc-sa-4.0": {
    spdxId: "CC-BY-NC-SA-4.0",
    name: "Creative Commons Attribution NonCommercial ShareAlike 4.0",
    commercialUse: false,
    attribution: true,
    shareAlike: true,
    redistribution: true,
    patentGrant: false,
    summary: "Non-commercial use only with attribution; derivatives must use the same license.",
  },
  "cc-by-nd-4.0": {
    spdxId: "CC-BY-ND-4.0",
    name: "Creative Commons Attribution NoDerivatives 4.0",
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Free to share with attribution, but no derivative works allowed.",
  },
  "cc-by-nc-nd-4.0": {
    spdxId: "CC-BY-NC-ND-4.0",
    name: "Creative Commons Attribution NonCommercial NoDerivatives 4.0",
    commercialUse: false,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Non-commercial sharing only with attribution; no derivatives allowed.",
  },
  "apache-2.0": {
    spdxId: "Apache-2.0",
    name: "Apache License 2.0",
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: true,
    summary: "Permissive license with patent grant. Commercial use allowed with attribution.",
  },
  mit: {
    spdxId: "MIT",
    name: "MIT License",
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Very permissive. Commercial use allowed with attribution.",
  },
  "bsd-3-clause": {
    spdxId: "BSD-3-Clause",
    name: 'BSD 3-Clause "New" License',
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Permissive license. Commercial use allowed with attribution.",
  },
  "bsd-2-clause": {
    spdxId: "BSD-2-Clause",
    name: 'BSD 2-Clause "Simplified" License',
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Permissive license. Commercial use allowed with attribution.",
  },
  "gpl-3.0": {
    spdxId: "GPL-3.0",
    name: "GNU General Public License v3.0",
    commercialUse: true,
    attribution: true,
    shareAlike: true,
    redistribution: true,
    patentGrant: true,
    summary: "Strong copyleft. Derivative works must be open-sourced under GPL.",
  },
  "lgpl-3.0": {
    spdxId: "LGPL-3.0",
    name: "GNU Lesser General Public License v3.0",
    commercialUse: true,
    attribution: true,
    shareAlike: true,
    redistribution: true,
    patentGrant: true,
    summary: "Weak copyleft. Can link to proprietary software but modifications must stay LGPL.",
  },
  "agpl-3.0": {
    spdxId: "AGPL-3.0",
    name: "GNU Affero General Public License v3.0",
    commercialUse: true,
    attribution: true,
    shareAlike: true,
    redistribution: true,
    patentGrant: true,
    summary: "Strong copyleft including network use. All derivative works must be open-sourced.",
  },
  "odc-by": {
    spdxId: "ODC-By",
    name: "Open Data Commons Attribution License",
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Open data license. Free to use and share with attribution.",
  },
  "odc-odbl": {
    spdxId: "ODbL-1.0",
    name: "Open Data Commons Open Database License",
    commercialUse: true,
    attribution: true,
    shareAlike: true,
    redistribution: true,
    patentGrant: false,
    summary: "Open data license with share-alike. Derivative databases must use ODbL.",
  },
  pddl: {
    spdxId: "PDDL-1.0",
    name: "Open Data Commons Public Domain Dedication and License",
    commercialUse: true,
    attribution: false,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Public domain dedication for data. No restrictions.",
  },
  "cdla-permissive-2.0": {
    spdxId: "CDLA-Permissive-2.0",
    name: "Community Data License Agreement - Permissive 2.0",
    commercialUse: true,
    attribution: true,
    shareAlike: false,
    redistribution: true,
    patentGrant: false,
    summary: "Permissive data license. Commercial use allowed with attribution.",
  },
  "cdla-sharing-1.0": {
    spdxId: "CDLA-Sharing-1.0",
    name: "Community Data License Agreement - Sharing 1.0",
    commercialUse: true,
    attribution: true,
    shareAlike: true,
    redistribution: true,
    patentGrant: false,
    summary: "Data-specific copyleft. Shared data modifications must use same license.",
  },
};

function normalize(license: string): string {
  return license.toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
}

export function lookupLicense(license: string): LicenseInfo | null {
  const key = normalize(license);
  return LICENSE_DB[key] ?? null;
}

export function analyzeLicense(
  license: string | undefined,
  useCase: UseCase,
): { permitted: boolean; details: string; requirements: string[] } {
  if (!license || license === "License not specified") {
    return {
      permitted: false,
      details:
        "No license specified. Without a license, default copyright applies and usage may be restricted. Contact the dataset author for permission.",
      requirements: ["Contact dataset owner for explicit permission"],
    };
  }

  const info = lookupLicense(license);
  if (!info) {
    return {
      permitted: false,
      details: `Unknown license "${license}". Unable to determine permissions automatically. Review the license terms manually before use.`,
      requirements: ["Manually review the full license text"],
    };
  }

  const requirements: string[] = [];
  if (info.attribution) requirements.push("Provide attribution to the original author");
  if (info.shareAlike) requirements.push("Distribute derivative works under the same license");

  let permitted = true;
  let details = "";

  switch (useCase) {
    case "commercial":
      permitted = info.commercialUse;
      details = permitted
        ? `${info.name} permits commercial use. ${info.summary}`
        : `${info.name} does NOT permit commercial use. ${info.summary}`;
      break;

    case "academic":
      permitted = true;
      details = `${info.name} permits academic/research use. ${info.summary}`;
      break;

    case "internal":
      permitted = true;
      details = `${info.name} permits internal use. ${info.summary}`;
      if (!info.commercialUse) {
        requirements.push("Do not incorporate into commercial products or services");
      }
      break;

    case "redistribution":
      permitted = info.redistribution;
      details = permitted
        ? `${info.name} permits redistribution. ${info.summary}`
        : `${info.name} does NOT permit redistribution. ${info.summary}`;
      if (info.shareAlike) {
        requirements.push("Redistributed data must use the same license");
      }
      break;
  }

  return { permitted, details, requirements };
}
