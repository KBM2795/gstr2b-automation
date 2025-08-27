const { chromium } = require('playwright');
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

// Optional AntiCaptcha require
let ac;
try { ac = require('@antiadmin/anticaptchaofficial'); }
catch { console.log('AntiCaptcha module not installed; continuing without it.'); ac = { setAPIKey:()=>{}, setSoftId:()=>{}, solveImage: async ()=>'' }; }

// Ensure fetch available
if (typeof fetch === 'undefined') {
  global.fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
}

// Credentials & period will be provided via API (POST body)
let gstUser, gstPass, quarter, month, finYear;

// Configure AntiCaptcha if key present
const ANTI_CAPTCHA_KEY = process.env.ANTICAPTCHA_API_KEY || '';
if (ANTI_CAPTCHA_KEY) {
  ac.setAPIKey(ANTI_CAPTCHA_KEY);
  ac.setSoftId(0);
}

// === Error handling utilities ===
function safeExecute(fn, label = 'operation') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.log(`Error in ${label}:`, error.message);
      return null;
    }
  };
}

// === Captcha (TrueCaptcha) ===
function get_captcha(image_data, callback){
    try {
        if (!process.env.TRUECAPTCHA_USERID || !process.env.TRUECAPTCHA_APIKEY) {
            callback({ error: 'TrueCaptcha credentials not configured' });
            return;
        }
        image_data = image_data.replace(/^data:image\/(png|jpg|jpeg|gif);base64,/, "");
        const params = {
            userid: process.env.TRUECAPTCHA_USERID,
            apikey: process.env.TRUECAPTCHA_APIKEY,
            data: image_data
        };
        fetch('https://api.apitruecaptcha.org/one/gettext', {
            method: 'post',
            body: JSON.stringify(params),
            headers: { 'Content-Type': 'application/json' }
        }).then(r=>{
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        }).then(d=>callback(d)).catch(err=>callback({ error: err.message }));
    } catch (error) {
        callback({ error: error.message });
    }
}

function solveWithTrueCaptcha(buffer){
  return new Promise(resolve => {
    try {
      if (!buffer || buffer.length === 0) {
        resolve({ code: '', limited: false });
        return;
      }
      const b64 = buffer.toString('base64');
      get_captcha(b64, data => {
        if (data && data.result) {
          const cleaned = String(data.result).trim().replace(/[^A-Za-z0-9]/g,'').toUpperCase();
          console.log('TrueCaptcha raw:', data.result, 'cleaned:', cleaned);
          resolve({ code: cleaned, limited:false });
        } else {
          const msg = data && (data.error_message || data.error || JSON.stringify(data));
          const limited = /free usage limit|quota exceeded|insufficient|expired/i.test(msg||'');
          if (limited) console.log('TrueCaptcha limit reached, will fallback OCR.', msg);
          else console.log('TrueCaptcha response missing result:', msg);
          resolve({ code: '', limited });
        }
      });
    } catch (error) {
      console.log('TrueCaptcha solve error:', error.message);
      resolve({ code: '', limited: false });
    }
  });
}

// Fallback using OCR.Space (free key has limits). Set OCRSPACE_API_KEY in env for better quota.
async function solveWithOcrSpace(buffer){
  try {
    if (!buffer || buffer.length === 0) {
      console.log('OCR.Space: no buffer provided');
      return '';
    }
    const apiKey = process.env.OCRSPACE_API_KEY || 'helloworld';
    const FormData = require('form-data');
    const form = new FormData();
    form.append('language','eng');
    form.append('isOverlayRequired','false');
    form.append('OCREngine','2');
    form.append('base64Image','data:image/png;base64,'+buffer.toString('base64'));
    
    const resp = await fetch('https://api.ocr.space/parse/image', { 
      method:'POST', 
      headers:{ 'apikey': apiKey }, 
      body: form
    });
    
    if (!resp.ok) {
      console.log('OCR.Space HTTP error:', resp.status);
      return '';
    }
    const json = await resp.json().catch(()=>({}));
    if (json.IsErroredOnProcessing) {
      console.log('OCR.Space processing error:', json.ErrorMessage);
      return '';
    }
    const parsed = json && json.ParsedResults && json.ParsedResults[0] && json.ParsedResults[0].ParsedText || '';
    const cleaned = parsed.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
    if (cleaned) console.log('OCR.Space raw:', parsed.trim(), 'cleaned:', cleaned);
    return cleaned;
  } catch(e){ 
    console.log('OCR.Space error', e.message); 
    return ''; 
  }
}

function ensureDir(p){ 
  try {
    if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); 
  } catch(e) {
    console.log('Failed to create directory:', p, e.message);
  }
}

// Enhanced directory creation with logging
function ensureDirWithLogging(dirPath, description) {
  try {
    if (fs.existsSync(dirPath)) {
      console.log(`  ✓ ${description}: Already exists - ${dirPath}`);
      return true;
    } else {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`  + ${description}: Created - ${dirPath}`);
      return true;
    }
  } catch (error) {
    console.log(`  ✗ ${description}: Failed to create - ${dirPath}`, error.message);
    return false;
  }
}

function findCaptchaFrame(page){ 
  try {
    const frames=page.frames(); 
    for(const f of frames){ 
      if(/login|captcha/i.test(f.url())) return f; 
    } 
    return page.mainFrame(); 
  } catch(e) {
    console.log('Error finding captcha frame:', e.message);
    return page.mainFrame();
  }
}

async function locateCaptchaElement(container){ 
  try {
    const sels=['#captchaImg','img#captchaImg','img[alt*="captcha" i]','img[src*="captcha" i]']; 
    for(const sel of sels){ 
      const loc=container.locator(sel); 
      if(await loc.count()) return loc.first(); 
    } 
    const canvas=container.locator('canvas'); 
    if(await canvas.count()) return canvas.first(); 
    return null; 
  } catch(e) {
    console.log('Error locating captcha element:', e.message);
    return null;
  }
}

