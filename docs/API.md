# API da primeira etapa

JSON em `/api`, exceto upload multipart e visualização JPEG. Todas as respostas
privadas usam `Cache-Control: private, no-store`. Mutações exigem `Origin` igual
a `APP_URL`; o webhook Stripe usa assinatura do provedor em vez de cookie/origem.
Corpos JSON são limitados a 64 KiB; webhook a 1 MiB; foto a 5 MiB mais envelope.
Erros incluem código, mensagem sem dados sensíveis e identificador de correlação.

| Endpoint                                         | Método | Acesso/função                                            |
| ------------------------------------------------ | ------ | -------------------------------------------------------- |
| `/health`                                        | GET    | Verifica a conexão PostgreSQL                            |
| `/plans`                                         | GET    | Configuração pública de preços, sem IDs secretos         |
| `/auth/register`                                 | POST   | Conta profissional e organização; confirmação por e-mail |
| `/auth/verify`                                   | POST   | Consome token único de confirmação                       |
| `/auth/login`, `/auth/logout`                    | POST   | Sessão persistente / revogação                           |
| `/auth/request-reset`, `/auth/reset`             | POST   | Recuperação sem revelar existência da conta              |
| `/auth/accept-invite`                            | POST   | Cria/vincula conta mediante convite válido               |
| `/auth/me`                                       | GET    | Identidade e papel autorizado                            |
| `/dashboard`                                     | GET    | Dados calculados da organização/aluno autenticado        |
| `/students`                                      | POST   | Profissional: cria aluno respeitando limite do plano     |
| `/students/invite`, `/students/settings`         | POST   | Convite, arquivamento e automação por aluno              |
| `/organization/settings`, `/organization/invite` | POST   | Owner: fuso/nome e convite de profissional               |
| `/exercises`                                     | POST   | Exercício próprio da organização                         |
| `/agents`, `/agents/version`                     | POST   | Configuração e nova versão imutável                      |
| `/assessments`                                   | POST   | Avaliação com unidades e data, sem fotos obrigatórias    |
| `/proposals`                                     | POST   | Programa manual estruturado e validado                   |
| `/proposals/generate`                            | POST   | Adaptador real de IA; 503 se não configurado             |
| `/proposals/publish`                             | POST   | Revalidação e publicação idempotente                     |
| `/cycles/process`, `/cycles/status`              | POST   | Verificação pelo servidor, pausa/retomada/cancelamento   |
| `/logs`                                          | POST   | Séries de programa autorizado, com requestId UUID        |
| `/photos`                                        | GET    | Metadados e consentimentos permitidos                    |
| `/photos/consent`                                | POST   | Somente o aluno concede/revoga                           |
| `/photos/upload`                                 | POST   | Multipart: studentId, category, measuredOn e file        |
| `/photos/link`                                   | POST   | Token temporário, sem expor caminho de armazenamento     |
| `/photos/view`                                   | GET    | JPEG; exige token válido e mesma conta autenticada       |
| `/photos/delete`                                 | POST   | Exclui arquivo ativo e metadados                         |
| `/export`                                        | GET    | Exporta registros permitidos em JSON                     |
| `/privacy/deletion`                              | POST   | Registra pedido; não simula eliminação imediata          |
| `/billing/checkout`, `/billing/portal`           | POST   | Owner, integração Stripe real                            |
| `/billing/webhook`                               | POST   | Assinatura obrigatória; corpo original preservado        |

O header `x-tenant-id` seleciona organização apenas após verificar o vínculo.
O download de exportação e a visualização de foto também podem receber `tenant`
na query, novamente validado no servidor. IDs nunca substituem autorização.

Contratos completos estão em `src/domain/contracts.ts`. Os schemas são a fonte
de verdade para limites e campos. A API não é um serviço público com chaves de
terceiros: usa sessão de navegador. Não foram implementados refresh tokens para
cliente nativo ou OAuth. O endpoint catch-all será dividido por recursos quando
a superfície avançar; regras de domínio já estão separadas dos handlers.
