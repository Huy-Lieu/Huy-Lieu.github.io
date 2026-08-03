# Struct vs Union in Embedded C — A Practical Deep Dive

> Study notes from hands-on exercises: memory layout, padding, reinterpretation,
> tagged unions, endianness, and bit-fields — the way they actually appear in
> ECU firmware and protocol code.

---

## 1. The Core Difference

```c
struct S { uint8_t a; uint32_t b; };   // 8 bytes: 1 + 3 padding + 4
union  U { uint8_t a; uint32_t b; };   // 4 bytes: both live at offset 0
```

```
struct S:                    union U:
addr 0: [ a ][pad][pad][pad] addr 0: [ a ]
addr 4: [ b   b   b   b  ]   addr 0: [ b   b   b   b  ]   <- same memory!
```

| | struct | union |
|---|---|---|
| Memory | sum of members + padding | largest member only |
| Members alive | all simultaneously | one at a time |
| Writing member X | leaves others intact | **invalidates the others** |
| Typical use | a record with many fields | one value, multiple interpretations |
| RAM cost | higher | minimal (matters on RAM-constrained MCUs) |

**One-liner:** a struct is a *record*; a union is *one storage viewed through several type lenses*.

---

## 2. Struct Padding & Alignment

### Why padding exists

CPUs fetch memory in aligned chunks. A `uint32_t` must start at an address
divisible by 4, otherwise the CPU does two reads + stitching (slow) — or
**faults** (ARM Cortex-M0 hard-faults on unaligned access). The compiler
silently inserts padding to keep every member aligned.

### The three rules

1. **Member placement:** each member goes at the first offset divisible by
   *its own alignment* (uint8_t→1, uint16_t→2, uint32_t→4, double→8).
   The gap left behind is *interior padding*.
2. **Struct alignment:** the struct inherits the **largest** alignment of
   any member.
3. **Trailing rounding:** `sizeof` is rounded up to a multiple of that
   largest alignment — so arrays of the struct keep every member aligned
   in every element.

### Typical alignments (GCC, x86 / ARM)

| Type | Size | Alignment | Offset divisible by |
|---|---|---|---|
| `uint8_t` | 1 | 1 | anything |
| `uint16_t` | 2 | 2 | 2 |
| `uint32_t` / `float` | 4 | 4 | 4 |
| `uint64_t` / `double` | 8 | 8 | 8 |

> ⚠️ Platform-dependent — verify with `offsetof()` on *your* target.

### Worked example

```c
struct D { uint32_t a; uint8_t b; uint16_t c; uint8_t d; };
```

```
offset:  0  1  2  3   4   5    6  7   8   9 10 11
        [     a     ] [b] [pad][  c  ] [d] [  pad 3  ]
```

- `a` @0 (align 4 ✓), `b` @4 (align 1, anywhere), `c` needs even offset → 1 pad, @6, `d` @8
- Trailing: 9 → round up to multiple of 4 → **sizeof = 12**

Reordered biggest-first, the same data costs **8 bytes**:

```c
struct D_opt { uint32_t a; uint16_t c; uint8_t b; uint8_t d; };  // zero padding
```

> Rule of thumb: **order members largest → smallest.** On 10,000 instances
> in an MCU, this reorder alone saves 40 KB of RAM.

### Key insight about padding

> **Padding belongs to the member that comes *next*, not the member before it.**
> A `uint8_t` never "needs 4 bytes" — the compiler inserts empty space *after* it
> to satisfy the following member's alignment.

### Related tools

- `#pragma pack(1)` / `__attribute__((packed))` — removes padding (used to match
  wire formats exactly), but risks slow or faulting unaligned access on some cores.
- `_Static_assert(sizeof(struct CanFrame) == 8, "...")` — compile-time layout verification.
- `offsetof(struct T, member)` — your best debugging tool for layout questions.

---

## 3. Union — Reinterpretation, Not Conversion

All members share the **same memory**. Writing one member overwrites the others.
The union remembers *nothing* about which member is currently valid — **only the
last-written member is safe to read, and the compiler will not warn you.**

