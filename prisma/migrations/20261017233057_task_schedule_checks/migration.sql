-- Database-level guarantees for task scheduling (the API validates the same rules first).

-- startAt and endAt are set together or not at all
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_start_end_together"
  CHECK (("start_at" IS NULL) = ("end_at" IS NULL));

-- a timed task must end after it starts
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_end_after_start"
  CHECK ("start_at" IS NULL OR "end_at" > "start_at");

-- a task is either date-only (due_date) or timed (start_at/end_at), never both
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_date_or_timed"
  CHECK ("due_date" IS NULL OR "start_at" IS NULL);
