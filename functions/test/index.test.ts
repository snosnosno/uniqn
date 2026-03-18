import * as admin from "firebase-admin";
import { expect } from "chai";
import { getDashboardStats } from "../src/index";

describe("Dashboard Functions with Emulator", () => {
  beforeEach(async () => {
    const db = admin.firestore();
    const batch = db.batch();

    const eventsSnap = await db.collection("events").get();
    eventsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    const usersSnap = await db.collection("users").get();
    usersSnap.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    const seedBatch = db.batch();
    const now = new Date();
    const futureDate = new Date(now);
    const pastDate = new Date(now);

    futureDate.setDate(now.getDate() + 5);
    pastDate.setDate(now.getDate() - 5);

    const eventsCol = db.collection("events");
    seedBatch.set(eventsCol.doc("event1"), {
      name: "Ongoing Event",
      endDate: admin.firestore.Timestamp.fromDate(futureDate),
    });
    seedBatch.set(eventsCol.doc("event2"), {
      name: "Past Event",
      endDate: admin.firestore.Timestamp.fromDate(pastDate),
    });

    const usersCol = db.collection("users");
    seedBatch.set(usersCol.doc("staff1"), {
      name: "Jane Smith",
      role: "staff",
      rating: 4.9,
      ratingCount: 15,
    });
    seedBatch.set(usersCol.doc("staff2"), {
      name: "John Doe",
      role: "staff",
      rating: 4.8,
      ratingCount: 10,
    });
    seedBatch.set(usersCol.doc("staff3"), {
      name: "No Rating Staff",
      role: "staff",
      rating: 3.0,
      ratingCount: 1,
    });
    seedBatch.set(usersCol.doc("admin1"), {
      name: "Admin User",
      role: "admin",
    });

    await seedBatch.commit();
  });

  it("returns dashboard stats for an admin user", async () => {
    const result = await getDashboardStats.run({
      data: {},
      auth: { uid: "adminUserId", token: { role: "admin" } },
    } as never);
    const topStaff = result.topRatedStaff[0] as { name?: string; rating?: number };

    expect(result.ongoingEventsCount).to.equal(1);
    expect(result.totalStaffCount).to.equal(3);
    expect(result.topRatedStaff).to.be.an("array").with.lengthOf(3);
    expect(topStaff.name).to.equal("Jane Smith");
    expect(topStaff.rating).to.equal(4.9);
  });

  it("denies access to non-admin users", async () => {
    try {
      await getDashboardStats.run({
        data: {},
        auth: { uid: "staffUserId", token: { role: "staff" } },
      } as never);
      expect.fail("Expected getDashboardStats to reject non-admin access.");
    } catch (error: any) {
      expect(error.code).to.equal("permission-denied");
    }
  });
});
