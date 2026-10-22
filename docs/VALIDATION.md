# Evidências de validação — 21/10/2026

## Executado na máquina

- PostgreSQL 17-alpine iniciado em Docker, porta loopback 54329.
- Migrações aplicadas em banco real; reruns sem alteração aceitos pelo migrador.
- Compilação Next.js de produção executada antes dos incrementos finais; a
  compilação final será registrada abaixo após o último conjunto de alterações.
- TypeScript e ESLint executados, problemas encontrados corrigidos.
- Testes de domínio, PostgreSQL/RLS, concorrência, adaptadores e fotos executados.
  Os números finais do último run são registrados abaixo.

## Fluxo Playwright executado

Cadastro do personal → e-mail na outbox de desenvolvimento → confirmação →
login → aluno → exercício → agente → avaliação → proposta manual validada →
publicação → ciclo → registro de séries → reload → histórico persistente.
Também executado: convite real em token de uso único → criação de conta do
aluno → programa próprio → consentimento → upload privado de PNG sintético
reencodado → leitura JPEG autorizada → rejeição do mesmo link por outra conta →
revogação → remoção da foto ativa. Nenhuma foto real foi utilizada.

O script verifica rejeição de outra organização, origem CSRF inválida, exportação,
logout e estado indisponível de IA/pagamento sem credenciais. A landing foi
verificada em desktop 1440×1000 e mobile 390×844 sem overflow horizontal.
Capturas reais estão em `test-results/`, ignoradas no Git.

## O que não significa aprovação

A outbox não comprova entrega de e-mail externo. Fixtures de `fetch` nos testes
de IA comprovam parsing/retry/validação, não geração real nem qualidade clínica.
A rejeição de assinatura Stripe inválida não homologa compra, renovação,
cancelamento ou reconciliação no provedor. Nenhum domínio foi publicado.

Não testados: React Native/lojas, app offline, produção Supabase gerenciada,
tráfego de carga, SSO/MFA, storage multi-instância, notificações externas em fila,
visão computacional ou protocolos de composição corporal. Não foram inventados
resultados para essas áreas.

## Resultado do último conjunto funcional

- `npm test`: **20 testes aprovados**, zero falhas, zero skips.
- `npm run lint`: sem erros ou avisos.
- `npm run typecheck`: sem erros.
- `npm run test:e2e`: fluxo completo aprovado, inclusive convite de profissional
  e rejeição da alteração de organização por papel trainer.
- `npm run worker -- --once`: rodada concluída, sem ciclos elegíveis naquele run.
- `backup-local.sh` + `restore-check.sh`: dump restaurado em base temporária;
  consulta retornou 17 alunos sintéticos e 18 tabelas com RLS. A base temporária
  foi removida pelo script, sem substituir a original. O backup representa o
  instante em que foi produzido, não escritas posteriores de testes.
- `npm run admin -- metrics`: agregados consultados sem expor medidas ou fotos.

Todos os registros de testes foram gerados por fixtures/E2E em organizações de
homologação. As capturas não contêm dados reais de um cliente.

## Configuração persistida

O rascunho do ambiente contém instalação com lockfile, inicialização PostgreSQL,
migrador, startup Next.js/worker e preservação do Flutter anterior. Também foram
salvos requisitos de AI_API_KEY, STRIPE_SECRET_KEY e RESEND_API_KEY com destinos
api.openai.com, api.stripe.com e api.resend.com, além dos nomes AI_MODEL/MAIL_FROM.
Credenciais não foram inventadas, impressas ou incluídas no código. O segredo
HMAC de webhook deve ser provisionado como valor real no processo backend.
Salvar o rascunho não aplica credenciais, não publica o ambiente e não publica
um domínio externo.


## Fechamento desta entrega

A instalação salva foi exercitada: Flutter anterior com lockfile preservado,
`npm ci`, startup PostgreSQL e migração idempotente. O build final Next.js passou
sem os avisos de tracing após excluir dados privados do empacotamento e marcar
operações de filesystem como runtime. Foram verificados 2.960 caminhos de trace
naquele build: nenhuma referência a `.local`, `.env` ou capturas de teste.

A execução `npm start` do build compilado passou por landing, hidratação,
login de uma conta sintética já verificada, painel PostgreSQL e headers no-store.
Isso não comprova envio de e-mail em produção. O seed de desenvolvimento foi
executado e guardou credenciais aleatórias apenas em arquivo ignorado.

O teste adicional de limite comercial comprovou que reativar um aluno arquivado
não contorna o limite de alunos ativos. Reserva conservadora de IA foi elevada
para 64.000 tokens por execução de até duas chamadas; não é cotação monetária.
`npm run lint`, `npm run typecheck`, 20 testes e o build passaram após as correções.
A aplicação foi então reiniciada em desenvolvimento para permitir testes com
outbox e o worker está rodando separadamente. Processos não são retidos por
snapshot; suas instruções de startup foram salvas.

Workflow de CI foi escrito em `.github/workflows/platform.yml` na raiz do
repositório. Não houve push nem execução de CI no GitHub; os checks relatados
foram executados nesta máquina.
