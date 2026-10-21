# Ficheiros 3D (Blender)

Cenas Blender da proposta A (Visita ao estúdio). Foram gravadas no Blender 5.2 LTS. Este site não usa estes ficheiros diretamente: só servem para editar o 3D e exportá-lo de novo.

| Ficheiro | O que é |
|---|---|
| `studio.blend` | A cena editável do estúdio: paredes, portas, mobiliário, luzes e máquinas, antes do bake da iluminação. |
| `studio_baked.blend` | A mesma cena com a iluminação gravada em texturas (light maps). O `a/studio.glb` do site foi exportado desta cena. |

## Notas

- **Cartazes das paredes.** As 7 imagens dos cartazes (`poster_*.png`) não estão incluídas, porque os ficheiros originais perderam-se. No `studio.blend` aparecem a cor-de-rosa, que é como o Blender mostra uma textura em falta. No `studio_baked.blend` os cartazes já fazem parte das light maps.
- **Light maps.** As do `studio_baked.blend` foram recuperadas do `a/studio.glb` publicado, por isso têm a mesma compressão WebP. Estão embutidas no ficheiro.
- **Exportar para o site.** Exporte para glTF binário (`.glb`) com compressão Draco e texturas WebP, como o `a/studio.glb` atual. Deixe de fora as máquinas (`MCH_*`) e o objeto auxiliar `PROC_world_metres`, porque a página carrega cada máquina à parte, a partir de `assets/machines/`.
- **Outros modelos.** As máquinas (`assets/machines/*.glb`) e a escultura da proposta C (`c/hero.glb`) não têm cena Blender. São modelos gerados por IA que se abrem diretamente no Blender, em Ficheiro → Importar → glTF 2.0.

Estes ficheiros estão abrangidos pela [LICENSE](../../LICENSE) do repositório.