### The critical distinction

```c
union { uint32_t u32; float f; uint8_t bytes[4]; } v;

v.u32 = 0x3F800000;
printf("%f", v.f);          // 1.0        <- REINTERPRET: same bits, new lens
printf("%f", (float)v.u32); // 1065353216 <- CONVERT: CPU changes value AND bits
```

| Operation | What the CPU does | Use case |
|---|---|---|
| Reinterpret (union / memcpy) | bits untouched, re-read as another type | decoding protocol data |
| Convert (cast) | emit conversion instruction, change the bits | arithmetic |

**"Trash values"?** No — the bytes are always well-defined. Only the *meaning*
can be garbage: reading the bit pattern of integer `42` as a float gives
`5.9e-44` — a valid float, just a meaningless one, because `42` is not a float
encoding. It's only meaningful when the bits actually encode that type
(`0x3F800000` *is* the IEEE-754 encoding of 1.0).

### The classic embedded use case: unpacking protocol data

```c
union CanSignal {
    float    value;
    uint8_t  bytes[4];   // the 4 bytes as they travel on the bus
};

// Receiving a CAN frame carrying a float:
union CanSignal s;
s.bytes[0] = frame.data[2];
s.bytes[1] = frame.data[3];
s.bytes[2] = frame.data[4];
s.bytes[3] = frame.data[5];
float temperature = s.value;   // same memory, different interpretation
```

> ⚠️ Watch **endianness** — byte order may differ between the bus and your MCU
> (see section 5).

> Standard note: strictly, the C standard calls cross-member reads undefined
> behavior; GCC/Clang explicitly allow it (type-punning), which is why the
> pattern is everywhere in firmware. `memcpy` is the always-legal alternative.

---

## 4. The Tagged Union — How Struct + Union Combine in Real Firmware

**The problem:** a CAN system has dozens of message types, but a queue can only
store one C type. Union gives shared storage — but who remembers what's inside?
**You do, via an explicit tag.**

```c
typedef enum { MSG_SPEED = 1, MSG_TEMP = 2, MSG_ENGINE = 3, MSG_DIAG = 4 } MsgType;

typedef struct {
    uint16_t kmh_x10;
} SpeedMsg;

typedef struct {
    int16_t celsius_x100;
} TempMsg;

typedef struct {
    uint16_t rpm;
    uint8_t  gear;
} EngineMsg;

typedef struct {
    uint8_t service_id;   // mini UDS: 0x22 = ReadDataByIdentifier
    uint8_t data[3];
} DiagMsg;

typedef struct {
    MsgType type;            // the tag: says which payload is valid
    union {
        SpeedMsg  speed;
        TempMsg   temp;
        EngineMsg engine;
        DiagMsg   diag;
    } payload;
} Message;                   // sizeof = 8 (tag 4B + largest payload 4B)
```

### Dispatch

```c
void handle(const Message *m) {
    switch (m->type) {
        case MSG_SPEED: handle_speed(m); break;
        case MSG_TEMP:  handle_temp(m);  break;
        case MSG_DIAG:  handle_diag(m);  break;
        default:        /* unknown type — always have a default! */
            break;
    }
}
```

### The discipline: check the tag before touching the payload

Reading the wrong member fails **silently** — no compiler error, no crash, just
garbage data (e.g., a SPEED message read as DIAG returns the speed bits
reinterpreted as a service ID). In a car, this class of bug means "brake
pressure applied as steering angle."

```c
#include <assert.h>

void handle_speed(const Message *m) {
    assert(m->type == MSG_SPEED);   // fail loud during development
    printf("SPEED: %.1f km/h\n", m->payload.speed.kmh_x10 / 10.0);
}
```

> **Embedded philosophy:** asserts crash loudly in testing so bugs surface
> before they reach a customer's car.

### Notes

- Fixed-point (`kmh_x10`) instead of float: real ECUs scale signals into
  integers — exactly what a DBC file's factor/offset describes.
- The tag lives **outside** the union: inside, it would share memory with the
  payload and be overwritten.
