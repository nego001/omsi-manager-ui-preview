import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const screenshots=resolve('test-results');

test('capas de jogos mantêm título e fundo íntegros sem acesso ao servidor de imagens',async({page})=>{
 // Browser preview still loads from local Vite; only remote Steam images are intentionally unavailable.
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort('internetdisconnected'));
 await page.goto('/');
 const hero=page.locator('.hero-art .game-cover');
 await expect(hero).toHaveCount(1);
 await expect(hero.locator('.cover-fallback strong').first()).toHaveText('OMSI 2');
 await expect(hero.locator('img').first()).toHaveCSS('opacity','0');
 await expect(page.locator('.hero-art .game-cover[data-cover-loaded="true"]')).toHaveCount(0);
 await page.getByRole('group',{name:'Escolher simulador em destaque'}).getByRole('button',{name:'Mostrar American Truck Simulator no destaque'}).click();
 await expect(hero.locator('.cover-fallback strong')).toHaveText('American Truck Simulator');
 await expect(hero.locator('img')).toHaveCSS('opacity','0');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
 const covers=page.locator('.game-tile .game-cover');
 await expect(covers).toHaveCount(3);
 await expect(covers.locator('.cover-fallback strong')).toHaveText([
  'OMSI 2','Euro Truck Simulator 2','American Truck Simulator'
 ]);
 await expect(covers.filter({has:page.locator('img.cover-loaded')})).toHaveCount(0);
 await expect(page.getByText('cartões identificados mesmo sem internet',{exact:false})).toBeVisible();
 await page.screenshot({path:resolve('test-results/offline-game-covers.png'),fullPage:true,animations:'disabled'});
});

test('gradiente do destaque mantém contraste próximo do texto em pixels realmente renderizados',async({page})=>{
 await page.goto('/');
 const hero=page.locator('.hero');
 await expect(hero).toBeVisible();
 // Capture the actual background under the live text, with only glyph paint hidden.
 // The approved panorama is a separate image; pixels on it are not a background for these labels.
 await page.locator('.hero-copy').scrollIntoViewIfNeeded();
 const targets=await page.evaluate(()=>[
  {name:'hero-title',selector:'.hero h1',min:3},
  {name:'hero-description',selector:'.hero p',min:4.5}
 ].map(target=>{
  const el=document.querySelector(target.selector);
  if(!el)throw new Error('Texto ausente: '+target.selector);
  const rect=el.getBoundingClientRect();
  const rgb=[...getComputedStyle(el).color.matchAll(/[\d.]+/g)].slice(0,3).map(v=>Number(v[0]));
  return {...target,rgb,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
 }));
 const screenshot=(await page.screenshot({animations:'disabled',style:'.hero h1,.hero p{color:transparent!important;text-shadow:none!important}'})).toString('base64');
 const sampled=await page.evaluate(async({base64,targets})=>{
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
  const canvas=document.createElement('canvas');
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Canvas 2D indisponível');
  ctx.drawImage(bitmap,0,0);
  const luminance=(rgb:number[])=>{const c=rgb.map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const samples=[];
  for(const target of targets){
   const r=target.rect;
   if(r.width<=0||r.height<=0)throw new Error('Texto sem geometria: '+target.name);
   for(const [px,py] of [[.1,.25],[.35,.75],[.65,.25],[.85,.75]]){
    const x=Math.floor((r.x+r.width*px)*bitmap.width/window.innerWidth),y=Math.floor((r.y+r.height*py)*bitmap.height/window.innerHeight);
    if(x<0||y<0||x>=bitmap.width||y>=bitmap.height)throw new Error('Amostra fora da área visível: '+target.name);
    const background=Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3);
    const a=luminance(target.rgb),b=luminance(background);
    samples.push({name:target.name,position:[px,py],background,foreground:target.rgb,ratio:Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100,min:target.min});
   }
  }
  bitmap.close();
  return {method:'Rendered background beneath live text bounds; glyph paint hidden only for capture. Approximate, not exhaustive WCAG.',samples};
 },{base64:screenshot,targets});
 await mkdir(screenshots,{recursive:true});
 await writeFile(resolve('test-results/gradient-sample.json'),JSON.stringify(sampled,null,2),'utf8');
 const below=sampled.samples.filter(sample=>sample.ratio<sample.min);
 console.log('GRADIENT AUDIT:',sampled.samples.length,'samples; below target:',below.length);
 expect(below,'Amostragem aproximada do gradiente falhou; ver gradient-sample.json').toEqual([]);
});

test('ícones de status renderizados contrastam com seus fundos sólidos',async({page})=>{
 await page.goto('/');
 const selectors=['.sidebar .nav-link.active svg','.sidebar .nav-link:not(.active) svg','.safety-status svg','.mode-indicator svg'];
 const checks=[];
 for(const selector of selectors){
  const locator=page.locator(selector).first();
  await expect(locator).toHaveCount(1);
  checks.push(await locator.evaluate((el,selector)=>{
   const parse=(s:string)=>{
    const m=s.match(/^rgba?\(([^)]+)\)$/);
    if(!m)throw new Error('Formato inesperado de cor: '+s);
    return m[1].split(/[,\/\s]+/).filter(Boolean).slice(0,3).map(Number);
   };
   let element:Element|null=el;
   let background:string|null=null;
   while(element){
    const bg=getComputedStyle(element).backgroundColor;
    const opaque=bg.startsWith('rgb(')||
     (bg.startsWith('rgba(')&&Number(bg.slice(bg.lastIndexOf(',')+1,-1).trim())===1);
    if(opaque){background=bg;break;}
    element=element.parentElement;
   }
   if(!background)throw new Error('No solid background for '+selector);
   const fg=parse(getComputedStyle(el).color),bg=parse(background);
   const lum=(parts:number[])=>{
    const p=parts.map(x=>{const s=x/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4});
    return p[0]*.2126+p[1]*.7152+p[2]*.0722;
   };
   const a=lum(fg),b=lum(bg);
   return {selector,foreground:fg,background:bg,ratio:Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100};
  },selector));
 }
 await mkdir(screenshots,{recursive:true});
 await writeFile(resolve('test-results/icon-contrast.json'),JSON.stringify(checks,null,2),'utf8');
 console.log('ICON CONTRAST AUDIT:',checks.length,'samples');
 expect(checks.filter(check=>check.ratio<3),'Ícones com relação menor que 3:1').toEqual([]);
});
