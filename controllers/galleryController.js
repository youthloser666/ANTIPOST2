const prisma = require('../config/prisma');
const cloudinary = require('../config/cloudinary');

// --- Personals ---
exports.getPersonals = async (req, res) => {
    try {
        const data = await prisma.personals.findMany({ orderBy: { id: 'desc' } });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPersonalById = async (req, res) => {
    try {
        const data = await prisma.personals.findUnique({
            where: { id: Number(req.params.id) }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createPersonal = async (req, res) => {
    try {
        const { name, description, image_path, public_id } = req.body;
        console.log("Inserting Personal:", { name, image_path, public_id });
        const result = await prisma.personals.create({
            data: { name, description, image_path, public_id }
        });
        res.json(result);
    } catch (error) {
        console.error("Error Detail:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.updatePersonal = async (req, res) => {
    try {
        const { name, description, image_path, public_id } = req.body;
        const result = await prisma.personals.update({
            where: { id: Number(req.params.id) },
            data: { name, description, image_path, public_id }
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePersonal = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.personals.findUnique({ where: { id } });
        if (item?.public_id) {
            await cloudinary.uploader.destroy(item.public_id);
        }
        await prisma.personals.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Comission Works ---
exports.getComissions = async (req, res) => {
    try {
        const data = await prisma.comission_works.findMany({ orderBy: { id: 'desc' } });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getComissionById = async (req, res) => {
    try {
        const data = await prisma.comission_works.findUnique({
            where: { id: Number(req.params.id) }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createComission = async (req, res) => {
    try {
        const { title, description, image_path, public_id } = req.body;
        const created = await prisma.comission_works.create({
            data: { title, description, image_path, public_id }
        });
        res.json({ success: true, data: created });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateComission = async (req, res) => {
    try {
        const { title, description, image_path, public_id } = req.body;
        const updated = await prisma.comission_works.update({
            where: { id: parseInt(req.params.id) },
            data: { title, description, image_path, public_id }
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteComission = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.comission_works.findUnique({ where: { id } });
        if (item?.public_id) {
            await cloudinary.uploader.destroy(item.public_id);
        }
        await prisma.comission_works.delete({ where: { id } });
        res.json({ success: true, message: 'Berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};