async function refreshCaptcha(container){ 
  try {
    const sels=['#captchaReload','[title*="Refresh" i]','[aria-label*="Refresh" i]','text=Refresh']; 
    for(const sel of sels){ 
      try{ 
        const loc=container.locator(sel); 
        if(await loc.count()){ 
          await loc.first().click({timeout:1000}).catch(()=>{}); 
          return true; 
        } 
      }catch{} 
    } 
    return false; 
  } catch(e) {
    console.log('Error refreshing captcha:', e.message);
    return false;
  }
}

async function solveCaptchaFromPage(page){
  // Returns { code, trueCaptchaLimited }
  try {
    ensureDir('samples');
    const frame=findCaptchaFrame(page);
    if (!frame) {
      console.log('No captcha frame found');
      return { code:'', trueCaptchaLimited:false };
    }
    
    let trueCaptchaLimited=false;
    for(let attempt=1; attempt<=3; attempt++){ // fewer internal attempts; external logic handles mismatch retries
      try {
        const el=await locateCaptchaElement(frame);
        if(!el) {
          console.log(`Captcha element not found on attempt ${attempt}`);
          continue;
        }
        await el.waitFor({timeout:6000}).catch(()=>{});
        const raw=await el.screenshot().catch(e => {
          console.log(`Screenshot failed on attempt ${attempt}:`, e.message);
          return null;
        });
        if (!raw) continue;
        
        const rawPath = `samples/captcha-${attempt}.png`;
        try {
          fs.writeFileSync(rawPath, raw);
        } catch(e) {
          console.log('Failed to save captcha screenshot:', e.message);
        }
        
        let solved='';
        if(!trueCaptchaLimited){
          const { code, limited } = await solveWithTrueCaptcha(raw);
          trueCaptchaLimited = limited;
          solved = code;
          if(trueCaptchaLimited){
            // Immediate return; do NOT fallback when API quota / error for TrueCaptcha
            console.log('TrueCaptcha limited, returning early');
            return { code:'', trueCaptchaLimited:true };
          }
        }
        if(!solved && ANTI_CAPTCHA_KEY){
          try { 
            const b64=raw.toString('base64'); 
            solved=await ac.solveImage(b64,true).catch(e=>{ 
              console.log('AntiCaptcha error', e); 
              return '';
            }); 
            if(solved) console.log('AntiCaptcha solved:', solved);
          } catch(e){ 
            console.log('AntiCaptcha fallback exception:', e.message); 
          }
        }
        if(!solved){ 
          const ocrSpace = await solveWithOcrSpace(raw); 
          if(ocrSpace) solved = ocrSpace; 
        }
        const cleaned=(solved||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
        if(/^[A-Z0-9]{4,10}$/.test(cleaned)){ 
          console.log(`Accepted captcha attempt ${attempt}: ${cleaned}`); 
          return { code:cleaned, trueCaptchaLimited:false }; 
        }
        console.log(`Attempt ${attempt} got '${cleaned}' (invalid)`);
      } catch(e){ 
        console.log(`Captcha attempt ${attempt} error: ${e.message}`); 
      }
      await refreshCaptcha(frame).catch(()=>{});
      await page.waitForTimeout(1000);
    }
    console.log('All automated captcha attempts failed (internal).');
    return { code:'', trueCaptchaLimited:false };
  } catch(error) {
    console.log('Captcha solving failed completely:', error.message);
    return { code:'', trueCaptchaLimited:false };
  }
}

async function clickLogin(page){ 
  const selectors=['button[type=submit].btn-primary:has-text("Login")','button.btn-primary:has-text("Login")','button:has-text("Login")','text=Login','form button[type=submit]']; 
  const frames=[page.mainFrame(), ...page.frames()]; 
  for(const sel of selectors){ 
    for(const f of frames){ 
      try{ 
        const loc=f.locator(sel); 
        if(await loc.count()){ 
          await loc.first().waitFor({state:'visible',timeout:5000}).catch(()=>{}); 
          if(!(await loc.first().isEnabled().catch(()=>false))) continue; 
          await loc.first().scrollIntoViewIfNeeded().catch(()=>{}); 
          const clicked=await loc.first().click({timeout:3000}).then(()=>true).catch(()=>false); 
          if(clicked){ 
            console.log(`Clicked selector: ${sel}`); 
            return; 
          } 
        } 
      }catch{} 
    } 
  } 
  console.log('Login button not clicked with CSS; using JS fallback'); 
  await page.evaluate(()=>{ 
    const cand=[...document.querySelectorAll('button[type=submit],button,input[type=submit]')].find(el=>/login/i.test(el.textContent||el.value||'')); 
    if(cand) cand.click(); 
  }); 
}

async function isOnLogin(page){ 
  const loginButtonVisible = await page.locator('button:has-text("Login")').first().isVisible().catch(()=>false); 
  const userField = await page.locator('#username').first().isVisible().catch(()=>false); 
  const returnsDashboard = await page.locator('text=/RETURN\s+DASHBOARD/i').first().isVisible().catch(()=>false); 
  return (loginButtonVisible || userField) && !returnsDashboard; 
}

// === New helpers ===
async function openGstr2bDownload(page) {
  try {
    console.log('Waiting for download buttons to be available...');
    await page.waitForTimeout(1500); // Increased initial wait
    
    // Wait for download buttons to be present
    await page.waitForSelector('button:has-text("DOWNLOAD"), button:has-text("Download")', { timeout: 15000 }).catch(() => {
      console.log('Download buttons not found within timeout');
    });
    
    const downloadButtons = page.locator('button:has-text("DOWNLOAD"), button:has-text("Download")');
    const total = await downloadButtons.count().catch(() => 0);
    
    if (!total) { 
      console.log('No DOWNLOAD buttons found.'); 
      return false; 
    }
    
    console.log(`Found ${total} download button(s), analyzing for GSTR-2B...`);

    async function scoreButton(btn) {
      return await btn.evaluate(node => {
        function anc(el, depth = 0, max = 6, acc = []) { 
          if (!el || depth > max) return acc; 
          acc.push(el); 
          return anc(el.parentElement, depth + 1, max, acc);
        } 
        const chain = anc(node); 
        const TEXT = chain.map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean); 
        let block = ''; 
        for (const t of TEXT) { 
          if (/GSTR\s*-?2B/i.test(t)) { 
            block = t; 
            break; 
          } 
        } 
        block = block || TEXT[0] || ''; 
        const codes = (block.match(/GSTR\s*-?\d+[A-Z]?/gi) || []).map(s => s.replace(/\s+/g, '').toUpperCase()); 
        const has2B = codes.includes('GSTR2B'); 
        const unwanted = codes.filter(c => c && c !== 'GSTR2B'); 
        return { block, codes, has2B, unwanted: unwanted.length > 0, length: block.length };
      });
    }
    
    let candidates = [];
    for (let i = 0; i < total; i++) { 
      const btn = downloadButtons.nth(i); 
      const sc = await scoreButton(btn); 
      console.log(`Button ${i + 1} analysis:`, sc);
      if (sc.has2B && !sc.unwanted) candidates.push({ idx: i, sc }); 
    }
    
    if (!candidates.length) {
      console.log('No strict GSTR2B buttons found, relaxing criteria...');
      for (let i = 0; i < total; i++) { 
        const btn = downloadButtons.nth(i); 
        const sc = await scoreButton(btn); 
        if (sc.has2B) candidates.push({ idx: i, sc }); 
      }
    }
    
    if (!candidates.length) { 
      console.log('No GSTR2B related DOWNLOAD buttons found.'); 
      return false; 
    }
    
    candidates.sort((a, b) => { 
      if (!!a.sc.unwanted === !!b.sc.unwanted) return a.sc.length - b.sc.length; 
      return a.sc.unwanted ? 1 : -1; 
    });
    
    const chosen = candidates[0];
    const btn = downloadButtons.nth(chosen.idx);
    console.log('Selected GSTR2B DOWNLOAD candidate:', chosen.sc);
    
    // Enhanced button clicking with verification
    try {
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      await btn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000); // Brief pause before clicking
      
      console.log('Clicking GSTR-2B download button...');
      await btn.click({ timeout: 6000 });
      console.log('GSTR-2B download button clicked successfully');
      
      // Wait for page transition or content loading
      await page.waitForTimeout(3000);
      return true;
      
    } catch(e) {
      console.log('Primary click failed, trying JavaScript click:', e.message); 
      try {
        await btn.evaluate(el => { el.click(); });
        console.log('JavaScript click successful');
        await page.waitForTimeout(3000);
        return true;
      } catch(jsError) {
        console.log('JavaScript click also failed:', jsError.message);
        return false;
      }
    }
  } catch(e) { 
    console.log('openGstr2bDownload error:', e.message); 
    return false; 
  }
}

