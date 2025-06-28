import { Request, Response, NextFunction } from "express";
import { body, validationResult, ValidationChain } from "express-validator";
import { UserInputError } from "apollo-server-express";

// Validation error handler
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }

  next();
  return;
};

// GraphQL validation error handler
export const handleGraphQLValidationErrors = (validationErrors: any[]) => {
  if (validationErrors.length > 0) {
    throw new UserInputError("Validation failed", {
      validationErrors: validationErrors.map((error) => ({
        field: error.param,
        message: error.msg,
        value: error.value,
      })),
    });
  }
};

// Email validation
export const validateEmail: ValidationChain[] = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address")
    .isLength({ min: 5, max: 254 })
    .withMessage("Email must be between 5 and 254 characters"),
];

// Password validation
export const validatePassword: ValidationChain[] = [
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
    ),
];

// Username validation
export const validateUsername: ValidationChain[] = [
  body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
];

// Name validation
export const validateName: ValidationChain[] = [
  body("firstName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("First name must be between 1 and 50 characters")
    .matches(/^[a-zA-Z\s-']+$/)
    .withMessage(
      "First name can only contain letters, spaces, hyphens, and apostrophes"
    ),

  body("lastName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name must be between 1 and 50 characters")
    .matches(/^[a-zA-Z\s-']+$/)
    .withMessage(
      "Last name can only contain letters, spaces, hyphens, and apostrophes"
    ),
];

// Registration validation
export const validateRegistration = [
  ...validateEmail,
  ...validatePassword,
  ...validateUsername,
  ...validateName,
  handleValidationErrors,
];

// Login validation
export const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// Password reset validation
export const validatePasswordReset = [...validateEmail, handleValidationErrors];

// Change password validation
export const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  ...validatePassword,
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Password confirmation does not match password");
    }
    return true;
  }),
  handleValidationErrors,
];

// GraphQL input validation helpers
export const validateGraphQLInput = {
  email: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new UserInputError("Invalid email format");
    }
    if (email.length < 5 || email.length > 254) {
      throw new UserInputError("Email must be between 5 and 254 characters");
    }
  },

  password: (password: string) => {
    if (password.length < 8 || password.length > 128) {
      throw new UserInputError("Password must be between 8 and 128 characters");
    }
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
        password
      )
    ) {
      throw new UserInputError(
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
      );
    }
  },

  username: (username: string) => {
    if (username.length < 3 || username.length > 30) {
      throw new UserInputError("Username must be between 3 and 30 characters");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new UserInputError(
        "Username can only contain letters, numbers, and underscores"
      );
    }
  },

  name: (name: string, fieldName: string) => {
    if (name.length < 1 || name.length > 50) {
      throw new UserInputError(
        `${fieldName} must be between 1 and 50 characters`
      );
    }
    if (!/^[a-zA-Z\s-']+$/.test(name)) {
      throw new UserInputError(
        `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`
      );
    }
  },
};
