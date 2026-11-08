# AutoTest Psicotécnico & Simulador de Conducción 3D

Aplicación móvil (Android, iOS y Web) hecha con **React Native + Expo (SDK 58)** para practicar y evaluar las pruebas previas a la obtención o renovación de una licencia de conducción: inspección preoperacional del vehículo, reacción auditiva, coordinación bimanual y maniobras de parqueo en un simulador 3D con cabina en primera persona.

La interfaz usa un tablero oscuro (azul marino `#050A14`) con acentos verde menta `#00F5A0` y cian `#00D9F5`.

---

## ¿Qué hace?

El usuario recorre cuatro módulos. Cada uno guarda su resultado (nota y métricas) en un contexto global, y el tablero principal los resume junto con los baremos oficiales (`EXCELENTE`, `APTO`, `NO APTO`).

| Módulo | Pantalla | Qué evalúa o enseña |
| :--- | :--- | :--- |
| **Preoperacional** | `src/app/preoperational.tsx` | Laboratorio visual de 6 sistemas del carro: motor y fluidos, llantas (PSI), luces, espejos, cabina y kit de carretera. Para cada uno se ve el **problema**, se aplica la **solución** y se compara. Una **voz de fondo** resume qué pasa y cómo se soluciona, y arranca sola al iniciar cada lección. |
| **01 · Reacción y audio** | `src/app/reaction.tsx` | Pantalla dividida con dos zonas táctiles (roja = mano izquierda, verde = mano derecha). Tonos de 440 Hz (izquierda) y 880 Hz (derecha), tiempo de reacción en ms, salidas en falso y modos audio+visual, solo audio y solo visual. Requiere audífonos. |
| **02 · Torno bimanual** | `src/app/lathe.tsx` | Dos carriles ondulados que avanzan en vertical y dos cursores que se arrastran a la vez, uno por mano. Mide la precisión por carril y el tiempo fuera de pista. La **velocidad es adaptativa**: sube si el usuario conduce bien y baja si se sale. |
| **03 · Maniobras 3D** | `src/app/maneuvers.tsx` | Simulador en primera persona con 3 niveles: parqueo en bahía a 90°, parqueo en paralelo y eslalon de conos. Cuenta tiempo, conos tocados y alineación con la zona `[P]`. |

---

## Simulador 3D (módulo de maniobras)

Todo el mundo 3D se proyecta manualmente en perspectiva y se dibuja como SVG, sin motor 3D externo.

- **Cabina completa:** volante que se arrastra, caja de cambios manual en H (`R`, `N`, `1`–`5`), tres pedales independientes (embrague, freno, acelerador), freno de mano, direccionales, intermitentes, luces, limpiaparabrisas, cinturón, tacómetro y velocímetro.
- **Física del vehículo:** modelo cinemático con aceleración gradual por marcha, suavizado del pedal para evitar tirones, freno de motor, ralentí y revoluciones según la velocidad.
- **Cámara viva:** cabeceo al acelerar o frenar, balanceo en las curvas, retraso de la vista al girar y vibración leve según el pavimento.
- **Entorno:** cielo con sol y halo, nubes con deriva, montañas con paralaje, bruma de distancia, viñeta que aumenta con la velocidad, edificios, pórtico, autos estacionados, árboles que se mecen, farolas con brillo, conos, flechas, paso cebra y huellas de neumáticos.
- **Iluminación:** los faros proyectan haces de luz sobre el asfalto.
- **Controles:** táctiles en el celular (la pantalla gira sola a horizontal) y teclado en web: `W/↑` acelerador, `S/↓` freno, `C/Shift` embrague, `A/D` o flechas para el volante y `1`–`5`, `R`, `N` para las marchas.

---

## Pila tecnológica

| Tecnología | Para qué se usa |
| :--- | :--- |
| **React Native 0.88 + Expo SDK 58 + React 19** | Base multiplataforma (Android, iOS, Web). |
| **Expo Router** | Navegación por archivos en `src/app/` (`index`, `preoperational`, `reaction`, `lathe`, `maneuvers`). |
| **react-native-svg** | Dibujo vectorial: escena 3D proyectada, carriles del torno e ilustraciones del preoperacional. |
| **react-native-gesture-handler** | Gestos multitáctiles: volante, caja de cambios y los dos cursores del torno. |
| **react-native-reanimated / worklets** | Animaciones fluidas. |
| **expo-audio + expo-haptics** | Sonidos (`assets/sounds/*.wav`) y vibración al responder. |
| **expo-speech** | Voz en español que narra cada lección del preoperacional. |
| **expo-image** | Imagen de portada. |
| **expo-symbols, @expo/vector-icons** | Iconografía. |
| **TypeScript** | Tipado estático. |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── _layout.tsx          # Navegación, tema oscuro y proveedor de evaluación
│   ├── index.tsx            # Portada + tablero con telemetría, tarjetas y baremos
│   ├── preoperational.tsx   # Inspección 360° con voz explicativa
│   ├── reaction.tsx         # Prueba de reacción y audio
│   ├── lathe.tsx            # Torno bimanual con velocidad adaptativa
│   └── maneuvers.tsx        # Simulador 3D con cabina (3 niveles)
├── components/
│   └── telemetry-header.tsx # Encabezado con FPS, latencia de audio y botón de prueba
├── context/
│   └── evaluation-context.tsx  # Estado global de resultados de las 4 pruebas
├── hooks/
│   ├── use-psych-audio.ts   # Sonidos izquierda/derecha/éxito/error + háptica
│   └── use-telemetry.ts     # Medición de FPS y estado del sistema
└── constants/
    └── theme.ts             # Paleta, tipografías y baremos oficiales
assets/
├── sounds/                  # Tonos .wav (440 Hz, 880 Hz, éxito, error)
└── images/                  # Iconos y portada
```

---

## Ejecución

```bash
npm install                # instalar dependencias
npx expo start             # servidor de desarrollo (QR para Expo Go, o presionar w para Web)
npx expo run:android       # build de desarrollo nativo (si se usan módulos nativos)
npx tsc --noEmit           # verificar tipos
npx expo lint              # linter oficial de Expo
```

> La app también corre en el navegador. Para el audio y la voz se necesita una interacción previa del usuario (un toque), por política de los navegadores.
