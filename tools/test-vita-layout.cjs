const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cut = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const support = source.slice(source.indexOf('<div class="wa-fab vita-help-fab"'), source.indexOf('<div class="wa-chat-popup"'));
const popupStart = source.indexOf('<div class="wa-chat-popup"');
const popup = source.slice(popupStart, source.indexOf('\n\n\n\n', popupStart));
const greeting = source.match(/<div class="vita-advisor-greeting">.*?<\/small><\/span><\/div>/)[0];
const chat = cut('<div class="vita-chat-wrap"', '\n    \n    <div style="display:flex;justify-content:center');
const css = ['store-main.css','store-surface.css','store-refinements.css','store-responsive.css'].map(f => fs.readFileSync(path.join(root, 'styles', f), 'utf8')).join('\n');
const fixture = `<style>${css}</style><style>main{padding:16px;max-width:760px;margin:auto}#vitaChatWrap{display:flex!important}.wa-chat-popup{opacity:1;visibility:visible;transform:none}</style><main>${greeting}${chat}</main>${support}${popup}`;
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE, headless:true, args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for (const [width,height] of [[320,568],[360,640],[390,844],[430,932],[600,800],[768,1024],[1024,768],[1440,900],[667,375],[844,390]]) {
      const page = await browser.newPage({viewport:{width,height}});
      await page.setContent(fixture);
      for (const font of [16,32]) {
        await page.addStyleTag({content:`html{font-size:${font}px}`});
        for (const mode of ['','oz-product']) {
          await page.evaluate(mode => document.body.className=mode,mode);
          for (const time of [0,325,650,975,1300,1950,2600,3000]) {
            const errors = await page.evaluate(time => {
              document.getAnimations().forEach(a=>{a.pause();a.currentTime=time});
              const rect = e=>e.getBoundingClientRect();
              const errors=[];
              document.querySelectorAll('.auth-vita').forEach(e=>{
                const r=rect(e);
                e.querySelectorAll('.auth-vita-body,.auth-vita-hand,.auth-vita-shadow').forEach(p=>{
                  const b=rect(p);if(b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1)errors.push('character spills: '+p.className);
                });
              });
              const button=rect(document.querySelector('.vita-help-btn'));
              const avatar=rect(document.querySelector('.vita-help-btn .auth-vita'));
              const copy=document.querySelector('.vita-help-copy');
              if(getComputedStyle(copy).display!=='none'&&avatar.right>rect(copy).left)errors.push('avatar overlaps label');
              if(avatar.bottom>button.bottom||avatar.right>button.right)errors.push('avatar spills out of button');
              for(const selector of ['.vita-help-btn','.wa-chat-popup','.vita-chat-hdr','.vita-input-bar']){
                const r=rect(document.querySelector(selector));if(r.left<0||r.right>innerWidth+1)errors.push(selector+' outside viewport');
              }
              const popup=rect(document.querySelector('.wa-chat-popup'));
              if(popup.top<0||popup.bottom>innerHeight)errors.push('popup outside viewport');
              const input=rect(document.querySelector('.vita-input-bar')),chat=rect(document.querySelector('.vita-chat-wrap'));
              if(input.bottom>chat.bottom+1)errors.push('input clipped by chat');
              return errors;
            },time);
            assert.deepEqual(errors,[],`${width}x${height} font=${font} ${mode} time=${time}: ${errors}`);
          }
        }
      }
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.locator('.auth-vita-body').first().evaluate(e=>getComputedStyle(e).animationName),'none');
      if (process.env.QA_SCREENSHOTS && [390,1440].includes(width)) {
        await page.addStyleTag({content:'html{font-size:16px}'});
        await page.evaluate(()=>document.body.className='');
        await page.screenshot({path:`${process.env.QA_SCREENSHOTS}/vita-layout-${width}.png`});
      }
      await page.close();
      console.log(`PASS ${width}x${height}: animation bounds, 200% text, home/product support, header/input, reduced motion`);
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
