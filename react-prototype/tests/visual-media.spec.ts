import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const screenshots=resolve('test-results');

test('capas de jogos mantêm título e fundo íntegros sem acesso ao servidor de imagens',async({page})=>{
 // Browser preview still loads from local Vite; only remote Steam images are intentionally unavailable.
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort('internetdisconnected'));
 await page.goto('/');
 const hero=page.locator('.hero-art .game-cover');
 await expect(hero).toHaveCount(3);
 await expect(hero.locator('.cover-fallback strong').first()).toHaveText('OMSI 2');
 await expect(hero.locator('img').first()).toHaveCSS('opacity','0');
 await expect(page.locator('.hero-art .game-cover[data-cover-loaded="true"]')).toHaveCount(0);
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
 const screenshot=(await page.screenshot({animations:'disabled'})).toString('base64');
 const sampled=await page.evaluate(async base64=>{
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
  const canvas=document.createElement('canvas');
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Canvas 2D indisponível');
  ctx.drawImage(bitmap,0,0);
  const area=document.querySelector('.hero');
  const title=document.querySelector('.hero h1');
  const description=document.querySelector('.hero p');
  if(!area||!title||!description)throw new Error('Destaque ou textos não encontrados');
  const rect=area.getBoundingClientRect();
  const color=(s:string)=>[...s.matchAll(/[\d.]+/g)].slice(0,3).map(v=>Number(v[0]));
  const luminance=(rgb:number[])=>{
   const c=rgb.map(x=>{const v=x/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4});
   return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  const contrast=(a:number[],b:number[])=>{
   const x=luminance(a),y=luminance(b);
   return Math.round(((Math.max(x,y)+.05)/(Math.min(x,y)+.05))*100)/100;
  };
  const targets=[
   {name:'hero-title',rgb:color(getComputedStyle(title).color),min:3},
   {name:'hero-description',rgb:color(getComputedStyle(description).color),min:4.5}
  ];
  const samples=[];
  // Sample the unobstructed 18px edge of the hero at four heights.
  // Approximation of adjacent background pixels, not exhaustive WCAG on gradients.
  for(const portion of [.2,.4,.6,.8]){
   const x=Math.max(0,Math.min(bitmap.width-1,Math.round((rect.left+18)*bitmap.width/window.innerWidth)));
   const y=Math.max(0,Math.min(bitmap.height-1,Math.round((rect.top+rect.height*portion)*bitmap.height/window.innerHeight)));
   const rgba=ctx.getImageData(x,y,1,1).data;
   const background=[rgba[0],rgba[1],rgba[2]];
   for(const target of targets){
    samples.push({name:target.name,position:portion,background,foreground:target.rgb,ratio:contrast(target.rgb,background),min:target.min});
   }
  }
  bitmap.close();
  return {method:'Sampled nearby background pixels in the hero, not pixels under glyphs',samples};
 },screenshot);
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
