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
