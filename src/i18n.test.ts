import { describe, expect, it } from "vitest";
import { getDirection, getMessages } from "./i18n";
describe("localization foundation", () => {
  it("provides Arabic and English copy", () => {
    expect(getMessages("ar").brand).toBe("ورقتي");
    expect(getMessages("en").brand).toBe("Waraqati");
  });
  it("selects the correct text direction", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
  });
  it("offers a language switch label in each locale", () => {
    expect(getMessages("ar").language).toBe("English");
    expect(getMessages("en").language).toBe("العربية");
  });
});