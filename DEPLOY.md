# Guia de Deploy para GitHub Pages

Este projeto está configurado para ser publicado automaticamente no GitHub Pages usando GitHub Actions.

## Passos para Publicar:

### 1. Preparar o Repositório
1. Crie um novo repositório no GitHub
2. Faça o upload de todos os arquivos do projeto

### 2. Configurar as Variáveis de Ambiente no GitHub
1. Acesse: Settings > Secrets and variables > Actions
2. Adicione uma nova secret chamada `GEMINI_API_KEY`
3. Cole sua chave da API do Gemini no valor

### 3. Configurar GitHub Pages
1. Acesse: Settings > Pages
2. Em "Source", selecione "GitHub Actions"

### 4. Ajustar o Base Path
No arquivo `vite.config.ts`, substitua o nome do repositório na linha:
```typescript
base: mode === 'production' ? '/SEU-NOME-DO-REPOSITORIO/' : '/',
```

### 5. Fazer o Deploy
1. Faça commit e push para a branch `main`
2. O GitHub Actions irá automaticamente fazer o build e deploy
3. O site estará disponível em: `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`

## Comandos Úteis:

- `npm run dev` - Executar em modo desenvolvimento
- `npm run build` - Fazer build para produção
- `npm run preview` - Visualizar o build local
- `npm run deploy` - Deploy manual (alternativa)

## Configuração do Supabase:

As credenciais do Supabase estão no arquivo `supabaseClient.ts`. 
- A chave `anon public` é segura para uso no frontend
- Certifique-se de que as políticas RLS estão configuradas corretamente no Supabase

## Troubleshooting:

- Se o deploy falhar, verifique os logs no GitHub Actions
- Certifique-se de que a chave `GEMINI_API_KEY` está configurada nos secrets
- Verifique se o nome do repositório está correto no `vite.config.ts`