// === Excel generation & download ===
async function generateAndDownloadExcel(page, { quarter, month, finYear, storagePath = 'downloads', client_folder = '' }) {
  // Create the folder structure: {storagePath}/{finYear}/{quarter}/{month}/{client_folder}/
  const yearFolder = path.join(storagePath, finYear.replace(/\s+/g, ''));
  const quarterFolder = path.join(yearFolder, quarter.replace(/\s+/g, ''));
  const monthFolder = path.join(quarterFolder, month.replace(/\s+/g, ''));
  const clientFolder = client_folder ? path.join(monthFolder, client_folder) : monthFolder;
  
  console.log('Storage configuration:');
  console.log('- Base storage path:', storagePath);
  console.log('- Client folder:', client_folder);
  console.log('- Target folder:', clientFolder);
  
  // Ensure each level of directory structure exists (only create if needed)
  console.log('Checking folder structure:');
  ensureDirWithLogging(storagePath, 'Base storage');
  ensureDirWithLogging(yearFolder, `Year folder (${finYear.replace(/\s+/g, '')})`);
  ensureDirWithLogging(quarterFolder, `Quarter folder (${quarter.replace(/\s+/g, '')})`);
  ensureDirWithLogging(monthFolder, `Month folder (${month.replace(/\s+/g, '')})`);
  if (client_folder) {
    ensureDirWithLogging(clientFolder, `Client folder (${client_folder})`);
  }
  
  const targetBase = `GSTR-2B-${finYear.replace(/\s+/g,'')}-${quarter.replace(/\s+/g,'')}-${month.replace(/\s+/g,'')}`;
  const finalPath = path.join(clientFolder, `${targetBase}.xlsx`);
  console.log('- Final file path:', finalPath);
  
  // Enhanced wait for page readiness before looking for generate button
  console.log('Ensuring page is ready for Excel generation...');
  try {
    await page.waitForSelector('text=/GSTR-2B/i', { timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('Network idle timeout, continuing...');
    });
    // Additional wait to ensure all dynamic content is loaded
    await page.waitForTimeout(2000);
  } catch(e) {
    console.log('Page readiness check failed:', e.message);
  }
  
  console.log('Locating GENERATE EXCEL button...');

  const excelSelectors = [
    'button:has-text("GENERATE EXCEL FILE TO DOWNLOAD")',
    'button:has-text("GENERATE EXCEL")',
    'text=/GENERATE\s+EXCEL\s+FILE\s+TO\s+DOWNLOAD/i',
    'text=/GENERATE\s+EXCEL\s+FILE/i'
  ];
  
  function firstExistingLocator(){
    for (const sel of excelSelectors){ 
      const loc = page.locator(sel).first(); 
      if(loc) return loc; 
    }
    return page.locator('button').filter({ hasText:/GENERATE/i }).first();
  }
  
  let clicked = false;
  let generateButtonFound = false;
  
  for (let attempt = 1; attempt <= 5 && !clicked; attempt++) {
    console.log(`Generate Excel button search attempt ${attempt}/5`);
    
    const btn = firstExistingLocator();
    const buttonCount = await btn.count();
    
    if (!buttonCount) { 
      console.log(`Generate Excel button not found (attempt ${attempt})`); 
      await page.waitForTimeout(2000); // Longer wait between attempts
      continue; 
    }
    
    generateButtonFound = true;
    console.log(`Found Generate Excel button (attempt ${attempt})`);
    
    try {
      // Ensure button is ready for interaction
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      await btn.scrollIntoViewIfNeeded();
      
      // Brief pause to ensure button is fully rendered
      await page.waitForTimeout(1000);
      
      console.log(`Clicking GENERATE EXCEL (attempt ${attempt})`);
      await btn.click({ timeout: 6000 });
      clicked = true;
      console.log('Generate Excel button clicked successfully');
      
      // Wait a moment to see if click was successful
      await page.waitForTimeout(2000);
      
    } catch(e) {
      console.log(`Generate Excel click attempt ${attempt} failed:`, e.message);
      
      // Try JavaScript click as fallback
      if (attempt === 3) {
        try {
          console.log('Trying JavaScript click fallback...');
          await btn.evaluate(el => el.click());
          clicked = true;
          console.log('JavaScript click successful');
        } catch(jsError) {
          console.log('JavaScript click also failed:', jsError.message);
        }
      }
      
      if (!clicked) {
        await page.waitForTimeout(2000);
      }
    }
  }
  
  if (!generateButtonFound) {
    return { success: false, error: 'Generate Excel button not found after multiple attempts', errorCode: 'BUTTON_NOT_FOUND' };
  }
  
  if (!clicked) { 
    return { success: false, error: 'Could not click GENERATE EXCEL button after multiple attempts', errorCode: 'BUTTON_CLICK_FAILED' }; 
  }

  // Enhanced download detection with better timing
  console.log('Checking for immediate download or processing indicators...');
  
  // After clicking, wait longer for banner to render and check for processing messages
  await page.waitForTimeout(3000); // Increased wait time
  
  try {
    const pendingBanner = page.locator(':is(.alert-danger,.text-danger,div,span,p) >> text=/GSTR-?2B.*(being generated|should be available)/i').first();
    if (await pendingBanner.isVisible().catch(() => false)) {
      const bannerText = (await pendingBanner.innerText().catch(() => '')) || '';
      console.log('Detected pending generation banner:', bannerText.trim());
      return { success: false, error: 'GSTR-2B not generated yet', detail: bannerText.trim(), filePath: null };
    }
  } catch(e) {
    console.log('Error checking for pending banner:', e.message);
  }

  // Wait for possible processing indicator or download event
  const downloadEventTimeout = 60000; // 60s
  let downloadObj = null;
  
  console.log('Waiting for download event...');
  try { 
    downloadObj = await page.waitForEvent('download', { timeout: downloadEventTimeout }); 
    console.log('Download event detected immediately');
  } catch { 
    console.log('No immediate download event. Checking for secondary DOWNLOAD button...'); 
  }

  if (!downloadObj) {
    // Enhanced search for secondary download button
    console.log('Searching for secondary download button...');
    const secondSelectors = [
      'button:has-text("DOWNLOAD EXCEL")',
      'button:has-text("CLICK HERE TO DOWNLOAD")',
      'button:has-text("DOWNLOAD")',
      'a:has-text("DOWNLOAD")',
      'button:has-text("CLICK TO DOWNLOAD")',
      'a[href*="download"]'
    ];
    
    let secondaryButtonFound = false;
    for (const sel of secondSelectors) {
      const loc = page.locator(sel).first();
      const count = await loc.count();
      
      if (count > 0) {
        console.log(`Found secondary download button with selector: ${sel}`);
        secondaryButtonFound = true;
        
        try {
          // Ensure button is ready for interaction
          await loc.waitFor({ state: 'visible', timeout: 5000 });
          await loc.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000); // Brief pause before clicking
          
          console.log('Clicking secondary download button...');
          await loc.click({ timeout: 6000 });
          console.log('Secondary download button clicked');
          
          // Wait for download event with enhanced timeout
          try { 
            downloadObj = await page.waitForEvent('download', { timeout: 45000 }); 
            console.log('Download event captured from secondary button');
            break;
          } catch(downloadError) {
            console.log('Download event timeout after secondary button click:', downloadError.message);
          }
        } catch(clickError) {
          console.log(`Error clicking secondary download button (${sel}):`, clickError.message);
        }
      }
    }
    
    if (!secondaryButtonFound) {
      console.log('No secondary download buttons found');
    }
  }

  if(!downloadObj){
    // Extended error scan including pending generation phrases
    const errorLoc = page.locator(':is(.error, .text-danger, .alert-danger, span, div, p) >> text=/not generated|being generated|should be available|error|failed/i');
    let errText='';
    try { 
      if(await errorLoc.count()) errText = (await errorLoc.first().innerText()).trim(); 
    } catch{}
    if(/being generated|should be available/i.test(errText)){
      return { success:false, error:'GSTR-2B not generated yet', detail: errText, filePath:null };
    }
    const screenshotPath = path.join(clientFolder, `${targetBase}-no-download.png`);
    try { 
      await page.screenshot({ path: screenshotPath, fullPage:true }); 
    } catch{}
    return { success:false, error: errText || 'Download event not detected', filePath:null, debugScreenshot: screenshotPath };
  }

  console.log('Download event captured. Saving file...');
  let suggested = downloadObj.suggestedFilename();
  if(!/\.xlsx$/i.test(suggested)) suggested = `${targetBase}.xlsx`;
  const savePath = path.join(clientFolder, suggested);
  try { 
    await downloadObj.saveAs(savePath); 
  } catch(e){ 
    console.log('saveAs failed, trying stream read', e.message); 
  }
  
  // If not saved, attempt manual stream
  if(!fs.existsSync(savePath)){
    try {
      const stream = await downloadObj.createReadStream();
      if(stream){
        const chunks=[]; 
        await new Promise((res,rej)=>{ 
          stream.on('data',c=>chunks.push(c)); 
          stream.on('end',res); 
          stream.on('error',rej); 
        });
        fs.writeFileSync(savePath, Buffer.concat(chunks));
      }
    } catch(e){ 
      console.log('Stream fallback failed', e.message); 
    }
  }
  
  if(!fs.existsSync(savePath)) return { success:false, error:'Download file save failed' };
  
  // Optionally rename to deterministic finalPath
  if(savePath !== finalPath){ 
    try { 
      fs.copyFileSync(savePath, finalPath); 
    } catch{} 
  }
  
  console.log('Download saved at', finalPath);
  return { success:true, filePath: finalPath };
}

