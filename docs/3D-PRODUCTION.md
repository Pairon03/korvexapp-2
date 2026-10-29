# Produção das demonstrações humanas 3D

A biblioteca usa uma malha humana contínua com rosto, cabelo, dedos, mãos e pés, em vez de peças geométricas separadas. A base gráfica e os pesos MakeHuman são CC0, com fontes, licença e hashes em `public/models/human/ASSETS.md`. O conversor, a adaptação do rig, as poses e as cenas são do FitCore. Nenhuma imagem, textura, animação ou marca do vídeo de referência foi incorporada ao projeto.

O corpo adulto atlético tem 13.380 vértices e 26.756 triângulos. Os pesos originais foram reduzidos a quatro influências por vértice em 19 ossos; a pele permanece uma superfície conectada. O alvo `gripPositions` fecha os dedos sem modificar rosto, corpo ou punhos. O player mantém as mãos abertas em apoios como flexão e prancha.

## Fontes e ferramentas

- Node.js 24 e as dependências do projeto.
- Blender 4.3.2 ou compatível, FFmpeg e FFprobe; NumPy está disponível no Python do Blender.
- `scripts/prepare-human-model.py`: conversor próprio dos dados gráficos CC0, usando `--source PATH` para um checkout MakeHuman na revisão registrada. Não importa nem copia o programa AGPL MakeHuman.
- `src/domain/human-rig.ts`: alvos, rotações e intensidade de pegada compartilhados com o player.
- `scripts/export-exercise-motion.ts`: exporta as 38 poses, equipamentos, tempos e transformações humanas por frame.
- `scripts/human_deformer.py`: aplica o mesmo skinning linear do Three.js ao corpo para o render Blender.
- `scripts/render-exercises.py`: cena, malha humana, materiais, equipamentos, câmera e codificação.
- `scripts/render-exercise-posters.py`: gera as 38 miniaturas humanas WebP e um manifesto com hashes.

Use `.local/3d` para JSON, PNG, projetos Blender e logs intermediários; esses arquivos são ignorados pelo Git.

## Exportar os 38 movimentos

```bash
npm run export:motion -- --exercise all --fps 60 --out .local/3d/human-motions
```

O JSON de esquema 2 inclui `humanModel.sha256`, `humanGrip` e, para cada frame, `humanBones` com os mesmos alvos e quaternions usados no navegador. O pipeline rejeita uma malha cujo hash difere do usado na exportação. A matriz aplicada é `T(target) * R(target) * ScaleY * inverseBind`. O morph de dedos é aplicado antes do skinning. Uma verificação dos 13.380 vértices do goblet confirmou paridade Node/Three e Python com erro máximo menor que `1e-12`.

As durações e pausas seguem `motionPresentation` e `getTimedExerciseMotion`. O ciclo visual da prancha é uma escolha editorial de seis segundos, porque o guia não define duração; não prescreve tempo de sustentação. O dead bug alterna os membros em 4,2 segundos.

## Revisar uma imagem

```bash
OPENBLAS_NUM_THREADS=1 LP_NUM_THREADS=2 XDG_CACHE_HOME=/tmp/fitcore-blender-cache \
blender -b -t 2 --python-exit-code 1 --python scripts/render-exercises.py -- \
  --input .local/3d/human-motions/agachamento-goblet.json \
  --out .local/3d/review/human-goblet --engine workbench --frame 114 --size 720
```

Workbench usa as cores dos vértices, iluminação de estúdio e detalhes de cavidade. Eevee (`--engine eevee --samples 16`) oferece luzes físicas e recorte ciano; nesta máquina, é muito mais lento. Workbench não reproduz o acabamento fotorrealista de Octane citado como referência no guia.

## Gerar as 38 prévias

```bash
python scripts/render-exercise-posters.py --motions .local/3d/human-motions
```

Cada WebP em `public/exercise-posters` corresponde a um exercício canônico. O arquivo `manifest.json` registra resolução, tamanho e hashes, incluindo a revisão do corpo humano. O player também usa essas imagens como prévia estática quando WebGL não estiver disponível; os controles de animação são desativados nesse caso.

## Renderizar e validar um vídeo

```bash
OPENBLAS_NUM_THREADS=1 LP_NUM_THREADS=2 XDG_CACHE_HOME=/tmp/fitcore-blender-cache \
blender -b -t 2 --python-exit-code 1 --python scripts/render-exercises.py -- \
  --input .local/3d/human-motions/agachamento-goblet.json \
  --out .local/3d/human-pilot --engine workbench --size 720 --codec h264
```

O pipeline renderiza todos os frames, codifica o MP4 e usa FFprobe para validar resolução, taxa de quadros, contagem, duração e tamanho. O manifesto inclui a origem da malha, hash da malha humana, hash das poses e hash do vídeo. Arquivos com mais de 1.500.000 bytes são rejeitados.

H.264 tem compatibilidade web mais ampla. Para HEVC, reutilize o mesmo lote com `--codec hevc --encode-only`; a tag `hvc1` é configurada, mas o suporte depende do navegador e do dispositivo. `--codec webm --alpha` é uma opção do pipeline, que precisa de homologação de transparência nos aparelhos de destino.

`--save-blend` pode armazenar a animação humana em shape keys absolutos, com equipamentos em keyframes. Isso é uma animação bakeada para edição no Blender, não um rig anatômico de produção com dedos e músculos físicos. Use `--no-render --save-blend` para montar o projeto sem renderizar imagens.

## O que foi produzido

Os 38 exercícios usam o corpo humano no player interativo e têm prévias humanas renderizadas. O vídeo piloto em `public/exercise-videos/agachamento-goblet.mp4` e sua variante HEVC são amostras humanas de 720×720, 60 FPS e 3,8 segundos. Seus manifestos contêm as medições da versão efetivamente gerada.

Não foram renderizados 38 vídeos cinematográficos nem arquivos 8K. A malha tem aparência humana e as cores indicam regiões ilustrativas; isso não constitui uma segmentação anatômica clínica nem validação biomecânica. Antes de anunciar execução técnica validada, um profissional deve revisar movimento, amplitude, pegada, equipamentos e adequação individual. Não há simulação de contato ou força.
