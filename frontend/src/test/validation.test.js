import { describe, expect, it } from "vitest";
import { validateLogin, validatePassword, validateRegister, validateRequest } from "../validation";

describe("validateLogin", () => {
  it("requires email and password", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });
  it("rejects a malformed email", () => {
    expect(validateLogin({ email: "abc@", password: "x" }).email).toMatch(/valid email/);
  });
  it("accepts valid input", () => {
    expect(validateLogin({ email: "a@uni.edu.ng", password: "x" })).toEqual({});
  });
});

describe("validatePassword / validateRegister", () => {
  it("enforces 8+ characters with letters and numbers", () => {
    expect(validatePassword("short1")).toBeTruthy();
    expect(validatePassword("lettersonly")).toBeTruthy();
    expect(validatePassword("12345678")).toBeTruthy();
    expect(validatePassword("Secret123")).toBeNull();
  });
  it("checks that passwords match", () => {
    const e = validateRegister({ full_name: "Ada Obi", email: "ada@uni.edu", password: "Secret123", confirm: "Secret124" });
    expect(e).toEqual({ confirm: "Passwords do not match." });
  });
});

describe("validateRequest", () => {
  const good = { title: "Broken socket", category_id: "1", location: "Hall 2", description: "Sparks when used" };
  it("passes a complete request", () => {
    expect(validateRequest(good)).toEqual({});
  });
  it("flags every missing field", () => {
    expect(Object.keys(validateRequest({}))).toEqual(["title", "category_id", "location", "description"]);
  });
  it("rejects non-image files and oversized images", () => {
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    expect(validateRequest(good, [pdf]).files).toMatch(/not a JPG/);
    const big = new File([new Uint8Array(4 * 1024 * 1024)], "big.png", { type: "image/png" });
    expect(validateRequest(good, [big]).files).toMatch(/larger than 3 MB/);
  });
  it("limits the number of photos to 5", () => {
    const imgs = Array.from({ length: 6 }, (_, i) => new File(["x"], `p${i}.png`, { type: "image/png" }));
    expect(validateRequest(good, imgs).files).toMatch(/at most 5/);
  });
});
