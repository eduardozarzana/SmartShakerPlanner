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
Write-Host "1. Acesse https://github.com/eduardozarzana/SmartShakerPlanner/settings/secrets/actions" -ForegroundColor White
Write-Host "2. Adicione os seguintes secrets:" -ForegroundColor White
Write-Host "   - GEMINI_API_KEY: sua_chave_gemini_aqui" -ForegroundColor Cyan
Write-Host "   - VITE_SUPABASE_URL: https://ardzsloaomwjakqbcxsr.supabase.co" -ForegroundColor Cyan
Write-Host "   - VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZHpzbG9hb213amFrcWJjeHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2NDIyMDYsImV4cCI6MjA2NDIxODIwNn0.SaQJvU2S9CbvwNKhZ1Sqxh0-yxuJDDs-SkufF3zNLkE" -ForegroundColor Cyan
Write-Host "3. Vá em Settings > Pages e selecione 'GitHub Actions' como source" -ForegroundColor White
Write-Host "4. Seu site estará disponível em: https://eduardozarzana.github.io/SmartShakerPlanner/" -ForegroundColor Green
