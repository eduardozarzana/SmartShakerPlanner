#!/bin/bash

# Script para fazer o primeiro commit e push para GitHub

echo "Preparando para fazer o primeiro commit..."

# Adicionar todos os arquivos
git add .

# Fazer o commit
git commit -m "🚀 Initial commit - SmartShaker Planner com GitHub Pages"

# Criar branch main (caso não exista)
git branch -M main

# Fazer push para o repositório
git push -u origin main

echo "✅ Projeto enviado para GitHub!"
echo "📝 Próximos passos:"
echo "1. Acesse https://github.com/eduardozarzana/SmartShakerPlanner"
echo "2. Vá em Settings > Secrets and variables > Actions"
echo "3. Adicione os secrets: GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
echo "4. Vá em Settings > Pages e selecione 'GitHub Actions' como source"
echo "5. Seu site estará disponível em: https://eduardozarzana.github.io/SmartShakerPlanner/"
