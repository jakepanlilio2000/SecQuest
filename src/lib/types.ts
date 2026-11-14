import { z } from "zod";
export const questionSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(90),
  revision: z.number().int().positive(),
  type: z.enum([
    "single",
    "multiple",
    "scenario",
    "matching",
    "ordering",
    "log",
  ]),
  // Syntax only: validateQuestion must check the selected objective tree.
  objective: z
    .string()
    .max(20)
    .regex(/^[1-9]\d*\.\d+$/),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  prompt: z.string().min(25).max(6000),
  concept: z.string().min(2).max(100),
  options: z
    .array(
      z.object({
        id: z.string().max(40),
        text: z.string().min(1).max(500),
        explanation: z.string().min(15).max(2000),
      }),
    )
    .min(3)
    .max(8),
  correct: z.array(z.string()).min(1).max(8),
  definition: z.string().min(25).max(3000),
  explanation: z.string().min(25).max(4000),
  examples: z.array(z.string().min(20).max(1000)).min(2).max(5),
  mnemonic: z.string().max(500),
  categories: z.array(z.string().max(80)).min(1).max(15),
  sources: z.array(z.string().max(80)).min(1).max(10),
  pairs: z.array(z.string().max(200)).optional(),
  artifact: z.string().max(6000).optional(),
});
export type Question = z.infer<typeof questionSchema>;
export type PublicQuestion = Omit<
  Question,
  | "correct"
  | "definition"
  | "explanation"
  | "examples"
  | "mnemonic"
  | "sources"
  | "options"
> & { options: { id: string; text: string }[]; required: number };
export type Mode =
  "learning" | "practice" | "recovery" | "daily" | "mock" | "challenge";
export type Confidence = "knew" | "unsure" | "guessed" | null;
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  settings: string;
  created_at: string;
}
export interface Review {
  user_id: string;
  question_id: string;
  due_at: string;
  interval_days: number;
  ease: number;
  repetitions: number;
  lapses: number;
  retained: number;
  last_at: string;
  state: string;
}
export interface Attempt {
  id: string;
  user_id: string;
  session_id: string;
  item_id: string;
  question_id: string;
  revision: number;
  selected: string;
  correct: number;
  first_attempt: number;
  retry: number;
  retention: number;
  confidence: Confidence;
  duration_ms: number;
  created_at: string;
  objective: string;
  difficulty: string;
  concept: string;
}
export interface Item {
  id: string;
  session_id: string;
  question_id: string;
  revision: number;
  position: number;
  selected: string | null;
  flagged: number;
  answered_at: string | null;
  shown_at: string | null;
  retry: number;
  feedback: string | null;
}
export interface Session {
  id: string;
  user_id: string;
  mode: Mode;
  settings: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
  cursor: number;
  processed: number;
}
export interface Feedback {
  attemptId?: string;
  skipped?: boolean;
  correct: boolean;
  selected: string[];
  answer: string[];
  question: Question;
  reviewDue: string;
  retry: boolean;
  xp: number;
}
export const ranks = [
  "Security Recruit",
  "Cybersecurity Trainee",
  "Junior Analyst",
  "Security Analyst",
  "Security Specialist",
  "SOC Operator",
  "Security Engineer",
  "Threat Investigator",
  "Security Architect",
  "Cybersecurity Master",
];
export const rankFor = (xp: number) =>
  ranks[Math.min(9, Math.floor(Math.sqrt(xp / 100)))];
