import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Fila de jobs de orçamento. Fonte de verdade do processamento assíncrono:
// Next cria (pending) -> worker Python reivindica (in_progress) -> conclui
// (completed/failed). Ver docs/arquitetura/.
export const JOB_STATUS = ['pending', 'in_progress', 'completed', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status').$type<JobStatus>().notNull().default('pending'),
  filename: text('filename').notNull(),           // nome da planilha enviada
  inputDir: text('input_dir').notNull(),          // pasta local com planilha + desenhos
  nDesenhos: integer('n_desenhos').notNull().default(0),
  useLlm: boolean('use_llm').notNull().default(false),
  progress: text('progress'),                     // mensagem de progresso (worker)
  result: jsonb('result'),                        // resumo + relatorio + work_list + writeback
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
