# Your title here (this becomes the page heading)

Delete everything above and below and write. This file shows every building
block you have. Copy it, rename it (e.g. posts/spi-vs-i2c-vs-uart.md),
and register the new name in data.js.

The first `# ` line is your title — the reader page pulls it out
automatically. Everything after it is the article.

## A section heading

Normal paragraph. Write like you talk. **Bold for the thing that clicked.**
*Italic for asides.* Inline code looks like `0xFF` or `MOSI`.

## Images

Put the file in posts/img/ first (GitHub web → Add file → upload works),
then reference it relative to posts/:

![a short caption — it shows up under the image](img/your-photo.png)

## Code

Triple backticks with a language name get syntax highlighting:

```c
/* function pointer — the "aha" version */
void (*send_frame)(uint32_t id, uint8_t *data) = can_send;
send_frame(0x123, payload);
```

```python
# python works too
def majority_vote(samples):
    return max(set(samples), key=samples.count)
```

## Callout box (for the "wait, THIS is the key" moment)

> Anything in a blockquote renders as an amber callout card.
> Use it for the one sentence future-you must not forget.

## Tables (great for cheat sheets)

| Protocol | Wires | Clock | Best at |
|----------|-------|-------|---------|
| UART     | TX, RX | none (agreed baud) | debug console |
| I2C      | SDA, SCL | shared | many devices, slow |
| SPI      | MISO, MOSI, SCK, CS | dedicated | fast, one device per CS |

## Lists

- take turns = half-duplex
- both at once = full-duplex

1. numbered
2. works
3. too

## Links

[Link text](https://example.com) opens in a new tab automatically.

## The closing

End however you like. A line of three dashes makes the · · · divider:

---
