# Pointers, Function Pointers, and Callbacks: The C Foundations Behind Embedded Drivers

## Why This Matters Before You Ever Touch a Peripheral

Every embedded driver you'll ever read — SPI, UART, I²C, CAN — leans on three C concepts underneath the protocol logic: pointers, function pointers, and callbacks. Skip past these, and driver code looks like a wall of arrows and unfamiliar syntax. Understand them properly, and the same code reads as a small number of repeating, predictable patterns.

This article builds each concept up from first principles, then ties them together the way they actually show up in a real driver: a completion callback firing after an SPI transfer finishes.

## 1. Pointers: A Variable That Stores an Address

A normal variable stores a value. A pointer stores an **address** — the location in memory where a value lives.

```c
int value = 25;
int *ptr = &value;
```

```
Memory:

Address        Contents
0x1000    →    25            ← 'value' lives here
0x2004    →    0x1000        ← 'ptr' lives here, storing value's address

value  = 25
ptr    = 0x1000   (points AT value)
*ptr   = 25       (dereferencing ptr gives you what's AT that address)
```

**`&`** (address-of) asks: *where does this live?*
**`*`** (dereference) asks: *what's stored at that address?*

```c
*ptr = 50;   // follows ptr to 0x1000, changes value to 50
```

### Why Embedded Code Leans on This So Heavily

Pointers aren't just a C quirk — they're how embedded software touches the physical world. Memory-mapped registers, communication buffers, DMA memory, and device state structures are all accessed through pointers, because the hardware itself is just addresses in the microcontroller's memory map.

### Passing by Address

C passes arguments by value by default — a function gets a *copy*, and changes to that copy don't touch the caller's original.

```
Pass by value:                     Pass by address:

set_value(x)                       set_value(&value)
   │                                   │
   ▼                                   ▼
x = COPY of value                  x = ADDRESS of value
Changing x does NOT                Changing *x DOES change
affect the caller's value          the caller's original value
```

```c
void set_value(int x)   { x = 50; }        // caller's value: unchanged
void set_value(int *x)  { *x = 50; }       // caller's value: changed
```

That's why driver functions almost always take pointers to structures — the function needs to modify the caller's actual device state, not a throwaway copy of it.

### Structure Pointers

```c
typedef struct {
    int state;
    int error;
} device_t;

void reset_device(device_t *device) {
    device->state = 0;   // shorthand for (*device).state = 0;
    device->error = 0;
}
```

```
device_t struct in memory:          device pointer:

┌─────────────┐                    device ──► points to the
│ state: 0    │  ◄──────────────────           struct above
│ error: 0    │
└─────────────┘

device->state   is shorthand for   (*device).state
```

## 2. Function Pointers: A Variable That Stores a Function's Address

Just like a normal pointer stores the address of a variable, a **function pointer** stores the address of a *function*.

The key distinction that trips people up first:

```c
on_spi_done;     // refers to the function itself (its address)
on_spi_done();   // CALLS the function immediately
```

```c
void on_spi_done(void) { /* ... */ }

void (*callback)(void) = on_spi_done;   // callback now HOLDS the address

callback();       // NOW it's called
```

**Reading the declaration:**

```
void (*callback)(void);

  │      │        │
  │      │        └── takes no arguments
  │      └── callback is a POINTER to a function
  └── that function returns void
```

The parentheses around `*callback` aren't decorative — function-call syntax binds tighter than the pointer declaration, so without them the meaning changes entirely.

## 3. Callbacks: Storing a Function to Be Called Later

A callback is simply a function pointer that gets **stored now, and called later** — usually by lower-level driver code, once some event has completed.

```
Callback flow:

Application            Driver                   Hardware
────────────           ──────                   ────────
starts SPI transfer ──► begins transfer  ──►  clocks bits out
                         (not blocking)

                                                clocks finish
                                                        │
                         driver notices ◄───────────────┘
                         transfer done
                              │
                              ▼
                    calls stored callback
                              │
                              ▼
              application's on_spi_done() runs
```

