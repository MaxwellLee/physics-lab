# Circuit bench experiment sources

This experiment separates exact ideal-model results, standard reference data, and teaching visualizations. All graphics are drawn procedurally at runtime (SVG / Canvas 2D); no external images, fonts, or audio are used.

## Physics model

- DC steady-state circuits are solved with Modified Nodal Analysis (MNA), the standard formulation used by circuit simulators such as SPICE. Reference: L. O. Chua, P.-M. Lin, *Computer-Aided Analysis of Electronic Circuits*; see also the [SPICE3 / ngspice documentation](https://ngspice.sourceforge.io/docs.html) for the same nodal formulation.
- Ohm's law, series/parallel relations, Kirchhoff's laws, electric power, and the definition of voltage as a potential difference follow [OpenStax *University Physics* Volume 2](https://openstax.org/details/books/university-physics-volume-2) (Rice University, CC BY 4.0) and the junior-high textbook 人教版《物理》九年级全一册 (People's Education Press), whose experiment sequence this bench reproduces (简单电路、串联与并联、伏安法测电阻、探究电流与电压的关系、探究影响电阻大小的因素).
- Conventional current direction (positive-charge flow) versus electron drift direction, and the order-of-magnitude drift velocity (~0.1 mm/s in typical classroom wires): [OpenStax *University Physics* Vol. 2, "Model of Conduction in Metals"](https://openstax.org/books/university-physics-volume-2/pages/9-2-model-of-conduction-in-metals). The flow animation exaggerates speed for visibility and the interface says so.
- Diode one-way conduction is idealized (0 V forward drop, perfect reverse blocking), matching the junior-high treatment; LED lighting is shown above a configurable threshold current.

## Component data

- Wire-board specimens use R = ρL/S with standard room-temperature resistivities: nichrome ρ ≈ 1.10×10⁻⁶ Ω·m, constantan ≈ 0.49×10⁻⁶ Ω·m, manganin ≈ 0.47×10⁻⁶ Ω·m, copper ≈ 1.68×10⁻⁸ Ω·m. Values are the usual textbook reference data (CRC Handbook of Chemistry and Physics; 人教版九年级物理 uses the same nichrome/constantan comparison experiment). Specimens are rounded to two significant figures — they are teaching values, not a specific spool's datasheet.
- Battery pack: 1.5 V per dry cell (IEC LR6 nominal); accumulator: 2 V nominal per lead-acid cell as taught in junior high.
- The non-linear bulb uses an empirical model R(U) = R₀·(1 + 9·(U/U_rated)²) with R₀ = (U_rated/I_rated)/10 (see `src/physics/components.js`): cold resistance is 1/10 of the hot (rated) value, reproducing the curved I–U characteristic of a real incandescent lamp. It is a teaching model, not a measurement of a specific lamp; this is disclosed in the model dialog.
- Fuse blow is modeled as an instant trip slightly above the rated current. Real fuses have time-current curves (IEC 60127); the delay is intentionally omitted.

## Idealizations (all disclosed in the in-app model dialog)

- Ammeters have zero internal resistance; voltmeters are ideal open circuits (junior-high convention). Wire, closed-switch, and fuse resistance is modeled as 1 mΩ so short-circuit current is finite and every branch current is computable; short-circuit current is additionally capped by a 100 A safety-limit model with a warning banner.
- Power supplies have no internal resistance and no ripple.
- Every node carries a 1 GΩ leakage path to ground so floating nodes have a defined potential; the physical effect is negligible (nanoampere scale).
- The potential-coloring layer shows exact node potentials of this ideal model (reference: supply negative terminal = 0 V). The flow-speed and water-analogy layers are teaching visualizations, not measurements.
- The water analogy (pump ↔ source, height difference ↔ voltage, flow ↔ current, valve ↔ resistance, water wheel ↔ load) is a didactic model with known limits: it illustrates energy and continuity intuition but says nothing about fields, electrons, or AC. Its limits are stated in the concept panel.

## Usage

No third-party assets are bundled. Textbook and OpenStax materials informed the pedagogy and data; no text is copied verbatim. No endorsement by any cited organization is implied.
