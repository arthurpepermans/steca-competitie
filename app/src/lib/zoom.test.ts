import { expect, it } from "vitest";
import { blokkeerKnijpzoom } from "./zoom";

it("laat één vinger scrollen en blokkeert alleen meervingerzoom", () => {
  const doel = new EventTarget();
  const opruimen = blokkeerKnijpzoom(doel);
  for (const aantal of [1, 2, 3]) {
    const event = new Event("touchmove", { cancelable: true });
    Object.defineProperty(event, "touches", { value: Array(aantal).fill({}) });
    doel.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(aantal > 1);
  }
  for (const naam of ["gesturestart", "gesturechange"]) {
    const event = new Event(naam, { cancelable: true });
    doel.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  opruimen();
  const event = new Event("gesturestart", { cancelable: true });
  doel.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
