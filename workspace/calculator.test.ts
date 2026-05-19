import { it, expect } from "bun:test";
import { add, divide } from "./calculator";

it("adds two positive numbers", () => {
  expect(add(1, 2)).toBe(3);
});

it("adds negative and positive numbers", () => {
  expect(add(-1, 5)).toBe(4);
});

it("divides two numbers", () => {
  expect(divide(6, 3)).toBe(2);
});

it("divides resulting in fractional number", () => {
  expect(divide(7, 2)).toBe(3.5);
});

it("throws when dividing by zero", () => {
  expect(() => divide(1, 0)).toThrow();
});
