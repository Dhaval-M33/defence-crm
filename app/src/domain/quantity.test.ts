import { describe, expect, test } from "vitest";

import { QuantityInputError, parseQuantity } from "./quantity";

describe("parseQuantity", () => {
  test("reads an ordinary whole number", () => {
    expect(parseQuantity("600", "Quantity")).toBe(600);
    expect(parseQuantity(" 1000 ", "Quantity")).toBe(1000);
  });

  test("an empty field is refused instead of becoming zero", () => {
    expect(() => parseQuantity("", "Quantity")).toThrow(QuantityInputError);
    expect(() => parseQuantity("", "Quantity")).toThrow(/is empty/);
    expect(() => parseQuantity(null, "Quantity")).toThrow(/is empty/);
    expect(() => parseQuantity(undefined, "Quantity")).toThrow(/is empty/);
    expect(() => parseQuantity("   ", "Quantity")).toThrow(/is empty/);
  });

  test("zero is refused where a positive quantity is required", () => {
    expect(() => parseQuantity("0", "Quantity", { positive: true })).toThrow(/greater than zero/);
    expect(parseQuantity("0", "Supply")).toBe(0);
  });

  test("a fractional quantity is refused", () => {
    expect(() => parseQuantity("2.5", "Quantity")).toThrow(/whole number/);
  });

  test("a negative quantity is refused", () => {
    expect(() => parseQuantity("-5", "Quantity")).toThrow(/cannot be negative/);
  });

  test("text that is not a number is refused and quoted back", () => {
    expect(() => parseQuantity("abc", "Quantity")).toThrow(/must be a number/);
  });
});
