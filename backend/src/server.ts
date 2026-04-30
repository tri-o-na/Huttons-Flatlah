import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import propertyRoutes from './routes/properties';
import townRoutes from './routes/towns';
import comparisonRoutes from './routes/comparison';
import onemapRoutes from './routes/onemap';
import amenitiesRoutes from './routes/amenities';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

// Routes
app.use('/api/properties', propertyRoutes);
app.use('/api/towns', townRoutes);
app.use('/api/comparison', comparisonRoutes);
app.use('/api/onemap', onemapRoutes);
app.use('/api/amenities', amenitiesRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export { prisma };