### Storing a Callback in a Config Struct

```c
typedef struct {
    void (*done)(void);
} spi_config_t;

spi_config_t config = {
    .done = on_spi_done     // stores the ADDRESS, does not call it
};

// ... later, once the transfer finishes ...
config.done();               // NOW it's called
```

This is the exact mechanism that lets driver code notify application code without the driver ever needing to know the application function's name at compile time.

## 4. Function-Pointer Interfaces

A struct can hold *several* function pointers, effectively creating a swappable interface:

```c
typedef struct {
    void (*start)(void);
    void (*stop)(void);
    void (*done)(void);
} spi_interface_t;
```

```
spi_interface_t "spi"
┌──────────────────────────────┐
│ start ──► spi_start_handler  │
│ stop  ──► spi_stop_handler   │
│ done  ──► on_spi_done        │
└──────────────────────────────┘

Calling code just does:
    spi.start();
    spi.stop();

...without knowing which real implementation
is behind those function pointers.
```

This is what makes it possible to swap a real SPI driver for a simulated one, or a mock test driver, without changing a single line of the code that calls `spi.start()` — as long as every implementation fills in the same three function pointers.

## 5. Context Pointers: Telling a Shared Callback *Which* Device Fired It

A single callback function is often reused across multiple device instances. Without extra information, that callback has no way to know *which* device just finished.

```c
typedef void (*done_callback_t)(void *context);

void on_done(void *context) {
    device_t *device = context;   // context tells us WHICH device
    device->state = DONE;
}
```

```
Device A                    Device B
   │                            │
   │ finishes                  │ finishes
   ▼                            ▼
on_done(&deviceA)          on_done(&deviceB)
   │                            │
   ▼                            ▼
deviceA.state = DONE       deviceB.state = DONE

Same callback function, different context each time.
```

## 6. Two Safety Rules Worth Internalizing

**Check optional callbacks before calling them.**

```c
if (config.done != NULL) {
    config.done();
}
```

Calling through a NULL function pointer is undefined behavior — the same danger as dereferencing a NULL data pointer.

**Match the function signature exactly.**

```c
void f(void);
int  g(int value);
```

These are different types. Assigning a function to a function-pointer variable with an incompatible signature is a real bug, not a style nitpick — the compiler and calling convention rely on the signature matching.

## Putting It All Together: A Real SPI Completion Flow

```
1. Application configures the transfer and registers a callback:

     spi_config_t config = { .done = on_spi_done };

2. Driver starts the transfer (non-blocking):

     spi.start();

3. Hardware clocks the bits out. Application keeps running —
   it is NOT blocked waiting.

4. Hardware/driver detects transfer completion.

5. Driver checks the callback isn't NULL, then calls it:

     if (config.done != NULL) { config.done(); }

6. Application's on_spi_done() runs, using a context pointer
   if multiple devices share the same callback function.
```

This is the same pattern — store an address now, call it later, pass context so the callback knows what fired it — that shows up again and again across UART interrupt handlers, I²C completion routines, timer expiry handlers, and ADC conversion-complete events. Once you can trace this flow for one peripheral, you can trace it for all of them.

## The Interview-Ready Summary

A pointer stores an address rather than a value, which is what lets a function modify a caller's actual data instead of a disposable copy — this is why embedded drivers pass structs by pointer almost everywhere. A function pointer extends the same idea to code itself: it stores a function's address rather than calling it, which is the difference between `on_spi_done` and `on_spi_done()`. A callback is just a function pointer that gets stored now and invoked later, usually by driver code once a hardware event — a completed transfer, a received byte, an expired timer — has occurred. Structs of function pointers turn this into a full interface, letting the same calling code work against a real driver, a simulated driver, or a mock, as long as each fills in the same function pointers. And when multiple devices share one callback function, a context pointer is what tells that shared callback which specific device it's being called on behalf of.

That's the mental model I'd want ready before an interviewer asks me to walk through how a driver notifies application code that a transfer just finished.
