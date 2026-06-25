import {
  CV_MARKDOWN_MAX_BYTES,
  SaveCvRequestDtoSchema,
  type CvDto,
  type SaveCvRequestDto
} from "../contracts/index.js";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { ApiError } from "../errors/api-error.js";
import { createCvFileAdapter } from "../workspace/cv-file-adapter.js";

export interface CvService {
  getCv(): Promise<CvDto>;
  saveCv(request: SaveCvRequestDto): Promise<CvDto>;
}

export function createCvService(config: RuntimeConfig): CvService {
  const adapter = createCvFileAdapter(config.workspace);

  return {
    async getCv(): Promise<CvDto> {
      return adapter.readCv();
    },

    async saveCv(request: SaveCvRequestDto): Promise<CvDto> {
      const markdown = validateSaveRequest(request);
      return adapter.writeCv(markdown);
    }
  };
}

function validateSaveRequest(request: SaveCvRequestDto): string {
  if (Buffer.byteLength(request.markdown, "utf8") > CV_MARKDOWN_MAX_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "CV Markdown must be 512 KiB or smaller.");
  }

  if (request.markdown.trim().length === 0) {
    throw new ApiError("VALIDATION_ERROR", "CV Markdown must not be blank.");
  }

  return SaveCvRequestDtoSchema.parse(request).markdown;
}
