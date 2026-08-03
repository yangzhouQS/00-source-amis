import { HttpException, HttpStatus } from "@nestjs/common";

class BadRequestError extends HttpException {
  constructor(message?: string) {
    super({ message: message || "Unknown Error" }, HttpStatus.BAD_REQUEST);
  }
}

class InfoRequestError extends HttpException {
  constructor(message?: string) {
    super({ message: message || "Unknown Error" }, HttpStatus.NON_AUTHORITATIVE_INFORMATION);
  }
}

export { BadRequestError, InfoRequestError };
