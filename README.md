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
| **Storage & State Resilience Matrix** | `Dexie.js` (IndexedDB Wrapper) & `sessionStorage` | Implements a continuous local storage pipeline. An active `sessionStorage` heartbeat safety shadow tracks seconds elapsed and timer phases in real-time. If the session suffers accidental tab closure, system crash, or power failure, the boot sequencer detects the uncompleted sequence and gracefully archives it in the historical logs as an "Interrupted Session". |
| **Acoustic Density & Synthesis Engine** | HTML5 Low-Level Web Audio API | Generates real-time soundscapes without external audio file requests. The **Tibetan Singing Bowl Chime** synthesizes a four-oscillator additive harmonic signal with a $180\text{ Hz}$ baseline core ($f_0$) and upper partials ($2.76 f_0$, $5.4 f_0$, $8.93 f_0$) routed through an exponential volume decay envelope. The **Tactile Keyboard Click** procedural model synthesizes real-time pink noise filtered through a sharp $380\text{ Hz}$ bandpass filter ($Q=6.0$) with a rapid decay envelope to simulate a physical mechanical Brown Switch relay. |
| **HTML5 Radar Telemetry Canvas** | Decoupled 2D Canvas & React Refs | Integrates a performance-optimized 2D canvas context executing a `requestAnimationFrame` loop. Computes independent coordinate vector offsets for a field of 60 floating nodes. A 3-layered sine wave ribbon is overlayed, modulated dynamically by active soundscape mixer channel gains to produce an audio-reactive visual telemetry graph. |
| **HRV Coherence Pacer** | GPU-Accelerated CSS Shadows | Runs a smooth breathing guide using keyframed CSS shadow transitions. Employs a strict 8-second cycle (4s inhalation, 4s exhalation) to cultivate Heart Rate Variability resonance and lower cardiac velocity during deep intellectual sprints. |

---

## 3. Core Feature Subsystems

The primary operations of the console are divided into three high-fidelity modules:

### `[MODULE // 01.CHRONOS FLOW ENGINE]`
* **Precision Countdown Matrix:** Runs a highly accurate interval timer tracking focus blocks, short recovery phases, and extended recovery gates.
* **Hard Lockout Mode:** When activated via settings, the engine enforces strict session boundaries by hiding the manual exit controls. Users cannot abort the flow sequence early.
* **Relative Horizontal Timeline:** Displays a linear visual overview mapping historical study sprints, active periods, and planned recovery gates on a 24-hour horizontal track.

### `[MODULE // 02.TASK REGISTRY]`
* **Relational Local Mapping:** Tasks are structured as local entities tracking estimates (target cycles) against actual elapsed focus intervals.
* **Adaptive Legacy Fallbacks:** Contains dynamic schema adaptation layers that gracefully reconcile outdated local task versions to prevent schema friction.
* **Interactive Rating Systems:** Implements focus self-reflection gates that prompt users to rate their attention and context-switching metrics at the completion of a sprint.

### `[MODULE // 03.CUSTOMIZATION HUB]`
* **Variable Typography Calibration:** Allows developers to switch the dashboard's monospaced and sans-serif typography interfaces (`JetBrains Mono`, `Fira Code`, `SF Mono`, `Outfit`, `Inter`) via custom `:root` CSS variables.
* **Multi-Channel Soundscape Mixer:** Synthesizes and mixes independent volume channels (Rain, Cafe, White Noise, Alpha Waves) directly in the browser.
* **Opacity Card Frosting Adjuster:** Fine-tunes the backdrop blur and card opacity via settings, letting users adjust visual transparency to their exact hardware performance needs.

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
   * The fallback script parses the current route path and query parameters, wraps them into a temporary routing token, and redirects back to the index page.
   * Before the main React bundle mounts in [index.html](file:///e:/New%20Web%20Lernning/study%20app/web/index.html), a script block checks for this redirect token, extracts the target route, and updates the browser history state cleanly using `history.replaceState` to allow React to load the intended page structure seamlessly.
