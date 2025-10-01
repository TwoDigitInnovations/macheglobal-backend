class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;

    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ErrorResponse);
    }

    this.name = this.constructor.name;
  }

 
  static create(message, statusCode) {
    return new ErrorResponse(message, statusCode);
  }

  // Convert error to JSON
  toJSON() {
    return {
      success: false,
      message: this.message,
      statusCode: this.statusCode,
      name: this.name,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

module.exports = ErrorResponse;
