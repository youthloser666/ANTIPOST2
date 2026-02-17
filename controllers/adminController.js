const prisma = require('../config/prisma');
const cloudinary = require('../config/cloudinary');

exports.getStats = async (req, res) => {
    try {
        const [pCount, cwCount, pRecent, cwRecent] = await Promise.all([
            prisma.personals.count().catch(() => 0),
            prisma.comission_works.count().catch(() => 0),
            prisma.personals.findMany({ take: 5, orderBy: { id: 'desc' } }),
            prisma.comission_works.findMany({ take: 5, orderBy: { id: 'desc' } })
        ]);
        res.json({
            counts: { personals: pCount, comission_works: cwCount },
            recent: { personals: pRecent, comission_works: cwRecent }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getWmConfig = async (req, res) => {
    try {
        const admins = await prisma.$queryRaw`SELECT wm_text FROM admin_config LIMIT 1`;
        if (admins.length > 0) {
            res.json({ wm_text: admins[0].wm_text || '' });
        } else {
            res.json({ wm_text: '' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateWmConfig = async (req, res) => {
    const { wm_text } = req.body;
    try {
        await prisma.$executeRaw`UPDATE admin_config SET wm_text = ${wm_text} WHERE id = (SELECT id FROM admin_config LIMIT 1)`;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.bulkDelete = async (req, res) => {
    const { ids, category } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Tidak ada ID yang dipilih' });
    }

    const table = category === 'personal' ? 'personals' : 'comission_works';

    try {
        const items = await prisma[table].findMany({
            where: { id: { in: ids.map(Number) } }
        });

        for (const item of items) {
            if (item.public_id) await cloudinary.uploader.destroy(item.public_id);
        }

        const result = await prisma[table].deleteMany({
            where: { id: { in: ids.map(Number) } }
        });

        res.json({ success: true, count: result.count });
    } catch (error) {
        console.error("Bulk Delete Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getConfig = (req, res) => {
    res.json({
        cloudName: process.env.CLOUD_NAME,
        uploadPreset: process.env.UPLOAD_PRESET || 'ml_default',
        apiKey: process.env.API_KEY
    });
};