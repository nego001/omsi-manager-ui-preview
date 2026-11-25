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
 const targets=[
  {name:'hero-title',selector:'.hero .hero-copy > h1',min:3},
  {name:'hero-description',selector:'.hero .hero-copy > p',min:4.5}
 ];
 const sampled={method:'Rendered background beneath each live text region; each target centered before capture, glyph paint hidden only during screenshot. Approximate, not exhaustive WCAG.',samples:[] as {name:string;position:number[];background:number[];foreground:number[];ratio:number;min:number}[]};
 for(const target of targets){
  const locator=page.locator(target.selector);
  await expect(locator).toHaveCount(1);
  await expect(locator).toBeVisible();
  await locator.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  const measurement=await locator.evaluate(el=>{
   const r=el.getBoundingClientRect();
   const rgb=[...getComputedStyle(el).color.matchAll(/[\d.]+/g)].slice(0,3).map(v=>Number(v[0]));
   if(r.width<=0||r.height<=0||rgb.length!==3)throw new Error('Texto sem geometria ou cor');
   const points=[[.1,.25],[.35,.75],[.65,.25],[.85,.75]].map(([px,py])=>{
    const x=r.x+r.width*px,y=r.y+r.height*py;
    const hit=document.elementFromPoint(x,y);
    if(x<0||y<0||x>=window.innerWidth||y>=window.innerHeight||!hit||!(hit===el||el.contains(hit)))throw new Error('Amostra fora da região de texto visível');
    return {x,y,position:[px,py]};
   });
   return {rgb,points};
  });
  const base64=(await page.screenshot({animations:'disabled',style:target.selector+'{color:transparent!important;text-shadow:none!important}'})).toString('base64');
  const samples=await page.evaluate(async({base64,measurement,target})=>{
   const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
   const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
   const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas 2D indisponível');
   ctx.drawImage(bitmap,0,0);
   const lum=(rgb:number[])=>{const c=rgb.map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
   const result=measurement.points.map(point=>{
    const x=Math.floor(point.x*bitmap.width/window.innerWidth),y=Math.floor(point.y*bitmap.height/window.innerHeight);
    if(x<0||y<0||x>=bitmap.width||y>=bitmap.height)throw new Error('Amostra fora da captura');
    const background=Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3);
    const a=lum(measurement.rgb),b=lum(background);
    return {name:target.name,position:point.position,background,foreground:measurement.rgb,ratio:Math.round(((Math.max(a,b)+.05)/(Math.min(a,b)+.05))*100)/100,min:target.min};
   });
   bitmap.close();return result;
  },{base64,measurement,target});
  sampled.samples.push(...samples);
 }
 expect(sampled.samples).toHaveLength(8);
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
