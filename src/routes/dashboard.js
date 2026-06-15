const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const prisma = new PrismaClient();

router.get("/", auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfNext  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNext    = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const base = { deleted: false };

    const [total, joined, offered, resPending, thisMonth, nextMonth] = await Promise.all([
      prisma.candidate.count({ where: base }),
      prisma.candidate.count({ where: { ...base, joiningStatus: { in: ["Joined","joined"] } } }),
      prisma.candidate.count({ where: { ...base, joiningStatus: { in: ["Offered","offered","Ofered","Offerd"] } } }),
      prisma.candidate.count({ where: { ...base, resignationAcceptance: { in: ["Pending","pending","Pendng"] } } }),
      prisma.candidate.count({ where: { ...base, actualDOJ: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.candidate.count({ where: { ...base, proposedDOJ: { gte: startOfNext, lte: endOfNext } } }),
    ]);

    const statusGroups = await prisma.candidate.groupBy({
      by: ["joiningStatus"], where: base, _count: true,
    });
    const clientGroups = await prisma.candidate.groupBy({
      by: ["clientName"], where: base, _count: true,
      orderBy: { _count: { clientName: "desc" } }, take: 10,
    });

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const count = await prisma.candidate.count({ where: { ...base, actualDOJ: { gte: start, lte: end } } });
      months.push({ label: start.toLocaleString("en-IN", { month: "short", year: "2-digit" }), value: count });
    }

    res.json({ total, joined, offered, resPending, thisMonth, nextMonth, statusGroups, clientGroups, months });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
