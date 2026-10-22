# Instalação, operação e publicação

## Desenvolvimento

Node 24+, PostgreSQL 17 e Docker para os scripts locais. Instale com `npm ci` e
aplique `npm run db:migrate`. O script mantém checksum e usa advisory lock para
não executar migrações simultâneas. Rerun sem novas migrações não altera a base.
Não edite migrações já aplicadas; crie uma nova. O Flutter antigo não é reinstalado
nem alterado pela configuração da plataforma.

Os scripts locais usam a porta 54329, loopback e uma base dedicada. Autenticação
trust é exclusivamente de desenvolvimento. Instâncias de teste guardam dados
sintéticos identificados por prefixos e não devem ser expostas publicamente.

## Produção/homologação externa

1. Provisione PostgreSQL com TLS e armazenamento durável.
2. Provisione separadamente a role de serviço de identidade/operação, autorizada
   a bypass de RLS apenas no servidor, e `fitcore_app` sem SUPERUSER/BYPASSRLS.
   A primeira migração cria essa role localmente. Serviços gerenciados podem
   exigir intervenção do administrador para CREATE ROLE/BYPASSRLS.
3. Defina `DATABASE_URL` e `APP_DATABASE_URL` no secret manager do host, usando
   senhas fortes e verificação TLS (`sslmode=verify-full` com CA válida).
   Não forneça essas URLs ao navegador ou a terceiros.
4. Configure `APP_URL` com o domínio HTTPS real. Habilite HSTS no proxy após
   confirmar HTTPS. Configure limite de requisição/upload e redija logs sem
   query strings de tokens de autenticação ou de fotos.
5. Configure e homologue Resend, IA e Stripe. Outbox é rejeitada com NODE_ENV
   production. Webhook signing secret precisa ser um segredo bruto no processo;
   uma substituição de placeholder apenas no proxy HTTP não serve para HMAC.
6. Use volume privado durável para `PRIVATE_STORAGE_DIR` fora de public. Para
   múltiplas réplicas, adapte para storage privado compartilhado e teste acessos.
7. Execute `npm ci`, `npm run db:migrate`, `npm run build` e `npm start`.
8. Rode `npm run worker` como serviço separado supervisionado com o mesmo banco,
   configurações e segredos necessários. Não dependa de uma aba ou cron do cliente.
9. Configure healthcheck, monitoramento de erros/latência/filas e alertas.
10. Teste todos os fluxos no domínio publicado e confirme os logs dos provedores.

Vercel ou outro host Node pode servir Next.js, mas não substitui PostgreSQL,
worker persistente, storage e monitoramento. Funções efêmeras sem volume não
satisfazem o armazenamento local de fotos desta entrega. Não foi executado
um deploy externo nem inventado um domínio do produto.

## Backups e recuperação

`backup-local.sh` gera pg_dump custom-format e, separadamente, tar de fotos.
`restore-check.sh` restaura em uma base temporária e a remove ao fim, sem tocar
no banco original. A verificação executada aqui valida restauração local do
PostgreSQL; não homologa armazenamento off-site, criptografia ou retenção.

Antes de produção, definir: frequência e RPO/RTO, destino externo criptografado,
controle de acesso, expiração, consistência entre arquivos e referências SQL,
ensaios de recuperação e tratamento de exclusão em backups. Tokens e hashes de
sessão também estão no dump e requerem proteção. A restauração de fotos em um
host novo deve ser testada com permissões e caminhos correspondentes.

## Rollback

Retenha a versão anterior do código e backup antes de migrar. Migrações são
forward-only nesta entrega; não reverta SQL destrutivamente na base ativa.
Se a versão anterior for compatível com o schema atual, volte o código e teste
health/auth/permissões. Caso contrário, prepare uma restauração em outra base,
valide-a e faça a troca controlada com plano de recuperação das escritas recentes.
Nunca sobrescreva produção para testar uma restauração.

## Operação e suporte

`npm run admin -- metrics` produz agregados, sem fotos ou avaliações. Alterar
planos exige CLI e credencial operacional server-side. Não existe painel global
com acesso irrestrito aos dados. Uma interface administrativa e suporte com
acesso excepcional, finalidade e auditoria ficam para a próxima etapa.

## Revisão antes de piloto

- Confirmar mail delivery e revogação/expiração de todos os tokens.
- Homologar geração real e qualidade das saídas com profissionais qualificados.
- Homologar faturamento, alteração de planos, cancelamento e webhooks.
- Testar custos, limites, retries e recuperação sob falhas severas de worker.
- Revisar identidade própria, permissões, uploads, headers e retenção.
- Definir entidade operadora, suporte, bases legais e contratos de fornecedores.
- Revisar termos/privacidade juridicamente e configurar canal de atendimento.
- Testar backup/restauração e exclusão de arquivos, derivados e backups.
- Confirmar que nenhum dado sintético está sendo apresentado como dado real.


Dados privados e segredos de runtime são excluídos do file tracing do Next.js.
As diretivas turbopackIgnore no armazenamento indicam que os arquivos são dados
externos de runtime, não dependências para copiar no deploy. Não removem validação
de formato, autorização, integridade do banco ou testes. Provisione o volume no
host mesmo que a pasta não esteja no pacote do servidor.
