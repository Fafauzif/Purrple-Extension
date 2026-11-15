/* Optional development-browser selection. Runtime extension has no dependency. */
const fs=require('node:fs');
exports.executable=()=>{
  if(process.env.PURRPLE_BROWSER)return process.env.PURRPLE_BROWSER;
  const cloud='/home/agent/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell';
  return fs.existsSync(cloud)?cloud:undefined; // Otherwise Playwright's installed browser.
};
