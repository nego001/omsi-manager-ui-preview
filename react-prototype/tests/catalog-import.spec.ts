import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const catalogPath=resolve('examples/catalog.example.json');
function file(name:string,content:string){
 return {name,mimeType:'application/json',buffer:Buffer.from(content,'utf8')};
}
test('importar metadados locais, filtrar três jogos e restaurar demonstração',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(catalogPath);
 await expect(page.getByText('Importado: catalog.example.json')).toBeVisible();
 await expect(page.getByText('3 resultados')).toBeVisible();
 await expect(page.getByRole('button',{name:'Ônibus urbano OF-1721',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Euro Truck Simulator 2',exact:true}).click();
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Pacote de som de motor',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pacote de som de motor',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Pacote de som de motor',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await expect(page.getByText('7 resultados')).toBeVisible();
 await expect(page.getByText('Origem: Demonstração')).toBeVisible();
});
test('rejeitar JSON inválido sem apagar catálogo existente',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file('broken.json','{'));
 await expect(page.getByRole('alert')).toContainText('Arquivo JSON inválido.');
 await expect(page.getByText('7 resultados')).toBeVisible();
});
test('rejeitar IDs duplicados, campos perigosos e referências a comandos',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 const good=JSON.parse(readFileSync(catalogPath,'utf8'));
 const withDuplicates={schemaVersion:1,mods:[good.mods[0],good.mods[0]]};
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file('duplicates.json',JSON.stringify(withDuplicates)));
 await expect(page.getByRole('alert')).toContainText('ID duplicado');
 const withCommands={schemaVersion:1,mods:[{...good.mods[0],command:'del C:\\\\Games'}]};
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file('commands.json',JSON.stringify(withCommands)));
 await expect(page.getByRole('alert')).toContainText('campo não permitido: command');
 await expect(page.getByText('7 resultados')).toBeVisible();
});
test('arquivo maior que 1 MB é bloqueado',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file('oversize.json','a'.repeat(1_000_100)));
 await expect(page.getByRole('alert')).toContainText('excede 1 MB');
 await expect(page.getByText('7 resultados')).toBeVisible();
});
test('conteúdo de usuário aparece como texto e não como HTML executável',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 const sample={schemaVersion:1,mods:[{id:'xss-test',title:'<img src=x onerror=alert(1)>',game:'omsi',category:'Ônibus',version:'1',description:'<script>window.hacked=true</script>',size:'1 MB'}]};
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file('escaped.json',JSON.stringify(sample)));
 await expect(page.getByRole('button',{name:'<img src=x onerror=alert(1)>',exact:true})).toBeVisible();
 await expect(page.locator('.mod-card img')).toHaveCount(0);
 await page.getByRole('button',{name:'<img src=x onerror=alert(1)>',exact:true}).click();
 await expect(page.getByText('<script>window.hacked=true</script>')).toBeVisible();
 expect(await page.evaluate(()=>('hacked' in window))).toBe(false);
});

test('manifesto rejeita chaves extras na raiz e não perde o histórico após importação inválida',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 const history=page.getByRole('region',{name:'Análises declarativas desta sessão'});
 await expect(history).toContainText('Ônibus Urbano Clássico');
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const good=JSON.parse(readFileSync(catalogPath,'utf8'));
 for(const extra of ['command','modPath','installer','__proto__']){
  const unsafe=JSON.parse(JSON.stringify(good));
  Object.defineProperty(unsafe,extra,{value:'ignored-but-forbidden',enumerable:true});
  await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(
   file('root-extra.json',JSON.stringify(unsafe)));
  await expect(page.getByRole('alert')).toContainText('campo não permitido na raiz');
  await expect(page.getByText('7 resultados')).toBeVisible();
 }
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(history.locator('li')).toHaveCount(1);
 await expect(history).toContainText('Ônibus Urbano Clássico');
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(catalogPath);
 await expect(page.getByText('Importado: catalog.example.json')).toBeVisible();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(history).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Exportar todos os resumos em JSON'})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Comparar resumos declarados da sessão'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const imported=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus urbano OF-1721',exact:true})});
 await imported.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus urbano OF-1721 para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(history.locator('li')).toHaveCount(1);
 await expect(history).toContainText('Ônibus urbano OF-1721');
 await expect(history).not.toContainText('Ônibus Urbano Clássico');
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(history).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
