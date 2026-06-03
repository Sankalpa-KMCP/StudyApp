# Zenith // The Cognitive Focus Console

A local-first, hardware-accelerated deep work dashboard and cognitive retention engine bound inside an iOS 26 spatial glassmorphic interface.

**Created by Sankalpa KMCP**

---

## 1. Core Premise: Complete Sovereignty & Offline Execution

The Focus Workstation operates under a strict **local-first engineering philosophy**. The application is entirely self-contained, data-private, and executes 100% of its logic, state, and media processing within the client-side sandbox.

- **Zero Cloud Dependency:** There are no remote APIs, database relays, or authentication checks.
- **Absolute Privacy:** Your telemetry, task registers, and logs never cross a network interface.
- **Zero Overhead:** No telemetry collection, background user tracking, or third-party analytical script execution.
- **Compute Efficiency:** Runs at local hardware speed using pure web technologies under sandboxed client resources.

---

## 2. Technical Architecture & Blueprint

The workstation's background operations are orchestrated via four low-latency subsystems that minimize compute cycles while maximizing user flow coherence.

```
+-----------------------------------------------------------------------------------+
|                            THE MONOLITHIC WORKSTATION                             |
+-----------------------------------------------------------------------------------+
|  [CHRONOS FLOW ENGINE]   [HRV PACS COHERENCE]  [ACOUSTIC SYNTH]  [RADAR CANVAS]   |
+------------------------+---------------------+-----------------+------------------+
|      sessionStorage    |      CSS Shadow     |    Web Audio    |  requestAnimFr   |
|     Heartbeat Shadow   |     Keyframe Loop   |    Low-Level    |   Render Loop    |
+------------------------+---------------------+-----------------+------------------+
|                                  DEXIE.JS INTERFACE                               |
|                             (IndexedDB Local Storage)                             |
+-----------------------------------------------------------------------------------+
```

| Subsystem | Underlying Technology | Engineering Specifications |
| :--- | :--- | :--- |
| **Storage & State Resilience Matrix** | `Dexie.js` (IndexedDB Wrapper) & `sessionStorage` | Implements a continuous local storage pipeline. An active `sessionStorage` heartbeat shadow tracks seconds elapsed and timer phases in real-time. If the session suffers accidental tab closure, system crash, or power failure, the boot sequencer detects the uncompleted sequence and gracefully archives it as an "Interrupted Session". Relational schema upgrades run automatic migrations to protect historical tables. |
| **Acoustic Density & Synthesis Engine** | HTML5 Low-Level Web Audio API | Generates real-time soundscapes without external audio file requests. Synthesizes a four-oscillator additive harmonic Tibetan Singing Bowl Chime ($180\text{ Hz}$ baseline core, $f_0$), and a procedurally-filtered mechanical key thock. Also implements a discrete **Alpha Waves Binaural Beat** generator (parallel left/right oscillators at $100\text{ Hz}$ and $110\text{ Hz}$ producing a $10\text{ Hz}$ frequency offset) integrated into the multi-channel volume mixer. |
| **HTML5 Radar Telemetry Canvas** | Decoupled 2D Canvas & React Refs | Integrates a performance-optimized 2D canvas context executing a `requestAnimationFrame` loop. Coordinate calculations for the 60 particle nodes are decoupled from draw routines, and the 3-layered sine wave ribbon is modulated dynamically by the active audio mixer's master gain node. |
| **HRV Coherence Pacer & Breath Guide** | Animated CSS Scaling Circles | Runs a breathing guide using smoothly animated layout transitions. Employs a structured 12-second cycle (5s inhale, 2s hold, 5s exhale) to cultivate Heart Rate Variability resonance and lower cardiac velocity during break states. |

---

## 3. Core Feature Subsystems

The primary operations of the console are divided into three high-fidelity modules:

### `[MODULE // 01.CHRONOS FLOW ENGINE]`
* **Precision Countdown Matrix:** Runs a highly accurate interval timer tracking focus blocks, short recovery phases, and extended recovery gates.
* **Hard Lockout Mode:** When activated via settings, the engine enforces strict session boundaries by disabling tab navigation and shortcut-based exits.
* **Post-Sprint Reflection Gate:** When a study interval completes, a modal blocks the interface requesting attention focus and context-switching metrics, logging workstation stats immediately into history.

### `[MODULE // 02.TASK REGISTRY]`
* **Relational Local Mapping:** Tasks are structured as local entities tracking estimates (target cycles) against actual elapsed focus intervals. Supports setting priority tags (High, Medium, Low) and custom subjects.
* **Attention Focus Matrix:** Saves qualitative metrics alongside duration telemetry to map long-term intellectual efficiency.

### `[MODULE // 03.CUSTOMIZATION HUB]`
* **Variable Typography Calibration:** Enables switching monospace and geometric displays (`JetBrains Mono`, `Fira Code`, `SF Mono`, `Outfit`, `Inter`) via CSS `:root` variable changes.
* **Multi-Channel Soundscape Mixer:** Synthesizes and mixes independent volume channels (Rain, Cafe, White Noise, Alpha Waves) directly in the browser with active CSS wave pulse indicators.
* **Real-time Glass Opacity Adjuster:** Injects card-opacity and backdrop-blur variables, altering CSS values dynamically to optimize interface performance.

---

## 4. Visual Philosophy: iOS 26 Spatial Glassmorphism

This workstation embraces a state-of-the-art **iOS 26 Spatial Glassmorphic** style. It transitions focus apps from dark, rigid grids to highly tactile, floating glass modules.

* **Animated Mesh Gradient Backdrop:** Features four glowing color blobs that drift smoothly in the background. The blobs adapt their color hues dynamically based on the selected theme (Midnight Slate, Cyber Amethyst, Deep Forest, Ocean Trench).
* **Double-Border Specular Highlight:** Card borders feature a custom dual-line box-shadow (top light reflection at `rgba(255,255,255,0.16)` and bottom shadow at `rgba(0,0,0,0.1)`) with `blur(36px) saturate(190%)` for high-fidelity depth refraction.
* **Squircle Geometries:** Enforces rounded corner radii (`rounded-2xl`, `rounded-[10px]`) and smooth easing transition paths (`cubic-bezier(0.16, 1, 0.3, 1)`) for premium feedback responses.

---

## 5. Deployment Framework & Single-Page Routing

To support local hosting and serverless deployments (such as GitHub Pages), the project implements a static SPA architecture designed to survive browser route refreshes.
