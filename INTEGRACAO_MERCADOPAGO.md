# Integração do Mercado Pago no Painel Admin (Checkout Transparente)

## Objetivo

Permitir que cada cliente (loja) conecte sua própria conta do Mercado Pago diretamente pelo painel administrativo, inserindo **Access Token** e **Public Key**. Assim que essas informações forem salvas corretamente, o checkout transparente do site da loja deve passar a funcionar automaticamente, sem necessidade de alterar código ou fazer novo deploy.

Este documento descreve o passo a passo completo: onde armazenar as chaves, como o backend e o frontend devem consumi-las, e como configurar os webhooks — considerando que a plataforma é **multi-tenant** (várias lojas usando o mesmo painel/sistema).

---

## 1. Conceitos-chave

- **Public Key**: pode ser exposta no frontend (navegador). É usada para inicializar o SDK JS do Mercado Pago no site da loja.
- **Access Token**: é uma credencial sensível. **Nunca** deve aparecer no frontend, em variáveis de ambiente do build do site, nem em nenhum lugar visível ao público. Deve ficar apenas no backend.
- **Multi-tenant**: como o mesmo painel atende vários clientes, o sistema precisa sempre saber "de qual loja" (`store_id`) é a requisição, para buscar as chaves corretas daquele cliente — nunca usar uma chave fixa/global.

---

## 2. Onde e como armazenar as chaves

1. Criar uma tabela no Supabase, por exemplo `payment_credentials` (ou reaproveitar `store_settings`), com pelo menos os campos:
   - `store_id` (referência à loja)
   - `provider` (ex: `"mercado_pago"`, já pensando em suportar Stripe também)
   - `access_token` (texto, **criptografado**)
   - `public_key` (texto, pode ser texto puro)
   - `status` (ex: `"não configurado"`, `"válido"`, `"inválido"`)
   - `updated_at`

2. O Access Token deve ser salvo **criptografado** no banco (não em texto puro), e descriptografado apenas no momento de uso pelo backend.

3. Aplicar Row Level Security (RLS) na tabela, garantindo que cada loja só acesse suas próprias credenciais.

---

## 3. Passo a passo do fluxo no painel

### 3.1. Tela do painel (frontend do admin)
- Criar uma seção "Pagamentos" ou "Integrações" no painel, com campos para o cliente colar:
  - Access Token
  - Public Key
- Ao clicar em "Salvar":
  1. Enviar os dados para uma rota/Edge Function do backend (nunca salvar direto do frontend sem validação).
  2. O backend faz uma chamada de teste à API do Mercado Pago (ex: `GET /users/me` usando o Access Token recebido) para confirmar que a chave é válida.
  3. Se válida: salva no banco (criptografado) e marca `status = "válido"`.
  4. Se inválida: retorna erro para o painel, exibindo mensagem clara ("Access Token inválido, verifique e tente novamente") e **não salva** a chave.

### 3.2. Backend (Edge Function de checkout)
- Toda função que cria uma preferência de pagamento ou processa o Payment Brick deve:
  1. Identificar o `store_id` da requisição (pelo domínio do site, subdomínio, ou token da sessão).
  2. Buscar no banco o Access Token daquela loja (descriptografando).
  3. Usar esse token dinamicamente na chamada à API do Mercado Pago — nunca um token fixo no código.

### 3.3. Frontend da vitrine (site do cliente)
- Antes de inicializar o SDK JS do Mercado Pago (para o Payment Brick), o site deve buscar a **Public Key** daquela loja específica através de uma API do seu backend (não deixar fixa em `.env` do build, já que o mesmo código de vitrine pode ser usado por várias lojas).
- Exemplo de fluxo:
  1. Site carrega → chama `GET /api/store/{store_id}/payment-config`
  2. Backend retorna a Public Key correspondente
  3. Frontend inicializa o `Mercado Pago.js` com essa chave

---

## 4. Configuração dos Webhooks (notificações de pagamento)

- O Mercado Pago envia notificações (IPN/Webhooks) para uma URL configurada na conta do cliente ou passada na criação da preferência.
- Como o sistema é multi-tenant, é essencial que o webhook saiba identificar de qual loja é a notificação. Duas opções:
  - **Opção A (recomendada)**: incluir o `store_id` na própria URL do webhook, ex: `https://seusite.com/api/webhook/mercadopago/{store_id}`
  - **Opção B**: usar o `collector_id` (ID do vendedor) que vem na notificação do Mercado Pago para buscar a loja correspondente no banco.
- Ao receber a notificação:
  1. Identificar a loja.
  2. Buscar o Access Token daquela loja.
  3. Consultar a API do Mercado Pago para confirmar o status real do pagamento (nunca confiar apenas no conteúdo da notificação recebida).
  4. Atualizar o status do pedido no banco de dados daquela loja.

---

## 5. Checklist de implementação

- [ ] Criar tabela `payment_credentials` com criptografia do Access Token
- [ ] Aplicar RLS por `store_id`
- [ ] Criar tela no painel para inserir Access Token e Public Key
- [ ] Validar a chave com a API do Mercado Pago antes de salvar
- [ ] Criar Edge Function de checkout que busca token dinamicamente por loja
- [ ] Criar rota que expõe a Public Key correta para o frontend da vitrine
- [ ] Configurar URL de webhook incluindo identificação da loja
- [ ] Implementar validação do pagamento no backend a partir da notificação do webhook (não confiar cegamente na notificação)
- [ ] Testar todo o fluxo em ambiente sandbox do Mercado Pago antes de liberar em produção
- [ ] Exibir no painel o status da integração (ex: "Pagamentos configurados corretamente" ou "Verifique suas chaves")

---

## 6. Resultado esperado

Assim que o cliente inserir Access Token e Public Key válidos no painel:
- O checkout transparente do site da loja passa a funcionar automaticamente.
- Nenhuma alteração de código ou novo deploy é necessária.
- O sistema continua funcionando de forma isolada e segura para cada loja, mesmo sendo uma plataforma multi-tenant.
