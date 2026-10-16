# CRM Decoding + Iris

Case técnico — Desenvolvedor(a) Full Stack Pleno. Dashboard comercial e assistente de IA (Iris) sobre a mesma base de dados.

> README completo em construção. Decisões e plano de implementação em [`docs/PLAN.md`](docs/PLAN.md).

## Execução rápida

```bash
npm install
cp .env.example .env.local      # preencha DATABASE_URL, DATABASE_URL_READONLY e OPENAI_API_KEY
# opcional, sem Neon: docker compose up -d
npm run db:migrate
npm run db:seed
npm run db:check-readonly       # confirma que a role da Iris só consegue ler
npm run dev
```
