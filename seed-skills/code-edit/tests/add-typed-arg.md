# Sample code-edit task

## Task
Add a TypeScript type annotation to the parameter `n` so it is explicitly `number`,
and update the function to handle the case where `n < 0` by returning 0.

## File: example.ts
```ts
export function double(n) {
  return n * 2;
}
```

## Expected output shape
A unified diff that:
- Annotates `n` as `number`
- Adds a guard that returns 0 when `n < 0`
- Preserves the existing return path otherwise