- Never send a raw `enum` over a bus — enum size is compiler-dependent
  (`-fshort-enums` can shrink it to 1 byte). Use an explicit `uint8_t msg_type`.
- This pattern is how CAN message routers, diagnostic handlers, RTOS mailboxes,
  and AUTOSAR COM callbacks are built: *one buffer, many layouts, a tag saying
  which is valid.*

---

## 5. Endianness — The Protocol-Critical Detail

- **Little-endian** (x86 PCs, most ARM MCUs): least significant byte first.
  Float 1.0 = `0x3F800000` lives in memory as `00 00 80 3F`.
- **Big-endian** (network protocols, many CAN signal definitions / "Motorola
  format", PowerPC): `3F 80 00 00`.

### The classic bug

A CAN frame carries float 1.0 big-endian. You drop the bytes into a union on
your little-endian machine:

```c
v.bytes[0] = 0x3F;  v.bytes[1] = 0x80;  v.bytes[2] = 0x00;  v.bytes[3] = 0x00;
printf("%f", v.f);        // garbage: 4.6e-41
printf("0x%08X", v.u32);  // 0x0000803F — bytes are there, just BACKWARDS
```

### The portable fix — assemble with explicit shifts

```c
float be_bytes_to_float(uint8_t b[4])
{
    /* b[] holds a float in BIG-ENDIAN order (b[0] = MSB) */
    uint32_t bits = ((uint32_t)b[0] << 24) | ((uint32_t)b[1] << 16)
                  | ((uint32_t)b[2] <<  8) |  (uint32_t)b[3];
    union { uint32_t u; float f; } v;
    v.u = bits;              // reinterpret, NOT convert!
    return v.f;
}
```

Why endianness-proof? You explicitly state which byte is most significant, so
the compiler generates correct code on **any** host. (Byte-reversal works too,
but only if you *know* the host is little-endian — it breaks silently on a
big-endian target.)

### Detecting host endianness (interview classic)

```c
void check_endianness(void)
{
    union { uint32_t u; uint8_t b[4]; } v;
    v.u = 0x01020304;
    if (v.b[0] == 0x04)      printf("little-endian\n");  // LSB at lowest address
    else if (v.b[0] == 0x01) printf("big-endian\n");
}
```

> Automotive mapping: Intel vs Motorola signal format in DBC files is exactly
> this distinction. Same reason `htons`/`htonl` exist in networking.

---

## 6. Bit-Fields

Struct members with explicit width in bits — the compiler packs them into a
shared storage unit and generates the mask/shift instructions for you.

```c
struct StatusReg {
    uint8_t enable   : 1;   // bit 0
    uint8_t mode     : 2;   // bits 1-2
    uint8_t error    : 1;   // bit 3
    uint8_t priority : 3;   // bits 4-6
    uint8_t          : 1;   // bit 7 reserved (unnamed = inaccessible)
};
// sizeof = 1 byte: 7 declared bits + 1 reserved fit one uint8_t unit
```

### Rules and traps

- **Sizing:** fields pack into allocation units of the declared type. Overflow
  the unit → the next field starts a *new* unit (size jumps). Mixing declared
  types (`uint8_t` then `uint32_t` fields) inflates the struct badly — keep
  one consistent type.
- **Truncation:** assigning `9` to a 3-bit field silently keeps the low 3 bits
  → reads back `1`. Range-check before writing.
- **Zero-width field** `uint8_t : 0;` forces the next field into a new unit.
- **Portability (the big one):** the C standard does **not** define whether
  fields allocate from LSB or MSB, whether they straddle unit boundaries, or
  the unit size. `sizeof` is portable; the **bit layout is not**.

### Bit-fields vs masks — the two real-world styles

```c
/* Style 1: bit-fields (fine within ONE compiler/target, e.g. chip registers) */
struct ControlByte {
    uint8_t dlc     : 4;   // bits 0-3
    uint8_t channel : 3;   // bits 4-6
    uint8_t fd      : 1;   // bit 7
};

/* Style 2: masks + shifts (portable — use for protocol bytes crossing machines) */
#define CTRL_DLC_MASK   0x0F
#define CTRL_CHAN_MASK  0x70
#define CTRL_CHAN_SHIFT 4
#define CTRL_FD_MASK    0x80

uint8_t ctrl_build(uint8_t dlc, uint8_t channel, uint8_t fd)
{
    return (dlc & CTRL_DLC_MASK)                          /* mask inputs first! */
         | ((channel << CTRL_CHAN_SHIFT) & CTRL_CHAN_MASK)
         | (fd ? CTRL_FD_MASK : 0);
}

uint8_t ctrl_get_dlc(uint8_t b)     { return b & CTRL_DLC_MASK; }
uint8_t ctrl_get_channel(uint8_t b) { return (b & CTRL_CHAN_MASK) >> CTRL_CHAN_SHIFT; }
uint8_t ctrl_get_fd(uint8_t b)      { return (b & CTRL_FD_MASK) != 0; }
```

**Ship the mask version** when code targets multiple compilers/architectures
or parses bytes that cross machines (CAN frames): identical behavior everywhere,
plus free input validation via masking. Bit-fields remain great for
hardware registers that never leave one chip — more readable.

### Why `memcpy` to get the raw byte out of a struct?

A struct is not a scalar — you can't cast it:

```c
uint8_t raw = (uint8_t)ctrl;              // ERROR: no struct->scalar cast
uint8_t raw = *(uint8_t *)&ctrl;          // works... but strict-aliasing risk at -O2

uint8_t raw;
memcpy(&raw, &ctrl, 1);                   // THE safe idiom: always legal, all compilers
```

`memcpy` is the only reinterpretation mechanism the C standard guarantees for
all types, compilers, and optimization levels — and small fixed-size memcpys
compile to a single load instruction, so the safety is **literally free**.
(Unions are the classic embedded alternative; pointer casts are the trap.)

---

## 7. Interview-Ready Summary

> *"A struct allocates separate memory for each member — it's a record.
> A union overlays all members on the same memory — one storage, multiple
> views; only the last-written member is valid. In embedded, structs model
> frames and register maps — watching padding and alignment — and unions
> handle byte-level reinterpretation of protocol data and RAM-efficient
> variant messages, always paired with a type tag. For portability across
> compilers, protocol bit layouts use explicit masks and shifts rather than
> bit-fields, and multi-byte values are assembled with explicit shifts so
> decoding never depends on host endianness."*

### Quick self-test answers

| Question | Answer |
|---|---|
| `sizeof(struct {uint8_t a; uint32_t b; uint8_t c;})` | 12 (1 + 3 pad + 4 + 1 + 3 pad) |
| Same struct reordered biggest-first | 8 |
| `sizeof(struct {uint8_t a; double b; uint16_t c;})` | 24 (double forces 7 pad bytes + trailing) |
| Union of `{uint8_t; uint32_t}` | 4 |
| Why check a tag before union access? | No compiler protection — wrong member reads fail silently |
| Bit-fields for CAN parsing on 2 MCUs? | No — layout not portable; use masks/shifts |
| `(float)0x3F800000` vs union reinterpret | 1065353216.0 (convert) vs 1.0 (reinterpret) |

---

## 8. Exercises That Built These Notes

1. **Padding prediction** — predict `sizeof` for 4 struct layouts, verify with `offsetof()`, draw memory maps.
2. **Union reinterpretation lab** — floats ↔ hex bit patterns; IEEE-754 special values (`0x7F800000` = +∞); reinterpret vs convert with integer 42.
3. **Endianness detective** — reproduce the big-endian garbage decode; write portable `be_bytes_to_float()`; detect host endianness via union.
4. **Tagged union** — 4-message-type queue + dispatcher; silent-garbage bug; assert-guard fix; sizeof analysis.
5. **Bit-fields vs masks** — same control byte both ways; decode `0xB8`; truncation experiment; portability write-up.

*All code verified on GCC/x86-64. Your target may differ — that's what `offsetof()` is for.*
