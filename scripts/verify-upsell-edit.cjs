const fs = require('fs');
const u = fs.readFileSync('src/components/mothermode/upsell/MotherModeUpsellPage.tsx', 'utf8');
const p = fs.readFileSync('src/components/mothermode/sales/UpsellPage.tsx', 'utf8');

const checks = {
  openMedia: p.includes('openMediaStudio'),
  pageEdit: u.includes('useSalesPageEdit'),
  ctaYes: u.includes('field="ctaYes"'),
  ctaNo: u.includes('field="ctaNo"'),
  guaranteeTitle: u.includes('field="guaranteeTitle"'),
  guaranteeBody: u.includes('field="guaranteeBody"'),
  features: u.includes('features.${fi}') || u.includes('features.` + fi') || /features\.\$\{fi\}/.test(u) || u.includes("features.${fi}"),
  featuresAlt: u.includes('features.') && u.includes('.title'),
  timer: u.includes('field="timerLabel"'),
  price: u.includes('field="priceLabel"'),
  bigIdea: u.includes('field="bigIdea"'),
  mediaField: u.includes('mediaField="mediaVideoPoster"'),
  acceptGuard: u.includes('if (pageEdit?.isEditMode) return'),
  mmCount: (u.match(/MmEditable/g) || []).length,
};

// more reliable features check
checks.featuresPath = /features\.\$\{fi\}\.title/.test(u) || u.includes('features.${fi}.title');
console.log(JSON.stringify(checks, null, 2));
