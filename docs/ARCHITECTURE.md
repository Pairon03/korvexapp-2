# Arquitetura e decisões

## Escopo desta etapa

O novo pedido transforma o projeto pessoal em plataforma B2B2C. O código Flutter
anterior permanece na raiz; `platform/` é a aplicação SaaS Next.js independente.
React Native/Expo não foi iniciado: primeiro foi priorizado o fluxo web real.
Não há alegação de publicação nas lojas ou de PWA offline instalável.

## Fronteiras de confiança

```text
Navegador (formulários e rascunho de execução)
  → API Next.js (autenticação, origem, validação, autorização)
    → transação app role (tenant/role/student por SET LOCAL)
      → PostgreSQL com FORCE RLS e chaves compostas
    → adaptador de IA (sem acesso ao banco)
    → checkout/webhook Stripe (servidor)
    → armazenamento privado de imagens (fora de public)
Worker Node → claims persistentes → mesmos serviços de domínio
```

Somente o servidor escolhe o contexto da transação. Um ID de organização enviado
pelo navegador é verificado contra `identity.tenant_members`; o RLS então aplica
outro limite de acesso. Um aluno lê apenas seus registros. A biblioteca do aluno
contém apenas exercícios referenciados em seus programas autorizados.
`owner` gerencia cobrança/equipe, `trainer` gerencia acompanhamento, `student`
usa seus registros. Não foram criadas contas implícitas de administrador global
ou suporte com acesso geral a dados privados.

As conexões de identidade/operação e de dados são separadas. A primeira exige
privilégios de serviço server-side; a segunda usa `fitcore_app` sem BYPASSRLS.
Credenciais dessas conexões jamais podem ser repassadas ao cliente. A autenticação
própria com scrypt foi escolhida para homologar PostgreSQL sem exigir um projeto
Supabase. Antes de produção, revisar a implementação ou migrar para uma biblioteca
ou serviço de identidade mantido, conforme a política operacional do produto.

## Dados

- `identity.users/sessions/tokens`: identidade, hashes, expiração e uso único.
- `identity.tenant_members`: vínculos autorizados e papéis.
- `app.tenants/subscriptions/subscription_plans`: conta e limites comerciais.
- `students/exercises/assessments`: acompanhamento e biblioteca da organização.
- `ai_agents/ai_agent_versions`: configuração e snapshots imutáveis.
- `proposals`: propostas não publicadas e validação.
- `workout_plans/workout_plan_versions`: ponteiro vigente e histórico imutável.
- `training_cycles`: vencimentos, estados, lease, tentativas e versão de origem.
- `workout_logs`: séries reais e request ID idempotente.
- `ai_runs`: reservas, status, modelo e tokens informados pelo provedor.
- `student_consents/progress_photos`: autorização e metadados privados.
- `identity.photo_tokens`: acesso de 60s vinculado à identidade autenticada.
- `notifications/audit_logs/payment_events/deletion_requests`: operação.

Os payloads de programas/regras/séries são JSONB validados por Zod no backend.
Nesta etapa, dias e exercícios de programa não foram normalizados em tabelas
próprias. Não existe ainda a totalidade das entidades avançadas do documento
mestre, como protocolos antropométricos, permissões granulares e feature flags.

## Publicação e ciclos

Uma proposta só é publicada se o aluno estiver ativo, avaliação recente existir,
volume/frequência/descanso forem válidos, exercícios/equipamentos forem permitidos
e não houver alertas. Limitações relatadas são tratadas conservadoramente como
bloqueadoras nesta versão. Dor em avaliação ou desconforto posterior também
bloqueiam. Nenhuma foto é necessária.

A publicação bloqueia os registros relevantes, revalida revisão do aluno,
avaliação e versão vigente, insere uma versão imutável, troca o ponteiro e agenda
um ciclo. Uma proposta publicada guarda seu ID de versão para responder a retries
com o mesmo resultado, mesmo depois de outras versões. Não há sobrescrita do
histórico; a interface pode criar nova proposta baseada em uma versão anterior.

O worker usa horário do PostgreSQL e datas de calendário com Temporal. O intervalo
padrão é 45 dias; o fuso fica registrado em cada ciclo. Alterar a conta não muda
os ciclos existentes. Leases de 5 min e até 3 tentativas permitem recuperar tarefas
interrompidas. Produção ainda requer teste de fencing/recovery sob falhas severas,
re-geração de propostas bloqueadas no mesmo ciclo e observabilidade de filas.

## Integrações e limitações

IA é uma proposta, não uma autoridade de publicação. Seu contrato é estrito e
sem ferramentas. Instruções livres não conseguem desativar regras determinísticas.
O orçamento reserva um teto conservador por execução, inclusive em falhas. Ainda
não há custo monetário homologado nem avaliação da qualidade de saídas reais.

Checkout usa chave persistente e idempotência do provedor. O webhook verifica
assinatura, serializa por organização, consulta o estado canônico sob o lock e
registra o evento único. A alteração de preço é mapeada pelo price ID cadastrado,
não pelo valor enviado pelo navegador. Tudo ainda exige homologação Stripe.

Fotos são decodificadas/reencodadas via sharp, sem EXIF, com limite de bytes e
pixels. O armazenamento atual é disco privado com permissões restritas, adequado
a uma instância de homologação; multi-instância precisa de storage compartilhado.
O acesso é registrado sem copiar a imagem para logs. Revogação remove as cópias
ativas; retenção em backups e tratamento de órfãos precisam de operação definida.
