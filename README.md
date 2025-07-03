# SmartShaker Planner - Planeje Melhor a Sua Produção

Sistema de planejamento de produção inteligente com integração ao Supabase e Gemini AI.

## 🚀 Deploy no GitHub Pages

Este projeto está configurado para deploy automático no GitHub Pages. Acesse: [https://eduardozarzana.github.io/SmartShakerPlanner/](https://eduardozarzana.github.io/SmartShakerPlanner/)

## 🛠️ Executar Localmente

**Pré-requisitos:** Node.js 18+

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/eduardozarzana/SmartShakerPlanner.git
   cd SmartShakerPlanner
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   - Copie o arquivo `.env.example` para `.env`
   - Preencha com suas credenciais:
     ```
     GEMINI_API_KEY=sua_chave_gemini_aqui
     VITE_SUPABASE_URL=sua_url_supabase_aqui
     VITE_SUPABASE_ANON_KEY=sua_chave_anonima_supabase_aqui
     ```

4. **Execute o app:**
   ```bash
   npm run dev
   ```

## 📦 Build para Produção

```bash
npm run build
```

## 🔧 Configuração do GitHub Pages

### Secrets Necessários:
Configure no GitHub (Settings > Secrets and variables > Actions):

- `GEMINI_API_KEY`: Sua chave da API do Gemini
- `VITE_SUPABASE_URL`: URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase

### Configuração Automática:
1. Push para a branch `main`
2. GitHub Actions fará o build e deploy automaticamente
3. Site disponível em: `https://eduardozarzana.github.io/SmartShakerPlanner/`

## 🗄️ Banco de Dados (Supabase)

O projeto usa Supabase como backend. As credenciais estão configuradas em `supabaseClient.ts` e podem ser sobrescritas por variáveis de ambiente.

## 🧠 Integração com Gemini AI

O sistema utiliza a API do Gemini para funcionalidades de IA. Configure sua chave API nas variáveis de ambiente.

## 🔒 Segurança

- Chaves de API são gerenciadas via variáveis de ambiente
- Supabase usa Row Level Security (RLS) para proteção dos dados
- Nunca exponha credenciais no código fonte
