# Software Development Life Cycle (SDLC) — A Deep Dive for Automotive Embedded

> Study notes covering the SDLC from generic models to the automotive-specific
> stack: V-model, ASPICE, ISO 26262, MISRA — with concrete examples from ECU
> development and interview-ready answers.

---

## 1. What is the SDLC?

The Software Development Life Cycle is the structured process that takes software
from an idea to a maintained product. It exists to answer three questions:
**what** are we building, **how** do we build it correctly, and **how do we
prove** it works?

Whatever the model, the fundamental phases are always:

| Phase | Question it answers | Key artifacts |
|---|---|---|
| 1. Requirements | What must it do? | Requirement specs (functional + non-functional) |
| 2. Design | How will it do it? | Architecture docs, detailed design specs |
| 3. Implementation | Build it | Source code, code reviews |
| 4. Testing / Verification | Does it work? Meet requirements? | Test cases, test reports, coverage metrics |
| 5. Deployment / Integration | Put it together and ship it | Releases, integration builds |
| 6. Maintenance | Keep it working | Bug fixes, updates, change requests |

### Requirements — the foundation everything hangs on

- **Functional requirements**: what the system does.
  *"REQ-LOCK-001: The doors shall lock automatically when vehicle speed exceeds 20 km/h."*
- **Non-functional requirements**: how well — timing, memory, reliability, safety.
  *"The locking command shall be issued within 100 ms of the threshold crossing."*
- Good requirements are: **unambiguous, testable, traceable, and uniquely identified (IDs)**.
  A requirement you cannot test is not a requirement — it's a wish.

---

## 2. The Classic Process Models

### Waterfall
Strictly sequential: each phase completes fully before the next begins; heavy
documentation at every gate.

- ✅ Predictable, easy to manage, auditable — good when requirements are stable
- ❌ Inflexible: a wrong requirement discovered in testing costs a fortune to fix;
  no working software until late

### Iterative / Incremental
Build the system in small pieces (increments), refining each cycle. Feedback
arrives earlier; risk is spread out.

### Agile (Scrum / Kanban)
Short iterations (sprints, typically 2 weeks), working software every sprint,
requirements welcome to change, close customer collaboration.

- ✅ Adaptability, fast feedback, early visibility
- ❌ Hard to apply unchanged when hardware, homologation, and safety certification
  impose fixed gates — which is exactly the automotive situation (see §4)

### V-model
Waterfall with the testing phases **mirrored** against the development phases.
The automotive industry's native model — full treatment in §3.

---

## 3. The V-Model — Automotive's Native Language

```
   Customer / System Requirements ─────────── Acceptance Test (validation)
            System Design ────────────────── System Test
                 SW Architecture ─────────── Integration Test
                      Detailed Design ────── Unit Test
                             Implementation
```

The left side **decomposes** (what → how → code). The right side **verifies**.
The defining idea:

> **Every test phase on the right corresponds to a design phase on the left —
> and its test cases are derived from that phase's artifacts, ideally written
> in parallel, not after coding.**

### The four test levels, concretely

| Test level | Verifies | Question | Typical environment |
|---|---|---|---|
| **Unit test** | Detailed design | Does this function match its spec? | Host PC: GoogleTest, pytest, VectorCAST, Tessy |
| **Integration test** | SW architecture | Do the modules interact correctly? | Restbus simulation, SIL, target ECU |
| **System test** | System requirements | Does the whole ECU/system behave as specified? | HIL rigs, CANoe, real bus |
| **Acceptance test** | Customer requirements | Is it the right product? | Vehicle, customer sign-off |

### Worked example — a Body Control Module feature

Following one requirement down the V and back up:

```
LEFT SIDE (decomposition)                     RIGHT SIDE (verification)
─────────────────────────                     ─────────────────────────
REQ-LOCK-001: doors lock > 20 km/h       →    Acceptance: drive the car,
                                              verify doors lock
System: BCM subscribes VehicleSpeed,     →    System test (HIL): inject speed
  publishes DoorLockCmd                       frames, observe lock actuator
Architecture: SignalHandler + LockLogic  →    Integration test: simulate the
  + CanIf modules                             rest of the bus (restbus), drop
                                              speed messages, check timeouts
Detailed: LockLogic::update() state      →    Unit test: feed 19.9/20.0/20.1
  machine, hysteresis, debounce               km/h, assert command + timing
                Implementation
```