// === Orchestrator ===
// Only retry when captcha mismatch ("Enter valid Letters shown") appears
const MAX_CAPTCHA_MISMATCH_ATTEMPTS = 2;

async function runGstr2b(opts){
  const startTs = Date.now();
  
  // Validate input parameters
  try {
    gstUser = opts.username || gstUser; 
    gstPass = opts.password || gstPass; 
    quarter = opts.quarter || quarter; 
    month = opts.month || month; 
    finYear = opts.finYear || finYear;
    
    if(!gstUser || !gstPass || !quarter || !month || !finYear) {
      return { success:false, error:'Missing required parameters', errorCode:'MISSING_PARAMS', durationMs: Date.now()-startTs };
    }
  } catch(e) {
    return { success:false, error:'Parameter validation failed: ' + e.message, errorCode:'PARAM_ERROR', durationMs: Date.now()-startTs };
  }
  
  const headless = opts.headless !== undefined ? opts.headless : true;
  const returnFile = opts.returnFile !== false;
  const cleanupDownloads = opts.cleanupDownloads || process.env.CLEANUP_DOWNLOADS === '1';
  const storagePath = opts.storagePath || 'downloads'; // Use provided storage path or fallback
  const clientFolder = opts.client_folder || '';
  const result = { success:false, error:null, errorCode:null, filePath:null, fileBase64:null, durationMs:0, cleaned:false, errorDetail:null };
  let browser;
  
  try {
    // Browser launch with error handling
    try {
      browser = await chromium.launch({ 
        headless, 
        args: ['--no-sandbox','--disable-setuid-sandbox'] 
      });
    } catch(e) {
      result.error = 'Browser launch failed: ' + e.message;
      result.errorCode = 'BROWSER_LAUNCH_ERROR';
      return result;
    }
    
    const context = await browser.newContext({ acceptDownloads:true });
    const page = await context.newPage();
    
    // Navigation with timeout and error handling
    console.log('Opening GST login page...');
    try {
      await page.goto('https://services.gst.gov.in/services/login', { 
        waitUntil:'domcontentloaded',
        timeout: 30000
      });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{
        console.log('Page load state timeout, continuing...');
      });
    } catch(e) {
      result.error = 'Failed to load login page: ' + e.message;
      result.errorCode = 'PAGE_LOAD_ERROR';
      return result;
    }
    
    // Fill initial credentials with error handling
    try {
      await page.fill('#username', gstUser).catch(()=>{
        console.log('Username field not found or fillable');
      });
      await page.fill('#user_pass', gstPass).catch(()=>{
        console.log('Password field not found or fillable');
      });
    } catch(e) {
      console.log('Error filling initial credentials:', e.message);
    }
    
    await page.waitForTimeout(1200);
    
    // Pre-solve captcha screenshot
    try { 
      const capFrame=findCaptchaFrame(page); 
      const el=await locateCaptchaElement(capFrame); 
      if(el){ 
        ensureDir('samples'); 
        const screenshot = await el.screenshot().catch(e => {
          console.log('Pre-solve screenshot failed:', e.message);
          return null;
        });
        if (screenshot) {
          fs.writeFileSync('samples/pre-solve-captcha.png', screenshot); 
        }
      } 
    } catch(e) {
      console.log('Pre-solve captcha handling error:', e.message);
    }
    
    // Login loop with enhanced error handling
    let loggedIn=false; 
    let invalidCreds=false; 
    let captchaLimit=false; 
    let mismatchCount=0; 
    let earlyErrorText='';
    
    login_loop: for(;;){
      try {
        // Re-fill credentials if visible
        if(await page.locator('#username').first().isVisible().catch(()=>false)) {
          await page.fill('#username', gstUser).catch(e => {
            console.log('Error refilling username:', e.message);
          });
        }
        if(await page.locator('#user_pass').first().isVisible().catch(()=>false)) {
          await page.fill('#user_pass', gstPass).catch(e => {
            console.log('Error refilling password:', e.message);
          });
        }
        
        // Solve captcha with error handling
        const cap = await solveCaptchaFromPage(page);
        if(cap.trueCaptchaLimited){ 
          console.log('Captcha limit reached, breaking login loop');
          captchaLimit=true; 
          break; 
        }
        
        if (!cap.code) {
          console.log('No captcha code obtained, treating as limit');
          captchaLimit=true; 
          break;
        }
        
        // Fill captcha
        await page.fill('#captcha', cap.code).catch(e => {
          console.log('Error filling captcha:', e.message);
        });
        
        // Click login button
        await clickLogin(page);
        
        // Enhanced wait for navigation or error messages with better timeout handling
        console.log('Waiting for login response...');
        await Promise.race([
          page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
          page.waitForSelector('text=Returns Dashboard', { timeout: 20000 }).catch(() => {}),
          page.waitForSelector('text=/Invalid\\s+Username\\s+or\\s+Password/i', { timeout: 10000 }).catch(() => {}),
          page.waitForSelector('text=/Enter\\s+valid\\s+letters?\\s+shown/i', { timeout: 10000 }).catch(() => {}),
          page.waitForTimeout(15000) // Fallback timeout to prevent indefinite waiting
        ]);
        
        // Additional wait to ensure page state is stable
        await page.waitForTimeout(2000);
        
        // Check if successfully logged in
        console.log('Checking login status...');
        if (!(await isOnLogin(page))) { 
          loggedIn = true; 
          console.log('✓ Successfully logged in');
          break; 
        } else {
          console.log('Still on login page, checking for errors...');
        }
        
        // Take diagnostic screenshot
        try { 
          ensureDir('samples'); 
          await page.screenshot({ 
            path:`samples/login-attempt-${mismatchCount+1}.png`, 
            fullPage:false 
          }); 
        } catch(e) {
          console.log('Screenshot error:', e.message);
        }

        // Collect and analyze error texts
        let errorTexts=[];
        try {
          const errLoc = page.locator(':is(.alert-danger,.error,.text-danger,div,span,p)');
          const count = await errLoc.count().catch(()=>0);
          for(let i=0;i<count;i++){
            let t = await errLoc.nth(i).innerText().catch(()=>'');
            t = (t||'').replace(/\s+/g,' ').trim();
            if(t && /invalid|enter valid|error|failed|incorrect|password/i.test(t)) errorTexts.push(t);
          }
        } catch(e) {
          console.log('Error collecting error texts:', e.message);
        }
        
        const combined = [...new Set(errorTexts)].join(' | ');
        if(combined){ 
          console.log('Detected error text(s):', combined); 
          earlyErrorText = combined; 
        }

        // Handle specific error types
        if(/Enter\s+valid\s+letters?\s+shown/i.test(combined)){
          mismatchCount++;
          console.log('Captcha mismatch detected. Retry', mismatchCount, 'of', MAX_CAPTCHA_MISMATCH_ATTEMPTS);
          if(mismatchCount >= MAX_CAPTCHA_MISMATCH_ATTEMPTS){ 
            console.log('Max captcha mismatch attempts reached');
            captchaLimit=true; 
            break; 
          }
          try { 
            const frame=findCaptchaFrame(page); 
            await refreshCaptcha(frame); 
          } catch(e) {
            console.log('Error refreshing captcha:', e.message);
          }
          await page.waitForTimeout(900);
          continue login_loop;
        }
        
        if(/Invalid\s+Username\s+or\s+Password/i.test(combined)){
          console.log('Invalid credentials detected');
          invalidCreds=true; 
          break;
        }
        
        // If we have an error text (not captcha mismatch) assume credential issue -> stop further retries
        if(combined){ 
          console.log('Other error detected, treating as credential issue');
          invalidCreds=true; 
          break; 
        }
        
        // Fallback: no explicit error text but still on login -> treat as credential issue
        console.log('No explicit error but still on login page, treating as credential issue');
        invalidCreds=true; 
        break;
        
      } catch(e) {
        console.log('Error in login loop iteration:', e.message);
        invalidCreds=true; 
        break;
      }
    }
    
    // Handle login results
    if(captchaLimit){ 
      result.error='captcha recharge is over'; 
      result.errorCode='CAPTCHA_LIMIT'; 
      result.errorDetail=earlyErrorText||null; 
      return result; 
    }
    if(invalidCreds){
      // Decide which message to show based on captured error text
      if(/Invalid\s+Username\s+or\s+Password/i.test(earlyErrorText)){
        result.error='username or password is incorrect';
        result.errorCode='INVALID_CREDENTIALS';
      } else if(/Enter\s+valid\s+letters?\s+shown/i.test(earlyErrorText)) {
        result.error='captcha recharge is over';
        result.errorCode='CAPTCHA_LIMIT';
      } else {
        result.error='username or password is incorrect';
        result.errorCode='INVALID_CREDENTIALS';
      }
      result.errorDetail = earlyErrorText || null;
      return result;
    }
    if(!loggedIn){ 
      result.error='Login failed'; 
      result.errorCode='LOGIN_FAILED';
      result.errorDetail = earlyErrorText || null;
      return result; 
    }
    
    // Navigate to dashboard with enhanced verification
    console.log('Navigating to Returns Dashboard...');
    try {
      // Wait for dashboard button to be visible and clickable
      await page.waitForSelector('text=/RETURN\\s+DASHBOARD/i', { timeout:20000 });
      
      // Ensure button is ready for interaction
      const dashboardBtn = page.locator('text=/RETURN\\s+DASHBOARD/i').first();
      await dashboardBtn.waitFor({ state: 'visible', timeout: 10000 });
      
      // Click with fallback methods
      let dashboardClicked = false;
      try {
        await dashboardBtn.click({ timeout: 5000 });
        dashboardClicked = true;
        console.log('Dashboard button clicked successfully');
      } catch(e) {
        console.log('Primary dashboard click failed, trying fallback:', e.message);
        try {
          await page.getByText('RETURN DASHBOARD', { exact: false }).first().click({ timeout: 5000 });
          dashboardClicked = true;
          console.log('Dashboard button clicked via fallback');
        } catch(e2) {
          console.log('Fallback dashboard click also failed:', e2.message);
        }
      }
      
      if (dashboardClicked) {
        // Wait for navigation to complete
        console.log('Waiting for dashboard page to load...');
        await Promise.race([
          page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
          page.waitForSelector('select', { timeout: 15000 }).catch(() => {}),
          page.waitForTimeout(8000) // Fallback timeout
        ]);
        console.log('Dashboard navigation completed');
      }
    } catch(e) {
      console.log('Error navigating to dashboard:', e.message);
      // Continue anyway, might already be on the right page
    }
    
    // Wait for selects with enhanced verification
    console.log('Waiting for dropdown elements...');
    try {
      // Wait for select elements to be present and ready
      await page.waitForSelector('select', { timeout: 20000 });
      
      // Verify we have the expected number of selects
      const selectCount = await page.locator('select').count();
      console.log(`Found ${selectCount} dropdown elements`);
      
      if (selectCount >= 3) {
        console.log('All required dropdown elements are available');
      } else {
        console.log(`Warning: Expected 3 dropdowns but found ${selectCount}, continuing...`);
      }
      
      // Additional wait to ensure dropdowns are fully populated
      await page.waitForTimeout(2000);
    } catch(e) {
      console.log('Error waiting for select elements:', e.message);
      // Try to continue, dropdowns might still work
    }

    // Enhanced dropdown selection with error handling and verification
    async function chooseOptionByPatterns(selectLocator, patterns) {
      try {
        const selectCount = await selectLocator.count();
        if (!selectCount) {
          console.log('Select element not found');
          return false;
        }
        
        // Wait for select to be ready
        await selectLocator.waitFor({ state: 'visible', timeout: 5000 });
        
        const optionLocs = selectLocator.locator('option');
        const texts = await optionLocs.allTextContents().catch(() => []);
        
        if (texts.length === 0) {
          console.log('No options found in select element');
          return false;
        }
        
        console.log(`Select has ${texts.length} options:`, texts.slice(0, 5).join(', ') + (texts.length > 5 ? '...' : ''));
        
        for (const pat of patterns.filter(Boolean)) {
          const idx = texts.findIndex(t => t.toLowerCase().includes(pat.toLowerCase()));
          if (idx >= 0) { 
            const value = await optionLocs.nth(idx).getAttribute('value').catch(() => null);
            try { 
              if (value) {
                await selectLocator.selectOption(value); 
              } else {
                await selectLocator.selectOption({ label: texts[idx] }); 
              }
              console.log(`✓ Selected '${texts[idx]}' (pattern: ${pat})`); 
              
              // Verify selection was successful
              await page.waitForTimeout(500);
              const selectedValue = await selectLocator.inputValue().catch(() => '');
              if (selectedValue === value || selectedValue === texts[idx]) {
                console.log('Selection verified successfully');
                return true;
              } else {
                console.log('Selection verification failed, but continuing...');
                return true; // Still consider it successful
              }
            } catch(e) {
              console.log('Error selecting option:', e.message);
            }
          }
        }
        console.log('No match for patterns:', patterns);
        return false;
      } catch(e) {
        console.log('Error in chooseOptionByPatterns:', e.message);
        return false;
      }
    }
    
    // Enhanced dropdown selection with better verification
    console.log('Configuring dropdown selections...');
    try {
      const selects = page.locator('select');
      const selectCount = await selects.count();
      
      if (selectCount < 3) {
        console.log(`Warning: Expected 3 dropdowns but found ${selectCount}`);
      }
      
      const fySelect = selects.nth(0); 
      const qSelect = selects.nth(1); 
      const mSelect = selects.nth(2);
      
      const quarterNum = (quarter.match(/\d/) || [null])[0];
      const quarterPatterns = quarterNum ? [`quarter ${quarterNum}`,`q${quarterNum}`,quarter.replace(/\s+/g,' ')] : [quarter];
      const monthPatterns = [month, month.slice(0,3)];
      const fyPatterns = [finYear, finYear.replace(/20(\d{2})-20(\d{2})/,'$1-$2')];
      
      // Select with verification
      console.log('Selecting Financial Year...');
      const fyResult = await chooseOptionByPatterns(fySelect, fyPatterns);
      if (fyResult) {
        console.log('Financial Year selected successfully');
        await page.waitForTimeout(1000); // Allow time for dependent dropdowns to update
      } else {
        console.log('Warning: Financial Year selection may have failed');
      }
      
      console.log('Selecting Quarter...');
      const qResult = await chooseOptionByPatterns(qSelect, quarterPatterns);
      if (qResult) {
        console.log('Quarter selected successfully');
        await page.waitForTimeout(1000); // Allow time for dependent dropdowns to update
      } else {
        console.log('Warning: Quarter selection may have failed');
      }
      
      console.log('Selecting Month...');
      const mResult = await chooseOptionByPatterns(mSelect, monthPatterns);
      if (mResult) {
        console.log('Month selected successfully');
        await page.waitForTimeout(1000); // Allow time for UI to update
      } else {
        console.log('Warning: Month selection may have failed');
      }
      
      console.log('All dropdown selections attempted');
    } catch(e) {
      console.log('Error in dropdown selections:', e.message);
      // Continue anyway, selections might still work
    }
    
    // Search button with enhanced verification
    console.log('Looking for Search button...');
    try {
      const searchVariants = [ 
        () => page.locator('button:has-text("Search")').first(), 
        () => page.getByText(/SEARCH/i).first(), 
        () => page.locator('input[type=button][value*="Search" i]').first() 
      ];
      
      let searchClicked = false;
      for (let i = 0; i < searchVariants.length; i++) {
        const getLoc = searchVariants[i]; 
        const loc = getLoc(); 
        
        if (await loc.count()) {
          console.log(`Found search button with variant ${i + 1}`);
          
          // Ensure button is visible and ready
          try {
            await loc.waitFor({ state: 'visible', timeout: 5000 });
            await loc.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500); // Brief pause before clicking
            
            await loc.click({ timeout: 5000 }); 
            searchClicked = true;
            console.log('Search button clicked successfully');
            
            // Wait for search results to load
            console.log('Waiting for search results...');
            await Promise.race([
              page.waitForSelector('text=/GSTR-2B/i', { timeout: 15000 }).catch(() => {}),
              page.waitForSelector('button:has-text("DOWNLOAD")', { timeout: 15000 }).catch(() => {}),
              page.waitForTimeout(10000) // Fallback timeout
            ]);
            console.log('Search results loaded');
            break;
          } catch(e) {
            console.log(`Search click variant ${i + 1} failed:`, e.message);
          }
        } 
      }
      
      if (!searchClicked) {
        console.log('Warning: No search button found or clicked successfully');
      }
    } catch(e) {
      console.log('Error handling search button:', e.message);
    }
    
    // Open GSTR2B download with enhanced verification
    console.log('Opening GSTR-2B download section...');
    try {
      const gstr2bOpened = await openGstr2bDownload(page);
      if (gstr2bOpened) {
        console.log('GSTR-2B download section opened successfully');
        
        // Wait for the download page to fully load
        console.log('Waiting for GSTR-2B download page to load...');
        await Promise.race([
          page.waitForSelector('text=/GENERATE\s+EXCEL/i', { timeout: 15000 }).catch(() => {}),
          page.waitForSelector('button:has-text("GENERATE")', { timeout: 15000 }).catch(() => {}),
          page.waitForTimeout(8000) // Fallback timeout
        ]);
        console.log('GSTR-2B download page loaded');
      } else {
        console.log('Warning: Could not open GSTR-2B download section');
      }
    } catch(e) {
      console.log('Error opening GSTR2B download:', e.message);
      // Continue anyway, might still be able to generate Excel
    }
    
    // Generate and download Excel with enhanced error handling
    const genRes = await generateAndDownloadExcel(page,{quarter,month,finYear,storagePath,client_folder:clientFolder});
    if(!genRes.success){ 
      result.error = genRes.error || 'Download failed'; 
      result.errorCode = genRes.errorCode || 'DOWNLOAD_FAILED';
      result.errorDetail = genRes.detail || null;
    }
    else {
      result.success=true; 
      result.filePath = genRes.filePath;
      if(returnFile){
        try { 
          const buf=fs.readFileSync(genRes.filePath); 
          result.fileBase64=buf.toString('base64'); 
        } catch(e){ 
          console.log('Read file for base64 failed', e.message); 
          result.error = 'File read error: ' + e.message;
          result.errorCode = 'FILE_READ_ERROR';
        }
      }
      if(cleanupDownloads && result.filePath){
        try { 
          fs.unlinkSync(result.filePath); 
          result.cleaned=true; 
        } catch(e){ 
          console.log('Cleanup failed', e.message); 
        }
      }
    }
    
    // Clean browser closure
    try { 
      await browser.close(); 
    } catch(e) {
      console.log('Browser close error:', e.message);
    }
    
  } catch(e){ 
    result.error = e.message; 
    if(!result.errorCode && /INVALID_CREDENTIALS/.test(e.message)) {
      result.errorCode='INVALID_CREDENTIALS';
    } else if (!result.errorCode) {
      result.errorCode = 'UNHANDLED_ERROR';
    }
    
    if(browser){ 
      try { 
        await browser.close(); 
      } catch(closeError) {
        console.log('Error closing browser in catch:', closeError.message);
      } 
    } 
  } finally {
    result.durationMs = Date.now()-startTs;
  }
  
  return result;
}

