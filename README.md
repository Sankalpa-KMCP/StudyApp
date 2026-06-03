# StudyApp // The Monolithic Focus Workstation

A local-first, hardware-accelerated deep work dashboard and cognitive retention engine bound inside an industrial cyber-monolithic console interface.

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
| **Storage & State Resilience Matrix** | `Dexie.js` (IndexedDB Wrapper) & `sessionStorage` | Implements a continuous local storage pipeline. An active `sessionStorage` heartbeat safety shadow tracks seconds elapsed and timer phases in real-time. If the session suffers accidental tab closure, system crash, or power failure, the boot sequencer detects the uncompleted sequence and gracefully archives it as an "Interrupted Session". Version 3 migrations run relational schema upgrades (defaulting missing category IDs and estimated/actual focus cycles) to protect historical tables. |
| **Acoustic Density & Synthesis Engine** | HTML5 Low-Level Web Audio API | Generates real-time soundscapes without external audio file requests. Synthesizes a four-oscillator additive harmonic Tibetan Singing Bowl Chime ($180\text{ Hz}$ baseline core, $f_0$), and a procedurally-filtered mechanical key thock. Also implements a discrete **Alpha Waves Binaural Beat** generator (parallel left/right oscillators at $100\text{ Hz}$ and $110\text{ Hz}$ producing a $10\text{ Hz}$ frequency offset) integrated into the multi-channel volume mixer. |
| **HTML5 Radar Telemetry Canvas** | Decoupled 2D Canvas & React Refs | Integrates a performance-optimized 2D canvas context executing a `requestAnimationFrame` loop. Coordinate calculations for the 60 particle nodes are decoupled from draw routines, and the 3-layered sine wave ribbon is modulated dynamically by the active audio mixer's master gain node. |
| **HRV Coherence Pacer** | GPU-Accelerated CSS Shadows | Runs a smooth breathing guide using keyframed CSS shadow transitions. Employs a strict 8-second cycle (4s inhalation scaling up, 4s exhalation scaling down) to cultivate Heart Rate Variability resonance and lower cardiac velocity during deep intellectual sprints. |

---

## 3. Core Feature Subsystems

The primary operations of the console are divided into three high-fidelity modules:

### `[MODULE // 01.CHRONOS FLOW ENGINE]`
* **Precision Countdown Matrix:** Runs a highly accurate interval timer tracking focus blocks, short recovery phases, and extended recovery gates.
* **Hard Lockout Mode:** When activated via settings, the engine enforces strict session boundaries by disabling tab navigation and shortcut-based exits. Manual exit triggers are stripped out entirely during active study blocks.
* **Post-Sprint Reflection Gate:** When a study interval completes, a modal blocks the interface requesting attention focus and context-switching metrics, logging workstation stats immediately into history.

### `[MODULE // 02.TASK REGISTRY]`
* **Relational Local Mapping:** Tasks are structured as local entities tracking estimates (target cycles) against actual elapsed focus intervals.
* **Version 3 Schema Migrations:** Auto-maps legacy fields and defaults missing categories or estimation data during initialization lifecycles without losing user logs.
* **Attention Focus Matrix:** Saves qualitative metrics alongside duration telemetry to map long-term intellectual efficiency.

### `[MODULE // 03.CUSTOMIZATION HUB]`
* **Variable Typography Calibration:** Enables switching monospace and geometric displays (`JetBrains Mono`, `Fira Code`, `SF Mono`, `Outfit`, `Inter`) via CSS `:root` variable changes.
* **Multi-Channel Soundscape Mixer:** Synthesizes and mixes independent volume channels (Rain, Cafe, White Noise, Alpha Waves) directly in the browser.
* **Real-time Glass Opacity Adjuster:** Injects card-opacity and backdrop-blur variables, altering CSS values dynamically to optimize interface performance.

---

## 4. Visual Philosophy: Industrial Cyber-Minimalism

This workstation consciously departs from bright, generic web glassmorphic presets in favor of an **Industrial Command-Line Console** layout. The design is optimized for high-intensity developer and engineering study environments.

* **Ocular Strain Mitigation:** Utilizes deep, low-luminance matte obsidian base colors (`#07090e`, `#0c0f17`) to prevent glare during multi-hour study blocks.
* **Structural Rigidity:** Uses sharp, zero-radius technical boundaries (`rounded-none`, `border-1px`) and precise layouts instead of soft curves or organic alignments.
* **Telemetry Highlighting:** All status transitions utilize explicit, functional colors:
  * **Cyber Green (`#00ff66`):** Active telemetry states, running timers, and complete tasks.
  * **Tactical Amber (`#f59e0b`):** Recovery states, warning limits, and pending intervals.
  * **Amethyst Purple (`#c084fc`):** Soundscape telemetry overlays and visual audio reflections.

---

## 5. Deployment Framework & Single-Page Routing

To support local hosting and serverless deployments (such as GitHub Pages), the project implements a static SPA architecture designed to survive browser route rewrites.

1. **Static Folder Base Routing:** The compiler configures all asset assets relative to the sub-folder repository path (`base: '/StudyApp/'` inside `vite.config.ts`).
2. **SPA Refresh Interceptor (`404.html` Route Recovery):**
   * Since GitHub Pages cannot serve custom path responses dynamically, a custom SPA routing guard is integrated.
   * If a user refreshes the page on a non-root route (e.g. `/journal` or `/analytics`), GitHub Pages falls back to the customized [404.html](file:///e:/New%20Web%20Lernning/study%20app/web/public/404.html) fallback.
   * A script decodes search query routing keys and reconstructs them into history paths via `history.replaceState` before the main React index mounts.
