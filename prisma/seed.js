const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: 'it@disenartemx.com', name: 'IT · Administración', role: 'admin', password: 'Intothenewerait2026' },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { email: u.email, name: u.name, role: u.role, passwordHash } });
  }

  const existingGroups = await prisma.group.count();
  if (existingGroups > 0) { console.log('Ya hay grupos/inventario, se omite la siembra de datos.'); return; }

  const groupsData = [
    { label: 'Producción · Insumos', area: 'produccion', color: '#A53692', order: 0, categories: [
      { name: 'Acrílicos', unit: 'piezas', items: [
        { name: 'Acrílico transparente 3mm', qty: 38, reorder: 15, characteristics: { Espesor: '3 mm', Color: 'Transparente' } },
        { name: 'Acrílico blanco 5mm', qty: 6, reorder: 10, characteristics: { Espesor: '5 mm', Color: 'Blanco' } },
      ] },
      { name: 'Placas MDF', unit: 'piezas', items: [
        { name: 'Placa MDF 4mm', qty: 22, reorder: 10, characteristics: { Espesor: '4 mm' } },
        { name: 'Placa MDF 9mm', qty: 0, reorder: 8, characteristics: { Espesor: '9 mm' } },
      ] },
      { name: 'Coroplast y trovicel', unit: 'piezas', items: [
        { name: 'Coroplast 4mm blanco', qty: 45, reorder: 20, characteristics: { Espesor: '4 mm', Color: 'Blanco' } },
        { name: 'Trovicel 3mm', qty: 12, reorder: 15, characteristics: { Espesor: '3 mm' } },
      ] },
    ] },
    { label: 'Producción · Herramienta', area: 'produccion', color: '#7C07A6', order: 1, categories: [] },
    { label: 'Diseño · Insumos', area: 'diseno', color: '#5CC6D0', order: 2, categories: [
      { name: 'Rollos de vinil', unit: 'metros', items: [
        { name: 'Vinil blanco brillante', qty: 30, reorder: 12, characteristics: { Acabado: 'Brillante', Color: 'Blanco' } },
        { name: 'Vinil negro mate', qty: 4, reorder: 10, characteristics: { Acabado: 'Mate', Color: 'Negro' } },
      ] },
      { name: 'Laminados', unit: 'rollos', items: [
        { name: 'Laminado mate', qty: 18, reorder: 8, characteristics: { Acabado: 'Mate' } },
        { name: 'Laminado brillante', qty: 0, reorder: 6, characteristics: { Acabado: 'Brillante' } },
      ] },
      { name: 'Tintas', unit: 'litros', items: [
        { name: 'Tinta cian', qty: 7, reorder: 3, characteristics: { Color: 'Cian' } },
        { name: 'Tinta magenta', qty: 2, reorder: 3, characteristics: { Color: 'Magenta' } },
      ] },
    ] },
  ];

  for (const g of groupsData) {
    const group = await prisma.group.create({ data: { label: g.label, area: g.area, color: g.color, order: g.order } });
    for (const c of g.categories) {
      const schema = [];
      c.items.forEach(it => Object.keys(it.characteristics).forEach(k => { if (!schema.includes(k)) schema.push(k); }));
      const category = await prisma.category.create({ data: { name: c.name, unit: c.unit, schema, groupId: group.id } });
      for (const it of c.items) {
        await prisma.item.create({ data: { name: it.name, qty: it.qty, reorder: it.reorder, characteristics: it.characteristics, categoryId: category.id } });
      }
    }
  }
  console.log('Seed completo.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
