# TypeScript Exercise ![icon](icon.png)

## Arrays and Tuples

### Arrays

- **Type Declaration**: Arrays can be declared with explicit types (e.g., `string[]`, `number[]`)
- **Readonly Arrays**: Arrays can be marked as `readonly` to prevent modifications
- **Type Inference**: TypeScript can infer array types when values are provided

### Tuples

- **Definition**: Tuples are typed arrays with a fixed number of elements, where each element can have a different type
- **Structure**: Types are defined at declaration time (e.g., `[string, number, boolean]`)
- **Readonly Tuples**: Tuples can also be marked as `readonly` for immutability

### Example: Array with forEach

Working with number arrays and mathematical operations:

```typescript
const arrNum: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

const powNum = (num: number): void => {
    console.log(Math.pow(num, 2));
};

arrNum.forEach(powNum);
// Example output: 1, 4, 9, 16, 25, 36, 49, 64, 81, 0
```

## Check Color Mode

- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
