# Code and diagrams

## JavaScript

```javascript
// A highlighted function
const greet = (name) => `Hello, ${name}!`;
console.log(greet("World"));
```

## Python

```python
def square(value: int) -> int:
    return value ** 2
print(square(7))
```

## Flowchart

```mermaid
flowchart LR
  A[Markdown 文档] --> B{Valid?}
  B -->|Yes| C[PDF]
  B -->|No| D[Edit]
  D --> A
```

## Sequence

```mermaid
sequenceDiagram
  participant User
  participant Browser
  User->>Browser: Open Markdown
  Browser-->>User: Preview
  User->>Browser: Export PDF
```

## Plain text fallback

```unknown-language
<script>Not executable</script>
```

Inline math still works: $E=mc^2$.
