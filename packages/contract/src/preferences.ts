import { z } from "zod";
import { NameSchema, named } from "./common.js";

export const RemotePolicySchema = named("RemotePolicy", z.enum(["remote", "hybrid", "onsite"]));
export const SenioritySchema = named("Seniority", z.enum(["intern", "junior", "mid", "senior", "lead", "executive"]));
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const SalaryPeriodSchema = named("SalaryPeriod", z.enum(["hour", "day", "week", "month", "year"]));

const MinimumSalarySchema = z.strictObject({
  amount: z.number().positive(),
  currency: CurrencySchema,
  period: SalaryPeriodSchema
});

const textList = z.array(NameSchema).max(50);

/** What the user wants. A new user gets every list empty, not a 404. Null clears `aim` and `minimumSalary`. */
export const PreferencesDtoSchema = named(
  "PreferencesDto",
  z.strictObject({
    roles: textList,
    keywordsInclude: textList,
    keywordsExclude: textList,
    locations: textList,
    remotePolicies: z.array(RemotePolicySchema).max(3),
    /** ISO 3166-1 alpha-2. */
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(50),
    minimumSalary: MinimumSalarySchema.nullable(),
    seniority: z.array(SenioritySchema).max(6),
    /** Optional "what I'm aiming for": target roles and two or three highlights. */
    aim: z.string().trim().min(1).max(1000).nullable()
  })
);

export type PreferencesDto = z.infer<typeof PreferencesDtoSchema>;
