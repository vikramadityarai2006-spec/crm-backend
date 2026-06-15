const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { auth, adminOnly } = require("../middleware/auth");
const prisma = new PrismaClient();

// GET all masters grouped by category
router.get("/", auth, async (req, res) => {
  try {
    const all = await prisma.masterData.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    const codes = await prisma.statusCode.findMany({ where: { active: true } });
    const grouped = {};
    for (const item of all) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item.value);
    }
    res.json({ ...grouped, statusCodes: codes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADD master value
router.post("/", auth, adminOnly, async (req, res) => {
  try {
    const { category, value } = req.body;
    const item = await prisma.masterData.upsert({
      where: { category_value: { category, value } },
      update: { active: true },
      create: { category, value },
    });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE master value
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    await prisma.masterData.update({
      where: { id: parseInt(req.params.id) }, data: { active: false },
    });
    res.json({ message: "Deactivated" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
