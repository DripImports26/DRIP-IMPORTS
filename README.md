# Drip Imports — site oficial

Site completo da Drip Imports: catálogo (roupas, tênis e acessórios), cadastro/login de clientes, carrinho, checkout com pagamento via **InfinitePay** (Pix e cartão de crédito) e painel administrativo para cadastrar produtos e ver pedidos.

Construído em **Node.js puro**, sem frameworks nem dependências externas (nenhum `npm install` necessário). Isso significa que ele roda em qualquer lugar que tenha Node instalado, sem risco de erro de instalação de pacotes.

## O que já está pronto

- Home, catálogo com filtro por categoria e busca, página de produto
- Cadastro e login de clientes (sessão por cookie, senha criptografada)
- Carrinho (salvo no navegador) e checkout com endereço de entrega
- Geração automática do link de pagamento InfinitePay (Pix + cartão em até 12x) e confirmação automática via webhook
- Painel `/admin` para cadastrar, editar e excluir produtos, e ver todos os pedidos
- 12 produtos de exemplo (roupas, tênis, acessórios) com fotos placeholder — troque pelos produtos reais pelo painel admin
- Identidade visual preta e roxa com a logo da Drip Imports

## O que falta você preencher

1. O seu **@ (InfiniteTag)** da InfinitePay, para os pagamentos funcionarem de verdade
2. Uma **senha de admin** para acessar o painel
3. Os **produtos reais** que você vai vender (fotos, preços, tamanhos) — cadastre pelo painel `/admin`
4. Um **domínio** (opcional) se quiser algo como `www.dripimports.com.br` em vez do endereço padrão da hospedagem

---

## 1. Rodando no seu computador (teste local)

Pré-requisito: ter o [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

```bash
# 1. Entre na pasta do projeto
cd drip-imports

# 2. Copie o arquivo de configuração de exemplo
cp .env.example .env

# 3. Abra o .env e preencha pelo menos:
#    ADMIN_PASSWORD=uma-senha-forte-sua

# 4. Rode o servidor
npm start
```

Acesse **http://localhost:3000** no navegador. O painel administrativo fica em **http://localhost:3000/admin**.

## 2. Configurando o pagamento (InfinitePay)

O site usa o **Checkout Integrado** da InfinitePay, que aceita Pix (sem taxa) e cartão de crédito parcelado, direto na conta que vocês já têm.

1. Entre na sua conta InfinitePay e confirme qual é o seu **@ (InfiniteTag)** — é o nome que aparece nos seus links de pagamento (ex: `infinitepay.io/dripimports` → o @ é `dripimports`).
2. No arquivo `.env`, preencha:
   ```
   INFINITEPAY_HANDLE=dripimports
   ```
   (sem o símbolo `$`, só o nome de usuário)
3. Depois de publicar o site (passo 3), atualize também:
   ```
   SITE_URL=https://www.seudominio.com.br
   ```
   Isso é usado para montar o link de retorno do cliente e o webhook de confirmação de pagamento.

**Como funciona na prática:** o cliente monta o carrinho e preenche os dados no seu site → o site cria o pedido e chama a InfinitePay para gerar um link de pagamento → o cliente é levado para a página segura de pagamento da InfinitePay (Pix ou cartão) → ao confirmar o pagamento, a InfinitePay avisa automaticamente o seu site (webhook) e o pedido muda para "Pago" → o cliente volta para a página de confirmação no seu site.

Se precisar de ajuda com a integração, o suporte técnico da InfinitePay é `parcerias@cloudwalk.io`.

## 3. Publicando o site (deixando no ar)

Como o projeto é Node.js puro com arquivos salvos localmente (`data/*.json`), ele precisa de uma hospedagem que rode um processo Node contínuo com **disco persistente** — não serve hospedagem só de arquivos estáticos.

Recomendo o **Render.com** (tem plano gratuito para testar e é simples de configurar) ou **Railway.app**. Posso te acompanhar nesse passo a passo quando você estiver pronto; de forma resumida:

1. Criar uma conta no Render (ou Railway)
2. Criar um novo "Web Service" apontando para este código (subo para o GitHub se preferir, ou você faz upload direto)
3. Comando de start: `npm start`
4. Adicionar as variáveis de ambiente (as mesmas do `.env`): `PORT`, `SITE_URL`, `INFINITEPAY_HANDLE`, `ADMIN_PASSWORD`, `SESSION_SECRET`
5. Ativar um **disco persistente** apontando para a pasta `data/` (para os produtos, clientes e pedidos não sumirem a cada atualização)
6. Depois de publicado, ligar o seu domínio próprio (`www.dripimports.com.br`) nas configurações de domínio da hospedagem

Quando você tiver a conta criada na hospedagem escolhida, me chame que eu te guio passo a passo nessa parte.

## 4. Cadastrando seus produtos de verdade

1. Acesse `/admin` e entre com a senha definida em `ADMIN_PASSWORD`
2. Em **Produtos**, clique em **+ Novo produto** para cada item: nome, categoria, preço, tamanhos disponíveis, estoque, foto e descrição
3. Para a foto, hospede a imagem em algum lugar (ex: um link direto de imagem) e cole a URL no campo "URL da imagem" — ou me avise que posso te ajudar a montar uma forma de upload de fotos direto pelo painel depois
4. Marque "Produto em destaque" para aparecer na home

Os 12 produtos de exemplo (com foto placeholder escrito "FOTO ILUSTRATIVA") podem ser editados ou excluídos a qualquer momento.

## Estrutura do projeto

```
drip-imports/
  server.js          servidor principal (rotas de página + API)
  lib/
    db.js             leitura/escrita dos dados (JSON)
    auth.js            login, sessões, senhas
    infinitepay.js      integração com o checkout da InfinitePay
  data/
    products.json       catálogo de produtos
    users.json           clientes cadastrados
    orders.json          pedidos
  public/               CSS, JS do navegador, imagens
  views/                páginas HTML do site e do admin
  .env.example          modelo de configuração
```

## Segurança antes de publicar

- Troque `ADMIN_PASSWORD` e `SESSION_SECRET` no `.env` por valores fortes e únicos — nunca deixe os valores de exemplo
- Nunca suba o arquivo `.env` (com suas senhas reais) para um repositório público
- Depois de publicado, confirme que o site abre em `https://` (com cadeado) antes de divulgar para clientes

## Limitações atuais (para você saber)

- Os dados ficam em arquivos JSON, ótimo para começar; se a loja crescer muito (milhares de pedidos/produtos), vale migrar para um banco de dados de verdade — posso ajudar nessa migração quando chegar a hora
- O upload de fotos hoje é por URL (você cola o link da imagem); dá para evoluir para upload direto de arquivo
- Sessões de login ficam em memória — se o servidor reiniciar, os clientes precisam logar de novo (não afeta pedidos nem produtos, que ficam salvos)
