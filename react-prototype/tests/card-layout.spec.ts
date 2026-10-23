import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

type CardMeasurement={
 title:string;
 top:number;
 bottom:number;
 footerBottom:number;
 cardHeight:number;
 titleSize:number;
 metadataSize:number;
 labelHeight:number;
};
type LayoutMeasurement={
 width:number;
 screen:string;
 documentOverflow:number;
 headingSize:number|null;
 cards:CardMeasurement[];
};

const readLayout=async(page:import('@playwright/test').Page,width:number,screen:string):Promise<LayoutMeasurement>=>{
 return page.evaluate(({width,screen})=>{
  const title=document.querySelector('.page-heading h1,.hero h1,.section-title h2');
  const cards=[...document.querySelectorAll('.mod-card')].map(card=>{
   const rect=card.getBoundingClientRect();
   const footer=card.querySelector('.mod-bottom')?.getBoundingClientRect();
   const name=card.querySelector('.text-button');
   const label=card.querySelector('.meta');
   return {
    title:(name?.textContent??'').trim(),
    top:Math.round(rect.top*10)/10,
    bottom:Math.round(rect.bottom*10)/10,
    footerBottom:footer?Math.round(footer.bottom*10)/10:0,
    cardHeight:Math.round(rect.height*10)/10,
    titleSize:name?parseFloat(getComputedStyle(name).fontSize):0,
    metadataSize:label?parseFloat(getComputedStyle(label).fontSize):0,
    labelHeight:label?.getBoundingClientRect().height??0
   };
  });
  return {
   width,screen,documentOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
   headingSize:title?parseFloat(getComputedStyle(title).fontSize):null,cards
  };
 },{width,screen});
};
const sameRow=(a:CardMeasurement,b:CardMeasurement)=>Math.abs(a.top-b.top)<=2;

test('geometria dos cards mantém rodapés alinhados e textos legíveis',async({page})=>{
 const report:LayoutMeasurement[]=[];
 await page.goto('/');
 for(const width of [1440,1024,850,390]){
  await page.setViewportSize({width,height:820});
  for(const [screen,nav] of [['home','Início'],['catalog','Catálogo de mods']] as const){
   await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:nav}).click();
   const item=await readLayout(page,width,screen);
   report.push(item);
   expect(item.documentOverflow,'Rolagem horizontal '+screen+' '+width).toBeLessThanOrEqual(3);
   expect(item.headingSize,'Título da tela '+screen+' '+width).toBeGreaterThanOrEqual(24);
   expect(item.cards.length,'Cards visíveis '+screen).toBeGreaterThan(0);
   for(const card of item.cards){
    expect(card.titleSize,'Título de mod '+width).toBeGreaterThanOrEqual(14);
    expect(card.metadataSize,'Metadados '+width).toBeGreaterThanOrEqual(11);
    expect(card.footerBottom).toBeGreaterThan(0);
   }
   for(let i=0;i<item.cards.length;i++){
    for(let j=i+1;j<item.cards.length;j++){
     if(!sameRow(item.cards[i],item.cards[j]))continue;
     expect(Math.abs(item.cards[i].bottom-item.cards[j].bottom),'Cards desalinhados '+width).toBeLessThanOrEqual(2);
     expect(Math.abs(item.cards[i].footerBottom-item.cards[j].footerBottom),'Rodapés desalinhados '+width).toBeLessThanOrEqual(3);
    }
   }
  }
 }
 await mkdir(resolve('test-results'),{recursive:true});
 await writeFile(resolve('test-results/card-layout-audit.json'),JSON.stringify({scope:'Measured HTML geometry and computed type at four viewport widths; not a Hydra pixel comparison.',measurements:report},null,2),'utf8');
 console.log('CARD LAYOUT AUDIT:',report.length,'viewport/screen combinations; aligned footers.');
});

test('título extenso no JSON não é truncado no catálogo, inclusive em cards compactos',async({page})=>{
 const name='Ônibus rodoviário experimental edição especial com configuração demonstrativa e documentação de operações';
 expect(name.length).toBeLessThanOrEqual(100);
 const manifest=JSON.stringify({schemaVersion:1,mods:[
  {id:'long-omsi',title:name,game:'omsi',category:'Ônibus',version:'1.2',description:'Somente metadados de teste.',size:'250 MB'},
  {id:'short-omsi',title:'Ônibus de comparação',game:'omsi',category:'Ônibus',version:'1.0',description:'Segundo card de comparação.',size:'22 MB'}
 ]});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({name:'long-catalog.json',mimeType:'application/json',buffer:Buffer.from(manifest)});
 await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 for(const width of [1024,850,390]){
  await page.setViewportSize({width,height:820});
  const card=page.locator('.mod-card').first();
  const metrics=await card.evaluate(card=>{
   const cover=card.querySelector('.mod-cover');
   const title=card.querySelector('.mod-cover-caption strong');
   const label=card.querySelector('.text-button');
   if(!cover||!title||!label)throw new Error('Arte do cartão incompleta');
   const c=cover.getBoundingClientRect(),t=title.getBoundingClientRect();
   return {visibleTitle:label.textContent,artworkTitle:title.textContent,overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),artworkBottom:c.bottom,titleBottom:t.bottom,titleScroll:title.scrollHeight,titleClient:title.clientHeight};
  });
  expect(metrics.visibleTitle).toBe(name);
  expect(metrics.artworkTitle).toBe(name);
  expect(metrics.titleScroll-metrics.titleClient,'Texto cortado na arte '+width).toBeLessThanOrEqual(2);
  expect(metrics.titleBottom,'Legenda fora da arte '+width).toBeLessThanOrEqual(metrics.artworkBottom+2);
  expect(metrics.overflow).toBeLessThanOrEqual(3);
 }
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Configurações'}).click();
 await page.getByRole('checkbox',{name:/Cards compactos/}).check();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.setViewportSize({width:850,height:820});
 const compact=await page.locator('.mod-card').first().evaluate(card=>{
  const cover=card.querySelector('.mod-cover')!.getBoundingClientRect();
  const title=card.querySelector('.mod-cover-caption strong')!.getBoundingClientRect();
  return {bottom:cover.bottom,titleBottom:title.bottom};
 });
 expect(compact.titleBottom,'Título completo na arte compacta').toBeLessThanOrEqual(compact.bottom+2);
 await page.getByRole('button',{name,exact:true}).click();
 await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});

test('foco nos cartões não é ocultado pelo recorte das ilustrações',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 const art=page.getByRole('button',{name:'Ver Ônibus Urbano Clássico'});
 await art.focus();
 const result=await art.evaluate(el=>{
  const style=getComputedStyle(el);
  return {outlineWidth:parseFloat(style.outlineWidth),outlineStyle:style.outlineStyle,offset:parseFloat(style.outlineOffset)};
 });
 expect(result.outlineStyle).not.toBe('none');
 expect(result.outlineWidth).toBeGreaterThanOrEqual(2);
 expect(result.offset).toBeLessThanOrEqual(0);
});
