require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const users = [
    {
        username: 'aldo_dev',
        password: process.env.DEFAULT_PASSWORD,
        pin: process.env.DEFAULT_PIN,
        displayName: 'Aldo Dev'
    },
    {
        username: 'antipost',
        password: process.env.DEFAULT_PASSWORD,
        pin: process.env.DEFAULT_PIN,
        displayName: 'ANTIPOST'
    }
];

async function main() {
    for (const u of users) {
        const passwordHash = await bcrypt.hash(u.password, 10);
        const pinHash = await bcrypt.hash(u.pin, 10);

        const user = await prisma.admin_users.upsert({
            where: { username: u.username },
            update: {
                password_hash: passwordHash,
                pin_hash: pinHash,
                display_name: u.displayName
            },
            create: {
                username: u.username,
                password_hash: passwordHash,
                pin_hash: pinHash,
                display_name: u.displayName
            }
        });

        console.log(`✅ User '${user.username}' (${u.displayName}) berhasil dibuat/diperbarui.`);
        console.log(`   Password: ${u.password} | PIN: ${u.pin}`);
    }
}

main()
    .catch(e => {
        console.error('❌ Seed gagal:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
