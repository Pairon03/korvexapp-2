# Produção das demonstrações 3D

O catálogo tem 38 movimentos originais, com poses e equipamentos articulados. A aplicação mostra a cena 3D interativa no navegador; isso é diferente de entregar 38 arquivos de vídeo pré-renderizados. Os manequins são ilustrações estilizadas, sem captura de movimento, malha anatômica clínica ou garantia de adequação individual.

O guia enviado pelo proprietário define o acabamento: cinza fosco, fundo obsidiano, luz fria com recorte ciano, foco primário laranja, sinergistas âmbar e círculos vermelhos nos cuidados do catálogo. Câmera, músculos e cadências estão em `src/domain/exercise-motion.ts`, em `motionPresentation`. `getTimedExerciseMotion` aplica a cadência do guia, incluindo as pausas.

A prancha usa um ciclo editorial de respiração de 6 segundos porque o guia não determina uma duração. O dead bug alterna os membros em 4,2 segundos. As especificações descrevem a apresentação da animação, não uma prescrição de ritmo para o aluno.

## Dependências e arquivos

- Node.js 24 com as dependências do projeto instaladas.
- Blender 4.3.2 ou compatível, com Eevee e Workbench.
- FFmpeg e FFprobe com libx264; libx265 é necessário apenas para HEVC.
- `scripts/export-exercise-motion.ts` gera poses JSON do catálogo canônico.
- `scripts/render-exercises.py` cria um manequim original, equipamentos, câmera, materiais, luzes, imagens e vídeo.
- Use `.local/3d` para os JSON, frames e projetos Blender intermediários. Essa pasta já é ignorada pelo Git.

## Gerar os dados dos 38 exercícios

Execute na raiz do repositório:

```bash
node --import tsx scripts/export-exercise-motion.ts --exercise all --fps 60 --out .local/3d/motions
```

O exportador só aceita IDs do catálogo. Ele amostra cada ciclo em 60 FPS, sem repetir o frame inicial no final. O nome do arquivo corresponde ao `catalog_id` que acompanha o exercício importado pelo personal.

## Revisar um frame antes de renderizar o ciclo

```bash
XDG_CACHE_HOME=/tmp/fitcore-blender-cache blender -b -t 4 --python scripts/render-exercises.py -- \
  --input .local/3d/motions/agachamento-goblet.json \
  --out .local/3d/review/goblet \
  --engine workbench --frame 60 --size 720
```

`--frame` renderiza somente aquele índice. `--count 5 --no-video` mede os cinco primeiros frames. `--engine eevee --samples 16` usa luzes e materiais físicos. Workbench é uma revisão de estúdio com cavidade e sombreado; ele não reproduz o recorte ciano de Eevee nem o realismo de Octane mencionado no prompt de referência.

## Renderizar um ciclo e verificar o arquivo

```bash
XDG_CACHE_HOME=/tmp/fitcore-blender-cache blender -b -t 4 --python scripts/render-exercises.py -- \
  --input .local/3d/motions/agachamento-goblet.json \
  --out .local/3d/render/agachamento-goblet \
  --engine workbench --size 720 --codec h264 --save-blend
```

O processo preserva os frames PNG e o `.blend` com as transformações animadas em keyframes, codifica o MP4 e usa FFprobe para conferir resolução, contagem de frames e taxa de quadros. O manifesto registra codec, duração, tamanho, hashes e origem dos tempos. O pipeline falha se o arquivo exceder 1.500.000 bytes; ajuste o CRF antes de publicar um arquivo maior. Não atribui validação clínica ao material.

Para montar apenas o projeto animado, sem renderizar imagens, acrescente `--no-render --save-blend`. Abra o `.blend` no Blender e use a timeline; as peças do manequim e os equipamentos têm keyframes de transformação. O projeto é articulado por objetos, sem uma malha humana deformável nem um rig anatômico.

Para codificar outra variante a partir dos mesmos frames, use `--encode-only --codec hevc` e mantenha `--input`, `--out` e `--size` da renderização. O processo exige a sequência PNG completa. Isso evita repetir a renderização; o vídeo HEVC ganha o sufixo `.hevc.mp4` para preservar o H.264.

O H.264 é a opção de reprodução web mais ampla. Para o formato HEVC solicitado no guia, use `--codec hevc`; ele inclui a tag `hvc1`, mas o suporte depende do dispositivo e do navegador. `--codec webm --alpha` renderiza os frames com transparência, oculta o chão e codifica VP9 com alpha; a compatibilidade e o alpha devem ser homologados nos dispositivos de destino antes do uso comercial.

## Piloto e limites desta entrega

O piloto publicado em `public/exercise-videos/agachamento-goblet.mp4` é um vídeo de revisão Workbench, 720×720, 60 FPS e 3,8 segundos. O poster WebP lossless acompanha o mesmo exercício e preserva exatamente os pixels do PNG original, que também fica disponível para revisão. O manifesto ao lado contém as medições reais da versão gerada. A variante `agachamento-goblet.hevc.mp4` acompanha o H.264 para revisão, sem substituir o fallback web. Foram medidos 96.247 bytes no H.264, 63.110 bytes no HEVC e 222.144 bytes no poster WebP. Ambos os vídeos têm 228 frames, 60 FPS, 720×720 e 3,8 segundos.

Não foram renderizados 38 vídeos cinematográficos nem arquivos 8K. A cobertura dos 38 exercícios na aplicação usa o motor 3D interativo. Nesta máquina, o primeiro frame Eevee a 720×720 e 64 amostras levou 52,2 segundos. O benchmark de cinco frames Workbench levou 7,68 segundos e estabilizou perto de 0,8 segundo por frame. Renderizar todos os ciclos em 60 FPS exige um lote separado, com tempo de máquina e revisão técnica de cada exercício.

Antes da utilização comercial, um profissional deve revisar cada movimento, amplitude, equipamento, câmera e cuidado indicado, incluindo a coerência entre o texto e a demonstração. O guia solicita “forma biomecânica perfeita”, mas isso não é evidência de validação nem uma propriedade garantida pelo render.
