#!/usr/bin/env node
// Creates the phone screenshots for Google Play (1080 x 1920) from the real interface, with demo data
// and a fixed date, in English and German. Output: store/screenshots/<locale>/*.png
//
// Needs puppeteer-core and a Chrome/Chromium:
//   npm install --no-save puppeteer-core
//   CHROME_PATH=/usr/bin/chromium node scripts/make-store-screenshots.js
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');

const root = path.join(__dirname, '..');
const OUT = path.join(root, 'store', 'screenshots');
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const demo = (grandma, work) => [
  { id: 'a', kind: 'birthday', name: 'Lena Weber', month: 11, day: 16, year: 1994 },
  { id: 'b', kind: 'wedding', name: 'Anna & Paul', month: 11, day: 21, year: 2005 },
  { id: 'c', kind: 'birthday', name: grandma, month: 12, day: 24, year: 1948 },
  { id: 'd', kind: 'nameday', name: 'Martin Keller', month: 11, day: 11, year: 0 },
  { id: 'e', kind: 'other', name: work, month: 3, day: 1, year: 2016 },
];
const LOCALES = [
  { lang: 'en', dir: 'en-US', entries: demo('Grandma Erna', 'First day at work') },
  { lang: 'de', dir: 'de-DE', entries: demo('Oma Erna', 'Erster Arbeitstag') },
];

async function open(browser, loc, fixedIso) {
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3 });
  // a fixed "now", so that the screenshots always show the same days
  await page.evaluateOnNewDocument((iso) => {
    const fixed = new Date(iso).getTime();
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...a) { if (a.length === 0) super(fixed + performance.now()); else super(...a); }
      static now() { return fixed + performance.now(); }
    }
    window.Date = FakeDate;
  }, fixedIso);
  await page.goto(pathToFileURL(path.join(root, 'src', 'index.html')).href);
  await sleep(500);
  await page.evaluate((entries, lang) => {
    mock.entries = entries.map((e) => ({ ...e }));
    state.entries = mock.entries.slice();
    state.settings.language = lang;
    state.settings.warn_days = 7;
    applyI18n(); renderOverview(); renderManage(); renderSettings();
  }, loc.entries, loc.lang);
  await sleep(300);
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const loc of LOCALES) {
    const dir = path.join(OUT, loc.dir);
    fs.mkdirSync(dir, { recursive: true });
    let page = await open(browser, loc, '2026-11-15T10:30:00');
    await sleep(900);
    await page.screenshot({ path: path.join(dir, '1-overview.png') });
    await page.close();

    page = await open(browser, loc, '2026-11-11T11:11:10'); // carnival: 11 Nov, 11:11
    await sleep(1200);
    await page.screenshot({ path: path.join(dir, '2-carnival.png') });
    await page.close();

    page = await open(browser, loc, '2026-11-15T10:30:00');
    await page.click('#btn-manage'); await sleep(300);
    await page.type('#f-name', 'Maria Muster'); await page.type('#f-day', '3');
    await page.type('#f-month', '5'); await page.type('#f-year', '1985');
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
    await page.screenshot({ path: path.join(dir, '3-editor.png') });
    // settings and import/export live in their own view now: go back to the overview, then open it
    await page.click('#btn-back'); await sleep(300);
    await page.click('#btn-settings'); await sleep(300);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
    await page.evaluate(() => document.querySelector('#set-banner').closest('.panel').scrollIntoView({ block: 'start' })); await sleep(250);
    await page.screenshot({ path: path.join(dir, '4-settings.png') });
    await page.evaluate(() => document.querySelector('#btn-export-ics').closest('.panel').scrollIntoView({ block: 'start' })); await sleep(250);
    await page.screenshot({ path: path.join(dir, '5-export.png') });
    await page.close();
  }
  await browser.close();
  console.log('Screenshots written to ' + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
