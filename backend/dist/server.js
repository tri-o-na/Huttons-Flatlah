"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const properties_1 = __importDefault(require("./routes/properties"));
const towns_1 = __importDefault(require("./routes/towns"));
const comparison_1 = __importDefault(require("./routes/comparison"));
const onemap_1 = __importDefault(require("./routes/onemap"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3002;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
// Routes
app.use('/api/properties', properties_1.default);
app.use('/api/towns', towns_1.default);
app.use('/api/comparison', comparison_1.default);
app.use('/api/onemap', onemap_1.default);
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
