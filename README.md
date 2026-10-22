# FitCore — repositório de publicação

Este repositório contém a plataforma Next.js do FitCore, preparada para importar
na Vercel com **Root Directory `.`** e Framework Preset **Next.js**.

## Prévia pública na Vercel

1. Na Vercel, escolha **Add New → Project → Import Git Repository**.
2. Selecione **Pairon03/korvexapp-2**.
3. Mantenha Root Directory `.` e os comandos padrão (`npm run build`).
4. Para a prévia, não é necessário cadastrar credenciais de banco, IA ou pagamentos.
5. Clique em Deploy. O endereço `vercel.app` deve ser fornecido pela Vercel após
   a conclusão; este documento não presume que o deploy já ocorreu.

Sem `DATABASE_URL` e `APP_DATABASE_URL`, o projeto abre automaticamente em modo
**prévia pública**. A landing e `/previa` funcionam sem PostgreSQL. Os exemplos
são fictícios, navegação e busca são locais, e operações de conta/upload/dados
retornam 503 sem tentar acessar serviços não configurados. Nenhuma informação
pessoal é coletada na prévia. `PUBLIC_PREVIEW=true` força esse modo mesmo com
conexões presentes.

Para habilitar o SaaS real, configure ambas as conexões PostgreSQL, execute as
migrações e configure APP_URL com o domínio real. E-mail, IA, pagamentos e storage
precisam de configuração e homologação conforme os documentos abaixo. Não
confunda o deploy da prévia com um piloto comercial pronto.

## Executar a prévia localmente

```sh
npm ci
npm run build
npm start
```

Nenhum `.env` é necessário para a prévia. Para desenvolvimento use `npm run dev`.

---

# FitCore Platform — primeira entrega SaaS

Este é o repositório de publicação da plataforma profissional. O aplicativo pessoal
Flutter permanece no projeto de origem e não é incluído neste repositório. A mudança de escopo para SaaS com
assinaturas segue o novo documento de produto; a marca FitCore foi mantida
provisoriamente em vez de adotar Evolutio AI sem identidade definida.

**Estado:** caminho funcional local e homologação de infraestrutura. Não é um
lançamento comercial nem uma confirmação de produção. IA, pagamento e e-mail
externo requerem configuração e testes reais antes de piloto com usuários.

## Arquitetura

- Next.js 16.4.2, React 19, TypeScript, App Router e Tailwind 4.
- Node.js 24.19.0 e PostgreSQL 17, testados nesta máquina.
- `src/domain`: contratos Zod, validações determinísticas, datas por fuso.
- `src/server`: autenticação, transações com RLS, programas, IA, ciclos,
  cobrança e fotos privadas. Nenhum segredo é enviado ao cliente.
- `src/components`: formulários, painel, execução e fotos, responsivos.
- `src/app`: páginas públicas, autenticação, área protegida e API.
- `migrations`: migrações SQL versionadas com checksum.
- `scripts`: migração, worker, seed, operação, backup e E2E.
- `tests`: domínio, PostgreSQL/RLS, concorrência, adaptadores e fotos.
- `docs`: arquitetura, API, implantação e limitações.

PostgreSQL é real no desenvolvimento; não há backend em localStorage. Somente o
rascunho de uma sessão em andamento fica no navegador até o envio explícito.
O backend usa um usuário restrito para dados da organização e outro para
identidade/operações internas. RLS é ativada e forçada nas tabelas privadas.
Fotos ficam fora da pasta pública e exigem sessão e token temporário de 60s.

Escolhemos autenticação local em PostgreSQL para exercitar os fluxos sem exigir
um projeto Supabase externo. A integração de Supabase Auth não foi implementada
nesta nova plataforma. O Supabase pode hospedar PostgreSQL se forem provisionadas
as roles/conexões necessárias; não aplicar estas migrações na base Flutter antiga
sem revisar a coexistência de schemas e permissões.

## Executar localmente

Requisitos: Node 24+, npm, Docker, Chromium para E2E.

```sh
cd /workspace/korvexapp-2
cp .env.example .env # somente se o arquivo ainda não existir
bash scripts/local-db.sh
npm ci
npm run db:migrate
npm run dev
```

