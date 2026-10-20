export class GoodGirlError extends Error {
  public readonly code: string;

  constructor(message: string, code = "GOODGIRL_ERROR") {
    super(message);
    this.name = "GoodGirlError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigError extends GoodGirlError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class TestExecutionError extends GoodGirlError {
  public readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message, "TEST_EXECUTION_ERROR");
    this.name = "TestExecutionError";
    this.exitCode = exitCode;
  }
}

export class DoctorError extends GoodGirlError {
  constructor(message: string) {
    super(message, "DOCTOR_ERROR");
    this.name = "DoctorError";
  }
}