Note how each test level maps to one design level — and how **restbus
simulation** (simulating the whole bus around the ECU under test) is the
industry-standard integration-test technique.

### Verification vs Validation — the classic interview question

- **Verification**: *"Are we building the product **right**?"* — checking work
  products against their specifications (reviews, unit/integration/system tests
  against specs). Left side feeds the right side.
- **Validation**: *"Are we building the **right product**?"* — checking the
  system against customer intent in the real environment.

---

## 4. The Automotive-Specific Stack

### 4.1 Automotive SPICE (ASPICE) — process maturity

ASPICE is a process assessment model: OEMs use it to grade **how disciplined a
supplier's development process is** (capability levels 0–5). It doesn't change
*what* you build — it audits *how* you build it.

Core demands:
- **Bidirectional traceability** — the big one. Every requirement links to a
  design element, to code, and to test case(s) — and back:

```
REQ-LOCK-001 ⇄ SW-ARCH-014 (LockLogic) ⇄ lock_logic.c::update() ⇄ TC-UNIT-042, TC-INT-007
```

  If a requirement changes, traceability tells you exactly which design, code,
  and tests are impacted. Tools: DOORS, Jira/Polarion + test management.
- Documented processes, reviews, and *retained evidence* (test reports,
  review records) — assessors want proof, not promises.
- Change management: every change is requested, analyzed, approved, tracked.

### 4.2 ISO 26262 — functional safety

The standard for safety-relevant E/E systems in road vehicles. Core vocabulary:

- **HARA** (Hazard Analysis and Risk Assessment): identify hazards
  (e.g., "doors unlock at speed"), rate by Severity / Exposure / Controllability.
- **ASIL A–D** (Automotive Safety Integrity Level): the resulting risk class.
  D = strictest (braking, steering), A = mildest; QM = no safety requirement.
- **ASIL tailors the lifecycle's rigor**: ASIL D demands more independence in
  reviews, stricter test coverage (up to MC/DC), qualified tools, formal
  methods where appropriate.
- **Safety goal → functional safety requirements → technical safety
  requirements**, flowing into the same V-model — safety is *added rigor*, not
  a separate process.
- **Freedom from interference / ASIL decomposition**: mixing ASIL-D and QM
  software on one ECU requires proof the QM part can't corrupt the D part
  (memory protection, time partitioning).

> One-liner: *"ISO 26262 scales the V-model's rigor to risk — the more
> dangerous a failure, the more evidence you must produce that the software
> cannot cause it."*

### 4.3 MISRA C — coding guidelines

A set of C language rules banning dangerous constructs (undefined behavior,
aliasing traps, implicit conversions...), enforced by static analysis
(PC-lint, Polyspace, Coverity). Examples in spirit:

- Don't access an object through an incompatible pointer type (strict aliasing)
  → use `memcpy` for reinterpretation.
- No implicit narrowing conversions; range-check before writing bit-fields.
- Assertions / defensive checks at module boundaries.

MISRA compliance is a *gate in the lifecycle*: code doesn't pass review/CI
without a clean static-analysis report (or formally justified deviations).

### 4.4 Agile in automotive — the hybrid reality

Hardware lead times, homologation, and safety certification are waterfall-shaped;
software wants to iterate. The industry's answer:

> **"Agile within the V"** — teams develop in Scrum sprints (incremental
> features, CI, automated tests), while the project keeps V-model gates for
> integration, safety assessments, and release.

If asked *"Agile or V-model?"*, the senior answer: *"Both. Sprints for
development cadence and feedback; V-model gates where safety, hardware, and
legal certification need documented evidence."*

---

## 5. Requirements Engineering in Practice

Because everything traces back to requirements, their quality decides the
project's fate.

- **Elicitation**: stakeholders, regulations (UNECE), safety goals, legacy
  system constraints.
- **Specification style**: shall-statements, one requirement per sentence,
  active voice, measurable thresholds.
- **Attributes**: unique ID, version, ASIL, source, verification method
  (test / analysis / inspection / demonstration).
- **Reviews**: requirement reviews catch defects when they're cheapest —
  industry rule of thumb: a defect found in requirements costs ~1x, in design
  ~5x, in testing ~10–20x, in the field ~100x (recalls).

---

## 6. Testing in Depth

