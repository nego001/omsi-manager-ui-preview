import {test,expect} from '@playwright/test';

test('navegador exibe inspeção somente leitura desativada fora do desktop',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
 await expect(page.getByRole('heading',{name:'Inspeção local · somente leitura'})).toBeVisible();
 await expect(page.getByText('Disponível apenas no Electron')).toBeVisible();
 await expect(page.getByRole('button',{name:'Selecionar pasta e inspecionar'})).toHaveCount(3);
 for(const button of await page.getByRole('button',{name:'Selecionar pasta e inspecionar'}).all()){
  await expect(button).toBeDisabled();
 }
 await expect(page.getByText('Nenhum caminho completo ou nome de arquivo é enviado à interface.')).toBeVisible();
});

test('inspeção não ativa operações de instalação ou exclusão',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