// === Server Class ===
class GSTR2BAutomationServer {
  constructor() {
    this.app = null;
    this.server = null;
    this.port = 3003; // Different port from other servers
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.app = express();
        this.app.use(express.json({limit:'2mb'}));

        // GSTR-2B automation endpoint
        this.app.post('/gstr2b', async (req,res)=>{
          try { 
            // Validate request body
            if (!req.body) {
              return res.status(400).json({ 
                success:false, 
                error:'Request body is required', 
                errorCode: 'MISSING_BODY' 
              });
            }
            
            console.log('GSTR-2B automation request:', req.body);
            const runRes = await runGstr2b(req.body||{}); 
            res.status(runRes.success?200:400).json(runRes); 
          }
          catch(e){ 
            console.error('GSTR-2B automation error:', e);
            res.status(500).json({ 
              success:false, 
              error:e.message, 
              errorCode: 'SERVER_ERROR',
              stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
            }); 
          }
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
          res.json({ 
            status: 'ok', 
            service: 'GSTR-2B Automation',
            timestamp: new Date().toISOString() 
          });
        });

        this.server = this.app.listen(this.port, (err) => {
          if (err) {
            console.error('Failed to start GSTR-2B automation server:', err);
            reject(err);
          } else {
            console.log(`GSTR-2B automation server started on port ${this.port}`);
            resolve();
          }
        });

        this.server.on('error', (error) => {
          console.error('GSTR-2B automation server error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('Error starting GSTR-2B automation server:', error);
        reject(error);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        console.log('Stopping GSTR-2B automation server...');
        this.server.close(() => {
          console.log('GSTR-2B automation server stopped');
          this.server = null;
          this.app = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isRunning() {
    return this.server !== null;
  }
}

module.exports = { GSTR2BAutomationServer, runGstr2b };
