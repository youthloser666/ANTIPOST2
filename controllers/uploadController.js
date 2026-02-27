const sharp = require('sharp');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');
const prisma = require('../config/prisma');

// Buat SVG watermark dengan drop shadow
function createWatermarkSvg(text, imgWidth) {
    const fontSize = Math.max(16, Math.floor(imgWidth * 0.025));
    const paddingX = Math.floor(fontSize * 1.5);
    const paddingY = Math.floor(fontSize * 1.2);
    const svgWidth = text.length * fontSize * 0.65 + paddingX * 2;
    const svgHeight = fontSize + paddingY * 2;

    return Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
            <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.7"/>
                </filter>
            </defs>
            <text
                x="50%" y="50%"
                dominant-baseline="central"
                text-anchor="middle"
                font-family="Arial, Helvetica, sans-serif"
                font-size="${fontSize}px"
                font-weight="bold"
                fill="rgba(255,255,255,0.6)"
                filter="url(#shadow)"
            >${text}</text>
        </svg>
    `);
}

exports.uploadImage = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        // 1. Ambil config watermark dari database
        let wmText = '';
        try {
            const admins = await prisma.$queryRaw`SELECT wm_text FROM admin_config LIMIT 1`;
            if (admins.length > 0 && admins[0].wm_text) {
                wmText = admins[0].wm_text;
            }
        } catch (dbErr) {
            console.warn("[Upload] Gagal ambil watermark config, lanjut tanpa watermark:", dbErr.message);
        }

        // 2. Resize gambar terlebih dahulu
        let pipeline = sharp(req.file.buffer)
            .resize({ width: 2000, withoutEnlargement: true });

        // 3. Composite watermark jika ada teks
        if (wmText) {
            const metadata = await sharp(req.file.buffer).metadata();
            const imgWidth = Math.min(metadata.width || 2000, 2000);
            const watermarkSvg = createWatermarkSvg(wmText, imgWidth);

            pipeline = pipeline.composite([{
                input: watermarkSvg,
                gravity: 'southeast'
            }]);
        }

        // 4. Convert ke WebP
        const processedBuffer = await pipeline
            .toFormat('webp', { quality: 80 })
            .toBuffer();

        // 5. Upload ke Cloudinary
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'portofolio_kita' },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            const stream = new Readable();
            stream.push(processedBuffer);
            stream.push(null);
            stream.pipe(uploadStream);
        });

        res.json({ imageUrl: result.secure_url, public_id: result.public_id });
    } catch (error) {
        console.error("[Upload] Processing Error:", error);
        res.status(500).json({ error: `Processing Error: ${error.message}` });
    }
};
