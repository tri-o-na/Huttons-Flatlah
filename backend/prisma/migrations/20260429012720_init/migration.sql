-- CreateTable
CREATE TABLE "properties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" DATETIME NOT NULL,
    "town" TEXT NOT NULL,
    "flat_type" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "storey_range" TEXT NOT NULL,
    "floor_area_sqm" REAL NOT NULL,
    "flat_model" TEXT NOT NULL,
    "lease_commence_date" INTEGER NOT NULL,
    "remaining_lease" TEXT NOT NULL,
    "resale_price" INTEGER NOT NULL,
    "psf" REAL NOT NULL
);
