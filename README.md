# Cardante – Fisioterapia e Bem-Estar · website

Quatro propostas de website para a Cardante – Fisioterapia e Bem-Estar (Arcozelo, Vila Nova de Gaia), preparadas por Tiago Guardão. É um site estático: HTML, CSS e JavaScript, sem build e sem back-end.

| Pasta | Proposta |
|---|---|
| `index.html` | Página de escolha entre as quatro propostas |
| `a/` | **Visita ao estúdio**: o estúdio reconstruído em 3D, percorrido ao deslizar. Tem duas subpáginas, `a/maquinas/` e `a/tratamentos/` |
| `b/` | **Atlas do corpo**: o corpo como menu, desenhado a linhas |
| `c/` | **Mãos e folhas**: marca de bem-estar calma, à volta de uma escultura 3D |
| `d/` | **Equipamento em 3D**: cada máquina do estúdio como objeto 3D que se pode rodar |
| `assets/` | Logótipo e símbolo da Cardante, os modelos 3D das máquinas (`assets/machines/`) e `options.js` |

## Ver localmente

As páginas usam módulos JavaScript e carregam modelos `.glb`, por isso têm de ser servidas por HTTP. Abrir o `index.html` diretamente no browser (`file://`) não funciona. Na pasta do repositório:

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000/.

## Dependências externas

- [three.js](https://threejs.org/) 0.169.0 e o descodificador Draco, carregados do jsDelivr através do `importmap` de cada página.
- Google Fonts: Fraunces, Manrope, Instrument Serif, Instrument Sans e Hanken Grotesk.
- A proposta B tem as suas fontes na própria pasta (`b/fonts/`, Bricolage Grotesque e DM Sans, licença SIL OFL, incluída ao lado de cada fonte).

## Antes de publicar

As propostas foram feitas para revisão e não para estar online tal como estão. Antes de as publicar:

- Retire `<meta name="robots" content="noindex, nofollow">` de cada página. Enquanto esta linha estiver lá, o Google não indexa o site.
- Retire `<script src="../assets/options.js" defer></script>` das páginas `b/`, `c/` e `d/`. É o seletor flutuante "Proposta de Tiago Guardão · em revisão".
- Escolha a proposta que vai ficar e substitua a página de escolha (`index.html`) por ela.
- Confirme os textos. Partem do que é público sobre a Cardante, e o que ainda falta confirmar está entre parênteses retos, como o horário na proposta B.

## Imagens e 3D

Os modelos das máquinas (`assets/machines/*.glb`) e a escultura da proposta C (`c/hero.glb`) foram gerados por IA (Higgsfield / Tripo) e finalizados em Blender. A sala da proposta A (`a/studio.glb`) é uma reconstrução em Blender. São representações aproximadas, não modelos exatos do equipamento.

## Licença

A Cardante pode usar, modificar e publicar este código para o seu próprio website, incluindo a partir de um fork. Qualquer outra utilização precisa de autorização de Tiago Guardão. O nome e o logótipo continuam a ser da Cardante. Os termos completos estão em [LICENSE](LICENSE).
