import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
export async function checkCharts(page){
 const data=await (await page.request.get(new URL('/api/sales?view=dashboard&period=month&date=2025-06-15',page.url()).href)).json();
 const plot=page.locator('.sd-panel').first().getByRole('group',{name:/Use left and right arrow keys/});
 await plot.focus();await page.keyboard.press('Home');
 const first=data.current.points.filter(p=>p.elapsed)[0];
 await plot.getByRole('status').waitFor();assert.ok((await plot.getByRole('status').innerText()).includes(first.label));
 await page.keyboard.press('End');assert.ok((await plot.getByRole('status').innerText()).includes(data.current.points.filter(p=>p.elapsed).at(-1).label));
 await page.keyboard.press('Escape');assert.equal(await plot.getByRole('status').count(),0);
 const box=await page.locator('.sd-chart-redesign').first().boundingBox();assert.ok(box.height>=300);
 await page.locator('.sd-card').filter({hasText:'Transactions'}).click();assert.ok(await page.locator('.sd-panel').first().locator('.is-bars rect').count()>0);
 await page.locator('.sd-card').filter({hasText:'Net sales'}).click();
 await page.setViewportSize({width:1440,height:1100});
 await page.locator('.sd-cards').first().screenshot({path:'test-artifacts/screenshots/dashboard-cards-after.png',animations:'disabled'});
 await page.locator('.sd-panel').first().screenshot({path:'test-artifacts/screenshots/dashboard-chart-after.png',animations:'disabled'});
 // Compare the exact former component against identical disposable API values.
 // This is a reconstruction from committed source, not a hosted before screenshot.
 const src=readFileSync(new URL('./fixtures/sales-chart-before.txt',import.meta.url),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
 const titles={net:'Net sales',transactions:'Transactions',aov:'Average order value',quantity:'Items sold'};
 const format=(v,k)=>v===null?'Unavailable':['transactions','quantity'].includes(k)?String(v):new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(v/100);
 const Original=new Function('React','titles','format',js+';return Chart;')(React,titles,format);
 const chart=(metric,small)=>renderToStaticMarkup(React.createElement(Original,{points:data.current.points,metric,small}));
 await page.locator('.sd-mini-chart').evaluateAll((els,html)=>els.slice(0,4).forEach((e,i)=>e.outerHTML=html[i]),Object.keys(titles).map(k=>chart(k,true)));
 await page.locator('.sd-trend').first().evaluate((e,html)=>e.outerHTML=html,chart('net',false));
 await page.locator('.sd-cards').first().screenshot({path:'test-artifacts/screenshots/dashboard-cards-before.png',animations:'disabled'});
 await page.locator('.sd-panel').first().screenshot({path:'test-artifacts/screenshots/dashboard-chart-before.png',animations:'disabled'});
 // Restore React through navigation, never leave replaced DOM in the app test.
 await page.reload();
}
