const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { auth, recruiterOrAdmin, adminOnly } = require("../middleware/auth");
const prisma = new PrismaClient();

const toDate = (v) => {
  if (!v || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const buildCandidate = (body) => ({
  clientName:           body.client || body.clientName || null,
  designation:          body.designation || null,
  location:             body.location || null,
  candidateName:        body.name || body.candidateName || "",
  actualDOJ:            toDate(body.actualDOJ),
  offerMonth:           toDate(body.offerMonth),
  phone:                body.phone ? String(body.phone) : null,
  resignationAcceptance: body.resignationAcceptance || null,
  proposedDOJ:          toDate(body.proposedDOJ),
  ownerName:            body.owner || body.ownerName || null,
  joiningStatus:        body.joiningStatus || null,
  ctcPerMonth:          body.ctc || body.ctcPerMonth ? parseFloat(body.ctc || body.ctcPerMonth) : null,
  statusCode:           body.statusCode || null,
  notes:                body.notes || null,
});

// ─── GET ALL ──────────────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const {
      search, client, owner, status, statusCode,
      location, page = 1, limit = 50, sortBy = "id", sortDir = "asc"
    } = req.query;

    const where = { deleted: false };
    if (search) {
      where.OR = [
        { candidateName: { contains: search, mode: "insensitive" } },
        { clientName:    { contains: search, mode: "insensitive" } },
        { designation:   { contains: search, mode: "insensitive" } },
        { phone:         { contains: search, mode: "insensitive" } },
        { ownerName:     { contains: search, mode: "insensitive" } },
      ];
    }
    if (client)     where.clientName    = { contains: client, mode: "insensitive" };
    if (owner)      where.ownerName     = { contains: owner, mode: "insensitive" };
    if (status)     where.joiningStatus = { contains: status, mode: "insensitive" };
    if (statusCode) where.statusCode    = statusCode;
    if (location)   where.location      = { contains: location, mode: "insensitive" };

    const [total, candidates] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
    ]);

    res.json({ candidates, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET ONE ──────────────────────────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const c = await prisma.candidate.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!c || c.deleted) return res.status(404).json({ error: "Not found" });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post("/", auth, recruiterOrAdmin, async (req, res) => {
  try {
    const data = { ...buildCandidate(req.body), createdById: req.user.id };
    const candidate = await prisma.candidate.create({ data });
    await prisma.auditLog.create({
      data: {
        action: "Created", recordName: candidate.candidateName,
        detail: `Client: ${candidate.clientName}, Status: ${candidate.joiningStatus}`,
        userId: req.user.id, candidateId: candidate.id,
      },
    });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────
router.put("/:id", auth, recruiterOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const candidate = await prisma.candidate.update({
      where: { id },
      data: buildCandidate(req.body),
    });
    await prisma.auditLog.create({
      data: {
        action: "Updated", recordName: candidate.candidateName,
        detail: `Status: ${candidate.joiningStatus}`,
        userId: req.user.id, candidateId: candidate.id,
      },
    });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SOFT DELETE ──────────────────────────────────────────────────────────────
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const candidate = await prisma.candidate.update({
      where: { id }, data: { deleted: true },
    });
    await prisma.auditLog.create({
      data: {
        action: "Deleted", recordName: candidate.candidateName,
        detail: "Soft deleted", userId: req.user.id, candidateId: id,
      },
    });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BULK IMPORT ──────────────────────────────────────────────────────────────
router.post("/bulk/import", auth, adminOnly, async (req, res) => {
  try {
    const { candidates } = req.body;
    if (!Array.isArray(candidates)) return res.status(400).json({ error: "candidates array required" });

    let imported = 0, skipped = 0, errors = [];

    for (const row of candidates) {
      try {
        if (!row.candidateName && !row.name) { skipped++; continue; }
        await prisma.candidate.create({
          data: { ...buildCandidate(row), createdById: req.user.id },
        });
        imported++;
      } catch (e) {
        skipped++;
        errors.push({ name: row.candidateName || row.name, error: e.message });
      }
    }

    await prisma.auditLog.create({
      data: {
        action: "Bulk Import", recordName: "Multiple",
        detail: `Imported: ${imported}, Skipped: ${skipped}`,
        userId: req.user.id,
      },
    });

    res.json({ imported, skipped, errors: errors.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
