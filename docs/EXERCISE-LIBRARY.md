# Biblioteca e animações FitCore Korvex

Os 38 exercícios e 10 grupos do catálogo fornecido pelo usuário estão em `src/domain/exercise-catalog.ts`. Cada exercício tem ID estável, instruções, erros comuns, equipamentos, cuidados e alternativas. As alternativas são opções para revisão profissional, não substituições automáticas de prescrições.

## Experiência entregue

- `/biblioteca`: busca sem distinção de acentos, filtros combinados, fichas e demonstrações.
- Player 3D renderizado localmente com Three.js: corpo humano contínuo cinza, com rosto, cabelo, dedos, mãos e pés, fundo obsidiano, foco primário laranja, secundários âmbar e indicadores vermelhos nas regiões de cuidado. São alvos ilustrativos do guia, não ativação muscular medida.
- Cinco vistas, reprodução manual, pausa, reinício, velocidade e progresso. Nenhuma animação inicia sozinha, inclusive com preferência por movimento reduzido.
- Equipamentos e poses são específicos por exercício; não há vídeos externos, requisições a modelos remotos, captura de movimento ou serviços generativos em produção. A malha humana MakeHuman CC0 e os seus pesos estão incluídos no projeto; as poses, adaptação do rig e cenas são do FitCore.
- As 38 prévias usam o mesmo corpo humano renderizado. Quando WebGL não estiver disponível, a interface mostra uma prévia estática identificada e desativa os controles de animação.
- Na prévia, o personal monta uma seleção ilustrativa, que também aparece na área do aluno e desaparece ao recarregar.
- Na aplicação conectada, a importação valida o ID no servidor, copia dados canônicos e preserva `catalog_id`. Importar novamente não duplica o exercício nem o evento de auditoria. Contas de alunos não podem importar.
- O programa publicado usa o UUID do exercício da organização. A animação é resolvida pelo vínculo explícito com o catálogo, sem adivinhar por nomes de exercícios próprios.
- O player de um treino só carrega ao abrir a demonstração e libera os recursos gráficos ao fechar.

## Cadência e escopo visual

`motionPresentation` e `getTimedExerciseMotion` em `src/domain/exercise-motion.ts` aplicam as durações, fases e pausas do guia 3D fornecido. A prancha usa um ciclo **visual** de respiração de seis segundos, escolha editorial porque o guia não define duração; isso não prescreve tempo de sustentação.

O corpo é uma única malha humana CC0, adaptada a 19 ossos com deformação suave de pele, em vez de peças geométricas separadas. As máscaras musculares são ilustrativas. As fontes e a licença comercialmente reutilizável estão em `public/models/human/ASSETS.md`. Não são renders anatômicos fotorrealistas em 8K, captura de atletas ou demonstrações com validação biomecânica clínica. A revisão por um profissional de Educação Física continua necessária antes de anunciar execução técnica validada. Ângulos do player são vistas interativas; a descrição exata de enquadramento para produção está preservada nos metadados.

Os 38 movimentos interativos estão implementados. Vídeos MP4/HEVC pré-renderizados são artefatos separados: a existência da animação interativa não significa que todos os vídeos tenham sido renderizados. Consulte `3D-PRODUCTION.md` para o pipeline Blender e os arquivos efetivamente produzidos.

## Configuração e validação

Aplicar `npm run db:migrate` antes de habilitar a importação em uma instalação com PostgreSQL. A migração 007 preserva exercícios próprios existentes e cria unicidade de catálogo por organização. O primeiro equipamento da ficha é usado na importação; equipamentos alternativos continuam descritos na ficha educativa.

`npm run test:library` testa a versão em execução em `PREVIEW_URL` (padrão `http://127.0.0.1:3100`). Requer Chromium, WebGL por hardware ou SwiftShader e nenhuma credencial externa. A suíte cobre os 38 players reais, filtros, câmera, alteração da imagem 3D, pausa, celular e associação ao treino do aluno. Os testes de domínio cobrem continuidade e proporções gráficas; eles não validam biomecânica clínica.

Neste ambiente o Turbopack não conseguiu abrir uma porta interna mesmo com execução ampliada. O compilador Webpack suportado (`npm run build -- --webpack`) compilou a aplicação. Isso é uma limitação do ambiente de teste, não uma mudança nos requisitos da Vercel.

## Referência visual e modelo humano

O vídeo ScreenRecording fornecido pelo usuário orientou a aparência humana e a apresentação do movimento. Nenhum frame, textura, modelo, marca ou animação do aplicativo de referência foi incorporado ao produto. A superfície humana vem apenas dos dados gráficos CC0 oficiais MakeHuman, com revisão e hashes preservados. O conversor do projeto não copia o programa AGPL MakeHuman.

`src/domain/human-rig.ts` define a adaptação da bind pose para os 38 movimentos, preservando o roll original dos ossos e o volume da cabeça/mãos/pés. O exportador usa esses mesmos alvos e rotações no Blender, evitando duas implementações divergentes. As poses de pegada são uma deformação de dedos da própria malha; as palmas continuam abertas nos exercícios com apoio das mãos. O sistema não simula contatos, força ou ativação muscular medida.
