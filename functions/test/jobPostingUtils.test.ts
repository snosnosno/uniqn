import { expect } from "chai";

const {
  buildJobPostingSearchIndex,
  formatJobPostingLocation,
  getChangedJobPostingNotificationFields,
  hasJobPostingSearchIndexSourceChanged,
} = require("../src/utils/jobPosting") as typeof import("../src/utils/jobPosting");

describe("job posting utils", () => {
  it("formats V3 location objects into a string", () => {
    expect(
      formatJobPostingLocation({
        name: "Seoul Station",
        district: "Yongsan-gu",
        detailedAddress: "1F",
      }),
    ).to.equal("Seoul Station Yongsan-gu");
  });

  it("builds a V3 searchIndex without object-stringifying location", () => {
    const searchIndex = buildJobPostingSearchIndex({
      title: "VIP Dealer Wanted",
      description: "Main tournament floor",
      location: {
        name: "Seoul Casino",
        district: "Gangnam-gu",
      },
      roleCatalog: [
        { role: "dealer" },
        { role: "other", customRole: "Poker Host" },
      ],
    });

    expect(searchIndex).to.include.members([
      "vip",
      "dealer",
      "wanted",
      "main",
      "tournament",
      "floor",
      "seoul",
      "casino",
      "gangnam-gu",
      "poker",
      "host",
    ]);
    expect(searchIndex).to.not.include("[object");
    expect(searchIndex).to.not.include("object]");
  });

  it("detects V3 notification field changes and ignores unrelated updates", () => {
    const changedFields = getChangedJobPostingNotificationFields(
      {
        title: "기존 공고",
        location: { name: "서울", district: "강남구" },
        workDate: "2026-03-20",
        schedule: {
          kind: "dated",
          primaryDate: "2026-03-20",
          allDates: ["2026-03-20"],
          requirements: [],
        },
        compensation: {
          mode: "shared",
          defaultSalary: { type: "daily", amount: 150000 },
        },
        updatedAt: "before",
      },
      {
        title: "기존 공고",
        location: { name: "서울", district: "강남구" },
        workDate: "2026-03-20",
        schedule: {
          kind: "dated",
          primaryDate: "2026-03-21",
          allDates: ["2026-03-21"],
          requirements: [],
        },
        compensation: {
          mode: "shared",
          defaultSalary: { type: "daily", amount: 160000 },
        },
        updatedAt: "after",
      },
    );

    expect(changedFields).to.deep.equal(["schedule", "compensation"]);
  });

  it("detects searchIndex source changes and ignores counter-only updates", () => {
    const before = {
      title: "Tournament Posting",
      description: "Main floor",
      location: { name: "Seoul", district: "Gangnam-gu" },
      roleCatalog: [{ role: "dealer" }],
      stats: { totalApplicants: 1 },
    };
    const afterCounterOnly = {
      ...before,
      stats: { totalApplicants: 2 },
    };
    const afterSearchSourceChange = {
      ...before,
      description: "Main floor updated",
    };

    expect(hasJobPostingSearchIndexSourceChanged(before, afterCounterOnly)).to.equal(false);
    expect(hasJobPostingSearchIndexSourceChanged(before, afterSearchSourceChange)).to.equal(true);
  });
});
