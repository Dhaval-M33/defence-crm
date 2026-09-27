export class QuantityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuantityInputError";
  }
}

/**
 * Reads a quantity out of a form field. A blank field is refused rather than
 * being coerced to 0, because `Number("")` is 0 and that silently wrote a
 * zero-quantity row to the database.
 */
export function parseQuantity(
  raw: unknown,
  label: string,
  options?: { positive?: boolean },
): number {
  if (typeof raw !== "string") {
    if (raw === null || raw === undefined) {
      throw new QuantityInputError(label + " is empty. Enter a number before saving.");
    }
    throw new QuantityInputError(label + " must be a number.");
  }

  const text = raw.trim();
  if (text === "") {
    throw new QuantityInputError(label + " is empty. Enter a number before saving.");
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new QuantityInputError(label + ' must be a number, but was "' + text + '".');
  }
  if (!Number.isInteger(value)) {
    throw new QuantityInputError(label + ' must be a whole number, but was "' + text + '".');
  }
  if (options?.positive === true) {
    if (value <= 0) {
      throw new QuantityInputError(label + " must be greater than zero.");
    }
  } else if (value < 0) {
    throw new QuantityInputError(label + " cannot be negative.");
  }

  return value;
}
