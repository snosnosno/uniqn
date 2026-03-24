import { expect } from "chai";
import { parseCleanupNotificationIds } from "../src/notifications/resetUnreadCounter";
import { ValidationError } from "../src/errors";

describe("parseCleanupNotificationIds", () => {
  it("returns an empty list when ids are omitted", () => {
    expect(parseCleanupNotificationIds(undefined)).to.deep.equal([]);
    expect(parseCleanupNotificationIds(null)).to.deep.equal([]);
  });

  it("deduplicates and trims notification ids", () => {
    expect(parseCleanupNotificationIds([" one ", "two", "one"])).to.deep.equal([
      "one",
      "two",
    ]);
  });

  it("rejects non-array payloads", () => {
    expect(() => parseCleanupNotificationIds("not-an-array")).to.throw(ValidationError);
  });

  it("rejects blank notification ids", () => {
    expect(() => parseCleanupNotificationIds(["valid", "   "])).to.throw(ValidationError);
  });

  it("rejects oversized batches", () => {
    const ids = Array.from({ length: 501 }, (_, index) => `notif-${index}`);

    expect(() => parseCleanupNotificationIds(ids)).to.throw(ValidationError);
  });
});
