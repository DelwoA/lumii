import { describe, it, expect } from "vitest";
import { orderEmbeddings } from "./embed-response";

const v = (n: number) => [n, n + 0.5]; // a 2-dim vector

describe("orderEmbeddings", () => {
  it("returns vectors in input order when already ordered", () => {
    const data = [
      { index: 0, embedding: v(0) },
      { index: 1, embedding: v(1) },
    ];
    expect(orderEmbeddings(data, 2, 2)).toEqual([v(0), v(1)]);
  });

  it("reorders an unordered response by index", () => {
    const data = [
      { index: 1, embedding: v(1) },
      { index: 0, embedding: v(0) },
    ];
    expect(orderEmbeddings(data, 2, 2)).toEqual([v(0), v(1)]);
  });

  it("throws when the count does not match", () => {
    expect(() => orderEmbeddings([{ index: 0, embedding: v(0) }], 2, 2)).toThrow();
    expect(() => orderEmbeddings("nope", 1, 2)).toThrow();
  });

  it("throws on a missing, duplicate, or out-of-range index", () => {
    expect(() =>
      orderEmbeddings([{ embedding: v(0) }, { index: 1, embedding: v(1) }], 2, 2),
    ).toThrow();
    expect(() =>
      orderEmbeddings(
        [
          { index: 0, embedding: v(0) },
          { index: 0, embedding: v(1) },
        ],
        2,
        2,
      ),
    ).toThrow();
    expect(() =>
      orderEmbeddings([{ index: 5, embedding: v(0) }], 1, 2),
    ).toThrow();
  });

  it("throws on a wrong dimension or non-finite values", () => {
    expect(() =>
      orderEmbeddings([{ index: 0, embedding: [1, 2, 3] }], 1, 2),
    ).toThrow();
    expect(() =>
      orderEmbeddings([{ index: 0, embedding: [1, NaN] }], 1, 2),
    ).toThrow();
    expect(() =>
      orderEmbeddings([{ index: 0, embedding: [1, Infinity] }], 1, 2),
    ).toThrow();
  });
});
