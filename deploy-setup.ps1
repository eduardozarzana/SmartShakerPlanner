# Script PowerShell para fazer o primeiro commit e push para GitHub

Write-Host "Preparando para fazer o primeiro commit..." -ForegroundColor Green

# Adicionar todos os arquivos
git add .

# Fazer o commit
git commit -m "🚀 Initial commit - SmartShaker Planner com GitHub Pages"

# Criar branch main (caso não exista)
git branch -M main

# Fazer push para o repositório
git push -u origin main

Write-Host "✅ Projeto enviado para GitHub!" -ForegroundColor Green
Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Acesse https://github.com/eduardozarzana/SmartShakerPlanner" -ForegroundColor White
Write-Host "2. Vá em Settings > Secrets and variables > Actions" -ForegroundColor White
Write-Host "3. Adicione os secrets: GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY" -ForegroundColor White
Write-Host "4. Vá em Settings > Pages e selecione 'GitHub Actions' como source" -ForegroundColor White
Write-Host "5. Seu site estará disponível em: https://eduardozarzana.github.io/SmartShakerPlanner/" -ForegroundColor Cyan
