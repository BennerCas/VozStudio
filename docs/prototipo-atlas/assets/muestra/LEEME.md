# Muestras del emblema

Verificación en píxeles del requisito "mismo logo en sidebar e icono de la app".

| Archivo | Qué muestra |
| --- | --- |
| `emblema-vs-icono.png` | Izquierda: icono real del escritorio, extraído de `scripts/launcher/vozstudio.ico` (capa de 256 px que genera `generate_icon.py`). Derecha: `favicon.svg` del prototipo, renderizado desde `src/brand.js`. Mismo aro, misma silueta y mismas cinco barras. |
| `emblema-tamanos.png` | El emblema a los tamaños reales de uso: 18 px (pie), 38 px (sidebar) y 140 px (splash), ampliados para inspección. Por debajo de 22 px cambia a color plano y aro fino para que las barras no desaparezcan al reducir. |

Se generaron con `sharp` a partir del SVG real; no son mockups.

```bash
python3 scripts/launcher/generate_icon.py   # produce scripts/launcher/vozstudio.ico
node --input-type=module -e "import { appMarkPlain } from './src/brand.js'; process.stdout.write(appMarkPlain())" > favicon.svg
```
