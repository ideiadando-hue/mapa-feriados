import { z } from "zod";

export const EventoExtraidoSchema = z.object({
  title: z.string().min(3),
  eventType: z.enum(["FERIADO", "PONTO_FACULTATIVO", "LUTO_OFICIAL", "SUSPENSAO"]),
  scope: z.enum(["NATIONAL", "STATE", "MUNICIPAL"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  suspendsWork: z.boolean(),
  legalBasis: z.string().nullable().optional(),
  excerpt: z.string().min(10),
});

export const LoteSchema = z.object({
  eventos: z.array(EventoExtraidoSchema),
});

export type EventoExtraido = z.infer<typeof EventoExtraidoSchema>;