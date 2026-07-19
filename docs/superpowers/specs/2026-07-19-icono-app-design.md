# Icono de la app

## Problema

El icono actual de mobi-finanzas (`assets/images/icon.png`, y todos los
assets derivados: adaptive icon de Android, favicon, splash, bundle de
iOS) es el logo genérico de la plantilla de Expo — una "A" blanca sobre
fondo azul con una grilla decorativa — sin ninguna relación con la
identidad de la app. El fondo del splash screen (`#208AEF`) tampoco
coincide con la paleta real de la app (verde `#267b4c` como color
primario, fondo cálido `#faf8f4`).

## Diseño

### Concepto

Alcancía (piggy bank). Es el mismo símbolo que la app ya usa para el tab
"Metas" ([app/(tabs)/_layout.tsx](../../../app/(tabs)/_layout.tsx), icono
`PiggyBank` de `lucide-react-native`), así que el icono de la app queda
visualmente coherente con el vocabulario de iconos que ya existe dentro
de la app. Se reutiliza el path SVG exacto del icono `PiggyBank` de
`lucide-react-native` (licencia ISC, ya es dependencia del proyecto) en
vez de dibujar un símbolo nuevo desde cero.

### Estilo

Fondo verde sólido `#267b4c` (color primario de la marca, ver
[lib/theme.ts](../../../lib/theme.ts)) con el glyph de la alcancía en
blanco/crema. Estilo plano, sin gradientes ni decoración de grilla.

### Archivos de imagen a reemplazar

Todos se generan desde un único SVG maestro (fondo + path de
`PiggyBank`), rasterizado a cada tamaño/variante necesaria:

| Archivo | Tamaño | Contenido |
|---|---|---|
| `assets/images/icon.png` | 1024×1024 | Fondo verde + glyph blanco (icono universal / iOS) |
| `assets/images/android-icon-foreground.png` | 432×432, transparente | Glyph blanco centrado dentro del 66% central ("safe zone" de iconos adaptativos de Android, para no recortarse con máscaras circulares/squircle/etc.) |
| `assets/images/android-icon-background.png` | 432×432 | Verde sólido `#267b4c` |
| `assets/images/android-icon-monochrome.png` | 432×432, transparente | Silueta blanca del mismo glyph (para el icono temático de Android 13+, que Android tiñe con su propio color) |
| `assets/images/favicon.png` | 196×196 | Mismo estilo que `icon.png` |
| `assets/images/splash-icon.png` | glyph solo, transparente | Glyph blanco, se muestra sobre `expo-splash-screen.backgroundColor` |

### Cambios en `app.json`

- `expo.android.adaptiveIcon.backgroundColor`: `#E6F4FE` → `#267b4c`
- `expo.plugins` → entrada `expo-splash-screen` → `backgroundColor`:
  `#208AEF` → `#267b4c`
- `expo.ios.icon`: de `./assets/expo.icon` (bundle "Icon Composer" de
  iOS 26, con capas de vidrio/traslucidez que requieren la app nativa
  Icon Composer de Apple para autorarse correctamente) a
  `./assets/images/icon.png` — un PNG plano de 1024×1024. Confirmado en
  la documentación versionada de Expo SDK 57
  (`https://docs.expo.dev/versions/v57.0.0/config/app/`) que `ios.icon`
  acepta tanto el bundle `.icon` como una ruta de imagen plana; se opta
  por la ruta plana porque no hay herramienta disponible para generar
  correctamente el bundle con capas.
- Se elimina la carpeta `assets/expo.icon/` (queda sin referencia tras
  el cambio anterior; son los assets genéricos de la plantilla de Expo).

### Generación técnica

No hay editor de imágenes ni herramienta de rasterización SVG→PNG
disponible en el entorno (se verificó: sin ImageMagick, sin
`rsvg-convert`, sin `sharp`/`canvas` ya instalados). El plan es:

1. Escribir el SVG maestro a mano, componiendo el `<rect>` de fondo (o
   ninguno, para las variantes transparentes) con el `<path>` exacto de
   `PiggyBank` (copiado de
   `node_modules/lucide-react-native/dist/esm/icons/piggy-bank.mjs`),
   ajustando `viewBox`, escala y traslación para centrar el glyph en
   cada canvas objetivo.
2. Instalar `sharp` en un proyecto Node aislado dentro del directorio
   de scratchpad (no toca `package.json`/`package-lock.json` del
   proyecto).
3. Ejecutar un script Node que rasteriza cada SVG a su PNG de destino
   con `sharp`, y copiar los resultados a `assets/images/`.

### Testing

No aplica testing automatizado (son assets estáticos). Verificación:
- Confirmar visualmente cada PNG generado (abrir con la herramienta de
  lectura de imágenes) antes de copiarlo a `assets/images/`.
- Confirmar que `app.json` sigue siendo JSON válido tras los cambios de
  color/rutas.
- Confirmar que `npm run typecheck` sigue pasando (no debería verse
  afectado, ya que no se toca código TypeScript).