O servidor usa a porta 3000. `APP_URL` precisa corresponder exatamente à origem
usada no navegador; o valor de desenvolvimento é `http://localhost:3000`.
Não altere só a porta do servidor sem atualizar APP_URL. As mutações exigem a
origem configurada para mitigar CSRF. Não use a configuração trust do PostgreSQL
local em produção: ela é restrita a loopback e serve apenas ao desenvolvimento.

### Conta e e-mail de desenvolvimento

Cadastre-se na interface. Com `MAIL_MODE=outbox`, os e-mails não são entregues:
são gravados em `.local/mail` com permissão restrita e ignorados no Git.
Execute `npm run mail:latest` em seu terminal para abrir o link de confirmação,
convite ou recuperação. Esses arquivos contêm links de acesso: não publique
nem envie seu conteúdo em logs compartilhados. Não há senha administrativa fixa.

Opcionalmente crie uma organização sintética, sem enviar e-mail:

```sh
ALLOW_DEV_SEED=true npm run seed
```

As credenciais aleatórias ficam em `.local/demo-login.json`, não no console.
Seed é recusado em produção. Os testes usam organizações isoladas identificadas
por nomes/e-mails sintéticos. Eles nunca limpam dados reais; em produção não
execute seed ou testes destrutivos. Não há comando de limpeza massiva nesta
entrega: descarte apenas um banco dedicado de testes após confirmar seu uso.

## Caminho funcional disponível

1. Personal cria conta, confirma e-mail e entra.
2. Cadastra aluno e envia convite; aluno aceita e cria sua conta.
3. Personal cadastra exercícios próprios, agente e avaliação recente.
4. Cria programa estruturado, valida e publica uma versão imutável.
5. Um programa associado ao agente cria um ciclo (45 dias por padrão).
6. Aluno acessa apenas seus registros e salva séries/carga/repetições/RPE.
7. Sessão finalizada persiste no PostgreSQL e reaparece após recarregar.
8. Dor/desconforto registrado suspende ciclos para revisão.
9. Fotos são opcionais. Apenas o aluno autoriza; upload remove metadados,
   reencoda imagens e cria nomes aleatórios. Revogação remove fotos ativas.
10. Conta permite exportar JSON e registrar solicitação de exclusão.

Propostas não são publicadas ao salvar. A publicação repete as validações e
verifica se perfil, avaliação ou versão vigente mudaram. Requisições concorrentes
não criam duas versões. Alterar um agente cria uma versão e não modifica os
programas/ciclos já publicados. Organizações podem convidar profissionais e
alterar o fuso de ciclos futuros; trocar organização valida o vínculo no backend.

## Worker e ciclos

```sh
npm run worker             # processo contínuo, intervalo padrão 30 segundos
npm run worker -- --once   # uma rodada, para diagnóstico
```

Os ciclos são registros persistentes no banco, não timers de navegador. O
worker identifica vencimentos pelo relógio PostgreSQL, faz claim com lease de
5 minutos e limita a 3 tentativas. Faltam dados? O programa atual é mantido.
Não há exigência de fotos. Datas são calculadas em dias de calendário no fuso
da conta, inclusive mudanças de horário de verão.

Publicação automática exige autorização no aluno e na versão imutável do agente,
avaliação do ciclo, assinatura válida e validações aprovadas. Sem autoPublish,
uma proposta válida fica para revisão. Respostas inválidas ficam bloqueadas;
a recuperação com mudança de contexto e re-geração no mesmo ciclo precisa ser
refinada antes de produção. É possível corrigir manualmente criando uma nova
proposta e publicando uma versão que inicia um novo ciclo.

## Configurar integrações reais

### IA

Configure `AI_API_KEY`, `AI_MODEL` e, opcionalmente, `AI_BASE_URL` (HTTPS).
A implementação usa API compatível com Chat Completions e JSON Schema estrito.
Selecione um modelo que suporte `response_format: json_schema` e
`max_completion_tokens`. Nenhuma chave tem prefixo NEXT_PUBLIC.
O contexto inclui regras, perfil sem nome/e-mail, avaliação, biblioteca,
programa vigente e até dez execuções anteriores. Fotos não são incluídas.

