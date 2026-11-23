import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
try {
  const v =
    (await p.venue.findUnique({ where: { slug: "myrestaurant" } })) ||
    (await p.venue.findUnique({ where: { slug: "my-restaurant" } })) ||
    (await p.venue.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!v) {
    console.log("no venue");
  } else if (v.slug !== "myrestaurant") {
    await p.venue.update({
      where: { id: v.id },
      data: { slug: "myrestaurant" },
    });
    console.log(`renamed ${v.slug} -> myrestaurant`);
  } else {
    console.log("already myrestaurant");
  }
} finally {
  await p.$disconnect();
}
