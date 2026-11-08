const {chromium} = require('playwright');
(async () => {
  const [viewer, control, token, screenshot] = process.argv.slice(2);
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage({viewport:{width:1300,height:900}});
    await page.goto(viewer);
    await page.waitForSelector('html.noVNC_connected',{timeout:30000});
    await page.waitForSelector('#noVNC_transition',{state:'hidden',timeout:30000});
    const canvas=page.locator('canvas').first();
    await canvas.waitFor({state:'visible'});
    const request = (path,body) => fetch(control+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if((await request('/control',{owner:'user'})).status!==200)throw Error('Takeover failed');
    if((await request('/screenshot')).status!==409)throw Error('AI can still capture during takeover');
    const box=await canvas.boundingBox();
    await page.mouse.click(box.x+box.width*250/1280,box.y+box.height*250/800);
    await page.keyboard.type('manual-vnc-ok');
    await page.screenshot({path:screenshot});
    await page.keyboard.press('Enter');
    if((await request('/control',{owner:'ai'})).status!==200)throw Error('Return to AI failed');
    if((await request('/action',{action:'key',key:'Return'})).status!==400)throw Error('Old screenshot accepted after handback');
    console.log('Real browser: live noVNC framebuffer, human mouse/keyboard while AI paused, and handback verified');
  } finally {await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1)});
