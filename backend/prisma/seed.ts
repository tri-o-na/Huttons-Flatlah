import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

async function seed() {
  const csvPath = path.join(__dirname, '../../dataset/ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv');

  const properties: any[] = [];

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (data: any) => {
      const month = new Date(data.month + '-01');
      const resale_price = parseInt(data.resale_price);
      const floor_area_sqm = parseFloat(data.floor_area_sqm);
      const lease_commence_date = parseInt(data.lease_commence_date);
      const psf = resale_price / (floor_area_sqm * 10.764);

      properties.push({
        month,
        town: data.town,
        flat_type: data.flat_type,
        block: data.block,
        street_name: data.street_name,
        storey_range: data.storey_range,
        floor_area_sqm,
        flat_model: data.flat_model,
        lease_commence_date,
        remaining_lease: data.remaining_lease,
        resale_price,
        psf
      });
    })
    .on('end', async () => {
      console.log('CSV parsed, inserting into DB...');
      await prisma.property.createMany({ data: properties });
      console.log('Seeding completed');
      await prisma.$disconnect();
    });
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});