### Test design techniques

- **Equivalence classes**: speed 0–20 / >20 km/h — one test per class.
- **Boundary value analysis**: the bugs live at the edges — test 19.9, 20.0,
  20.1, and uint16 overflow points (0xFFFF).
- **Fault injection** (automotive favorite): drop messages, corrupt signals,
  send out-of-range values, kill a node mid-arbitration — verify timeouts,
  default values, DTC setting, graceful degradation.
- **Coverage metrics**: statement → branch → **MC/DC** (required at high ASIL).

### xIL test environments (the simulation ladder)

| Acronym | Meaning | What runs where |
|---|---|---|
| **MIL** | Model-in-the-loop | model vs model (Simulink) |
| **SIL** | Software-in-the-loop | compiled code on PC (your SocketCAN lab lives here) |
| **PIL** | Processor-in-the-loop | code on target processor, simulated plant |
| **HIL** | Hardware-in-the-loop | real ECU, simulated bus/sensors/actuators (dSPACE, Vector) |
| **Vehicle** | — | the real car |

### Test documentation (what ASPICE wants to see)

Test specification (cases derived from requirements, with IDs) → test execution
(logs, traces) → **test report** (pass/fail, deviations, linked defects).
Every failure becomes a tracked defect with root-cause analysis.

---

## 7. Maintenance, CI/CD, and Modern Practices

- **Change management**: defect/change request → impact analysis (traceability!)
  → implementation → regression test → release note.
- **Regression testing**: every change re-runs the affected test suite —
  automation is the only way this scales.
- **CI/CD in embedded**: build server compiles for target, static analysis
  (MISRA) runs, unit + SIL tests execute nightly, artifacts archived as
  evidence. Increasingly: **OTA (over-the-air) updates** — which makes UDS/DoIP
  flashing knowledge lifecycle-relevant, not just protocol trivia.
- **Cybersecurity (ISO/SAE 21434)**: the newest lifecycle layer — TARA
  (threat analysis), secure boot, signed firmware; parallels ISO 26262's structure.

---

## 8. Interview-Ready Answers (60 seconds each)

**"Explain the V-model."**
> "It's a waterfall variant where test phases mirror design phases. The left
> side decomposes requirements into code; each right-side test level verifies
> its counterpart: unit tests against detailed design, integration tests
> against architecture, system tests against system requirements, acceptance
> against customer requirements. Test cases are derived from the corresponding
> artifacts early, not written after coding."

**"Verification vs validation?"**
> "Verification asks 'are we building the product right' — against
> specifications. Validation asks 'are we building the right product' —
> against customer intent in the real environment."

**"What is traceability?"**
> "Bidirectional links from each requirement through design and code to test
> cases — and back. It's what ASPICE assesses; when a requirement changes,
> traceability tells you exactly which design, code, and tests are impacted."

**"What do you know about ISO 26262?"**
> "The functional-safety standard for automotive E/E. Hazards are analyzed in
> a HARA and classified ASIL A to D; the ASIL then tailors how rigorous the
> lifecycle must be — stricter coverage, independent reviews, qualified tools
> at ASIL D. It's added rigor on the V-model, not a separate process."

**"Agile or V-model?"**
> "Hybrid — 'Agile within the V'. Sprints for development cadence and feedback;
> V-model gates for integration, safety evidence, and release, because hardware
> and certification are waterfall-shaped."

**"How do you test your code?"**
> "Requirement-derived test cases with IDs, boundary values and fault injection,
> assertions for loud failures during development, automated execution, and a
> test report linked back to the requirements. For a CAN feature I'd unit-test
> the logic on host, then integration-test against a simulated restbus."

---

## 9. Putting It Into Practice (personal exercise)

Take a small feature (e.g., the door-lock BCM logic) and run it through a mini
lifecycle on paper + code:

1. Write 3 requirements with IDs (functional + timing + fault behavior).
2. Sketch the design: modules, interfaces, a state machine.
3. Implement it.
4. Write test cases **with the requirement ID in each test name**, covering
   boundaries and one fault-injection scenario.
5. Produce a one-page test report: cases, results, logs.
6. Draw the traceability table: REQ ⇄ design ⇄ code ⇄ test.

That's a portfolio artifact demonstrating V-model literacy with real evidence —
far stronger in an interview than reciting definitions.
