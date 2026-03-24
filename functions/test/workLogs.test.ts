import { expect } from "chai";
import * as admin from "firebase-admin";
import { __testables } from "../src/triggers/workLogs";

function createWorkLogSnapshot(
  id: string,
  data: Record<string, unknown>,
): admin.firestore.QueryDocumentSnapshot {
  return {
    id,
    data: () => data,
  } as unknown as admin.firestore.QueryDocumentSnapshot;
}

describe("workLog trigger helpers", () => {
  it("matches a unique schedule candidate even after the workLog role changes", () => {
    const expectedWorkLogs = __testables.buildExpectedWorkLogs([
      {
        roleIds: ["dealer"],
        dates: ["2026-04-01"],
        timeSlot: "18:00",
      },
    ]);

    const selected = __testables.selectConfirmationWorkLogs(
      [
        createWorkLogSnapshot("wl-1", {
          assignmentGroupId: null,
          createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z")),
          customRole: null,
          date: "2026-04-01",
          role: "floor",
          timeSlot: "18:00",
          updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-01T11:00:00.000Z")),
        }),
      ],
      expectedWorkLogs,
    );

    expect(selected.map((workLog) => workLog.id)).to.deep.equal(["wl-1"]);
  });

  it("refuses ambiguous schedule-only matches", () => {
    const expectedWorkLogs = __testables.buildExpectedWorkLogs([
      {
        roleIds: ["dealer"],
        dates: ["2026-04-01"],
        timeSlot: "18:00",
      },
    ]);

    const selected = __testables.selectConfirmationWorkLogs(
      [
        createWorkLogSnapshot("wl-1", {
          assignmentGroupId: null,
          createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z")),
          customRole: null,
          date: "2026-04-01",
          role: "floor",
          timeSlot: "18:00",
          updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-01T11:00:00.000Z")),
        }),
        createWorkLogSnapshot("wl-2", {
          assignmentGroupId: null,
          createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-01T10:05:00.000Z")),
          customRole: null,
          date: "2026-04-01",
          role: "manager",
          timeSlot: "18:00",
          updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-01T11:05:00.000Z")),
        }),
      ],
      expectedWorkLogs,
    );

    expect(selected).to.have.length(0);
  });

  it("marks an application completed only when all matched workLogs are done", () => {
    const nextStatus = __testables.resolveApplicationStatusFromWorkLogs([
      createWorkLogSnapshot("wl-1", { status: "checked_out" }),
      createWorkLogSnapshot("wl-2", { status: "no_show" }),
    ]);

    expect(nextStatus).to.equal("completed");
  });
});
