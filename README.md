# Infinity 3D — Painel de Controle de Produtos, Coleções e Integrações
### Modelo A (Aplicação Separada / Deploy Individual por Cliente)

Este repositório contém o código-fonte do **Painel Administrativo** da loja Infinity Impressões 3D. É um sistema web independente (React + Vite + Tailwind CSS) alimentado por **Supabase** (Postgres, Auth, Storage e Edge Functions) e integrado ao **Stripe** para pagamentos com alta segurança.

---

## 🎯 Arquitetura & Regras de Segurança (Regra de Ouro)

> [!IMPORTANT]
> **Nenhuma chave de API ou credencial sensível existe no código-fonte!**

1. **Supabase Base Connection:** 
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam apenas em variáveis de ambiente da hospedagem (`.env` local e Vercel Environment Variables).
   - A `SERVICE_ROLE_KEY` é de uso exclusivo do servidor e **nunca** exposta no frontend.

2. **Chaves Stripe do Cliente:**
   - Inseridas pelo próprio administrador em **Configurações → Integrações**.
   - O formulário envia a *Secret Key* para a Edge Function `save-stripe-keys`.
   - A Edge Function criptografa a chave usando algoritmo **AES-GCM** e grava na tabela `store_settings`.
   - O navegador do cliente final **nunca** tem acesso à *Secret Key*.

---

## 🚀 Passo a Passo de Setup e Instalação

### 1. Instalar Dependências Locais
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente Locais
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-public-aqui
```

### 3. Rodar as Migrations SQL no Supabase
1. Abra o [Supabase Dashboard](https://supabase.com/dashboard) do cliente.
2. Vá em **SQL Editor** -> **New Query**.
3. Copie o conteúdo completo do arquivo [`supabase/schema.sql`](file:///c:/Users/Valter/Desktop/Infinity%203d%20painel%20de%20controle/supabase/schema.sql) e clique em **Run**.
4. Isso criará as tabelas `products`, `collections`, `store_settings`, ativará o Row Level Security (RLS) e configurará o bucket de mídia `product-images`.

### 4. Configurar e Publicar as Edge Functions
No terminal, execute o login no Supabase CLI e faça o deploy das três Edge Functions:

```bash
# 1. Login e link do projeto
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF

# 2. Configurar o segredo de criptografia das chaves no servidor Supabase
npx supabase secrets set ENCRYPTION_KEY=chave_secreta_aleatoria_32_caracteres

# 3. Deploy das Edge Functions
npx supabase functions deploy save-stripe-keys
npx supabase functions deploy test-stripe-connection
npx supabase functions deploy create-checkout-session
```

### 5. Cadastrar o Primeiro Usuário Administrador
1. No Supabase Dashboard, vá em **Authentication** -> **Users**.
2. Clique em **Add User** -> **Create User**.
3. Defina o e-mail (ex: `admin@infinity3d.com.br`) e a senha do proprietário.
4. Faça o login pelo painel.

---

## 🌐 Deploy na Vercel (Passo a Passo)

Este processo deve ser realizado **tanto no projeto do Painel quanto no da Vitrine**:

1. Entre no [Vercel Dashboard](https://vercel.com) e importe este repositório.
2. Acesse **Settings** -> **Environment Variables**.
3. Adicione as duas variáveis:
   - `VITE_SUPABASE_URL`: URL do projeto Supabase do cliente.
   - `VITE_SUPABASE_ANON_KEY`: Chave `anon public` do projeto.
4. Salve e vá em **Deployments**.
5. Clique nos três pontinhos do último deploy e selecione **Redeploy** para aplicar as variáveis de ambiente.

---

## 📋 Checklist de Entrega e Segurança

- [x] Nenhuma chave (Supabase ou Stripe) em código `.js`/`.jsx`.
- [x] `.env` está no `.gitignore`.
- [x] RLS (Row Level Security) ativado em todas as tabelas.
- [x] `store_settings` bloqueado para leitura direta do cliente.
- [x] Stripe Secret Key salva apenas criptografada.
- [x] Login do admin testado e funcionando.
