# AutoTest Psicotécnico 2D — Simulador de Evaluación y Práctica de Conductores

Aplicación móvil interactiva en **2D** desarrollada con **React Native y Expo (SDK 58)** orientada a la evaluación psicotécnica y entrenamiento práctico previo a la obtención o renovación de licencias de conducción.

Diseñada bajo una estética de **Tablero de Control Profesional (AutoTest Psicotécnico)** con paleta oscura (azul marino profundo `#050A14` / `#0A1222` / `#0F1A2E`) y acentos de instrumentación en **verde menta (`#00F5A0`)** y **cian (`#00D9F5`)**.

---

## Pila Tecnológica (Stack)

| Tecnología / Librería | Función Principal | Implementación en el Proyecto |
| :--- | :--- | :--- |
| **React Native + Expo (SDK 58)** | Framework Base | Ejecución multiplataforma fluida en Android, iOS y Web con motor Hermes y React Compiler. |
| **Expo Router** | Enrutamiento y Navegación | Navegación basada en archivos dentro de `src/app/` (`index`, `reaction`, `lathe`, `maneuvers`). |
| **expo-audio** *(sucesor oficial de `expo-av` en SDK 58)* + **expo-haptics** | Audio y Señales Acústicas | Reproducción de impulsos sonoros discriminados por mano (`440 Hz` Mano Izquierda, `880 Hz` Mano Derecha) con archivos PCM `.wav` generados en `assets/sounds/`. |
| **react-native-gesture-handler** | Control de Gestos Multitáctil | Manejo sin latencia de los dos anillos simultáneos del Torno Bimanual y del Joystick de dirección del vehículo 2D. |
| **react-native-svg** | Renderizado Vectorial 2D | Trazado en tiempo real a 60 FPS de los carriles ondulados bimanuales y del circuito top-down con vehículo direccional. |

---

## Estructura de Pantallas y Módulos (`src/app/`)

1. **Pantalla 1: Menú Principal / Dashboard (`src/app/index.tsx`)**
   - Telemetría superior en tiempo real con **Latencia de Audio (`ms`)** y **Frecuencia de Cuadros (`FPS`)**.
   - Tres tarjetas visuales de gran tamaño con acceso directo a cada prueba y estado de calificación de la sesión.
   - Panel inferior con el **Resumen de Baremos Oficiales Psicotécnicos** (`EXCELENTE`, `APTO OFICIAL`, `NO APTO`).
2. **Pantalla 2: Prueba de Reacción y Audio (`src/app/reaction.tsx`)**
   - Interfaz de **Pantalla Dividida** con dos rectángulos táctiles de gran tamaño (**Rojo** para Mano Izquierda y **Verde** para Mano Derecha).
   - **Alertas discriminadas por mano** mediante tonos de `440 Hz` (canal izquierdo) y `880 Hz` (canal derecho), medición en milisegundos, detección de salidas en falso y modos `AUDIO + VISUAL`, `SOLO AUDIO` y `SOLO VISUAL`.
3. **Pantalla 3: Prueba del Torno — Coordinación Bimanual (`src/app/lathe.tsx`)**
   - **Dos carriles verticales ondulados** asimétricos en desplazamiento continuo.
   - **Dos círculos arrastrables simultáneos** mediante `Gesture.Pan()` independiente por hemisferio.
   - Panel en tiempo real de **Precisión (`%`)**, **Velocidad (`px/s`)** y tiempo fuera de pista.
4. **Pantalla 4: Simulador de Maniobras 2D — Vista Superior (`src/app/maneuvers.tsx`)**
   - **Vista de Pájaro (Top-Down)** de un circuito vial con **vehículo azul** (modelo cinemático con ruedas delanteras que giran según el ángulo de dirección) y **zona de parqueo claramente demarcada** (`P`).
   - **Joystick de Control** en la esquina inferior izquierda para controlar el ángulo de giro de las ruedas (`-38°` a `+38°`).
   - **Pedales de Control** en la esquina inferior derecha (**Freno / Reversa** y **Acelerador**) junto con selector de marcha (`D / R`).

---

## Ejecución del Proyecto

```bash
# Iniciar el servidor de desarrollo de Expo
npx expo start

# Verificar tipos de TypeScript
npx tsc --noEmit

# Ejecutar el linter oficial de Expo
npx expo lint
```
