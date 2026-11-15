import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {serializeDeclaredSessionReport,serializeDeclaredSessionArchive} from '../src/session-report-export';

const first={id:1,selectedIds:['omsi-bus'],selectedTitles:['Ônibus Urbano Clássico'],
 selectedCount:1,games:['omsi'] as const,blockers:0,notices:0};
const second={...first,id:25};
function jsonUpload(content:string,name='resumo-exportado.json'){
 return {name,mimeType:'application/json',buffer:Buffer.from(content,'utf8')};
}
async function deferFileText(page:Page,name:string){
 await page.evaluate(fileName=>{
  const original=File.prototype.text;
  const gate=new Promise<void>(resolve=>{
   window.addEventListener('release-delayed-json-read',()=>resolve(),{once:true});
  });
  File.prototype.text=function(this:File){
   if(this.name!==fileName)return original.call(this);
   return gate.then(async()=>{
    const data=await original.call(this);
    document.documentElement.dataset.delayedJsonReadDone='yes';
    return data;
   });
  };
 },name);
}
async function finishDeferredRead(page:Page){
 await page.evaluate(()=>{
  window.dispatchEvent(new Event('release-delayed-json-read'));
 });
 await page.waitForFunction(()=>document.documentElement.dataset.delayedJsonReadDone==='yes');
}

test('consulta descartada não reaparece quando leitura JSON anterior termina atrasada',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Histórico'}).click();
 const area=page.getByRole('region',{name:'Consulta de arquivos exportados'});
 const picker=area.getByLabel('Arquivo JSON de resumos exportados');
 await picker.setInputFiles(jsonUpload(serializeDeclaredSessionReport(first)));
 await expect(area).toContainText('Arquivo consultado: 1 resumo(s) declarado(s)');
 await deferFileText(page,'delayed-review.json');
 await picker.setInputFiles(jsonUpload(serializeDeclaredSessionArchive([first,second]),'delayed-review.json'));
 // A newly selected file clears the previous preview. While its File.text()
 // remains unresolved, cancellation is a dedicated stable action.
 await expect(area).not.toContainText('Arquivo consultado');
 const cancel=area.getByRole('button',{name:'Cancelar leitura de JSON'});
 await cancel.click();
 await expect(picker).toBeFocused();
 await expect(cancel).toHaveCount(0);
 await expect(area).not.toContainText('Arquivo consultado');
 await finishDeferredRead(page);
 await expect(area).not.toContainText('Arquivo consultado');
 await expect(area.getByRole('region',{name:'Comparação de resumos do arquivo consultado'})).toHaveCount(0);
 await picker.setInputFiles(jsonUpload(serializeDeclaredSessionReport(second)));
 await expect(area).toContainText('Resumo 25');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});

test('consulta mais recente vence leitura atrasada, sem sobrescrever o JSON válido',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const area=page.getByRole('region',{name:'Consulta de arquivos exportados'});
 const picker=area.getByLabel('Arquivo JSON de resumos exportados');
 await deferFileText(page,'delayed-review.json');
 await picker.setInputFiles(jsonUpload(serializeDeclaredSessionReport(first),'delayed-review.json'));
 await picker.setInputFiles(jsonUpload(serializeDeclaredSessionReport(second)));
 await expect(area).toContainText('Resumo 25');
 await finishDeferredRead(page);
 await expect(area).toContainText('Resumo 25');
 await expect(area).not.toContainText('Resumo 1 ·');
 await expect(area.getByRole('alert')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
});

test('novo catálogo aceito invalida consulta JSON ainda em leitura',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Histórico'}).click();
 const area=page.getByRole('region',{name:'Consulta de arquivos exportados'});
 const picker=area.getByLabel('Arquivo JSON de resumos exportados');
 await picker.setInputFiles(jsonUpload(serializeDeclaredSessionReport(first)));
 await expect(area).toContainText('Arquivo consultado: 1 resumo(s) declarado(s)');
 await deferFileText(page,'delayed-review.json');
 await picker.setInputFiles(jsonUpload(serializeDeclaredSessionReport(second),'delayed-review.json'));
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(resolve('examples/catalog.example.json'));
 await expect(page.getByRole('region',{name:'Confirmar substituição do catálogo'})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByText('Importado: catalog.example.json')).toBeVisible();
 await finishDeferredRead(page);
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(area).not.toContainText('Arquivo consultado');
 await expect(area).not.toContainText('Resumo 25');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});

test('restaurar demonstração cancela importação de catálogo ainda pendente',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const input=page.getByLabel('Arquivo JSON do catálogo');
 await input.setInputFiles(resolve('examples/catalog.example.json'));
 await expect(page.getByText('Importado: catalog.example.json')).toBeVisible();
 await deferFileText(page,'delayed-catalog.json');
 const raw=readFileSync(resolve('examples/catalog.example.json'),'utf8');
 await input.setInputFiles(jsonUpload(raw,'delayed-catalog.json'));
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await expect(page.getByText('Origem: Demonstração')).toBeVisible();
 await finishDeferredRead(page);
 await expect(page.getByText('Origem: Demonstração')).toBeVisible();
 await expect(page.getByRole('button',{name:'Restaurar demonstração'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toBeVisible();
});
