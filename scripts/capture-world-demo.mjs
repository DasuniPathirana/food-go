/* Capture actual Food Go Playwright game screenshots, never generated concept art. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const root="artifacts/demo-world";
await mkdir(root,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl"]});
const report=[];
const origin="http://127.0.0.1:3100/?world-demo=1";
for(const viewport of [{name:"desktop",width:1440,height:900,isMobile:false},
                       {name:"phone",width:390,height:844,isMobile:true}]) {
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},
    deviceScaleFactor:1,isMobile:viewport.isMobile,hasTouch:viewport.isMobile,reducedMotion:"reduce",
    recordVideo:{dir:root,size:{width:viewport.width,height:viewport.height}}});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text().slice(0,400));});
  const details={viewport:viewport.name,scenes:[],errors};
  try{
    await page.goto(origin,{waitUntil:"domcontentloaded",timeout:40000});
    await page.getByRole("button",{name:"Open demo tour"}).waitFor({timeout:30000});
    await page.waitForTimeout(3500);
    await page.screenshot({path:`${root}/${viewport.name}-city.png`,animations:"disabled"});
    details.scenes.push("city");
    const go=async (name,label,key)=>{
      await page.getByRole("button",{name:"Open demo tour"}).click();
      await page.getByRole("button",{name:new RegExp(label)}).click();
      await page.waitForTimeout(3000);
      await page.screenshot({path:`${root}/${viewport.name}-${key}.png`,animations:"disabled"});
      details.scenes.push(key);
    };
    await go("park","Park discovery","park");
    await go("treasure","Treasure encounter","treasure");
    details.treeCount=await page.locator("[data-game-tree-count]").first().getAttribute("data-game-tree-count");
    details.facadeCount=await page.locator("[data-game-facade-count]").first().getAttribute("data-game-facade-count");
    details.lampCount=await page.locator("[data-game-street-light-count]").first().getAttribute("data-game-street-light-count");
  }catch(error){details.error=String(error).slice(0,1200);}
  const video=page.video();
  await context.close();
  try { if(video)await video.saveAs(`${root}/${viewport.name}-tour.webm`); }
  catch (error) { details.videoError=String(error).slice(0,200); }
  report.push(details);
}
await browser.close();
await writeFile(`${root}/results.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
