import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

type Screen='Início'|'Jogos'|'Catálogo de mods'|'Minha biblioteca'|'Detalhes'|'Fila de tarefas'|'Histórico'|'Configurações'|'Segurança';
const screens:Record<Screen,string[]>={
 'Início':['.section-title h2'],
 'Jogos':['.page-heading p','.game-tile small','.inspection-header p'],
 'Catálogo de mods':['.result-count','.mod-info .meta','.mod-bottom small','.text-button'],
 'Minha biblioteca':['.page-heading p'],
 'Detalhes':['.relation-verdict','.relation-panel > p','.relation-order small','.version-simulator small','.report-origin','.report-summary small','.report-limits li','.report-findings li > span','.report-footnote'],
 'Fila de tarefas':['.empty h3','.empty p'],
 'Histórico':['.empty p'],
 'Configurações':['.switch-row small','.settings-panel h3'],
 'Segurança':['.security-card p','.security-card h3']
};
const common=['.nav-caption','.brand small','.nav-link:not(.active)','.nav-link.active','.sidebar-bottom','.breadcrumb','.mode-indicator','.footer'];
const headings:Record<Screen,string>={
 'Início':'Seu universo de simulação, organizado.',
 'Jogos':'Escolha seu simulador',
 'Catálogo de mods':'Catálogo de mods',
 'Minha biblioteca':'Minha biblioteca',
 'Detalhes':'Ônibus Urbano Clássico',
 'Fila de tarefas':'Fila de tarefas',
 'Histórico':'Histórico',
 'Configurações':'Configurações',
 'Segurança':'Central de segurança'
};

test('auditoria de contraste nos textos representativos das nove telas',async({page})=>{
 await page.goto('/');
 const findings:Array<{screen:string;selector:string;text:string;foreground:string;background:string;ratio:number;threshold:number;fontSize:number;pass:boolean}>=[];
 const audit=async(screen:string,selector:string)=>{
  const target=page.locator(selector).first();
  await expect(target,'Elemento obrigatório da auditoria: '+screen+' / '+selector).toHaveCount(1);
  const sample=await target.evaluate(el=>{
   const color=(value:string):[number,number,number,number]|null=>{
    const m=value.match(/^rgba?\(([^)]+)\)$/);
    if(!m)return null;
    const channels=m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if(channels.length<3||channels.some(n=>!Number.isFinite(n)))return null;
    return [channels[0],channels[1],channels[2],channels.length>3?channels[3]:1];
   };
   const computed=getComputedStyle(el);
   const foreground=color(computed.color);
   let current:Element|null=el;
   let background:[number,number,number,number]|null=null;
   while(current){
    const bg=color(getComputedStyle(current).backgroundColor);
    if(bg&&bg[3]===1){background=bg;break;}
    current=current.parentElement;
   }
   if(!background)background=color(getComputedStyle(document.documentElement).backgroundColor);
   const luminance=(c:number[])=>{
    const [r,g,b]=c.map(x=>{const v=x/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4});
    return .2126*r+.7152*g+.0722*b;
   };
   if(!foreground||!background)throw new Error('Não foi possível avaliar as cores computadas.');
   const a=luminance(foreground),b=luminance(background);
   const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   const fontSize=parseFloat(computed.fontSize);
   const weight=Number(computed.fontWeight)||400;
   const threshold=(fontSize>=24||(fontSize>=18.66&&weight>=700))?3:4.5;
   return {
    text:(el.textContent??'').trim().slice(0,90),
    foreground:computed.color,
    background:`rgb(${background[0]}, ${background[1]}, ${background[2]})`,
    ratio:Math.round(ratio*100)/100,threshold,fontSize,
    pass:ratio+0.001>=threshold
   };
  });
  findings.push({screen,selector,...sample});
 };
 for(const selector of common)await audit('Global',selector);
 for(const [screen,selectors] of Object.entries(screens) as [Screen,string[]][]){
  if(screen!=='Início'){
   await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:screen}).click();
   await expect(page.getByRole('heading',{name:headings[screen],exact:true})).toBeVisible();
  }
  for(const selector of selectors)await audit(screen,selector);
 }
 const bad=findings.filter(x=>!x.pass);
 const report={
  scope:'Solid backgrounds and representative rendered text on the nine screens; gradients, icons, images and pixel-level appearance are excluded.',
  standard:'WCAG 2.x AA text contrast: 4.5:1 ordinary text, 3:1 large text',
  checked:findings.length,
  failures:bad.length,
  findings
 };
 await mkdir(resolve('test-results'),{recursive:true});
 await writeFile(resolve('test-results/contrast-audit.json'),JSON.stringify(report,null,2),'utf8');
 console.log('VISUAL CONTRAST AUDIT:',findings.length,'representative text samples; failures:',bad.length);
 expect(bad,'Contraste abaixo do mínimo; veja test-results/contrast-audit.json').toEqual([]);
});

test('foco visível usa contorno legível nos controles de navegação',async({page})=>{
 await page.goto('/');
 await page.keyboard.press('Tab'); // Skip link
 await page.keyboard.press('Tab'); // First sidebar button
 const link=page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Início'});
 await expect(link).toBeFocused();
 const css=await link.evaluate(el=>{
  const style=getComputedStyle(el);
  return {outlineStyle:style.outlineStyle,outlineWidth:parseFloat(style.outlineWidth),outlineColor:style.outlineColor};
 });
 expect(css.outlineStyle).not.toBe('none');
 expect(css.outlineWidth).toBeGreaterThanOrEqual(2);
 expect(css.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
});
