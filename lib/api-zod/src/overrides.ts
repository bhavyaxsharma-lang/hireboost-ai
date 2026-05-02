import { z } from "zod";
import {
  CreateInterviewSessionBody as _CreateInterviewSessionBody,
  createInterviewSessionBodyQuestionCountMax,
} from "./generated/api";

export const CreateInterviewSessionBody = _CreateInterviewSessionBody.extend({
  questionCount: z
    .number()
    .int()
    .min(1)
    .max(createInterviewSessionBodyQuestionCountMax)
    .optional(),
});
