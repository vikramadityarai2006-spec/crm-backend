const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { auth, adminOnly } = require("../middleware/auth");
const prisma = new PrismaClient();

router.get("/", auth, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id:true, name:true, email:true, role:true, active:true, createdAt:true }
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hashed, role } });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, role, active } = req.body;
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { name, role, active }
    });
    res.json({ id: user.id, name: user.name, role: user.role, active: user.active });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
