# Agenda

Agenda de trabalho para o computador: compromissos, tarefas priorizadas e lembretes.
Funciona direto no navegador, sem instalar nada e sem login.

## O que ela faz

- **Dia** (tela inicial): linha do tempo dos compromissos, lista de tarefas já ordenada
  e um painel com o que está acontecendo agora, as tarefas atrasadas e os próximos compromissos.
- **Semana** e **Mês**: visão de calendário. Clique num horário vazio para criar um compromisso
  e num dia para abri-lo.
- **Compromissos**: título, data, horário, local ou link da reunião, projeto, observações,
  lembrete (padrão: 15 minutos antes) e repetição (diária, semanal nos dias escolhidos ou mensal).
  Marque um compromisso como **concluído** pelo círculo no canto do bloco (ou no painel de próximos),
  ou pela opção "Concluído" ao abri-lo. Em compromissos que se repetem, vale só para aquele dia.
  Concluídos ficam riscados, saem de "Próximos" e não geram lembrete.
- **Tarefas**: prioridade Alta/Média/Baixa, prazo opcional (com hora, se quiser) e projeto.
  A ordem é automática: atrasadas primeiro, depois as de maior prioridade e prazo mais próximo.
  Uma tarefa atrasada fica em vermelho até você concluir ou adiar para o próximo dia útil.
- **Lista de itens nas tarefas** (ex.: lista de compras): digite cada item e aperte Enter, ou cole
  uma lista inteira (cada linha vira um item). Na lista de tarefas, clique na seta para expandir
  e marcar os itens ali mesmo. Ao marcar o último, a tarefa é concluída (dá para desfazer).
  O botão **Desmarcar todos** permite reaproveitar a lista.
- **Lembretes**: notificação do sistema e aviso dentro da agenda. Funcionam enquanto a agenda
  estiver aberta em alguma aba do navegador (pode ficar em segundo plano).
- **Caderno de anotações** (aba **Notas**, atalho `A`): várias anotações com título, busca
  (ignora acentos), fixar no topo e projeto. Texto com negrito, itálico, títulos, listas e
  **caixas de seleção** (clique na caixa para marcar). Salva sozinho enquanto você digita.
  Na janela de um compromisso, **Anotações da reunião** cria ou abre a ata daquele dia;
  o compromisso ganha um 📝 quando tem anotação.
- **Projetos**: cores para separar clientes ou frentes de trabalho, com filtro no topo.
  Dá para criar um projeto na hora, ao cadastrar uma tarefa, compromisso ou anotação:
  no campo Projeto, escolha **+ Novo projeto…**.

Atalhos: `C` novo compromisso · `N` nova tarefa · `T` hoje · `D`/`S`/`M` dia, semana e mês · `←` `→` navegar.

## Onde ficam os dados

Os dados ficam **só no seu navegador**, neste computador. Nada é enviado para a internet.
Por isso, faça backup com frequência: **Configurações → Exportar backup** gera um arquivo `.json`.
Para restaurar (ou levar para outro computador), use **Importar backup**.
A agenda avisa quando o último backup tem mais de 7 dias.

Limpar os dados de navegação do site apaga a agenda. Antes de fazer isso, exporte um backup.

## Como publicar no GitHub Pages (uma vez só)

1. No GitHub, abra o repositório → **Settings → General → Danger Zone → Change visibility → Public**.
   Só o código fica público. Seus compromissos e tarefas continuam apenas no seu navegador.
2. Vá em **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**,
   selecione o branch (ex.: `main`) e a pasta `/ (root)` e clique em **Save**.
3. Depois de 1 ou 2 minutos, a agenda fica disponível em `https://<seu-usuario>.github.io/<repositorio>/`.
   Salve nos favoritos e, ao abrir pela primeira vez, clique em **Ativar notificações**.

Dica: no Chrome ou no Edge, use o menu **⋮ → Transmitir, salvar e compartilhar → Instalar página como app**
para abrir a agenda numa janela própria.

## Usar sem publicar

Também dá para baixar a pasta e abrir o `index.html` com dois cliques.
Nesse modo, alguns navegadores bloqueiam as notificações, e mover a pasta de lugar faz a agenda
"perder" os dados, porque eles ficam ligados ao endereço do arquivo.

## Para desenvolvedores

HTML, CSS e JavaScript puro, sem dependências nem etapa de build.

- `js/utils.js`: datas e formatação
- `js/schedule.js`: repetição, situação e ordem das tarefas, posicionamento na linha do tempo
- `js/notes.js`: ordem, busca e limpeza do texto das anotações
- `js/store.js`: armazenamento local e backup
- `js/app.js`: interface

Testes da lógica: `node --test tests/*.test.js`

### Publicando uma versão nova

O GitHub Pages deixa os arquivos guardados no navegador por alguns minutos. Para que todos recebam
a versão nova na hora, **a cada atualização aumente o número da versão** em `version.json`, no
`<meta name="app-version">` e nos `?v=` dos arquivos em `index.html` (o teste
`tests/version.test.js` confere se estão iguais). Ao abrir, a agenda compara com `version.json` e
recarrega sozinha se houver versão nova; se já estiver aberta, mostra o aviso **Atualizar**.
