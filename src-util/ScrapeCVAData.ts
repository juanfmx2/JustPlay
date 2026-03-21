import { chromium, firefox, webkit, Browser, Page } from 'playwright';

interface BrowserData {
browser: string;
title: string;
url: string;
}

async function scrapeBrowserTestPage(): Promise<BrowserData[]> {
const browsers = [
{ name: 'Chromium', instance: await chromium.launch() },
{ name: 'Firefox', instance: await firefox.launch() },
{ name: 'WebKit', instance: await webkit.launch() }
];

const results: BrowserData[] = [];

for (const { name, instance } of browsers) {
const page = await instance.newPage();
try {
await page.goto('https://www.whatismybrowser.com/');
const title = await page.title();
const url = page.url();
results.push({ browser: name, title, url });
} finally {
await instance.close();
}
}

return results;
}

// Usage
scrapeBrowserTestPage()
.then(results => {
console.log('Scraping results:');
results.forEach(result => {
console.log(`${result.browser}: ${result.title} (${result.url})`);
});
})
.catch(console.error);
