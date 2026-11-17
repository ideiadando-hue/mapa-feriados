-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('FERIADO', 'PONTO_FACULTATIVO', 'LUTO_OFICIAL', 'SUSPENSAO');

-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('NATIONAL', 'STATE', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('UNVERIFIED', 'PROJECTED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "scope" "Scope" NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "suspendsWork" BOOLEAN NOT NULL DEFAULT true,
    "isProjected" BOOLEAN NOT NULL DEFAULT false,
    "sourceWeight" DOUBLE PRECISION NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'UNVERIFIED',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "legalBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSource" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'official',
    "weight" DOUBLE PRECISION NOT NULL,
    "excerpt" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_date_scope_idx" ON "CalendarEvent"("date", "scope");

-- CreateIndex
CREATE INDEX "CalendarEvent_state_date_idx" ON "CalendarEvent"("state", "date");

-- CreateIndex
CREATE INDEX "CalendarEvent_published_date_idx" ON "CalendarEvent"("published", "date");

-- CreateIndex
CREATE INDEX "CalendarEvent_eventType_date_idx" ON "CalendarEvent"("eventType", "date");

-- CreateIndex
CREATE INDEX "CalendarSource_eventId_idx" ON "CalendarSource"("eventId");

-- AddForeignKey
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
