import { ErrorCode, ErrorCodes } from "../constants/error-codes";

export class AppError extends Error {
  statusCode: number;
  code: ErrorCode;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