Timeout padrão 20s, até 2 requisições por execução em falhas transitórias,
backoff/jitter e teto de contexto. São reservados conservadoramente 64.000 tokens
por execução para duas chamadas; falhas também consomem reserva, evitando loops
sem controle. Tokens reais são registrados quando o provedor os retorna.
Estimativas monetárias não são inventadas: falta configurar preços/modelo e
validar o teto em homologação. Credencial ausente retorna 503 sem gerar conteúdo.

### E-mail

Configure `MAIL_MODE=provider`, `RESEND_API_KEY` e `MAIL_FROM` com domínio
verificado no Resend. O envio usa a API real. Outbox de desenvolvimento é
recusada em produção. As notificações de treino são internas nesta entrega;
e-mail assíncrono com fila/retries para todos os eventos ainda está pendente.

### Assinaturas

Configure `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` no servidor. O segredo do
webhook precisa ser um valor real disponível no processo para validar HMAC;
um placeholder de um proxy de segredos não funciona para esse cálculo local.
Crie produtos/preços recorrentes BRL na Stripe em ambiente de TESTE e vincule-os:

```sh
npm run admin -- plan essential 7900 20 100000 price_ID_DE_TESTE
```

O comando atualiza configuração no banco e registra a operação. Não executa uma
cobrança. Configure também o portal Stripe e o webhook `/api/billing/webhook`
para eventos `customer.subscription.created/updated/deleted`.
Checkout e portal são hospedados no provedor. Eventos têm assinatura verificada,
ID único e reconciliação do estado canônico. O retorno do navegador não ativa a
assinatura. Falhas de pagamento não apagam dados.

**Não homologado ao vivo.** Antes de ativar pagamentos: testar aprovação, recusa,
renovação, troca de plano no portal, cancelamento, eventos duplicados/fora de
ordem e múltiplos checkouts concorrentes. A reconciliação de preço e a reserva de checkout estão implementadas, mas
a política configurável de carência ainda precisa ser concluída e homologada. Esta entrega
não está autorizada a cobrar clientes reais apenas por conter integração.

## Testes e produção

```sh
npm run typecheck
npm run lint
npm test                 # exige PostgreSQL de desenvolvimento
npm run build
npm run test:e2e         # exige servidor dev com outbox e Chromium
```

O E2E cria apenas dados sintéticos e testa o e-mail pela outbox local, sem fingir
que houve entrega externa. As capturas ficam em `test-results/` (ignoradas).
Os testes do adaptador IA usam fixtures de rede explicitamente isoladas, não
chamadas reais nem validação de qualidade de programas gerados pelo provedor.
Consulte `docs/VALIDATION.md` para resultados reais desta entrega.

Produção: `npm run build && npm start`, usando PostgreSQL e armazenamento privado
duráveis, secrets do host, e-mail real, TLS e worker separado supervisionado.
O Next.js depende do backend: não pode ser publicado como o ZIP estático Flutter.
Leia `docs/DEPLOY.md` antes de hospedar. Não foi publicado um endereço externo.

## Operação e pendências

```sh
npm run admin -- metrics
bash scripts/backup-local.sh
bash scripts/restore-check.sh .local/backups/ARQUIVO.dump
```

A restauração de verificação usa um banco separado e o remove ao terminar.
Backup de fotos é separado do dump PostgreSQL. Backups locais não significam
backup de produção, criptografia/retencão ou atendimento de exclusão em backups.

Ainda pendentes: painel global administrativo e suporte com acesso excepcional;
permissões granulares além de owner/trainer/student; remoção/reenvio/expiração
avançada de vínculos; edição completa de aluno; catálogo curado e mídias;
protocolos de dobras/cálculos validados; comparação detalhada de versões;
restauração com atribuição específica (a interface atualmente cria proposta
manual baseada em versão anterior); queue de notificações e e-mail transacional
com retries; observabilidade externa; custos monetários de IA; SSO/MFA;
políticas de retenção e eliminação completa; homologação de pagamentos;
app nativo e PWA offline instalável. A web é responsiva, sem promessa de app
publicado em lojas nem de sincronização offline garantida.

Fotos usam disco privado nesta fase. Produção com múltiplas réplicas precisa de
armazenamento compartilhado/objeto privado, backup e rotina de limpeza de órfãos.
Nenhum upload é servido de `public/`. Solicitações de exclusão são registradas,
mas eliminação em todos os derivados/backups requer processo operacional.
Termos/privacidade são rascunhos para revisão, não garantia de conformidade LGPD.
