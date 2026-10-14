# Agenda

Agenda de trabalho para o computador: compromissos, tarefas priorizadas e lembretes.
Funciona direto no navegador, sem instalar nada e sem login.

## O que ela faz

- **Layout inspirado no Google Agenda**:
  - **Barra lateral** (☰ recolhe): botão **＋ Criar** (compromisso, tarefa ou anotação),
    calendário pequeno do mês (clique num dia para ir até ele) e **Meus projetos** com caixinhas
    para mostrar ou esconder cada projeto (a escolha fica lembrada).
  - **Semana** (tela inicial), **Dia** e **Mês**, com compromissos em blocos da cor do projeto.
  - **Painel direito** (botão ao lado da engrenagem recolhe): acontecendo agora, não concluídos,
    tarefas, atrasadas e próximos compromissos.
  - Clique num compromisso para abrir o **cartão rápido** (concluir, anotações, editar, excluir);
    clique duplo abre direto a janela de edição. Clique num horário vazio para o **cadastro rápido**
    (digite o título e Enter; "Mais opções" abre a janela completa).
- **Compromissos**: título, data, horário, local ou link da reunião, projeto, observações,
  lembrete (padrão: 15 minutos antes) e repetição (diária, semanal nos dias escolhidos ou mensal).
  Marque um compromisso como **concluído** pelo círculo no canto do bloco (ou no painel de próximos),
  ou pela opção "Concluído" ao abri-lo. Em compromissos que se repetem, vale só para aquele dia.
  Concluídos ficam riscados, saem de "Próximos" e não geram lembrete.
  Compromissos que **já terminaram sem ser marcados** aparecem no quadro **Não concluídos**
  (últimos 7 dias; em compromissos que se repetem, só a partir do dia do cadastro), com destaque laranja na linha do tempo e no contador da aba do navegador.
  Dá para concluir um a um, **Concluir todos**, ou **Ignorar** (ex.: a reunião não aconteceu).
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
  **caixas de seleção** (clique na caixa para marcar) e **tabelas**: o botão ▦ Tabela insere uma
  tabela com cabeçalho; com o cursor numa célula aparecem os botões para adicionar ou remover linhas
  e colunas, e `Tab` passa para a próxima célula (na última, cria uma linha nova).
  **Marcar** destaca o texto selecionado em amarelo (clique de novo para tirar).
  **Prints e imagens**: cole com `Ctrl+V` (ex.: depois de `Win+Shift+S`), arraste um arquivo
  para a anotação ou use o botão 🖼 Imagem. As imagens são reduzidas para no máximo 1920 px.
  Salva sozinho enquanto você digita.
  Na janela de um compromisso, **Anotações da reunião** cria ou abre a ata daquele dia;
  o compromisso ganha um 📝 quando tem anotação.
  O botão **⬇ .md** salva a anotação aberta como arquivo Markdown (`.md`), com título,
  projeto, reunião, títulos, listas, caixas de seleção (`- [x]`), tabelas, marca-texto
  (`<mark>`) e imagens (embutidas no próprio arquivo).
- **Projetos**: cores para separar clientes ou frentes de trabalho, com filtro no topo.
  Dá para criar um projeto na hora, ao cadastrar uma tarefa, compromisso ou anotação:
  no campo Projeto, escolha **+ Novo projeto…**.

Atalhos: `C` novo compromisso · `N` nova tarefa · `T` hoje · `D`/`S`/`M` dia, semana e mês · `←` `→` navegar.

## Onde ficam os dados

Os dados ficam **só no seu navegador**, neste computador. Nada é enviado para a internet.
As imagens das anotações ficam num banco do próprio navegador (IndexedDB), que comporta bem mais
espaço; elas também entram no backup.
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
- `js/images.js`: imagens das anotações (IndexedDB), compressão e backup delas
- `js/store.js`: armazenamento local e backup
- `js/app.js`: interface

Testes da lógica: `node --test tests/*.test.js`

### Publicando uma versão nova

O GitHub Pages deixa os arquivos guardados no navegador por alguns minutos. Para que todos recebam
a versão nova na hora, **a cada atualização aumente o número da versão** em `version.json`, no
`<meta name="app-version">` e nos `?v=` dos arquivos em `index.html` (o teste
`tests/version.test.js` confere se estão iguais). Ao abrir, a agenda compara com `version.json` e
recarrega sozinha se houver versão nova; se já estiver aberta, mostra o aviso **Atualizar**.
